/**
 * super-html 运行时接口。
 * @help https://store.cocos.com/app/detail/3657
 * @home https://github.com/magician-f/cocos-playable-demo
 */
interface SuperHtmlRuntime {
    /** Google Play 商店地址。 */
    google_play_url?: string;
    /** App Store 商店地址。 */
    appstore_url?: string;
    /** 触发宿主平台下载行为。 */
    download?: () => void;
    /** 通知宿主平台试玩已经结束。 */
    game_end?: () => void;
    /** 查询是否需要隐藏游戏内下载按钮。 */
    is_hide_download?: () => boolean;
}

declare global {
    interface Window {
        /** super-html 在导出阶段注入的宿主对象。 */
        super_html?: SuperHtmlRuntime;
    }
}

/** super-html 试玩平台桥接器。 */
export class SuperHtmlPlayable {
    /** 触发下载；编辑器预览环境中仅输出日志。 */
    public download(): void {
        const runtime: SuperHtmlRuntime | undefined = window.super_html;
        console.log("[Playable] download");
        runtime?.download?.();
    }

    /** 通知广告宿主试玩流程已经结束。 */
    public gameEnd(): void {
        const runtime: SuperHtmlRuntime | undefined = window.super_html;
        console.log("[Playable] game end");
        runtime?.game_end?.();
    }

    /** 返回当前渠道是否使用平台注入的下载按钮。 */
    public isHideDownload(): boolean {
        const runtime: SuperHtmlRuntime | undefined = window.super_html;
        return runtime?.is_hide_download?.() ?? false;
    }

    /** 设置 Google Play 商店地址。 */
    public setGooglePlayUrl(url: string): void {
        const runtime: SuperHtmlRuntime | undefined = window.super_html;
        if (runtime) {
            runtime.google_play_url = url;
        }
    }

    /** 设置 App Store 商店地址。 */
    public setAppStoreUrl(url: string): void {
        const runtime: SuperHtmlRuntime | undefined = window.super_html;
        if (runtime) {
            runtime.appstore_url = url;
        }
    }
}

/** 全局唯一的试玩平台桥接器。 */
const superHtmlPlayable: SuperHtmlPlayable = new SuperHtmlPlayable();

export default superHtmlPlayable;
