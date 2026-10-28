修订63登记home/detail/region为已接通API投影页。页面不能直连session/request；主体经accountApi.sessionIdentity读取，发现城市偏好/目录由supply-api封装；展示函数仅接受所需结构字段。未接通子功能保持缺口，历史Mock规则不是当前业务规格。

本次API接入按同一Change修订53～55执行：Policy的apiConnectedPages精确登记已接入页面。这些页面只能经具名业务入口account-api、supply-api、rental-api→单一request访问真实API，禁止到Mock/fixture的可达依赖；其余未接入页面继续禁止网络，仍属未完成切片，不代表DEV_API整包可用。启动不再执行fixture恢复命令。全局无Mock与完整候选仍须WP10全部完成后验收。新增资料/地址更新使用兼容POST，原PATCH保留。

# 星遇原生小程序架构规范

v1.0.1.7 R4 / Change XY-20261006-37d27e06874f41379ba922c9b19d6ed3@21：依用户明确指令，订单步骤条优先复用官方原生 TDesign Steps。组件依赖精确锁定、仅页面局部注册、以既有 Token 映射 CSS 变量；current/readonly来自实际流程，不用报价阶段冒充已签署。npm生成产物须经真实编译验证，不提交或修改第三方源码形成fork。原媒体字节0、内嵌媒体禁令、源码输入4MiB及唯一verify入口不变；本授权不引入跨端框架、第二套设计系统或无关页面替换。

当前仓库交付版本、UI/UX 策略 `targetVersion` 与 `miniprogram/app.ts` 的版本显示统一为 `1.0.1.6`，交付版本见根目录 `VERSION`。本版视觉与交互以有效设计稿、遮盖图注、字段审查、施工包实际页面元素及当前 Token／组件源码为准；旧版本与历史模板不再作为样式依据。原 73 项精确遗留例外已退出当前策略，其原身份全部转入 retired 分区，690 项 normalized baseline 身份及固定 manifest hash 保全；阈值与到期检查仍生效。源码整改和宿主诊断不代表原生 S3 或设计验收完成，逐 AC 状态见原 C Change。

本文件是星遇原生微信小程序长期、唯一的架构规范 authority。主动规范以当前 `1.0.1.6` 的 Token、primitive 与组件为依据；Policy 的 `basisVersion`、baseline 和 legacy 身份只用于遗留审计与到期管理，不指导当前样式。规范更新不扩大已锁业务范围，不重建设计系统或切换框架；真实 API 接入范围由当前 Change 与 `apiConnectedPages` 单独登记。规范中的 `MUST` 是合并前必须满足的合同，`SHOULD` 是默认方案，偏离时必须在评审中给出局部证据，`MAY` 是允许但不强制的选择。

运行时 Token 数值只由 `miniprogram/app.wxss` 维护，共享样式 primitive 只由 `miniprogram/shared/design/components.wxss` 维护，组件行为由各自组件目录维护。本文件描述边界与使用规则，不复制 Token 值表。`config/miniprogram-architecture-policy.json` 只记录门禁身份、阈值和精确遗留例外；Change 文档只记录一次交付的授权、范围与证据。

## 稳定规则索引

