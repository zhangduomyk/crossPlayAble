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
    /** 达到该错误次数时进入最终页。 */
    readonly maxErrorCount: number;
    /** 开局直接填好的示例单词。 */
    readonly completedWord: string;
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
    introPrompt: "How old is your brain?",
    endCardButtonText: "Play Now",
    downloadButtonText: "Install",
    maxErrorCount: 5,
    completedWord: "RAIN",
    wordSteps: [
        { word: "FOREST", wheelLetters: "FOREST", praise: "Good" },
        { word: "FIND", wheelLetters: "FINDZA", praise: "Great" },
        { word: "THANK", wheelLetters: "THANKR", praise: "Fantastic" },
        { word: "DANGER", wheelLetters: "DANGER", praise: "Wonderful" },
        { word: "LARGEST", wheelLetters: "LARGEST", praise: "Good" },
    ],
};
