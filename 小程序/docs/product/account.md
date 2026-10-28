# 登录、我的与个人资料

身份业务关联 `F-IDENTITY-RISK`；账户路由的实际鉴权与能力缺口见[实现边界](implementation-gaps.md)。本地登录不是微信登录联调结果。

<a id="mp-login"></a>

## MP-LOGIN 登录

- 路由：`pages/login/index`。页面只承载 `page-shell > login-sheet`；成功去向由白名单来源和当前导航栈决定，不接受任意回跳 URL。
- 来源：[TS](../../miniprogram/pages/login/index.ts)、[WXML](../../miniprogram/pages/login/index.wxml)、[真实登录 API](../../miniprogram/shared/api/account-api.ts)、[登录组件](../../miniprogram/components/login-sheet/index.ts)、[会话保存](../../miniprogram/shared/session/api-session.ts)。测试：`login-sheet-behavior.test.ts`、`phone-login-api.test.ts`、`cabinet-detail-guest-flow.test.ts`；真实运行时验收按综合 Change 的当前七场景及证据对账。

| 交互/handler | 触发条件与必要校验 | 执行与反馈 |
| --- | --- | --- |
| 协议绑定 `login-sheet.toggleAgree` | 点击协议勾选区域 | 在实际 agreed false/true 之间切换，实际 `aria-checked` 与 checked marker 同步；法律链接单独触发，不改变同意态 |
| 协议详情 `openLegal → onLoginLegal` | legal 只接受 user-agreement/privacy-policy | 经 `openLoginLegal` 进入对应 info-guide，不自动勾选协议 |
| 微信登录 `quickLogin → onWechatLogin` | 已同意且非 submitting；未同意只打开同意弹窗 | `accountApi.login()` 调用真实 `wx.login`，向 `/v1/auth/wechat-mini/sessions` 交换凭证；只有有效服务端会话保存成功才完成登录 |
| 手机号授权 `onPhoneAuthorized → onPhoneLogin` | 已同意、非 submitting，原生授权必须返回非空 phone code | 再取真实 `wx.login` code，向 `/v1/auth/wechat-mini/phone-sessions` 交换；授权拒绝／接口错误留在组件显示错误，不生成合成会话 |
| 同意／取消弹窗 `confirmConsent/closeConsentModal` | 用户选择同意或关闭提示 | 同意只设置 agreed 并关闭提示，不自动发送登录请求；关闭提示不自动同意 |
| 登录请求状态 `runLoginSheet` | 同一宿主避免重复提交，页面仍活动 | 提交时组件进入 busy；失败显示具体错误并解除 busy，成功关闭组件再执行页面导航 |
| 关闭／游客浏览 `close → onLoginCancel` | 非 submitting 时关闭组件 | 清同意和错误；来源为柜机详情时返回上一页，其他游客浏览切首页，不建立会话 |

当前登录页没有手机号／短信码输入、验证码倒计时或本地登录成功命令。组件交互完成不等于登录完成；必须得到真实微信凭证交换结果。页面卸载 dispose 导航控制器，晚到响应不得在已离开的登录宿主继续导航。

会话只保存服务端返回的 MINIPROGRAM Bearer token、refresh token、account_id 和 expires_in；拒绝 `session:` 合成 token、错误 audience 或不合法有效期。读请求按现有 request 层处理过期与刷新，不使用固定 30 天本地会话或 API 不可达回退。

成功去向由 [login-return](../../miniprogram/shared/interaction/login-return.ts) 的有限来源和导航栈决定；能核实来源页时返回，否则按已实现安全分支回首页／订单等页面。来源参数不提供对象权限、不直接创建订单或物理开门；CABINET 下单暂停仍由供给与确认页守卫执行。已有柜机只读列表仍要求有效登录会话。

<a id="mp-code"></a>

## MP-CODE 独立验证码页

- 路由：`pages/code/index?phone=...`。来源：[TS](../../miniprogram/pages/code/index.ts)、[WXML](../../miniprogram/pages/code/index.wxml)。
- 注册路由仍存在，但当前 login 页已在页内录入验证码；不能把该页默认当成主登录链必经步骤。

| 交互/handler | 条件/校验 | 执行与反馈 |
| --- | --- | --- |
| 输入 `inputCode` | 过滤非数字并截 6 位 | 同步六码格，清错误 |
| 重发 `resend` | seconds 大于 0 只提示等待 | 可重发时重置为 60 秒并清验证码；仍为本地倒计时 |
| 完成 `complete` | 非 submitting、长度 6、传入手机号合法 | 本地登录失败留错误，成功切首页 |