| Rule ID | 级别 | 长期合同 |
| --- | --- | --- |
| `MPA-AUTH-001` | MUST | 规范、Policy、产品版本、Mock-only 网络不可达边界与唯一 `verify` 入口必须保持一致；README/AGENTS 只路由到本文件。 |
| `MPA-DEP-001` | MUST | 页面、组件与 shared 层只能沿本文件列出的直接邻接依赖；未列出的边默认禁止。 |
| `MPA-TOKEN-001` | MUST | 新增视觉值必须先归入既有 `--xy-*` 语义；页面和组件不得建立第二套 Token 或写裸颜色。 |
| `MPA-TYPE-001` | MUST | 字体、字号、行高、触控尺寸与安全区必须使用统一 Token/适配模块；新代码不得调用废弃的同步系统信息 API。 |
| `MPA-COMP-001` | MUST | 通用状态、媒体、页面壳、页头和底栏必须复用批准组件，组件样式隔离且不承载业务命令。 |
| `MPA-ASYNC-001` | MUST | 价值操作、导航、计时器及迟到回调必须受页面任务作用域、single-flight 与生命周期清理保护。 |
| `MPA-LIST-001` | MUST | 列表必须有稳定 key、显式游标/完成态与增量 patch，禁止静默截断和重复触底请求。 |
| `MPA-REFRESH-001` | MUST | 刷新只能查询，不得推进 Mock 状态；所有结束路径必须收尾宿主刷新状态。 |
| `MPA-A11Y-001` | MUST | 可交互元素必须具备角色、可访问名称及一致的 disabled/busy 语义；关键状态文本不得被省略。 |
| `MPA-DUP-001` | MUST | 精确重复实现必须失败；近似重复只生成候选，达到组件晋升条件后再提取。 |
| `MPA-EXC-001` | MUST | 遗留例外必须精确、一对一、可到期且绑定语义指纹；新改节点不得使用例外。 |

## 目录职责与直接依赖

允许的完整邻接集合如下。箭头不是传递授权；同一页面或组件目录内的相对文件可以互相引用。

```text
pages / custom-tab-bar -> components
pages / custom-tab-bar -> shared/{interaction,presentation,model,format,design}
pages / custom-tab-bar -> shared/api/{account-api,supply-api,rental-api}.ts (仅登记API页面，禁止Mock可达)
 pages / custom-tab-bar -> shared/api/mock-api.ts (仅未接通页面，禁止网络)
pages / custom-tab-bar -> shared/media/local-media.ts
components -> shared/{presentation,model,design}
shared/interaction -> shared/model
shared/presentation -> shared/{model,format,design}
shared/api/mock-api.ts -> shared/{model,api/mock-adapter}
shared/api/mock-adapter -> shared/{model,fixture,identity,session}
shared/media/local-media.ts -> shared/model
shared/fixture -> shared/model
```

- `pages/<route>` MUST 只拥有路由生命周期、局部 `data`、事件编排与 ViewModel 绑定。可复用映射、竞态控制、分页算法和业务状态推进不得继续堆入页面。
- 页面业务读写 MUST 经过 `shared/api/mock-api.ts`。页面不得直连 fixture、generated、identity 或 session；宿主媒体能力仅可直连 `shared/media/local-media.ts`。
- `components` MUST 是展示与通用交互边界，不得导航、读取 session、访问 fixture、调用 `mockApi` 或执行订单/资金命令。
- `shared/api/mock-adapter` MAY 访问 fixture、identity 和 session，用于保持当前同步、确定性的 Mock 签名。真实Adapter按当前已授权Change的精确apiConnectedPages边界接入；真实OSS调用仍独立授权。
- 当前 Mock 模式 MUST 保持无网络；当前获授权切片接入开发API时，`shared/config/env.ts` 的唯一宿主机开发 Origin 固定为 `http://127.0.0.1:8081`。宿主机 `8080` 属于其他项目，不得作为星遇开发 API；trial/release 未获独立授权前继续保持未配置。
- `shared/presentation` MUST 接受结构类型，不得导入 fixture/generated；`shared/design` 不得反向依赖 API 或 fixture。
- 禁止新建无明确责任的 `common.ts`、`utils.ts`、`helpers.ts`，禁止跨页面深层导入和循环依赖。

## 设计 Token、字体与尺寸适配

`MPA-TOKEN-001` 与 `MPA-TYPE-001` 共同约束新增样式：

