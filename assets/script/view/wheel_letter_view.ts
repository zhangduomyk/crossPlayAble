import {
    _decorator,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    Sprite,
    Tween,
    Vec3,
    tween,
} from "cc";

/** Cocos 装饰器工具。 */
const { ccclass, property } = _decorator;

/** 字盘单个字母的可视化组件。 */
@ccclass("WheelLetterView")
export class WheelLetterView extends Component {
    /** 蓝色选中圆节点。 */
    @property(Node)
    public highlightNode: Node | null = null;

    /** 字母标签。 */
    @property(Label)
    public letterLabel: Label | null = null;

    /** 当前字母在字盘配置中的索引。 */
    public letterIndex: number = -1;

    /** 配置字母内容、索引和圆周位置。 */
    public configure(letter: string, letterIndex: number, position: Vec3): void {
        this.letterIndex = letterIndex;
        this.node.active = true;
        this.node.setPosition(position);
        this.ensureHighlightCircle();
        this.setSelected(false);
        if (this.letterLabel) {
            this.letterLabel.string = letter;
        }
    }

    /** 配置深绿色选中圆 Sprite，并关闭未稳定进入渲染队列的矢量方案。 */
    private ensureHighlightCircle(): void {
        if (!this.highlightNode) {
            return;
        }

        /** 蓝色选中圆图片组件。 */
        const highlightSprite: Sprite | null = this.highlightNode.getComponent(Sprite);
        if (highlightSprite) {
            highlightSprite.enabled = true;
            highlightSprite.color = new Color(29, 64, 55, 255);
            highlightSprite.type = Sprite.Type.SIMPLE;
            highlightSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        /** 旧矢量选中圆组件。 */
        const highlightGraphics: Graphics | null = this.highlightNode.getComponent(Graphics);
        if (highlightGraphics) {
            highlightGraphics.enabled = false;
        }
    }

    /** 设置字母是否处于选中状态。 */
    public setSelected(selected: boolean): void {
        if (this.highlightNode) {
            if (selected) {
                this.highlightNode.active = true;
                this.ensureHighlightCircle();
            } else {
                this.highlightNode.active = false;
            }
        }
        if (this.letterLabel) {
            this.letterLabel.color = selected
                ? new Color(255, 255, 255, 255)
                : new Color(0, 0, 0, 255);
        }
        Tween.stopAllByTarget(this.node);
        this.node.setScale(Vec3.ONE);
        if (selected) {
            tween(this.node)
                .to(0.08, { scale: new Vec3(1.2, 1.2, 1) })
                .start();
        }
    }

    /** 返回当前显示的字母。 */
    public getLetter(): string {
        return this.letterLabel?.string ?? "";
    }
}
