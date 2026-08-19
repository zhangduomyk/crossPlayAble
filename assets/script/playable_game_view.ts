import {
    _decorator,
    AudioClip,
    AudioSource,
    BitmapFont,
    Color,
    Component,
    EventTouch,
    Font,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Layers,
    Node,
    ResolutionPolicy,
    Size,
    Sprite,
    SpriteFrame,
    Tween,
    UITransform,
    UIOpacity,
    Vec3,
    VerticalTextAlignment,
    instantiate,
    resources,
    tween,
    view,
} from "cc";
import { PLAYABLE_CONFIG, WordStepConfig } from "./config/playable_config";
import { LetterWheelView } from "./view/letter_wheel_view";
import { WheelLetterView } from "./view/wheel_letter_view";
import { WordRowView } from "./view/word_row_view";
import { WordSlotView } from "./view/word_slot_view";
import {
    initializePlayablePlatform,
    notifyPlayableGameEnd,
    requestPlayableDownload,
    shouldHidePlayableDownload,
} from "./playable_bootstrap";

/** Cocos 装饰器工具。 */
const { ccclass, property } = _decorator;

/** UI 默认使用的二维渲染层。 */
const UI_LAYER: number = Layers.Enum.UI_2D;

/** 森林背景资源尚未加载时使用的后备颜色。 */
const BACKGROUND_COLOR: Color = new Color(88, 105, 87, 255);

/** 普通未填写字格颜色，PSD 图片加载前用于临时显示。 */
const SLOT_COLOR: Color = new Color(255, 255, 255, 255);

/** 当前步骤未填写字格颜色，PSD 图片加载前用于临时显示。 */
const ACTIVE_SLOT_COLOR: Color = new Color(255, 255, 255, 255);

/** 已填写字格颜色，PSD 图片加载前用于临时显示。 */
const FILLED_SLOT_COLOR: Color = new Color(83, 145, 61, 255);

/** 字母连线、选中圆和组合横条使用的新 PSD 深绿色。 */
const SELECTION_COLOR: Color = new Color(44, 62, 0, 255);

/** 错误单词触发的红色边缘闪光。 */
const WRONG_FLASH_COLOR: Color = new Color(255, 80, 80, 230);

/** 重复词或收藏词触发的黄色边缘闪光。 */
const REPEAT_FLASH_COLOR: Color = new Color(255, 215, 55, 230);

/** 玩家连线和引导演示统一使用的加粗线宽。 */
const TRACE_LINE_WIDTH: number = 20;

/** 新 PSD 横向烟雾的优化后纹理宽度。 */
const FOG_TEXTURE_WIDTH: number = 2820;

/** 新 PSD 横向烟雾按原比例缩放后的纹理高度。 */
const FOG_TEXTURE_HEIGHT: number = 735;

/** 单个字谜单元格的二维网格坐标。 */
interface CrosswordCellCoordinate {
    /** 从左向右递增的列坐标。 */
    readonly column: number;
    /** 从上向下递增的行坐标。 */
    readonly row: number;
}

/** 单词在字谜棋盘中的逐字坐标。 */
interface CrosswordWordLayout {
    /** 当前布局对应的单词。 */
    readonly word: string;
    /** 单词每个字符对应的棋盘坐标。 */
    readonly cells: readonly CrosswordCellCoordinate[];
}

/** 鼓励横幅对应的 PSD 资源与显示尺寸。 */
interface PraiseVisualConfig {
    /** resources 中的 SpriteFrame 路径。 */
    readonly resourcePath: string;
    /** 横幅显示宽度。 */
    readonly width: number;
    /** 横幅显示高度。 */
    readonly height: number;
}

/** 三类填词进度对应的新 PSD 鼓励横幅。 */
const PRAISE_VISUALS: Readonly<Record<string, PraiseVisualConfig>> = {
    Nice: { resourcePath: "playable/psd/praise-nice/spriteFrame", width: 180, height: 58 },
    Brilliant: { resourcePath: "playable/psd/praise-brilliant/spriteFrame", width: 260, height: 52 },
    Spectacular: { resourcePath: "playable/psd/praise-spectacular/spriteFrame", width: 330, height: 51 },
};

/** 与 2026-08-13 需求稿一致的六个单词字谜布局。 */
const CROSSWORD_LAYOUT: readonly CrosswordWordLayout[] = [
    { word: "EAR", cells: [{ column: 4, row: 7 }, { column: 5, row: 7 }, { column: 6, row: 7 }] },
    { word: "EAST", cells: [{ column: 0, row: 2 }, { column: 1, row: 2 }, { column: 2, row: 2 }, { column: 3, row: 2 }] },
    { word: "SEAT", cells: [{ column: 1, row: 6 }, { column: 2, row: 6 }, { column: 3, row: 6 }, { column: 4, row: 6 }] },
    { word: "RATE", cells: [{ column: 4, row: 4 }, { column: 4, row: 5 }, { column: 4, row: 6 }, { column: 4, row: 7 }] },
    { word: "TEARS", cells: [{ column: 1, row: 0 }, { column: 1, row: 1 }, { column: 1, row: 2 }, { column: 1, row: 3 }, { column: 1, row: 4 }] },
    { word: "STARE", cells: [{ column: 1, row: 4 }, { column: 2, row: 4 }, { column: 3, row: 4 }, { column: 4, row: 4 }, { column: 5, row: 4 }] },
];

/** 游戏初始界面组件，负责创建素材节点并处理横竖屏布局。 */
@ccclass("PlayableGameView")
export class PlayableGameView extends Component {
    /** 响应式内容根节点。 */
    @property(Node)
    private layoutRoot: Node | null = null;

    /** 黑色背景绘图组件。 */
    @property(Graphics)
    private backgroundGraphics: Graphics | null = null;

    /** 开场提示节点。 */
    @property(Node)
    private promptNode: Node | null = null;

    /** 品牌标题节点。 */
    @property(Node)
    private brandNode: Node | null = null;

    /** 下载入口节点。 */
    @property(Node)
    private downloadNode: Node | null = null;

    /** 左侧单词面板节点。 */
    @property(Node)
    private boardNode: Node | null = null;

    /** 右侧字盘节点。 */
    @property(Node)
    private wheelNode: Node | null = null;

    /** 最终品牌结束页根节点。 */
    @property(Node)
    private endCardNode: Node | null = null;

    /** 结束页品牌图标节点。 */
    @property(Node)
    private endCardIconNode: Node | null = null;

    /** 结束页 Play Now 按钮节点。 */
    @property(Node)
    private playNowNode: Node | null = null;

    /** 当前创建的字盘字母标签。 */
    private readonly wheelLetterLabels: Label[] = [];

    /** 当前创建的字盘字母 Prefab 根节点。 */
    private readonly wheelLetterNodes: Node[] = [];

    /** 当前创建的字盘字母选中圆节点。 */
    private readonly wheelLetterHighlights: Node[] = [];

    /** 所有单词行节点，索引零为已完成示例词。 */
    private readonly wordRowNodes: Node[] = [];

    /** 各单词行中的字母标签。 */
    private readonly wordSlotLabels: Label[][] = [];

    /** 各单词行中的字格背景精灵组件。 */
    private readonly wordSlotBackgrounds: Sprite[][] = [];

    /** 各待填单词行的发光框节点。 */
    private readonly wordGlowNodes: Node[] = [];

    /** 运行时创建的唯一字谜单元格，键格式为“列,行”。 */
    private readonly crosswordCells: Map<string, WordSlotView> = new Map();

    /** 唯一字谜单元格对应的网格坐标。 */
    private readonly crosswordCoordinates: Map<string, CrosswordCellCoordinate> = new Map();

    /** 每个棋盘单词的落点中心。 */
    private readonly wordTargetPositions: Vec3[] = [];

    /** 森林背景精灵节点。 */
    private backgroundSpriteNode: Node | null = null;

    /** 两张循环平移的雾层节点。 */
    private readonly fogNodes: Node[] = [];

    /** 当前雾层横向循环偏移。 */
    private fogOffset: number = 0;

    /** 当前雾层单张循环跨度。 */
    private fogSpan: number = 1200;

    /** 当前雾层按屏幕底边对齐后的纵坐标。 */
    private fogBottomY: number = 0;

    /** 左上角倒计时根节点。 */
    private clockNode: Node | null = null;

    /** 左上角倒计时数字标签。 */
    private clockLabel: Label | null = null;

    /** 红黄边缘闪光节点。 */
    private feedbackFlashNode: Node | null = null;

    /** 红黄反馈使用的上、下、左、右四条 PSD 光带。 */
    private readonly feedbackEdgeSprites: Sprite[] = [];

    /** PSD 原稿中的红色反馈光带。 */
    private redFeedbackSpriteFrame: SpriteFrame | null = null;

    /** PSD 原稿中的黄色反馈光带。 */
    private yellowFeedbackSpriteFrame: SpriteFrame | null = null;

    /** PSD 原稿中的空白字格图片。 */
    private emptySlotSpriteFrame: SpriteFrame | null = null;

    /** PSD 原稿中的绿色已填字格图片。 */
    private filledSlotSpriteFrame: SpriteFrame | null = null;

    /** 背景音乐播放器。 */
    private backgroundAudioSource: AudioSource | null = null;

    /** 短音效播放器。 */
    private effectAudioSource: AudioSource | null = null;

    /** 已加载的背景音乐。 */
    private backgroundMusicClip: AudioClip | null = null;

    /** 已加载的点击音效。 */
    private tapAudioClip: AudioClip | null = null;

    /** 已加载的正确填词音效。 */
    private correctAudioClip: AudioClip | null = null;

    /** 已加载的错误填词音效。 */
    private wrongAudioClip: AudioClip | null = null;

    /** 已加载的重复填词音效。 */
    private repeatAudioClip: AudioClip | null = null;

    /** 玩家是否已经触发首次有效交互。 */
    private hasStartedByInteraction: boolean = false;

    /** 当前倒计时剩余秒数。 */
    private remainingSeconds: number = PLAYABLE_CONFIG.countdownSeconds;

    /** 右下角由 PSD 原图组成的完整安装按钮节点。 */
    private installPanelImageNode: Node | null = null;

    /** 结算页顶部的 CROSSWORD QUEST 品牌图节点。 */
    private endCardLogoNode: Node | null = null;

    /** 结算页中由新 PSD 导出的宣传语节点。 */
    private endCardTaglineNode: Node | null = null;

    /** 倒计时最后五秒的抖动动画是否已经启动。 */
    private hasStartedClockWarning: boolean = false;

    /** 已经正确填入或初始填入的单词集合。 */
    private readonly completedWords: Set<string> = new Set(PLAYABLE_CONFIG.completedWords);

    /** 字盘连线绘图组件。 */
    @property(Graphics)
    private traceGraphics: Graphics | null = null;

    /** 当前手势末端在字盘中的局部坐标。 */
    private tracePointer: Vec3 = new Vec3();

    /** 当前连线选中的字母索引。 */
    private readonly selectedLetterIndices: number[] = [];

    /** 字盘上方显示的当前字母组合。 */
    @property(Label)
    private selectedWordLabel: Label | null = null;

    /** 字盘上方的深绿色组合横条节点。 */
    @property(Node)
    private selectionBannerNode: Node | null = null;

    /** 字盘上方深绿色组合横条的背景绘图组件。 */
    @property(Graphics)
    private selectionBannerGraphics: Graphics | null = null;

    /** PSD 引导手节点。 */
    @property(Node)
    private guideHandNode: Node | null = null;

    /** 当前引导手需要遍历的目标单词。 */
    private currentGuideTargetWord: string = "";

    /** 引导手是否正在模拟真实连线。 */
    private isGuidePreviewAnimating: boolean = false;

    /** 当前引导路径经过的字母中心位置。 */
    private readonly guideLetterCenterPositions: Vec3[] = [];

    /** 当前引导路径经过的字盘字母索引。 */
    private readonly guideLetterIndices: number[] = [];

    /** 当前引导手正在移动到的路径位置索引。 */
    private guideTraceTargetIndex: number = 0;

    /** 引导手节点中心相对指尖热点的位置补偿。 */
    private readonly guideHandCenterOffset: Vec3 = new Vec3();

    /** PSD 下载箭头节点。 */
    @property(Node)
    private downloadIconNode: Node | null = null;

    /** 固定在页面右下角的品牌图标和 Install 面板。 */
    @property(Node)
    private installPanelNode: Node | null = null;

    /** 编辑器中拖拽绑定的单词行组件。 */
    @property([WordRowView])
    private wordRowViews: WordRowView[] = [];

    /** 编辑器中拖拽绑定的字盘组件。 */
    @property(LetterWheelView)
    private letterWheelView: LetterWheelView | null = null;

    /** 当前正在执行的单词步骤索引。 */
    private currentStepIndex: number = 0;

    /** 当前累计错误次数，阶段四将据此进入结束页。 */
    private errorCount: number = 0;

    /** 当前是否正在连线选择字母。 */
    private isTracing: boolean = false;

    /** 正确反馈期间是否锁定输入。 */
    private isInputLocked: boolean = false;

