# DEV_PLAN — Gesturefy 差异化功能包 v1.4.0（模块化）

## 架构原则（铁律）

1. **内核冻结**：`core/bundle/content.bundle.js` 永不重打包——它是用户实测可用的 immutable 基线（AI 手工修复版，与源文件不一致）
2. **模块化**：新功能 = 独立文件 + manifest/配置挂载，互不干扰；后期加功能只需新增模块
3. **增量路径**：只新增/修改 bundle 之外的源文件（background 直接加载源文件，安全）

## 目录结构

```
core/
├── bundle/content.bundle.js   ← 🔒 冻结（不动）
├── extras/                    ← 🧩 模块目录（新建）
│   └── dblclick-close.mjs     ← 模块1: 双击关闭标签页（独立 content script）
├── background.mjs             ← 只加 handler（getConfigValue）
├── commands.mjs               ← 模块2: SaveMedia（background 源文件）
resources/json/
├── commands.json              ← +SaveMedia 定义
├── defaults.json              ← +doubleClickCloseTab + GesturePresets(3套)
_locales/{zh_CN,zh_TW}/        ← +i18n keys
views/options/
├── index.html                 ← +双击开关 + 预设区块（data-config 自动绑定）
├── main.mjs                   ← +预设应用逻辑
manifest.json                  ← content_scripts 加 extras 引用
```

## 模块契约（消息协议）

| 消息 | 方向 | 负载 | 响应 |
|:---|:---|:---|:---|
| `getConfigValue` | extras → background | `{key: "Settings.Gesture.doubleClickCloseTab"}` | `{value}` |
| `closeTabByDoubleClick` | extras → background | 无 | `true/false`（已有 handler） |
| 预设应用 | options → storage.local | `Config.set("Gestures", preset)` | autoUpdate 自动同步 |

## 任务依赖

- T1 数据层（commands.json + defaults.json + i18n ×2）→ 无依赖
- T2 功能层（extras/dblclick-close.mjs + background handler + commands.mjs SaveMedia）→ 依赖 T1 键名
- T3 UI 层（index.html + main.mjs 预设/开关）→ 依赖 T1 键名
- T4 整合（manifest + 打包 v1.4.0 + 验证 + 交付测试）→ 依赖 T1-T3

## 验证清单

1. JSON 全合法；node --check 全部 .mjs/.js
2. bundle 文件 md5 与可用版一致（内核零改动）
3. manifest content_scripts 含 extras 引用
4. 命令 87 个（+SaveMedia）；预设 3 套命令名有效
5. 打包 zip → 用户实测：双击关闭、SaveMedia、预设切换、原手势回归
