# 独立微信小程序离线演示副本（2026-10 最新源码）

- 用户指定的独立演示目录。源页面复制自星遇小程序 v1.0.2.0，仅用于离线功能体验和独立视觉开发。
- 保留原生 TypeScript、WXML、WXSS 和原组件结构；不转成 H5、Taro 或 uni-app。
- 业务请求经 `miniprogram/preview/` 适配到本机回环 Mock 服务。禁止接真实 API、数据库、微信登录、微信支付、实柜、短信、OSS 或真实认证/合同系统。
- 原页面原本未接入的演示补充由 `preview/extras.ts` 维护，保持差异说明，不把它们冒充真实 API 能力。
- 初始数据在 `preview/seed.ts`；双端共享状态在 WEB 的 `.linked-mock/`，旧独立存储保留。演示中心重置会影响共享状态，不得静默重置。本机文件上传/视频仅用于本地预览。
- 保留用户已有视觉修改。不将这里的 Mock、自动登录、授权模拟或状态推进回写到原产品仓。
- 原生组件已在 `miniprogram/miniprogram_npm/` 打包。可使用 `scripts/Prepare-Components.ps1` 在本机重建，禁止运行原产品 Docker 或平台上传发布。
- 验证用 `npm run verify`。仅报告实际运行范围，不把宿主机检查说成模拟器、真机或真实业务验收。