    /** 正确填词落位动画代次，用于忽略超时或结算后的旧回调。 */
    private correctSettlementGeneration: number = 0;

    /** 是否已经显示最终品牌结束页。 */
    private isEndCardVisible: boolean = false;

    /** 组件加载时初始化平台桥接并创建基础界面。 */
    protected onLoad(): void {
        initializePlayablePlatform();
        this.bindEditorInterface();
        this.createRuntimeVisuals();
        this.setupAudio();
        this.applySuppliedFont();
        this.applyResponsiveLayout();
        this.bindGameplayInput();
        this.startInitialAnimations();
        view.on("canvas-resize", this.applyResponsiveLayout, this);
    }

    /** 组件销毁时移除屏幕变化监听。 */
    protected onDestroy(): void {
        this.correctSettlementGeneration += 1;
        view.off("canvas-resize", this.applyResponsiveLayout, this);
        this.unschedule(this.handleGuideIdleTimeout);
        this.unschedule(this.handleCountdownTick);
        this.backgroundAudioSource?.stop();
        this.unbindGameplayInput();
    }

    /** 每帧推动双雾层平移，保持横竖屏都能无缝循环。 */
    protected update(deltaTime: number): void {
        if (this.isEndCardVisible) {
            return;
        }

        if (this.fogNodes.length >= 2) {
            /** 当前帧按每秒十八逻辑像素计算的雾层位移。 */
            const fogMovement: number = 18 * deltaTime;
            this.fogOffset -= fogMovement;
            if (this.fogOffset <= -this.fogSpan) {
                this.fogOffset += this.fogSpan;
            }
            this.fogNodes[0].setPosition(this.fogOffset, this.fogBottomY, 0);
            this.fogNodes[1].setPosition(this.fogOffset + this.fogSpan, this.fogBottomY, 0);
        }
        if (this.isGuidePreviewAnimating) {
            this.redrawGuideTraceProgress();
        }
    }

    /** 从 Inspector 拖拽引用初始化玩法缓存，不再在运行时创建基础 UI。 */
    private bindEditorInterface(): void {
        if (
            !this.layoutRoot
            || !this.backgroundGraphics
            || !this.boardNode
            || !this.wheelNode
            || !this.letterWheelView
            || this.wordRowViews.length === 0
        ) {
            console.error("[Playable] 编辑器可视化节点引用不完整，请检查 Canvas 上的 PlayableGameView。");
            return;
        }

        this.wordRowNodes.length = 0;
        this.wordSlotLabels.length = 0;
        this.wordSlotBackgrounds.length = 0;
        this.wordGlowNodes.length = 0;
        this.createCrosswordBoard();

        this.traceGraphics = this.letterWheelView.traceGraphics;
        this.guideHandNode = this.letterWheelView.guideHandNode;
        this.wheelLetterLabels.length = 0;
        this.wheelLetterNodes.length = 0;
        this.wheelLetterHighlights.length = 0;
        this.letterWheelView.getLetterViews().forEach((letterView: WheelLetterView): void => {
            this.wheelLetterNodes.push(letterView.node);
            if (letterView.letterLabel) {
                this.wheelLetterLabels.push(letterView.letterLabel);
            }
            if (letterView.highlightNode) {
                this.wheelLetterHighlights.push(letterView.highlightNode);
            }
        });
        /** 第一关的字盘配置。 */
        const firstStep: WordStepConfig = PLAYABLE_CONFIG.wordSteps[0];
        this.createWheelLetters(this.wheelNode, firstStep.wheelLetters, firstStep.word);
        if (this.guideHandNode) {
            this.guideHandNode.active = false;
        }
        this.traceGraphics?.clear();
        this.endCardNode && (this.endCardNode.active = false);
        this.selectionBannerNode && (this.selectionBannerNode.active = false);
        /** 旧版蓝色组合词背景，需求仅保留根节点绘制的深绿色圆角背景。 */
        const legacySelectionBackground: Node | null = this.selectionBannerNode
            ?.getChildByName("SelectionBackground") ?? null;
        if (legacySelectionBackground) {
            legacySelectionBackground.active = false;
        }
        this.promptNode && (this.promptNode.active = false);
        /** 独立下载图标继续显示并保留原有呼吸动画。 */
        this.downloadNode && (this.downloadNode.active = !shouldHidePlayableDownload());
        this.installPanelNode && (this.installPanelNode.active = !shouldHidePlayableDownload());
    }

    /** 使用现有字格 Prefab 实例构建需求稿中的交叉字谜棋盘。 */
    private createCrosswordBoard(): void {
        if (!this.boardNode) {
            return;
        }

        /** 可供克隆的编辑器字格模板。 */
        const slotTemplate: Node | undefined = this.wordRowViews[0]
            ?.getSlotViews()[0]
            ?.node;
        if (!slotTemplate) {
            console.error("[Playable] 未找到字格模板，无法创建交叉字谜棋盘。");
            return;
        }

        this.crosswordCells.clear();
        this.crosswordCoordinates.clear();
        this.wordTargetPositions.length = 0;
        this.wordRowViews.forEach((rowView: WordRowView): void => {
            rowView.node.active = false;
        });

        /** 承载全部唯一字格的运行时棋盘根节点。 */
        const crosswordRoot: Node = this.createUiNode("CrosswordGrid", this.boardNode, 520, 600);
        /** 棋盘中按照需求顺序展示的全部单词。 */
        const words: readonly string[] = [
            ...PLAYABLE_CONFIG.completedWords,
            ...PLAYABLE_CONFIG.wordSteps.map((step: WordStepConfig): string => step.word),
        ];

        words.forEach((word: string, wordIndex: number): void => {
            /** 当前单词的固定字谜布局。 */
            const wordLayout: CrosswordWordLayout | undefined = CROSSWORD_LAYOUT.find(
                (layout: CrosswordWordLayout): boolean => layout.word === word,
            );
            if (!wordLayout) {
                console.error(`[Playable] 缺少单词布局: ${word}`);
                return;
            }

            /** 当前单词逐字对应的标签。 */
            const labels: Label[] = [];
            /** 当前单词逐字对应的背景。 */
            const backgrounds: Sprite[] = [];
            wordLayout.cells.forEach((coordinate: CrosswordCellCoordinate): void => {
                /** 由坐标生成的唯一字格键。 */
                const cellKey: string = this.getCrosswordCellKey(coordinate);
                /** 复用交叉位置已有字格，否则从 Prefab 模板克隆。 */
                let slotView: WordSlotView | undefined = this.crosswordCells.get(cellKey);
                if (!slotView) {
                    /** 新克隆的唯一字格根节点。 */
                    const slotNode: Node = instantiate(slotTemplate);
                    slotNode.name = `CrosswordCell_${coordinate.column}_${coordinate.row}`;
                    slotNode.active = true;
                    crosswordRoot.addChild(slotNode);
                    slotView = slotNode.getComponent(WordSlotView) ?? undefined;
                    if (!slotView?.background || !slotView.letterLabel) {
                        slotNode.destroy();
                        return;
                    }
                    slotView.configure(SLOT_COLOR, "");
                    slotView.letterLabel.color = new Color(29, 64, 55, 255);
                    this.crosswordCells.set(cellKey, slotView);
                    this.crosswordCoordinates.set(cellKey, coordinate);
                }
                if (slotView.background && slotView.letterLabel) {
                    labels.push(slotView.letterLabel);
                    backgrounds.push(slotView.background);
                }
            });
            this.wordSlotLabels[wordIndex] = labels;
            this.wordSlotBackgrounds[wordIndex] = backgrounds;
            this.wordTargetPositions[wordIndex] = new Vec3();
        });

        PLAYABLE_CONFIG.completedWords.forEach((word: string, completedIndex: number): void => {
            /** 初始完成单词对应的全部标签。 */
            const labels: Label[] = this.wordSlotLabels[completedIndex] ?? [];
            /** 初始完成单词对应的全部背景。 */
            const backgrounds: Sprite[] = this.wordSlotBackgrounds[completedIndex] ?? [];
            Array.from(word).forEach((letter: string, letterIndex: number): void => {
                /** 当前初始完成字格标签。 */
                const letterLabel: Label | undefined = labels[letterIndex];
                /** 当前初始完成字格背景。 */
                const slotBackground: Sprite | undefined = backgrounds[letterIndex];
                if (!letterLabel || !slotBackground) {
                    return;
                }
                letterLabel.string = letter;
                letterLabel.color = new Color(255, 255, 255, 255);
                this.setSlotColor(slotBackground, FILLED_SLOT_COLOR);
            });
        });
    }

    /** 将字谜坐标转换为唯一缓存键。 */
    private getCrosswordCellKey(coordinate: CrosswordCellCoordinate): string {
        return `${coordinate.column},${coordinate.row}`;
    }

    /** 创建森林背景、循环雾、倒计时和边缘反馈等运行时视觉节点。 */
    private createRuntimeVisuals(): void {
        if (!this.layoutRoot) {
            return;
        }

        this.backgroundGraphics && (this.backgroundGraphics.node.active = false);
        this.backgroundSpriteNode = this.createSpriteNode(
            "ForestBackground",
            this.layoutRoot,
            "playable/psd/forest-background/spriteFrame",
            1200,
            1200,
        );
        this.backgroundSpriteNode.setSiblingIndex(0);

        this.fogNodes.length = 0;
        for (let fogIndex: number = 0; fogIndex < 2; fogIndex += 1) {
            /** 单张循环雾层节点。 */
            const fogNode: Node = this.createSpriteNode(
                `MovingFog_${fogIndex + 1}`,
                this.layoutRoot,
                "playable/psd/moving-fog/spriteFrame",
                FOG_TEXTURE_WIDTH,
                FOG_TEXTURE_HEIGHT,
            );
            /** 雾层透明度组件。 */
            const fogOpacity: UIOpacity = fogNode.addComponent(UIOpacity);
            /** 新素材自身带透明度，按原始透明度完整显示。 */
            fogOpacity.opacity = 255;
            fogNode.setSiblingIndex(fogIndex + 1);
            this.fogNodes.push(fogNode);
        }

        this.createClockVisual();
        this.createFeedbackFlashVisual();
        this.loadCrosswordSlotSprites();
        this.applyLatestPsdSprites();
        this.configureStaticLabels();
        this.configureEndCardContent();
    }

    /** 隐藏旧文字标签并启用 PSD 原稿文案图片。 */
    private configureStaticLabels(): void {
        /** 不再使用的动态文案标签。 */
        const promptLabel: Label | null = this.promptNode
            ?.getChildByName("PromptLabel")
            ?.getComponent(Label) ?? null;
        if (promptLabel) {
            promptLabel.node.active = false;
        }
        /** 用于显示 PSD 原稿文案的图片节点。 */
        const promptImageNode: Node | null = this.promptNode
            ?.getChildByName("PromptBackground") ?? null;
        if (promptImageNode) {
            promptImageNode.active = true;
        }

        /** 右下角安装按钮标签。 */
        const installLabel: Label | null = this.installPanelNode
            ?.getChildByName("InstallButton")
            ?.getChildByName("InstallLabel")
            ?.getComponent(Label) ?? null;
        if (installLabel) {
            installLabel.string = PLAYABLE_CONFIG.downloadButtonText;
        }

        if (this.installPanelNode) {
            this.installPanelNode.children.forEach((childNode: Node): void => {
                childNode.active = false;
            });
            this.installPanelImageNode = this.createSpriteNode(
                "InstallPanelImage",
                this.installPanelNode,
                "playable/psd/install-panel/spriteFrame",
                240,
                84,
            );
        }
    }

    /** 使用 PSD 原稿创建左上角闹钟，并叠加动态倒计时数字。 */
    private createClockVisual(): void {
        if (!this.layoutRoot) {
            return;
        }

        this.clockNode = this.createUiNode("CountdownClock", this.layoutRoot, 92, 92);
        this.createSpriteNode(
            "CountdownClockImage",
            this.clockNode,
            "playable/psd/countdown-clock/spriteFrame",
            84,
            83,
        );

        this.clockLabel = this.createLabel(
            "CountdownLabel",
            this.clockNode,
            String(this.remainingSeconds),
            36,
            new Color(255, 255, 255, 255),
            76,
            58,
        );
        this.clockLabel.isBold = true;
        this.clockLabel.outlineWidth = 0;
        /** 闹钟原图的表盘圆心比整张图片中心低约七像素。 */
        this.clockLabel.node.setPosition(3, 4, 0);
        resources.load(
            "playable/fonts/countdown-number",
            BitmapFont,
            (fontError: Error | null, bitmapFont: BitmapFont): void => {
                if (fontError || !this.clockLabel?.node.isValid) {
                    console.warn("[Playable] 倒计时描边数字字体加载失败。", fontError);
                    return;
                }
                this.clockLabel.font = bitmapFont;
                this.clockLabel.fontSize = 42;
                this.clockLabel.lineHeight = 51;
            },
        );
    }

