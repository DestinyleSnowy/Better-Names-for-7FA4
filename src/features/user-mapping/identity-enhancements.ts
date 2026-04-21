import type { StorageAdapter } from '@shared/contracts/adapters';
import { loadPanelSettings, watchPanelSettings } from '@features/panel/panel-settings';
import type { PanelSettings } from '@features/panel/panel-catalog';

interface UserRecord {
    id?: number | string;
    userId?: number | string;
    uid?: number | string;
    displayName?: string;
    name?: string;
    nickname?: string;
    color?: string;
}

const IDENTITY_STYLE_ID = 'bn-identity-style';
const USER_MENU_ID = 'bn-user-context-menu';
const NICKNAME_BADGE_CLASS = 'bn-user-nickname-badge';

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function normalizeAccent(color: string): string {
    const trimmed = color.trim();
    return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : '#0f766e';
}

function createIdentityStyles(settings: PanelSettings): string {
    const accent = normalizeAccent(settings.themeColor);
    const avatarRule = settings.hideAvatar
        ? `
            img.avatar,
            img.ui.avatar.image,
            .avatar img,
            [class*="avatar"] img,
            img[src*="gravatar"] {
                visibility: hidden !important;
            }
        `
        : '';

    return `
        :root {
            --bn-accent: ${accent};
            --bn-accent-soft: color-mix(in srgb, var(--bn-accent) 18%, transparent);
            --bn-accent-strong: color-mix(in srgb, var(--bn-accent) 82%, black 0%);
        }

        ${avatarRule}

        .${NICKNAME_BADGE_CLASS} {
            display: inline-flex;
            align-items: center;
            margin-left: 0.45rem;
            padding: 0.16rem 0.46rem;
            border-radius: 999px;
            border: 1px solid color-mix(in srgb, var(--bn-accent) 24%, transparent);
            background: color-mix(in srgb, var(--bn-accent) 10%, white 90%);
            color: var(--bn-accent-strong);
            font-size: 0.74rem;
            line-height: 1.1;
            font-weight: 700;
            vertical-align: middle;
            white-space: nowrap;
        }

        #${USER_MENU_ID} {
            position: fixed;
            z-index: 2147483647;
            min-width: 180px;
            padding: 0.45rem;
            border-radius: 16px;
            border: 1px solid rgba(15, 23, 42, 0.08);
            background: rgba(255, 255, 255, 0.92);
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
            backdrop-filter: blur(18px);
            display: none;
        }

        #${USER_MENU_ID}.is-open {
            display: block;
        }

        #${USER_MENU_ID} a {
            display: flex;
            align-items: center;
            width: 100%;
            padding: 0.72rem 0.82rem;
            border-radius: 12px;
            color: #0f172a;
            text-decoration: none;
            font-size: 0.88rem;
            line-height: 1.2;
            transition: background 140ms ease, color 140ms ease, transform 140ms ease;
        }

        #${USER_MENU_ID} a:hover {
            background: color-mix(in srgb, var(--bn-accent) 12%, white 88%);
            color: var(--bn-accent-strong);
            transform: translateX(2px);
        }
    `;
}

function ensureStyleTag(root: Document): HTMLStyleElement {
    let style = root.getElementById(IDENTITY_STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
        style = root.createElement('style');
        style.id = IDENTITY_STYLE_ID;
        root.head.appendChild(style);
    }
    return style;
}

function resolveUserId(anchor: HTMLAnchorElement): string | null {
    const href = anchor.getAttribute('href') ?? '';
    const pathMatch = href.match(/\/user\/(\d+)/);
    if (pathMatch) {
        return pathMatch[1];
    }

    try {
        const url = new URL(href, window.location.origin);
        for (const key of ['user_id', 'uid', 'userId']) {
            const value = url.searchParams.get(key);
            if (value && /^\d+$/.test(value)) {
                return value;
            }
        }
    } catch (_) {
        return null;
    }

    return null;
}

function normalizeUserMapping(raw: unknown): Map<string, UserRecord> {
    const mapping = new Map<string, UserRecord>();

    if (Array.isArray(raw)) {
        for (const entry of raw) {
            if (!entry || typeof entry !== 'object') {
                continue;
            }

            const record = entry as UserRecord;
            const id = record.id ?? record.userId ?? record.uid;
            if (id !== undefined && id !== null) {
                mapping.set(String(id), record);
            }
        }
        return mapping;
    }

    if (!raw || typeof raw !== 'object') {
        return mapping;
    }

    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (!value || typeof value !== 'object') {
            continue;
        }
        mapping.set(key, value as UserRecord);
    }

    return mapping;
}

