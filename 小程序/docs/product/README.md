# 当前小程序功能总览

当前订单与柜机说明已同步 v1.0.1.7：官方 CABINET 下单、支付后凭证激活、扫码柜详情输码和原任务自动反馈使用真实开发 API；个人订单固定快递。取件进度通过通用弹窗自动同步。详见[柜机与归还](fulfillment-after-sales.md)。其余目录保留初版模块索引；未更新模块的历史 Mock 说明不得用于推断当前订单能力。运行证据见本版 Change S3/S4，真实资金及正式发布未执行。

本期覆盖 C2C 个人租赁和 B2C 平台租赁。社区、票务、二手交易不在范围；分类中的“演唱会长焦”表示设备租赁，不是票务。业务批准规则见治理 [Feature](../../../xingyu-governance/docs/rental/features.md) 和 [Flow](../../../xingyu-governance/docs/rental/flows.md)；存在差异时在专表标识。

## 按任务阅读

| 内容 | 入口 |
| --- | --- |
| 找详细功能、展示、入口、交互和校验 | 下方页面目录→对应模块的功能表与字段/分支说明 |
| 找具体模板事件、handler、生命周期 | [事件索引](interaction-index.md) |
| 看订单/履约/资金如何衔接，选择专项测试 | [流程与校验](flows-and-validation.md) |
| 避免误用占位、静态数据和旧逻辑 | [实现差异](implementation-gaps.md) |
| 给AI任务组织最小上下文与验收 | [Vibe Coding指南](vibe-coding.md) |
| 架构/Token/组件规则 | [架构authority](../architecture/miniprogram-architecture.md) |

每个模块按用户功能说明“功能、入口与触发、交互逻辑、必要校验、结果与例外”；简单说明和导航简述，复杂订单/发布/归还按状态与字段分支展开。首页另含展示顺序、数据字段、排序和空态；模块末尾的关键核对场景供后续开发验收使用，均未在本次文档工作中运行。共用参数、等待结果和恢复范围集中在[流程与校验](flows-and-validation.md)，不要求每页重复填写模板。

## 能力标签

| 标签 | 含义 |
| --- | --- |
| LOCAL_MOCK | 本地数据、命令和状态恢复；不表示API或第三方接通 |
| CURRENT_API | 使用当前 OpenAPI 对应的真实请求适配器；成功必须由服务端回执和权威回读共同确认 |
| HOST_LOCAL | 代码调用宿主扫码、媒体、预览等；本次未运行宿主验证 |
| DISPLAY_ONLY | 主要只读说明/静态展示；返回或展开不是业务提交 |
| PLACEHOLDER | 可见入口以Toast等提示收尾，未完成实际业务 |
| LEGACY_REGISTERED | 仍注册的兼容/旧入口，不作为主链必经页 |
| GAP | 某一交互存在实现/规格差异；见对应模块和差异表，不以页面总标签掩盖 |

所有原生弹框、导航等基础宿主调用不逐个附加 HOST_LOCAL；该标签突出扫码/媒体等需要单独验证的能力。

## 页面目录

本轮已更新订单、协议、柜机与归还条目，并移除已退役的独立验证码页。其他模块保留原目录快照，完整注册集合以当前 app.json 为准。一级 Tab 为首页、订单、沟通、我的。点击功能名可到交互表。