    /** 加载 PSD 提供的空白和已填字格图片，并刷新当前棋盘。 */
    private loadCrosswordSlotSprites(): void {
        resources.load(
            "playable/psd/crossword-cell-empty/spriteFrame",
            SpriteFrame,
            (emptyError: Error | null, emptyFrame: SpriteFrame): void => {
                if (emptyError) {
                    console.warn("[Playable] 空白字格素材加载失败。", emptyError);
                    return;
                }
                this.emptySlotSpriteFrame = emptyFrame;
                this.refreshCrosswordSlotSprites();
            },
        );
        resources.load(
            "playable/psd/crossword-cell-filled/spriteFrame",
            SpriteFrame,
            (filledError: Error | null, filledFrame: SpriteFrame): void => {
                if (filledError) {
                    console.warn("[Playable] 已填字格素材加载失败。", filledError);
                    return;
                }
                this.filledSlotSpriteFrame = filledFrame;
                this.refreshCrosswordSlotSprites();
            },
        );
    }

    /** 根据每个字格当前是否有字母，切换为对应的 PSD 原图。 */
    private refreshCrosswordSlotSprites(): void {
        this.crosswordCells.forEach((slotView: WordSlotView): void => {
            if (!slotView.background || !slotView.letterLabel) {
                return;
            }
            /** 当前字格是否已经填写字母。 */
            const isFilled: boolean = slotView.letterLabel.string.length > 0;
            /** 当前字格状态对应的 PSD 图片。 */
            const targetFrame: SpriteFrame | null = isFilled
                ? this.filledSlotSpriteFrame
                : this.emptySlotSpriteFrame;
            if (targetFrame) {
                slotView.background.spriteFrame = targetFrame;
            }
            slotView.background.color = new Color(255, 255, 255, 255);
            slotView.background.type = Sprite.Type.SIMPLE;
            slotView.background.sizeMode = Sprite.SizeMode.CUSTOM;
        });
    }

    /** 创建覆盖画面四边但默认透明的 PSD 红黄光带节点。 */
    private createFeedbackFlashVisual(): void {
        if (!this.layoutRoot) {
            return;
        }

        this.feedbackFlashNode = this.createUiNode("FeedbackFlash", this.layoutRoot, 1200, 720);
        this.feedbackEdgeSprites.length = 0;
        ["Top", "Bottom", "Left", "Right"].forEach((edgeName: string): void => {
            /** 当前画面边缘的光带节点。 */
            const edgeNode: Node = this.createUiNode(`Feedback${edgeName}`, this.feedbackFlashNode, 1200, 35);
            /** 当前画面边缘的光带精灵。 */
            const edgeSprite: Sprite = edgeNode.addComponent(Sprite);
            edgeSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            this.feedbackEdgeSprites.push(edgeSprite);
        });
        /** 边缘闪光透明度组件。 */
        const flashOpacity: UIOpacity = this.feedbackFlashNode.addComponent(UIOpacity);
        flashOpacity.opacity = 0;
        this.feedbackFlashNode.active = false;
        this.feedbackFlashNode.setSiblingIndex(this.layoutRoot.children.length - 1);
        this.loadFeedbackSpriteFrames();
    }

    /** 加载需求提供的红光和黄光原始图片。 */
    private loadFeedbackSpriteFrames(): void {
        resources.load(
            "playable/psd/feedback-red/spriteFrame",
            SpriteFrame,
            (redError: Error | null, redFrame: SpriteFrame): void => {
                if (redError) {
                    console.warn("[Playable] 红光素材加载失败。", redError);
                    return;
                }
                this.redFeedbackSpriteFrame = redFrame;
            },
        );
        resources.load(
            "playable/psd/feedback-yellow/spriteFrame",
            SpriteFrame,
            (yellowError: Error | null, yellowFrame: SpriteFrame): void => {
                if (yellowError) {
                    console.warn("[Playable] 黄光素材加载失败。", yellowError);
                    return;
                }
                this.yellowFeedbackSpriteFrame = yellowFrame;
            },
        );
    }

