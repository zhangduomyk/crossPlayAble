/** 单个单词步骤配置。 */
export interface WordStepConfig {
    /** 玩家需要拼出的目标单词。 */
    readonly word: string;
    /** 字盘从十二点方向开始逆时针排列的字母。 */
    readonly wheelLetters: string;
    /** 正确完成后展示的鼓励词。 */
    readonly praise: string;
}

/** 试玩品牌配置。 */
export interface PlayableBrandConfig {
    /** 游戏显示名称。 */
    readonly gameName: string;
    /** 品牌图标在 resources 中的加载路径。 */
    readonly iconResource: string;
}

/** 试玩商店地址配置。 */
export interface PlayableStoreConfig {
    /** Google Play 地址；正式导出前替换占位包名。 */
    readonly googlePlayUrl: string;
    /** App Store 地址；正式导出前替换占位应用编号。 */
    readonly appStoreUrl: string;
}

/** 完整试玩配置。 */
export interface PlayableConfig {
    /** 品牌相关配置。 */
    readonly brand: PlayableBrandConfig;
    /** 商店跳转配置。 */
    readonly store: PlayableStoreConfig;
    /** 启动时显示的互动提示文案。 */
    readonly introPrompt: string;
    /** 结束页主按钮文案。 */
    readonly endCardButtonText: string;
    /** 下载按钮文案。 */
    readonly downloadButtonText: string;
    /** 开局未操作时显示首次引导的延迟秒数。 */
    readonly initialGuideDelaySeconds: number;
    /** 游戏中停顿后再次显示引导的延迟秒数。 */
    readonly idleGuideDelaySeconds: number;
    /** 完成该步骤后立即触发商店跳转；负数表示仅由下载入口触发。 */
    readonly storeRedirectStepIndex: number;
    /** 开局已经填入棋盘的单词。 */
    readonly completedWords: readonly string[];
    /** 拼出后按重复词处理的收藏夹词库。 */
    readonly bonusWords: readonly string[];
    /** 依次执行的单词步骤。 */
    readonly wordSteps: readonly WordStepConfig[];
}

/** 全项目唯一的试玩配置，品牌和商店占位值应在正式投放前替换。 */
export const PLAYABLE_CONFIG: PlayableConfig = {
    brand: {
        gameName: "Crossword Quest",
        iconResource: "playable/brand/game-icon",
    },
    store: {
        googlePlayUrl: "https://play.google.com/store/apps/details?id=com.gsr.wordcross",
        appStoreUrl: "https://apps.apple.com/app/crossword-quest-word-puzzles/id1579681838",
    },
    introPrompt: "Swipe to form words!",
    endCardButtonText: "Play Now",
    downloadButtonText: "Install",
    initialGuideDelaySeconds: 1,
    idleGuideDelaySeconds: 2,
    storeRedirectStepIndex: -1,
    completedWords: [],
    bonusWords: [
        "PANEL", "PENAL", "PLENA",
        "PLAN", "LEAP", "PALE", "PANE", "PLEA", "PEAL", "NAPE", "NEAP", "PEAN", "ELAN",
        "PAN", "PEN", "PEA", "PAL", "APE", "NAP", "ALP", "ANE", "NAE",
    ],
    wordSteps: [
        { word: "LAP", wheelLetters: "PLANE", praise: "Nice" },
        { word: "ALE", wheelLetters: "PLANE", praise: "Brilliant" },
        { word: "LEA", wheelLetters: "PLANE", praise: "Brilliant" },
        { word: "LANE", wheelLetters: "PLANE", praise: "Brilliant" },
        { word: "LEAN", wheelLetters: "PLANE", praise: "Brilliant" },
        { word: "PLANE", wheelLetters: "PLANE", praise: "Spectacular" },
    ],
};
