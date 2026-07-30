import { _decorator, Color, Component, Label, Node, Tween, Vec3, tween } from "cc";

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
        this.setSelected(false);
        if (this.letterLabel) {
            this.letterLabel.string = letter;
        }
    }

    /** 设置字母是否处于选中状态。 */
    public setSelected(selected: boolean): void {
        if (this.highlightNode) {
            this.highlightNode.active = selected;
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
                .to(0.08, { scale: new Vec3(1.08, 1.08, 1) })
                .start();
        }
    }

    /** 返回当前显示的字母。 */
    public getLetter(): string {
        return this.letterLabel?.string ?? "";
    }
}
