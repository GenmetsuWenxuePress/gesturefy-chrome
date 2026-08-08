# Gesturefy for Chrome 🖱️

> **A Chrome port of [Gesturefy](https://github.com/Robbendebiene/Gesturefy)** ([GPL-3.0](LICENSE), by [Robbendebiene](https://github.com/Robbendebiene)) — a tribute to the original author.
> The original Gesturefy is Firefox-only. This port brings the classic mouse gesture experience to Chrome users.

Navigate, operate, and browse faster with mouse gestures! Draw gestures with your mouse (while holding the left/middle/right button) to execute commands — more natural and convenient than keyboard shortcuts.

**[中文版 README](README_CN.md)**

## ✨ Features

- 🖱️ Mouse gestures (triggered by holding left, middle, or right mouse button)
- ⚡ 80+ built-in commands: tabs, navigation, scrolling, zoom, copy & paste, and more
- 🖱️👆 **Double-click to close tab** (optional, left/right button configurable)
- 🔄 **Edge gesture presets** — Microsoft Edge's official 16-gesture map
  (hand-recorded), one-click migration for Edge users
- 🎨 Customizable gesture trace and status information style
- 🔄 Rocker gestures (left-click while holding right button and vice versa) & wheel gestures
- 📜 Custom user script command (advanced)
- 🌓 Light / Dark / High-contrast themes
- 🌐 Multi-language support (English / Simplified Chinese / Traditional Chinese)

## 🧩 Modular architecture

New features are shipped as **independent content-script modules** in `core/extras/`
(e.g. double-click-to-close), mounted via `manifest.json` — the frozen core
`content.bundle.js` is never rebuilt, keeping the battle-tested gesture engine intact.

## 📦 Installation

1. Download the zip from [Releases](https://github.com/GenmetsuWenxuePress/gesturefy-chrome/releases)
2. Open `chrome://extensions` in Chrome → enable **Developer mode**
3. Drag the zip onto the page, or click **Load unpacked** and select the extracted folder

## 🔧 Build from source

```bash
# Requires Node.js 18+
npm install -g rollup
rollup -c rollup.config.mjs   # Regenerates core/bundle/content.bundle.js
```

Then load the directory as an unpacked extension.

## 📜 License & Credits

This project is a port of [Gesturefy](https://github.com/Robbendebiene/Gesturefy) (GPL-3.0), released under the **GPL-3.0 license** with all original copyright notices preserved. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md) for details.

- Original project: https://github.com/Robbendebiene/Gesturefy
- Original (Firefox): https://addons.mozilla.org/firefox/addon/gesturefy/

## 🔐 Privacy

This extension collects **no data of any kind** — no remote servers, no analytics, no telemetry (same as the original). See the [Privacy Policy](https://genmetsuwenxuepress.github.io/gesturefy-chrome/PRIVACY.html) for details.

---

*Gesturefy for Chrome — A Chrome port of the Firefox mouse gesture extension Gesturefy (GPL-3.0, by Robbendebiene). Tribute to the original author.*