- MUST 复用当前 `1.0.1.6` 的颜色、排版、间距、圆角、阴影与控件语义，以本版有效设计与当前 `app.wxss`、`shared/design/components.wxss` 及组件实现为依据，并沿用 `--xy-*` 命名空间。缺少语义时先在运行时 Token authority 中补齐，再由 primitive 或组件消费；页面不得声明 Token。
- MUST 使用系统字体栈与既有字体 Token，不下载或运行时加载字体。字号和行高使用既有语义角色或基于系统根字号的 `calc(...)`；不得用 `rpx` 随视口宽度缩放文字，也不得用 JS 再乘字体缩放系数。
- 新增页面及本轮迁移页的 WXML 第一个节点 MUST 为 `<page-meta root-font-size="system" />`。系统字体验证档为 100%/150%/200%，视口为 320/375/430px，底部安全区为 0/34px，共 18 组。
- 本轮纯视觉迁移页由现有Policy的`visualOnlyMigrationWxmlPaths`精确登记；该清单只阻止`page-meta`把历史页面的导航/命令债务误扩为本视觉Change，不豁免Token、排版、触控、可访问性或视觉检查，也不适用于未来新增页面。
- 新页面由`newlyGovernedWxmlPaths`独立登记并执行完整规则；三个集合互斥覆盖app.json。检查器锁定旧页visual-only资格，新页不能借登记进入历史豁免。删除路由移除活动登记，历史normalized replay及其哈希保持不变。
- 含文字控件 MUST 使用 `min-height`；每个独立交互目标的实际 hit box 至少 44×44px。44px只约束点击热区，不约束可见壳：轻量入口/Chip、筛选Tab、普通局部操作和主CTA分别允许保持28/32/36/44px可见高度，并通过`hit target → visual shell`结构补足热区；相邻热区不得重叠。地区页按Owner参考图采用紧凑复合字母索引：44px整体宽度、24px字母步长，父容器委托事件，不用互相重叠的44px字母行；这是该快捷索引的局部密度例外，搜索和普通城市选择仍保持44px目标。
- 40/44/48px 可见高度或全宽的主/次操作按钮 MUST 使用 6px 语义圆角；状态标签、Chip、Switch、Tab 指示器、圆形 FAB 与 28/32/36px 紧凑操作可按组件语义保留紧凑、胶囊或圆形外观。
- 间距 MUST 表达关系：标题到说明、价格到单位等紧密关系使用4px，同一对象属性使用8px，卡片内独立信息组使用12px，内容到操作使用16px，页面模块使用16/24px。连续卡片页上方标题区域到首张卡片使用16px（--xy-layout-card-stack-start-gap）；revision 18按注册路由逐页迁移其余页面；home/profile/listing-price/membership已接受主体保留，不全局改写旧Token。不得因为“统一”而让全部元素等距；同类对象跨页面 MUST 复用相同媒体、正文、金额和操作轴。
- 关键状态、价格、阻断原因和错误 MUST 可换行且不得 ellipsis；空间不足时先压缩或省略次要元信息，关键价格值不得成为弹性压缩项。自由文本 SHOULD 支持换行与断词。
- 列表或卡片 MUST 只表达一层主边界：外框与圆角属于对象组或独立对象，连续记录只使用内部分割线，末行无底线，子背景不得穿出父层圆角。Tab MUST 按语义选择等分导航、紧凑左排或可滚动左排，不得用固定宽度偶然对齐。
- 一级页面home/orders/info/profile使用左对齐页面轴的自定义标题、无返回；有标题的二级页面使用navigationStyle custom并复用page-header：17px/24px、400字重、整屏居中；左侧SVG画布距屏幕16px，44px独立返回热区，固定头部与等高占位。彩色头部使用inverse白色标题与箭头，白/灰背景使用深色。confirm/publish保留内部返回步骤事件；membership无标题，保留已接受的透明主题导航。背景透明与反白按页面真实需要处理，不仿造微信胶囊。
- 自定义导航 MUST 只通过共享测量模块组合 `wx.getWindowInfo()` 与 `wx.getMenuButtonBoundingClientRect()`；新代码禁止 `wx.getSystemInfoSync()`。
- 文档滚动页 MUST 使用纵向 flex page shell；viewport `scroll-view` 的 footer 在滚动容器外。底部操作区保持普通流或 sticky 并消费安全区，不得新增 fixed overlay。
- Loading 只用共享 CSS ring：inline 16px、page 32px、stroke 2px、800ms；禁止 GIF、Lottie 或第二套动画资源。

