# 小程序文档入口

先按任务选择入口，避免一次加载全部页面和历史 Change。

| 要回答的问题 | 入口 |
| --- | --- |
| 当前有哪些功能、页面入口在哪里 | [功能总览与 51 页目录](product/README.md) |
| 某个按钮何时出现、怎样触发、校验什么、结果是什么 | 功能总览中的对应模块；再查[逐页事件索引](product/interaction-index.md) |
| 下单、归还、售后与资金之间怎样衔接 | [跨页流程与校验](product/flows-and-validation.md) |
| 当前实现有哪些占位、缺口和规格差异 | [实现边界与差异](product/implementation-gaps.md) |
| AI 开发怎样选择上下文、修改位置和验证范围 | [Vibe Coding 开发指南](product/vibe-coding.md) |
| 分层、Token、组件和异步规则是什么 | [小程序架构规范](architecture/miniprogram-architecture.md) |

`product/` 是当前实现的可检索说明，依据路由、WXML、页面 handler、Mock 命令与测试编写。它不建立第二份业务或架构 authority。业务语义仍读取治理仓 [Feature](../../xingyu-governance/docs/rental/features.md) 与 [Flow/Invariant](../../xingyu-governance/docs/rental/flows.md)，实际行为以当前源码为准。

功能文档新增或修改时，同步对应路由、交互、条件、校验、结果和差异；无关历史记录无需全文加载。
