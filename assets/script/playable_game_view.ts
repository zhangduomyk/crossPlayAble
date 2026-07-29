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
import {
    initializePlayablePlatform,
    notifyPlayableGameEnd,
    requestPlayableDownload,
    shouldHidePlayableDownload,
} from "./playable_bootstrap";

/** Cocos 装饰器工具。 */
const { ccclass } = _decorator;

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

/** 当前单词发光框颜色。 */
const GLOW_COLOR: Color = new Color(255, 164, 0, 255);

/** 字盘外圈颜色。 */
const WHEEL_BORDER_COLOR: Color = new Color(225, 145, 0, 255);

/** 字盘背景颜色。 */
const WHEEL_BACKGROUND_COLOR: Color = new Color(202, 202, 202, 255);

/** 字母连线、选中圆和组合横条使用的原型蓝色。 */
const SELECTION_COLOR: Color = new Color(24, 125, 174, 255);

/** 标题框发光颜色。 */
const BRAND_GLOW_COLOR: Color = new Color(165, 255, 246, 255);

/** 游戏初始界面组件，负责创建素材节点并处理横竖屏布局。 */
@ccclass("PlayableGameView")
export class PlayableGameView extends Component {
    /** 响应式内容根节点。 */
    private layoutRoot: Node | null = null;

    /** 黑色背景绘图组件。 */
    private backgroundGraphics: Graphics | null = null;

    /** 开场提示节点。 */
    private promptNode: Node | null = null;

    /** 品牌标题节点。 */
    private brandNode: Node | null = null;

    /** 下载入口节点。 */
    private downloadNode: Node | null = null;

    /** 左侧单词面板节点。 */
    private boardNode: Node | null = null;

    /** 右侧字盘节点。 */
    private wheelNode: Node | null = null;

    /** 最终品牌结束页根节点。 */
    private endCardNode: Node | null = null;

    /** 结束页品牌图标节点。 */
    private endCardIconNode: Node | null = null;

    /** 结束页 Play Now 按钮节点。 */
    private playNowNode: Node | null = null;

    /** 当前创建的字盘字母标签。 */
    private readonly wheelLetterLabels: Label[] = [];

    /** 当前创建的字盘字母选中圆节点。 */
    private readonly wheelLetterHighlights: Node[] = [];

    /** 所有单词行节点，索引零为已完成示例词。 */
    private readonly wordRowNodes: Node[] = [];

    /** 各单词行中的字母标签。 */
    private readonly wordSlotLabels: Label[][] = [];

    /** 各单词行中的字格绘图组件。 */
    private readonly wordSlotGraphics: Graphics[][] = [];

    /** 各待填单词行的发光框节点。 */
    private readonly wordGlowNodes: Node[] = [];

    /** 字盘连线绘图组件。 */
    private traceGraphics: Graphics | null = null;

    /** 当前手势末端在字盘中的局部坐标。 */
    private tracePointer: Vec3 = new Vec3();

    /** 当前连线选中的字母索引。 */
    private readonly selectedLetterIndices: number[] = [];

    /** 字盘上方显示的当前字母组合。 */
    private selectedWordLabel: Label | null = null;

    /** 字盘上方的蓝色组合横条节点。 */
    private selectionBannerNode: Node | null = null;

    /** 字盘上方蓝色组合横条的背景绘图组件。 */
    private selectionBannerGraphics: Graphics | null = null;

    /** PSD 引导手节点。 */
    private guideHandNode: Node | null = null;

    /** PSD 下载箭头节点。 */
    private downloadIconNode: Node | null = null;