## 统一视觉关系合同

视觉北极星固定为“克制、可信、清晰、年轻的租赁工具”。实现必须同时服从字号、间距、图标、分割线、圆角、颜色和对齐七轴，并逐个 Pattern/页面检查亲密性、对齐、重复、对比；任何单轴 Token 合法都不能替代整组关系验收。冲突时依次保护业务事实与关键内容、可访问性与操作安全、亲密性与对齐、Pattern 重复、品牌表达、装饰。

Surface按业务语义组合页面背景、平面Section、语义Card和轻量Surface，不默认卡片化，也不强制去卡片化。独立实体、资产/服务摘要、阶段任务、表单分组等完整对象可使用Card；普通Section通过标题、留白、对齐和分隔线组织；状态/风险提示可使用轻量Surface。Card内部优先排版和分隔线，不重复嵌套Card。Section标题距上方Card24px、距下方内容12px；当前提现页按此合同实施，其余页面不因规范更新自动改动。

- 页面内容轴为 16px；普通卡内容四边为 12px；卡内标题到直属内容通常为12px，外部标题到首卡为16px；带独立外部标题的模块间为 24px；连续排列、无独立外部分组标题的卡片间距统一为12px（--xy-layout-content-gap），卡内有标题不改变此分类，不得混用16/24px。连续卡片页的标题区域（含既有筛选栏）到首卡由 `--xy-layout-card-stack-start-gap` 独占16px，后续卡片之间12px；既有其他首块变量不叠加，已接受页面不随全局别名被动改变。每个关系只能有一个 spacing owner，禁止父 padding、子 margin、标题热区重复累计。
- 44×44px 只属于独立点击热区。可见壳按 28/32/36/40/44px 角色选取；突出双行入口使用40px承载块和24px图形，紧凑任务入口使用36px承载块和21～24px图形。两者都与 `14/20 标题 + 4px + 12/18 辅助文本` 的完整信息组共享垂直中心；紧凑组的正常信息区为42px，外层交互热区仍不得小于44px。辅助文本增长时行高自然增长，热区不得撑高标题或卡片关系。
- 普通卡、普通按钮为 6px 圆角，媒体为 4px，紧凑角色为 2px，具名强调容器可为 12px；pill/circle 只用于真实胶囊或圆形语义。普通卡片按页面承载背景决定边界：灰色页面背景上的白色卡片使用无外框xy-card；白色页面背景上的普通卡片使用统一细边框xy-card--outlined。不得仅根据卡片自身白色填充添加外框。内部必要分割线保留且末行无线；输入、按钮、选中框和主题特殊容器各守其职责。普通页面默认不使用阴影。只有直接设计来源明确的 banner、floating action、overlap card 可分别消费 `--xy-shadow-banner`、`--xy-shadow-floating-action`、`--xy-shadow-overlap-card`；三者不得互换、合并为普通卡阴影或由页面写裸 shadow。modal/sheet 继续使用其既有具名 elevation。
- 普通连续列表由全宽行拥有分割线，内容仍 inset 12px，末个实际可见业务项无线。商品虚线从媒体后的正文轴开始，媒体尺寸变体必须同时驱动媒体与分割线起点；资产竖线上下 inset 12px，Tab 选中线为 2px 短线。门店等可独立操作对象只有在直接设计来源明确时才可使用1px对象边界，且不得再叠普通列表线或阴影；四类线与对象外框不得互相替代。
- 只读金额由 `symbol + value + optional unit` 构成连续、不可压缩的基线组，数值与单位的间距只归单位一处；金额整体按所在信息列左齐或右齐，押金等补充信息另成组并允许换行。可编辑金额沿用具名输入结构，设定价格页保持已接受的左数值/右单位。关键金额、状态、错误和阻断原因必须完整呈现；不能依赖固定空列、原生 input 固有宽度或隐藏测量节点制造对齐。
- 图标语言以四个一级 Tab 的同语义 default/selected 变体为母版：当前/重点主体可面性，说明与功能图标线性；线性主笔画以 1.8 为基准。面性不等于品牌绿，同级静态入口默认中性且无当前态时品牌绿图标为 0。功能性图标统一 24 viewBox、圆角/端点节奏、光学重心和透明留白；插画与媒体保留具名固有画幅，不伪装成功能图标。
- 品牌绿只给主动作、当前/选中和极少关键主体；状态色只绑定真实 success/info/warning/danger。状态不得只靠颜色；`UNKNOWN` 只能表达查询/恢复，绝不使用完成文案、成功色或成功图标。
- 租赁订单节点只复用 PAT-14“可信流转轨道”：中性细线、当前节点一次品牌强调，状态与时间直接可读；轨道不增加业务步骤，不出现在普通设置/营销列表。
- 底栏常规 inset 由 `bottom-actions` 负责，按钮以44px独立热区包裹40px可见壳，同组字号/行高一致且随长文增长；行内次操作允许28px可见壳、44px热区，不能撑高所属标题行。safe-area 由 `page-shell` footer 负责；custom-tab-bar 自有其安全区。旧 fixed 页面底栏仅作为待迁移消费者存在，不得新增，迁移完成后不得再由页面重复消费 `env(safe-area-inset-bottom)`。

