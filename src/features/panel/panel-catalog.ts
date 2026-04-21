export type PanelCorner = 'br' | 'bl' | 'tr' | 'tl';
export type ThemeMode = 'light' | 'dark' | 'system';
export type BackgroundFillMode = 'cover' | 'contain' | 'stretch' | 'tile' | 'center';
export type PanelCategoryId =
    | 'overview'
    | 'appearance'
    | 'content'
    | 'ranking'
    | 'plans'
    | 'profile'
    | 'advanced';

export interface PanelSettings {
    themeMode: ThemeMode;
    themeColor: string;
    useCustomColors: boolean;
    corner: PanelCorner;
    backgroundEnabled: boolean;
    backgroundImageUrl: string;
    backgroundFillMode: BackgroundFillMode;
    backgroundOpacity: number;
    backgroundBlur: number;
    titleLimit: number;
    userLimit: number;
    showNickname: boolean;
    hideAvatar: boolean;
    enableUserMenu: boolean;
    enableCopy: boolean;
    enableDescCopy: boolean;
    hideOriginal: boolean;
    enableVjudgeLink: boolean;
    enableContestDownload: boolean;
    enableContestReview: boolean;
    enableTitleOptimization: boolean;
    enableRankingFilter: boolean;
    enableColumnSwitch: boolean;
    enableRankingMerge: boolean;
    enablePlanAdder: boolean;
    enableTemplateBulkAdd: boolean;
    enableQuickSkip: boolean;
    hideDoneSkip: boolean;
    enableAutoRenew: boolean;
    enableGuard: boolean;
    debug: boolean;
    hiToiletEnabled: boolean;
    hiToiletInterval: number;
}

export type PanelSettingKey = keyof PanelSettings;

export interface PanelCategory {
    id: PanelCategoryId;
    label: string;
    description: string;
}

interface PanelOptionBase {
    key: PanelSettingKey;
    category: Exclude<PanelCategoryId, 'overview'>;
    label: string;
    description: string;
    featured?: boolean;
}

export interface ToggleOption extends PanelOptionBase {
    kind: 'toggle';
}

export interface SelectOption extends PanelOptionBase {
    kind: 'select';
    options: Array<{ value: string; label: string }>;
}

export interface NumberOption extends PanelOptionBase {
    kind: 'number';
    min: number;
    max: number;
    step: number;
    suffix?: string;
    hint?: string;
}

export interface TextOption extends PanelOptionBase {
    kind: 'text';
    placeholder: string;
}

export interface ColorOption extends PanelOptionBase {
    kind: 'color';
}

export type PanelOption = ToggleOption | SelectOption | NumberOption | TextOption | ColorOption;

export const PANEL_SETTINGS_STORAGE_KEY = 'panel.settings.v1';

export const PANEL_DEFAULT_SETTINGS: PanelSettings = {
    themeMode: 'system',
    themeColor: '#0f766e',
    useCustomColors: false,
    corner: 'br',
    backgroundEnabled: false,
    backgroundImageUrl: '',
    backgroundFillMode: 'stretch',
    backgroundOpacity: 0.12,
    backgroundBlur: 0,
    titleLimit: 10,
    userLimit: 0,
    showNickname: true,
    hideAvatar: true,
    enableUserMenu: true,
    enableCopy: true,
    enableDescCopy: false,
    hideOriginal: true,
    enableVjudgeLink: true,
    enableContestDownload: true,
    enableContestReview: true,
    enableTitleOptimization: true,
    enableRankingFilter: true,
    enableColumnSwitch: true,
    enableRankingMerge: true,
    enablePlanAdder: true,
    enableTemplateBulkAdd: true,
    enableQuickSkip: true,
    hideDoneSkip: false,
    enableAutoRenew: false,
    enableGuard: false,
    debug: false,
    hiToiletEnabled: false,
    hiToiletInterval: 2000
};

