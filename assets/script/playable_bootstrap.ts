import { PLAYABLE_CONFIG } from "./config/playable_config";
import superHtmlPlayable from "./super_html/super_html_playable";

/** 初始化试玩平台配置；游戏入口组件应在 onLoad 阶段调用一次。 */
export function initializePlayablePlatform(): void {
    const googlePlayUrl: string = PLAYABLE_CONFIG.store.googlePlayUrl;
    const appStoreUrl: string = PLAYABLE_CONFIG.store.appStoreUrl;

    superHtmlPlayable.setGooglePlayUrl(googlePlayUrl);
    superHtmlPlayable.setAppStoreUrl(appStoreUrl);
}

/** 触发统一下载行为。 */
export function requestPlayableDownload(): void {
    superHtmlPlayable.download();
}

/** 通知宿主平台试玩流程已经结束。 */
export function notifyPlayableGameEnd(): void {
    superHtmlPlayable.gameEnd();
}

/** 判断游戏内下载按钮是否应该隐藏。 */
export function shouldHidePlayableDownload(): boolean {
    return superHtmlPlayable.isHideDownload();
}