会员主题只改变颜色、素材和明确运营语义；其排版、间距、圆角、控件、列表、对齐及大数字角色仍从 `app.wxss` 消费统一 Token。`member-tokens.wxss` 只可保留兼容导入，不得继续维护运行时数值。大数字必须使用登记的资产摘要或运营主数字角色，不能替代标准价格 20/24，也不能由页面自行新增尺寸。

## 组件化合同

组件默认 `styleIsolation: isolated`，局部 WXSS 只消费 `--xy-*` 与共享 primitive。页面不得穿透选择器修改组件内部；差异通过具名 property、slot 或有限 variant 表达。

- `status-view`：`loading | empty | error | end`，密度为页面或紧凑 footer；end固定紧凑弱文本。可选`illustrationSrc`默认为空，仅page密度empty/error显示，图片失败回退原文字；只发出无业务含义的`action`，插画不改变权限、状态或busy生命周期。正式缺省插画按通用、明细、位置、订单、合同、搜索、设备和消息八类登记，同类页面复用；处理中、权限不足、UNKNOWN和列表结束不使用缺省插画。页面自有分支使用`xy-empty-page`承载200×150px插画、标题、说明和可选文字动作；正常页面内部的空模块使用`xy-empty-section`，插画按内容需要缩为96×72px或省略。两种密度都消费统一Token，普通卡内容内边距为12px，状态判断、导航与业务事件仍归页面所有。
- `media-state`：`idle | loading | ready | error`，密度为 `thumbnail | card | hero`；只管理媒体生命周期并发出 `retry`。
- `page-shell`：拥有 document/viewport 滚动、surface、安全区与 footer 布局；只有 viewport 模式发出 `lower`。
- `page-header`：展示标题、返回与可选动作，只发出 `back/action`，不自行导航。
- `bottom-actions`：统一主次动作、busy/disabled 与提示 slot，只发出 `primary/secondary`。
- `bottom-actions` 的 `summary` 布局由具名 `summary` slot承载金额说明，主按钮保留原busy语义；`custom` 只渲染 `actions` slot，页面保留多动作权限及事件，不自动生成空主按钮。内边距仍只由组件负责，安全区仍归page-shell。
- `order-product-summary`：confirm/orders/order-detail三个消费者共用的64px正方形媒体、标题与副文。属性`title/secondary/mediaSrc/mediaState/variant/clickable`；`meta` slot补充订单周期等文字；仅发`open/retry`，不查询商品或导航，不自带卡片/边距/价格/状态。列表标题单行，详情标题完整换行。
- `task-sheet`：confirm的日期/小时/券与order-detail的发货/续租共用面板外壳，按集中管理遮罩/关闭和滚动的能力提前晋升。属性`open/title/busy/showFooter`；默认正文及`summary/footer` slot；仅发`close`。短正文自然高度，长正文滚动；不引入键盘或焦点引擎，输入与业务草稿仍由页面管理。面板自身消费一次安全区，页面不重复加底部安全区。
- `section-tabs`：标题、受控Tab及内容slot，属性为`title/tabs/value/divider/ariaLabel`，只发`change({value})`；由Owner明确要求提前统一间距与无障碍。标题到Tab12px；默认无分隔线，文字框底到内容12px，选中短线绝对定位不撑间距；`divider=true`时选中短线贴合分隔线，分隔线到内容12px。44px点击热区独立，页面不得叠加首条内容顶部留白。当前钱包为首个消费者，其他页面未自动迁移。