| MP-ID | 路由 | 功能说明 | 能力边界 |
| --- | --- | --- | --- |
| MP-HOME | `pages/home/index` | [首页](discovery.md#mp-home) | CURRENT_API；部分发布入口仍为占位 |
| MP-CHECK-IN | `pages/check-in/index` | [每日签到](membership.md#mp-check-in) | API 接入：本人签到、月历史、当前已发布规则与权益摘要；开发者工具/真机待验 |
| MP-ORDERS | `pages/orders/index` | [统一订单列表](checkout-orders.md#mp-orders) | CURRENT_API；本人真实订单分页 |
| MP-INFO | `pages/info/index` | [信息中心](communication.md#mp-info) | LOCAL_MOCK |
| MP-ORDER-MESSAGES | `pages/order-messages/index` | [订单信息](communication.md#mp-order-messages) | LOCAL_MOCK |
| MP-PRIVATE-MESSAGES | `pages/private-messages/index` | [私聊会话列表](communication.md#mp-private-messages) | LOCAL_MOCK |
| MP-INFO-GUIDE | `pages/info-guide/index` | [租赁指南/协议](communication.md#mp-info-guide) | DISPLAY_ONLY |
| MP-CHAT | `pages/chat/index` | [客服与订单沟通](communication.md#mp-chat) | LOCAL_MOCK |
| MP-PROFILE | `pages/profile/index` | [我的](account.md#mp-profile) | LOCAL_MOCK |
| MP-PROFILE-EDIT | `pages/profile-edit/index` | [个人资料](account.md#mp-profile-edit) | LOCAL_MOCK + HOST_LOCAL |
| MP-ACCOUNT-SECURITY | `pages/account-security/index` | [账户安全](account.md#mp-account-security) | PLACEHOLDER |
| MP-ABOUT | `pages/about/index` | [关于星遇](account.md#mp-about) | DISPLAY_ONLY |
| MP-ADDRESSES | `pages/addresses/index` | [地址簿](account.md#mp-addresses) | LOCAL_MOCK |
| MP-DETAIL | `pages/detail/index` | [设备详情](discovery.md#mp-detail) | CURRENT_API；公开/会话供给读取，允许的官方与个人资产可进入下单 |
| MP-CONFIRM | `pages/confirm/index` | [确认订单](checkout-orders.md#mp-confirm) | CURRENT_API；按日选租期、实时报价、准备及正式确认 |
| MP-IDENTITY | `pages/identity/index` | [实名认证](checkout-orders.md#mp-identity) | CURRENT_API；本人实名信息登记，无外部人脸核验 |
| MP-WECHAT-WAIVER | `pages/wechat-waiver/index` | [微信免押核验](checkout-orders.md#mp-wechat-waiver) | PLACEHOLDER；当前不可用，不进入订单主链 |
| MP-CONTRACT | `pages/contract/index` | [电子合同](checkout-orders.md#mp-contract) | CURRENT_API；协议正文与明确同意 |
| MP-ORDER-DETAIL | `pages/order-detail/index` | [订单详情与动作中枢](checkout-orders.md#mp-order-detail) | CURRENT_API；原订单、取件码和允许动作 |
| MP-SERVICE-DETAIL | `pages/service-detail/index` | [订单服务说明](checkout-orders.md#mp-service-detail) | DISPLAY_ONLY |
| MP-DEVICE-ORDERS | `pages/device-orders/index` | [设备订单入口](checkout-orders.md#mp-device-orders) | CURRENT_API；按资产上下文查询真实订单 |
| MP-CABINET-OPEN | `pages/cabinet-open/index` | [原任务取件结果](fulfillment-after-sales.md#mp-cabinet-open) | CURRENT_API；原任务恢复与自动结果反馈 |
| MP-CABINET-CODE | `pages/cabinet-code/index` | [柜详情输入取件码](fulfillment-after-sales.md#mp-cabinet-code) | CURRENT_API + HOST_LOCAL；扫码柜详情、本人输码、原任务自动反馈 |
| MP-RETURN-SUBMIT | `pages/return-submit/index` | [归还申请与前置证据](fulfillment-after-sales.md#mp-return-submit) | CURRENT_API + HOST_LOCAL；材料与实物归还独立 |
| MP-CABINET-RETURN | `pages/cabinet-return/index` | [本人订单入柜归还](fulfillment-after-sales.md#mp-cabinet-return) | CURRENT_API；原归还任务与可信入柜事实 |
| MP-DISPUTE | `pages/dispute/index` | [争议、方案与证据](fulfillment-after-sales.md#mp-dispute) | PLACEHOLDER；旧争议动作不可用 |
| MP-CABINETS | `pages/cabinets/index` | [柜机列表](discovery.md#mp-cabinets) | CURRENT_API；需小程序登录会话的只读列表 |
| MP-CABINET-DETAIL | `pages/cabinet-detail/index` | [柜机详情](fulfillment-after-sales.md#mp-cabinet-detail) | CURRENT_API + HOST_LOCAL；柜详情与归还选格，显式预留/开柜 |
| MP-STORES | `pages/stores/index` | [门店列表](discovery.md#mp-stores) | CURRENT_API；只读发现 |
| MP-STORE-DETAIL | `pages/store-detail/index` | [门店详情](discovery.md#mp-store-detail) | CURRENT_API；只读发现 |
| MP-REGION | `pages/region/index` | [城市选择](discovery.md#mp-region) | CURRENT_API；已发布地区数据集读取，本地保存已选 city_id |
| MP-PUBLISH-ELIGIBILITY | `pages/publish-eligibility/index` | [发布条件](publishing.md#mp-publish-eligibility) | LOCAL_MOCK |
| MP-PUBLISH-QUOTA | `pages/publish-quota/index` | [发布额度购买](publishing.md#mp-publish-quota) | LOCAL_MOCK |
| MP-RENTAL-SERVICE | `pages/rental-service/index` | [出租服务额度](publishing.md#mp-rental-service) | LOCAL_MOCK |
| MP-PUBLISH | `pages/publish/index` | [发布/编辑/查看/恢复草稿](publishing.md#mp-publish) | LOCAL_MOCK + HOST_LOCAL |
| MP-LISTINGS | `pages/listings/index` | [我的出租设备](publishing.md#mp-listings) | LOCAL_MOCK |
| MP-LISTING-PRICE | `pages/listing-price/index` | [草稿设价并提交审核](publishing.md#mp-listing-price) | CURRENT_API |
| MP-WALLET | `pages/wallet/index` | [资金账户](wallet.md#mp-wallet) | LOCAL_MOCK |
| MP-WITHDRAWAL | `pages/withdrawal/index` | [提现申请与记录](wallet.md#mp-withdrawal) | LOCAL_MOCK |
| MP-LOGIN | `pages/login/index` | [登录](account.md#mp-login) | CURRENT_API；login-sheet 协议与真实微信凭证交换，不提供合成会话回退 |
| MP-MEMBERSHIP | `pages/membership/index` | [会员中心](membership.md#mp-membership) | LOCAL_MOCK |
| MP-LEVEL-RIGHTS | `pages/level-rights/index` | [等级权益](membership.md#mp-level-rights) | LOCAL_MOCK |
| MP-GROWTH-TASKS | `pages/growth-tasks/index` | [成长任务](membership.md#mp-growth-tasks) | LOCAL_MOCK |
| MP-POWDER-LEDGER | `pages/powder-ledger/index` | [粉钻明细](membership.md#mp-powder-ledger) | LOCAL_MOCK |
| MP-POWDER-MALL | `pages/powder-mall/index` | [粉钻商城](membership.md#mp-powder-mall) | LOCAL_MOCK |
| MP-STAR-LEDGER | `pages/star-ledger/index` | [星光明细](membership.md#mp-star-ledger) | LOCAL_MOCK |
| MP-LOTTERY | `pages/lottery/index` | [每日抽奖](membership.md#mp-lottery) | LOCAL_MOCK |
| MP-NO-DEPOSIT | `pages/no-deposit/index` | [押金与免押说明](membership.md#mp-no-deposit) | DISPLAY_ONLY |

## 模块覆盖

| 模块 | 页面数 | 主要任务 |
| --- | --- | --- |
| [发现与地区](discovery.md) | 6 | 找设备、比较供给、看门店和城市 |
| [账户与资料](account.md) | 7 | 登录、地址、资料、账户说明 |
| [下单与订单](checkout-orders.md) | 8 | 方案、实名合同、付款、订单动作与服务 |
| [柜机归还售后](fulfillment-after-sales.md) | 7 | 本人/持码取还、证据、争议与恢复 |
| [个人发布](publishing.md) | 6 | 资格额度、草稿、审核、设价与上下架 |
| [会员活动](membership.md) | 9 | 签到、等级、任务、积分流水、兑换和抽奖 |
| [消息沟通](communication.md) | 6 | 订单消息、私聊、客服、通知和指南 |
| [资金账户](wallet.md) | 2 | 资金投影、提现申请和查询 |

## 维护与证据边界

功能描述按“触发→前置/字段校验→命令→成功事实→失败/未知/恢复”阅读。对静态展示、未绑定旧方法、模拟外部结果逐项说明；不要把点击按钮、收到Toast或跳到下一页写成业务最终成功。

Revision 2 建立目录与事件索引，Revision 3 补充8个模块的功能条件、展示、字段、结果与关键场景。验证限于文档静态核对和源码回读：注册路由覆盖、模板绑定定位、链接与功能描述一致性。业务测试、微信开发者工具、真机、视觉验收、真实支付/柜机/API未作为本次验证；已有测试链接仅为检索入口。文档可能随代码变化失效，后续按handler名与当前authority增量更新。关联 Change：XY-20260905-003。