export const PANEL_CATEGORIES: PanelCategory[] = [
    {
        id: 'overview',
        label: '总览',
        description: '高频入口与推荐设置'
    },
    {
        id: 'appearance',
        label: '外观',
        description: '主题、背景、布局与截断'
    },
    {
        id: 'content',
        label: '内容',
        description: '题面、按钮与页面增强'
    },
    {
        id: 'ranking',
        label: '排行',
        description: '榜单筛选与合并能力'
    },
    {
        id: 'plans',
        label: '计划',
        description: '计划页与批量操作能力'
    },
    {
        id: 'profile',
        label: '身份',
        description: '昵称、头像与用户交互'
    },
    {
        id: 'advanced',
        label: '高级',
        description: '实验项、调试与保守选项'
    }
];

export const PANEL_OPTIONS: PanelOption[] = [
    {
        key: 'themeMode',
        category: 'appearance',
        kind: 'select',
        label: '主题模式',
        description: '面板可跟随系统，也可强制浅色或深色。',
        featured: true,
        options: [
            { value: 'system', label: '跟随系统' },
            { value: 'light', label: '浅色' },
            { value: 'dark', label: '深色' }
        ]
    },
    {
        key: 'themeColor',
        category: 'appearance',
        kind: 'color',
        label: '主题色',
        description: '控制强调色、开关高亮与重点按钮。'
    },
    {
        key: 'useCustomColors',
        category: 'appearance',
        kind: 'toggle',
        label: '启用自定义颜色',
        description: '为后续用户标签与个性化色板预留开关。'
    },
    {
        key: 'corner',
        category: 'appearance',
        kind: 'select',
        label: '悬浮角落',
        description: '决定触发器和面板停靠在哪个角落。',
        featured: true,
        options: [
            { value: 'br', label: '右下' },
            { value: 'bl', label: '左下' },
            { value: 'tr', label: '右上' },
            { value: 'tl', label: '左上' }
        ]
    },
    {
        key: 'backgroundEnabled',
        category: 'appearance',
        kind: 'toggle',
        label: '背景图片',
        description: '启用面板背景图层与视觉氛围。'
    },
    {
        key: 'backgroundImageUrl',
        category: 'appearance',
        kind: 'text',
        label: '背景图片 URL',
        description: '使用远程图片作为背景源。',
        placeholder: 'https://example.com/background.jpg'
    },
    {
        key: 'backgroundFillMode',
        category: 'appearance',
        kind: 'select',
        label: '背景填充方式',
        description: '控制背景图的显示策略。',
        options: [
            { value: 'cover', label: '填充' },
            { value: 'contain', label: '适应' },
            { value: 'stretch', label: '拉伸' },
            { value: 'tile', label: '平铺' },
            { value: 'center', label: '居中' }
        ]
    },
    {
        key: 'backgroundOpacity',
        category: 'appearance',
        kind: 'number',
        label: '背景透明度',
        description: '建议保持低值，避免干扰正文。',
        min: 0.01,
        max: 1,
        step: 0.01
    },
    {
        key: 'backgroundBlur',
        category: 'appearance',
        kind: 'number',
        label: '背景模糊度',
        description: '提升可读性，降低复杂背景的视觉噪声。',
        min: 0,
        max: 50,
        step: 0.5,
        suffix: 'px'
    },
    {
        key: 'titleLimit',
        category: 'appearance',
        kind: 'number',
        label: '题目名截断长度',
        description: '设为 0 表示不截断。',
        min: 0,
        max: 100,
        step: 1,
        hint: '0 = 不限'
    },
    {
        key: 'userLimit',
        category: 'appearance',
        kind: 'number',
        label: '用户名截断长度',
        description: '设为 0 表示不截断。',
        min: 0,
        max: 100,
        step: 1,
        hint: '0 = 不限'
    },
    {
        key: 'enableCopy',
        category: 'content',
        kind: 'toggle',
        label: '题面快捷复制',
        description: '直接复制整题 Markdown 内容。',
        featured: true
    },
    {
        key: 'enableDescCopy',
        category: 'content',
        kind: 'toggle',
        label: '题面描述快捷复制',
        description: '只复制题目描述段，而不是整题全文。'
    },
    {
        key: 'hideOriginal',
        category: 'content',
        kind: 'toggle',
        label: '隐藏源码按钮',
        description: '弱化原页面里不常用的源码入口。'
    },
    {
        key: 'enableVjudgeLink',
        category: 'content',
        kind: 'toggle',
        label: 'Vjudge 跳转按钮',
        description: '在支持的题目页追加 Vjudge 快捷入口。'
    },
    {
        key: 'enableContestDownload',
        category: 'content',
        kind: 'toggle',
        label: '比赛附件下载按钮',
        description: '在已结束比赛页追加下载文件与下载全部。'
    },
    {
        key: 'enableContestReview',
        category: 'content',
        kind: 'toggle',
        label: '比赛复盘按钮',
        description: '在已结束比赛页追加写复盘表和查看复盘表。'
    },
    {
        key: 'enableTitleOptimization',
        category: 'content',
        kind: 'toggle',
        label: '页面标题优化',
        description: '让计划页和题单页标题更接近真实语义。',
        featured: true
    },
    {
        key: 'enableRankingFilter',
        category: 'ranking',
        kind: 'toggle',
        label: '榜单筛选',
        description: '按学校、年级等维度筛选排行结果。',
        featured: true
    },
    {
        key: 'enableColumnSwitch',
        category: 'ranking',
        kind: 'toggle',
        label: '列切换增强',
        description: '优化榜单列切换入口和使用流。'
    },
    {
        key: 'enableRankingMerge',
        category: 'ranking',
        kind: 'toggle',
        label: '榜单合并助手',
        description: '为榜单聚合和附加统计预留合并能力。'
    },
    {
        key: 'enablePlanAdder',
        category: 'plans',
        kind: 'toggle',
        label: '计划添加器',
        description: '在题表上快速批量加入个人计划。',
        featured: true
    },
    {
        key: 'enableTemplateBulkAdd',
        category: 'plans',
        kind: 'toggle',
        label: '一键添加所有模板',
        description: '在模板题页面追加批量加入入口。'
    },
    {
        key: 'enableQuickSkip',
        category: 'plans',
        kind: 'toggle',
        label: '快捷跳过',
        description: '在计划和题表中为可跳过题目追加快捷按钮。',
        featured: true
    },
    {
        key: 'hideDoneSkip',
        category: 'plans',
        kind: 'toggle',
        label: '隐藏已通过与已跳过',
        description: '压缩噪音，让待做题目更聚焦。'
    },
    {
        key: 'enableAutoRenew',
        category: 'plans',
        kind: 'toggle',
        label: '题目自动更新',
        description: '对计划中的可续期题目执行自动续期逻辑。'
    },
    {
        key: 'showNickname',
        category: 'profile',
        kind: 'toggle',
        label: '显示用户昵称',
        description: '将站内用户名和 Better Names 昵称一起展示。',
        featured: true
    },
    {
        key: 'hideAvatar',
        category: 'profile',
        kind: 'toggle',
        label: '隐藏头像',
        description: '前端隐藏并在后台启用头像资源拦截。',
        featured: true
    },
    {
        key: 'enableUserMenu',
        category: 'profile',
        kind: 'toggle',
        label: '用户右键菜单',
        description: '在用户名链接上追加主页、提交、计划等跳转。'
    },
    {
        key: 'enableGuard',
        category: 'advanced',
        kind: 'toggle',
        label: '守卫模式',
        description: '保留的实验开关，建议仅在明确需要时启用。'
    },
    {
        key: 'debug',
        category: 'advanced',
        kind: 'toggle',
        label: '调试日志',
        description: '在控制台输出更完整的运行日志。'
    },
    {
        key: 'hiToiletEnabled',
        category: 'advanced',
        kind: 'toggle',
        label: '定时提醒',
        description: '旧配置中保留的定时能力，先收进高级分组。'
    },
    {
        key: 'hiToiletInterval',
        category: 'advanced',
        kind: 'number',
        label: '提醒间隔',
        description: '与定时提醒联动，单位为毫秒。',
        min: 10,
        max: 2000,
        step: 10,
        suffix: 'ms'
    }
];
