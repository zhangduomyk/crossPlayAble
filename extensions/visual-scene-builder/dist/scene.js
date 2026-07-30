"use strict";

const { join } = require("path");

/** 场景生成实现模块的绝对路径。 */
const IMPLEMENTATION_PATH = join(__dirname, "scene-builder-impl.js");

/** 扩展场景进程公开方法。 */
exports.methods = {
    /**
     * 每次执行菜单时重新载入生成实现，使布局和样式修改无需重启编辑器。
     */
    async buildVisualScene() {
        /** 当前实现模块在 Node.js 中的解析路径。 */
        const resolvedImplementationPath = require.resolve(IMPLEMENTATION_PATH);
        delete require.cache[resolvedImplementationPath];
        /** 本次菜单操作使用的最新生成实现。 */
        const implementation = require(resolvedImplementationPath);
        return implementation.methods.buildVisualScene();
    },
};
