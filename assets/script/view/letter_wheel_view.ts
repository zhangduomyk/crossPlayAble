import { _decorator, Component, Graphics, Node, Vec3 } from "cc";
import { WheelLetterView } from "./wheel_letter_view";

/** Cocos 装饰器工具。 */
const { ccclass, property } = _decorator;

/** 字盘的可视化组件，重复字母节点由 Prefab 实例构成。 */
@ccclass("LetterWheelView")
export class LetterWheelView extends Component {
    /** 玩家连线使用的绘图组件。 */
    @property(Graphics)
    public traceGraphics: Graphics | null = null;

    /** 首次操作引导手节点。 */
    @property(Node)
    public guideHandNode: Node | null = null;

    /** 字盘中可复用的字母 Prefab 根节点，通过 Inspector 拖拽绑定。 */
    @property([Node])
    public letterNodes: Node[] = [];

    /** 字母到圆心的布局半径。 */
    private readonly letterRadius: number = 145;

    /** 根据字符串重新配置字盘字母。 */
    public configure(letters: string): void {
        /** 当前关卡的字母数组。 */
        const letterList: string[] = Array.from(letters);
        this.getLetterViews().forEach((letterView: WheelLetterView, letterIndex: number): void => {
            if (letterIndex >= letterList.length) {
                letterView.node.active = false;
                return;
            }

            /** 当前字母相对圆心的弧度。 */
            const angle: number = Math.PI / 2
                + letterIndex * Math.PI * 2 / letterList.length;
            /** 当前字母在字盘中的位置。 */
            const letterPosition: Vec3 = new Vec3(
                Math.cos(angle) * this.letterRadius,
                Math.sin(angle) * this.letterRadius,
                0,
            );
            letterView.configure(letterList[letterIndex], letterIndex, letterPosition);
        });
    }

    /** 清除当前连线和所有选中状态。 */
    public resetSelection(): void {
        this.traceGraphics?.clear();
        this.getLetterViews().forEach((letterView: WheelLetterView): void => {
            if (letterView.node.active) {
                letterView.setSelected(false);
            }
        });
    }

    /** 获取字母根节点上的视图组件，避免跨 Prefab 组件引用被序列化为空。 */
    public getLetterViews(): WheelLetterView[] {
        /** 当前字盘有效的字母视图组件。 */
        const letterViews: WheelLetterView[] = [];
        /** 优先采用 Inspector 数组；跨 Prefab 引用为空时按规范名称发现子节点。 */
        const resolvedLetterNodes: Node[] = this.letterNodes.length > 0
            ? this.letterNodes
            : this.node.children
                .filter((childNode: Node): boolean => childNode.name.startsWith("WheelLetter_"))
                .sort((firstNode: Node, secondNode: Node): number =>
                    firstNode.getSiblingIndex() - secondNode.getSiblingIndex(),
                );
        resolvedLetterNodes.forEach((letterNode: Node): void => {
            /** 当前字母根节点上的视图组件。 */
            const letterView: WheelLetterView | null = letterNode.getComponent(WheelLetterView);
            if (letterView) {
                letterViews.push(letterView);
            }
        });
        return letterViews;
    }
}
