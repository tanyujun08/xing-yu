# Vibe Coding 开发检索指南

目的：让 AI 用较小的上下文找到当前功能、状态和校验，减少重复造组件、把Mock当真实接口、或只改按钮不改命令的问题。本文是检索指南，不建立第二套开发规则。流程读取工作区 `$xingyu-s1-s4` 和治理 [WORKFLOW](../../../xingyu-governance/WORKFLOW.md)，架构读取[现有规范](../architecture/miniprogram-architecture.md)。

## 先确定要做的事，再选择资料

1. 从[功能总览](README.md)找到页面 MP-ID，再定位其中的用户功能（如首页组合筛选、地址选择、续租付款），阅读入口、触发、校验、结果和例外。
2. 从[事件索引](interaction-index.md)定位 WXML 绑定与 TS handler；同时读条件分支和 route 参数，区分未暴露的旧函数。
3. 涉及状态/金额/资源/证据，继续读[跨页流程](flows-and-validation.md)、当前批准 Feature/Flow、命令和状态机；不要只加载整页TS就决定业务规则。
4. 检查[实现差异](implementation-gaps.md)。当前缺口不是新设计默认值，历史测试也不自动覆盖当前批准约束。
5. 只选择受影响的测试与运行场景；最终分别报告源码、静态、宿主运行、视觉、真实第三方结果。

## 从意图找到文件

| 修改意图 | 最小源码上下文 | 需要联读 |
| --- | --- | --- |
| 页面内容/布局/交互入口 | 对应 index.ts/wxml/wxss/json，使用组件 | [app.wxss Tokens](../../miniprogram/app.wxss)、[共享样式](../../miniprogram/shared/design/components.wxss)、架构规范；不要另建common/base样式体系 |
| 订单动作、按钮状态、角色权限 | [mock-api](../../miniprogram/shared/api/mock-api.ts)、[fixture](../../miniprogram/shared/fixture/index.ts)、[order-machine](../../miniprogram/shared/fixture/order-machine.ts)，页面动作映射 | 查 projectOrder/resolutionPlanFor/orderAction 及 actor/state guards，连同页面文案和测试 |
| 发现/库存显示 | [发现模块](discovery.md)、对应查询与供给投影 | 查资产归属、城市/分类、不可用过滤；listings.status不等于在租状态 |
| 草稿/媒体 | [local-media](../../miniprogram/shared/media/local-media.ts)、业务表单、保存/绑定命令 | saved与submitted、本人归属、取消/失败、重进与删除一致性 |
| 列表/刷新/分页 | [cursor-list](../../miniprogram/shared/interaction/cursor-list.ts)、orders/powder-ledger、对应presenter | 首屏/增量状态、旧请求丢弃、账户/筛选查询身份、稳定id |
| 防重复与异步 | [operation-scope](../../miniprogram/shared/interaction/operation-scope.ts)、[intent-key](../../miniprogram/shared/interaction/intent-key.ts)、[navigate-once](../../miniprogram/shared/interaction/navigate-once.ts) | 业务意图与payload、UNKNOWN重进恢复、onHide/onUnload清理；busy不替代幂等 |
| 金额/会员/提现 | [金额格式](../../miniprogram/shared/format/money.ts)、fixture资金/权益函数、相关模块 | 元/分/积分、流水事实、角色/会话、次数上限和原意图查询 |
| 消息/说明文档 | [presentation/info-guides](../../miniprogram/shared/presentation/info-guides.ts)、[info/projection](../../miniprogram/shared/info/projection.ts)、communication模块 | 文案与命令效果一致，角标条数不等于未读数 |

设计Token、字号、间距、图标、分割线、圆角、颜色与对齐都先从现有 authority 检索。视觉可见尺寸和可点击范围分别处理；共享样式不能靠全局后置覆盖掩盖局部组件问题。改公共组件前查实际消费者和小程序样式隔离，不能因为两个页面长得相似就复制整套业务表单。

## 当前可复用交互组件

