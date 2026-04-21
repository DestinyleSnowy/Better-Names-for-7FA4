import {
    PANEL_CATEGORIES,
    PANEL_OPTIONS,
    PANEL_SETTINGS_STORAGE_KEY,
    type PanelCategory,
    type PanelCategoryId,
    type PanelOption,
    type PanelSettingKey,
    type PanelSettings
} from '@features/panel/panel-catalog';
import { loadPanelSettings, mergePanelSettings, watchPanelSettings } from '@features/panel/panel-settings';
import type { StorageAdapter } from '@shared/contracts/adapters';

interface PanelUiState {
    isOpen: boolean;
    activeCategory: PanelCategoryId;
    query: string;
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
    return escapeHtml(value).replaceAll('\n', ' ');
}

function resolveThemeMode(settings: PanelSettings): 'light' | 'dark' {
    if (settings.themeMode === 'light' || settings.themeMode === 'dark') {
        return settings.themeMode;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveBackgroundSize(fillMode: PanelSettings['backgroundFillMode']): string {
    switch (fillMode) {
        case 'cover':
            return 'cover';
        case 'contain':
            return 'contain';
        case 'tile':
            return 'auto';
        case 'center':
            return 'auto';
        case 'stretch':
        default:
            return '100% 100%';
    }
}

function resolveBackgroundRepeat(fillMode: PanelSettings['backgroundFillMode']): string {
    return fillMode === 'tile' ? 'repeat' : 'no-repeat';
}

function resolveBackgroundPosition(fillMode: PanelSettings['backgroundFillMode']): string {
    return fillMode === 'tile' ? 'top left' : 'center';
}

function categoryMetaMap(): Map<PanelCategoryId, PanelCategory> {
    return new Map(PANEL_CATEGORIES.map((category) => [category.id, category]));
}

function filterOptions(query: string, activeCategory: PanelCategoryId): PanelOption[] {
    const normalizedQuery = query.trim().toLowerCase();
    const base = PANEL_OPTIONS.filter((option) => {
        if (!normalizedQuery) {
            return activeCategory === 'overview' ? false : option.category === activeCategory;
        }

        const haystack = `${option.label} ${option.description} ${option.category}`.toLowerCase();
        return haystack.includes(normalizedQuery);
    });

    return base;
}

function countEnabledSettings(settings: PanelSettings): number {
    return Object.values(settings).filter((value) => value === true).length;
}

function renderControl(option: PanelOption, settings: PanelSettings): string {
    const value = settings[option.key];

    if (option.kind === 'toggle') {
        return `
            <label class="bn-switch">
                <input type="checkbox" data-setting-key="${option.key}" ${value === true ? 'checked' : ''}>
                <span class="bn-switch-track"></span>
            </label>
        `;
    }

    if (option.kind === 'select') {
        return `
            <select class="bn-select" data-setting-key="${option.key}">
                ${option.options.map((entry) => `
                    <option value="${entry.value}" ${String(value) === entry.value ? 'selected' : ''}>
                        ${entry.label}
                    </option>
                `).join('')}
            </select>
        `;
    }

    if (option.kind === 'number') {
        return `
            <div class="bn-number-wrap">
                <input
                    class="bn-number"
                    type="number"
                    data-setting-key="${option.key}"
                    min="${option.min}"
                    max="${option.max}"
                    step="${option.step}"
                    value="${String(value)}"
                >
                ${option.suffix ? `<span class="bn-number-suffix">${option.suffix}</span>` : ''}
            </div>
        `;
    }

    if (option.kind === 'color') {
        return `
            <label class="bn-color-field">
                <input class="bn-color" type="color" data-setting-key="${option.key}" value="${String(value)}">
                <span class="bn-color-code">${escapeHtml(String(value))}</span>
            </label>
        `;
    }

    return `
        <input
            class="bn-text"
            type="text"
            data-setting-key="${option.key}"
            value="${escapeHtml(String(value))}"
            placeholder="${escapeHtml(option.placeholder)}"
        >
    `;
}

function renderOptionCard(option: PanelOption, settings: PanelSettings, compact = false): string {
    const value = settings[option.key];
    const isActive = value === true || (typeof value === 'number' && value > 0) || (typeof value === 'string' && value.trim() !== '');
    const meta = option.kind === 'number' && option.hint
        ? `<div class="bn-option-meta">${escapeHtml(option.hint)}</div>`
        : '';

    return `
        <article class="bn-option-card ${compact ? 'bn-option-card-compact' : ''} ${isActive ? 'is-active' : ''}">
            <div class="bn-option-copy">
                <div class="bn-option-title-row">
                    <h4 class="bn-option-title">${escapeHtml(option.label)}</h4>
                    ${compact ? `<span class="bn-pill">${escapeHtml(option.category)}</span>` : ''}
                </div>
                <p class="bn-option-description">${escapeHtml(option.description)}</p>
                ${meta}
            </div>
            <div class="bn-option-control">
                ${renderControl(option, settings)}
            </div>
        </article>
    `;
}

function renderOverview(settings: PanelSettings): string {
    const featuredOptions = PANEL_OPTIONS.filter((option) => option.featured);
    const categoryCards = PANEL_CATEGORIES.filter((category) => category.id !== 'overview')
        .map((category) => {
            const count = PANEL_OPTIONS.filter((option) => option.category === category.id).length;
            return `
                <button class="bn-category-preview" data-category-preview="${category.id}">
                    <span class="bn-category-preview-label">${escapeHtml(category.label)}</span>
                    <span class="bn-category-preview-desc">${escapeHtml(category.description)}</span>
                    <span class="bn-category-preview-count">${count} 项</span>
                </button>
            `;
        })
        .join('');

    return `
        <section class="bn-overview-hero">
            <div>
                <div class="bn-overview-eyebrow">Better Names</div>
                <h2 class="bn-overview-title">先做高频，再进深层。</h2>
                <p class="bn-overview-copy">
                    面板首页只保留最常用设置；全部选项仍然完整保留在分类页和搜索结果里。
                </p>
            </div>
            <div class="bn-overview-metrics">
                <div class="bn-metric-card">
                    <span class="bn-metric-label">已启用</span>
                    <strong class="bn-metric-value">${countEnabledSettings(settings)}</strong>
                </div>
                <div class="bn-metric-card">
                    <span class="bn-metric-label">可调选项</span>
                    <strong class="bn-metric-value">${PANEL_OPTIONS.length}</strong>
                </div>
            </div>
        </section>

        <section class="bn-section-block">
            <div class="bn-section-header">
                <h3>快速设置</h3>
                <p>只放用户最常碰的开关，避免首页变成选项墙。</p>
            </div>
            <div class="bn-featured-grid">
                ${featuredOptions.map((option) => renderOptionCard(option, settings, true)).join('')}
            </div>
        </section>

        <section class="bn-section-block">
            <div class="bn-section-header">
                <h3>分类入口</h3>
                <p>深层选项按任务拆开，而不是全部平铺。</p>
            </div>
            <div class="bn-category-preview-grid">
                ${categoryCards}
            </div>
        </section>
    `;
}

function renderSearchResults(settings: PanelSettings, query: string): string {
    const results = filterOptions(query, 'overview');
    if (results.length === 0) {
        return `
            <section class="bn-empty-state">
                <h3>没有匹配项</h3>
                <p>换个关键词，或者从左侧分类进入。</p>
            </section>
        `;
    }

    return `
        <section class="bn-section-block">
            <div class="bn-section-header">
                <h3>搜索结果</h3>
                <p>共找到 ${results.length} 项。</p>
            </div>
            <div class="bn-options-list">
                ${results.map((option) => renderOptionCard(option, settings)).join('')}
            </div>
        </section>
    `;
}

function renderCategory(settings: PanelSettings, categoryId: PanelCategoryId): string {
    const results = filterOptions('', categoryId);
    if (results.length === 0) {
        return `
            <section class="bn-empty-state">
                <h3>这一组暂时为空</h3>
                <p>当前分类下还没有可调项。</p>
            </section>
        `;
    }

    return `
        <section class="bn-section-block">
            <div class="bn-options-list">
                ${results.map((option) => renderOptionCard(option, settings)).join('')}
            </div>
        </section>
    `;
}

function renderContent(settings: PanelSettings, ui: PanelUiState): string {
    if (ui.query.trim()) {
        return renderSearchResults(settings, ui.query);
    }
    if (ui.activeCategory === 'overview') {
        return renderOverview(settings);
    }
    return renderCategory(settings, ui.activeCategory);
}

function createStyles(): string {
    return `
        :host {
            all: initial;
        }

        * {
            box-sizing: border-box;
        }

        .bn-root {
            --bn-accent: var(--bn-user-accent, #0f766e);
            --bn-bg: rgba(248, 246, 241, 0.94);
            --bn-surface: rgba(255, 255, 255, 0.82);
            --bn-surface-strong: rgba(255, 255, 255, 0.94);
            --bn-border: rgba(23, 23, 23, 0.08);
            --bn-text: #111827;
            --bn-muted: #5b6472;
            --bn-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
            --bn-shadow-soft: 0 12px 26px rgba(15, 23, 42, 0.1);
            position: fixed;
            z-index: 2147483647;
            font-family: "Segoe UI Variable Display", "HarmonyOS Sans SC", "Noto Sans SC", "Microsoft YaHei UI", sans-serif;
            color: var(--bn-text);
        }

        .bn-root.is-dark {
            --bn-bg: rgba(10, 14, 19, 0.92);
            --bn-surface: rgba(21, 27, 35, 0.78);
            --bn-surface-strong: rgba(24, 30, 39, 0.94);
            --bn-border: rgba(255, 255, 255, 0.08);
            --bn-text: #f4f7fb;
            --bn-muted: #98a4b5;
            --bn-shadow: 0 28px 70px rgba(0, 0, 0, 0.42);
            --bn-shadow-soft: 0 12px 28px rgba(0, 0, 0, 0.24);
        }

        .bn-root.pos-br { right: 24px; bottom: 24px; }
        .bn-root.pos-bl { left: 24px; bottom: 24px; }
        .bn-root.pos-tr { right: 24px; top: 24px; }
        .bn-root.pos-tl { left: 24px; top: 24px; }

        .bn-trigger {
            width: 62px;
            height: 62px;
            border: 1px solid var(--bn-border);
            border-radius: 20px;
            background:
                radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.55), transparent 40%),
                linear-gradient(135deg, color-mix(in srgb, var(--bn-accent) 16%, var(--bn-surface-strong)) 0%, var(--bn-surface-strong) 100%);
            color: var(--bn-text);
            box-shadow: var(--bn-shadow-soft);
            backdrop-filter: blur(18px);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 2px;
            cursor: pointer;
            transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }

        .bn-trigger:hover {
            transform: translateY(-2px);
            box-shadow: var(--bn-shadow);
            border-color: color-mix(in srgb, var(--bn-accent) 32%, var(--bn-border));
        }

        .bn-trigger-badge {
            font-size: 11px;
            line-height: 1;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--bn-muted);
        }

        .bn-trigger-title {
            font-size: 17px;
            font-weight: 700;
        }

        .bn-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.18);
            backdrop-filter: blur(8px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 180ms ease;
        }

        .bn-root.is-open .bn-overlay {
            opacity: 1;
            pointer-events: auto;
        }

        .bn-panel {
            position: fixed;
            width: min(1120px, calc(100vw - 32px));
            height: min(760px, calc(100vh - 32px));
            border-radius: 28px;
            border: 1px solid var(--bn-border);
            background:
                radial-gradient(circle at top left, color-mix(in srgb, var(--bn-accent) 18%, transparent) 0%, transparent 34%),
                radial-gradient(circle at top right, rgba(240, 140, 38, 0.14) 0%, transparent 30%),
                var(--bn-bg);
            box-shadow: var(--bn-shadow);
            backdrop-filter: blur(24px);
            overflow: hidden;
            display: grid;
            grid-template-columns: 240px minmax(0, 1fr);
            transform: translateY(14px) scale(0.98);
            opacity: 0;
            pointer-events: none;
            transition: transform 220ms ease, opacity 220ms ease;
            isolation: isolate;
        }

        .bn-panel > * {
            position: relative;
            z-index: 1;
        }

        .bn-panel-media {
            position: absolute;
            inset: -24px;
            z-index: 0;
            pointer-events: none;
            transform: scale(1.04);
        }

        .bn-root.pos-br .bn-panel,
        .bn-root.pos-bl .bn-panel {
            bottom: 24px;
        }

        .bn-root.pos-tr .bn-panel,
        .bn-root.pos-tl .bn-panel {
            top: 24px;
        }

        .bn-root.pos-br .bn-panel,
        .bn-root.pos-tr .bn-panel {
            right: 24px;
        }

        .bn-root.pos-bl .bn-panel,
        .bn-root.pos-tl .bn-panel {
            left: 24px;
        }

        .bn-root.is-open .bn-panel {
            transform: translateY(0) scale(1);
            opacity: 1;
            pointer-events: auto;
        }

        .bn-sidebar {
            padding: 22px;
            border-right: 1px solid var(--bn-border);
            background: linear-gradient(180deg, color-mix(in srgb, var(--bn-surface) 76%, transparent) 0%, transparent 100%);
            display: flex;
            flex-direction: column;
            gap: 18px;
        }

        .bn-brand {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .bn-brand-eyebrow {
            display: inline-flex;
            align-items: center;
            width: fit-content;
            padding: 6px 10px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--bn-accent) 12%, transparent);
            color: var(--bn-accent);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .bn-brand-title {
            font-size: 28px;
            line-height: 1;
            font-weight: 800;
            letter-spacing: -0.04em;
        }

        .bn-brand-copy {
            margin: 0;
            color: var(--bn-muted);
            font-size: 13px;
            line-height: 1.5;
        }

        .bn-category-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .bn-category-button {
            width: 100%;
            padding: 12px 14px;
            border: 1px solid transparent;
            border-radius: 16px;
            background: transparent;
            color: var(--bn-text);
            text-align: left;
            cursor: pointer;
            transition: background 180ms ease, border-color 180ms ease, transform 180ms ease;
        }

        .bn-category-button:hover {
            background: color-mix(in srgb, var(--bn-surface-strong) 78%, transparent);
            border-color: var(--bn-border);
            transform: translateX(2px);
        }

        .bn-category-button.is-active {
            background: color-mix(in srgb, var(--bn-accent) 14%, var(--bn-surface-strong));
            border-color: color-mix(in srgb, var(--bn-accent) 40%, var(--bn-border));
        }

        .bn-category-label {
            display: block;
            font-size: 14px;
            font-weight: 700;
        }

        .bn-category-description {
            display: block;
            margin-top: 4px;
            color: var(--bn-muted);
            font-size: 12px;
            line-height: 1.4;
        }

        .bn-main {
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
        }

        .bn-toolbar {
            padding: 22px 24px 16px;
            border-bottom: 1px solid var(--bn-border);
            display: flex;
            align-items: center;
            gap: 14px;
            justify-content: space-between;
        }

        .bn-toolbar-copy h2 {
            margin: 0;
            font-size: 24px;
            line-height: 1;
            letter-spacing: -0.04em;
        }

        .bn-toolbar-copy p {
            margin: 8px 0 0;
            color: var(--bn-muted);
            font-size: 13px;
        }

        .bn-toolbar-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .bn-search {
            width: 280px;
            max-width: 42vw;
            height: 44px;
            border-radius: 14px;
            border: 1px solid var(--bn-border);
            background: color-mix(in srgb, var(--bn-surface-strong) 84%, transparent);
            padding: 0 14px;
            color: var(--bn-text);
            font: inherit;
        }

        .bn-close {
            width: 44px;
            height: 44px;
            border: 1px solid var(--bn-border);
            border-radius: 14px;
            background: color-mix(in srgb, var(--bn-surface-strong) 84%, transparent);
            color: var(--bn-text);
            cursor: pointer;
            font-size: 20px;
        }

        .bn-content {
            padding: 24px;
            overflow: auto;
            min-width: 0;
            min-height: 0;
        }

        .bn-overview-hero {
            display: grid;
            grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.8fr);
            gap: 18px;
            padding: 20px;
            border: 1px solid var(--bn-border);
            border-radius: 24px;
            background: linear-gradient(135deg, color-mix(in srgb, var(--bn-accent) 10%, var(--bn-surface-strong)) 0%, color-mix(in srgb, var(--bn-surface-strong) 92%, transparent) 100%);
            box-shadow: var(--bn-shadow-soft);
        }

        .bn-overview-eyebrow {
            color: var(--bn-accent);
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .bn-overview-title {
            margin: 10px 0 8px;
            font-size: clamp(28px, 4vw, 44px);
            line-height: 0.95;
            letter-spacing: -0.05em;
        }

        .bn-overview-copy {
            margin: 0;
            color: var(--bn-muted);
            font-size: 15px;
            line-height: 1.6;
            max-width: 56ch;
        }

        .bn-overview-metrics {
            display: grid;
            gap: 12px;
        }

        .bn-metric-card {
            padding: 18px;
            border: 1px solid var(--bn-border);
            border-radius: 20px;
            background: color-mix(in srgb, var(--bn-surface-strong) 86%, transparent);
        }

        .bn-metric-label {
            display: block;
            color: var(--bn-muted);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .bn-metric-value {
            display: block;
            margin-top: 8px;
            font-size: 34px;
            line-height: 1;
            letter-spacing: -0.05em;
        }

        .bn-section-block + .bn-section-block {
            margin-top: 22px;
        }

        .bn-section-header {
            margin-bottom: 14px;
        }

        .bn-section-header h3 {
            margin: 0;
            font-size: 18px;
        }

        .bn-section-header p {
            margin: 6px 0 0;
            color: var(--bn-muted);
            font-size: 13px;
        }

        .bn-featured-grid,
        .bn-options-list {
            display: grid;
            gap: 12px;
        }

        .bn-featured-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .bn-category-preview-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
        }

        .bn-category-preview {
            padding: 18px;
            border: 1px solid var(--bn-border);
            border-radius: 20px;
            background: color-mix(in srgb, var(--bn-surface-strong) 86%, transparent);
            text-align: left;
            color: var(--bn-text);
            cursor: pointer;
            transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .bn-category-preview:hover {
            transform: translateY(-2px);
            border-color: color-mix(in srgb, var(--bn-accent) 32%, var(--bn-border));
            box-shadow: var(--bn-shadow-soft);
        }

        .bn-category-preview-label {
            display: block;
            font-size: 16px;
            font-weight: 700;
        }

        .bn-category-preview-desc {
            display: block;
            margin-top: 8px;
            color: var(--bn-muted);
            font-size: 13px;
            line-height: 1.45;
        }

        .bn-category-preview-count {
            display: inline-flex;
            margin-top: 14px;
            padding: 5px 8px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--bn-accent) 12%, transparent);
            color: var(--bn-accent);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        .bn-option-card {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 16px;
            align-items: center;
            padding: 16px 18px;
            border: 1px solid var(--bn-border);
            border-radius: 20px;
            background: color-mix(in srgb, var(--bn-surface) 92%, transparent);
            box-shadow: var(--bn-shadow-soft);
        }

        .bn-option-card.is-active {
            border-color: color-mix(in srgb, var(--bn-accent) 34%, var(--bn-border));
        }

        .bn-option-card-compact {
            padding: 14px 16px;
        }

        .bn-option-copy {
            min-width: 0;
        }

        .bn-option-title-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .bn-option-title {
            margin: 0;
            font-size: 15px;
            line-height: 1.2;
        }

        .bn-option-description,
        .bn-option-meta {
            margin: 6px 0 0;
            color: var(--bn-muted);
            font-size: 13px;
            line-height: 1.45;
        }

        .bn-pill {
            display: inline-flex;
            padding: 4px 8px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--bn-accent) 12%, transparent);
            color: var(--bn-accent);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        .bn-option-control {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            min-width: 140px;
        }

        .bn-switch {
            position: relative;
            display: inline-flex;
            width: 54px;
            height: 32px;
        }

        .bn-switch input {
            position: absolute;
            inset: 0;
            opacity: 0;
        }

        .bn-switch-track {
            width: 100%;
            height: 100%;
            border-radius: 999px;
            background: rgba(148, 163, 184, 0.36);
            transition: background 160ms ease;
            position: relative;
        }

        .bn-switch-track::after {
            content: "";
            position: absolute;
            top: 4px;
            left: 4px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #fff;
            box-shadow: 0 2px 10px rgba(15, 23, 42, 0.2);
            transition: transform 160ms ease;
        }

        .bn-switch input:checked + .bn-switch-track {
            background: var(--bn-accent);
        }

        .bn-switch input:checked + .bn-switch-track::after {
            transform: translateX(22px);
        }

        .bn-select,
        .bn-number,
        .bn-text {
            width: 100%;
            min-width: 0;
            height: 42px;
            border-radius: 14px;
            border: 1px solid var(--bn-border);
            background: color-mix(in srgb, var(--bn-surface-strong) 84%, transparent);
            color: var(--bn-text);
            padding: 0 12px;
            font: inherit;
        }

        .bn-number-wrap,
        .bn-color-field {
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .bn-number-wrap {
            width: 160px;
        }

        .bn-number-suffix,
        .bn-color-code {
            color: var(--bn-muted);
            font-size: 12px;
            white-space: nowrap;
        }

        .bn-color {
            width: 42px;
            height: 42px;
            border: none;
            padding: 0;
            background: transparent;
        }

        .bn-empty-state {
            padding: 36px 20px;
            border: 1px dashed var(--bn-border);
            border-radius: 24px;
            text-align: center;
            color: var(--bn-muted);
        }

        .bn-empty-state h3 {
            margin: 0 0 8px;
            color: var(--bn-text);
        }

        @media (max-width: 980px) {
            .bn-panel {
                grid-template-columns: 1fr;
                height: min(86vh, 860px);
            }

            .bn-sidebar {
                border-right: 0;
                border-bottom: 1px solid var(--bn-border);
            }

            .bn-category-list {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .bn-featured-grid,
            .bn-category-preview-grid,
            .bn-overview-hero {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 720px) {
            .bn-root.pos-br,
            .bn-root.pos-bl,
            .bn-root.pos-tr,
            .bn-root.pos-tl {
                right: 16px;
                left: auto;
                top: auto;
                bottom: 16px;
            }

            .bn-panel {
                right: 16px !important;
                left: 16px !important;
                top: 16px !important;
                bottom: 16px !important;
                width: auto;
                height: auto;
                border-radius: 24px;
            }

            .bn-toolbar {
                flex-direction: column;
                align-items: stretch;
            }

            .bn-toolbar-actions {
                width: 100%;
            }

            .bn-search {
                width: 100%;
                max-width: none;
            }

            .bn-category-list {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .bn-option-card {
                grid-template-columns: 1fr;
            }

            .bn-option-control {
                justify-content: flex-start;
                min-width: 0;
            }
        }
    `;
}

export async function mountFloatingPanel(host: HTMLElement, storage: StorageAdapter) {
    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    let settings = await loadPanelSettings(storage);
    let ui: PanelUiState = {
        isOpen: false,
        activeCategory: 'overview',
        query: ''
    };

    const categories = categoryMetaMap();
    const colorSchemeMedia = window.matchMedia('(prefers-color-scheme: dark)');

    function themeClass(): string {
        if (resolveThemeMode(settings) === 'dark') {
            return 'is-dark';
        }
        return '';
    }

    function saveSettings() {
        void storage.set(PANEL_SETTINGS_STORAGE_KEY, settings);
    }

    function updateSetting(key: PanelSettingKey, rawValue: string | boolean) {
        const option = PANEL_OPTIONS.find((entry) => entry.key === key);
        if (!option) {
            return;
        }

        if (option.kind === 'toggle') {
            settings = {
                ...settings,
                [key]: Boolean(rawValue)
            };
        } else if (option.kind === 'number') {
            const next = Number(rawValue);
            settings = {
                ...settings,
                [key]: Number.isFinite(next) ? next : mergePanelSettings(undefined)[key]
            };
        } else {
            settings = {
                ...settings,
                [key]: String(rawValue)
            };
        }

        saveSettings();
        render();
    }

    function render(options?: { focusSearch?: boolean }) {
        const activeCategory = categories.get(ui.activeCategory) ?? categories.get('overview');
        const accent = settings.themeColor.trim() || '#0f766e';
        const hasBackgroundImage = settings.backgroundEnabled && settings.backgroundImageUrl.trim() !== '';
        const backgroundStyle = hasBackgroundImage
            ? `
                background-image: url('${escapeAttribute(settings.backgroundImageUrl.trim())}');
                background-size: ${resolveBackgroundSize(settings.backgroundFillMode)};
                background-repeat: ${resolveBackgroundRepeat(settings.backgroundFillMode)};
                background-position: ${resolveBackgroundPosition(settings.backgroundFillMode)};
                opacity: ${String(settings.backgroundOpacity)};
                filter: blur(${String(settings.backgroundBlur)}px);
            `
            : 'display: none;';

        shadowRoot.innerHTML = `
            <style>${createStyles()}</style>
            <div class="bn-root ${themeClass()} pos-${settings.corner} ${ui.isOpen ? 'is-open' : ''}" style="--bn-user-accent: ${escapeAttribute(accent)};">
                <button class="bn-trigger" type="button" data-action="toggle-panel">
                    <span class="bn-trigger-badge">Better</span>
                    <span class="bn-trigger-title">BN</span>
                </button>
                <div class="bn-overlay" data-action="close-panel"></div>
                <section class="bn-panel" aria-hidden="${ui.isOpen ? 'false' : 'true'}">
                    <div class="bn-panel-media" style="${backgroundStyle}"></div>
                    <aside class="bn-sidebar">
                        <div class="bn-brand">
                            <span class="bn-brand-eyebrow">Floating List</span>
                            <div class="bn-brand-title">设置不再平铺。</div>
                            <p class="bn-brand-copy">
                                首页只保留高频项，所有设置仍可搜索、分类和完整调整。
                            </p>
                        </div>
                        <nav class="bn-category-list">
                            ${PANEL_CATEGORIES.map((category) => `
                                <button
                                    class="bn-category-button ${ui.activeCategory === category.id ? 'is-active' : ''}"
                                    type="button"
                                    data-category="${category.id}"
                                >
                                    <span class="bn-category-label">${escapeHtml(category.label)}</span>
                                    <span class="bn-category-description">${escapeHtml(category.description)}</span>
                                </button>
                            `).join('')}
                        </nav>
                    </aside>
                    <div class="bn-main">
                        <header class="bn-toolbar">
                            <div class="bn-toolbar-copy">
                                <h2>${escapeHtml(activeCategory?.label ?? '总览')}</h2>
                                <p>${escapeHtml(activeCategory?.description ?? '高频入口与推荐设置')}</p>
                            </div>
                            <div class="bn-toolbar-actions">
                                <input
                                    class="bn-search"
                                    type="search"
                                    data-role="search"
                                    value="${escapeHtml(ui.query)}"
                                    placeholder="搜索设置，例如：头像、计划、榜单、Vjudge"
                                >
                                <button class="bn-close" type="button" data-action="close-panel" aria-label="关闭面板">×</button>
                            </div>
                        </header>
                        <main class="bn-content">
                            ${renderContent(settings, ui)}
                        </main>
                    </div>
                </section>
            </div>
        `;

        shadowRoot.querySelectorAll<HTMLElement>('[data-action="toggle-panel"]').forEach((element) => {
            element.addEventListener('click', () => {
                ui = { ...ui, isOpen: !ui.isOpen };
                render();
            });
        });

        shadowRoot.querySelectorAll<HTMLElement>('[data-action="close-panel"]').forEach((element) => {
            element.addEventListener('click', () => {
                ui = { ...ui, isOpen: false };
                render();
            });
        });

        shadowRoot.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((button) => {
            button.addEventListener('click', () => {
                const next = button.dataset.category as PanelCategoryId;
                ui = {
                    ...ui,
                    activeCategory: next,
                    query: ''
                };
                render();
            });
        });

        shadowRoot.querySelectorAll<HTMLButtonElement>('[data-category-preview]').forEach((button) => {
            button.addEventListener('click', () => {
                const next = button.dataset.categoryPreview as PanelCategoryId;
                ui = {
                    ...ui,
                    activeCategory: next,
                    query: ''
                };
                render();
            });
        });

        const search = shadowRoot.querySelector<HTMLInputElement>('[data-role="search"]');
        if (search) {
            search.addEventListener('input', () => {
                ui = {
                    ...ui,
                    query: search.value
                };
                render({ focusSearch: true });
            });
        }

        shadowRoot.querySelectorAll<HTMLInputElement>('input[data-setting-key]').forEach((input) => {
            const key = input.dataset.settingKey as PanelSettingKey;
            const type = input.type;

            if (type === 'checkbox') {
                input.addEventListener('change', () => updateSetting(key, input.checked));
                return;
            }

            input.addEventListener('change', () => updateSetting(key, input.value));
        });

        shadowRoot.querySelectorAll<HTMLSelectElement>('select[data-setting-key]').forEach((select) => {
            const key = select.dataset.settingKey as PanelSettingKey;
            select.addEventListener('change', () => updateSetting(key, select.value));
        });

        if (options?.focusSearch) {
            const nextSearch = shadowRoot.querySelector<HTMLInputElement>('[data-role="search"]');
            if (nextSearch) {
                const cursor = nextSearch.value.length;
                nextSearch.focus();
                nextSearch.setSelectionRange(cursor, cursor);
            }
        }
    }

    watchPanelSettings((nextSettings) => {
        settings = nextSettings;
        render();
    });

    colorSchemeMedia.addEventListener('change', () => {
        if (settings.themeMode === 'system') {
            render();
        }
    });

    render();
}