普通结构只有在至少三个真实消费者具有相同结构和语义时 SHOULD 晋升为组件；必须集中管理生命周期或无障碍的能力 MAY 提前晋升。禁止用 `common-*`、`base-*` 建立平行组件。精确重复是错误，近似重复只是人工评审候选。

## 操作、Loading 与生命周期

- 页面 MUST 创建与实例绑定的 `OperationScope`。`onUnload` 依次做幂等草稿 flush、标记 disposed、清理 timer/监听并使迟到回调失效；卸载后不得 command、`setData`、toast 或 navigation。
- 购买、兑换、提现、抽奖、订单命令、扫码与媒体选择 MUST 使用 `singleFlight`。价值操作的 intent key 从首次 dispatch 前建立，在 pending 或 UNKNOWN 期间复用；超时或卸载不得生成新 key。
- 导航 SHOULD 使用 leading `navigateOnce`，只由宿主 `fail/complete` 或 watchdog 释放。危险操作不得用 debounce 代替正确性边界。
- busy 立即禁用重复操作；spinner 超过 100ms 才出现，出现后至少保持 200ms，但不得延迟业务结果或锁释放。同步 Mock 不得人工加延迟。
- 只有草稿持久化使用可 flush 的 trailing 350ms debounce；输入回显与校验立即执行，并在 blur/submit/hide/unload 收尾。picker、checkbox、分页和刷新不得 debounce。

## 列表、下拉刷新与上拉加载

列表状态 MUST 区分首次加载/失败/空态与已有内容下的 refreshing/loading-more/error/done。首次状态由页面级 `status-view` 管理，加载更多状态由紧凑 footer 管理；刷新或加载失败必须保留已有内容。

- 页大小固定为 20；Adapter 返回 `items/nextCursor/hasMore`。页面维护 generation，同一 generation 同一方向 single-flight，刷新先递增 generation，旧响应不得覆盖新状态。
- append MUST 使用增量 patch，并按稳定业务 ID 去重；WXML 的每个 `wx:for` 必须有稳定 `wx:key`。禁止 `slice(0, N)` 静默截断、offset 推断游标或用总量反推 `hasMore`。
- document 模式由页面 `onReachBottom` 拥有触底；viewport 模式只处理 `scroll-view lower`。一次滚动 owner 只能存在一个请求入口。
- 下拉刷新只调用 query facade。订单推进只允许显式 command；普通刷新、下拉和上拉不得调用 orchestrator。成功、失败、同步 throw 与卸载都必须在 `finally` 尝试 `wx.stopPullDownRefresh()`。

## Mock 边界与验证门禁