| 组件 | 输入和输出 | 页面仍须负责 |
| --- | --- | --- |
| [page-header](../../miniprogram/components/page-header/index.ts) | 标题、返回可见、actionText；发 back/action；测量宿主导航尺寸 | 返回层级、关闭面板、动作命令；组件不自行判断业务导航 |
| [page-shell](../../miniprogram/components/page-shell/index.ts) | scrollMode/surface/ariaBusy、多slot；viewport模式发lower | 列表控制器和加载更多，避免叠加页面/容器滚动 |
| [bottom-actions](../../miniprogram/components/bottom-actions/index.ts) | 主次文案、busy、各自disabled；非阻塞状态发primary/secondary | actor/状态/字段/幂等；视觉loading不等于业务锁 |
| [confirmation-dialog](../../miniprogram/components/confirmation-dialog/index.ts) | visible、文案、busy；非busy发confirm/cancel | 具体操作身份和二次校验；确认前不执行开柜等命令 |
| [cabinet-credential-input](../../miniprogram/components/cabinet-credential-input/index.ts) | value/error/focus/展示码开关；归一六位数字并发input `{value}` | 凭证真伪、柜机/意图/权限；匿名场景不能展示期望码 |
| [media-state](../../miniprogram/components/media-state/index.ts) | state/src/density/alt；发load/error/retry | 图片资源、重试动作和媒体事实；retry不自动上传 |
| [status-view](../../miniprogram/components/status-view/index.ts) | loading/empty/error/end、密度、actionText、busy；发action | 首屏/刷新/更多分别绑定正确重试；组件不执行查询 |
| [custom-tab-bar](../../miniprogram/custom-tab-bar/index.ts) | 固定四个Tab、selected，点击switchTab | 目标页面登录/数据刷新；Tab选择不是身份切换 |

组件模板内部14处绑定也在[事件索引](interaction-index.md)中。复用前同时查页面JSON注册、WXML传参和事件接收者，不能只凭组件名称假定具备完整业务。

## 可直接使用的任务输入

```text
目标：在 [MP-ID/页面] 完成 [可观察结果]。
当前入口与触发：[用户从哪里来，点什么，当前角色/订单状态]。
范围：[允许修改的页面、直接消费者、必要共享模块；本次是否只审查/只文档]。
先读：docs/product/README.md 中对应模块、interaction-index.md，相关 GAP 条目。
涉及业务时核对当前 Feature/Flow、mock-api 命令和 order-machine，不把 Mock/历史测试当新规则。
验收：成功时 [状态/反馈/导航]；拒绝时 [校验/保留输入]；取消、重复、UNKNOWN、返回重进时 [预期]。
实现沿用现有Token/组件/异步工具；新增抽象必须说明实际消费者和职责。
保留工作树已有修改；按现行工作流执行，不推导 Git、平台或真实业务操作授权。
交付：实际改动、验证证据、未验证项；同步本功能文档与差异状态。
```

## 轻量功能说明格式

目标是让开发者或AI知道当前功能怎样实现和验收。沿用8个模块与现有页面锚点；一项功能写清五件事，简单导航可用一句话或合并相邻列，复杂流程才展开状态分支：

| 功能 | 入口与触发 | 交互逻辑 | 必要校验 | 结果与例外 |
| --- | --- | --- | --- | --- |
| 首页组合筛选 | 点分类或供给标签 | 在当前地区设备中取两组交集，保留另一组 | 枚举合法，非法值回退全部 | 更新选中与列表；组合为空可重置，地区无设备可切城 |

- 页面开头说明用途、来源/去向和主要展示；有用户输入时写默认值、单位、枚举/范围和条件必填。不要把无输入的说明页套成完整表单模板。
- 有角色/状态差异时分别写入口可见、按钮可操作、提交校验；支付、柜机、归还、争议等复杂功能保留成功/失败/未决及恢复分支。
- 登录、金额、跨页参数和恢复等共性规则引用[流程与校验](flows-and-validation.md)，Token/组件继续引用架构规范与本页组件表。
- 每个模块选少量关键场景写“前置数据→操作→预期”；这些是验收输入，标明未运行，不能当作测试通过证据。简单展示或跳转无需再建独立用例文件。
- 当前没有的搜索、定位、发券、审核推进入口写清边界；代码与文案不同就关联已有GAP，不把缺口扩成新功能或顺手修代码。

先用文档确认用户行为，再按需查事件索引定位实现。handler数量和链接可用性只证明可检索，不能替代对条件分支及结果的理解。

只改展示时不要制造新的领域命令；改状态命令时不要只改Toast。新增路由同步 app.json、功能目录、模块条目和事件索引；删路由检查导航来源、兼容入口与历史引用。事件索引的行号是取样定位，后续源码变动应按 handler 名重新检索。

## 文档完成判据

- 读者能说明本功能从哪里触发、哪些条件下可用、校验不通过如何反馈、成功或等待结果怎样展示。
- 文档覆盖当前展示和用户动作，复杂功能分支可追溯源码；当前缺口与期望行为分开记录。
- 模块间引用、路由与参数一致，示例能说明关键规则；没有新增与当前实现无关的规则、框架或文档层级。
- 一次集中补充后做源码回读及文档检查。只有实际开发产品行为时，才按该改动选择静态/宿主等验证；纯文档不启动产品运行环境。

本套文档的验证范围为路由、模板事件到handler、链接和功能条件的源码核对；各模块标注的核对场景尚未运行。`npm run verify`、开发者工具、真机和真实第三方结果需按实际执行分别报告。