function resolveDisplayName(record: UserRecord | undefined): string {
    if (!record) {
        return '';
    }

    for (const candidate of [record.displayName, record.nickname, record.name]) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
    }

    return '';
}

function removeNicknameBadges(root: ParentNode) {
    root.querySelectorAll(`.${NICKNAME_BADGE_CLASS}`).forEach((node) => node.remove());
}

function applyNicknameBadges(root: Document, settings: PanelSettings, users: Map<string, UserRecord>) {
    removeNicknameBadges(root);

    if (!settings.showNickname) {
        return;
    }

    const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href*="/user/"], a[href*="user_id="], a[href*="uid="]');
    for (const anchor of anchors) {
        const userId = resolveUserId(anchor);
        if (!userId) {
            continue;
        }

        const displayName = resolveDisplayName(users.get(userId));
        if (!displayName) {
            continue;
        }

        const baseText = anchor.textContent?.trim() ?? '';
        if (baseText.includes(displayName)) {
            continue;
        }

        const badge = root.createElement('span');
        badge.className = NICKNAME_BADGE_CLASS;
        badge.textContent = displayName;

        const color = users.get(userId)?.color;
        if (typeof color === 'string' && color.trim()) {
            badge.style.borderColor = color;
            badge.style.color = color;
            badge.style.background = 'color-mix(in srgb, currentColor 12%, white 88%)';
        }

        anchor.appendChild(badge);
    }
}

function ensureUserMenu(root: Document): HTMLDivElement {
    let menu = root.getElementById(USER_MENU_ID) as HTMLDivElement | null;
    if (!menu) {
        menu = root.createElement('div');
        menu.id = USER_MENU_ID;
        root.body.appendChild(menu);
    }
    return menu;
}

function updateUserMenu(root: Document, settings: PanelSettings) {
    const menu = ensureUserMenu(root);
    let activeUserId = '';

    const closeMenu = () => {
        menu.classList.remove('is-open');
    };

    const openMenu = (event: MouseEvent, userId: string) => {
        activeUserId = userId;
        menu.innerHTML = `
            <a href="/user/${escapeHtml(userId)}">转到主页</a>
            <a href="/submissions?contest=&problem_id=&submitter=${escapeHtml(userId)}&min_score=0&max_score=100&language=&status=">转到提交记录</a>
            <a href="/user_plans/${escapeHtml(userId)}">转到计划</a>
        `;
        menu.style.left = `${event.clientX + 8}px`;
        menu.style.top = `${event.clientY + 8}px`;
        menu.classList.add('is-open');
    };

    if (root.body.dataset.bnUserMenuBound !== '1') {
        root.body.dataset.bnUserMenuBound = '1';

        root.addEventListener('click', () => closeMenu(), true);
        root.addEventListener('scroll', () => closeMenu(), true);
        root.addEventListener('contextmenu', (event) => {
            if (!settings.enableUserMenu) {
                closeMenu();
                return;
            }

            const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href*="/user/"], a[href*="user_id="], a[href*="uid="]');
            if (!anchor) {
                closeMenu();
                return;
            }

            const userId = resolveUserId(anchor);
            if (!userId) {
                closeMenu();
                return;
            }

            event.preventDefault();
            openMenu(event, userId);
        }, true);

        menu.addEventListener('click', (event) => {
            const target = event.target as HTMLAnchorElement | null;
            if (target?.tagName === 'A' && activeUserId) {
                closeMenu();
            }
        });
    }

    if (!settings.enableUserMenu) {
        closeMenu();
    }
}

export async function mountIdentityEnhancements(root: Document, storage: StorageAdapter) {
    let settings = await loadPanelSettings(storage);
    let users = normalizeUserMapping(await storage.get<unknown>('userMapping'));
    let isApplyingNicknames = false;

    const style = ensureStyleTag(root);

    const render = () => {
        style.textContent = createIdentityStyles(settings);
        isApplyingNicknames = true;
        applyNicknameBadges(root, settings, users);
        isApplyingNicknames = false;
        updateUserMenu(root, settings);
    };

    render();

    const observer = new MutationObserver(() => {
        if (isApplyingNicknames) {
            return;
        }

        isApplyingNicknames = true;
        applyNicknameBadges(root, settings, users);
        isApplyingNicknames = false;
    });

    observer.observe(root.body, {
        childList: true,
        subtree: true
    });

    watchPanelSettings((nextSettings) => {
        settings = nextSettings;
        render();
    });

    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !Object.prototype.hasOwnProperty.call(changes, 'userMapping')) {
                return;
            }

            users = normalizeUserMapping(changes.userMapping?.newValue);
            isApplyingNicknames = true;
            applyNicknameBadges(root, settings, users);
            isApplyingNicknames = false;
        });
    }
}
