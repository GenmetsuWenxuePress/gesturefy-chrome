# Gesturefy for Chrome 🖱️

> **Gesturefy**（[GPL-3.0](LICENSE)，原作者 [Robbendebiene](https://github.com/Robbendebiene)）的 **Chrome 移植版**，向原作者致敬。
> 原版仅支持 Firefox，本移植版让 Chrome 用户也能体验 Gesturefy 的经典鼠标手势。

**[English README](README.md)**

Navigate, operate, and browse faster with mouse gestures! 鼠标手势：按住左/中/右键划动即可执行命令，比快捷键更自然。

## ✨ 功能特性

- 🖱️ 鼠标手势（按住左/中/右键绘制手势触发命令）
- ⚡ 80+ 内置命令：标签页、导航、滚动、缩放、复制粘贴等
- 🎬 **SaveMedia**：保存页面中的视频 / 音频元素
- 🖱️👆 **双击关闭标签页**（可选开关，支持左键/右键）
- 🔄 **手势预设**：Edge / 360 浏览器用户一键迁移习惯手势
- 🎨 可自定义手势轨迹与状态信息样式
- 🔄 Rocker 手势（按住右键点左键等）与滚轮手势
- 📜 自定义用户脚本命令（高级功能）
- 🌓 浅色 / 深色 / 高对比度主题
- 🌐 多语言支持（简体中文 / 繁体中文）

## 🧩 模块化架构

新功能以**独立 content script 模块**（`core/extras/`）形式发布（如双击关闭标签页），
通过 `manifest.json` 挂载——冻结内核 `content.bundle.js` 永不重新打包，
保证经过实战检验的手势引擎完整可用。

## 📦 安装

1. 下载 [Releases](https://github.com/GenmetsuWenxuePress/gesturefy-chrome/releases) 中的 zip
2. Chrome 打开 `chrome://extensions` → 开启「开发者模式」
3. 拖入 zip 或「加载已解压的扩展程序」

## 🔧 从源码构建

```bash
# 需要 Node.js 18+
npm install -g rollup
rollup -c rollup.config.mjs   # 重新生成 core/bundle/content.bundle.js
```

然后加载整个目录即可。

## 📜 许可证与致谢

本项目基于 [Gesturefy](https://github.com/Robbendebiene/Gesturefy)（GPL-3.0）移植，**以 GPL-3.0 许可证发布**，保留原作者全部版权声明。详见 [LICENSE](LICENSE) 与 [NOTICE.md](NOTICE.md)。

- 原项目：https://github.com/Robbendebiene/Gesturefy
- 原版（Firefox）：https://addons.mozilla.org/firefox/addon/gesturefy/

**隐私**：本扩展不收集任何数据，无远程服务器，无统计埋点（与原版一致）。详见[隐私政策](https://genmetsuwenxuepress.github.io/gesturefy-chrome/PRIVACY.html)。

---

*Gesturefy for Chrome — A Chrome port of the Firefox mouse gesture extension Gesturefy (GPL-3.0, by Robbendebiene). Tribute to the original author.*
