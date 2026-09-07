import {
    _decorator,
    Color,
    Component,
    HorizontalTextAlignment,
    Label,
    Layers,
    Node,
    Sprite,
    SpriteFrame,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    VerticalTextAlignment,
    resources,
    tween,
} from "cc";

/** Cocos 组件装饰器。 */
const { ccclass } = _decorator;

/** PSD 灯泡提示按钮，负责次数显示和蓝星反馈，提示目标由主玩法决定。 */
@ccclass("HintButtonView")
export class HintButtonView extends Component {
    /** 提示按钮剩余的可使用次数。 */
    private remainingUses: number = 3;

    /** 主玩法是否允许当前发起提示。 */
    private isRequestAllowed: boolean = true;

    /** 点击按钮后交给主玩法进行输入锁与可提示字格检查的回调。 */
    private onRequested: (() => void) | null = null;

    /** PSD 灯泡正常状态图片。 */
    private buttonSprite: Sprite | null = null;

    /** 灯泡正常状态的 PSD SpriteFrame。 */
    private activeButtonFrame: SpriteFrame | null = null;

    /** 灯泡耗尽状态的 PSD SpriteFrame。 */
    private disabledButtonFrame: SpriteFrame | null = null;

    /** 提示次数红色徽标节点。 */
    private badgeNode: Node | null = null;

    /** 红色徽标中的提示次数标签。 */
    private badgeLabel: Label | null = null;

    /** 蓝色星星粒子使用的 PSD SpriteFrame。 */
    private starFrame: SpriteFrame | null = null;

    /** 返回当前剩余次数，便于主玩法安排自动提示和后续引导。 */
    public get remaining(): number {
        return this.remainingUses;
    }

    /** 返回按钮当前是否可以消费一次提示。 */
    public get available(): boolean {
        return this.isRequestAllowed && this.remainingUses > 0;
    }

    /** 创建 PSD 按钮与徽标；点击回调不会自行扣除次数。 */
    public configure(onRequested: () => void, initialUses: number = 3): void {
        this.onRequested = onRequested;
        this.remainingUses = Math.max(0, Math.floor(initialUses));
        this.isRequestAllowed = true;
        this.createVisuals();
        this.node.off(Node.EventType.TOUCH_END, this.handleRequested, this);
        this.node.on(Node.EventType.TOUCH_END, this.handleRequested, this);
        this.refreshVisuals();
    }

    /** 主玩法确认有可提示字格后消费一次；耗尽后按钮透明并隐藏次数徽标。 */
    public consume(): boolean {
        if (!this.available) {
            return false;
        }
        this.remainingUses -= 1;
        this.refreshVisuals();
        return true;
    }

    /** 控制输入锁或结算期间能否请求提示，不改变次数和原稿颜色。 */
    public setAvailable(available: boolean): void {
        this.isRequestAllowed = available;
    }

    /** 在给定父节点的局部坐标处播放一次 PSD 蓝星向外散开动画。 */
    public burstAt(parent: Node, position: Vec3): void {
        if (!parent.isValid) {
            return;
        }
        /** 固定本次目标坐标，避免异步加载期间调用方改写向量。 */
        const burstPosition: Vec3 = position.clone();
        if (this.starFrame) {
            this.createStarBurst(parent, burstPosition, this.starFrame);
            return;
        }
        resources.load(
            "playable/psd/hint-star/spriteFrame",
            SpriteFrame,
            (error: Error | null, starFrame: SpriteFrame): void => {
                if (error || !this.isValid || !parent.isValid) {
                    return;
                }
                this.starFrame = starFrame;
                this.createStarBurst(parent, burstPosition, starFrame);
            },
        );
    }