当前数据模式保持 Mock。fixture 是内部实现，不是页面契约；Mock Adapter 必须同步、确定性且不注入人工延迟。查询与命令命名要表达副作用，refresh 不得伪装成状态推进。

唯一静态入口为 `npm run verify`，顺序固定为 OpenAPI、包资源、架构、Lint、TypeScript、Vitest。Docker 与 CI 只调用该入口，不允许传入跳过规则、刷新基线或自动修复参数。

架构 checker 默认只读：

- 输出字段固定为 `schemaVersion/policyVersion/basisVersion/targetVersion/sourceManifestSha256/verdict/summary/findings`，不含绝对路径、时间戳或本机身份。
- source manifest 按真实大小写的仓库相对 POSIX 路径排序，每行记录路径与规范化内容 SHA-256，再以 UTF-8/LF 计算总 SHA-256。
- finding 按 `ruleId/path/line/fingerprint` 排序。指纹绑定稳定 Rule ID、真实相对路径和解析后的语义节点，不绑定行号、注释或空白；每个 canonical subject 以源码顺序追加 `occurrence:N`（首个为 1），同一路径中的完全同值节点据此区分。非语义格式变化不得改变 ordinal，新增或删除同值节点必须分别产生新 finding 或 stale exception。
- 退出码 0/1/2 分别表示 PASS、规则失败、Policy 或解析器损坏。每个稳定 Rule ID 必须持续拥有 accept/reject fixture。

遗留例外只能来自 Policy 指定并由 checker 内建摘要锁定的 `1.0.0.13` 精确身份集合。每项必须包含 `ruleId/path/fingerprint/reason/owner/removeByVersion`，并与当前 finding 精确一对一；删除例外时必须把身份转入 retired 集，后续不得重新启用。stale、collision、drift、过期、glob、目录级、永久、新增或 retired 例外都必须失败。`MPA-AUTH-001`、`MPA-EXC-001` 和 Policy/解析器完整性不可豁免；任何新增或本次修改的语义节点必须零例外。

遗留 provenance 只接受一个 normalized replay：读取 `26062c4fc386493a3001013e5fed061695c680fd` 的 241 个 `miniprogram/**/*.{json,ts,wxml,wxss}` 源文件，按 BOM/CRLF/NFC 规则规范化，并只在内存中给以下 10 个 WXML 前置 `<page-meta root-font-size="system" />`：`addresses`、`cabinet-pickup`、`cabinet-return`、`login`、`orders`、`powder-ledger`、`powder-mall`、`profile-edit`、`profile`、`withdrawal` 的 `index.wxml`。每个 source identity 为 `SHA-256("mpa-baseline-source-v1\\0" + path + "\\0" + SHA-256(normalizedSource))`，排序拼接后的 241 项 manifest hash 为 `6c43ccd8e93068dfafdceeb8f9ec54d8ccdfd33f788360a9118cb806befe89fc`。该单一 replay 产生 690 个可豁免 finding identity，manifest hash 为 `705a02d06b9b9465e5f63a32f0fb4b4c6e316edf1728df9af6d1fb845601b33f`，live 与 retired 的合计保持 690；修复后仅将对应原 identity 由 live 转为 retired，当前分区以 Policy 为准。原始 direct scan 的 562 findings/560 waivable 仅作诊断，不参与 authority，也不会把被内存 page-meta 替代的 10 个 TYPE tuple 误记为 retired。普通 `verify` 只校验 Policy 中冻结的路径、count、manifest 与 checker 内建 hash，不读取 Git。

当前 `apiConnectedPages` 登记页面通过具名业务入口与单一 `miniprogram/shared/api/request.ts` 访问真实 API，不得可达 Mock／fixture；未接入页面继续受原网络边界约束，属于尚未完成的业务切片。本版只清理已锁施工功能涉及的 Mock、接口与文档，不据策略版本升级推导全量业务已经接通。

## 后续代码输出门禁

### 优惠券管理只读消费者

