# Cross 20260904 实现与核验

在现有 `0904` 分支上实现。需求来源为用户提供的 6 页 PDF、目标 HTML、`试玩素材.psd`，用户在本次任务中确认：

- 完整演示 ROSES 连线后，自动点击灯泡一次，提示次数 3 → 2；后续由玩家使用。
- 保留项目现有品牌标题。后续用户修正底部入口为 PSD 黄色 PLAY NOW，竖屏右下、横屏中下，按竞品呼吸；结束页隐藏常驻入口。
- 新 PSD 宣传语与 PLAY NOW 用于跳商店后的结束页；第二词直接请求商店。

## 行为

- 字盘顺时针为 R、O、S、E、S；两个 S 是不同节点，支持回退上一节点，取消触摸不提交。
- 首词 ROSES；第二词可为 SORES、ROES、SERS、ROSE、SORE、SOS 中任意一个。
- 棋盘严格按 PDF 第 4 页坐标构成 8 列、6 行的交叉结构，交叉格共用同一节点。
- 收藏词按 PDF 第 6 页，共 14 个；重复/收藏黄光，非法组合红光。均不增加完成数。
- 灯泡从尚未显示的唯一字格中随机揭示字母，蓝色 PSD 五角星扩散、黄色边光；耗尽后显示 PSD 半透明灯泡并隐藏次数角标。
- 初始静音；真实用户触摸后启动 BGM 和音效。自动演示不解锁音频。
- 第一词完成后不再显示手势引导。第二次正确提交立即调用现有平台下载桥接，只触发一次；保留字母落位与鼓励动画后显示结束页。
- 不启动旧版倒计时或开场遮罩。背景按正方形素材 cover，花瓣循环。
- 横竖屏采用竞品 `min(W/640,H/960)` / `min(W/960,H/640)` 缩放，棋盘与轮盘使用竞品相对屏幕中心位置。自有品牌较竞品标题更高，横屏按其固有比例缩小以避免覆盖棋盘。

## PSD 对应

所有可对应的 UI 素材均通过 Photoshop CC 2019 原生导出副本，不修改源 PSD；文字、智能对象、图层效果栅格化后导出。栅格化前后文字区域像素一致；空字格边缘 36 像素 RGB 存在 1 级差异，alpha 一致。

| PSD 内容 | 项目资源 |
|---|---|
| 玫瑰花园背景 | `rose-background.png` |
| 花瓣、蓝色五角星 | `falling-particle.png`、`hint-star.png` |
| 字盘、选中圆、词条 | `wheel-background.png`、`letter-selected.png`、`selection-banner.png` |
| 空字格 | `crossword-cell-empty.png` |
| 灯泡正常/耗尽、红色次数圆 | `hint-button.png`、`hint-button-disabled.png`、`hint-badge.png` |
| 手、Swipe 提示 | `guide-hand.png`、`swipe-to-form-words.png` |
| 三种鼓励条 | `praise-nice.png`、`praise-brilliant.png`、`praise-spectacular.png` |
| 新宣传语与按钮 | `endcard-tagline.png`、`play-now.png` |
| 下载图标 | `download-icon.png` |

PSD 未提供独立已填字格：`crossword-cell-filled.png` 使用 PSD 空字格轮廓和选中圆原色 `#FF66BA` 派生。动态连线使用同色；F 字样仅为字体样例，实际字母按需求 ROSES 生成。数字按剩余次数生成。PDF 的两次填词鼓励均采用 Spectacular；其他横幅也已换为新 PSD 版本。

PSD 无品牌标题和红黄边光，对应资源保留。旧 Install 组合不再显示；引导手的字盘父层提至灯泡上方，保持原指尖坐标。PNG 已移除冗余元数据并无损重编码，逐图检查 RGBA 完全一致：本次处理资源合计约 7.68 MB → 3.47 MB。

## 已核验与限制

- TypeScript `--noEmit --skipLibCheck` 与 `git diff --check`。
- 真实 Cocos Creator 3.8.5 浏览器预览：自动灯泡 3→2、初始静音、ROSES 实际拖拽、重复词、EROS 收藏词、RS 错误词、提示用尽、SOS 第二词、单次下载请求、结束页，未捕获脚本异常。
- 已查看 390×844、844×390、480×800、768×1024 的预览截图。预览器需切换网页全屏，并设置其实际 frame 尺寸，不能只缩放外层页面。
- 本轮没有完成新的 Web Mobile / SuperHTML 构建。再次启动 Creator 命令行构建被自动审批拦截，返回 `blocked by policy`。已有 `build` 文件不能当作本轮交付。
- 预览验证的是平台下载请求事件；广告 SDK 内的真实商店打开与返回仍需使用新的渠道包核验。

中间分析、PSD 原始导出清单、像素校验结果与截图保存在忽略目录 `temp/0904-analysis`。


## 下载入口最终修正

黄色 PLAY NOW 替换原白色圆形下载入口（downloadNode/downloadIconNode），竖屏右下、横屏中下，按竞品呼吸。icon＋Install 组合（installPanelNode）恢复原素材、右下贴边布局与静止状态，结束页也继续保留。引导手高于灯泡的修正保持。
