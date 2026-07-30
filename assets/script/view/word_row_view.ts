import { _decorator, Component, Node } from "cc";
import { WordSlotView } from "./word_slot_view";

/** Cocos 装饰器工具。 */
const { ccclass, property } = _decorator;

/** 一行单词的可视化组件，复用固定数量的字格节点。 */
@ccclass("WordRowView")
export class WordRowView extends Component {
    /** 当前步骤使用的橙色发光框节点。 */
    @property(Node)
    public glowNode: Node | null = null;

    /** 本行可复用的字格 Prefab 根节点，通过 Inspector 拖拽绑定。 */
    @property([Node])
    public slotNodes: Node[] = [];

    /** 当前行配置的目标单词。 */
    public word: string = "";

    /** 当前行在棋盘中的索引。 */
    public rowIndex: number = -1;

    /** 配置本行单词并按长度启用字格。 */
    public configure(word: string, rowIndex: number): void {
        this.word = word;
        this.rowIndex = rowIndex;
        this.getSlotViews().forEach((slot: WordSlotView, slotIndex: number): void => {
            slot.node.active = slotIndex < word.length;
        });
    }

    /** 获取字格根节点上的视图组件，避免跨 Prefab 组件引用被序列化为空。 */
    public getSlotViews(): WordSlotView[] {
        /** 当前行有效的字格视图组件。 */
        const slotViews: WordSlotView[] = [];
        /** 优先采用 Inspector 数组；跨 Prefab 引用为空时按规范名称发现子节点。 */
        const resolvedSlotNodes: Node[] = this.slotNodes.length > 0
            ? this.slotNodes
            : this.node.children
                .filter((childNode: Node): boolean => childNode.name.startsWith("Slot_"))
                .sort((firstNode: Node, secondNode: Node): number =>
                    firstNode.getSiblingIndex() - secondNode.getSiblingIndex(),
                );
        resolvedSlotNodes.forEach((slotNode: Node): void => {
            /** 当前字格根节点上的视图组件。 */
            const slotView: WordSlotView | null = slotNode.getComponent(WordSlotView);
            if (slotView) {
                slotViews.push(slotView);
            }
        });
        return slotViews;
    }

    /** 设置当前行发光框的显示状态。 */
    public setGlowVisible(visible: boolean): void {
        if (this.glowNode) {
            this.glowNode.active = visible;
        }
    }
}