`pages/profile`资产栏显示当前账户`query.vouchers()`可用券总数，`pages/coupons`通过独立`query.couponWalletPage`查询账户券历史。现有确认页选券查询语义不变；新adapter只读现有Mock券，模型分类归`shared/model/coupon-wallet`，文案/金额映射归`shared/presentation/coupon-wallet`。分页沿PageRequest/PageResult固定20条，快照按有效期和ID排序，游标绑定账户与筛选；不为分页新增券签发时间或存储字段。新页复用page-shell/page-header/status-view与cursor-list、OperationScope、navigateOnce；四状态等分Tab保页内，允许大字换行，不修改钱包section-tabs默认几何。管理页不发起兑换、预占、核销、退券或订单命令，关联订单查询和点击均校验当前账户权限。

人工与 AI 输出代码前 MUST 先确定 owner 层、允许邻接、复用组件、Token 角色、异步所有权和测试层；输出后 MUST 运行唯一 `verify`，不得新建旁路命令或局部门禁清单。若需求需要新依赖、第二套 Token/组件/状态体系、真实 API、storage schema、路由或业务语义变化，必须停止当前实施并返回独立 S2，而不是扩大例外。

固定展示素材按config/static-assets.json内容哈希映射到专用OSS HTTPS URL；原件在static-assets/保留，运行包不携带这些文件。package检查持续校验原件字节和URL白名单，禁止miniprogramRoot内的图片、音视频、字体文件以及本地静态素材引用、内嵌素材data URI；媒体字节必须为0。保留源码输入4 MiB上限，该统计不是微信编译后的包大小。登录标志、归还icon与插画统一从OSS读取；业务私有凭证仍走既有受控上传/读取合同，不得将短效签名或AccessKey写进客户端。

修订69：orders经rental-api单一请求层接入本人列表，采用created_at/order_id签名游标；生命周期过滤不推导支付/履约组合。当前返回空allowed_actions，详情回读与所有未接写动作保持边界。

修订152：`pages/chat/index` 仅接入 C2C/PERSONAL 原订单双方的 API34 文本会话。读取和发送统一经过 `rental-api → rental-conversation → request`，分页序号、会话版本始终保留规范十进制字符串；页面只消费 GET 返回的 `effective_status/allowed_actions/blocked_reasons`，请求失败不回退 Mock。发送前按当前账户和订单持久化唯一原文、`client_message_id` 与 Idempotency-Key，只有 POST 回执和匹配 GET 回读同时成立后才清除；UNKNOWN、隐藏、卸载或账户变化继续保留原意图。订单详情只按已验证的 C2C/PERSONAL `asset_snapshot` 展示导航入口，真实读写资格仍由 API34 判定；平台客服、info 汇总、order-messages 和 private-messages 保持未接入。

v1.0.1.7 R4 合同切片：`pages/contract/index` 使用 C01/SC02/SC05 展示冻结姓名、完整原文、服务端生成的 OSS 全文页图和 PDF；确认须以 SC03 提交当前 `preview_artifact_id + preview_sha256` 及原 attempt ETag。`pages/contract-sign/index` 是独立原生 2D 画板，归一化笔画仅在页面内存，透明 PNG 经现有素材上传通道提交；不能打字替代笔迹，提示基线和底色不得进入导出。上传恢复由 `rental-api → rental-contract-signature` 管理，持久化内容只含账号/订单/原输入/原请求键/本机待上传文件路径，不把本地草稿视为签署。SC01 UNKNOWN 仅查原意图，NOT_FOUND 不自动重传；成功核实后清理专属本机文件，OSS 原图和合成品沿订单保留。官方/个人出租方统一 DEFAULT_SIGNED 且真实证据/时间为空，订单端只由承租人手写确认。客服始终使用原生 contact。新增 R4 Token 在 app.wxss 命名域中按需消费，不改动无关页面的既有正文与控件默认值。以上为代码结构合同，不是运行或视觉验收证据。
