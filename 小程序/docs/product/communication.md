# 消息、客服与指南

此模块展示当前账户本地消息和静态服务内容。没有真实 IM、客服坐席、推送送达、已读回执或消息撤回能力。订单沟通和正式售后提交是不同操作。

<a id="mp-info"></a>

## MP-INFO 信息中心

路由：`pages/info/index`，一级 Tab。源码：[info](../../miniprogram/pages/info/index.ts)。onShow 更新 Tab 与数据。

| 交互与触发 | 条件与校验 | 结果与恢复 |
| --- | --- | --- |
| `openMessageEntry` | id 必须匹配现有行；私聊、订单消息要求登录 | 客服→support chat；私聊→private-messages；订单→order-messages。未登录私有入口转登录 |
| `openGuide` | guide id 非空 | 打开 info-guide?id；正文不存在时目标页 missing |

角标取当前可见消息/会话条数，>99 显示99+；**不是未读数量**，没有阅读后清除机制。

信息中心是聚合入口，展示客服、私聊、订单消息及指南；点一项只进入对应列表或内容。订单消息由订单投影产生，指南来自静态内容表，聊天记录来自本地会话。重新回到信息中心会重读这些数据，当前没有系统推送订阅或后台实时刷新链路。原 `service-notices` 本地伪通知页已按批准范围退场，不能再作为通知送达或订单结果证据。

<a id="mp-order-messages"></a>

## MP-ORDER-MESSAGES 订单信息

路由：`pages/order-messages/index`。源码：[order-messages](../../miniprogram/pages/order-messages/index.ts)。onShow 刷新 `buildOrderMessageViews`；游客列表为空，并可 `openLogin`。`openOrder` 从消息 id 打开订单详情，详情再次验证访问关系。消息是本地订单状态投影；无独立删除、已读、订阅通知交互。

<a id="mp-private-messages"></a>

## MP-PRIVATE-MESSAGES 私聊会话列表

路由：`pages/private-messages/index`。源码：[private-messages](../../miniprogram/pages/private-messages/index.ts)。onShow 从当前账户可见订单构建会话；游客列表清空。`openConversation` 要求非空 orderId，进入 `chat?mode=c2c&orderId=…`；`openLogin` 去登录。会话卡片不能绕过命令对付款状态和订单参与者的校验。

<a id="mp-info-guide"></a>

## MP-INFO-GUIDE 租赁指南/协议

路由：`pages/info-guide/index?id=…`。源码：[info-guide](../../miniprogram/pages/info-guide/index.ts)、[内容表](../../miniprogram/shared/presentation/info-guides.ts)。按 id 选择租赁、押金、保障、用户协议、隐私政策等静态内容。

进入时 id 必须命中 `infoGuideById`，否则 missing；`goBack` 只返回。页面不记录 Mock 访问事件，也不产生任何业务写入。打开用户协议不是登录同意，必须回登录页明确勾选/同意。不要把本地说明文本当实时政策接口或审批后的法律文本。

<a id="mp-chat"></a>

## MP-CHAT 客服与订单沟通

路由：`pages/chat/index?mode=support|c2c&orderId=…`。缺省为 support，orderId 对一般客服可空。源码：[chat](../../miniprogram/pages/chat/index.ts)、[会话命令](../../miniprogram/shared/fixture/index.ts)。

| 交互与触发 | 条件与校验 | 结果与恢复 |
| --- | --- | --- |
| 进入/重新显示 | c2c 必须有订单；消息读取按当前账户和会话关系过滤 | 已 completed/cancelled 的 C2C 只读；无效订单 unavailable；support 可带订单上下文 |
| `inputMessage` | 文本输入 | 本地编辑，清原错误；不自动发送 |
| `send` | 非 submitting/readonly/unavailable；trim 非空；命令最多500字、账户存在；带订单时必须参与该订单且非诊断样例；c2c 还要求付款后可沟通且未结束 | 成功清输入并重读；失败留原输入和原因。客服模式会生成固定自动回复；不是人工已受理证明 |
| `requestRecovery` | support+orderId，柜机取件/归还 external=failed/unknown，命令再次复核权限和状态 | 提交本地人工核对请求，展示已提交；不立即修正柜机结果，不发争议申请 |

页面展示的 readonly、recoveryAvailable 是 UI 条件；命令校验才是操作边界。未付款 C2C 有路由不代表能发送；订单结束可看历史不代表能继续发消息。聊天内容不会自动形成责任方案、证据提交或支付指令。

**会话分支与文本规则：**

| 功能 | 入口与触发 | 交互逻辑 | 必要校验 | 结果与例外 |
| --- | --- | --- | --- | --- |
| 普通客服咨询 | 客服菜单，不带订单也可进入 | mode 缺省或非 c2c 时使用 support；显示本地消息及固定自动回复 | 发送内容 trim 后 1–500 字，命令校验当前账户 | 成功清输入，失败在本页显示原因并保留文字；不代表人工坐席已读 |
| 订单双方沟通 | 私聊卡片或订单联系/提醒入口 | 携 orderId，按当前参与方显示“联系出租方/承租方” | 订单存在、当前账户为参与者、付款后允许沟通、订单未结束 | 缺少订单显示不可对话；未付款即使页面可进入也会被命令拒绝发送 |
| 结束订单历史 | 打开 completed/cancelled 订单会话 | 显示原消息，页面 readonly | readonly 时发送处理直接返回 | 可阅读，不能继续发消息；不自动删历史 |
| 柜机人工核对 | 带订单的 support 会话出现核对入口 | 提交 requestManualRecovery 并显示已提交 | 柜机取件/归还 failed 或 unknown，命令复核本人关系和状态 | 请求记录与柜机最终结果分开；返回订单需重查最新快照 |

消息气泡按 senderUserId 与当前账户判断“我发的”，时间显示到分钟；输入阶段不写入消息记录，页面仅支持文本发送，没有图片、语音、附件、撤回或独立未读回执。未发送文本只在页面 data 中，未实现持久输入草稿。服务通知展开只影响本页，重新显示全部收起；指南无有效 id 则 missing，不替换为默认正文。

**关键核对场景（预期，未运行）：**游客点私聊/订单消息先去登录；空格消息不发送且显示“请输入消息内容”；已结束 C2C 会话只读；正常发送后输入清空并出现本地消息；打开服务通知后再次点击收起，重新进入也保持全收起；阅读隐私政策后返回登录页不会自动勾选同意。