`onUnload` 清理计时器。没有短信真伪、有效期、尝试次数和服务端风控校验的真实实现。

<a id="mp-profile"></a>

## MP-PROFILE 我的

- 路由：`pages/profile/index`，一级 Tab。来源：[TS](../../miniprogram/pages/profile/index.ts)、[WXML](../../miniprogram/pages/profile/index.wxml)。测试：`revision14-profile.test.ts`、`navigation.test.ts`。
- `onShow` 更新 Tab 选中态，按登录状态显示个人资料、身份、会员、资金摘要和租赁快捷入口。租入/租出是订单关系视图，同一用户可同时拥有两者。

| 交互/handler | 条件/校验 | 执行与反馈 |
| --- | --- | --- |
| 登录 `openLogin` | 游客点击登录 | 进入登录页 |
| 资料/会员 `openProfileEdit/openMember` | `requireLogin`；游客提示并可去登录 | 分别进入个人资料或会员中心 |
| 快捷功能 `openItem` | 路由非空且 requireLogin 通过 | 一级 Tab 使用 switchTab，其余 navigateTo。覆盖我租的/我出租的设备、钱包、免押、发布、上架、额度、服务、地址、安全等当前条目 |
| 退出 `logout` | 点击退出并在宿主弹窗确认 | 清会话、切游客展示；订单与本地资料保留，不重置账户数据 |

源码仍有体验账户切换 handler，但当前 WXML 没有绑定，属于未暴露旧能力，不列为用户正式功能。会员等级与钱包摘要是本地投影，不能替代命令权限或真实结算。

**功能入口与显示：**游客显示登录引导和零值资产摘要；登录后显示昵称/头像、实名进度、按星光计算的会员等级、粉钻、钱包及租赁管理。租赁摘要优先取本人租赁中的订单，否则取查询首项；点击摘要进入“我租的设备”，不是直接打开摘要订单。

| 功能 | 入口与触发 | 交互逻辑 | 必要校验 | 结果与例外 |
| --- | --- | --- | --- | --- |
| 租入/租出查询 | 点我的租用“查看全部”或摘要卡/我出租的设备 | 去 device-orders，分别带 mode=rent/lend | requireLogin；目标页校验模式和数据归属 | 切换查询视角，不改变账户身份 |
| 发布管理 | 点发布出租/我的上架 | 分别去发布条件/本人上架列表 | requireLogin；目标页检查资格或归属 | 不直接创建或上架设备 |
| 额度与服务 | 点发布额度/出租服务 | 去对应购买页面 | requireLogin；购买页另校验余额和套餐 | 首页入口不扣款 |
| 账户资产 | 点粉钻/钱包/免押服务 | 分别去会员中心/钱包/免押说明 | requireLogin | 免押说明中的展示不能代替订单免押资格核验 |
| 个人服务 | 点地址管理/实名认证/账户安全/联系客服/关于星遇 | 按当前菜单 route 跳转；实名带 from=profile | 当前统一 openItem 先要求登录，即使目标说明页本身可公开读 | 仅到相应页面；账户安全换绑仍为占位 |

同名入口可能有不同起点：从“我的”点粉钻进入会员中心，从会员中心才进入粉钻明细；文档和 AI 导航修改应保留当前去向。

<a id="mp-profile-edit"></a>

## MP-PROFILE-EDIT 个人资料

- 路由：`pages/profile-edit/index`。来源：[TS](../../miniprogram/pages/profile-edit/index.ts)、[WXML](../../miniprogram/pages/profile-edit/index.wxml)。测试：`interaction-pilot.test.ts`、`media-lifecycle.test.ts`。
- `onShow` 未登录则替换为登录页；已登录读取当前本地昵称、头像和实名状态。

| 交互/handler | 条件/校验 | 执行与反馈 |
| --- | --- | --- |
| 昵称 `inputName` | 输入事件 | 即时回显；保存时 trim 后不能为空，底层 updateProfile 再做自身校验 |
| 头像 `chooseAvatar` | 用户主动触发；singleFlight 防重；album/camera 选 1 张 | 用本地媒体入口保存，latest 与 disposed 防止迟到覆盖；取消保留已有头像，失败 toast |
| 实名 `openIdentity` | 当前登录页面 | 打开 `identity?from=profile`，不携带订单办理前提 |
| 保存 `save` | 非空昵称；共享意图与 singleFlight | 成功更新本地 profile、提示并延迟返回；失败保留页面；卸载不继续 setData/导航 |

