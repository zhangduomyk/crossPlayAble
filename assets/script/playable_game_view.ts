import {
    _decorator,
    Color,
    Component,
    EventTouch,
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

/** 游戏背景颜色。 */
const BACKGROUND_COLOR: Color = new Color(0, 0, 0, 255);

/** 普通未填写字格颜色。 */
const SLOT_COLOR: Color = new Color(57, 57, 57, 255);

/** 当前步骤未填写字格颜色。 */
const ACTIVE_SLOT_COLOR: Color = new Color(103, 73, 75, 255);

/** 已填写字格颜色。 */
const FILLED_SLOT_COLOR: Color = new Color(250, 250, 250, 255);

/** 字母连线、选中圆和组合横条使用的原型蓝色。 */
const SELECTION_COLOR: Color = new Color(24, 125, 174, 255);

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

    /** 字盘上方的蓝色组合横条节点。 */
    @property(Node)
    private selectionBannerNode: Node | null = null;

    /** 字盘上方蓝色组合横条的背景绘图组件。 */
    @property(Graphics)
    private selectionBannerGraphics: Graphics | null = null;

    /** PSD 引导手节点。 */
    @property(Node)
    private guideHandNode: Node | null = null;

    /** 当前引导手需要遍历的目标单词。 */
    private currentGuideTargetWord: string = "";

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

    /** 是否已经显示最终品牌结束页。 */
    private isEndCardVisible: boolean = false;

    /** 组件加载时初始化平台桥接并创建基础界面。 */
    protected onLoad(): void {
        initializePlayablePlatform();
        this.bindEditorInterface();
        this.applyResponsiveLayout();
        this.bindGameplayInput();
        this.startInitialAnimations();
        view.on("canvas-resize", this.applyResponsiveLayout, this);
    }

    /** 组件销毁时移除屏幕变化监听。 */
    protected onDestroy(): void {
        view.off("canvas-resize", this.applyResponsiveLayout, this);
        this.unschedule(this.handleGuideIdleTimeout);
        this.unbindGameplayInput();
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
        /** 棋盘中需要展示的全部单词。 */
        const words: string[] = [
            PLAYABLE_CONFIG.completedWord,
            ...PLAYABLE_CONFIG.wordSteps.map((step: WordStepConfig): string => step.word),
        ];
        this.wordRowViews.forEach((rowView: WordRowView, rowIndex: number): void => {
            /** 当前行目标单词。 */
            const word: string = words[rowIndex] ?? "";
            /** 当前行通过 Prefab 根节点解析出的字格视图。 */
            const slotViews: WordSlotView[] = rowView.getSlotViews();
            rowView.configure(word, rowIndex);
            rowView.setGlowVisible(rowIndex === 1);
            this.wordRowNodes.push(rowView.node);
            this.wordSlotLabels.push(
                slotViews.map((slot: WordSlotView): Label => slot.letterLabel!),
            );
            this.wordSlotBackgrounds.push(
                slotViews.map((slot: WordSlotView): Sprite => slot.background!),
            );
            if (rowIndex > 0 && rowView.glowNode) {
                this.wordGlowNodes.push(rowView.glowNode);
            }
            slotViews.forEach((slot: WordSlotView, letterIndex: number): void => {
                /** 当前字格初始显示的字母。 */
                const visibleLetter: string = rowIndex === 0 || letterIndex === 0
                    ? (word[letterIndex] ?? "")
                    : "";
                /** 当前字格初始背景颜色。 */
                const slotColor: Color = rowIndex === 0 || letterIndex === 0
                    ? FILLED_SLOT_COLOR
                    : (rowIndex === 1 ? ACTIVE_SLOT_COLOR : SLOT_COLOR);
                slot.configure(slotColor, visibleLetter);
            });
        });

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
        this.createWheelLetters(this.wheelNode, firstStep.wheelLetters, firstStep.word, true);
        this.endCardNode && (this.endCardNode.active = false);
        this.selectionBannerNode && (this.selectionBannerNode.active = false);
        this.downloadNode && (this.downloadNode.active = !shouldHidePlayableDownload());
        this.installPanelNode && (this.installPanelNode.active = !shouldHidePlayableDownload());
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

        view.setDesignResolutionSize(designWidth, designHeight, ResolutionPolicy.SHOW_ALL);

        /** 设置 Canvas 尺寸，保证动态节点始终以画布中心为原点。 */
        const canvasTransform: UITransform | null = this.node.getComponent(UITransform);
        canvasTransform?.setContentSize(designWidth, designHeight);

        /** 更新布局根节点尺寸。 */
        const rootTransform: UITransform = this.layoutRoot.getComponent(UITransform)!;
        rootTransform.setContentSize(designWidth, designHeight);
        /** 更新结束页根节点尺寸。 */
        const endCardTransform: UITransform | null = this.endCardNode?.getComponent(UITransform) ?? null;
        endCardTransform?.setContentSize(designWidth, designHeight);
        this.layoutRoot.setPosition(Vec3.ZERO);
        this.layoutRoot.setScale(Vec3.ONE);
        this.redrawBackground(designWidth, designHeight);

        if (isLandscape) {
            this.applyLandscapePositions();
        } else {
            this.applyPortraitPositions();
        }
    }

    /** 应用横屏节点位置。 */
    private applyLandscapePositions(): void {
        this.promptNode?.setPosition(0, 10, 0);
        this.promptNode?.setScale(1, 1, 1);
        this.applyPromptFontSize(52);
        this.downloadNode?.setPosition(450, -230, 0);
        this.downloadNode?.setScale(1, 1, 1);
        this.applyDownloadButtonSize(90, 82);
        this.applyInstallPanelLayout(true);
        this.applyWordBoardLayout(54, 7, 38, 70, 74);
        this.boardNode?.setPosition(-250, -20, 0);
        this.boardNode?.setScale(1, 1, 1);
        this.wheelNode?.setPosition(260, -20, 0);
        this.wheelNode?.setScale(1, 1, 1);
        this.applyWheelLetterFontSize(76);
        this.guideHandNode?.setScale(1, 1, 1);
        this.selectionBannerNode?.setPosition(260, 240, 0);
        this.selectionBannerNode?.setScale(1, 1, 1);
        this.applyLandscapeEndCardPositions();
    }

    /** 应用竖屏节点位置。 */
    private applyPortraitPositions(): void {
        this.promptNode?.setPosition(0, 5, 0);
        this.promptNode?.setScale(1.05, 1.05, 1);
        this.applyPromptFontSize(72);
        this.downloadNode?.setPosition(212, -570, 0);
        this.downloadNode?.setScale(1, 1, 1);
        this.applyDownloadButtonSize(112, 112);
        this.applyInstallPanelLayout(false);
        this.applyWordBoardLayout(60, 4, 48, 76, 80);
        this.boardNode?.setPosition(0, 328, 0);
        this.boardNode?.setScale(1.18, 1.18, 1);
        this.wheelNode?.setPosition(0, -289, 0);
        this.wheelNode?.setScale(1.22, 1.22, 1);
        this.applyWheelLetterFontSize(88);
        /** 轮盘整体放大时抵消引导手缩放，保持 PSD 手的目标尺寸。 */
        const guideHandScale: number = 1 / 1.22;
        this.guideHandNode?.setScale(guideHandScale, guideHandScale, 1);
        this.selectionBannerNode?.setPosition(0, 10, 0);
        this.selectionBannerNode?.setScale(1, 1, 1);
        this.applyPortraitEndCardPositions();
    }

    /** 更新开场问题文案字号。 */
    private applyPromptFontSize(fontSize: number): void {
        /** 开场问题标签。 */
        const promptLabel: Label | null = this.promptNode
            ?.getChildByName("PromptLabel")
            ?.getComponent(Label) ?? null;
        if (!promptLabel) {
            return;
        }
        promptLabel.fontSize = fontSize;
        promptLabel.lineHeight = fontSize + 6;
    }

    /** 更新轮盘全部字符的字号。 */
    private applyWheelLetterFontSize(fontSize: number): void {
        this.wheelLetterLabels.forEach((letterLabel: Label): void => {
            letterLabel.fontSize = fontSize;
            letterLabel.lineHeight = fontSize + 6;
        });
    }

    /** 按方向设置棋盘字格、字体、间距和行高。 */
    private applyWordBoardLayout(
        slotSize: number,
        slotGap: number,
        fontSize: number,
        rowStep: number,
        rowHeight: number,
    ): void {
        /** 棋盘显示的全部单词。 */
        const words: string[] = [
            PLAYABLE_CONFIG.completedWord,
            ...PLAYABLE_CONFIG.wordSteps.map((step: WordStepConfig): string => step.word),
        ];
        /** 所有行共用的左侧对齐位置。 */
        const rowLeft: number = -210;
        this.wordRowViews.forEach((rowView: WordRowView, rowIndex: number): void => {
            /** 当前行目标单词。 */
            const word: string = words[rowIndex] ?? "";
            /** 当前行按照目标间距计算的宽度。 */
            const rowWidth: number = word.length * slotSize
                + Math.max(0, word.length - 1) * slotGap;
            /** 黄色选中框相对字格行增加的横向留边。 */
            const selectionWidth: number = rowWidth + 48;
            /** 黄色选中框相对字格行增加的纵向留边。 */
            const selectionHeight: number = rowHeight + 16;
            /** 当前行尺寸组件。 */
            const rowTransform: UITransform = rowView.node.getComponent(UITransform)!;
            rowTransform.setContentSize(selectionWidth, selectionHeight);
            rowView.node.setPosition(
                rowLeft + rowWidth / 2,
                175 - rowIndex * rowStep,
                0,
            );
            rowView.getSlotViews().forEach((slotView: WordSlotView, slotIndex: number): void => {
                /** 当前字格根节点尺寸组件。 */
                const slotTransform: UITransform = slotView.node.getComponent(UITransform)!;
                /** 当前字格文字尺寸组件。 */
                const labelTransform: UITransform = slotView.letterLabel!
                    .node
                    .getComponent(UITransform)!;
                slotTransform.setContentSize(slotSize, slotSize);
                labelTransform.setContentSize(slotSize, slotSize);
                slotView.letterLabel!.fontSize = fontSize;
                slotView.letterLabel!.lineHeight = fontSize + 6;
                slotView.letterLabel!.isBold = true;
                slotView.node.setPosition(
                    -rowWidth / 2 + slotSize / 2 + slotIndex * (slotSize + slotGap),
                    0,
                    0,
                );
            });
            if (rowView.glowNode) {
                /** 当前行选中框尺寸组件。 */
                const glowTransform: UITransform = rowView.glowNode.getComponent(UITransform)!;
                glowTransform.setContentSize(selectionWidth, selectionHeight);
                /** PSD 选中框精灵节点尺寸组件。 */
                const selectionTransform: UITransform | null = rowView.glowNode
                    .getChildByName("SelectionFrame")
                    ?.getComponent(UITransform) ?? null;
                selectionTransform?.setContentSize(selectionWidth, selectionHeight);
            }
        });
    }

    /** 更新下载圆形按钮和内部图标尺寸。 */
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
        const safeMargin: number = 12;
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
            const landscapeRightOffset: number = 115;
            /** 横屏安装组合相对节点中心的可见下边界。 */
            const landscapeBottomOffset: number = 32;
            this.installPanelNode.setPosition(
                visibleSize.width / 2 - safeMargin - landscapeRightOffset,
                -visibleSize.height / 2 + safeMargin + landscapeBottomOffset,
                0,
            );
            panelTransform.setContentSize(240, 70);
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
        const portraitRightOffset: number = 138;
        /** 竖屏安装组合相对节点中心的可见下边界。 */
        const portraitBottomOffset: number = 34;
        this.installPanelNode.setPosition(
            visibleSize.width / 2 - safeMargin - portraitRightOffset,
            -visibleSize.height / 2 + safeMargin + portraitBottomOffset,
            0,
        );
        panelTransform.setContentSize(260, 72);
        gameIconNode?.setPosition(-62, 0, 0);
        gameIconTransform?.setContentSize(64, 64);
        installButtonNode?.setPosition(58, 0, 0);
        installButtonTransform?.setContentSize(160, 68);
        installBackgroundTransform?.setContentSize(160, 68);
        installLabelTransform?.setContentSize(146, 60);
        if (installLabel) {
            installLabel.fontSize = 32;
            installLabel.lineHeight = 38;
        }
    }

    /** 应用横屏结束页节点位置。 */
    private applyLandscapeEndCardPositions(): void {
        this.endCardIconNode?.setPosition(0, 170, 0);
        this.endCardIconNode?.setScale(1.45, 1.45, 1);
        this.brandNode?.setPosition(0, 25, 0);
        this.brandNode?.setScale(1, 1, 1);
        this.playNowNode?.setPosition(0, -165, 0);
        this.playNowNode?.setScale(1, 1, 1);
    }

    /** 应用竖屏结束页节点位置。 */
    private applyPortraitEndCardPositions(): void {
        this.endCardIconNode?.setPosition(0, 230, 0);
        this.endCardIconNode?.setScale(1.84, 1.84, 1);
        this.brandNode?.setPosition(0, 20, 0);
        this.brandNode?.setScale(1.25, 1.25, 1);
        this.playNowNode?.setPosition(0, -350, 0);
        this.playNowNode?.setScale(1.08, 1.08, 1);
    }

    /** 重绘自适应黑色背景。 */
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
        this.startWheelLetterPulse();
        this.currentGuideTargetWord = targetWord;
        if (showGuideImmediately) {
            this.startGuideHandAnimation(targetWord);
        } else {
            this.scheduleGuideAfterIdle();
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
        /** 当前目标步骤配置。 */
        const currentStep: WordStepConfig | undefined = PLAYABLE_CONFIG.wordSteps[this.currentStepIndex];
        if (!currentStep || selectedWord !== currentStep.word) {
            this.handleWrongWord();
            return;
        }
        this.handleCorrectWord(currentStep);
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

    /** 更新字盘上方蓝色横条中的当前组合文案。 */
    private updateSelectedWordLabel(): void {
        /** 当前手势组成的单词。 */
        const selectedWord: string = this.getSelectedWord();
        /** 根据字母数量扩展横条，短单词也保持足够醒目的宽度。 */
        const bannerWidth: number = Math.max(180, selectedWord.length * 38 + 50);
        if (this.selectedWordLabel) {
            this.selectedWordLabel.string = Array.from(selectedWord).join(" ");
            /** 蓝色横条文字的尺寸组件。 */
            const labelTransform: UITransform = this.selectedWordLabel.node.getComponent(UITransform)!;
            labelTransform.setContentSize(bannerWidth - 20, 64);
        }
        if (this.selectionBannerNode) {
            /** 蓝色横条根节点的尺寸组件。 */
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
        this.traceGraphics.lineWidth = 10;
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
        /** 当前错误是否已经达到结束阈值。 */
        const shouldEndByError: boolean = this.errorCount >= PLAYABLE_CONFIG.maxErrorCount;
        if (shouldEndByError) {
            this.isInputLocked = true;
        }
        this.resetTraceState();
        if (shouldEndByError) {
            this.showEndCard("errors");
        }
        this.node.emit("playable-word-error", this.errorCount);
    }

    /** 处理正确单词并立即推进至下一步骤，反馈动画继续独立播放。 */
    private handleCorrectWord(step: WordStepConfig): void {
        this.isInputLocked = true;
        /** 当前是否完成了最后一个目标单词。 */
        const isFinalWord: boolean = this.currentStepIndex
            >= PLAYABLE_CONFIG.wordSteps.length - 1;
        this.hideGuideHand();
        this.hideSelectionVisuals();
        this.animateWordLanding(step.word);
        this.showPraiseAnimation(step.praise);
        this.completeCurrentBoardRow(step.word);
        this.isTracing = false;
        this.selectedLetterIndices.length = 0;
        this.currentStepIndex += 1;
        if (isFinalWord) {
            /** 等鼓励横幅完整播放并清理后再进入结束页，避免两层内容重叠。 */
            this.scheduleOnce((): void => {
                this.advanceToNextStep();
            }, 1.25);
            return;
        }
        this.advanceToNextStep();
    }

    /** 将正确单词从字盘位置飞入对应的左侧字格。 */
    private animateWordLanding(word: string): void {
        if (!this.layoutRoot || !this.wheelNode || !this.boardNode) {
            return;
        }

        /** 飞行动画文字标签。 */
        const flyingLabel: Label = this.createLabel(
            "FlyingWord",
            this.layoutRoot,
            word,
            48,
            new Color(255, 255, 255, 255),
            360,
            72,
        );
        flyingLabel.isBold = true;
        flyingLabel.node.setPosition(this.wheelNode.position);

        /** 目标单词行节点。 */
        const targetRow: Node = this.wordRowNodes[this.currentStepIndex + 1];
        /** 单词面板当前缩放。 */
        const boardScale: Vec3 = this.boardNode.scale;
        /** 飞行动画终点。 */
        const targetPosition: Vec3 = new Vec3(
            this.boardNode.position.x + targetRow.position.x * boardScale.x,
            this.boardNode.position.y + targetRow.position.y * boardScale.y,
            0,
        );
        tween(flyingLabel.node)
            .parallel(
                tween().to(0.5, { position: targetPosition }, { easing: "quadIn" }),
                tween().to(0.5, { scale: new Vec3(0.7, 0.7, 1) }),
            )
            .call((): void => {
                flyingLabel.node.destroy();
            })
            .start();
    }

    /** 显示与正确单词一一对应的 PSD 鼓励词。 */
    private showPraiseAnimation(praise: string): void {
        if (!this.layoutRoot || !this.wheelNode) {
            return;
        }

        /** 鼓励词资源文件名。 */
        const praiseResourceName: string = praise.toLowerCase();
        /** 鼓励词精灵节点。 */
        const praiseNode: Node = this.createSpriteNode(
            `Praise_${praise}`,
            this.layoutRoot,
            `playable/ui/praise_${praiseResourceName}/spriteFrame`,
            600,
            118,
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
        const rowIndex: number = this.currentStepIndex + 1;
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

            letterLabel.string = letter;
            letterLabel.node.setScale(0.1, 0.1, 1);
            this.setSlotColor(slotBackground, FILLED_SLOT_COLOR);
            tween(letterLabel.node)
                .delay(letterIndex * 0.045)
                .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
                .start();
        });
        /** 当前步骤发光框节点。 */
        const currentGlow: Node | undefined = this.wordGlowNodes[this.currentStepIndex];
        if (currentGlow) {
            currentGlow.active = false;
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

        /** 下一行在单词面板中的索引。 */
        const nextRowIndex: number = this.currentStepIndex + 1;
        /** 下一行所有字格背景。 */
        const nextBackgrounds: Sprite[] = this.wordSlotBackgrounds[nextRowIndex] ?? [];
        nextBackgrounds.forEach((slotBackground: Sprite, letterIndex: number): void => {
            this.setSlotColor(
                slotBackground,
                letterIndex === 0 ? FILLED_SLOT_COLOR : ACTIVE_SLOT_COLOR,
            );
        });
        /** 下一行发光框节点。 */
        const nextGlow: Node | undefined = this.wordGlowNodes[this.currentStepIndex];
        if (nextGlow) {
            nextGlow.active = true;
        }
        this.createWheelLetters(this.wheelNode, nextStep.wheelLetters, nextStep.word);
        this.isInputLocked = false;
    }

    /** 显示品牌结束页并通知广告宿主试玩结束。 */
    private showEndCard(reason: "completed" | "errors"): void {
        if (this.isEndCardVisible || !this.endCardNode) {
            return;
        }

        this.unschedule(this.handleGuideIdleTimeout);
        this.hideGuideHand();
        this.clearPraiseAnimations();
        this.isEndCardVisible = true;
        this.isInputLocked = true;
        this.isTracing = false;
        this.hideSelectionVisuals();
        this.promptNode && (this.promptNode.active = false);
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
        this.startWheelLetterPulse();
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

    /** 隐藏并停止当前逆时针引导手。 */
    private hideGuideHand(): void {
        if (!this.guideHandNode) {
            return;
        }

        Tween.stopAllByTarget(this.guideHandNode);
        /** 引导手透明度组件。 */
        const handOpacity: UIOpacity = this.guideHandNode.getComponent(UIOpacity)
            ?? this.guideHandNode.addComponent(UIOpacity);
        Tween.stopAllByTarget(handOpacity);
        tween(handOpacity)
            .to(0.3, { opacity: 0 }, { easing: "sineOut" })
            .call((): void => {
                if (this.guideHandNode) {
                    this.guideHandNode.active = false;
                }
            })
            .start();
    }

    /** 记录轮盘交互，隐藏手势并从最后一次操作重新计算五秒空闲时间。 */
    private recordPlayerInteraction(): void {
        this.hideGuideHand();
        this.scheduleGuideAfterIdle();
    }

    /** 在玩家连续五秒没有轮盘操作后重新显示当前单词引导。 */
    private scheduleGuideAfterIdle(): void {
        this.unschedule(this.handleGuideIdleTimeout);
        if (this.isEndCardVisible || !this.currentGuideTargetWord) {
            return;
        }
        this.scheduleOnce(this.handleGuideIdleTimeout, 5);
    }

    /** 处理五秒无操作计时结束。 */
    private handleGuideIdleTimeout(): void {
        if (this.isEndCardVisible || this.isTracing || this.isInputLocked) {
            this.scheduleGuideAfterIdle();
            return;
        }
        this.startGuideHandAnimation(this.currentGuideTargetWord);
    }

    /** 启动右下下载箭头循环动画；字盘引导由每轮字母生成时启动。 */
    private startInitialAnimations(): void {
        this.startDownloadIconAnimation();
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
        /** 已加入引导路径的轮盘字母索引。 */
        const usedLetterIndices: number[] = [];
        /** 按目标单词字符顺序解析出的全部手势目标位置。 */
        const targetPositions: Vec3[] = Array.from(targetWord)
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
                return new Vec3(
                    letterNode.position.x + 34,
                    letterNode.position.y - 36,
                    0,
                );
            })
            .filter((targetPosition: Vec3 | null): targetPosition is Vec3 =>
                targetPosition !== null,
            );
        if (targetPositions.length === 0) {
            this.guideHandNode.active = false;
            return;
        }
        this.guideHandNode.setPosition(targetPositions[0]);
        /** 引导手循环补间。 */
        let handTween: Tween<Node> = tween(this.guideHandNode)
            .call((): void => {
                Tween.stopAllByTarget(handOpacity);
                tween(handOpacity)
                    .to(0.3, { opacity: 255 }, { easing: "sineIn" })
                    .start();
            })
            .delay(0.3)
            .delay(0.5);
        targetPositions.slice(1).forEach((targetPosition: Vec3): void => {
            handTween = handTween.to(0.5, { position: targetPosition }, { easing: "sineInOut" });
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
            .delay(1)
            .call((): void => {
                this.guideHandNode?.setPosition(targetPositions[0]);
                Tween.stopAllByTarget(handOpacity);
                handOpacity.opacity = 0;
            })
            .union()
            .repeatForever()
            .start();
    }

    /** 循环播放右下下载箭头上下浮动动画。 */
    private startDownloadIconAnimation(): void {
        if (!this.downloadIconNode) {
            return;
        }

        /** 下载图标初始位置。 */
        const originalPosition: Vec3 = this.downloadIconNode.position.clone();
        tween(this.downloadIconNode)
            .to(0.55, {
                position: new Vec3(originalPosition.x, originalPosition.y - 9, 0),
            }, { easing: "sineInOut" })
            .to(0.55, { position: originalPosition }, { easing: "sineInOut" })
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
