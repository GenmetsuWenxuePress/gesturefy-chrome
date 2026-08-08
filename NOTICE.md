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
3. Content script 打包为 `content.bundle.js`（Chrome 不支持 content script 中的 ES module）；
   该 bundle 为手工修复版本，作为**冻结内核**不再重新打包
4. 新增**模块化扩展目录** `core/extras/`：新功能以独立 content script 模块挂载，
   不修改冻结内核（当前模块：双击关闭标签页）
5. 新增 **SaveMedia** 命令（保存页面视频/音频元素）
6. 新增**手势预设**：Edge 风格 / 360 风格 / 原版风格一键切换
7. 新增**双击关闭标签页**功能（设置页开关，默认关闭）
8. 后台消息协议扩展：`getConfigValue` / `closeTabByDoubleClick`
   （保持同步响应模式，兼容 Chrome MV3 onMessage 语义）
9. 清理 Firefox 专有 API 残留，语言精简为简体中文/繁体中文
10. 移除 `migrate.js`（一次性迁移工具）等非运行时文件

## 致谢

感谢 **Robbendebiene** 创作了如此优秀的开源鼠标手势扩展，
也感谢 Gesturefy 的所有[贡献者](https://github.com/Robbendebiene/Gesturefy/graphs/contributors)。

- 原项目：https://github.com/Robbendebiene/Gesturefy
- 原版下载：https://addons.mozilla.org/firefox/addon/gesturefy/
- 本移植版：https://github.com/GenmetsuWenxuePress/gesturefy-chrome

---

*This project is a Chrome port of Gesturefy (GPL-3.0) by Robbendebiene.
All original copyright notices are preserved. This port is released under the same license.*
