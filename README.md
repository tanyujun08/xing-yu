# 星遇 · 视觉改造工作仓

星遇数码租赁的小程序与管理后台 **本机联动 Mock 副本**（基于正式版 v1.0.2.0），专门用于视觉改造。

| 目录 | 内容 | 技术栈 |
| --- | --- | --- |
| `小程序/` | 微信原生小程序，56 个页面，本机假数据 | 原生 TypeScript + WXML/WXSS + TDesign 小程序 |
| `WEB/` | 管理后台，同时提供两端共享的本机 Mock 服务 | React 19 + TypeScript + Vite + TDesign React |

## 本地运行

两个目录必须并列放在同一个父目录下（共享数据通过相对路径 `WEB/.linked-mock/` 读写）。

1. `cd WEB && npm install && npm run dev`，打开 http://127.0.0.1:5190/
2. `cd 小程序 && npm install`，在微信开发者工具里「工具 → 构建 npm」，再导入 `小程序/` 目录编译。开发者工具需关闭合法域名校验（仅本机 Mock 使用）。

## 不在本仓库里的东西

- 依赖包（`node_modules/`、`miniprogram_npm/`）和构建产物：本地重新安装/构建。
- 运行时共享数据 `WEB/.linked-mock/`：首次运行自动生成。
- 正式产品四仓与治理仓（xingyu-governance）：本仓只做视觉，满意后只把样式改动回写正式仓，不回写 Mock。
