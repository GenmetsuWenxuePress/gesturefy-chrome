# Gesturefy for Chrome — 移植声明 (NOTICE)

## 本扩展是什么

**Gesturefy for Chrome** 是 [Gesturefy](https://github.com/Robbendebiene/Gesturefy)
（v3.2.18，作者 **Robbendebiene**）的 **Chrome 移植版**（Firefox WebExtensions MV2 → Chrome MV3）。

原版 Gesturefy 仅支持 Firefox（[AMO 页面](https://addons.mozilla.org/firefox/addon/gesturefy/)）。
本移植版旨在让 Chrome 用户也能使用 Gesturefy 的鼠标手势功能，是对原作的**致敬与延续**。

## 许可证

- 本项目基于 [GPL-3.0](./LICENSE) 许可发布（与原版一致）。
- 完整许可证文本见包内 `LICENSE` 文件。
- 原项目版权归 Robbendebiene 及其贡献者所有，本移植版保留全部原始版权声明。

## 移植与修改说明

与原版相比的主要改动（为适配 Chrome MV3 环境）：

1. Manifest V2 → V3 迁移（`browser_action` → `action`，background page → service worker）
2. `browser.*` API → `chrome.*` API（移除 webextension-polyfill 依赖）
3. Content script 由 rollup 打包为 `content.bundle.js`（Chrome 不支持 content script 中的 ES module）
4. `browser.tabs.executeScript` → `chrome.scripting.executeScript`（13 处命令迁移）
5. 剪贴板命令修复：MV3 Service Worker 无 Document Focus，改为注入页面执行
6. Service Worker 唤醒竞态修复（等待配置加载完成后再处理手势）
7. 用户脚本功能重写：`cloneInto`/`wrappedJSObject`（Firefox 专有）→ `chrome.scripting.executeScript` MAIN world + API 桥
8. 通知点击监听改为顶层注册（MV3 事件监听要求）
9. 清理 Firefox 专有 API（`mozInnerScreenX` 等）与历史遗留
10. 语言精简为简体中文/繁体中文

## 致谢

感谢 **Robbendebiene** 创作了如此优秀的开源鼠标手势扩展，
也感谢 Gesturefy 的所有[贡献者](https://github.com/Robbendebiene/Gesturefy/graphs/contributors)。

- 原项目：https://github.com/Robbendebiene/Gesturefy
- 原版下载：https://addons.mozilla.org/firefox/addon/gesturefy/

---

*This project is a Chrome port of Gesturefy (GPL-3.0) by Robbendebiene.
All original copyright notices are preserved. This port is released under the same license.*