    /** 组件销毁时移除按钮事件。 */
    protected onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_END, this.handleRequested, this);
        this.onRequested = null;
    }

    /** 收到真实点击后通知主玩法，消费仅由主玩法确认后调用。 */
    private handleRequested(): void {
        if (this.available) {
            this.onRequested?.();
        }
    }

    /** 首次配置时创建固定结构，重复配置只重置状态。 */
    private createVisuals(): void {
        if (this.buttonSprite) {
            return;
        }
        this.node.layer = Layers.Enum.UI_2D;
        /** 灯泡根节点的可点击尺寸组件。 */
        const rootTransform: UITransform = this.node.getComponent(UITransform)
            ?? this.node.addComponent(UITransform);
        rootTransform.setContentSize(120, 120);
        /** 使用 PSD 原始颜色的灯泡图片节点。 */
        const buttonNode: Node = this.createUiNode("HintButtonImage", this.node, 120, 118.63);
        this.buttonSprite = buttonNode.addComponent(Sprite);
        this.buttonSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.buttonSprite.color = new Color(255, 255, 255, 255);
        buttonNode.addComponent(UIOpacity);

        this.badgeNode = this.createUiNode("HintCountBadge", this.node, 39.09, 39.09);
        this.badgeNode.setPosition(45.94, -39.77, 0);
        /** 红色次数徽标图片组件。 */
        const badgeSprite: Sprite = this.badgeNode.addComponent(Sprite);
        badgeSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        badgeSprite.color = new Color(255, 255, 255, 255);
        /** 次数文字单独置于徽标上方，始终只显示三、二、一。 */
        const labelNode: Node = this.createUiNode("HintCountLabel", this.badgeNode, 44, 44);
        this.badgeLabel = labelNode.addComponent(Label);
        this.badgeLabel.fontSize = 29;
        this.badgeLabel.lineHeight = 40;
        this.badgeLabel.isBold = true;
        this.badgeLabel.color = new Color(255, 255, 255, 255);
        this.badgeLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
        this.badgeLabel.verticalAlign = VerticalTextAlignment.CENTER;

        this.loadButtonFrame("playable/psd/hint-button/spriteFrame", false);
        this.loadButtonFrame("playable/psd/hint-button-disabled/spriteFrame", true);
        resources.load(
            "playable/psd/hint-badge/spriteFrame",
            SpriteFrame,
            (error: Error | null, badgeFrame: SpriteFrame): void => {
                if (!error && badgeSprite.isValid) {
                    badgeSprite.spriteFrame = badgeFrame;
                    badgeSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                }
            },
        );
        resources.load(
            "playable/psd/hint-star/spriteFrame",
            SpriteFrame,
            (error: Error | null, starFrame: SpriteFrame): void => {
                if (!error && this.isValid) {
                    this.starFrame = starFrame;
                }
            },
        );
    }

    /** 加载正常或耗尽灯泡并立即刷新当前次数对应的状态。 */
    private loadButtonFrame(resourcePath: string, disabled: boolean): void {
        resources.load(resourcePath, SpriteFrame, (error: Error | null, frame: SpriteFrame): void => {
            if (error || !this.isValid) {
                return;
            }
            if (disabled) {
                this.disabledButtonFrame = frame;
            } else {
                this.activeButtonFrame = frame;
            }
            this.refreshVisuals();
        });
    }

    /** 用 PSD 状态资源刷新灯泡，并在耗尽时隐藏整个徽标而非显示零。 */
    private refreshVisuals(): void {
        /** 当前次数是否已经全部耗尽。 */
        const isExhausted: boolean = this.remainingUses <= 0;
        if (this.badgeNode) {
            this.badgeNode.active = !isExhausted;
        }
        if (this.badgeLabel) {
            this.badgeLabel.string = String(this.remainingUses);
        }
        if (!this.buttonSprite) {
            return;
        }
        /** 优先完整保留 PSD 耗尽状态中的原始透明度。 */
        const desiredFrame: SpriteFrame | null = isExhausted
            ? this.disabledButtonFrame ?? this.activeButtonFrame
            : this.activeButtonFrame;
        if (desiredFrame) {
            this.buttonSprite.spriteFrame = desiredFrame;
            this.buttonSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        /** 禁用素材尚未到达时，使用正常素材透明显示作为临时状态。 */
        const buttonOpacity: UIOpacity | null = this.buttonSprite.node.getComponent(UIOpacity);
        if (buttonOpacity) {
            buttonOpacity.opacity = isExhausted && !this.disabledButtonFrame ? 85 : 255;
        }
    }

    /** 创建一个带二维尺寸组件的 UI 子节点。 */
    private createUiNode(name: string, parent: Node, width: number, height: number): Node {
        /** 当前创建的 UI 节点。 */
        const uiNode: Node = new Node(name);
        uiNode.layer = Layers.Enum.UI_2D;
        uiNode.addComponent(UITransform).setContentSize(width, height);
        parent.addChild(uiNode);
        return uiNode;
    }

    /** 使用原稿蓝星生成错落的径向粒子，播放结束后自动清理节点。 */
    private createStarBurst(parent: Node, position: Vec3, starFrame: SpriteFrame): void {
        /** 每次提示产生的星星数量。 */
        const starCount: number = 14;
        for (let starIndex: number = 0; starIndex < starCount; starIndex += 1) {
            /** 当前星星在径向发散中的角度。 */
            const angle: number = starIndex * Math.PI * 2 / starCount + 0.2;
            /** 使用三档距离形成有层次的散开效果。 */
            const distance: number = 62 + (starIndex % 3) * 23;
            /** 当前蓝星的独立动画节点。 */
            const starNode: Node = this.createUiNode(`HintStar_${starIndex}`, parent, 27, 27);
            starNode.setPosition(position);
            starNode.setScale(0.25, 0.25, 1);
            /** 当前蓝星的 PSD 图片组件。 */
            const starSprite: Sprite = starNode.addComponent(Sprite);
            starSprite.spriteFrame = starFrame;
            starSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            starSprite.color = new Color(255, 255, 255, 255);
            /** 当前蓝星的透明度组件。 */
            const starOpacity: UIOpacity = starNode.addComponent(UIOpacity);
            /** 当前蓝星在父节点坐标系中的最终落点。 */
            const targetPosition: Vec3 = new Vec3(
                position.x + Math.cos(angle) * distance,
                position.y + Math.sin(angle) * distance,
                0,
            );
            tween(starNode)
                .parallel(
                    tween().to(0.55, { position: targetPosition }, { easing: "quadOut" }),
                    tween().to(0.12, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
                        .to(0.43, { scale: new Vec3(0.45, 0.45, 1) }),
                    tween().to(0.55, { angle: starIndex % 2 === 0 ? 125 : -125 }),
                )
                .call((): void => {
                    Tween.stopAllByTarget(starOpacity);
                    starNode.destroy();
                })
                .start();
            tween(starOpacity).delay(0.2).to(0.35, { opacity: 0 }).start();
        }
    }
}