    /** 固定在页面右下角的品牌图标和 Install 面板。 */
    private installPanelNode: Node | null = null;

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
        this.createBaseInterface();
        this.applyResponsiveLayout();
        this.bindGameplayInput();
        this.startInitialAnimations();
        view.on("canvas-resize", this.applyResponsiveLayout, this);
    }

    /** 组件销毁时移除屏幕变化监听。 */
    protected onDestroy(): void {
        view.off("canvas-resize", this.applyResponsiveLayout, this);
        this.unbindGameplayInput();
    }

    /** 创建完整的阶段二基础界面。 */
    private createBaseInterface(): void {
        /** 避免编辑器重复加载组件时创建两套节点。 */
        const oldRoot: Node | null = this.node.getChildByName("PlayableLayout");
        oldRoot?.destroy();

        this.layoutRoot = this.createUiNode("PlayableLayout", this.node, 1200, 720);
        this.backgroundGraphics = this.createGraphicsNode("Background", this.layoutRoot, 1200, 720);
        this.promptNode = this.createPrompt();
        this.downloadNode = this.createDownloadButton();
        this.installPanelNode = this.createInstallPanel();
        this.boardNode = this.createWordBoard();
        this.wheelNode = this.createLetterWheel();
        this.selectionBannerNode = this.createSelectionBanner();
        this.endCardNode = this.createEndCard();
        this.endCardNode.active = false;
        this.promptNode.setSiblingIndex(this.layoutRoot.children.length - 1);
        this.downloadNode.setSiblingIndex(this.layoutRoot.children.length - 1);
        this.installPanelNode.setSiblingIndex(this.layoutRoot.children.length - 1);
        this.downloadNode.active = !shouldHidePlayableDownload();
        this.installPanelNode.active = !shouldHidePlayableDownload();
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
        this.downloadNode?.setPosition(450, -230, 0);
        this.downloadNode?.setScale(1, 1, 1);
        this.installPanelNode?.setPosition(475, -315, 0);
        this.installPanelNode?.setScale(1, 1, 1);
        this.boardNode?.setPosition(-250, -20, 0);
        this.boardNode?.setScale(1, 1, 1);
        this.wheelNode?.setPosition(260, -20, 0);
        this.wheelNode?.setScale(1, 1, 1);
        this.selectionBannerNode?.setPosition(260, 240, 0);
        this.selectionBannerNode?.setScale(1, 1, 1);
        this.applyLandscapeEndCardPositions();
    }

    /** 应用竖屏节点位置。 */
    private applyPortraitPositions(): void {
        this.promptNode?.setPosition(0, 5, 0);
        this.promptNode?.setScale(1.05, 1.05, 1);
        this.downloadNode?.setPosition(180, -455, 0);
        this.downloadNode?.setScale(1, 1, 1);
        this.installPanelNode?.setPosition(220, -590, 0);
        this.installPanelNode?.setScale(1, 1, 1);
        this.boardNode?.setPosition(0, 250, 0);
        this.boardNode?.setScale(1.15, 1.15, 1);
        this.wheelNode?.setPosition(0, -250, 0);
        this.wheelNode?.setScale(1, 1, 1);
        this.selectionBannerNode?.setPosition(0, 10, 0);
        this.selectionBannerNode?.setScale(1, 1, 1);
        this.applyPortraitEndCardPositions();
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
        this.endCardIconNode?.setPosition(0, 300, 0);
        this.endCardIconNode?.setScale(1.65, 1.65, 1);
        this.brandNode?.setPosition(0, 80, 0);
        this.brandNode?.setScale(1.12, 1.12, 1);
        this.playNowNode?.setPosition(0, -190, 0);
        this.playNowNode?.setScale(1.18, 1.18, 1);
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

    /** 创建开场提示条。 */
    private createPrompt(): Node {
        /** 提示条根节点。 */
        const promptRoot: Node = this.createUiNode("IntroPrompt", this.layoutRoot!, 700, 96);
        /** 提示条半透明背景。 */
        const promptGraphics: Graphics = promptRoot.addComponent(Graphics);
        promptGraphics.fillColor = new Color(0, 0, 0, 190);
        promptGraphics.roundRect(-350, -48, 700, 96, 12);
        promptGraphics.fill();

        /** 提示文案标签。 */
        const promptLabel: Label = this.createLabel(
            "PromptLabel",
            promptRoot,
            PLAYABLE_CONFIG.introPrompt,
            52,
            new Color(255, 255, 255, 255),
            660,
            82,
        );
        promptLabel.isBold = true;
        return promptRoot;
    }

    /** 创建品牌标题框，文本从统一配置读取。 */
    private createBrandPanel(parent: Node = this.layoutRoot!): Node {
        /** 品牌标题根节点。 */
        const brandRoot: Node = this.createUiNode("BrandPanel", parent, 500, 86);
        /** 品牌标题背景。 */
        const brandGraphics: Graphics = brandRoot.addComponent(Graphics);
        brandGraphics.fillColor = new Color(17, 17, 17, 255);
        brandGraphics.strokeColor = BRAND_GLOW_COLOR;
        brandGraphics.lineWidth = 5;
        brandGraphics.roundRect(-250, -43, 500, 86, 43);
        brandGraphics.fill();
        brandGraphics.stroke();

        /** 游戏名标签。 */
        const brandLabel: Label = this.createLabel(
            "BrandName",
            brandRoot,
            PLAYABLE_CONFIG.brand.gameName,
            43,
            new Color(255, 255, 255, 255),
            390,
            70,
        );
        brandLabel.node.setPosition(-22, 0, 0);

        /** 搜索图标绘图节点。 */
        const searchGraphics: Graphics = this.createGraphicsNode("SearchIcon", brandRoot, 58, 58);
        searchGraphics.strokeColor = new Color(255, 255, 255, 255);
        searchGraphics.lineWidth = 5;
        searchGraphics.circle(-5, 5, 16);
        searchGraphics.stroke();
        searchGraphics.moveTo(7, -7);
        searchGraphics.lineTo(23, -23);
        searchGraphics.stroke();
        searchGraphics.node.setPosition(205, 0, 0);
        return brandRoot;
    }

    /** 创建最终品牌结束页。 */
    private createEndCard(): Node {
        /** 结束页根节点。 */
        const endCardRoot: Node = this.createUiNode("EndCard", this.layoutRoot!, 1200, 720);
        /** 结束页正式品牌图标。 */
        this.endCardIconNode = this.createSpriteNode(
            "EndCardGameIcon",
            endCardRoot,
            `${PLAYABLE_CONFIG.brand.iconResource}/spriteFrame`,
            120,
            120,
        );
        /** 结束页品牌搜索框。 */
        this.brandNode = this.createBrandPanel(endCardRoot);
        /** PSD 中拆出的 Play Now 按钮。 */
        this.playNowNode = this.createSpriteNode(
            "PlayNowButton",
            endCardRoot,
            "playable/ui/play_now/spriteFrame",
            330,
            98,
        );
        this.playNowNode.on(Node.EventType.TOUCH_END, this.handleDownloadRequest, this);
        return endCardRoot;
    }

    /** 创建固定在字盘右下角的下载箭头。 */
    private createDownloadButton(): Node {
        /** 下载箭头根节点。 */
        const downloadRoot: Node = this.createUiNode("DownloadButton", this.layoutRoot!, 90, 90);
        /** PSD 中拆出的下载图标。 */
        const downloadIcon: Node = this.createSpriteNode(
            "DownloadIcon",
            downloadRoot,
            "playable/ui/download_icon/spriteFrame",
            82,
            82,
        );
        downloadIcon.setPosition(0, 0, 0);
        this.downloadIconNode = downloadIcon;
        downloadRoot.on(Node.EventType.TOUCH_END, this.handleDownloadRequest, this);
        return downloadRoot;
    }

    /** 创建固定在页面右下角的品牌图标与 Install 面板。 */
    private createInstallPanel(): Node {
        /** 安装面板根节点。 */
        const installRoot: Node = this.createUiNode("InstallPanel", this.layoutRoot!, 240, 70);
        /** 右下下载区正式品牌图标。 */
        const gameIcon: Node = this.createSpriteNode(
            "DownloadGameIcon",
            installRoot,
            `${PLAYABLE_CONFIG.brand.iconResource}/spriteFrame`,
            58,
            58,
        );
        gameIcon.setPosition(-90, 0, 0);

        /** 安装按钮绘图组件。 */
        const installGraphics: Graphics = this.createGraphicsNode("InstallButton", installRoot, 170, 64);
        installGraphics.fillColor = new Color(0, 169, 132, 255);
        installGraphics.roundRect(-85, -32, 170, 64, 12);
        installGraphics.fill();
        installGraphics.node.setPosition(30, 0, 0);

        /** 安装按钮文案。 */
        const installLabel: Label = this.createLabel(
            "InstallLabel",
            installGraphics.node,
            PLAYABLE_CONFIG.downloadButtonText,
            29,
            new Color(255, 255, 255, 255),
            150,
            56,
        );
        installLabel.node.setPosition(0, 0, 0);
        installRoot.on(Node.EventType.TOUCH_END, this.handleDownloadRequest, this);
        return installRoot;
    }

    /** 创建字盘上方的蓝色当前组合横条。 */
    private createSelectionBanner(): Node {
        /** 当前组合横条根节点。 */
        const bannerRoot: Node = this.createUiNode("SelectionBanner", this.layoutRoot!, 180, 70);
        /** 当前组合横条蓝色背景。 */
        const bannerGraphics: Graphics = bannerRoot.addComponent(Graphics);
        this.selectionBannerGraphics = bannerGraphics;
        bannerGraphics.fillColor = SELECTION_COLOR;
        bannerGraphics.roundRect(-90, -35, 180, 70, 35);
        bannerGraphics.fill();

        /** 当前组合文字标签。 */
        this.selectedWordLabel = this.createLabel(
            "SelectedWord",
            bannerRoot,
            "",
            44,
            new Color(255, 255, 255, 255),
            160,
            64,
        );
        this.selectedWordLabel.isBold = true;
        bannerRoot.active = false;
        return bannerRoot;
    }

    /** 创建包含示例词和五个关卡词的左侧面板。 */
    private createWordBoard(): Node {
        /** 单词面板根节点。 */
        const boardRoot: Node = this.createUiNode("WordBoard", this.layoutRoot!, 500, 440);
        this.wordRowNodes.length = 0;
        this.wordSlotLabels.length = 0;
        this.wordSlotGraphics.length = 0;
        this.wordGlowNodes.length = 0;
        /** 所有需要显示的单词。 */
        const words: string[] = [
            PLAYABLE_CONFIG.completedWord,
            ...PLAYABLE_CONFIG.wordSteps.map((step: WordStepConfig): string => step.word),
        ];

        /** 逐行创建单词格。 */
        words.forEach((word: string, rowIndex: number): void => {
            /** 单个字格尺寸，与单词行创建参数保持一致。 */
            const slotSize: number = 54;
            /** 相邻字格间距，与单词行创建参数保持一致。 */
            const slotGap: number = 7;
            /** 当前单词行的实际宽度。 */
            const rowWidth: number = word.length * slotSize + (word.length - 1) * slotGap;
            /** 所有单词行共用的左侧基准位置。 */
            const rowLeft: number = -210;
            /** 根据行宽换算出的行节点中心位置。 */
            const rowCenterX: number = rowLeft + rowWidth / 2;
            /** 当前单词行节点。 */
            const rowNode: Node = this.createWordRow(word, rowIndex);
            rowNode.setPosition(rowCenterX, 175 - rowIndex * 70, 0);
            boardRoot.addChild(rowNode);
            this.wordRowNodes.push(rowNode);
        });
        return boardRoot;
    }

    /** 创建单行单词格。 */
    private createWordRow(word: string, rowIndex: number): Node {
        /** 单个字格尺寸。 */
        const slotSize: number = 54;
        /** 相邻字格间距。 */
        const slotGap: number = 7;
        /** 当前行的实际宽度。 */
        const rowWidth: number = word.length * slotSize + (word.length - 1) * slotGap;
        /** 当前单词是否已经完成。 */
        const isCompleted: boolean = rowIndex === 0;
        /** 当前单词是否为首个待完成步骤。 */
        const isActive: boolean = rowIndex === 1;
        /** 单词行根节点。 */
        const rowRoot: Node = this.createUiNode(`WordRow_${word}`, null, rowWidth + 22, 68);

        if (!isCompleted) {
            /** 当前步骤橙色发光框节点。 */
            const glowNode: Node = this.createUiNode("ActiveGlow", rowRoot, rowWidth + 22, 68);
            /** 当前步骤橙色发光框。 */
            const glowGraphics: Graphics = glowNode.addComponent(Graphics);
            glowGraphics.strokeColor = GLOW_COLOR;
            glowGraphics.lineWidth = 7;
            glowGraphics.roundRect(-rowWidth / 2 - 8, -32, rowWidth + 16, 64, 12);
            glowGraphics.stroke();
            glowNode.active = isActive;
            this.wordGlowNodes.push(glowNode);
        }

        /** 当前行字母标签集合。 */
        const rowLabels: Label[] = [];
        /** 当前行字格绘图集合。 */
        const rowGraphics: Graphics[] = [];

        /** 逐字创建字格。 */
        Array.from(word).forEach((letter: string, letterIndex: number): void => {
            /** 当前字格节点。 */
            const slotNode: Node = this.createUiNode(`Slot_${letterIndex}`, rowRoot, slotSize, slotSize);
            /** 当前字格背景绘图组件。 */
            const slotGraphics: Graphics = slotNode.addComponent(Graphics);
            /** 当前字格背景颜色。 */
            const slotColor: Color = isCompleted || letterIndex === 0
                ? FILLED_SLOT_COLOR
                : (isActive ? ACTIVE_SLOT_COLOR : SLOT_COLOR);
            slotGraphics.fillColor = slotColor;
            slotGraphics.roundRect(-slotSize / 2, -slotSize / 2, slotSize, slotSize, 8);
            slotGraphics.fill();
            rowGraphics.push(slotGraphics);

            /** 已完成字母或每行首字母标签。 */
            const visibleLetter: string = isCompleted || letterIndex === 0 ? letter : "";
            /** 当前字格字母标签。 */
            const slotLabel: Label = this.createLabel(
                `Letter_${letterIndex}`,
                slotNode,
                visibleLetter,
                38,
                new Color(20, 20, 20, 255),
                slotSize,
                slotSize,
            );
            slotLabel.isBold = true;
            rowLabels.push(slotLabel);

            /** 字格在当前行中的横向位置。 */
            const slotX: number = -rowWidth / 2 + slotSize / 2 + letterIndex * (slotSize + slotGap);
            slotNode.setPosition(slotX, 0, 0);
        });
        this.wordSlotLabels.push(rowLabels);
        this.wordSlotGraphics.push(rowGraphics);
        return rowRoot;
    }

    /** 创建首关字盘、字母和手势素材。 */
    private createLetterWheel(): Node {
        /** 字盘根节点。 */
        const wheelRoot: Node = this.createUiNode("LetterWheel", this.layoutRoot!, 470, 470);
        /** 字盘底图。 */
        const wheelGraphics: Graphics = wheelRoot.addComponent(Graphics);
        wheelGraphics.fillColor = WHEEL_BACKGROUND_COLOR;
        wheelGraphics.strokeColor = WHEEL_BORDER_COLOR;
        wheelGraphics.lineWidth = 8;
        wheelGraphics.circle(0, 0, 215);
        wheelGraphics.fill();
        wheelGraphics.stroke();

        /** 位于字盘底图上方的连线图层。 */
        this.traceGraphics = this.createGraphicsNode("LetterTrace", wheelRoot, 470, 470);

        /** 首个步骤的字盘字母配置。 */
        const firstStep: WordStepConfig = PLAYABLE_CONFIG.wordSteps[0];
        this.createWheelLetters(wheelRoot, firstStep.wheelLetters);

        /** PSD 中拆出的引导手素材。 */
        const guideHand: Node = this.createSpriteNode(
            "GuideHand",
            wheelRoot,
            "playable/ui/guide_hand/spriteFrame",
            145,
            149,
        );
        guideHand.setPosition(-45, 5, 0);
        this.guideHandNode = guideHand;
        return wheelRoot;
    }

    /** 按十二点方向起始、逆时针顺序创建字盘字母。 */
    private createWheelLetters(wheelRoot: Node, letters: string): void {
        /** 上一关遗留的字母节点。 */
        const oldLetterNodes: Node[] = wheelRoot.children.filter((child: Node): boolean =>
            child.name.startsWith("WheelLetter_") || child.name.startsWith("WheelHighlight_"),
        );
        oldLetterNodes.forEach((letterNode: Node): void => {
            letterNode.destroy();
        });
        this.wheelLetterLabels.length = 0;
        this.wheelLetterHighlights.length = 0;
        /** 字母距离字盘中心的半径。 */
        const letterRadius: number = 162;
        /** 字盘字母数组。 */
        const letterList: string[] = Array.from(letters);

        /** 按圆周均匀排布字母。 */
        letterList.forEach((letter: string, letterIndex: number): void => {
            /** 当前字母相对圆心的弧度。 */
            const angle: number = Math.PI / 2 + letterIndex * Math.PI * 2 / letterList.length;
            /** 当前字母在字盘中的位置。 */
            const letterPosition: Vec3 = new Vec3(
                Math.cos(angle) * letterRadius,
                Math.sin(angle) * letterRadius,
                0,
            );
            /** 当前字母的蓝色选中圆节点。 */
            const highlightNode: Node = this.createUiNode(
                `WheelHighlight_${letterIndex}`,
                wheelRoot,
                88,
                88,
            );
            /** 当前字母的蓝色选中圆绘图。 */
            const highlightGraphics: Graphics = highlightNode.addComponent(Graphics);
            highlightGraphics.fillColor = SELECTION_COLOR;
            highlightGraphics.circle(0, 0, 43);
            highlightGraphics.fill();
            highlightNode.setPosition(letterPosition);
            highlightNode.active = false;
            this.wheelLetterHighlights.push(highlightNode);

            /** 当前字母标签。 */
            const letterLabel: Label = this.createLabel(
                `WheelLetter_${letterIndex}`,
                wheelRoot,
                letter,
                76,
                new Color(0, 0, 0, 255),
                96,
                96,
            );
            letterLabel.isBold = true;
            letterLabel.node.setPosition(letterPosition);
            this.wheelLetterLabels.push(letterLabel);
        });
        this.startWheelLetterPulse();
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
    }

    /** 移除字盘连线和首次互动事件。 */
    private unbindGameplayInput(): void {
        this.layoutRoot?.off(Node.EventType.TOUCH_START, this.dismissPrompt, this);
        this.wheelNode?.off(Node.EventType.TOUCH_START, this.handleTraceStart, this);
        this.wheelNode?.off(Node.EventType.TOUCH_MOVE, this.handleTraceMove, this);
        this.wheelNode?.off(Node.EventType.TOUCH_END, this.handleTraceEnd, this);
        this.wheelNode?.off(Node.EventType.TOUCH_CANCEL, this.handleTraceEnd, this);
    }

    /** 首次点击任意位置后关闭开场问题文案。 */
    private dismissPrompt(): void {
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

        /** 触点在字盘中的局部坐标。 */
        const localPosition: Vec3 = this.getWheelLocalPosition(event);
        /** 当前触点命中的字母索引。 */
        const letterIndex: number = this.findLetterIndex(localPosition);
        this.tracePointer.set(localPosition);
        if (letterIndex >= 0) {
            this.trySelectLetter(letterIndex);
        }
        this.redrawLetterTrace();
    }

    /** 处理玩家松手并判定当前组合。 */
    private handleTraceEnd(): void {
        if (!this.isTracing || this.isInputLocked) {
            return;
        }

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
        return this.wheelLetterLabels.findIndex((letterLabel: Label): boolean =>
            Vec3.distance(letterLabel.node.position, localPosition) <= hitRadius,
        );
    }

    /** 将尚未选择的字母加入当前连线。 */
    private trySelectLetter(letterIndex: number): void {
        if (this.selectedLetterIndices.includes(letterIndex)) {
            return;
        }

        this.selectedLetterIndices.push(letterIndex);
        /** 新选中字母的节点。 */
        const letterNode: Node = this.wheelLetterLabels[letterIndex].node;
        /** 新选中字母的蓝色圆节点。 */
        const highlightNode: Node | undefined = this.wheelLetterHighlights[letterIndex];
        if (highlightNode) {
            highlightNode.active = true;
        }
        this.wheelLetterLabels[letterIndex].color = new Color(255, 255, 255, 255);
        Tween.stopAllByTarget(letterNode);
        tween(letterNode)
            .to(0.08, { scale: new Vec3(1.08, 1.08, 1) })
            .start();
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
        const firstPosition: Vec3 = this.wheelLetterLabels[this.selectedLetterIndices[0]].node.position;
        this.traceGraphics.moveTo(firstPosition.x, firstPosition.y);
        this.selectedLetterIndices.slice(1).forEach((letterIndex: number): void => {
            /** 当前选中字母的位置。 */
            const letterPosition: Vec3 = this.wheelLetterLabels[letterIndex].node.position;
            this.traceGraphics?.lineTo(letterPosition.x, letterPosition.y);
        });
        if (this.isTracing) {
            this.traceGraphics.lineTo(this.tracePointer.x, this.tracePointer.y);
        }
        this.traceGraphics.stroke();
    }

    /** 处理错误组合并播放晃动反馈。 */
    private handleWrongWord(): void {
        this.errorCount += 1;
        this.hideGuideHand();
        /** 当前错误是否已经达到结束阈值。 */
        const shouldEndByError: boolean = this.errorCount >= PLAYABLE_CONFIG.maxErrorCount;
        if (shouldEndByError) {
            this.isInputLocked = true;
        }
        if (!this.selectedWordLabel) {
            this.resetTraceState();
            if (shouldEndByError) {
                this.showEndCard("errors");
            }
            return;
        }

        /** 错误组合横条节点。 */
        const feedbackNode: Node = this.selectionBannerNode ?? this.selectedWordLabel.node;
        /** 横条原始位置。 */
        const originalPosition: Vec3 = feedbackNode.position.clone();
        tween(feedbackNode)
            .to(0.06, { position: new Vec3(originalPosition.x - 18, originalPosition.y, 0) })
            .to(0.06, { position: new Vec3(originalPosition.x + 18, originalPosition.y, 0) })
            .to(0.06, { position: new Vec3(originalPosition.x - 12, originalPosition.y, 0) })
            .to(0.06, { position: originalPosition })
            .delay(0.15)
            .call((): void => {
                this.resetTraceState();
                if (shouldEndByError) {
                    this.showEndCard("errors");
                }
            })
            .start();
        this.node.emit("playable-word-error", this.errorCount);
    }

    /** 处理正确单词并推进至下一步骤。 */
    private handleCorrectWord(step: WordStepConfig): void {
        this.isInputLocked = true;
        this.hideGuideHand();
        this.hideSelectionVisuals();
        this.animateWordLanding(step.word);
        this.showPraiseAnimation(step.praise);

        this.scheduleOnce((): void => {
            this.completeCurrentBoardRow(step.word);
        }, 0.55);
        this.scheduleOnce((): void => {
            this.currentStepIndex += 1;
            this.resetTraceState();
            this.advanceToNextStep();
        }, 1.15);
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
        praiseNode.setScale(0.2, 0.2, 1);
        praiseNode.setSiblingIndex(this.layoutRoot.children.length - 1);

        tween(praiseNode)
            .parallel(
                tween().to(0.22, { scale: new Vec3(1.12, 1.12, 1) }, { easing: "backOut" }),
                tween(praiseOpacity).to(0.16, { opacity: 255 }),
            )
            .to(0.1, { scale: new Vec3(0.96, 0.96, 1) }, { easing: "sineIn" })
            .to(0.12, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
            .delay(0.38)
            .parallel(
                tween().to(0.22, { position: new Vec3(
                    praisePosition.x,
                    praisePosition.y + 55,
                    0,
                ) }),
                tween(praiseOpacity).to(0.22, { opacity: 0 }),
            )
            .call((): void => {
                praiseNode.destroy();
            })
            .start();
    }

    /** 将当前目标行填成完整白色单词。 */
    private completeCurrentBoardRow(word: string): void {
        /** 当前目标在单词面板中的行索引。 */
        const rowIndex: number = this.currentStepIndex + 1;
        /** 当前行所有字母标签。 */
        const labels: Label[] = this.wordSlotLabels[rowIndex] ?? [];
        /** 当前行所有字格绘图。 */
        const graphicsList: Graphics[] = this.wordSlotGraphics[rowIndex] ?? [];
        Array.from(word).forEach((letter: string, letterIndex: number): void => {
            /** 当前字格标签。 */
            const letterLabel: Label | undefined = labels[letterIndex];
            /** 当前字格绘图。 */
            const slotGraphics: Graphics | undefined = graphicsList[letterIndex];
            if (!letterLabel || !slotGraphics) {
                return;
            }

            letterLabel.string = letter;
            letterLabel.node.setScale(0.1, 0.1, 1);
            this.redrawSlot(slotGraphics, FILLED_SLOT_COLOR);
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
        /** 下一行所有字格绘图。 */
        const nextGraphics: Graphics[] = this.wordSlotGraphics[nextRowIndex] ?? [];
        nextGraphics.forEach((slotGraphics: Graphics, letterIndex: number): void => {
            this.redrawSlot(
                slotGraphics,
                letterIndex === 0 ? FILLED_SLOT_COLOR : ACTIVE_SLOT_COLOR,
            );
        });
        /** 下一行发光框节点。 */
        const nextGlow: Node | undefined = this.wordGlowNodes[this.currentStepIndex];
        if (nextGlow) {
            nextGlow.active = true;
            this.startActiveGlowPulse(nextGlow);
        }
        this.createWheelLetters(this.wheelNode, nextStep.wheelLetters);
        this.isInputLocked = false;
    }

    /** 显示品牌结束页并通知广告宿主试玩结束。 */
    private showEndCard(reason: "completed" | "errors"): void {
        if (this.isEndCardVisible || !this.endCardNode) {
            return;
        }

        this.isEndCardVisible = true;
        this.isInputLocked = true;
        this.isTracing = false;
        this.hideSelectionVisuals();
        this.promptNode && (this.promptNode.active = false);
        this.boardNode && (this.boardNode.active = false);
        this.wheelNode && (this.wheelNode.active = false);
        this.endCardNode.active = true;
        this.endCardNode.setSiblingIndex(this.layoutRoot!.children.length - 1);

        /**
         * 将下载箭头和安装面板移入结束页前景，避免动态激活结束页后被其后创建的
         * UI 渲染节点覆盖；结束页与主界面坐标原点一致，因此无需换算位置。
         */
        if (this.downloadNode?.parent !== this.endCardNode) {
            this.downloadNode?.removeFromParent();
            this.endCardNode.addChild(this.downloadNode!);
        }
        if (this.installPanelNode?.parent !== this.endCardNode) {
            this.installPanelNode?.removeFromParent();
            this.endCardNode.addChild(this.installPanelNode!);
        }
        this.downloadNode?.setSiblingIndex(this.endCardNode.children.length - 1);
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

    /** 按指定颜色重绘单个圆角字格。 */
    private redrawSlot(slotGraphics: Graphics, color: Color): void {
        /** 字格固定尺寸。 */
        const slotSize: number = 54;
        slotGraphics.clear();
        slotGraphics.fillColor = color;
        slotGraphics.roundRect(-slotSize / 2, -slotSize / 2, slotSize, slotSize, 8);
        slotGraphics.fill();
    }

    /** 清除本轮连线、组合文案和字母选中缩放。 */
    private resetTraceState(): void {
        this.isTracing = false;
        this.hideSelectionVisuals();
        this.selectedLetterIndices.length = 0;
        this.wheelLetterLabels.forEach((letterLabel: Label): void => {
            Tween.stopAllByTarget(letterLabel.node);
            letterLabel.node.setScale(1, 1, 1);
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
        this.wheelLetterLabels.forEach((letterLabel: Label): void => {
            letterLabel.color = new Color(0, 0, 0, 255);
            letterLabel.node.setScale(1, 1, 1);
        });
    }

    /** 隐藏并停止首轮逆时针引导手。 */
    private hideGuideHand(): void {
        if (!this.guideHandNode?.active) {
            return;
        }

        Tween.stopAllByTarget(this.guideHandNode);
        /** 引导手透明度组件。 */
        const handOpacity: UIOpacity = this.guideHandNode.getComponent(UIOpacity)
            ?? this.guideHandNode.addComponent(UIOpacity);
        tween(handOpacity)
            .to(0.18, { opacity: 0 })
            .call((): void => {
                if (this.guideHandNode) {
                    this.guideHandNode.active = false;
                }
            })
            .start();
    }

    /** 启动初始发光框、引导手和下载箭头循环动画。 */
    private startInitialAnimations(): void {
        /** 首个待填单词的发光框。 */
        const firstGlow: Node | undefined = this.wordGlowNodes[0];
        if (firstGlow) {
            this.startActiveGlowPulse(firstGlow);
        }
        this.startGuideHandAnimation();
        this.startDownloadIconAnimation();
    }

    /** 循环播放当前单词发光框呼吸动画。 */
    private startActiveGlowPulse(glowNode: Node): void {
        Tween.stopAllByTarget(glowNode);
        /** 发光框透明度组件。 */
        const glowOpacity: UIOpacity = glowNode.getComponent(UIOpacity)
            ?? glowNode.addComponent(UIOpacity);
        glowOpacity.opacity = 255;
        tween(glowOpacity)
            .to(0.62, { opacity: 110 }, { easing: "sineInOut" })
            .to(0.62, { opacity: 255 }, { easing: "sineInOut" })
            .union()
            .repeatForever()
            .start();
    }

    /** 按十二点起始逆时针顺序循环放大缩小字盘字母。 */
    private startWheelLetterPulse(): void {
        /** 当前字母数量。 */
        const letterCount: number = this.wheelLetterLabels.length;
        this.wheelLetterLabels.forEach((letterLabel: Label, letterIndex: number): void => {
            /** 当前字母节点。 */
            const letterNode: Node = letterLabel.node;
            Tween.stopAllByTarget(letterNode);
            letterNode.setScale(1, 1, 1);
            tween(letterNode)
                .delay(letterIndex * 0.12)
                .to(0.17, { scale: new Vec3(1.18, 1.18, 1) }, { easing: "sineOut" })
                .to(0.17, { scale: new Vec3(1, 1, 1) }, { easing: "sineIn" })
                .delay(Math.max(0.2, (letterCount - letterIndex) * 0.12))
                .union()
                .repeatForever()
                .start();
        });
    }

    /** 循环播放首轮逆时针连线引导手势。 */
    private startGuideHandAnimation(): void {
        if (!this.guideHandNode || this.wheelLetterLabels.length === 0) {
            return;
        }

        /** 引导手透明度组件。 */
        const handOpacity: UIOpacity = this.guideHandNode.getComponent(UIOpacity)
            ?? this.guideHandNode.addComponent(UIOpacity);
        handOpacity.opacity = 255;
        /** 引导手循环补间。 */
        let handTween: Tween<Node> = tween(this.guideHandNode)
            .delay(0.65);
        this.wheelLetterLabels.forEach((letterLabel: Label): void => {
            /** 手势目标位置，略向右下偏移以露出字母。 */
            const targetPosition: Vec3 = new Vec3(
                letterLabel.node.position.x + 34,
                letterLabel.node.position.y - 36,
                0,
            );
            handTween = handTween.to(0.34, { position: targetPosition }, { easing: "sineInOut" });
        });
        handTween
            .delay(0.55)
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

    /** 创建带 Graphics 组件的通用节点。 */
    private createGraphicsNode(
        name: string,
        parent: Node,
        width: number,
        height: number,
    ): Graphics {
        /** 图形节点。 */
        const graphicsNode: Node = this.createUiNode(name, parent, width, height);
        /** 图形绘制组件。 */
        const graphics: Graphics = graphicsNode.addComponent(Graphics);
        return graphics;
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