仅保存本地昵称/头像；身份状态来自实名流程，不能随昵称编辑改为已认证。

昵称输入框最多 20 字，保存前 trim 非空；头像可用相册或相机选择 1 张，取消保持原图，保存资料前的修改不是已保存账户资料。界面分别使用“选择中…”和“保存中…”反馈，选择/保存期间相应入口防重。重新显示页面会从本地资料重新回填，不能承诺未保存昵称跨页恢复。

<a id="mp-account-security"></a>

## MP-ACCOUNT-SECURITY 账户安全

- 路由：`pages/account-security/index`。来源：[TS](../../miniprogram/pages/account-security/index.ts)、[WXML](../../miniprogram/pages/account-security/index.wxml)。
- 进入时要求登录，显示脱敏手机号；`rebindPhone` 仅提示“手机号换绑暂未开放”。没有换绑验证码、手机号更新命令或真实短信操作。

<a id="mp-about"></a>

## MP-ABOUT 关于星遇

- 路由：`pages/about/index`。来源：[TS](../../miniprogram/pages/about/index.ts)、[WXML](../../miniprogram/pages/about/index.wxml)。
- 展示产品说明及页面声明的版本；当前无 WXML 绑定事件，不应推导检查更新、下载、反馈提交等功能。页面版本显示不证明已上传或发布。

<a id="mp-addresses"></a>

## MP-ADDRESSES 地址簿

- 路由：`pages/addresses/index`；`mode=select` 为下单选择地址模式。
- 来源：[TS](../../miniprogram/pages/addresses/index.ts)、[WXML](../../miniprogram/pages/addresses/index.wxml)、[地址命令](../../miniprogram/shared/fixture/index.ts)。测试：`mock-api.test.ts`、`confirm-page.test.ts`。

| 交互/handler | 条件/校验 | 执行与反馈 |
| --- | --- | --- |
| 进入/重显 | 要求登录；onShow 重新按当前账户查询 | 游客清空列表；选择模式仅由 mode=select 启用 |
| 新建 `newAddress` | 点击新增 | 清空表单，第一条地址默认选为默认地址；地区来自本页内置选项 |
| 编辑 `editAddress` | id 必须命中当前列表 | 回填本人地址；不创建新 id |
| 输入/地区/默认 `input/changeRegion/toggleDefault` | 输入字段、合法 picker 下标；地区越界保留原值 | 更新草稿，尚未持久化 |
| 保存 `saveAddress` | 姓名/地区/详细地址 trim 非空、手机号 `^1\d{10}$`；当前命令仅在本人集合查找编辑 id | 失败提示完整填写；成功刷新列表。选择模式同步选入租赁草稿并返回，普通模式仅提示保存；编辑 id 未命中时命令可能新建，不能写成严格“失效记录拒绝保存” |
| 选中 `chooseAddress` | id 必须为本人可用地址 | 选择模式更新租赁草稿后返回；普通模式设为默认地址并刷新 |
| 删除 `removeAddress` | 宿主弹窗明确确认，命令校验 id/归属 | 成功重查，失败提示；取消不删除 |
| 取消 `cancelForm` | 表单打开 | 关闭表单，不提交当前编辑 |

地址选择只改变当前下单草稿，不能回写已创建订单的履约快照。当前表单不是全国在线行政区划服务。

字段与默认：新建姓名、电话、详细地址为空；手机号输入最多 11 位，详细地址最多 120 字；地区 picker 当前仅提供上海徐汇、静安、浦东、长宁四项，默认第一项。第一条地址默认设为默认地址；保存选为默认时取消本人其他默认项，当前已有默认地址即使在编辑表单取消勾选也仍可能保留默认，实际切换默认可点击另一条地址。删除默认地址后命令从剩余本人地址选择替代；无地址时显示“还没有保存地址”和新增入口。

**关键核对场景（预期，未运行）：**

- 未勾选协议点获取验证码→打开同意框→取消：不开始倒计时；再次同意后仍须手机号合法才开始。
- 昵称全为空格保存：停留并提示；选择头像后取消媒体选择：保留原头像。
- 地址选择模式保存有效地址：回确认页并回填姓名、电话、拼接后的地区与详细地址；普通模式保存留在地址簿。
- 删除地址弹框点取消：列表不变；退出登录后重新登录同一账户，已保存资料与订单继续可查。
