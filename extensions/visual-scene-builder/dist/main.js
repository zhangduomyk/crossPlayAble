"use strict";

/** 扩展主进程公开方法。 */
exports.methods = {
    /** 调用场景进程构建可视化节点并保存当前场景。 */
    async buildVisualScene() {
        /** 场景脚本调用参数。 */
        const options = {
            name: "visual-scene-builder",
            method: "buildVisualScene",
            args: [],
        };
        /** 场景构建结果。 */
        const result = await Editor.Message.request("scene", "execute-scene-script", options);
        await Editor.Message.request("scene", "save-scene");
        console.log("[visual-scene-builder] 可视化场景已生成并保存。", result);
        return result;
    },
};

/** 扩展加载回调；场景构建仅由菜单显式触发，避免覆盖人工调整。 */
exports.load = function load() {};

/** 扩展卸载回调。 */
exports.unload = function unload() {};
