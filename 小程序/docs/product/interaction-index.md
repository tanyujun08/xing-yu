# 页面与组件事件索引

订单、协议、柜机与归还段于2026-10-08按v1.0.1.7实际WXML绑定更新。其他模块仍保留2026-09-15取样，行号须按handler重核；注册页面集合以当前app.json为准。另列组件/Tab模板。

事件行只说明“模板绑定到了哪个函数”，不证明节点当时可见、可点击或命令成功。具体角色、状态、字段校验和恢复见[功能总览](README.md)对应模块；对条件渲染需要打开对应WXML行联读祖先wx:if/elif/else与disabled。源码行号是取样定位，后续以handler名重检索。

表中“直接命令”记录该 handler 函数体内可识别的 API `operationId` 或仍保留的 `mockApi.command`；标“间接/无”时需跟踪内部方法、导航或组件事件，不能推导为只读。模板未绑定方法不算用户事件，生命周期另列。

<a id="events-home"></a>

## MP-HOME 首页

[功能条件与反馈](discovery.md#mp-home) · [TS](../../miniprogram/pages/home/index.ts) · [WXML](../../miniprogram/pages/home/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/home/index.ts#L146)、[onShow](../../miniprogram/pages/home/index.ts#L151)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `openCabinets` | `bindtap` | [17](../../miniprogram/pages/home/index.wxml#L17) | [172](../../miniprogram/pages/home/index.ts#L172) | 间接/无 |
| `openCheckIn` | `bindtap` | [12](../../miniprogram/pages/home/index.wxml#L12) | [164](../../miniprogram/pages/home/index.ts#L164) | 间接/无 |
| `openDevice` | `bindtap` | [57](../../miniprogram/pages/home/index.wxml#L57) | [196](../../miniprogram/pages/home/index.ts#L196) | 间接/无 |
| `openPublish` | `bindtap` | [75](../../miniprogram/pages/home/index.wxml#L75) | [180](../../miniprogram/pages/home/index.ts#L180) | 间接/无 |
| `openRegion` | `bindtap` | [7](../../miniprogram/pages/home/index.wxml#L7)、[43](../../miniprogram/pages/home/index.wxml#L43)、[74](../../miniprogram/pages/home/index.wxml#L74) | [168](../../miniprogram/pages/home/index.ts#L168) | 间接/无 |
| `openStore` | `bindtap` | [33](../../miniprogram/pages/home/index.wxml#L33) | [190](../../miniprogram/pages/home/index.ts#L190) | 间接/无 |
| `openStores` | `bindtap` | [29](../../miniprogram/pages/home/index.wxml#L29) | [176](../../miniprogram/pages/home/index.ts#L176) | 间接/无 |
| `resetDeviceFilters` | `bindtap` | [74](../../miniprogram/pages/home/index.wxml#L74) | [218](../../miniprogram/pages/home/index.ts#L218) | 间接/无 |
| `selectCategory` | `bindtap` | [47](../../miniprogram/pages/home/index.wxml#L47) | [202](../../miniprogram/pages/home/index.ts#L202) | 间接/无 |
| `selectSupply` | `bindtap` | [52](../../miniprogram/pages/home/index.wxml#L52) | [210](../../miniprogram/pages/home/index.ts#L210) | 间接/无 |

<a id="events-check-in"></a>

## MP-CHECK-IN 每日签到

[功能条件与反馈](membership.md#mp-check-in) · [TS](../../miniprogram/pages/check-in/index.ts) · [WXML](../../miniprogram/pages/check-in/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/check-in/index.ts) 读取本人月份、当前规则和权益；跨北京时间零点重读。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `checkIn` | `bindtap` | [签到按钮](../../miniprogram/pages/check-in/index.wxml) | [实现](../../miniprogram/pages/check-in/index.ts) | `POST /v1/me/check-ins`，再读月记录、规则与权益 |
| `onSecondaryNavigationBack` | `bindback` | [页头](../../miniprogram/pages/check-in/index.wxml) | [实现](../../miniprogram/pages/check-in/index.ts) | 无 |

<a id="events-orders"></a>

## orders

当前 v1.0.1.7 模板实际绑定；[TS](../../miniprogram/pages/orders/index.ts) · [WXML](../../miniprogram/pages/orders/index.wxml)。服务端动作与恢复条件见相应功能文档。

|handler|模板事件/行|实现入口|
|---|---|---|
|`openLogin`|[bindtap / 5](../../miniprogram/pages/orders/index.wxml#L5)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`chooseRole`|[bindtap / 7](../../miniprogram/pages/orders/index.wxml#L7)、[bindtap / 8](../../miniprogram/pages/orders/index.wxml#L8)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`chooseFilter`|[bindtap / 11](../../miniprogram/pages/orders/index.wxml#L11)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`retryInitial`|[bindaction / 15](../../miniprogram/pages/orders/index.wxml#L15)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`openOrder`|[bindtap / 17](../../miniprogram/pages/orders/index.wxml#L17)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`retryRefresh`|[bindaction / 22](../../miniprogram/pages/orders/index.wxml#L22)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`retryLoadMore`|[bindaction / 24](../../miniprogram/pages/orders/index.wxml#L24)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|

<a id="events-info"></a>

## MP-INFO 信息中心

[功能条件与反馈](communication.md#mp-info) · [TS](../../miniprogram/pages/info/index.ts) · [WXML](../../miniprogram/pages/info/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/info/index.ts#L79)、[onShow](../../miniprogram/pages/info/index.ts#L84)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `openGuide` | `bindtap` | [26](../../miniprogram/pages/info/index.wxml#L26) | [104](../../miniprogram/pages/info/index.ts#L104) | 间接/无 |
| `openMessageEntry` | `bindtap` | [12](../../miniprogram/pages/info/index.wxml#L12) | [96](../../miniprogram/pages/info/index.ts#L96) | 间接/无 |

<a id="events-order-messages"></a>

## MP-ORDER-MESSAGES 订单信息

[功能条件与反馈](communication.md#mp-order-messages) · [TS](../../miniprogram/pages/order-messages/index.ts) · [WXML](../../miniprogram/pages/order-messages/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/order-messages/index.ts#L12)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `openLogin` | `bindtap` | [10](../../miniprogram/pages/order-messages/index.wxml#L10) | [21](../../miniprogram/pages/order-messages/index.ts#L21) | 间接/无 |
| `openOrder` | `bindtap` | [14](../../miniprogram/pages/order-messages/index.wxml#L14) | [23](../../miniprogram/pages/order-messages/index.ts#L23) | 间接/无 |

<a id="events-private-messages"></a>

## MP-PRIVATE-MESSAGES 私聊会话列表

[功能条件与反馈](communication.md#mp-private-messages) · [TS](../../miniprogram/pages/private-messages/index.ts) · [WXML](../../miniprogram/pages/private-messages/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/private-messages/index.ts#L12)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `openConversation` | `bindtap` | [12](../../miniprogram/pages/private-messages/index.wxml#L12) | [23](../../miniprogram/pages/private-messages/index.ts#L23) | 间接/无 |
| `openLogin` | `bindtap` | [8](../../miniprogram/pages/private-messages/index.wxml#L8) | [21](../../miniprogram/pages/private-messages/index.ts#L21) | 间接/无 |

<a id="events-info-guide"></a>

## MP-INFO-GUIDE 租赁指南/协议

[功能条件与反馈](communication.md#mp-info-guide) · [TS](../../miniprogram/pages/info-guide/index.ts) · [WXML](../../miniprogram/pages/info-guide/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/info-guide/index.ts#L21)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `goBack` | `bindtap` | [7](../../miniprogram/pages/info-guide/index.wxml#L7) | [28](../../miniprogram/pages/info-guide/index.ts#L28) | 间接/无 |

<a id="events-chat"></a>

## MP-CHAT 客服与订单沟通

[功能条件与反馈](communication.md#mp-chat) · [TS](../../miniprogram/pages/chat/index.ts) · [WXML](../../miniprogram/pages/chat/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/chat/index.ts#L36)、[onShow](../../miniprogram/pages/chat/index.ts#L43)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `inputMessage` | `bindinput` | [31](../../miniprogram/pages/chat/index.wxml#L31) | [62](../../miniprogram/pages/chat/index.ts#L62) | 间接/无 |
| `requestRecovery` | `bindtap` | [17](../../miniprogram/pages/chat/index.wxml#L17) | [82](../../miniprogram/pages/chat/index.ts#L82) | `requestManualRecovery` |
| `send` | `bindtap` | [32](../../miniprogram/pages/chat/index.wxml#L32) | [66](../../miniprogram/pages/chat/index.ts#L66) | `sendConversationMessage` |

<a id="events-profile"></a>

## MP-PROFILE 我的

[功能条件与反馈](account.md#mp-profile) · [TS](../../miniprogram/pages/profile/index.ts) · [WXML](../../miniprogram/pages/profile/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/profile/index.ts#L174)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `logout` | `bindtap` | [17](../../miniprogram/pages/profile/index.wxml#L17) | [248](../../miniprogram/pages/profile/index.ts#L248) | `logout` |
| `openItem` | `bindtap` | [14](../../miniprogram/pages/profile/index.wxml#L14)、[15](../../miniprogram/pages/profile/index.wxml#L15)、[16](../../miniprogram/pages/profile/index.wxml#L16)、[17](../../miniprogram/pages/profile/index.wxml#L17) | [257](../../miniprogram/pages/profile/index.ts#L257) | 间接/无 |
| `openLogin` | `bindtap` | [8](../../miniprogram/pages/profile/index.wxml#L8) | [212](../../miniprogram/pages/profile/index.ts#L212) | 间接/无 |
| `openMember` | `bindtap` | [9](../../miniprogram/pages/profile/index.wxml#L9) | [214](../../miniprogram/pages/profile/index.ts#L214) | 间接/无 |
| `openProfileEdit` | `bindtap` | [7](../../miniprogram/pages/profile/index.wxml#L7) | [213](../../miniprogram/pages/profile/index.ts#L213) | 间接/无 |

<a id="events-profile-edit"></a>

## MP-PROFILE-EDIT 个人资料

[功能条件与反馈](account.md#mp-profile-edit) · [TS](../../miniprogram/pages/profile-edit/index.ts) · [WXML](../../miniprogram/pages/profile-edit/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/profile-edit/index.ts#L44)、[onHide](../../miniprogram/pages/profile-edit/index.ts#L50)、[onUnload](../../miniprogram/pages/profile-edit/index.ts#L51)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `chooseAvatar` | `bindtap` | [5](../../miniprogram/pages/profile-edit/index.wxml#L5) | [53](../../miniprogram/pages/profile-edit/index.ts#L53) | 间接/无 |
| `inputName` | `bindinput` | [6](../../miniprogram/pages/profile-edit/index.wxml#L6) | [52](../../miniprogram/pages/profile-edit/index.ts#L52) | 间接/无 |
| `openIdentity` | `bindtap` | [7](../../miniprogram/pages/profile-edit/index.wxml#L7) | [78](../../miniprogram/pages/profile-edit/index.ts#L78) | 间接/无 |
| `save` | `bindprimary` | [11](../../miniprogram/pages/profile-edit/index.wxml#L11) | [79](../../miniprogram/pages/profile-edit/index.ts#L79) | `updateProfile` |

<a id="events-account-security"></a>

## MP-ACCOUNT-SECURITY 账户安全

[功能条件与反馈](account.md#mp-account-security) · [TS](../../miniprogram/pages/account-security/index.ts) · [WXML](../../miniprogram/pages/account-security/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/account-security/index.ts#L7)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `rebindPhone` | `bindtap` | [6](../../miniprogram/pages/account-security/index.wxml#L6) | [11](../../miniprogram/pages/account-security/index.ts#L11) | 间接/无 |

<a id="events-about"></a>

## MP-ABOUT 关于星遇

[功能条件与反馈](account.md#mp-about) · [TS](../../miniprogram/pages/about/index.ts) · [WXML](../../miniprogram/pages/about/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/about/index.ts#L3)。

当前WXML无绑定事件。

<a id="events-addresses"></a>

## MP-ADDRESSES 地址簿

[功能条件与反馈](account.md#mp-addresses) · [TS](../../miniprogram/pages/addresses/index.ts) · [WXML](../../miniprogram/pages/addresses/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/addresses/index.ts#L22)、[onShow](../../miniprogram/pages/addresses/index.ts#L31)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `cancelForm` | `bindtap` | [30](../../miniprogram/pages/addresses/index.wxml#L30) | [53](../../miniprogram/pages/addresses/index.ts#L53) | 间接/无 |
| `changeRegion` | `bindchange` | [26](../../miniprogram/pages/addresses/index.wxml#L26) | [52](../../miniprogram/pages/addresses/index.ts#L52) | 间接/无 |
| `chooseAddress` | `bindtap` | [11](../../miniprogram/pages/addresses/index.wxml#L11) | [71](../../miniprogram/pages/addresses/index.ts#L71) | `selectDraftAddress`、`setDefaultAddress` |
| `editAddress` | `catchtap` | [16](../../miniprogram/pages/addresses/index.wxml#L16) | [39](../../miniprogram/pages/addresses/index.ts#L39) | 间接/无 |
| `input` | `bindinput` | [24](../../miniprogram/pages/addresses/index.wxml#L24)、[25](../../miniprogram/pages/addresses/index.wxml#L25)、[27](../../miniprogram/pages/addresses/index.wxml#L27) | [46](../../miniprogram/pages/addresses/index.ts#L46) | 间接/无 |
| `newAddress` | `bindprimary` | [34](../../miniprogram/pages/addresses/index.wxml#L34) | [35](../../miniprogram/pages/addresses/index.ts#L35) | 间接/无 |
| `removeAddress` | `catchtap` | [16](../../miniprogram/pages/addresses/index.wxml#L16) | [84](../../miniprogram/pages/addresses/index.ts#L84) | `deleteAddress` |
| `saveAddress` | `bindtap` | [30](../../miniprogram/pages/addresses/index.wxml#L30) | [55](../../miniprogram/pages/addresses/index.ts#L55) | `saveAddress`、`selectDraftAddress` |
| `toggleDefault` | `bindtap` | [29](../../miniprogram/pages/addresses/index.wxml#L29) | [51](../../miniprogram/pages/addresses/index.ts#L51) | 间接/无 |

<a id="events-detail"></a>

## detail

当前 v1.0.1.7 模板实际绑定；[TS](../../miniprogram/pages/detail/index.ts) · [WXML](../../miniprogram/pages/detail/index.wxml)。服务端动作与恢复条件见相应功能文档。

|handler|模板事件/行|实现入口|
|---|---|---|
|`goBack`|[bindback / 3](../../miniprogram/pages/detail/index.wxml#L3)|[页面实现](../../miniprogram/pages/detail/index.ts#L114)|
|`onGalleryChange`|[bindchange / 6](../../miniprogram/pages/detail/index.wxml#L6)|[页面实现](../../miniprogram/pages/detail/index.ts#L76)|
|`playVideo`|[bindtap / 13](../../miniprogram/pages/detail/index.wxml#L13)|[页面实现](../../miniprogram/pages/detail/index.ts#L77)|
|`onVideoError`|[binderror / 14](../../miniprogram/pages/detail/index.wxml#L14)|[页面实现](../../miniprogram/pages/detail/index.ts#L108)|
|`onVideoTimeUpdate`|[bindtimeupdate / 14](../../miniprogram/pages/detail/index.wxml#L14)|[页面实现](../../miniprogram/pages/detail/index.ts#L109)|
|`retryVideoPoster`|[bindretry / 16](../../miniprogram/pages/detail/index.wxml#L16)|[页面实现](../../miniprogram/pages/detail/index.ts#L93)|
|`openNoDeposit`|[bindtap / 25](../../miniprogram/pages/detail/index.wxml#L25)|[页面实现](../../miniprogram/pages/detail/index.ts#L112)|
|`openStores`|[bindtap / 27](../../miniprogram/pages/detail/index.wxml#L27)|[页面实现](../../miniprogram/pages/detail/index.ts#L113)|
|`editListing`|[bindtap / 36](../../miniprogram/pages/detail/index.wxml#L36)|[页面实现](../../miniprogram/pages/detail/index.ts#L111)|
|`buy`|[bindtap / 36](../../miniprogram/pages/detail/index.wxml#L36)|[页面实现](../../miniprogram/pages/detail/index.ts#L71)|
|`refreshSupply`|[bindtap / 40](../../miniprogram/pages/detail/index.wxml#L40)|[页面实现](../../miniprogram/pages/detail/index.ts#L19)|
|`onWechatLogin`|[bindwechatlogin / 41](../../miniprogram/pages/detail/index.wxml#L41)|[页面实现](../../miniprogram/pages/detail/index.ts#L61)|
|`onPhoneLogin`|[bindphonelogin / 41](../../miniprogram/pages/detail/index.wxml#L41)|[页面实现](../../miniprogram/pages/detail/index.ts#L62)|
|`onLoginLegal`|[bindlegal / 41](../../miniprogram/pages/detail/index.wxml#L41)|[页面实现](../../miniprogram/pages/detail/index.ts#L63)|
|`onLoginCancel`|[bindcancel / 41](../../miniprogram/pages/detail/index.wxml#L41)|[页面实现](../../miniprogram/pages/detail/index.ts#L64)|

<a id="events-confirm"></a>

## confirm

当前 v1.0.1.7 模板实际绑定；[TS](../../miniprogram/pages/confirm/index.ts) · [WXML](../../miniprogram/pages/confirm/index.wxml)。服务端动作与恢复条件见相应功能文档。

|handler|模板事件/行|实现入口|
|---|---|---|
|`handleNavigationBack`|[bindback / 3](../../miniprogram/pages/confirm/index.wxml#L3)|[页面实现](../../miniprogram/pages/confirm/index.ts#L293)|
|`loadContext`|[bindtap / 8](../../miniprogram/pages/confirm/index.wxml#L8)|[页面实现](../../miniprogram/pages/confirm/index.ts#L37)|
|`restorePreparation`|[bindtap / 9](../../miniprogram/pages/confirm/index.wxml#L9)|[页面实现](../../miniprogram/pages/confirm/index.ts#L205)|
|`openAddressBook`|[bindtap / 28](../../miniprogram/pages/confirm/index.wxml#L28)|[页面实现](../../miniprogram/pages/confirm/index.ts#L255)|
|`openTermSheet`|[bindtap / 37](../../miniprogram/pages/confirm/index.wxml#L37)、[bindtap / 39](../../miniprogram/pages/confirm/index.wxml#L39)|[页面实现](../../miniprogram/pages/confirm/index.ts#L236)|
|`openVoucherSheet`|[bindtap / 61](../../miniprogram/pages/confirm/index.wxml#L61)|[页面实现](../../miniprogram/pages/confirm/index.ts#L262)|
|`openContract`|[bindtap / 67](../../miniprogram/pages/confirm/index.wxml#L67)|[页面实现](../../miniprogram/pages/confirm/index.ts#L291)|
|`openOrder`|[bindtap / 68](../../miniprogram/pages/confirm/index.wxml#L68)|[页面实现](../../miniprogram/pages/confirm/index.ts#L166)|
|`openIdentity`|[bindtap / 72](../../miniprogram/pages/confirm/index.wxml#L72)|[页面实现](../../miniprogram/pages/confirm/index.ts#L288)|
|`next`|[bindprimary / 77](../../miniprogram/pages/confirm/index.wxml#L77)|[页面实现](../../miniprogram/pages/confirm/index.ts#L152)|
|`closeTermSheet`|[bindclose / 81](../../miniprogram/pages/confirm/index.wxml#L81)|[页面实现](../../miniprogram/pages/confirm/index.ts#L254)|
|`moveCalendarMonth`|[bindtap / 84](../../miniprogram/pages/confirm/index.wxml#L84)、[bindtap / 86](../../miniprogram/pages/confirm/index.wxml#L86)|[页面实现](../../miniprogram/pages/confirm/index.ts#L237)|
|`chooseCalendarDate`|[bindtap / 92](../../miniprogram/pages/confirm/index.wxml#L92)|[页面实现](../../miniprogram/pages/confirm/index.ts#L238)|
|`resetPricingDates`|[bindtap / 103](../../miniprogram/pages/confirm/index.wxml#L103)|[页面实现](../../miniprogram/pages/confirm/index.ts#L248)|
|`applyTermSheet`|[bindtap / 104](../../miniprogram/pages/confirm/index.wxml#L104)|[页面实现](../../miniprogram/pages/confirm/index.ts#L249)|
|`dismissCheckoutError`|[bindconfirm / 107](../../miniprogram/pages/confirm/index.wxml#L107)|[页面实现](../../miniprogram/pages/confirm/index.ts#L40)|
|`closeVoucherSheet`|[bindclose / 108](../../miniprogram/pages/confirm/index.wxml#L108)|[页面实现](../../miniprogram/pages/confirm/index.ts#L265)|
|`chooseVoucher`|[bindtap / 110](../../miniprogram/pages/confirm/index.wxml#L110)、[bindtap / 111](../../miniprogram/pages/confirm/index.wxml#L111)|[页面实现](../../miniprogram/pages/confirm/index.ts#L286)|
|`retryVouchers`|[bindtap / 114](../../miniprogram/pages/confirm/index.wxml#L114)|[页面实现](../../miniprogram/pages/confirm/index.ts#L286)|
|`loadMoreVouchers`|[bindtap / 115](../../miniprogram/pages/confirm/index.wxml#L115)|[页面实现](../../miniprogram/pages/confirm/index.ts#L286)|

<a id="events-identity"></a>

## identity

当前 v1.0.1.7 模板实际绑定；[TS](../../miniprogram/pages/identity/index.ts) · [WXML](../../miniprogram/pages/identity/index.wxml)。服务端动作与恢复条件见相应功能文档。

|handler|模板事件/行|实现入口|
|---|---|---|
|`onSecondaryNavigationBack`|[bindback / 3](../../miniprogram/pages/identity/index.wxml#L3)|[页面实现](../../miniprogram/pages/identity/index.ts#L67)|
|`inputName`|[bindinput / 8](../../miniprogram/pages/identity/index.wxml#L8)|[页面实现](../../miniprogram/pages/identity/index.ts#L41)|
|`inputIdentity`|[bindinput / 9](../../miniprogram/pages/identity/index.wxml#L9)|[页面实现](../../miniprogram/pages/identity/index.ts#L42)|
|`loadStatus`|[bindtap / 13](../../miniprogram/pages/identity/index.wxml#L13)|[页面实现](../../miniprogram/pages/identity/index.ts#L20)|
|`primary`|[bindprimary / 15](../../miniprogram/pages/identity/index.wxml#L15)|[页面实现](../../miniprogram/pages/identity/index.ts#L67)|

<a id="events-wechat-waiver"></a>

## wechat-waiver

当前 v1.0.1.7 模板实际绑定；[TS](../../miniprogram/pages/wechat-waiver/index.ts) · [WXML](../../miniprogram/pages/wechat-waiver/index.wxml)。服务端动作与恢复条件见相应功能文档。

|handler|模板事件/行|实现入口|
|---|---|---|
|`onSecondaryNavigationBack`|[bindback / 3](../../miniprogram/pages/wechat-waiver/index.wxml#L3)|[共用导航](../../miniprogram/shared/interaction/order-unavailable.ts)|
|`backOrder`|[bindaction / 4](../../miniprogram/pages/wechat-waiver/index.wxml#L4)、[bindsecondary / 10](../../miniprogram/pages/wechat-waiver/index.wxml#L10)、[bindsecondary / 11](../../miniprogram/pages/wechat-waiver/index.wxml#L11)、[bindprimary / 12](../../miniprogram/pages/wechat-waiver/index.wxml#L12)|[页面实现](../../miniprogram/pages/wechat-waiver/index.ts#L4)|
|`queryVerification`|[bindprimary / 10](../../miniprogram/pages/wechat-waiver/index.wxml#L10)|[页面实现](../../miniprogram/pages/wechat-waiver/index.ts#L5)|
|`startPayment`|[bindprimary / 11](../../miniprogram/pages/wechat-waiver/index.wxml#L11)|[页面实现](../../miniprogram/pages/wechat-waiver/index.ts#L6)|

<a id="events-contract"></a>

## contract

当前 v1.0.1.7 模板实际绑定；[TS](../../miniprogram/pages/contract/index.ts) · [WXML](../../miniprogram/pages/contract/index.wxml)。服务端动作与恢复条件见相应功能文档。

|handler|模板事件/行|实现入口|
|---|---|---|
|`onSecondaryNavigationBack`|[bindback / 3](../../miniprogram/pages/contract/index.wxml#L3)|[页面实现](../../miniprogram/pages/contract/index.ts#L73)|
|`refresh`|[bindtap / 9](../../miniprogram/pages/contract/index.wxml#L9)、[bindtap / 68](../../miniprogram/pages/contract/index.wxml#L68)|[页面实现](../../miniprogram/pages/contract/index.ts#L22)|
|`toggleAgree`|[bindtap / 57](../../miniprogram/pages/contract/index.wxml#L57)|[页面实现](../../miniprogram/pages/contract/index.ts#L54)|
|`goIdentity`|[bindtap / 66](../../miniprogram/pages/contract/index.wxml#L66)|[页面实现](../../miniprogram/pages/contract/index.ts#L48)|
|`sign`|[bindtap / 67](../../miniprogram/pages/contract/index.wxml#L67)|[页面实现](../../miniprogram/pages/contract/index.ts#L55)|

<a id="events-order-detail"></a>

## order-detail

当前 v1.0.1.7 模板实际绑定；[TS](../../miniprogram/pages/order-detail/index.ts) · [WXML](../../miniprogram/pages/order-detail/index.wxml)。服务端动作与恢复条件见相应功能文档。

|handler|模板事件/行|实现入口|
|---|---|---|
|`onSecondaryNavigationBack`|[bindback / 3](../../miniprogram/pages/order-detail/index.wxml#L3)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L515)|
|`refreshStatus`|[bindtap / 8](../../miniprogram/pages/order-detail/index.wxml#L8)、[bindtap / 18](../../miniprogram/pages/order-detail/index.wxml#L18)、[bindtap / 91](../../miniprogram/pages/order-detail/index.wxml#L91)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L68)|
|`openProduct`|[bindopen / 26](../../miniprogram/pages/order-detail/index.wxml#L26)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L505)|
|`copyOrderNumber`|[bindtap / 27](../../miniprogram/pages/order-detail/index.wxml#L27)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L507)|
|`toggleOrderInfo`|[bindtap / 40](../../miniprogram/pages/order-detail/index.wxml#L40)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L514)|
|`copyCode`|[bindtap / 89](../../miniprogram/pages/order-detail/index.wxml#L89)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L150)|
|`toggleProgress`|[bindtap / 93](../../miniprogram/pages/order-detail/index.wxml#L93)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L514)|
|`copyRecipient`|[bindtap / 105](../../miniprogram/pages/order-detail/index.wxml#L105)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L512)|
|`copyTracking`|[bindtap / 107](../../miniprogram/pages/order-detail/index.wxml#L107)、[bindtap / 110](../../miniprogram/pages/order-detail/index.wxml#L110)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L508)|
|`onReviewMediaActivity`|[bindload / 170](../../miniprogram/pages/order-detail/index.wxml#L170)、[bindretry / 170](../../miniprogram/pages/order-detail/index.wxml#L170)、[bindload / 178](../../miniprogram/pages/order-detail/index.wxml#L178)、[bindretry / 178](../../miniprogram/pages/order-detail/index.wxml#L178)、[bindtimeupdate / 183](../../miniprogram/pages/order-detail/index.wxml#L183)、[bindload / 184](../../miniprogram/pages/order-detail/index.wxml#L184)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L191)|
|`playReviewVideo`|[bindtap / 171](../../miniprogram/pages/order-detail/index.wxml#L171)、[bindtap / 179](../../miniprogram/pages/order-detail/index.wxml#L179)、[bindretry / 184](../../miniprogram/pages/order-detail/index.wxml#L184)、[bindtap / 186](../../miniprogram/pages/order-detail/index.wxml#L186)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L168)|
|`onReviewVideoError`|[binderror / 183](../../miniprogram/pages/order-detail/index.wxml#L183)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L184)|
|`handleAction`|[bindtap / 195](../../miniprogram/pages/order-detail/index.wxml#L195)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L192)|
|`dismissFeedback`|[bindconfirm / 202](../../miniprogram/pages/order-detail/index.wxml#L202)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L66)|
|`closeShipment`|[bindclose / 203](../../miniprogram/pages/order-detail/index.wxml#L203)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L476)|
|`inputShipment`|[bindinput / 207](../../miniprogram/pages/order-detail/index.wxml#L207)、[bindinput / 209](../../miniprogram/pages/order-detail/index.wxml#L209)、[bindinput / 211](../../miniprogram/pages/order-detail/index.wxml#L211)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L475)|
|`submitShipment`|[bindtap / 215](../../miniprogram/pages/order-detail/index.wxml#L215)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L478)|
|`closeReturnSheet`|[bindclose / 218](../../miniprogram/pages/order-detail/index.wxml#L218)、[bindtap / 260](../../miniprogram/pages/order-detail/index.wxml#L260)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L263)|
|`receiptTimeChange`|[bindchange / 223](../../miniprogram/pages/order-detail/index.wxml#L223)、[bindchange / 225](../../miniprogram/pages/order-detail/index.wxml#L225)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L270)|
|`inputReturnField`|[bindinput / 227](../../miniprogram/pages/order-detail/index.wxml#L227)、[bindinput / 239](../../miniprogram/pages/order-detail/index.wxml#L239)、[bindinput / 241](../../miniprogram/pages/order-detail/index.wxml#L241)、[bindinput / 243](../../miniprogram/pages/order-detail/index.wxml#L243)、[bindinput / 252](../../miniprogram/pages/order-detail/index.wxml#L252)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L264)|
|`showOwnReturnAddresses`|[bindtap / 232](../../miniprogram/pages/order-detail/index.wxml#L232)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L308)|
|`chooseOwnReturnAddress`|[bindtap / 235](../../miniprogram/pages/order-detail/index.wxml#L235)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L323)|
|`loadOwnReturnAddresses`|[bindtap / 236](../../miniprogram/pages/order-detail/index.wxml#L236)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L310)|
|`openReturnRegion`|[bindtap / 245](../../miniprogram/pages/order-detail/index.wxml#L245)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L330)|
|`changeReturnRegion`|[bindtap / 247](../../miniprogram/pages/order-detail/index.wxml#L247)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L332)|
|`chooseReturnRegion`|[bindtap / 248](../../miniprogram/pages/order-detail/index.wxml#L248)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L342)|
|`closeReturnRegion`|[bindtap / 249](../../miniprogram/pages/order-detail/index.wxml#L249)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L331)|
|`submitReceipt`|[bindtap / 258](../../miniprogram/pages/order-detail/index.wxml#L258)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L285)|
|`submitReturnAddress`|[bindtap / 259](../../miniprogram/pages/order-detail/index.wxml#L259)|[页面实现](../../miniprogram/pages/order-detail/index.ts#L349)|

<a id="events-service-detail"></a>

## service-detail

当前 v1.0.1.7 模板实际绑定；[TS](../../miniprogram/pages/service-detail/index.ts) · [WXML](../../miniprogram/pages/service-detail/index.wxml)。服务端动作与恢复条件见相应功能文档。

|handler|模板事件/行|实现入口|
|---|---|---|
|`onSecondaryNavigationBack`|[bindback / 3](../../miniprogram/pages/service-detail/index.wxml#L3)|[页面实现](../../miniprogram/pages/service-detail/index.ts#L58)|
|`goBack`|[bindtap / 8](../../miniprogram/pages/service-detail/index.wxml#L8)、[bindtap / 11](../../miniprogram/pages/service-detail/index.wxml#L11)、[bindtap / 33](../../miniprogram/pages/service-detail/index.wxml#L33)、[bindprimary / 36](../../miniprogram/pages/service-detail/index.wxml#L36)|[页面实现](../../miniprogram/pages/service-detail/index.ts#L87)|

<a id="events-device-orders"></a>

## device-orders

当前 v1.0.1.7 模板实际绑定；[TS](../../miniprogram/pages/device-orders/index.ts) · [WXML](../../miniprogram/pages/device-orders/index.wxml)。服务端动作与恢复条件见相应功能文档。

|handler|模板事件/行|实现入口|
|---|---|---|
|`goBack`|[bindback / 3](../../miniprogram/pages/device-orders/index.wxml#L3)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`openLogin`|[bindtap / 8](../../miniprogram/pages/device-orders/index.wxml#L8)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`chooseFilter`|[bindtap / 12](../../miniprogram/pages/device-orders/index.wxml#L12)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`retryInitial`|[bindaction / 16](../../miniprogram/pages/device-orders/index.wxml#L16)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`openRental`|[bindtap / 22](../../miniprogram/pages/device-orders/index.wxml#L22)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`openOrder`|[bindtap / 27](../../miniprogram/pages/device-orders/index.wxml#L27)、[bindtap / 49](../../miniprogram/pages/device-orders/index.wxml#L49)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`retryRefresh`|[bindaction / 32](../../miniprogram/pages/device-orders/index.wxml#L32)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`retryLoadMore`|[bindaction / 34](../../miniprogram/pages/device-orders/index.wxml#L34)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`closeSheet`|[bindclose / 40](../../miniprogram/pages/device-orders/index.wxml#L40)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|
|`toggleRecordGroup`|[bindtap / 42](../../miniprogram/pages/device-orders/index.wxml#L42)|[共用订单页](../../miniprogram/shared/interaction/rental-orders-page.ts)|

<a id="events-cabinet-open"></a>

## cabinet-open

原任务结果：refresh 读取原 taskId；取件自动监控并显示通用弹窗，showResultFeedback/confirmFeedback/dismissFeedback 控制展示，goPickup 恢复原预留，goDetail 只导航原订单。query 仅用于归还，正常取件无需手动刷新。

[功能规则](fulfillment-after-sales.md#mp-cabinet-open) · [TS](../../miniprogram/pages/cabinet-open/index.ts) · [WXML](../../miniprogram/pages/cabinet-open/index.wxml)

<a id="events-cabinet-code"></a>

## cabinet-code

柜详情取件：onLoad/onShow 读取当前 scene；inputCredential 只接收六位字符串；submitCredential 立即打开弹窗并执行唯一原意图；confirmProgress/closeProgress 控制进度弹窗；acknowledgeFeedback 处理具体错误；goOrders 导航本人订单。页面可见期间自动 GET 原任务，onHide/onUnload 停止读取。

[功能规则](fulfillment-after-sales.md#mp-cabinet-code) · [TS](../../miniprogram/pages/cabinet-code/index.ts) · [WXML](../../miniprogram/pages/cabinet-code/index.wxml)

<a id="events-return-submit"></a>

## return-submit

当前 v1.0.1.7 模板实际绑定；[TS](../../miniprogram/pages/return-submit/index.ts) · [WXML](../../miniprogram/pages/return-submit/index.wxml)。服务端动作与恢复条件见相应功能文档。

|handler|模板事件/行|实现入口|
|---|---|---|
|`onSecondaryNavigationBack`|[bindback / 3](../../miniprogram/pages/return-submit/index.wxml#L3)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L296)|
|`refresh`|[bindtap / 8](../../miniprogram/pages/return-submit/index.wxml#L8)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L62)|
|`start`|[bindtap / 16](../../miniprogram/pages/return-submit/index.wxml#L16)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L159)|
|`openCabinet`|[bindtap / 17](../../miniprogram/pages/return-submit/index.wxml#L17)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L296)|
|`confirmAddress`|[bindtap / 24](../../miniprogram/pages/return-submit/index.wxml#L24)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L177)|
|`input`|[bindinput / 26](../../miniprogram/pages/return-submit/index.wxml#L26)、[bindinput / 28](../../miniprogram/pages/return-submit/index.wxml#L28)、[bindinput / 30](../../miniprogram/pages/return-submit/index.wxml#L30)、[bindinput / 63](../../miniprogram/pages/return-submit/index.wxml#L63)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L173)|
|`saveShipment`|[bindtap / 31](../../miniprogram/pages/return-submit/index.wxml#L31)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L178)|
|`addMedia`|[bindtap / 51](../../miniprogram/pages/return-submit/index.wxml#L51)、[bindtap / 52](../../miniprogram/pages/return-submit/index.wxml#L52)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L202)|
|`previewDraftPhoto`|[bindtap / 56](../../miniprogram/pages/return-submit/index.wxml#L56)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L141)|
|`removeMedia`|[bindtap / 59](../../miniprogram/pages/return-submit/index.wxml#L59)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L263)|
|`recoverUploads`|[bindtap / 61](../../miniprogram/pages/return-submit/index.wxml#L61)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L262)|
|`previewEvidencePhoto`|[bindtap / 68](../../miniprogram/pages/return-submit/index.wxml#L68)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L131)|
|`onEvidencePhotoError`|[binderror / 68](../../miniprogram/pages/return-submit/index.wxml#L68)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L136)|
|`onEvidenceVideoError`|[binderror / 69](../../miniprogram/pages/return-submit/index.wxml#L69)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L121)|
|`onEvidenceActivity`|[bindplay / 69](../../miniprogram/pages/return-submit/index.wxml#L69)、[bindtimeupdate / 69](../../miniprogram/pages/return-submit/index.wxml#L69)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L146)|
|`retryEvidenceVideo`|[bindtap / 72](../../miniprogram/pages/return-submit/index.wxml#L72)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L126)|
|`submit`|[bindtap / 81](../../miniprogram/pages/return-submit/index.wxml#L81)|[页面实现](../../miniprogram/pages/return-submit/index.ts#L268)|

<a id="events-cabinet-return"></a>

## cabinet-return

本人柜机归还：refresh 读取原订单与任务；goSelection 选择归还柜；resumeReservation 回原预留柜；query 查询原归还任务；goMaterials 独立补交材料。没有旧充电照片或手动确认关门步骤。

[功能规则](fulfillment-after-sales.md#mp-cabinet-return) · [TS](../../miniprogram/pages/cabinet-return/index.ts) · [WXML](../../miniprogram/pages/cabinet-return/index.wxml)

<a id="events-dispute"></a>

## dispute

当前 v1.0.1.7 模板实际绑定；[TS](../../miniprogram/pages/dispute/index.ts) · [WXML](../../miniprogram/pages/dispute/index.wxml)。服务端动作与恢复条件见相应功能文档。

|handler|模板事件/行|实现入口|
|---|---|---|
|`onSecondaryNavigationBack`|[bindback / 3](../../miniprogram/pages/dispute/index.wxml#L3)|[共用导航](../../miniprogram/shared/interaction/order-unavailable.ts)|
|`goOrders`|[bindtap / 4](../../miniprogram/pages/dispute/index.wxml#L4)|[不可用动作守卫](../../miniprogram/shared/interaction/order-unavailable.ts)|
|`previewSubmittedEvidence`|[bindtap / 8](../../miniprogram/pages/dispute/index.wxml#L8)、[bindtap / 21](../../miniprogram/pages/dispute/index.wxml#L21)|[页面实现](../../miniprogram/pages/dispute/index.ts#L35)|
|`previewSubmittedVideo`|[bindtap / 8](../../miniprogram/pages/dispute/index.wxml#L8)、[bindtap / 22](../../miniprogram/pages/dispute/index.wxml#L22)|[页面实现](../../miniprogram/pages/dispute/index.ts#L36)|
|`inputProposalAmount`|[bindinput / 27](../../miniprogram/pages/dispute/index.wxml#L27)|[页面实现](../../miniprogram/pages/dispute/index.ts#L50)|
|`inputProposalNote`|[bindinput / 27](../../miniprogram/pages/dispute/index.wxml#L27)、[bindinput / 28](../../miniprogram/pages/dispute/index.wxml#L28)|[页面实现](../../miniprogram/pages/dispute/index.ts#L51)|
|`addEvidence`|[bindtap / 27](../../miniprogram/pages/dispute/index.wxml#L27)、[bindtap / 27](../../miniprogram/pages/dispute/index.wxml#L27)、[bindtap / 28](../../miniprogram/pages/dispute/index.wxml#L28)|[页面实现](../../miniprogram/pages/dispute/index.ts#L37)|
|`previewEvidence`|[bindtap / 27](../../miniprogram/pages/dispute/index.wxml#L27)、[bindtap / 28](../../miniprogram/pages/dispute/index.wxml#L28)、[bindtap / 29](../../miniprogram/pages/dispute/index.wxml#L29)|[页面实现](../../miniprogram/pages/dispute/index.ts#L38)|
|`deleteEvidence`|[catchtap / 27](../../miniprogram/pages/dispute/index.wxml#L27)、[catchtap / 28](../../miniprogram/pages/dispute/index.wxml#L28)、[catchtap / 29](../../miniprogram/pages/dispute/index.wxml#L29)|[页面实现](../../miniprogram/pages/dispute/index.ts#L39)|
|`previewVideo`|[bindtap / 27](../../miniprogram/pages/dispute/index.wxml#L27)、[bindtap / 29](../../miniprogram/pages/dispute/index.wxml#L29)|[页面实现](../../miniprogram/pages/dispute/index.ts#L40)|
|`deleteVideo`|[catchtap / 27](../../miniprogram/pages/dispute/index.wxml#L27)、[catchtap / 29](../../miniprogram/pages/dispute/index.wxml#L29)|[页面实现](../../miniprogram/pages/dispute/index.ts#L41)|
|`inputDescription`|[bindinput / 29](../../miniprogram/pages/dispute/index.wxml#L29)|[页面实现](../../miniprogram/pages/dispute/index.ts#L52)|
|`addGenericEvidence`|[bindtap / 29](../../miniprogram/pages/dispute/index.wxml#L29)、[bindtap / 29](../../miniprogram/pages/dispute/index.wxml#L29)|[页面实现](../../miniprogram/pages/dispute/index.ts#L42)|
|`acceptProposal`|[bindtap / 30](../../miniprogram/pages/dispute/index.wxml#L30)|[页面实现](../../miniprogram/pages/dispute/index.ts#L43)|
|`startObjection`|[bindtap / 30](../../miniprogram/pages/dispute/index.wxml#L30)|[页面实现](../../miniprogram/pages/dispute/index.ts#L44)|
|`acceptTenantProposal`|[bindtap / 31](../../miniprogram/pages/dispute/index.wxml#L31)|[页面实现](../../miniprogram/pages/dispute/index.ts#L45)|
|`rejectTenantProposal`|[bindtap / 31](../../miniprogram/pages/dispute/index.wxml#L31)|[页面实现](../../miniprogram/pages/dispute/index.ts#L46)|
|`openSupport`|[bindtap / 32](../../miniprogram/pages/dispute/index.wxml#L32)、[bindtap / 33](../../miniprogram/pages/dispute/index.wxml#L33)、[bindtap / 34](../../miniprogram/pages/dispute/index.wxml#L34)|[不可用动作守卫](../../miniprogram/shared/interaction/order-unavailable.ts)|
|`submitProposal`|[bindtap / 32](../../miniprogram/pages/dispute/index.wxml#L32)|[页面实现](../../miniprogram/pages/dispute/index.ts#L47)|
|`submitObjection`|[bindtap / 33](../../miniprogram/pages/dispute/index.wxml#L33)|[页面实现](../../miniprogram/pages/dispute/index.ts#L48)|
|`submitGenericEvidence`|[bindtap / 34](../../miniprogram/pages/dispute/index.wxml#L34)|[页面实现](../../miniprogram/pages/dispute/index.ts#L49)|
|`goDetail`|[bindtap / 35](../../miniprogram/pages/dispute/index.wxml#L35)|[不可用动作守卫](../../miniprogram/shared/interaction/order-unavailable.ts)|

<a id="events-cabinets"></a>

## MP-CABINETS 柜机列表

[功能条件与反馈](discovery.md#mp-cabinets) · [TS](../../miniprogram/pages/cabinets/index.ts) · [WXML](../../miniprogram/pages/cabinets/index.wxml)

生命周期：`onShow` 请求柜机 API；`onHide/onUnload` 取消过期读取并释放图片状态。页面只读，不发柜机物理命令。

| handler | 绑定与触发 | 结果 |
| --- | --- | --- |
| `onSecondaryNavigationBack` | 页头返回 | 返回上一页，必要时回首页 |
| `chooseRegion` | 地区栏／空态切换区域 | 进入城市选择；返回后重新查询 |
| `openStores` | 供给类型“门店” | 转到门店列表 |
| `selectCabinet` | 左侧柜机项 | 仅切换当前响应中的柜机展示 |
| `openCabinet` | 右侧柜机摘要 | 进入公开只读柜机详情 |
| `openDevice` | 柜内设备模板卡片 | 进入设备详情，不创建订单 |

<a id="events-cabinet-detail"></a>

## cabinet-detail

柜机发现/归还：普通模式读取当前柜机与商品并支持导航；mode=return 读取本人订单、柜格及原任务，按 allowed_actions 预留、明确开门或恢复。取件扫码落地页见 cabinet-code。

[功能规则](fulfillment-after-sales.md#mp-cabinet-detail) · [TS](../../miniprogram/pages/cabinet-detail/index.ts) · [WXML](../../miniprogram/pages/cabinet-detail/index.wxml)

<a id="events-stores"></a>

## MP-STORES 门店列表

[功能条件与反馈](discovery.md#mp-stores) · [TS](../../miniprogram/pages/stores/index.ts) · [WXML](../../miniprogram/pages/stores/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/stores/index.ts#L58)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `chooseRegion` | `bindtap` | [4](../../miniprogram/pages/stores/index.wxml#L4)、[54](../../miniprogram/pages/stores/index.wxml#L54) | [63](../../miniprogram/pages/stores/index.ts#L63) | 间接/无 |
| `openCabinets` | `bindtap` | [10](../../miniprogram/pages/stores/index.wxml#L10) | [65](../../miniprogram/pages/stores/index.ts#L65) | 间接/无 |
| `openDevice` | `bindtap` | [42](../../miniprogram/pages/stores/index.wxml#L42) | [85](../../miniprogram/pages/stores/index.ts#L85) | 间接/无 |
| `openStore` | `bindtap` | [30](../../miniprogram/pages/stores/index.wxml#L30)、[40](../../miniprogram/pages/stores/index.wxml#L40) | [79](../../miniprogram/pages/stores/index.ts#L79) | 间接/无 |
| `selectRegion` | `bindtap` | [17](../../miniprogram/pages/stores/index.wxml#L17) | [71](../../miniprogram/pages/stores/index.ts#L71) | `setRegion` |

<a id="events-store-detail"></a>

## MP-STORE-DETAIL 门店详情

[功能条件与反馈](discovery.md#mp-store-detail) · [TS](../../miniprogram/pages/store-detail/index.ts) · [WXML](../../miniprogram/pages/store-detail/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/store-detail/index.ts#L24)、[onShow](../../miniprogram/pages/store-detail/index.ts#L31)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `goBack` | `bindtap` | [5](../../miniprogram/pages/store-detail/index.wxml#L5) | [47](../../miniprogram/pages/store-detail/index.ts#L47) | 间接/无 |
| `openDevice` | `bindtap` | [28](../../miniprogram/pages/store-detail/index.wxml#L28) | [40](../../miniprogram/pages/store-detail/index.ts#L40) | 间接/无 |
| `showAddress` | `bindtap` | [19](../../miniprogram/pages/store-detail/index.wxml#L19) | [45](../../miniprogram/pages/store-detail/index.ts#L45) | 间接/无 |
| `showContact` | `bindtap` | [23](../../miniprogram/pages/store-detail/index.wxml#L23) | [46](../../miniprogram/pages/store-detail/index.ts#L46) | 间接/无 |

<a id="events-region"></a>

## MP-REGION 城市选择

[功能条件与反馈](discovery.md#mp-region) · [TS](../../miniprogram/pages/region/index.ts) · [WXML](../../miniprogram/pages/region/index.wxml)

v1.0.1.5 当前来源：[onShow/loadCities](../../miniprogram/pages/region/index.ts#L10)、[onHide/onUnload](../../miniprogram/pages/region/index.ts#L23)。候选城市来自同一已发布 API dataset，搜索仅过滤本次结果；不再使用旧 `setRegion` 和内置城市投影。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `onSecondaryNavigationBack` | `bindback` | [3](../../miniprogram/pages/region/index.wxml#L3) | [25](../../miniprogram/pages/region/index.ts#L25) | 返回，失败时切首页 |
| `onSearchInput/clearSearch/onSearchConfirm` | `bindinput/bindtap/bindconfirm` | [4](../../miniprogram/pages/region/index.wxml#L4) | [17](../../miniprogram/pages/region/index.ts#L17) | 本次 API 城市过滤／清空／收键盘 |
| `loadCities` | `bindtap` | [12](../../miniprogram/pages/region/index.wxml#L12) | [11](../../miniprogram/pages/region/index.ts#L11) | `loadDiscoveryRegions → regionApi.children`，真实只读 |
| `selectCity` | `bindtap` | [9](../../miniprogram/pages/region/index.wxml#L9)、[10](../../miniprogram/pages/region/index.wxml#L10)、[13](../../miniprogram/pages/region/index.wxml#L13) | [20](../../miniprogram/pages/region/index.ts#L20) | `selectDiscoveryCity` 保存已读 datasetId/cityId/name 后返回 |
| `selectAllCities` | `bindtap` | [12](../../miniprogram/pages/region/index.wxml#L12) | [21](../../miniprogram/pages/region/index.ts#L21) | 清发现地区后返回，不写账户地址 |
| `jumpLetter` | `bindtap` | [18](../../miniprogram/pages/region/index.wxml#L18) | [22](../../miniprogram/pages/region/index.ts#L22) | 仅定位当前已存在字母分组 |

<a id="events-publish-eligibility"></a>

## MP-PUBLISH-ELIGIBILITY 发布条件

[功能条件与反馈](publishing.md#mp-publish-eligibility) · [TS](../../miniprogram/pages/publish-eligibility/index.ts) · [WXML](../../miniprogram/pages/publish-eligibility/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/publish-eligibility/index.ts#L25)、[onShow](../../miniprogram/pages/publish-eligibility/index.ts#L36)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `buyPublishService` | `bindtap` | [27](../../miniprogram/pages/publish-eligibility/index.wxml#L27) | [52](../../miniprogram/pages/publish-eligibility/index.ts#L52) | 间接/无 |
| `buyRentalService` | `bindtap` | [25](../../miniprogram/pages/publish-eligibility/index.wxml#L25) | [47](../../miniprogram/pages/publish-eligibility/index.ts#L47) | 间接/无 |
| `openCheck` | `bindtap` | [10](../../miniprogram/pages/publish-eligibility/index.wxml#L10)、[19](../../miniprogram/pages/publish-eligibility/index.wxml#L19) | [42](../../miniprogram/pages/publish-eligibility/index.ts#L42) | 间接/无 |
| `publish` | `bindtap` | [26](../../miniprogram/pages/publish-eligibility/index.wxml#L26) | [57](../../miniprogram/pages/publish-eligibility/index.ts#L57) | 间接/无 |

<a id="events-publish-quota"></a>

## MP-PUBLISH-QUOTA 发布额度购买

[功能条件与反馈](publishing.md#mp-publish-quota) · [TS](../../miniprogram/pages/publish-quota/index.ts) · [WXML](../../miniprogram/pages/publish-quota/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/publish-quota/index.ts#L23)、[onShow](../../miniprogram/pages/publish-quota/index.ts#L27)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `buyPackage` | `bindtap` | [13](../../miniprogram/pages/publish-quota/index.wxml#L13) | [41](../../miniprogram/pages/publish-quota/index.ts#L41) | `purchasePublishQuota` |

<a id="events-rental-service"></a>

## MP-RENTAL-SERVICE 出租服务额度

[功能条件与反馈](publishing.md#mp-rental-service) · [TS](../../miniprogram/pages/rental-service/index.ts) · [WXML](../../miniprogram/pages/rental-service/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/rental-service/index.ts#L63)、[onShow](../../miniprogram/pages/rental-service/index.ts#L67)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `buyPackage` | `bindtap` | [18](../../miniprogram/pages/rental-service/index.wxml#L18) | [91](../../miniprogram/pages/rental-service/index.ts#L91) | `purchaseService` |
| `chooseTab` | `bindtap` | [14](../../miniprogram/pages/rental-service/index.wxml#L14) | [83](../../miniprogram/pages/rental-service/index.ts#L83) | 间接/无 |
| `toggleRecords` | `bindtap` | [4](../../miniprogram/pages/rental-service/index.wxml#L4) | [89](../../miniprogram/pages/rental-service/index.ts#L89) | 间接/无 |

<a id="events-publish"></a>

## MP-PUBLISH 发布/编辑/查看/恢复草稿

[功能条件与反馈](publishing.md#mp-publish) · [TS](../../miniprogram/pages/publish/index.ts) · [WXML](../../miniprogram/pages/publish/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/publish/index.ts#L199)、[onShow](../../miniprogram/pages/publish/index.ts#L263)、[onHide](../../miniprogram/pages/publish/index.ts#L267)、[onUnload](../../miniprogram/pages/publish/index.ts#L269)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `applyPricingDates` | `bindtap` | [137](../../miniprogram/pages/publish/index.wxml#L137) | [385](../../miniprogram/pages/publish/index.ts#L385) | 间接/无 |
| `changeOriginAddress` | `bindchange` | [179](../../miniprogram/pages/publish/index.wxml#L179) | [338](../../miniprogram/pages/publish/index.ts#L338) | 间接/无 |
| `chooseCalendarDate` | `bindtap` | [121](../../miniprogram/pages/publish/index.wxml#L121) | [364](../../miniprogram/pages/publish/index.ts#L364) | 间接/无 |
| `chooseDelivery` | `bindtap` | [184](../../miniprogram/pages/publish/index.wxml#L184) | [312](../../miniprogram/pages/publish/index.ts#L312) | 间接/无 |
| `chooseRule` | `catchtap` | [186](../../miniprogram/pages/publish/index.wxml#L186) | [319](../../miniprogram/pages/publish/index.ts#L319) | 间接/无 |
| `chooseType` | `bindtap` | [29](../../miniprogram/pages/publish/index.wxml#L29) | [277](../../miniprogram/pages/publish/index.ts#L277) | 间接/无 |
| `clearDraft` | `bindtap` | [102](../../miniprogram/pages/publish/index.wxml#L102) | [467](../../miniprogram/pages/publish/index.ts#L467) | `deleteListingDraft` |
| `closeSheet` | `bindtap` | [108](../../miniprogram/pages/publish/index.wxml#L108) | [296](../../miniprogram/pages/publish/index.ts#L296) | 间接/无 |
| `confirmSheet` | `bindtap` | [193](../../miniprogram/pages/publish/index.wxml#L193) | [298](../../miniprogram/pages/publish/index.ts#L298) | 间接/无 |
| `deleteMedia` | `catchtap` | [18](../../miniprogram/pages/publish/index.wxml#L18)、[172](../../miniprogram/pages/publish/index.wxml#L172) | [427](../../miniprogram/pages/publish/index.ts#L427) | 间接/无 |
| `handleNavigationBack` | `bindback` | [3](../../miniprogram/pages/publish/index.wxml#L3) | [302](../../miniprogram/pages/publish/index.ts#L302) | 间接/无 |
| `input` | `bindinput` | [37](../../miniprogram/pages/publish/index.wxml#L37)、[38](../../miniprogram/pages/publish/index.wxml#L38)、[41](../../miniprogram/pages/publish/index.wxml#L41)、[44](../../miniprogram/pages/publish/index.wxml#L44)、[150](../../miniprogram/pages/publish/index.wxml#L150)、[154](../../miniprogram/pages/publish/index.wxml#L154)、[160](../../miniprogram/pages/publish/index.wxml#L160)、[161](../../miniprogram/pages/publish/index.wxml#L161)、[165](../../miniprogram/pages/publish/index.wxml#L165)、[180](../../miniprogram/pages/publish/index.wxml#L180)、[187](../../miniprogram/pages/publish/index.wxml#L187)、[188](../../miniprogram/pages/publish/index.wxml#L188) | [326](../../miniprogram/pages/publish/index.ts#L326) | 间接/无 |
| `openSheet` | `bindtap` | [46](../../miniprogram/pages/publish/index.wxml#L46)、[55](../../miniprogram/pages/publish/index.wxml#L55)、[61](../../miniprogram/pages/publish/index.wxml#L61)、[68](../../miniprogram/pages/publish/index.wxml#L68)、[77](../../miniprogram/pages/publish/index.wxml#L77)、[81](../../miniprogram/pages/publish/index.wxml#L81)、[85](../../miniprogram/pages/publish/index.wxml#L85) | [282](../../miniprogram/pages/publish/index.ts#L282) | 间接/无 |
| `previewMedia` | `bindtap` | [15](../../miniprogram/pages/publish/index.wxml#L15)、[172](../../miniprogram/pages/publish/index.wxml#L172) | [418](../../miniprogram/pages/publish/index.ts#L418) | 间接/无 |
| `resetPricingDates` | `bindtap` | [136](../../miniprogram/pages/publish/index.wxml#L136) | [380](../../miniprogram/pages/publish/index.ts#L380) | 间接/无 |
| `saveDraft` | `bindtap` | [103](../../miniprogram/pages/publish/index.wxml#L103) | [465](../../miniprogram/pages/publish/index.ts#L465) | 间接/无 |
| `selectImage` | `bindtap` | [14](../../miniprogram/pages/publish/index.wxml#L14)、[171](../../miniprogram/pages/publish/index.wxml#L171) | [399](../../miniprogram/pages/publish/index.ts#L399) | 间接/无 |
| `stopSheetTap` | `catchtap` | [109](../../miniprogram/pages/publish/index.wxml#L109) | [310](../../miniprogram/pages/publish/index.ts#L310) | 间接/无 |
| `submit` | `bindtap` | [104](../../miniprogram/pages/publish/index.wxml#L104) | [522](../../miniprogram/pages/publish/index.ts#L522) | `updateListing`、`createListing`、`deleteListingDraft`、`completeGrowthTask` |

<a id="events-listings"></a>

## MP-LISTINGS 我的出租设备

[功能条件与反馈](publishing.md#mp-listings) · [TS](../../miniprogram/pages/listings/index.ts) · [WXML](../../miniprogram/pages/listings/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/listings/index.ts#L32)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `chooseFilter` | `bindtap` | [4](../../miniprogram/pages/listings/index.wxml#L4) | [36](../../miniprogram/pages/listings/index.ts#L36) | 间接/无 |
| `closePrice` | `catchtap`、`bindtap` | [25](../../miniprogram/pages/listings/index.wxml#L25)、[32](../../miniprogram/pages/listings/index.wxml#L32) | [49](../../miniprogram/pages/listings/index.ts#L49) | 间接/无 |
| `continueDraft` | `bindtap` | [13](../../miniprogram/pages/listings/index.wxml#L13) | [67](../../miniprogram/pages/listings/index.ts#L67) | 间接/无 |
| `editListing` | `bindtap` | [19](../../miniprogram/pages/listings/index.wxml#L19) | [75](../../miniprogram/pages/listings/index.ts#L75) | 间接/无 |
| `inputPrice` | `bindinput` | [29](../../miniprogram/pages/listings/index.wxml#L29)、[30](../../miniprogram/pages/listings/index.wxml#L30) | [51](../../miniprogram/pages/listings/index.ts#L51) | 间接/无 |
| `relist` | `bindtap` | [17](../../miniprogram/pages/listings/index.wxml#L17) | [66](../../miniprogram/pages/listings/index.ts#L66) | `setListingStatus` |
| `setPrice` | `bindtap` | [14](../../miniprogram/pages/listings/index.wxml#L14) | [37](../../miniprogram/pages/listings/index.ts#L37) | 间接/无（明确提示缺少权威草稿 id） |
| `stopTap` | `catchtap` | [26](../../miniprogram/pages/listings/index.wxml#L26) | [50](../../miniprogram/pages/listings/index.ts#L50) | 间接/无 |
| `submitPrice` | `bindtap` | [32](../../miniprogram/pages/listings/index.wxml#L32) | [52](../../miniprogram/pages/listings/index.ts#L52) | `setListingPrice` |
| `takeDown` | `bindtap` | [16](../../miniprogram/pages/listings/index.wxml#L16) | [65](../../miniprogram/pages/listings/index.ts#L65) | `setListingStatus` |
| `viewMaterial` | `bindtap` | [15](../../miniprogram/pages/listings/index.wxml#L15)、[18](../../miniprogram/pages/listings/index.wxml#L18) | [68](../../miniprogram/pages/listings/index.ts#L68) | 间接/无 |

<a id="events-listing-price"></a>

## MP-LISTING-PRICE 草稿设价并提交审核

[功能条件与反馈](publishing.md#mp-listing-price) · [TS](../../miniprogram/pages/listing-price/index.ts) · [WXML](../../miniprogram/pages/listing-price/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/listing-price/index.ts#L101)、[onShow](../../miniprogram/pages/listing-price/index.ts#L106)、[onHide](../../miniprogram/pages/listing-price/index.ts#L113)、[onUnload](../../miniprogram/pages/listing-price/index.ts#L117)。仅接受 `draft_id`，或兼容发布页的 `mode=draft&id`；访客或缺少草稿标识时不发起请求。写请求必须以持久化意图、回执校验和同一草稿的权威 GET 回读闭环后才展示成功。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `changeEndDate` | `bindchange` | [45](../../miniprogram/pages/listing-price/index.wxml#L45) | [170](../../miniprogram/pages/listing-price/index.ts#L170) | 间接/无 |
| `changeStartDate` | `bindchange` | [43](../../miniprogram/pages/listing-price/index.wxml#L43) | [163](../../miniprogram/pages/listing-price/index.ts#L163) | 间接/无 |
| `confirm` | `bindtap` | [57](../../miniprogram/pages/listing-price/index.wxml#L57) | [177](../../miniprogram/pages/listing-price/index.ts#L177) | `updateOwnAssetDraftFromMini`、`getOwnAssetDraft`、`submitOwnAssetDraft`、`getOwnAssetDraft` |
| `edit` | `bindtap` | [57](../../miniprogram/pages/listing-price/index.wxml#L57) | [247](../../miniprogram/pages/listing-price/index.ts#L247) | 间接/无 |
| `goBack` | `bindaction` | [7](../../miniprogram/pages/listing-price/index.wxml#L7) | [253](../../miniprogram/pages/listing-price/index.ts#L253) | 间接/无 |
| `handleErrorAction` | `bindaction` | [6](../../miniprogram/pages/listing-price/index.wxml#L6) | [155](../../miniprogram/pages/listing-price/index.ts#L155) | `getOwnAssetDraft` |
| `input` | `bindinput` | [31](../../miniprogram/pages/listing-price/index.wxml#L31)、[37](../../miniprogram/pages/listing-price/index.wxml#L37) | [156](../../miniprogram/pages/listing-price/index.ts#L156) | 间接/无 |
| `onSecondaryNavigationBack` | `bindback` | [3](../../miniprogram/pages/listing-price/index.wxml#L3) | [252](../../miniprogram/pages/listing-price/index.ts#L252) | 间接/无 |
| `openLogin` | `bindaction` | [4](../../miniprogram/pages/listing-price/index.wxml#L4) | [251](../../miniprogram/pages/listing-price/index.ts#L251) | 间接/无 |

<a id="events-wallet"></a>

## MP-WALLET 资金账户

[功能条件与反馈](wallet.md#mp-wallet) · [TS](../../miniprogram/pages/wallet/index.ts) · [WXML](../../miniprogram/pages/wallet/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/wallet/index.ts#L36)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `chooseTab` | `bindtap` | [24](../../miniprogram/pages/wallet/index.wxml#L24) | [74](../../miniprogram/pages/wallet/index.ts#L74) | 间接/无 |
| `openWithdrawal` | `bindtap` | [6](../../miniprogram/pages/wallet/index.wxml#L6) | [81](../../miniprogram/pages/wallet/index.ts#L81) | 间接/无 |
| `openWithdrawalRecords` | `bindtap` | [18](../../miniprogram/pages/wallet/index.wxml#L18) | [82](../../miniprogram/pages/wallet/index.ts#L82) | 间接/无 |

<a id="events-withdrawal"></a>

## MP-WITHDRAWAL 提现申请与记录

[功能条件与反馈](wallet.md#mp-withdrawal) · [TS](../../miniprogram/pages/withdrawal/index.ts) · [WXML](../../miniprogram/pages/withdrawal/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/withdrawal/index.ts#L91)、[onShow](../../miniprogram/pages/withdrawal/index.ts#L96)、[onHide](../../miniprogram/pages/withdrawal/index.ts#L97)、[onUnload](../../miniprogram/pages/withdrawal/index.ts#L98)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `contactSupport` | `bindsecondary` | [20](../../miniprogram/pages/withdrawal/index.wxml#L20) | [173](../../miniprogram/pages/withdrawal/index.ts#L173) | 间接/无 |
| `fillAll` | `bindtap` | [7](../../miniprogram/pages/withdrawal/index.wxml#L7) | [108](../../miniprogram/pages/withdrawal/index.ts#L108) | 间接/无 |
| `input` | `bindinput` | [7](../../miniprogram/pages/withdrawal/index.wxml#L7) | [107](../../miniprogram/pages/withdrawal/index.ts#L107) | 间接/无 |
| `submit` | `bindprimary` | [20](../../miniprogram/pages/withdrawal/index.wxml#L20) | [110](../../miniprogram/pages/withdrawal/index.ts#L110) | `submitWithdrawal` |
| `withdrawalAction` | `bindtap` | [16](../../miniprogram/pages/withdrawal/index.wxml#L16) | [147](../../miniprogram/pages/withdrawal/index.ts#L147) | `retryWithdrawal`、`queryWithdrawal` |

<a id="events-login"></a>

## MP-LOGIN 登录

[功能条件与反馈](account.md#mp-login) · [TS](../../miniprogram/pages/login/index.ts) · [WXML](../../miniprogram/pages/login/index.wxml)

v1.0.1.5 当前来源：[onLoad](../../miniprogram/pages/login/index.ts#L17)、[onUnload](../../miniprogram/pages/login/index.ts#L21)、[login-sheet](../../miniprogram/components/login-sheet/index.ts)。页面只有真实登录组件，不再有手机号／短信码输入或本地登录命令。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `onWechatLogin` | `bindwechatlogin` | [3](../../miniprogram/pages/login/index.wxml#L3) | [26](../../miniprogram/pages/login/index.ts#L26) | `accountApi.login`，真实微信 code 交换 |
| `onPhoneLogin` | `bindphonelogin` | [3](../../miniprogram/pages/login/index.wxml#L3) | [27](../../miniprogram/pages/login/index.ts#L27) | `accountApi.phoneLogin`，真实 phone_code/code 交换 |
| `onLoginLegal` | `bindlegal` | [3](../../miniprogram/pages/login/index.wxml#L3) | [29](../../miniprogram/pages/login/index.ts#L29) | `openLoginLegal`，仅两项法律文档 |
| `onLoginCancel` | `bindcancel` | [3](../../miniprogram/pages/login/index.wxml#L3) | [30](../../miniprogram/pages/login/index.ts#L30) | 游客返回／首页，不建立会话 |
| `login-sheet.toggleAgree` | 组件 `bindtap` | [15](../../miniprogram/components/login-sheet/index.wxml#L15) | [17](../../miniprogram/components/login-sheet/index.ts#L17) | 实际 agreed/aria-checked/checked marker 同步 |
| `login-sheet.openLegal` | 组件 `catchtap` | [17](../../miniprogram/components/login-sheet/index.wxml#L17) | [20](../../miniprogram/components/login-sheet/index.ts#L20) | 只触发有限 legal 事件，不切同意态 |
| `login-sheet.quickLogin/onPhoneAuthorized` | 组件 `bindtap/bindgetphonenumber` | [9](../../miniprogram/components/login-sheet/index.wxml#L9)、[11](../../miniprogram/components/login-sheet/index.wxml#L11) | [24](../../miniprogram/components/login-sheet/index.ts#L24)、[33](../../miniprogram/components/login-sheet/index.ts#L33) | 协议／提交守卫后触发页面登录事件；不合成会话 |
| `login-sheet.phoneConsent/confirmConsent/closeConsentModal` | 组件 `bindtap/catchtap` | [10](../../miniprogram/components/login-sheet/index.wxml#L10)、[25](../../miniprogram/components/login-sheet/index.wxml#L25) | [29](../../miniprogram/components/login-sheet/index.ts#L29)、[19](../../miniprogram/components/login-sheet/index.ts#L19)、[18](../../miniprogram/components/login-sheet/index.ts#L18) | 同意只设置协议并关闭提示，需用户再点登录 |
| `login-sheet.close` | 组件 `bindtap/catchtap` | [2](../../miniprogram/components/login-sheet/index.wxml#L2)、[5](../../miniprogram/components/login-sheet/index.wxml#L5)、[19](../../miniprogram/components/login-sheet/index.wxml#L19) | [9](../../miniprogram/components/login-sheet/index.ts#L9) | 非 submitting 时关闭并触发 cancel |

<a id="events-membership"></a>

## MP-MEMBERSHIP 会员中心

[功能条件与反馈](membership.md#mp-membership) · [TS](../../miniprogram/pages/membership/index.ts) · [WXML](../../miniprogram/pages/membership/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/membership/index.ts#L56)、[onShow](../../miniprogram/pages/membership/index.ts#L60)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `copyInvite` | `bindtap` | [79](../../miniprogram/pages/membership/index.wxml#L79) | [92](../../miniprogram/pages/membership/index.ts#L92) | 间接/无 |
| `goBack` | `bindtap` | [6](../../miniprogram/pages/membership/index.wxml#L6) | [94](../../miniprogram/pages/membership/index.ts#L94) | 间接/无 |
| `openBalanceDetails` | `bindtap` | [37](../../miniprogram/pages/membership/index.wxml#L37) | [89](../../miniprogram/pages/membership/index.ts#L89) | 间接/无 |
| `openCheckIn` | `bindtap` | [41](../../miniprogram/pages/membership/index.wxml#L41) | [91](../../miniprogram/pages/membership/index.ts#L91) | 间接/无 |
| `openDetails` | `bindtap` | [26](../../miniprogram/pages/membership/index.wxml#L26) | [93](../../miniprogram/pages/membership/index.ts#L93) | 间接/无 |
| `openShop` | `bindtap` | [45](../../miniprogram/pages/membership/index.wxml#L45) | [90](../../miniprogram/pages/membership/index.ts#L90) | 间接/无 |
| `openStarDetails` | `bindtap` | [21](../../miniprogram/pages/membership/index.wxml#L21) | [88](../../miniprogram/pages/membership/index.ts#L88) | 间接/无 |
| `openTask` | `bindtap` | [54](../../miniprogram/pages/membership/index.wxml#L54)、[67](../../miniprogram/pages/membership/index.wxml#L67) | [68](../../miniprogram/pages/membership/index.ts#L68) | 间接/无 |

<a id="events-level-rights"></a>

## MP-LEVEL-RIGHTS 等级权益

[功能条件与反馈](membership.md#mp-level-rights) · [TS](../../miniprogram/pages/level-rights/index.ts) · [WXML](../../miniprogram/pages/level-rights/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/level-rights/index.ts#L58)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `openGrowthTasks` | `bindtap` | [14](../../miniprogram/pages/level-rights/index.wxml#L14) | [68](../../miniprogram/pages/level-rights/index.ts#L68) | 间接/无 |
| `openStarLedger` | `bindtap` | [15](../../miniprogram/pages/level-rights/index.wxml#L15) | [67](../../miniprogram/pages/level-rights/index.ts#L67) | 间接/无 |

<a id="events-growth-tasks"></a>

## MP-GROWTH-TASKS 成长任务

[功能条件与反馈](membership.md#mp-growth-tasks) · [TS](../../miniprogram/pages/growth-tasks/index.ts) · [WXML](../../miniprogram/pages/growth-tasks/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/growth-tasks/index.ts#L67)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `openBrowseMission` | `bindtap` | [32](../../miniprogram/pages/growth-tasks/index.wxml#L32) | [102](../../miniprogram/pages/growth-tasks/index.ts#L102) | 间接/无 |
| `openMission` | `bindtap` | [24](../../miniprogram/pages/growth-tasks/index.wxml#L24) | [88](../../miniprogram/pages/growth-tasks/index.ts#L88) | 间接/无 |
| `openTask` | `bindtap` | [16](../../miniprogram/pages/growth-tasks/index.wxml#L16) | [77](../../miniprogram/pages/growth-tasks/index.ts#L77) | 间接/无 |
| `toggleBrowse` | `bindtap` | [30](../../miniprogram/pages/growth-tasks/index.wxml#L30) | [100](../../miniprogram/pages/growth-tasks/index.ts#L100) | 间接/无 |

<a id="events-powder-ledger"></a>

## MP-POWDER-LEDGER 粉钻明细

[功能条件与反馈](membership.md#mp-powder-ledger) · [TS](../../miniprogram/pages/powder-ledger/index.ts) · [WXML](../../miniprogram/pages/powder-ledger/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/powder-ledger/index.ts#L82)、[onUnload](../../miniprogram/pages/powder-ledger/index.ts#L98)、[onPullDownRefresh](../../miniprogram/pages/powder-ledger/index.ts#L103)、[onReachBottom](../../miniprogram/pages/powder-ledger/index.ts#L115)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `goCheckIn` | `bindtap` | [24](../../miniprogram/pages/powder-ledger/index.wxml#L24) | [143](../../miniprogram/pages/powder-ledger/index.ts#L143) | 间接/无 |
| `goLottery` | `bindtap` | [26](../../miniprogram/pages/powder-ledger/index.wxml#L26) | [145](../../miniprogram/pages/powder-ledger/index.ts#L145) | 间接/无 |
| `goMall` | `bindtap` | [25](../../miniprogram/pages/powder-ledger/index.wxml#L25) | [144](../../miniprogram/pages/powder-ledger/index.ts#L144) | 间接/无 |
| `openWallet` | `bindtap` | [53](../../miniprogram/pages/powder-ledger/index.wxml#L53) | [174](../../miniprogram/pages/powder-ledger/index.ts#L174) | 间接/无 |
| `retryInitial` | `bindaction` | [38](../../miniprogram/pages/powder-ledger/index.wxml#L38) | [159](../../miniprogram/pages/powder-ledger/index.ts#L159) | 间接/无 |
| `retryLoadMore` | `bindaction` | [47](../../miniprogram/pages/powder-ledger/index.wxml#L47) | [167](../../miniprogram/pages/powder-ledger/index.ts#L167) | 间接/无 |
| `retryRefresh` | `bindaction` | [45](../../miniprogram/pages/powder-ledger/index.wxml#L45) | [163](../../miniprogram/pages/powder-ledger/index.ts#L163) | 间接/无 |
| `setLedgerFilter` | `bindtap` | [32](../../miniprogram/pages/powder-ledger/index.wxml#L32)、[33](../../miniprogram/pages/powder-ledger/index.wxml#L33)、[34](../../miniprogram/pages/powder-ledger/index.wxml#L34) | [148](../../miniprogram/pages/powder-ledger/index.ts#L148) | 间接/无 |
| `showRules` | `bindtap` | [6](../../miniprogram/pages/powder-ledger/index.wxml#L6) | [146](../../miniprogram/pages/powder-ledger/index.ts#L146) | 间接/无 |

<a id="events-powder-mall"></a>

## MP-POWDER-MALL 粉钻商城

[功能条件与反馈](membership.md#mp-powder-mall) · [TS](../../miniprogram/pages/powder-mall/index.ts) · [WXML](../../miniprogram/pages/powder-mall/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/powder-mall/index.ts#L142)、[onHide](../../miniprogram/pages/powder-mall/index.ts#L155)、[onUnload](../../miniprogram/pages/powder-mall/index.ts#L156)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `goCheckIn` | `bindtap` | [9](../../miniprogram/pages/powder-mall/index.wxml#L9) | [159](../../miniprogram/pages/powder-mall/index.ts#L159) | 间接/无 |
| `goLedger` | `bindtap` | [8](../../miniprogram/pages/powder-mall/index.wxml#L8) | [158](../../miniprogram/pages/powder-mall/index.ts#L158) | 间接/无 |
| `goLottery` | `bindtap` | [9](../../miniprogram/pages/powder-mall/index.wxml#L9) | [160](../../miniprogram/pages/powder-mall/index.ts#L160) | 间接/无 |
| `redeem` | `bindtap` | [20](../../miniprogram/pages/powder-mall/index.wxml#L20)、[34](../../miniprogram/pages/powder-mall/index.wxml#L34) | [168](../../miniprogram/pages/powder-mall/index.ts#L168) | `spendDiamonds` |
| `selectCategory` | `bindtap` | [15](../../miniprogram/pages/powder-mall/index.wxml#L15) | [162](../../miniprogram/pages/powder-mall/index.ts#L162) | 间接/无 |

<a id="events-star-ledger"></a>

## MP-STAR-LEDGER 星光明细

[功能条件与反馈](membership.md#mp-star-ledger) · [TS](../../miniprogram/pages/star-ledger/index.ts) · [WXML](../../miniprogram/pages/star-ledger/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/star-ledger/index.ts#L35)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `openLevelRights` | `bindtap` | [8](../../miniprogram/pages/star-ledger/index.wxml#L8) | [46](../../miniprogram/pages/star-ledger/index.ts#L46) | 间接/无 |
| `openTasks` | `bindtap` | [8](../../miniprogram/pages/star-ledger/index.wxml#L8) | [45](../../miniprogram/pages/star-ledger/index.ts#L45) | 间接/无 |

<a id="events-lottery"></a>

## MP-LOTTERY 每日抽奖

[功能条件与反馈](membership.md#mp-lottery) · [TS](../../miniprogram/pages/lottery/index.ts) · [WXML](../../miniprogram/pages/lottery/index.wxml)

生命周期/页面回调：[onShow](../../miniprogram/pages/lottery/index.ts#L44)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `closeResult` | `bindtap` | [42](../../miniprogram/pages/lottery/index.wxml#L42)、[46](../../miniprogram/pages/lottery/index.wxml#L46) | [62](../../miniprogram/pages/lottery/index.ts#L62) | 间接/无 |
| `draw` | `bindtap` | [15](../../miniprogram/pages/lottery/index.wxml#L15) | [65](../../miniprogram/pages/lottery/index.ts#L65) | `drawLottery` |
| `goBrowse` | `bindtap` | [22](../../miniprogram/pages/lottery/index.wxml#L22) | [59](../../miniprogram/pages/lottery/index.ts#L59) | 间接/无 |
| `goCheckIn` | `bindtap` | [24](../../miniprogram/pages/lottery/index.wxml#L24) | [58](../../miniprogram/pages/lottery/index.ts#L58) | 间接/无 |
| `goOrders` | `bindtap` | [23](../../miniprogram/pages/lottery/index.wxml#L23) | [60](../../miniprogram/pages/lottery/index.ts#L60) | 间接/无 |
| `noop` | `catchtap` | [43](../../miniprogram/pages/lottery/index.wxml#L43) | [61](../../miniprogram/pages/lottery/index.ts#L61) | 间接/无 |
| `showRules` | `bindtap` | [38](../../miniprogram/pages/lottery/index.wxml#L38) | [63](../../miniprogram/pages/lottery/index.ts#L63) | 间接/无 |

<a id="events-no-deposit"></a>

## MP-NO-DEPOSIT 押金与免押说明

[功能条件与反馈](membership.md#mp-no-deposit) · [TS](../../miniprogram/pages/no-deposit/index.ts) · [WXML](../../miniprogram/pages/no-deposit/index.wxml)

生命周期/页面回调：[onLoad](../../miniprogram/pages/no-deposit/index.ts#L19)、[onShow](../../miniprogram/pages/no-deposit/index.ts#L24)。

当前WXML无绑定事件。

<a id="events-components-bottom-actions-index"></a>

## components/bottom-actions/index

[TS](../../miniprogram/components/bottom-actions/index.ts) · [WXML](../../miniprogram/components/bottom-actions/index.wxml)

生命周期/页面回调：[attached](../../miniprogram/components/bottom-actions/index.ts#L30)、[detached](../../miniprogram/components/bottom-actions/index.ts#L31)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `onPrimary` | `bindtap` | [5](../../miniprogram/components/bottom-actions/index.wxml#L5) | [64](../../miniprogram/components/bottom-actions/index.ts#L64) | 间接/无 |
| `onSecondary` | `bindtap` | [4](../../miniprogram/components/bottom-actions/index.wxml#L4) | [68](../../miniprogram/components/bottom-actions/index.ts#L68) | 间接/无 |

<a id="events-components-cabinet-credential-input-index"></a>

## components/cabinet-credential-input/index

[TS](../../miniprogram/components/cabinet-credential-input/index.ts) · [WXML](../../miniprogram/components/cabinet-credential-input/index.wxml)

生命周期/页面回调：[attached](../../miniprogram/components/cabinet-credential-input/index.ts#L33)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `onInput` | `bindinput` | [5](../../miniprogram/components/cabinet-credential-input/index.wxml#L5) | [40](../../miniprogram/components/cabinet-credential-input/index.ts#L40) | 间接/无 |

<a id="events-components-confirmation-dialog-index"></a>

## components/confirmation-dialog/index

[TS](../../miniprogram/components/confirmation-dialog/index.ts) · [WXML](../../miniprogram/components/confirmation-dialog/index.wxml)

生命周期/页面回调：无显式声明。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `onCancel` | `bindtap` | [7](../../miniprogram/components/confirmation-dialog/index.wxml#L7) | [12](../../miniprogram/components/confirmation-dialog/index.ts#L12) | 间接/无 |
| `onConfirm` | `bindtap` | [8](../../miniprogram/components/confirmation-dialog/index.wxml#L8) | [15](../../miniprogram/components/confirmation-dialog/index.ts#L15) | 间接/无 |

<a id="events-components-media-state-index"></a>

## components/media-state/index

[TS](../../miniprogram/components/media-state/index.ts) · [WXML](../../miniprogram/components/media-state/index.wxml)

生命周期/页面回调：[attached](../../miniprogram/components/media-state/index.ts#L27)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `onError` | `binderror` | [2](../../miniprogram/components/media-state/index.wxml#L2) | [42](../../miniprogram/components/media-state/index.ts#L42) | 间接/无 |
| `onLoad` | `bindload` | [2](../../miniprogram/components/media-state/index.wxml#L2) | [38](../../miniprogram/components/media-state/index.ts#L38) | 间接/无 |
| `retry` | `bindtap` | [11](../../miniprogram/components/media-state/index.wxml#L11) | [46](../../miniprogram/components/media-state/index.ts#L46) | 间接/无 |

<a id="events-components-page-header-index"></a>

## components/page-header/index

[TS](../../miniprogram/components/page-header/index.ts) · [WXML](../../miniprogram/components/page-header/index.wxml)

生命周期/页面回调：[attached](../../miniprogram/components/page-header/index.ts#L14)、[show](../../miniprogram/components/page-header/index.ts#L17)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `onAction` | `bindtap` | [6](../../miniprogram/components/page-header/index.wxml#L6) | [26](../../miniprogram/components/page-header/index.ts#L26) | 间接/无 |
| `onBack` | `bindtap` | [3](../../miniprogram/components/page-header/index.wxml#L3) | [25](../../miniprogram/components/page-header/index.ts#L25) | 间接/无 |

<a id="events-components-page-shell-index"></a>

## components/page-shell/index

[TS](../../miniprogram/components/page-shell/index.ts) · [WXML](../../miniprogram/components/page-shell/index.wxml)

生命周期/页面回调：无显式声明。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `onLower` | `bindscrolltolower` | [3](../../miniprogram/components/page-shell/index.wxml#L3) | [9](../../miniprogram/components/page-shell/index.ts#L9) | 间接/无 |

<a id="events-components-status-view-index"></a>

## components/status-view/index

[TS](../../miniprogram/components/status-view/index.ts) · [WXML](../../miniprogram/components/status-view/index.wxml)

生命周期/页面回调：[attached](../../miniprogram/components/status-view/index.ts#L62)、[detached](../../miniprogram/components/status-view/index.ts#L63)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `onAction` | `bindtap` | [7](../../miniprogram/components/status-view/index.wxml#L7) | [86](../../miniprogram/components/status-view/index.ts#L86) | 间接/无 |
| `onIllustrationError` | `binderror` | [3](../../miniprogram/components/status-view/index.wxml#L3) | [71](../../miniprogram/components/status-view/index.ts#L71) | 间接/无 |

<a id="events-custom-tab-bar-index"></a>

## custom-tab-bar/index

[TS](../../miniprogram/custom-tab-bar/index.ts) · [WXML](../../miniprogram/custom-tab-bar/index.wxml)

生命周期/页面回调：[attached](../../miniprogram/custom-tab-bar/index.ts#L24)。

| handler | 绑定类型 | WXML触发位置 | TS实现 | 直接命令 |
| --- | --- | --- | --- | --- |
| `switchTab` | `bindtap` | [7](../../miniprogram/custom-tab-bar/index.wxml#L7) | [33](../../miniprogram/custom-tab-bar/index.ts#L33) | 间接/无 |