    /** 将最新版 PSD 中的主按钮、引导手和文案覆盖到现有编辑器节点。 */
    private applyLatestPsdSprites(): void {
        this.applySpriteResource(this.playNowNode, "playable/psd/play-now/spriteFrame");
        this.applySpriteResource(this.guideHandNode, "playable/psd/guide-hand/spriteFrame");
        /** PSD 原稿文案图片节点。 */
        const promptImageNode: Node | null = this.promptNode
            ?.getChildByName("PromptBackground") ?? null;
        this.applySpriteResource(promptImageNode, "playable/psd/swipe-to-form-words/spriteFrame");
        /** 清除旧背景节点的颜色，完整保留 PSD 文案颜色和描边。 */
        const promptSprite: Sprite | null = promptImageNode?.getComponent(Sprite) ?? null;
        if (promptSprite) {
            promptSprite.color = new Color(255, 255, 255, 255);
            promptSprite.type = Sprite.Type.SIMPLE;
            promptSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
    }

    /** 配置结束页品牌名称、PSD 宣传语并移除旧搜索框装饰。 */
    private configureEndCardContent(): void {
        if (!this.endCardNode) {
            return;
        }

        /** 需求中的结算页不显示游戏图标。 */
        if (this.endCardIconNode) {
            this.endCardIconNode.active = false;
        }

        /** 结束页旧品牌面板。 */
        const brandPanel: Node | null = this.endCardNode.getChildByName("BrandPanel");
        /** 结束页品牌名称标签。 */
        const brandLabel: Label | null = brandPanel
            ?.getChildByName("BrandLabel")
            ?.getComponent(Label) ?? null;
        if (brandLabel) {
            brandLabel.node.active = false;
        }
        brandPanel?.getComponent(UITransform)?.setContentSize(660, 120);
        brandPanel?.getChildByName("BrandGlow")?.destroy();
        brandPanel?.getChildByName("BrandBackground")?.destroy();
        brandPanel?.getChildByName("SearchIcon")?.destroy();
        if (brandPanel) {
            this.endCardLogoNode = this.createSpriteNode(
                "EndCardLogo",
                brandPanel,
                "playable/psd/endcard-logo/spriteFrame",
                563,
                155,
            );
        }

        this.endCardTaglineNode = this.createSpriteNode(
            "EndCardTagline",
            this.endCardNode,
            "playable/psd/endcard-tagline/spriteFrame",
            380,
            97,
        );
        this.endCardTaglineNode.setPosition(Vec3.ZERO);
    }

    /** 创建背景音乐与短音效播放器，并异步加载全部提供音频。 */
    private setupAudio(): void {
        if (!this.layoutRoot) {
            return;
        }

        /** 音频播放器承载节点。 */
        const audioNode: Node = new Node("PlayableAudio");
        this.layoutRoot.addChild(audioNode);
        this.backgroundAudioSource = audioNode.addComponent(AudioSource);
        this.backgroundAudioSource.loop = true;
        this.backgroundAudioSource.volume = 0.32;
        this.effectAudioSource = audioNode.addComponent(AudioSource);
        this.effectAudioSource.volume = 0.75;

        this.loadAudioClip("playable/audio/bgm", (clip: AudioClip): void => {
            this.backgroundMusicClip = clip;
            if (this.hasStartedByInteraction) {
                this.playBackgroundMusic();
            }
        });
        this.loadAudioClip("playable/audio/tap", (clip: AudioClip): void => {
            this.tapAudioClip = clip;
        });
        this.loadAudioClip("playable/audio/word", (clip: AudioClip): void => {
            this.correctAudioClip = clip;
        });
        this.loadAudioClip("playable/audio/wordinvalid", (clip: AudioClip): void => {
            this.wrongAudioClip = clip;
        });
        this.loadAudioClip("playable/audio/wordrepeat", (clip: AudioClip): void => {
            this.repeatAudioClip = clip;
        });
    }

    /** 按 resources 路径加载一个音频资源。 */
    private loadAudioClip(resourcePath: string, onLoaded: (clip: AudioClip) => void): void {
        resources.load(resourcePath, AudioClip, (error: Error | null, clip: AudioClip): void => {
            if (error) {
                console.warn(`[Playable] 音频加载失败: ${resourcePath}`, error);
                return;
            }
            onLoaded(clip);
        });
    }

    /** 为场景内需要动态生成的标签应用素材目录提供的粗体字体。 */
    private applySuppliedFont(): void {
        resources.load(
            "playable/fonts/sf-ns-bold-g1",
            Font,
            (error: Error | null, font: Font): void => {
                if (error || !this.layoutRoot) {
                    console.warn("[Playable] 字体加载失败，继续使用系统字体。", error);
                    return;
                }
                this.layoutRoot.getComponentsInChildren(Label).forEach((label: Label): void => {
                    if (label === this.clockLabel) {
                        return;
                    }
                    label.font = font;
                });
            },
        );
    }

    /** 将指定 resources 精灵资源设置到已有节点。 */
    private applySpriteResource(targetNode: Node | null, resourcePath: string): void {
        /** 目标节点上的精灵组件。 */
        const targetSprite: Sprite | null = targetNode?.getComponent(Sprite) ?? null;
        if (!targetSprite) {
            return;
        }
        resources.load(resourcePath, SpriteFrame, (error: Error | null, frame: SpriteFrame): void => {
            if (error) {
                console.warn(`[Playable] 图片加载失败: ${resourcePath}`, error);
                return;
            }
            targetSprite.spriteFrame = frame;
            targetSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        });
    }

    /** 根据当前设备方向应用横屏或竖屏布局。 */
    private applyResponsiveLayout(): void {
        if (!this.layoutRoot || !this.backgroundGraphics) {
            return;
        }

        /**
         * 设备画布尺寸，用于判断横竖方向。
         * Cocos 3.8.5 的预览器 Rotate 仅会更新该尺寸，不能改用外层浏览器窗口尺寸。
         */
        const frameSize: Size = view.getFrameSize();
        /** 当前是否为横屏布局。 */
        const isLandscape: boolean = frameSize.width >= frameSize.height;
        /** 当前布局基准宽度。 */
        const designWidth: number = isLandscape ? 1200 : 720;
        /** 当前布局基准高度。 */
        const designHeight: number = isLandscape ? 720 : 1280;

        /**
         * 横屏扩展逻辑宽度、竖屏扩展逻辑高度，保证 UI 不被裁切；
         * 背景随后按扩展后的实际可见区域单独铺满。
         */
        view.setDesignResolutionSize(
            designWidth,
            designHeight,
            isLandscape ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH,
        );

        /** 当前屏幕比例对应的完整可见逻辑区域。 */
        const visibleSize: Size = view.getVisibleSize();

        /** 设置 Canvas 尺寸，保证动态节点始终以画布中心为原点。 */
        const canvasTransform: UITransform | null = this.node.getComponent(UITransform);
        canvasTransform?.setContentSize(visibleSize.width, visibleSize.height);

        /** 更新布局根节点尺寸。 */
        const rootTransform: UITransform = this.layoutRoot.getComponent(UITransform)!;
        rootTransform.setContentSize(visibleSize.width, visibleSize.height);
        /** 更新结束页根节点尺寸。 */
        const endCardTransform: UITransform | null = this.endCardNode?.getComponent(UITransform) ?? null;
        endCardTransform?.setContentSize(visibleSize.width, visibleSize.height);
        this.layoutRoot.setPosition(Vec3.ZERO);
        this.layoutRoot.setScale(Vec3.ONE);
        this.redrawBackground(visibleSize.width, visibleSize.height);
        this.applyBackdropLayout(visibleSize.width, visibleSize.height);
        this.redrawFeedbackFlash(visibleSize.width, visibleSize.height);

        if (isLandscape) {
            this.applyLandscapePositions();
        } else {
            this.applyPortraitPositions();
        }
    }

    /** 应用横屏节点位置。 */
    private applyLandscapePositions(): void {
        this.promptNode?.setPosition(270, 245, 0);
        this.promptNode?.setScale(1, 1, 1);
        this.applyPromptImageSize(420, 42);
        this.downloadNode?.setPosition(450, -230, 0);
        this.downloadNode?.setScale(1, 1, 1);
        this.applyDownloadButtonSize(90, 82);
        this.applyInstallPanelLayout(true);
        /** 按目标试玩约 1.25 倍放大横屏字格，并同步放大格内文字。 */
        this.applyCrosswordBoardLayout(54, 5, 39);
        this.boardNode?.setPosition(-300, -5, 0);
        this.boardNode?.setScale(1, 1, 1);
        this.wheelNode?.setPosition(270, -35, 0);
        this.wheelNode?.setScale(1, 1, 1);
        this.applyWheelLetterFontSize(72);
        this.guideHandNode?.setScale(0.47, 0.47, 1);
        this.selectionBannerNode?.setPosition(270, 242, 0);
        this.selectionBannerNode?.setScale(1, 1, 1);
        this.clockNode?.setPosition(-530, 290, 0);
        this.applyLandscapeEndCardPositions();
    }

    /** 应用竖屏节点位置。 */
    private applyPortraitPositions(): void {
        /** 当前竖屏相对 720×1280 基准在上下两端增加或减少的空间。 */
        const verticalEdgeOffset: number = (view.getVisibleSize().height - 1280) / 2;
        this.promptNode?.setPosition(0, -66, 0);
        this.promptNode?.setScale(1, 1, 1);
        this.applyPromptImageSize(420, 42);
        this.downloadNode?.setPosition(270, -550 - verticalEdgeOffset, 0);
        this.downloadNode?.setScale(1, 1, 1);
        this.applyDownloadButtonSize(90, 82);
        this.applyInstallPanelLayout(false);
        /** 按截图目标将竖屏字格由约 38 像素放大到约 48 像素。 */
        this.applyCrosswordBoardLayout(70, 5, 50);
        this.boardNode?.setPosition(0, 168 + verticalEdgeOffset, 0);
        this.boardNode?.setScale(1, 1, 1);
        this.wheelNode?.setPosition(0, -358 - verticalEdgeOffset, 0);
        this.wheelNode?.setScale(0.96, 0.96, 1);
        this.applyWheelLetterFontSize(86);
        /** 抵消竖屏轮盘缩放，保持 PSD 手势图片的目标显示尺寸。 */
        const guideHandScale: number = 0.47 / 0.96;
        this.guideHandNode?.setScale(guideHandScale, guideHandScale, 1);
        this.selectionBannerNode?.setPosition(0, -66, 0);
        this.selectionBannerNode?.setScale(1, 1, 1);
        this.clockNode?.setPosition(-271, 568 + verticalEdgeOffset, 0);
        this.applyPortraitEndCardPositions();
    }

    /** 按布局方向更新 PSD 引导文案图片尺寸。 */
    private applyPromptImageSize(width: number, height: number): void {
        /** 引导文案图片节点。 */
        const promptImageNode: Node | null = this.promptNode
            ?.getChildByName("PromptBackground") ?? null;
        if (!promptImageNode) {
            return;
        }
        promptImageNode.getComponent(UITransform)?.setContentSize(width, height);
    }

    /** 更新轮盘全部字符的字号。 */
    private applyWheelLetterFontSize(fontSize: number): void {
        this.wheelLetterLabels.forEach((letterLabel: Label): void => {
            letterLabel.fontSize = fontSize;
            letterLabel.lineHeight = fontSize + 6;
        });
    }

    /** 按当前方向设置交叉字谜单元格尺寸、坐标和单词落点。 */
    private applyCrosswordBoardLayout(
        slotSize: number,
        slotGap: number,
        fontSize: number,
    ): void {
        /** 相邻字谜单元格中心之间的距离。 */
        const cellStep: number = slotSize + slotGap;
        /** 当前字谜网格的水平中心列。 */
        const centerColumn: number = 3;
        /** 当前字谜网格的垂直中心行。 */
        const centerRow: number = 3.5;

        this.crosswordCells.forEach((slotView: WordSlotView, cellKey: string): void => {
            /** 当前唯一字格的网格坐标。 */
            const coordinate: CrosswordCellCoordinate | undefined = this.crosswordCoordinates.get(cellKey);
            if (!coordinate || !slotView.letterLabel || !slotView.background) {
                return;
            }
            /** 当前字格根节点尺寸组件。 */
            const slotTransform: UITransform = slotView.node.getComponent(UITransform)!;
            /** 当前字格标签尺寸组件。 */
            const labelTransform: UITransform = slotView.letterLabel.node.getComponent(UITransform)!;
            /** 当前字格 PSD 背景尺寸组件。 */
            const backgroundTransform: UITransform = slotView.background.node.getComponent(UITransform)!;
            slotTransform.setContentSize(slotSize, slotSize);
            labelTransform.setContentSize(slotSize, slotSize);
            backgroundTransform.setContentSize(slotSize, slotSize);
            slotView.background.sizeMode = Sprite.SizeMode.CUSTOM;
            slotView.letterLabel.fontSize = fontSize;
            slotView.letterLabel.lineHeight = fontSize + 5;
            slotView.letterLabel.isBold = true;
            slotView.node.setPosition(
                (coordinate.column - centerColumn) * cellStep,
                (centerRow - coordinate.row) * cellStep,
                0,
            );

            /** 清理早期版本为字格额外绘制的描边，避免与 PSD 边框形成间隙。 */
            const borderNode: Node | null = slotView.node.getChildByName("CellBorder");
            borderNode?.destroy();
        });

        /** 棋盘中按照需求顺序展示的全部单词。 */
        const words: readonly string[] = [
            ...PLAYABLE_CONFIG.completedWords,
            ...PLAYABLE_CONFIG.wordSteps.map((step: WordStepConfig): string => step.word),
        ];
        words.forEach((word: string, wordIndex: number): void => {
            /** 当前单词的固定字谜布局。 */
            const wordLayout: CrosswordWordLayout | undefined = CROSSWORD_LAYOUT.find(
                (layout: CrosswordWordLayout): boolean => layout.word === word,
            );
            if (!wordLayout || wordLayout.cells.length === 0) {
                return;
            }
            /** 当前单词全部字格横坐标的总和。 */
            const totalX: number = wordLayout.cells.reduce(
                (sum: number, coordinate: CrosswordCellCoordinate): number =>
                    sum + (coordinate.column - centerColumn) * cellStep,
                0,
            );
            /** 当前单词全部字格纵坐标的总和。 */
            const totalY: number = wordLayout.cells.reduce(
                (sum: number, coordinate: CrosswordCellCoordinate): number =>
                    sum + (centerRow - coordinate.row) * cellStep,
                0,
            );
            this.wordTargetPositions[wordIndex].set(
                totalX / wordLayout.cells.length,
                totalY / wordLayout.cells.length,
                0,
            );
        });
    }

    /** 森林背景铺满画布，烟雾保持原比例贴合屏幕宽度并与底边对齐。 */
    private applyBackdropLayout(width: number, height: number): void {
        /** 1200 方形素材覆盖当前画布所需的统一缩放。 */
        const backgroundCoverScale: number = Math.max(width / 1200, height / 1200);
        this.backgroundSpriteNode?.setScale(backgroundCoverScale, backgroundCoverScale, 1);
        /** 烟雾仅按屏幕宽度等比缩放，不向上铺满整个画面。 */
        const fogWidthScale: number = width / FOG_TEXTURE_WIDTH;
        /** 缩放后烟雾的实际显示高度。 */
        const renderedFogHeight: number = FOG_TEXTURE_HEIGHT * fogWidthScale;
        this.fogSpan = FOG_TEXTURE_WIDTH * fogWidthScale;
        this.fogBottomY = -height / 2 + renderedFogHeight / 2;
        this.fogOffset = Math.max(-this.fogSpan, Math.min(0, this.fogOffset));
        this.fogNodes.forEach((fogNode: Node, fogIndex: number): void => {
            fogNode.setScale(fogWidthScale, fogWidthScale, 1);
            fogNode.setPosition(
                this.fogOffset + fogIndex * this.fogSpan,
                this.fogBottomY,
                0,
            );
        });
    }

    /** 按当前画布大小排列四条 PSD 光带，并保持各边渐变朝向正确。 */
    private redrawFeedbackFlash(width: number, height: number): void {
        if (!this.feedbackFlashNode || this.feedbackEdgeSprites.length < 4) {
            return;
        }
        this.feedbackFlashNode.getComponent(UITransform)?.setContentSize(width, height);
        /** 原始光带厚度。 */
        const edgeThickness: number = 35;
        /** 上边光带节点。 */
        const topNode: Node = this.feedbackEdgeSprites[0].node;
        /** 下边光带节点。 */
        const bottomNode: Node = this.feedbackEdgeSprites[1].node;
        /** 左边光带节点。 */
        const leftNode: Node = this.feedbackEdgeSprites[2].node;
        /** 右边光带节点。 */
        const rightNode: Node = this.feedbackEdgeSprites[3].node;

        topNode.getComponent(UITransform)?.setContentSize(width, edgeThickness);
        bottomNode.getComponent(UITransform)?.setContentSize(width, edgeThickness);
        leftNode.getComponent(UITransform)?.setContentSize(height, edgeThickness);
        rightNode.getComponent(UITransform)?.setContentSize(height, edgeThickness);
        topNode.setPosition(0, height / 2 - edgeThickness / 2, 0);
        bottomNode.setPosition(0, -height / 2 + edgeThickness / 2, 0);
        leftNode.setPosition(-width / 2 + edgeThickness / 2, 0, 0);
        rightNode.setPosition(width / 2 - edgeThickness / 2, 0, 0);
        topNode.setRotationFromEuler(0, 0, 0);
        bottomNode.setRotationFromEuler(0, 0, 180);
        leftNode.setRotationFromEuler(0, 0, 90);
        rightNode.setRotationFromEuler(0, 0, 270);
    }

    /** 更新圆形下载按钮和内部 PSD 图标尺寸。 */
    private applyDownloadButtonSize(buttonSize: number, iconSize: number): void {
        /** 下载按钮尺寸组件。 */
        const buttonTransform: UITransform | null = this.downloadNode
            ?.getComponent(UITransform) ?? null;
        /** 下载图标尺寸组件。 */
        const iconTransform: UITransform | null = this.downloadIconNode
            ?.getComponent(UITransform) ?? null;
        buttonTransform?.setContentSize(buttonSize, buttonSize);
        iconTransform?.setContentSize(iconSize, iconSize);
    }

    /** 按当前方向设置右下角品牌图标和安装按钮。 */
    private applyInstallPanelLayout(isLandscape: boolean): void {
        if (!this.installPanelNode) {
            return;
        }

        /** 当前设计分辨率下实际可见的逻辑区域。 */
        const visibleSize: Size = view.getVisibleSize();
        /** 安装组合与页面右下边缘保持的安全间距。 */
        const safeMargin: number = 0;
        /** 品牌图标节点。 */
        const gameIconNode: Node | null = this.installPanelNode.getChildByName("DownloadGameIcon");
        /** 安装按钮节点。 */
        const installButtonNode: Node | null = this.installPanelNode.getChildByName("InstallButton");
        /** 安装按钮背景节点。 */
        const installBackgroundNode: Node | null = installButtonNode
            ?.getChildByName("InstallBackground") ?? null;
        /** 安装按钮文字标签。 */
        const installLabel: Label | null = installButtonNode
            ?.getChildByName("InstallLabel")
            ?.getComponent(Label) ?? null;
        /** 安装面板尺寸组件。 */
        const panelTransform: UITransform = this.installPanelNode.getComponent(UITransform)!;
        /** PSD 完整安装按钮的尺寸组件。 */
        const panelImageTransform: UITransform | null = this.installPanelImageNode
            ?.getComponent(UITransform) ?? null;
        /** 品牌图标尺寸组件。 */
        const gameIconTransform: UITransform | null = gameIconNode?.getComponent(UITransform) ?? null;
        /** 安装按钮尺寸组件。 */
        const installButtonTransform: UITransform | null = installButtonNode
            ?.getComponent(UITransform) ?? null;
        /** 安装按钮背景尺寸组件。 */
        const installBackgroundTransform: UITransform | null = installBackgroundNode
            ?.getComponent(UITransform) ?? null;
        /** 安装文字尺寸组件。 */
        const installLabelTransform: UITransform | null = installLabel
            ?.node
            .getComponent(UITransform) ?? null;

        if (isLandscape) {
            /** 横屏安装组合相对节点中心的可见右边界。 */
            const landscapeRightOffset: number = 100;
            /** 横屏安装组合相对节点中心的可见下边界。 */
            const landscapeBottomOffset: number = 35;
            this.installPanelNode.setPosition(
                visibleSize.width / 2 - safeMargin - landscapeRightOffset,
                -visibleSize.height / 2 + safeMargin + landscapeBottomOffset,
                0,
            );
            panelTransform.setContentSize(240, 70);
            panelImageTransform?.setContentSize(200, 70);
            gameIconNode?.setPosition(-90, 0, 0);
            gameIconTransform?.setContentSize(58, 58);
            installButtonNode?.setPosition(30, 0, 0);
            installButtonTransform?.setContentSize(170, 64);
            installBackgroundTransform?.setContentSize(170, 64);
            installLabelTransform?.setContentSize(150, 56);
            if (installLabel) {
                installLabel.fontSize = 29;
                installLabel.lineHeight = 35;
            }
            return;
        }

        /** 竖屏安装组合相对节点中心的可见右边界。 */
        const portraitRightOffset: number = 120;
        /** 竖屏安装组合相对节点中心的可见下边界。 */
        const portraitBottomOffset: number = 42;
        this.installPanelNode.setPosition(
            visibleSize.width / 2 - safeMargin - portraitRightOffset,
            -visibleSize.height / 2 + safeMargin + portraitBottomOffset,
            0,
        );
        panelTransform.setContentSize(280, 84);
        panelImageTransform?.setContentSize(240, 84);
        gameIconNode?.setPosition(-72, 0, 0);
        gameIconTransform?.setContentSize(72, 72);
        installButtonNode?.setPosition(58, 0, 0);
        installButtonTransform?.setContentSize(176, 80);
        installBackgroundTransform?.setContentSize(176, 80);
        installLabelTransform?.setContentSize(160, 70);
        if (installLabel) {
            installLabel.fontSize = 34;
            installLabel.lineHeight = 42;
        }
    }

    /** 应用横屏结束页节点位置。 */
    private applyLandscapeEndCardPositions(): void {
        this.endCardIconNode && (this.endCardIconNode.active = false);
        this.brandNode?.setPosition(0, 155, 0);
        this.brandNode?.setScale(1, 1, 1);
        this.brandNode?.getComponent(UITransform)?.setContentSize(660, 110);
        this.endCardLogoNode?.getComponent(UITransform)?.setContentSize(563, 155);
        /** 横屏结算页标题标签。 */
        const landscapeBrandLabel: Label | null = this.brandNode
            ?.getChildByName("BrandLabel")
            ?.getComponent(Label) ?? null;
        if (landscapeBrandLabel) {
            landscapeBrandLabel.fontSize = 58;
            landscapeBrandLabel.lineHeight = 68;
            landscapeBrandLabel.node.getComponent(UITransform)?.setContentSize(640, 100);
        }
        this.endCardTaglineNode?.setPosition(0, -30, 0);
        this.endCardTaglineNode?.getComponent(UITransform)?.setContentSize(380, 97);
        this.playNowNode?.setPosition(0, -225, 0);
        this.playNowNode?.setScale(1, 1, 1);
        this.playNowNode?.getComponent(UITransform)?.setContentSize(360, 95);
    }

    /** 应用竖屏结束页节点位置。 */
    private applyPortraitEndCardPositions(): void {
        this.endCardIconNode && (this.endCardIconNode.active = false);
        this.brandNode?.setPosition(0, 238, 0);
        this.brandNode?.setScale(1.15, 1.15, 1);
        this.brandNode?.getComponent(UITransform)?.setContentSize(650, 120);
        this.endCardLogoNode?.getComponent(UITransform)?.setContentSize(563, 155);
        /** 竖屏结算页标题标签。 */
        const portraitBrandLabel: Label | null = this.brandNode
            ?.getChildByName("BrandLabel")
            ?.getComponent(Label) ?? null;
        if (portraitBrandLabel) {
            portraitBrandLabel.fontSize = 64;
            portraitBrandLabel.lineHeight = 74;
            portraitBrandLabel.node.getComponent(UITransform)?.setContentSize(630, 108);
        }
        this.endCardTaglineNode?.setPosition(0, -58, 0);
        this.endCardTaglineNode?.getComponent(UITransform)?.setContentSize(468, 120);
        this.playNowNode?.setPosition(0, -300, 0);
        this.playNowNode?.setScale(1.08, 1.08, 1);
        this.playNowNode?.getComponent(UITransform)?.setContentSize(431, 114);
    }

    /** 重绘森林图片加载前使用的自适应后备背景。 */
    private redrawBackground(width: number, height: number): void {
        if (!this.backgroundGraphics) {
            return;
        }

        /** 背景节点的尺寸组件。 */
        const transform: UITransform = this.backgroundGraphics.node.getComponent(UITransform)!;
        transform.setContentSize(width, height);
        this.backgroundGraphics.clear();
        this.backgroundGraphics.fillColor = BACKGROUND_COLOR;
        this.backgroundGraphics.rect(-width / 2, -height / 2, width, height);
        this.backgroundGraphics.fill();
    }

    /** 按十二点方向起始、逆时针顺序创建字盘字母。 */
    private createWheelLetters(
        wheelRoot: Node,
        letters: string,
        targetWord: string,
        showGuideImmediately: boolean = false,
    ): void {
        if (!this.letterWheelView) {
            return;
        }

        this.letterWheelView.configure(letters);
        this.wheelLetterLabels.length = 0;
        this.wheelLetterNodes.length = 0;
        this.wheelLetterHighlights.length = 0;
        this.letterWheelView.getLetterViews().forEach((letterView: WheelLetterView): void => {
            if (!letterView.node.active || !letterView.letterLabel || !letterView.highlightNode) {
                return;
            }
            this.wheelLetterNodes.push(letterView.node);
            this.wheelLetterLabels.push(letterView.letterLabel);
            this.wheelLetterHighlights.push(letterView.highlightNode);
        });
        this.currentGuideTargetWord = targetWord;
        if (showGuideImmediately) {
            this.startGuideHandAnimation(targetWord);
        } else if (this.hasStartedByInteraction) {
            this.scheduleGuideAfterIdle(PLAYABLE_CONFIG.idleGuideDelaySeconds);
        }
    }

    /** 绑定字盘连线和首次互动事件。 */
    private bindGameplayInput(): void {
        if (!this.layoutRoot || !this.wheelNode) {
            return;
        }

        this.layoutRoot.on(Node.EventType.TOUCH_START, this.dismissPrompt, this);
        this.wheelNode.on(Node.EventType.TOUCH_START, this.handleTraceStart, this);
        this.wheelNode.on(Node.EventType.TOUCH_MOVE, this.handleTraceMove, this);
        this.wheelNode.on(Node.EventType.TOUCH_END, this.handleTraceEnd, this);
        this.wheelNode.on(Node.EventType.TOUCH_CANCEL, this.handleTraceEnd, this);
        this.downloadNode?.on(Node.EventType.TOUCH_END, this.handleDownloadRequest, this);
        this.installPanelNode?.on(Node.EventType.TOUCH_END, this.handleDownloadRequest, this);
        this.playNowNode?.on(Node.EventType.TOUCH_END, this.handleDownloadRequest, this);
    }

    /** 移除字盘连线和首次互动事件。 */
    private unbindGameplayInput(): void {
        this.layoutRoot?.off(Node.EventType.TOUCH_START, this.dismissPrompt, this);
        this.wheelNode?.off(Node.EventType.TOUCH_START, this.handleTraceStart, this);
        this.wheelNode?.off(Node.EventType.TOUCH_MOVE, this.handleTraceMove, this);
        this.wheelNode?.off(Node.EventType.TOUCH_END, this.handleTraceEnd, this);
        this.wheelNode?.off(Node.EventType.TOUCH_CANCEL, this.handleTraceEnd, this);
        this.downloadNode?.off(Node.EventType.TOUCH_END, this.handleDownloadRequest, this);
        this.installPanelNode?.off(Node.EventType.TOUCH_END, this.handleDownloadRequest, this);
        this.playNowNode?.off(Node.EventType.TOUCH_END, this.handleDownloadRequest, this);
    }

    /** 首次点击任意位置后关闭开场问题文案。 */
    private dismissPrompt(): void {
        if (!this.isInputLocked && !this.isEndCardVisible) {
            this.recordPlayerInteraction();
        }
        if (!this.promptNode?.active) {
            return;
        }

        /** 提示节点透明度组件。 */
        const promptOpacity: UIOpacity = this.promptNode.getComponent(UIOpacity)
            ?? this.promptNode.addComponent(UIOpacity);
        tween(promptOpacity)
            .to(0.18, { opacity: 0 })
            .call((): void => {
                if (this.promptNode) {
                    this.promptNode.active = false;
                }
            })
            .start();
    }

    /** 处理玩家开始连线。 */
    private handleTraceStart(event: EventTouch): void {
        if (this.isInputLocked) {
            return;
        }
        this.recordPlayerInteraction();

        /** 触点在字盘中的局部坐标。 */
        const localPosition: Vec3 = this.getWheelLocalPosition(event);
        /** 触点命中的字母索引。 */
        const letterIndex: number = this.findLetterIndex(localPosition);
        if (letterIndex < 0) {
            return;
        }

        this.isTracing = true;
        this.selectedLetterIndices.length = 0;
        this.tracePointer.set(localPosition);
        this.trySelectLetter(letterIndex);
        this.redrawLetterTrace();
    }

    /** 处理玩家移动连线。 */
    private handleTraceMove(event: EventTouch): void {
        if (!this.isTracing || this.isInputLocked) {
            return;
        }
        this.recordPlayerInteraction();

        /** 触点在字盘中的局部坐标。 */
        const localPosition: Vec3 = this.getWheelLocalPosition(event);
        /** 当前触点命中的字母索引。 */
        const letterIndex: number = this.findLetterIndex(localPosition);
        this.tracePointer.set(localPosition);
        if (letterIndex >= 0) {
            /** 当前已选中的字母数量。 */
            const selectedCount: number = this.selectedLetterIndices.length;
            /** 当前连线的倒数第二个字母索引。 */
            const previousLetterIndex: number | undefined = selectedCount > 1
                ? this.selectedLetterIndices[selectedCount - 2]
                : undefined;
            /** 当前连线末尾字母索引。 */
            const lastLetterIndex: number | undefined = selectedCount > 0
                ? this.selectedLetterIndices[selectedCount - 1]
                : undefined;
            if (letterIndex === previousLetterIndex) {
                this.rollbackLastLetter();
            } else if (letterIndex !== lastLetterIndex) {
                this.trySelectLetter(letterIndex);
            }
        }
        this.redrawLetterTrace();
    }

    /** 处理玩家松手并判定当前组合。 */
    private handleTraceEnd(): void {
        if (!this.isTracing || this.isInputLocked) {
            return;
        }
        this.recordPlayerInteraction();

        this.isTracing = false;
        /** 当前连线组成的单词。 */
        const selectedWord: string = this.getSelectedWord();
        if (selectedWord.length <= 1) {
            this.resetTraceState();
            return;
        }
        /** 当前目标步骤配置。 */
        const currentStep: WordStepConfig | undefined = PLAYABLE_CONFIG.wordSteps[this.currentStepIndex];
        if (currentStep && selectedWord === currentStep.word) {
            this.handleCorrectWord(currentStep);
            return;
        }
        /** 当前组合是否属于已经填入或收藏夹中的有效词。 */
        const isRepeatWord: boolean = this.completedWords.has(selectedWord)
            || PLAYABLE_CONFIG.bonusWords.includes(selectedWord);
        if (isRepeatWord) {
            this.handleRepeatWord();
        } else {
            this.handleWrongWord();
        }
    }

    /** 将屏幕触点转换成字盘局部坐标。 */
    private getWheelLocalPosition(event: EventTouch): Vec3 {
        /** 屏幕 UI 坐标。 */
        const uiPosition = event.getUILocation();
        /** 字盘尺寸转换组件。 */
        const wheelTransform: UITransform = this.wheelNode!.getComponent(UITransform)!;
        return wheelTransform.convertToNodeSpaceAR(new Vec3(uiPosition.x, uiPosition.y, 0));
    }

    /** 查找触点附近的字母索引。 */
    private findLetterIndex(localPosition: Vec3): number {
        /** 字母可选中的半径。 */
        const hitRadius: number = 52;
        return this.wheelLetterNodes.findIndex((letterNode: Node): boolean =>
            Vec3.distance(letterNode.position, localPosition) <= hitRadius,
        );
    }

    /** 将尚未选择的字母加入当前连线。 */
    private trySelectLetter(letterIndex: number): void {
        if (this.selectedLetterIndices.includes(letterIndex)) {
            return;
        }

        this.selectedLetterIndices.push(letterIndex);
        /** 新选中字母的节点。 */
        const letterNode: Node = this.wheelLetterNodes[letterIndex];
        /** 新选中字母的视图组件。 */
        const letterView: WheelLetterView | null = letterNode.getComponent(WheelLetterView);
        letterView?.setSelected(true);
        this.playEffect(this.tapAudioClip, 0.48);
        this.updateSelectedWordLabel();
    }

    /** 回退当前连线末尾字母，并恢复其未选中视觉。 */
    private rollbackLastLetter(): void {
        /** 被撤销的末尾字母索引。 */
        const removedLetterIndex: number | undefined = this.selectedLetterIndices.pop();
        if (removedLetterIndex === undefined) {
            return;
        }

        /** 被撤销字母的 Prefab 根节点。 */
        const removedLetterNode: Node | undefined = this.wheelLetterNodes[removedLetterIndex];
        if (removedLetterNode) {
            /** 被撤销字母的视图组件。 */
            const removedLetterView: WheelLetterView | null = removedLetterNode
                .getComponent(WheelLetterView);
            removedLetterView?.setSelected(false);
        }
        this.updateSelectedWordLabel();
    }

    /** 获取当前连线组成的字母字符串。 */
    private getSelectedWord(): string {
        return this.selectedLetterIndices
            .map((letterIndex: number): string => this.wheelLetterLabels[letterIndex].string)
            .join("");
    }

    /** 更新字盘上方深绿色横条中的当前组合文案。 */
    private updateSelectedWordLabel(): void {
        /** 当前手势组成的单词。 */
        const selectedWord: string = this.getSelectedWord();
        /** 根据字母数量扩展横条，短单词也保持足够醒目的宽度。 */
        const bannerWidth: number = Math.max(180, selectedWord.length * 38 + 50);
        if (this.selectedWordLabel) {
            this.selectedWordLabel.string = Array.from(selectedWord).join(" ");
            /** 深绿色横条文字的尺寸组件。 */
            const labelTransform: UITransform = this.selectedWordLabel.node.getComponent(UITransform)!;
            labelTransform.setContentSize(bannerWidth - 20, 64);
        }
        if (this.selectionBannerNode) {
            /** 深绿色横条根节点的尺寸组件。 */
            const bannerTransform: UITransform = this.selectionBannerNode.getComponent(UITransform)!;
            bannerTransform.setContentSize(bannerWidth, 70);
            this.selectionBannerNode.active = true;
        }
        if (this.selectionBannerGraphics) {
            this.selectionBannerGraphics.clear();
            this.selectionBannerGraphics.fillColor = SELECTION_COLOR;
            this.selectionBannerGraphics.roundRect(-bannerWidth / 2, -35, bannerWidth, 70, 35);
            this.selectionBannerGraphics.fill();
        }
    }

    /** 重绘已选字母之间的连线及当前手势尾线。 */
    private redrawLetterTrace(): void {
        if (!this.traceGraphics || this.selectedLetterIndices.length === 0) {
            return;
        }

        this.traceGraphics.clear();
        this.traceGraphics.strokeColor = SELECTION_COLOR;
        this.traceGraphics.lineWidth = TRACE_LINE_WIDTH;
        this.traceGraphics.lineCap = Graphics.LineCap.ROUND;
        this.traceGraphics.lineJoin = Graphics.LineJoin.ROUND;
        /** 首个选中字母的位置。 */
        const firstPosition: Vec3 = this.wheelLetterNodes[this.selectedLetterIndices[0]].position;
        this.traceGraphics.moveTo(firstPosition.x, firstPosition.y);
        this.selectedLetterIndices.slice(1).forEach((letterIndex: number): void => {
            /** 当前选中字母的位置。 */
            const letterPosition: Vec3 = this.wheelLetterNodes[letterIndex].position;
            this.traceGraphics?.lineTo(letterPosition.x, letterPosition.y);
        });
        if (this.isTracing) {
            this.traceGraphics.lineTo(this.tracePointer.x, this.tracePointer.y);
        }
        this.traceGraphics.stroke();
    }

    /** 处理错误组合，并立即清理本轮状态以允许重新连线。 */
    private handleWrongWord(): void {
        this.errorCount += 1;
        this.hideGuideHand();
        this.playEffect(this.wrongAudioClip);
        this.showFeedbackFlash(WRONG_FLASH_COLOR);
        this.resetTraceState();
        this.node.emit("playable-word-error", this.errorCount);
    }

    /** 处理已填单词或收藏夹词，并以黄光反馈后继续下一次连线。 */
    private handleRepeatWord(): void {
        /** 本轮识别出的重复或收藏夹单词。 */
        const repeatedWord: string = this.getSelectedWord();
        this.hideGuideHand();
        this.playEffect(this.repeatAudioClip);
        this.showFeedbackFlash(REPEAT_FLASH_COLOR);
        this.resetTraceState();
        this.node.emit("playable-word-repeat", repeatedWord);
    }

    /** 处理正确单词，等待逐字落位完成后再推进下一步骤。 */
    private handleCorrectWord(step: WordStepConfig): void {
        this.isInputLocked = true;
        /** 本轮正确反馈的动画代次。 */
        const settlementGeneration: number = ++this.correctSettlementGeneration;
        /** 本次正确填写对应的步骤索引。 */
        const completedStepIndex: number = this.currentStepIndex;
        /** 当前是否完成了最后一个目标单词。 */
        const isFinalWord: boolean = this.currentStepIndex
            >= PLAYABLE_CONFIG.wordSteps.length - 1;
        this.hideGuideHand();
        this.hideSelectionVisuals();
        this.playEffect(this.correctAudioClip);
        this.isTracing = false;
        this.selectedLetterIndices.length = 0;
        /** 防止落位回调与保底回调重复推进。 */
        let hasFinishedSettlement: boolean = false;
        /** 完成正确反馈并恢复后续流程。 */
        const finishSettlement = (): void => {
            if (
                hasFinishedSettlement
                || settlementGeneration !== this.correctSettlementGeneration
                || this.isEndCardVisible
            ) {
                return;
            }
            hasFinishedSettlement = true;
            this.completeCurrentBoardRow(step.word);
            this.showPraiseAnimation(step.praise);
            this.showGoldParticleBurst(step.word);
            this.completedWords.add(step.word);
            this.currentStepIndex += 1;
            if (
                PLAYABLE_CONFIG.storeRedirectStepIndex >= 0
                && completedStepIndex === PLAYABLE_CONFIG.storeRedirectStepIndex
            ) {
                this.handleDownloadRequest();
            }
            if (isFinalWord) {
                /** 等鼓励横幅完整播放并清理后再进入结束页，避免两层内容重叠。 */
                this.scheduleOnce((): void => {
                    if (settlementGeneration === this.correctSettlementGeneration) {
                        this.advanceToNextStep();
                    }
                }, 1.25);
                return;
            }
            this.advanceToNextStep();
        };
        this.animateWordLanding(step.word, finishSettlement);
        /** 保底恢复，避免异常素材或补间回调导致交互永久锁定。 */
        this.scheduleOnce(finishSettlement, 1.2);
    }

    /** 将正确单词逐字从字盘飞入对应字格，并在全部落位后回调。 */
    private animateWordLanding(word: string, onComplete: () => void): void {
        if (!this.layoutRoot || !this.wheelNode || !this.boardNode) {
            onComplete();
            return;
        }
        /** 当前目标单词在完整棋盘单词列表中的索引。 */
        const targetWordIndex: number = PLAYABLE_CONFIG.completedWords.length + this.currentStepIndex;
        /** 当前目标行全部字母标签。 */
        const targetLabels: Label[] = this.wordSlotLabels[targetWordIndex] ?? [];
        /** 当前目标行全部字格背景。 */
        const targetBackgrounds: Sprite[] = this.wordSlotBackgrounds[targetWordIndex] ?? [];
        if (targetLabels.length < word.length || targetBackgrounds.length < word.length) {
            onComplete();
            return;
        }
        /** 布局根节点坐标转换组件。 */
        const layoutTransform: UITransform = this.layoutRoot.getComponent(UITransform)!;
        /** 已用于本次落位的字盘字母索引。 */
        const usedLetterIndices: number[] = [];
        /** 已经抵达目标字格的字符数量。 */
        let landedLetterCount: number = 0;

        Array.from(word).forEach((letter: string, letterIndex: number): void => {
            /** 当前字符对应的未使用字盘索引。 */
            const sourceLetterIndex: number = this.wheelLetterLabels.findIndex(
                (sourceLabel: Label, sourceIndex: number): boolean =>
                    sourceLabel.string === letter && !usedLetterIndices.includes(sourceIndex),
            );
            if (sourceLetterIndex >= 0) {
                usedLetterIndices.push(sourceLetterIndex);
            }
            /** 当前字符的字盘源节点。 */
            const sourceLetterNode: Node = this.wheelLetterNodes[sourceLetterIndex]
                ?? this.wheelNode!;
            /** 当前字符的目标字格标签。 */
            const targetLabel: Label = targetLabels[letterIndex];
            /** 当前字符的目标字格背景。 */
            const targetBackground: Sprite = targetBackgrounds[letterIndex];
            /** 字盘字母中心在布局根节点中的坐标。 */
            const sourcePosition: Vec3 = layoutTransform.convertToNodeSpaceAR(
                sourceLetterNode.getComponent(UITransform)!.convertToWorldSpaceAR(Vec3.ZERO),
            );
            /** 目标字格中心在布局根节点中的坐标。 */
            const targetPosition: Vec3 = layoutTransform.convertToNodeSpaceAR(
                targetLabel.node.getComponent(UITransform)!.convertToWorldSpaceAR(Vec3.ZERO),
            );
            /** 当前飞行字符标签。 */
            const flyingLabel: Label = this.createLabel(
                `FlyingLetter_${letterIndex}`,
                this.layoutRoot!,
                letter,
                48,
                new Color(255, 255, 255, 255),
                72,
                72,
            );
            flyingLabel.isBold = true;
            flyingLabel.font = this.wheelLetterLabels[sourceLetterIndex]?.font ?? null;
            flyingLabel.node.setPosition(sourcePosition);
            flyingLabel.node.setSiblingIndex(this.layoutRoot!.children.length - 1);
            tween(flyingLabel.node)
                .delay(letterIndex * 0.07)
                .parallel(
                    tween().to(0.34, { position: targetPosition }, { easing: "quadIn" }),
                    tween().to(0.34, { scale: new Vec3(0.72, 0.72, 1) }),
                )
                .call((): void => {
                    targetLabel.string = letter;
                    targetLabel.color = new Color(255, 255, 255, 255);
                    this.setSlotColor(targetBackground, FILLED_SLOT_COLOR);
                    flyingLabel.node.destroy();
                    landedLetterCount += 1;
                    if (landedLetterCount >= word.length) {
                        onComplete();
                    }
                })
                .start();
        });
    }

    /** 显示与正确单词一一对应的 PSD 鼓励词。 */
    private showPraiseAnimation(praise: string): void {
        if (!this.layoutRoot || !this.wheelNode) {
            return;
        }

        /** 当前进度对应的 PSD 横幅配置。 */
        const praiseVisual: PraiseVisualConfig = PRAISE_VISUALS[praise]
            ?? PRAISE_VISUALS.Spectacular;
        /** 鼓励词精灵节点。 */
        const praiseNode: Node = this.createSpriteNode(
            `Praise_${praise}`,
            this.layoutRoot,
            praiseVisual.resourcePath,
            praiseVisual.width,
            praiseVisual.height,
        );
        /** 鼓励词透明度组件。 */
        const praiseOpacity: UIOpacity = praiseNode.addComponent(UIOpacity);
        praiseOpacity.opacity = 0;
        /** 当前是否采用横屏布局。 */
        const isLandscape: boolean = view.getFrameSize().width >= view.getFrameSize().height;
        /** 横幅在棋盘和字盘交界处的位置。 */
        const praisePosition: Vec3 = new Vec3(0, isLandscape ? 0 : -8, 0);
        praiseNode.setPosition(praisePosition);
        praiseNode.setScale(0.15, 0.15, 1);
        praiseNode.setSiblingIndex(this.layoutRoot.children.length - 1);

        tween(praiseNode)
            .parallel(
                tween().to(0.32, { scale: new Vec3(1.28, 1.28, 1) }, { easing: "backOut" }),
                tween(praiseOpacity).to(0.2, { opacity: 255 }),
            )
            .to(0.16, { scale: new Vec3(0.92, 0.92, 1) }, { easing: "sineIn" })
            .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
            .delay(0.35)
            .parallel(
                tween().to(0.2, { position: new Vec3(
                    praisePosition.x,
                    praisePosition.y + 55,
                    0,
                ) }),
                tween(praiseOpacity).to(0.2, { opacity: 0 }),
            )
            .call((): void => {
                praiseNode.destroy();
            })
            .start();
    }

    /** 清除仍在播放的鼓励横幅，保证结束页背景干净。 */
    private clearPraiseAnimations(): void {
        this.layoutRoot?.children
            .filter((childNode: Node): boolean => childNode.name.startsWith("Praise_"))
            .forEach((praiseNode: Node): void => {
                Tween.stopAllByTarget(praiseNode);
                /** 鼓励横幅透明度组件。 */
                const praiseOpacity: UIOpacity | null = praiseNode.getComponent(UIOpacity);
                praiseOpacity && Tween.stopAllByTarget(praiseOpacity);
                praiseNode.destroy();
            });
    }

    /** 将当前目标行填成完整白色单词。 */
    private completeCurrentBoardRow(word: string): void {
        /** 当前目标在单词面板中的行索引。 */
        const rowIndex: number = PLAYABLE_CONFIG.completedWords.length + this.currentStepIndex;
        /** 当前行所有字母标签。 */
        const labels: Label[] = this.wordSlotLabels[rowIndex] ?? [];
        /** 当前行所有字格背景。 */
        const backgroundList: Sprite[] = this.wordSlotBackgrounds[rowIndex] ?? [];
        Array.from(word).forEach((letter: string, letterIndex: number): void => {
            /** 当前字格标签。 */
            const letterLabel: Label | undefined = labels[letterIndex];
            /** 当前字格背景。 */
            const slotBackground: Sprite | undefined = backgroundList[letterIndex];
            if (!letterLabel || !slotBackground) {
                return;
            }

            if (letterLabel.string === letter) {
                return;
            }

            letterLabel.string = letter;
            letterLabel.color = new Color(255, 255, 255, 255);
            letterLabel.node.setScale(0.1, 0.1, 1);
            this.setSlotColor(slotBackground, FILLED_SLOT_COLOR);
            tween(letterLabel.node)
                .delay(letterIndex * 0.045)
                .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
                .start();
        });
    }

    /** 在正确单词落点周围播放一圈金色粒子，强化填写成功反馈。 */
    private showGoldParticleBurst(word: string): void {
        if (!this.layoutRoot || !this.boardNode) {
            return;
        }

        /** 当前目标单词在完整棋盘中的索引。 */
        const targetWordIndex: number = PLAYABLE_CONFIG.completedWords.length + this.currentStepIndex;
        /** 当前目标单词在棋盘局部坐标中的中心。 */
        const targetWordPosition: Vec3 = this.wordTargetPositions[targetWordIndex] ?? Vec3.ZERO;
        /** 棋盘当前响应式缩放。 */
        const boardScale: Vec3 = this.boardNode.scale;
        /** 粒子爆发在内容根节点中的中心坐标。 */
        const burstCenter: Vec3 = new Vec3(
            this.boardNode.position.x + targetWordPosition.x * boardScale.x,
            this.boardNode.position.y + targetWordPosition.y * boardScale.y,
            0,
        );
        /** 根据单词长度适当扩大横向粒子范围。 */
        const horizontalRadius: number = Math.max(95, word.length * 24);
        /** 单次爆发使用的粒子数量。 */
        const particleCount: number = 18;
        for (let particleIndex: number = 0; particleIndex < particleCount; particleIndex += 1) {
            /** 当前粒子均匀分布的角度。 */
            const angle: number = Math.PI * 2 * particleIndex / particleCount;
            /** 当前粒子节点。 */
            const particleNode: Node = this.createUiNode(`GoldParticle_${particleIndex}`, this.layoutRoot, 20, 20);
            /** 当前粒子的金色圆点图形。 */
            const particleGraphics: Graphics = particleNode.addComponent(Graphics);
            /** 当前粒子的透明度组件。 */
            const particleOpacity: UIOpacity = particleNode.addComponent(UIOpacity);
            /** 当前粒子大小，交替产生层次感。 */
            const particleRadius: number = 3 + particleIndex % 3;
            particleGraphics.fillColor = particleIndex % 2 === 0
                ? new Color(255, 222, 74, 255)
                : new Color(255, 174, 35, 255);
            particleGraphics.circle(0, 0, particleRadius);
            particleGraphics.fill();
            particleNode.setPosition(burstCenter);
            particleNode.setScale(0.2, 0.2, 1);
            particleNode.setSiblingIndex(this.layoutRoot.children.length - 1);

            /** 当前粒子最终散开的坐标。 */
            const targetPosition: Vec3 = new Vec3(
                burstCenter.x + Math.cos(angle) * horizontalRadius,
                burstCenter.y + Math.sin(angle) * 78,
                0,
            );
            tween(particleNode)
                .delay((particleIndex % 4) * 0.025)
                .parallel(
                    tween().to(0.52, { position: targetPosition }, { easing: "quadOut" }),
                    tween().to(0.18, { scale: new Vec3(1.25, 1.25, 1) }, { easing: "backOut" })
                        .to(0.34, { scale: new Vec3(0.25, 0.25, 1) }),
                    tween(particleOpacity).delay(0.28).to(0.24, { opacity: 0 }),
                )
                .call((): void => {
                    particleNode.destroy();
                })
                .start();
        }
    }

    /** 激活下一行和下一组字盘字母。 */
    private advanceToNextStep(): void {
        /** 下一目标步骤。 */
        const nextStep: WordStepConfig | undefined = PLAYABLE_CONFIG.wordSteps[this.currentStepIndex];
        if (!nextStep || !this.wheelNode) {
            this.isInputLocked = true;
            this.node.emit("playable-all-words-completed", this.errorCount);
            this.showEndCard("completed");
            return;
        }

        this.createWheelLetters(this.wheelNode, nextStep.wheelLetters, nextStep.word);
        this.isInputLocked = false;
    }

    /** 显示品牌结束页并通知广告宿主试玩结束。 */
    private showEndCard(reason: "completed" | "timeout"): void {
        if (this.isEndCardVisible || !this.endCardNode) {
            return;
        }

        this.unschedule(this.handleGuideIdleTimeout);
        this.unschedule(this.handleCountdownTick);
        this.correctSettlementGeneration += 1;
        this.hideGuideHand();
        this.clearPraiseAnimations();
        this.isEndCardVisible = true;
        this.isInputLocked = true;
        this.isTracing = false;
        this.hideSelectionVisuals();
        this.promptNode && (this.promptNode.active = false);
        this.clockNode && (this.clockNode.active = false);
        this.boardNode && (this.boardNode.active = false);
        this.wheelNode && (this.wheelNode.active = false);
        this.endCardNode.active = true;
        this.endCardNode.setSiblingIndex(this.layoutRoot!.children.length - 1);

        /** 结束页隐藏圆形下载按钮，仅保留右下角品牌安装入口。 */
        this.downloadNode && (this.downloadNode.active = false);
        /**
         * 将安装面板移入结束页前景，避免动态激活结束页后被其后创建的 UI 覆盖；
         * 结束页与主界面坐标原点一致，因此无需换算位置。
         */
        if (this.installPanelNode?.parent !== this.endCardNode) {
            this.installPanelNode?.removeFromParent();
            this.endCardNode.addChild(this.installPanelNode!);
        }
        this.installPanelNode?.setSiblingIndex(this.endCardNode.children.length - 1);

        /** 结束页透明度组件。 */
        const endCardOpacity: UIOpacity = this.endCardNode.getComponent(UIOpacity)
            ?? this.endCardNode.addComponent(UIOpacity);
        endCardOpacity.opacity = 0;
        tween(endCardOpacity)
            .to(0.32, { opacity: 255 }, { easing: "sineOut" })
            .start();
        this.startPlayNowAnimation();
        notifyPlayableGameEnd();
        this.node.emit("playable-end-card-shown", reason, this.errorCount);
    }

    /** 循环播放结束页 Play Now 按钮放大缩小动画。 */
    private startPlayNowAnimation(): void {
        if (!this.playNowNode) {
            return;
        }

        /** 当前方向布局赋予按钮的基础缩放。 */
        const baseScale: Vec3 = this.playNowNode.scale.clone();
        /** 按钮呼吸动画的放大缩放。 */
        const enlargedScale: Vec3 = new Vec3(
            baseScale.x * 1.09,
            baseScale.y * 1.09,
            1,
        );
        Tween.stopAllByTarget(this.playNowNode);
        tween(this.playNowNode)
            .to(0.55, { scale: enlargedScale }, { easing: "sineInOut" })
            .to(0.55, { scale: baseScale }, { easing: "sineInOut" })
            .union()
            .repeatForever()
            .start();
    }

    /** 处理 Play Now 和右下安装入口的统一商店跳转。 */
    private handleDownloadRequest(): void {
        requestPlayableDownload();
        this.node.emit("playable-download-requested");
    }

    /** 按指定颜色更新单个圆角字格精灵。 */
    private setSlotColor(slotBackground: Sprite, color: Color): void {
        /** 绿色状态使用 PSD 已填字格，其余状态使用 PSD 空白字格。 */
        const isFilled: boolean = color.r === FILLED_SLOT_COLOR.r
            && color.g === FILLED_SLOT_COLOR.g
            && color.b === FILLED_SLOT_COLOR.b;
        /** 当前状态对应的 PSD 字格图片。 */
        const targetFrame: SpriteFrame | null = isFilled
            ? this.filledSlotSpriteFrame
            : this.emptySlotSpriteFrame;
        if (targetFrame) {
            slotBackground.spriteFrame = targetFrame;
            slotBackground.color = new Color(255, 255, 255, 255);
            return;
        }
        slotBackground.color = color;
    }

    /** 清除本轮连线、组合文案和字母选中缩放。 */
    private resetTraceState(): void {
        this.isTracing = false;
        this.hideSelectionVisuals();
        this.selectedLetterIndices.length = 0;
        this.wheelLetterNodes.forEach((letterNode: Node): void => {
            Tween.stopAllByTarget(letterNode);
            letterNode.setScale(1, 1, 1);
        });
    }

    /** 隐藏当前连线、选中圆和字盘上方组合横条。 */
    private hideSelectionVisuals(): void {
        this.traceGraphics?.clear();
        if (this.selectedWordLabel) {
            this.selectedWordLabel.string = "";
        }
        if (this.selectionBannerNode) {
            this.selectionBannerNode.active = false;
        }
        this.wheelLetterHighlights.forEach((highlightNode: Node): void => {
            highlightNode.active = false;
        });
        this.wheelLetterLabels.forEach((letterLabel: Label, letterIndex: number): void => {
            letterLabel.color = new Color(0, 0, 0, 255);
            this.wheelLetterNodes[letterIndex]?.setScale(1, 1, 1);
        });
    }

    /** 立即隐藏并停止当前逆时针引导手，避免玩家连线时仍残留淡出动画。 */
    private hideGuideHand(): void {
        if (!this.guideHandNode) {
            return;
        }

        Tween.stopAllByTarget(this.guideHandNode);
        this.clearGuidePreviewVisuals();
        /** 引导手透明度组件。 */
        const handOpacity: UIOpacity = this.guideHandNode.getComponent(UIOpacity)
            ?? this.guideHandNode.addComponent(UIOpacity);
        Tween.stopAllByTarget(handOpacity);
        handOpacity.opacity = 0;
        this.guideHandNode.active = false;
    }

    /** 首次有效交互时启动背景音乐和三十秒倒计时。 */
    private startGameplayFromInteraction(): void {
        if (this.hasStartedByInteraction || this.isEndCardVisible) {
            return;
        }

        this.hasStartedByInteraction = true;
        this.remainingSeconds = PLAYABLE_CONFIG.countdownSeconds;
        this.updateClockLabel();
        this.playBackgroundMusic();
        this.unschedule(this.handleCountdownTick);
        this.schedule(this.handleCountdownTick, 1);
    }

    /** 在浏览器用户手势已经发生后播放循环背景音乐。 */
    private playBackgroundMusic(): void {
        if (!this.backgroundAudioSource || !this.backgroundMusicClip) {
            return;
        }
        this.backgroundAudioSource.clip = this.backgroundMusicClip;
        if (!this.backgroundAudioSource.playing) {
            this.backgroundAudioSource.play();
        }
    }

    /** 播放一次指定短音效。 */
    private playEffect(clip: AudioClip | null, volumeScale: number = 1): void {
        if (!clip || !this.effectAudioSource) {
            return;
        }
        this.effectAudioSource.playOneShot(clip, volumeScale);
    }

    /** 每秒推进倒计时，最后五秒抖动并在归零时进入最终页。 */
    private handleCountdownTick(): void {
        if (this.isEndCardVisible) {
            this.unschedule(this.handleCountdownTick);
            return;
        }

        this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
        this.updateClockLabel();
        if (this.remainingSeconds <= 5 && !this.hasStartedClockWarning) {
            this.startClockWarningAnimation();
        }
        if (this.remainingSeconds > 0) {
            return;
        }
        this.unschedule(this.handleCountdownTick);
        this.showEndCard("timeout");
    }

    /** 将最新倒计时秒数写入闹钟数字。 */
    private updateClockLabel(): void {
        if (this.clockLabel) {
            this.clockLabel.string = String(this.remainingSeconds);
        }
    }

    /** 循环大幅抖动最后五秒的闹钟图标。 */
    private startClockWarningAnimation(): void {
        if (!this.clockNode) {
            return;
        }
        this.hasStartedClockWarning = true;
        /** 抖动开始时闹钟所在的响应式基准位置。 */
        const basePosition: Vec3 = this.clockNode.position.clone();
        Tween.stopAllByTarget(this.clockNode);
        tween(this.clockNode)
            .to(0.06, { position: new Vec3(basePosition.x - 13, basePosition.y + 6, 0), scale: new Vec3(1.15, 1.15, 1) })
            .to(0.06, { position: new Vec3(basePosition.x + 13, basePosition.y - 6, 0), scale: new Vec3(1.15, 1.15, 1) })
            .to(0.06, { position: basePosition, scale: Vec3.ONE })
            .union()
            .repeatForever()
            .start();
    }

    /** 以指定颜色闪烁一次画面四周。 */
    private showFeedbackFlash(color: Color): void {
        if (!this.feedbackFlashNode || this.feedbackEdgeSprites.length < 4) {
            return;
        }
        /** 错误反馈使用红光，其余收藏词和重复词反馈使用黄光。 */
        const targetFrame: SpriteFrame | null = color.r === WRONG_FLASH_COLOR.r
            && color.g === WRONG_FLASH_COLOR.g
            && color.b === WRONG_FLASH_COLOR.b
            ? this.redFeedbackSpriteFrame
            : this.yellowFeedbackSpriteFrame;
        if (!targetFrame) {
            return;
        }
        this.feedbackEdgeSprites.forEach((edgeSprite: Sprite): void => {
            edgeSprite.spriteFrame = targetFrame;
            edgeSprite.color = new Color(255, 255, 255, 255);
            edgeSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        });
        /** 当前画布逻辑尺寸。 */
        const visibleSize: Size = view.getVisibleSize();
        this.redrawFeedbackFlash(visibleSize.width, visibleSize.height);
        /** 边缘闪光透明度组件。 */
        const flashOpacity: UIOpacity = this.feedbackFlashNode.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(flashOpacity);
        this.feedbackFlashNode.active = true;
        this.feedbackFlashNode.setSiblingIndex(this.layoutRoot!.children.length - 1);
        flashOpacity.opacity = 0;
        tween(flashOpacity)
            .to(0.45, { opacity: 255 }, { easing: "sineOut" })
            .delay(0.5)
            .to(0.45, { opacity: 0 }, { easing: "sineIn" })
            .call((): void => {
                if (this.feedbackFlashNode) {
                    this.feedbackFlashNode.active = false;
                }
            })
            .start();
    }

    /** 记录玩家交互，首次启动音频与倒计时，并重新计算两秒空闲提示。 */
    private recordPlayerInteraction(): void {
        this.startGameplayFromInteraction();
        if (this.promptNode) {
            this.promptNode.active = false;
        }
        this.hideGuideHand();
        this.scheduleGuideAfterIdle(PLAYABLE_CONFIG.idleGuideDelaySeconds);
    }

    /** 在玩家连续指定秒数没有操作后显示当前单词引导。 */
    private scheduleGuideAfterIdle(delaySeconds: number): void {
        this.unschedule(this.handleGuideIdleTimeout);
        if (this.isEndCardVisible || !this.currentGuideTargetWord) {
            return;
        }
        this.scheduleOnce(this.handleGuideIdleTimeout, delaySeconds);
    }

    /** 处理当前配置的无操作引导计时结束。 */
    private handleGuideIdleTimeout(): void {
        if (this.isEndCardVisible || this.isTracing || this.isInputLocked) {
            this.scheduleGuideAfterIdle(PLAYABLE_CONFIG.idleGuideDelaySeconds);
            return;
        }
        if (this.promptNode) {
            this.promptNode.active = true;
            /** 引导提示透明度组件。 */
            const promptOpacity: UIOpacity = this.promptNode.getComponent(UIOpacity)
                ?? this.promptNode.addComponent(UIOpacity);
            promptOpacity.opacity = 255;
        }
        this.startGuideHandAnimation(this.currentGuideTargetWord);
    }

    /** 启动下载按钮，并在开局一秒无操作后显示文案和手势引导。 */
    private startInitialAnimations(): void {
        this.startDownloadIconAnimation();
        if (this.promptNode) {
            this.promptNode.active = false;
            /** 首屏引导文案透明度组件。 */
            const promptOpacity: UIOpacity = this.promptNode.getComponent(UIOpacity)
                ?? this.promptNode.addComponent(UIOpacity);
            Tween.stopAllByTarget(promptOpacity);
            promptOpacity.opacity = 0;
        }
        this.traceGraphics?.clear();
        this.scheduleGuideAfterIdle(PLAYABLE_CONFIG.initialGuideDelaySeconds);
    }

    /** 按十二点起始逆时针顺序循环放大缩小字盘字母。 */
    private startWheelLetterPulse(): void {
        /** 当前字母数量。 */
        const letterCount: number = this.wheelLetterNodes.length;
        this.wheelLetterNodes.forEach((letterNode: Node, letterIndex: number): void => {
            Tween.stopAllByTarget(letterNode);
            letterNode.setScale(1, 1, 1);
            tween(letterNode)
                .delay(letterIndex * 0.36)
                .to(0.51, { scale: new Vec3(1.18, 1.18, 1) }, { easing: "sineOut" })
                .to(0.51, { scale: new Vec3(1, 1, 1) }, { easing: "sineIn" })
                .delay(Math.max(0.6, (letterCount - letterIndex) * 0.36))
                .union()
                .repeatForever()
                .start();
        });
    }

    /** 按目标单词的字符顺序循环播放逆时针连线引导手势。 */
    private startGuideHandAnimation(targetWord: string): void {
        if (!this.guideHandNode || this.wheelLetterNodes.length === 0) {
            return;
        }

        this.unschedule(this.handleGuideIdleTimeout);
        Tween.stopAllByTarget(this.guideHandNode);
        /** 引导手透明度组件。 */
        const handOpacity: UIOpacity = this.guideHandNode.getComponent(UIOpacity)
            ?? this.guideHandNode.addComponent(UIOpacity);
        Tween.stopAllByTarget(handOpacity);
        this.guideHandNode.active = true;
        handOpacity.opacity = 0;
        this.clearGuidePreviewVisuals();
        /** 已加入引导路径的轮盘字母索引。 */
        const usedLetterIndices: number[] = [];
        /** 按目标单词字符顺序解析出的全部字母中心位置。 */
        const letterCenterPositions: Vec3[] = Array.from(targetWord)
            .map((targetLetter: string): Vec3 | null => {
                /** 当前目标字符在轮盘中尚未使用的位置。 */
                const letterIndex: number = this.wheelLetterLabels.findIndex(
                    (letterLabel: Label, index: number): boolean =>
                        letterLabel.string === targetLetter
                        && !usedLetterIndices.includes(index),
                );
                if (letterIndex < 0) {
                    return null;
                }
                usedLetterIndices.push(letterIndex);
                /** 当前目标字符对应的轮盘节点。 */
                const letterNode: Node = this.wheelLetterNodes[letterIndex];
                return letterNode.position.clone();
            })
            .filter((letterCenterPosition: Vec3 | null): letterCenterPosition is Vec3 =>
                letterCenterPosition !== null,
            );
        if (letterCenterPositions.length === 0) {
            this.guideHandNode.active = false;
            return;
        }
        this.guideLetterCenterPositions.push(...letterCenterPositions);
        this.guideLetterIndices.push(...usedLetterIndices);
        /** PSD 手势图片中心到指尖热点的反向补偿，使指尖准确落在字母中心。 */
        const handCenterOffset: Vec3 = new Vec3(
            64 * this.guideHandNode.scale.x,
            -84 * this.guideHandNode.scale.y,
            0,
        );
        this.guideHandCenterOffset.set(handCenterOffset);
        /** 手势节点沿每个字母中心移动时实际采用的位置。 */
        const handNodePositions: Vec3[] = letterCenterPositions.map(
            (letterCenterPosition: Vec3): Vec3 => new Vec3(
                letterCenterPosition.x + handCenterOffset.x,
                letterCenterPosition.y + handCenterOffset.y,
                0,
            ),
        );
        this.guideHandNode.setPosition(handNodePositions[0]);
        /** 引导手循环补间。 */
        let handTween: Tween<Node> = tween(this.guideHandNode)
            .call((): void => {
                this.clearGuideSelectedLetters();
                this.traceGraphics?.clear();
                this.guideTraceTargetIndex = 0;
                this.isGuidePreviewAnimating = true;
                this.guideHandNode?.setPosition(handNodePositions[0]);
                this.setGuideLetterSelected(0, true);
                Tween.stopAllByTarget(handOpacity);
                tween(handOpacity)
                    .to(0.3, { opacity: 255 }, { easing: "sineIn" })
                    .start();
            })
            .delay(0.3)
            .delay(0.5);
        handNodePositions.slice(1).forEach((handNodePosition: Vec3, positionIndex: number): void => {
            /** 当前移动段的目标路径索引。 */
            const targetPathIndex: number = positionIndex + 1;
            handTween = handTween
                .call((): void => {
                    this.guideTraceTargetIndex = targetPathIndex;
                })
                .to(0.5, { position: handNodePosition }, { easing: "sineInOut" })
                .call((): void => {
                    this.setGuideLetterSelected(targetPathIndex, true);
                });
        });
        /** 到达末字母后隐藏一秒，再从首字母开始下一轮。 */
        handTween
            .call((): void => {
                Tween.stopAllByTarget(handOpacity);
                tween(handOpacity)
                    .to(0.3, { opacity: 0 }, { easing: "sineOut" })
                    .start();
            })
            .delay(0.3)
            .call((): void => {
                this.isGuidePreviewAnimating = false;
                this.clearGuideSelectedLetters();
                this.traceGraphics?.clear();
            })
            .delay(1)
            .union()
            .repeatForever()
            .start();
    }

    /** 按引导手指尖的实时位置绘制逐步增长的实线。 */
    private redrawGuideTraceProgress(): void {
        if (
            !this.traceGraphics
            || !this.guideHandNode
            || this.guideTraceTargetIndex <= 0
            || this.guideLetterCenterPositions.length < 2
        ) {
            return;
        }

        this.traceGraphics.clear();
        this.traceGraphics.strokeColor = SELECTION_COLOR;
        this.traceGraphics.lineWidth = TRACE_LINE_WIDTH;
        this.traceGraphics.lineCap = Graphics.LineCap.ROUND;
        this.traceGraphics.lineJoin = Graphics.LineJoin.ROUND;
        /** 引导路径的首个字母中心。 */
        const firstPosition: Vec3 = this.guideLetterCenterPositions[0];
        this.traceGraphics.moveTo(firstPosition.x, firstPosition.y);
        for (let pathIndex: number = 1; pathIndex < this.guideTraceTargetIndex; pathIndex += 1) {
            /** 已经完整经过的字母中心。 */
            const completedPosition: Vec3 = this.guideLetterCenterPositions[pathIndex];
            this.traceGraphics.lineTo(completedPosition.x, completedPosition.y);
        }
        /** 当前指尖在字盘中的实时位置。 */
        const fingerPosition: Vec3 = new Vec3(
            this.guideHandNode.position.x - this.guideHandCenterOffset.x,
            this.guideHandNode.position.y - this.guideHandCenterOffset.y,
            0,
        );
        this.traceGraphics.lineTo(fingerPosition.x, fingerPosition.y);
        this.traceGraphics.stroke();
    }

    /** 设置引导路径中指定字母的选中圆、文字颜色和缩放。 */
    private setGuideLetterSelected(pathIndex: number, selected: boolean): void {
        /** 当前路径位置对应的字盘字母索引。 */
        const letterIndex: number | undefined = this.guideLetterIndices[pathIndex];
        if (letterIndex === undefined) {
            return;
        }
        /** 当前字母的选中圆节点。 */
        const highlightNode: Node | undefined = this.wheelLetterHighlights[letterIndex];
        /** 当前字母标签。 */
        const letterLabel: Label | undefined = this.wheelLetterLabels[letterIndex];
        /** 当前字母节点。 */
        const letterNode: Node | undefined = this.wheelLetterNodes[letterIndex];
        if (highlightNode) {
            highlightNode.active = selected;
        }
        if (letterLabel) {
            letterLabel.color = selected
                ? new Color(255, 255, 255, 255)
                : new Color(0, 0, 0, 255);
        }
        letterNode?.setScale(selected ? new Vec3(1.2, 1.2, 1) : Vec3.ONE);
    }

    /** 清除一轮引导中已经依次点亮的字母。 */
    private clearGuideSelectedLetters(): void {
        this.guideLetterIndices.forEach((_letterIndex: number, pathIndex: number): void => {
            this.setGuideLetterSelected(pathIndex, false);
        });
    }

    /** 终止引导预览并释放路径缓存，不影响玩家正在进行的真实连线。 */
    private clearGuidePreviewVisuals(): void {
        this.isGuidePreviewAnimating = false;
        this.guideTraceTargetIndex = 0;
        this.clearGuideSelectedLetters();
        this.guideLetterCenterPositions.length = 0;
        this.guideLetterIndices.length = 0;
        if (!this.isTracing) {
            this.traceGraphics?.clear();
        }
    }

    /** 循环播放独立下载图标原地缩放的呼吸动画。 */
    private startDownloadIconAnimation(): void {
        if (!this.downloadNode) {
            return;
        }

        Tween.stopAllByTarget(this.downloadNode);
        this.downloadNode.setScale(Vec3.ONE);
        tween(this.downloadNode)
            .to(0.58, { scale: new Vec3(1.07, 1.07, 1) }, { easing: "sineInOut" })
            .to(0.58, { scale: Vec3.ONE }, { easing: "sineInOut" })
            .union()
            .repeatForever()
            .start();
    }

    /** 创建通用二维节点并设置尺寸。 */
    private createUiNode(
        name: string,
        parent: Node | null,
        width: number,
        height: number,
    ): Node {
        /** 新建的 UI 节点。 */
        const node: Node = new Node(name);
        node.layer = UI_LAYER;
        /** 新节点的尺寸组件。 */
        const transform: UITransform = node.addComponent(UITransform);
        transform.setContentSize(width, height);
        parent?.addChild(node);
        return node;
    }

    /** 创建统一样式的文本标签。 */
    private createLabel(
        name: string,
        parent: Node,
        text: string,
        fontSize: number,
        color: Color,
        width: number,
        height: number,
    ): Label {
        /** 标签节点。 */
        const labelNode: Node = this.createUiNode(name, parent, width, height);
        /** 标签组件。 */
        const label: Label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.ceil(fontSize * 1.2);
        label.color = color;
        label.horizontalAlign = HorizontalTextAlignment.CENTER;
        label.verticalAlign = VerticalTextAlignment.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        return label;
    }

    /** 异步加载 resources 下的 SpriteFrame 并创建固定尺寸精灵。 */
    private createSpriteNode(
        name: string,
        parent: Node,
        resourcePath: string,
        width: number,
        height: number,
    ): Node {
        /** 精灵节点。 */
        const spriteNode: Node = this.createUiNode(name, parent, width, height);
        /** 精灵组件。 */
        const sprite: Sprite = spriteNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;

        /** 加载素材并绑定到当前精灵。 */
        resources.load(resourcePath, SpriteFrame, (error: Error | null, spriteFrame: SpriteFrame): void => {
            if (error) {
                console.error(`[Playable] 素材加载失败: ${resourcePath}`, error);
                return;
            }
            if (!spriteNode.isValid) {
                return;
            }
            sprite.spriteFrame = spriteFrame;
        });
        return spriteNode;
    }
}
