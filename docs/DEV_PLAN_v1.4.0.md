# DEV_PLAN — Gesturefy for Chrome v1.4.0 差异化功能包

## 背景与边界

**为什么做**：竞争对手 Cesturefy 的用户评论区（2026-03~07）揭示了真实迁移用户需求：360 用户要双击关闭标签、FF 用户要图片/媒体保存、Edge 用户要默认手势迁移。做差异化功能包直接回应这些需求。

**目标用户**：从 Edge / 360 / Firefox 迁移到 Chrome 的手势用户（最大客群）。

**核心差异化**：
1. 双击关闭标签页（360 用户习惯，竞品没有）
2. 图片/媒体一键保存（竞品明确缺失，评论用户公开求）
3. 一键迁移手势预设（Edge/360/原版风格，竞品没有）

**明确不做**：
- ❌ Tab bar 级双击关闭（浏览器无扩展 API，只能做页面级双击）
- ❌ 完整复刻 Edge 16 手势（无官方映射表，不虚构；预设用通用约定并注明可微调）
- ❌ 不做竞品贬损

---

## 施工图

### 文件清单

| 文件 | 操作 | 改动内容 |
|:---|:---:|:---|
| `resources/json/commands.json` | 修改 | 新增 `SaveMedia` 命令定义 |
| `resources/json/defaults.json` | 修改 | `Settings.Gesture.doubleClickCloseTab`(默认false) + `GesturePresets` 三套预设(edge/360/gesturefy) |
| `_locales/zh_CN/messages.json` | 修改 | 新 i18n keys（SaveMedia、双击关闭、预设） |
| `_locales/zh_TW/messages.json` | 修改 | 同上（繁体） |
| `core/commands.mjs` | 修改 | `SaveMedia` 命令实现（video/audio 元素保存，参照 SaveImage 的 referer 模式） |
| `core/content.mjs` | 修改 | `dblclick` 监听（启用时 + 排除交互元素 → 发消息 background） |
| `core/background.mjs` | 修改 | 新消息 handler：`closeTabByDoubleClick` → `chrome.tabs.remove` |
| `views/options/fragments/settings.inc` | 修改 | 双击关闭开关 + 预设应用按钮/下拉 |
| `views/options/settings.mjs` | 修改 | 预设应用逻辑（写 storage → 刷新配置） |
| `core/bundle/content.bundle.js` | **重建** | rollup 重新打包（content.mjs 变更后） |

### 接口契约

```
# 新设置键
Settings.Gesture.doubleClickCloseTab: boolean  # 默认 false

# 新命令
SaveMedia: { name: "SaveMedia", settings: [...], ... }  # 参照 SaveImage 结构

# 新数据
defaults.json.GesturePresets: {
  "gesturefy": [Gesture...],  # 当前默认（= defaults.json.Gestures）
  "edge":     [Gesture...],   # 左=后退 右=前进 上=刷新 下=关闭标签 L形=新建标签
  "qihu360":  [Gesture...]    # 左=后退 右=前进 上=刷新 下=关闭标签 上左=切换左标签 上右=切换右标签
}

# 消息协议（content → background）
{ subject: "closeTabByDoubleClick" }  # background: tabs.remove(sender.tab.id)

# 预设应用（options 页 → storage）
写 chrome.storage.local Gestures = presets[selected]
```

### 任务依赖

```
T1 数据层（commands.json + defaults.json + i18n×2）— 无依赖
  ├→ T2 功能层（commands.mjs SaveMedia + content.mjs dblclick + background.mjs handler）
  ├→ T3 UI 层（settings.inc + settings.mjs 预设）
T2+T3 完成 → T4 重建 bundle + 全量验证 + 打包 v1.4.0 + 推送
```

---

## 验收标准

- [ ] `node --check` 全部 .mjs 通过
- [ ] commands.json 含 SaveMedia，86→87 命令
- [ ] defaults.json 含 doubleClickCloseTab + GesturePresets（3 套）
- [ ] content.mjs dblclick：启用时双击非交互元素触发，交互元素（input/textarea/button/a/video/audio/iframe）不触发
- [ ] background.mjs 处理 closeTabByDoubleClick → tabs.remove(sender.tab.id)
- [ ] SaveMedia：target 为 video/audio 时 downloads.download（含 referer 注入），非媒体元素返回失败
- [ ] settings.inc 预设按钮：点击后 storage Gestures 被预设覆盖，配置刷新生效
- [ ] bundle 重新打包，源↔bundle 一致
- [ ] 三套预设 pattern 均为标准方向点阵（水平/垂直/对角/L 形）
