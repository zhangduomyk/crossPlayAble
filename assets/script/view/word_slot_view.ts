import { _decorator, Color, Component, Label, Sprite } from "cc";

/** Cocos 装饰器工具。 */
const { ccclass, property } = _decorator;

/** 单词字格的可视化组件，背景与文字节点均通过 Inspector 拖拽绑定。 */
@ccclass("WordSlotView")
export class WordSlotView extends Component {
    /** 字格背景精灵组件。 */
    @property(Sprite)
    public background: Sprite | null = null;

    /** 字格文字标签。 */
    @property(Label)
    public letterLabel: Label | null = null;

    /** 配置字格颜色和显示文字。 */
    public configure(color: Color, letter: string): void {
        this.setBackgroundColor(color);
        if (this.letterLabel) {
            this.letterLabel.string = letter;
        }
    }

    /** 设置字格背景颜色，圆角外形由编辑器 SpriteFrame 保持。 */
    public setBackgroundColor(color: Color): void {
        if (!this.background) {
            return;
        }
        this.background.color = color;
    }
}
