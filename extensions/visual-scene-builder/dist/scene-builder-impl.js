"use strict";

/** 可视化场景生成的可热加载实现。 */
const { join } = require("path");
module.paths.push(join(Editor.App.path, "node_modules"));

/** UI 层枚举值。 */
const UI_LAYER = 1 << 25;
/** 当前可视化场景生成版本。 */
const VISUAL_BUILD_VERSION = 5;

/** 扩展场景进程公开方法。 */
exports.methods = {
    /** 创建编辑器可见的完整试玩界面，并把引用写入主控制器。 */
    async buildVisualScene() {
        const {
            assetManager,
            Color,
            director,
            Graphics,
            HorizontalTextAlignment,
            instantiate,
            js,
            Label,
            Node,
            Prefab,
            Sprite,
            SpriteFrame,
            UITransform,
            Vec3,
            VerticalTextAlignment,
        } = require("cc");
        /** Prefab 实例属性覆盖数据类型。 */
        const { PropertyOverrideInfo, TargetInfo } = Prefab._utils;

        /** 当前打开的场景。 */
        const scene = director.getScene();
        /** 当前场景的 Canvas 节点。 */
        const canvas = scene && scene.getChildByName("Canvas");
        if (!canvas) {
            throw new Error("当前场景中未找到 Canvas 节点。");
        }

        /** 使用编辑器资产 UUID 加载指定类型资源。 */
        const loadAsset = (uuid) => new Promise((resolve, reject) => {
            /** 编辑器资源加载请求。 */
            const request = { uuid };
            assetManager.loadAny(request, (error, asset) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(asset);
            });
        });

        /** 可复用圆角矩形素材。 */
        const roundedFrame = await loadAsset("4f4f3c87-063d-498a-8dc1-cdc86f03522e@f9941");
        /** 可复用圆形素材。 */
        const circleFrame = await loadAsset("f14a583e-c289-4f04-aede-85bf411ee1ed@f9941");
        /** 从需求 PSD 导出的黄色选中框素材。 */
        const yellowSelectionFrame = await loadAsset("a52f0f7b-2141-4aec-b373-d612c870b788@f9941");
        /** 从需求 PSD 导出的轮盘底图素材。 */
        const wheelBackgroundFrame = await loadAsset("cf30b9a8-6c77-4b61-8d76-bcdb0284b6ad@f9941");
        /** 品牌图标素材。 */
        const gameIconFrame = await loadAsset("2fc6e881-feca-4230-90cd-7cb8ce816e43@f9941");
        /** 下载箭头素材。 */
        const downloadFrame = await loadAsset("c1fcbc11-7ef5-47ce-aaeb-d60e22e143e5@f9941");
        /** 引导手素材。 */
        const guideHandFrame = await loadAsset("50d765f0-f081-4e34-a5cc-0f856029ae45@f9941");
        /** Play Now 素材。 */
        const playNowFrame = await loadAsset("5a357a74-3a32-4b26-94fe-ec09ffac138e@f9941");
        /** 单词字格 Prefab。 */
        const wordSlotPrefab = await loadAsset("40ef01ae-ab36-44db-a6b9-e4506950fc7b");
        /** 字盘字母 Prefab。 */
        const wheelLetterPrefab = await loadAsset("32d88757-f222-48fe-b11e-6421af837900");

        /** 设置节点 UI 尺寸。 */
        const setSize = (node, width, height) => {
            /** 节点尺寸组件。 */
            const transform = node.getComponent(UITransform) || node.addComponent(UITransform);
            transform.setContentSize(width, height);
            transform.setAnchorPoint(0.5, 0.5);
        };

        /** 创建标准 UI 节点。 */
        const createNode = (name, parent, width, height, x = 0, y = 0) => {
            /** 新建的 UI 节点。 */
            const node = new Node(name);
            node.layer = UI_LAYER;
            setSize(node, width, height);
            node.setPosition(x, y, 0);
            parent.addChild(node);
            return node;
        };

        /** 创建可在编辑器中显示的精灵节点。 */
        const createSprite = (name, parent, frame, width, height, color, x = 0, y = 0) => {
            /** 精灵根节点。 */
            const node = createNode(name, parent, width, height, x, y);
            /** 精灵组件。 */
            const sprite = node.addComponent(Sprite);
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            /** 通用圆角矩形使用九宫格缩放；PSD 选中框保持完整纹理，避免上下边叠成实心色带。 */
            const usesSlicedScaling = frame === roundedFrame;
            sprite.type = usesSlicedScaling ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
            sprite.color = color;
            setSize(node, width, height);
            return node;
        };

        /** 创建可在编辑器中直接修改的文字节点。 */
        const createLabel = (name, parent, text, fontSize, width, height, color, x = 0, y = 0) => {
            /** 文字根节点。 */
            const node = createNode(name, parent, width, height, x, y);
            /** 文字组件。 */
            const label = node.addComponent(Label);
            label.string = text;
            label.fontSize = fontSize;
            label.lineHeight = fontSize + 6;
            label.color = color;
            label.isBold = true;
            label.horizontalAlign = HorizontalTextAlignment.CENTER;
            label.verticalAlign = VerticalTextAlignment.CENTER;
            label.overflow = Label.Overflow.SHRINK;
            return label;
        };

        /** 为 Prefab 实例记录可持久化的组件属性覆盖。 */
        const addPrefabPropertyOverride = (prefabRoot, targetLocalId, propertyPath, value) => {
            /** 当前 Prefab 实例序列化信息。 */
            const prefabInstance = prefabRoot.prefab && prefabRoot.prefab.instance;
            if (!prefabInstance) {
                throw new Error(`${prefabRoot.name} 缺少 PrefabInstance 数据。`);
            }
            /** 属性覆盖目标信息。 */
            const targetInfo = new TargetInfo();
            targetInfo.localID = [targetLocalId];
            /** 属性覆盖记录。 */
            const overrideInfo = new PropertyOverrideInfo();
            overrideInfo.targetInfo = targetInfo;
            overrideInfo.propertyPath = [propertyPath];
            overrideInfo.value = value;
            prefabInstance.propertyOverrides.push(overrideInfo);
        };

        /** 已生成的可视化根节点。 */
        const oldLayout = canvas.getChildByName("PlayableLayout");
        if (oldLayout) {
            /** 每次菜单执行均替换旧布局，确保最新实现即时生效。 */
            oldLayout.removeFromParent();
            oldLayout.destroy();
        }

        /** 运行时主布局根节点。 */
        const layoutRoot = createNode("PlayableLayout", canvas, 720, 1280);
        layoutRoot.__editorExtras__ = {
            visualBuildVersion: VISUAL_BUILD_VERSION,
        };
        /** 全屏黑色背景节点。 */
        const background = createNode("Background", layoutRoot, 720, 1280);
        /** 运行时背景绘图组件。 */
        const backgroundGraphics = background.addComponent(Graphics);
        backgroundGraphics.fillColor = new Color(0, 0, 0, 255);
        backgroundGraphics.rect(-360, -640, 720, 1280);
        backgroundGraphics.fill();

        /** 单词棋盘根节点。 */
        const board = createNode("WordBoard", layoutRoot, 500, 440, 0, 328);
        board.setScale(1.18, 1.18, 1);
        /** 需要显示的全部单词。 */
        const words = ["RAIN", "FOREST", "FIND", "THANK", "DANGER", "LARGEST"];
        /** 单个字格尺寸。 */
        const slotSize = 60;
        /** 字格间距。 */
        const slotGap = 4;
        /** 所有行的左对齐基准。 */
        const rowLeft = -210;
        /** 单词行组件类型。 */
        const WordRowView = js.getClassByName("WordRowView");
        /** 单词字格组件类型。 */
        const WordSlotView = js.getClassByName("WordSlotView");
        if (!WordRowView || !WordSlotView) {
            throw new Error("WordRowView 或 WordSlotView 尚未完成编译。");
        }
        /** 主控制器需要绑定的单词行组件。 */
        const wordRowViews = [];

        words.forEach((word, rowIndex) => {
            /** 当前行实际宽度。 */
            const rowWidth = word.length * slotSize + (word.length - 1) * slotGap;
            /** 当前行中心坐标。 */
            const rowCenterX = rowLeft + rowWidth / 2;
            /** 当前单词行节点。 */
            const rowNode = createNode(
                `WordRow_${word}`,
                board,
                rowWidth + 48,
                96,
                rowCenterX,
                175 - rowIndex * 76,
            );
            /** 当前行使用 PSD 原始黄色发光选中框。 */
            const glowNode = createNode("ActiveGlow", rowNode, rowWidth + 48, 96);
            createSprite(
                "SelectionFrame",
                glowNode,
                yellowSelectionFrame,
                rowWidth + 48,
                96,
                new Color(255, 255, 255, 255),
            );
            glowNode.active = rowIndex === 1;
            /** 当前行视图组件。 */
            const rowView = rowNode.addComponent(WordRowView);
            rowView.glowNode = glowNode;
            rowView.slotNodes = [];

            for (let slotIndex = 0; slotIndex < 7; slotIndex += 1) {
                /** 当前字格是否已有内容。 */
                const isFilled = rowIndex === 0 || slotIndex === 0;
                /** 当前字格是否属于激活行。 */
                const isActiveRow = rowIndex === 1;
                /** 当前字格初始背景色。 */
                const slotColor = isFilled
                    ? new Color(250, 250, 250, 255)
                    : (isActiveRow
                        ? new Color(103, 73, 75, 255)
                        : new Color(57, 57, 57, 255));
                /** 从 Prefab 实例化的当前字格节点。 */
                const slotNode = instantiate(wordSlotPrefab);
                slotNode.name = `Slot_${slotIndex + 1}`;
                slotNode.parent = rowNode;
                slotNode.setPosition(
                    -rowWidth / 2 + slotSize / 2 + slotIndex * (slotSize + slotGap),
                    0,
                    0,
                );
                /** 编辑器中显示的字格精灵。 */
                const slotSprite = slotNode.getComponent(Sprite);
                if (slotSprite) {
                    slotSprite.color = slotColor;
                }
                /** 当前字格视图组件。 */
                const slotView = slotNode.getComponent(WordSlotView);
                /** 当前字格初始文字。 */
                const slotText = isFilled ? (word[slotIndex] || "") : "";
                /** Prefab 内通过 Inspector 绑定的当前字格标签。 */
                const slotLabel = slotView.letterLabel;
                if (!slotLabel) {
                    throw new Error("word-slot Prefab 未绑定 letterLabel。");
                }
                slotLabel.string = slotText;
                slotView.background = slotSprite;
                slotView.letterLabel = slotLabel;
                slotNode.active = slotIndex < word.length;
                addPrefabPropertyOverride(
                    slotNode,
                    "WordSlotLabel0000001",
                    "_string",
                    slotText,
                );
                addPrefabPropertyOverride(
                    slotNode,
                    "WordSlotSprite0000001",
                    "_color",
                    slotColor,
                );
                if (slotIndex >= word.length) {
                    addPrefabPropertyOverride(
                        slotNode,
                        "WordSlotRoot000000001",
                        "_active",
                        false,
                    );
                }
                rowView.slotNodes.push(slotNode);
            }
            wordRowViews.push(rowView);
        });

        /** 字盘根节点。 */
        const wheel = createNode("LetterWheel", layoutRoot, 470, 470, 0, -289);
        wheel.setScale(1.22, 1.22, 1);
        createSprite(
            "WheelBackground",
            wheel,
            wheelBackgroundFrame,
            430,
            430,
            new Color(255, 255, 255, 255),
        );
        /** 字盘连线节点。 */
        const traceNode = createNode("LetterTrace", wheel, 470, 470);
        /** 字盘连线绘图组件。 */
        const traceGraphics = traceNode.addComponent(Graphics);
        /** 单个字盘字母组件类型。 */
        const WheelLetterView = js.getClassByName("WheelLetterView");
        /** 字盘组件类型。 */
        const LetterWheelView = js.getClassByName("LetterWheelView");
        if (!WheelLetterView || !LetterWheelView) {
            throw new Error("WheelLetterView 或 LetterWheelView 尚未完成编译。");
        }
        /** 字盘中的字母 Prefab 根节点集合。 */
        const wheelLetterNodes = [];
        /** 首关字母。 */
        const firstLetters = Array.from("FOREST");
        for (let letterIndex = 0; letterIndex < 7; letterIndex += 1) {
            /** 当前占位字母的弧度。 */
            const angle = Math.PI / 2 + letterIndex * Math.PI * 2 / firstLetters.length;
            /** 当前占位字母位置。 */
            const letterPosition = new Vec3(
                Math.cos(angle) * 154,
                Math.sin(angle) * 154,
                0,
            );
            /** 从 Prefab 实例化的字母根节点。 */
            const letterNode = instantiate(wheelLetterPrefab);
            letterNode.name = `WheelLetter_${letterIndex + 1}`;
            letterNode.parent = wheel;
            letterNode.setPosition(letterPosition);
            /** 蓝色选中圆节点。 */
            const highlight = letterNode.getChildByName("Highlight");
            highlight.active = false;
            /** 位于选中圆上层的字母标签节点。 */
            const letterLabelNode = letterNode.getChildByName("LetterLabel");
            /** 字母标签。 */
            const letterLabel = letterLabelNode && letterLabelNode.getComponent(Label);
            if (!letterLabel) {
                throw new Error("wheel-letter Prefab 未绑定 LetterLabel。");
            }
            letterLabel.string = firstLetters[letterIndex] || "";
            /** 字母视图组件。 */
            const letterView = letterNode.getComponent(WheelLetterView);
            letterView.highlightNode = highlight;
            letterView.letterLabel = letterLabel;
            letterNode.active = letterIndex < firstLetters.length;
            addPrefabPropertyOverride(
                letterNode,
                "WheelLetterLabel000001",
                "_string",
                firstLetters[letterIndex] || "",
            );
            if (letterIndex >= firstLetters.length) {
                addPrefabPropertyOverride(
                    letterNode,
                    "WheelLetterRoot0000001",
                    "_active",
                    false,
                );
            }
            wheelLetterNodes.push(letterNode);
        }
        /** 引导手节点。 */
        const guideHand = createSprite(
            "GuideHand",
            wheel,
            guideHandFrame,
            145,
            149,
            new Color(255, 255, 255, 255),
            -45,
            5,
        );
        /** 抵消竖屏轮盘整体缩放，保持引导手 PSD 的目标视觉尺寸。 */
        const guideHandScale = 1 / 1.22;
        guideHand.setScale(guideHandScale, guideHandScale, 1);
        /** 字盘视图组件。 */
        const letterWheelView = wheel.addComponent(LetterWheelView);
        letterWheelView.traceGraphics = traceGraphics;
        letterWheelView.guideHandNode = guideHand;
        letterWheelView.letterNodes = wheelLetterNodes;

        /** 开场提示根节点。 */
        const prompt = createNode("IntroPrompt", layoutRoot, 700, 96, 0, 5);
        createSprite(
            "PromptBackground",
            prompt,
            roundedFrame,
            700,
            96,
            new Color(0, 0, 0, 190),
        );
        createLabel(
            "PromptLabel",
            prompt,
            "How old is your brain?",
            72,
            660,
            82,
            new Color(255, 255, 255, 255),
        );
        prompt.setScale(1.05, 1.05, 1);

        /** 蓝色选词横条根节点。 */
        const selectionBanner = createNode("SelectionBanner", layoutRoot, 180, 70, 0, 10);
        createSprite(
            "SelectionBackground",
            selectionBanner,
            roundedFrame,
            180,
            70,
            new Color(24, 125, 174, 255),
        );
        /** 蓝色横条运行时绘图组件。 */
        const selectionGraphics = selectionBanner.addComponent(Graphics);
        /** 当前选词标签。 */
        const selectedWordLabel = createLabel(
            "SelectedWord",
            selectionBanner,
            "F O R",
            44,
            160,
            64,
            new Color(255, 255, 255, 255),
        );
        selectionBanner.active = false;

        /** 圆盘右下角下载箭头。 */
        const downloadButton = createNode("DownloadButton", layoutRoot, 112, 112, 212, -570);
        /** 下载图标节点。 */
        const downloadIcon = createSprite(
            "DownloadIcon",
            downloadButton,
            downloadFrame,
            112,
            112,
            new Color(255, 255, 255, 255),
        );

        /** 页面右下角安装面板。 */
        const installPanel = createNode("InstallPanel", layoutRoot, 260, 72, 210, -594);
        createSprite(
            "DownloadGameIcon",
            installPanel,
            gameIconFrame,
            64,
            64,
            new Color(255, 255, 255, 255),
            -62,
            0,
        );
        /** 安装按钮节点。 */
        const installButton = createNode("InstallButton", installPanel, 160, 68, 58, 0);
        createSprite(
            "InstallBackground",
            installButton,
            roundedFrame,
            160,
            68,
            new Color(0, 169, 132, 255),
        );
        createLabel(
            "InstallLabel",
            installButton,
            "Install",
            32,
            146,
            60,
            new Color(255, 255, 255, 255),
        );

        /** 最终品牌结束页。 */
        const endCard = createNode("EndCard", layoutRoot, 720, 1280);
        /** 结束页品牌图标。 */
        const endCardIcon = createSprite(
            "EndCardGameIcon",
            endCard,
            gameIconFrame,
            120,
            120,
            new Color(255, 255, 255, 255),
            0,
            230,
        );
        endCardIcon.setScale(1.84, 1.84, 1);
        /** 结束页品牌面板。 */
        const brandPanel = createNode("BrandPanel", endCard, 500, 86, 0, 20);
        createSprite(
            "BrandGlow",
            brandPanel,
            roundedFrame,
            500,
            86,
            new Color(165, 255, 246, 255),
        );
        createSprite(
            "BrandBackground",
            brandPanel,
            roundedFrame,
            490,
            76,
            new Color(17, 17, 17, 255),
        );
        createLabel(
            "BrandLabel",
            brandPanel,
            "Crossword Quest",
            38,
            390,
            70,
            new Color(255, 255, 255, 255),
            -22,
            0,
        );
        createLabel(
            "SearchIcon",
            brandPanel,
            "⌕",
            44,
            58,
            58,
            new Color(255, 255, 255, 255),
            205,
            0,
        );
        brandPanel.setScale(1.25, 1.25, 1);
        /** 结束页主按钮。 */
        const playNow = createSprite(
            "PlayNowButton",
            endCard,
            playNowFrame,
            330,
            98,
            new Color(255, 255, 255, 255),
            0,
            -350,
        );
        playNow.setScale(1.08, 1.08, 1);
        endCard.active = false;

        /** 主控制器组件类型。 */
        const PlayableGameView = js.getClassByName("PlayableGameView");
        if (!PlayableGameView) {
            throw new Error("PlayableGameView 尚未完成编译。");
        }
        /** Canvas 上的主控制器组件。 */
        const controller = canvas.getComponent(PlayableGameView)
            || canvas.addComponent(PlayableGameView);
        controller.layoutRoot = layoutRoot;
        controller.backgroundGraphics = backgroundGraphics;
        controller.promptNode = prompt;
        controller.brandNode = brandPanel;
        controller.downloadNode = downloadButton;
        controller.boardNode = board;
        controller.wheelNode = wheel;
        controller.endCardNode = endCard;
        controller.endCardIconNode = endCardIcon;
        controller.playNowNode = playNow;
        controller.traceGraphics = traceGraphics;
        controller.selectedWordLabel = selectedWordLabel;
        controller.selectionBannerNode = selectionBanner;
        controller.selectionBannerGraphics = selectionGraphics;
        controller.guideHandNode = guideHand;
        controller.downloadIconNode = downloadIcon;
        controller.installPanelNode = installPanel;
        controller.wordRowViews = wordRowViews;
        controller.letterWheelView = letterWheelView;

        return {
            layoutNodeCount: layoutRoot.children.length,
            rowCount: wordRowViews.length,
            wheelLetterCount: wheelLetterNodes.length,
        };
    },
};

/** 场景脚本加载回调。 */
exports.load = function load() {};

/** 场景脚本卸载回调。 */
exports.unload = function unload() {};
