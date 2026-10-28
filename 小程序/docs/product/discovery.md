# 发现设备、地区与履约资源

关联业务：`F-SUPPLY-MANAGEMENT`、`F-INVENTORY-RESERVATION`、`F-FULFILLMENT`。v1.0.1.5 首页设备、柜机与门店发现已从开发 API 读取，游客走公开 discovery API，登录用户走会话 API；下文早期本地展示细节若与当前源码冲突，以本版说明和页面源码为准。柜机详情仅只读，见[柜机与售后](fulfillment-after-sales.md#mp-cabinet-detail)。

<a id="mp-home"></a>

## MP-HOME 首页

- 路由：`pages/home/index`，一级 Tab，游客可浏览。用户在这里找设备、切换地区、查看履约地点或进入发布流程。
- 来源：[TS](../../miniprogram/pages/home/index.ts)、[WXML](../../miniprogram/pages/home/index.wxml)。测试定位：`city-discovery.test.ts`、`revision14-home.test.ts`、`supply-discovery-ui.test.ts`。

页面从上到下为品牌导航、城市与签到、柜机宣传入口、最近门店、设备分类、供给筛选、设备列表；悬浮按钮进入发布，底部为四个主 Tab。首次页面数据的分类、供给均为“全部”；分类的“全部”显示为“推荐”。`onLoad` 读取导航尺寸，`onShow` 选中首页 Tab 并重查地区、门店、设备；当前页面实例的两组筛选保留，没有为筛选单独写持久缓存。

| 功能 | 入口与触发 | 交互逻辑 | 必要校验 | 结果与例外 |
| --- | --- | --- | --- | --- |
| 切换地区 | 点顶部城市或地区无资源的空态入口 | `openRegion` 携带完整 region 到城市页；选城返回后 onShow 重查 | 城市保存规则见下方 MP-REGION；首页不申请定位权限 | 顶部显示城市简称，筛选选择保留；切换地区不保证每种供给都有结果 |
| 按设备分类浏览 | 点推荐或服务端返回的分类 | `selectCategory` 更新分类并携带分类与供给条件重新请求 | 非法分类回退“全部”；“推荐”对应全部分类 | 更新选中样式和 API 列表；无个性化推荐计算 |
| 按供给浏览 | 点全部、柜机、门店、个人 | `selectSupply` 携带对应 `supply_type` 和现有分类重新请求 | 非法值回退“全部” | 更新 API 列表，不改变设备支持的交付方式 |
| 恢复全部设备 | 地区内有设备但组合筛选无结果，点“查看全部设备” | `resetDeviceFilters` 将两组选择清为全部 | 入口只在 devices 非空、visibleDevices 为空时显示 | 保留地区，恢复该地区可发现设备 |
| 查看柜机 | 点柜机筛选入口 | `openCabinets` 切换供给筛选为柜机并重新请求 | 首页不要求登录 | 展示柜机供给设备；不发起开柜或持码操作 |
| 查看全部门店 | 点“最近门店”右侧入口 | `openStores` 打开门店列表 | 首页不要求登录 | 可继续选择地区、查看门店；首页摘要无门店时入口仍显示 |
| 查看门店详情 | 点门店卡片 | `openStore` 传门店 id | id 非空，否则不跳转 | 目标页查询存在性；不会直接拨号或地图导航 |
| 查看设备详情 | 点设备卡片整体 | `openDevice` 传设备 id | id 非空，否则不跳转 | 进入详情查看租赁信息；此时没有创建订单，商品失效由详情处理 |
| 每日签到入口 | 点顶部“签到” | `openCheckIn` 打开签到页 | 登录和当天次数由签到页/命令检查 | 首页点击不发奖励；见[签到](membership.md#mp-check-in) |
| 发布入口 | 点悬浮“发布” | `openPublish` 当前显示“发布入口正在接入” | 无业务提交 | 不创建草稿、不扣额度；旧发布流程说明不代表本页当前可达路径 |

**展示与数据规则：**

| 展示内容 | 当前规则 |
| --- | --- |
| 地区内设备 | 由 `readDiscoveryCity` 的 `city_id`、当前分类和 `supply_type` 请求服务端供给；登录与游客分别使用会话和公开 discovery API |
| 设备顺序 | 遵循当前 API 页的顺序，以 cursor 继续分页；客户端按资产 id 去重，不人为前置指定设备 |
| 最近门店 | 从当前城市门店 API 投影展示 ACTIVE 门店；登录态首图取 `photo_material_ids[0]` 并逐张授权，游客使用公开投影的已授权封面 |
| 卡片租金和押金 | 服务端返回分单位的价格与押金，经共用金额格式化后展示；卡片金额不替代订单最终报价 |
| 标签与来源 | 供给类型来自 API 的 `supply_type`，当前卡片信息仅使用已回读的业务字段 |
| 图片 | 资产封面使用服务端材料授权的短效 HTTPS URL；缺图或授权失败保留占位，不回退本地 Mock 图片 |
| 当前交互范围 | 支持服务端分类/供给筛选、cursor 加载更多、错误重试；切换地区或返回首页重新请求，无 GPS 定位入口 |

**空态分支：**无门店时保留“最近门店”和“查看全部”，显示可点击切换地区的提示，柜机宣传卡使用紧凑样式；地区设备总集合为空时显示“当前区域暂无可租设备”+“切换地区”；地区有设备但组合筛选为空时显示“当前分类暂无可租设备”+“查看全部设备”。门店为空与设备为空分别判断，快递供给仍可能出现在设备列表。

**关键核对场景（预期，未运行）：**

- 地区内分别有个人相机、门店相机和个人镜头：选择相机分类后再选个人，只显示同时匹配项；重置后两组都为全部。
- 保留某分类和供给后切换城市返回：城市和数据刷新，两组选中值保留；没有匹配项按对应空态反馈。
- 当前地区无门店但有支持快递设备：显示门店空态，同时保留设备卡片；点门店空态进入城市选择。
- 点击发布：分别准备资格满足且有草稿、满足但无草稿、资格未满足，核对三条目标路径；点击本身不扣发布额度。

<a id="mp-detail"></a>

## MP-DETAIL 设备详情

- 路由：`pages/detail/index?id=...`，只读取传入的已上架资产；`listingId` 或 `mode=manage` 不开放本人发布管理。
- 来源：[TS](../../miniprogram/pages/detail/index.ts)、[WXML](../../miniprogram/pages/detail/index.wxml)、[真实供给 API](../../miniprogram/shared/api/supply-api.ts)。测试定位：`supply-pages-http.test.ts`、`supply-discovery-ui.test.ts`、`store-photo-authorizations.test.ts`；测试文件仅为检索入口，当前验收以综合 Change 的同源证据为准。

| 交互/handler | 触发条件与必要校验 | 执行与反馈 |
| --- | --- | --- |
| 打开／重新读取 `onLoad/onShow/refreshSupply` | 必须有不超过 64 字符的资产 id；页面仍可见、请求代次和登录主体仍一致 | 游客用 `discoveryApi.getSupply`，登录用户用 `supplyApi.get`；失败显示错误和“重新读取”，不换成另一设备或 fixture。下架资产按服务端公开读拒绝结果展示 |
| 图片轮播 `onGalleryChange` | 实际图库有多张图时滑动 | 只更新展示序号；游客使用公开投影 URL，登录用户逐张取得短效素材授权，未授权项不渲染，不回退本地样图 |
| 原视频 `playVideo/onVideoError/onVideoTimeUpdate` | 登录态媒体 id 必须属于本次供给；授权期间保持同一主体／请求代次 | 每次播放先取素材授权；失败、过期或登录主体变化停止播放并提示重试，不改变供给或订单 |
| 立即租赁 `buy` | 官方与个人供给均须满足当前 QUOTE／可用守卫，固定对应 CABINET／EXPRESS | 可租游客先打开真实登录组件，成功后重读本资产并重新核验；登录态合法供给导航到 `confirm?deviceId=...`。本页不写本地订单草稿、不创建订单或消费休眠码 |
| 本人发布／客服 `editListing/contact` | 当前 `manageMode/showSupportFab` 为 false，不构成可达管理／客服业务入口 | 保留方法只提示“本人发布管理正在接入”／“客服消息暂未接入”，不执行旧发布命令或本地聊天 |
| 所在资源 `openStores` | 点击资料中的供给地点区域 | 当前提示“具体取还地点将在订单确认后提供”，不按旧 fixture 导航关联资源 |
| 押金规则 `openNoDeposit` | 点击“查看押金规则” | 使用导航去重进入 `pages/no-deposit/index`；说明不替代报价或订单金额 |

官方资产由管理员手动上架后才公开展示，OFFLINE 在列表与直接详情读中隐藏；入柜、门态与上架是独立事实。当前详情不展示未上架本人商品。详情价格不能替代订单快照金额。

联动顺序：从首页／门店设备卡片进入详情→读取当前公开供给；官方与个人供给的游客租赁登录由本页 login-sheet 处理，登录成功重读并复核原动作；不自动创建订单。页面隐藏时中止旧读取、清理供给和播放状态，返回后重新读取。

<a id="mp-cabinets"></a>

## MP-CABINETS 柜机列表

- 路由：`pages/cabinets/index`。来源：[TS](../../miniprogram/pages/cabinets/index.ts)、[WXML](../../miniprogram/pages/cabinets/index.wxml)。
- `onShow` 携带小程序登录会话、以当前城市向 `cabinetApi.list` 请求 ACTIVE 柜机；未登录返回 `AUTH_REQUIRED`，不能解释为 API 不通。保留仍在响应中的已选 id，否则选择第一台。失败展示错误并清空旧列表；成功后对柜内设备封面逐个取得材料授权。

| 交互/handler | 条件/校验 | 执行与反馈 |
| --- | --- | --- |
| 选择柜机 `selectCabinet` | dataset.id 必须在当前城市列表中 | 更新左侧选择及右侧设备内容；此处不改订单取货柜机 |
| 柜机/商品详情 `openCabinet/openDevice` | 非空 id | 分别跳柜机详情、带 `source=cabinet` 的商品详情 |
| 切换地区 `chooseRegion` | 点击地区 | 返回地区选择页；回到列表后重新查询 |
| 切换门店 `openStores` | 点击门店入口 | `redirectTo` 门店列表，替换当前资源列表页 |

API 柜机公开投影没有可靠空闲格数或距离；页面不得用“0”冒充空格口数，也不从可租设备数推断物理占用。列表仅为当前 API 可发现数据，不提供订单取柜或物理开门。

<a id="mp-stores"></a>

## MP-STORES 门店列表

- 路由：`pages/stores/index`。来源：[TS](../../miniprogram/pages/stores/index.ts)、[WXML](../../miniprogram/pages/stores/index.wxml)。
- `onShow` 从当前城市请求服务端 ACTIVE 门店，支持 cursor 分页；登录态商家首图来自同一 `photo_material_ids` 有序列表并经授权回读，无图或失败保留占位。

| 交互/handler | 条件/校验 | 执行与反馈 |
| --- | --- | --- |
| 城市/区县 `chooseRegion/selectRegion` | 快捷区县仅上海可用；城市选择走地区页 | `setRegion` 后重新查询门店，非上海不执行区县拼接 |
| 门店/商品 `openStore/openDevice` | 非空 id | 跳详情；商品携带 `source=store` |
| 切换柜机 `openCabinets` | 点击入口 | 替换为柜机列表 |

门店卡片仅展示 API 当前投影的设备预览；图片加载失败不改变门店或设备身份。卡片数量不能替代实时库存或分页完成标志。

<a id="mp-store-detail"></a>

## MP-STORE-DETAIL 门店详情

- 路由：`pages/store-detail/index?id=...`。来源：[TS](../../miniprogram/pages/store-detail/index.ts)、[WXML](../../miniprogram/pages/store-detail/index.wxml)。
- `onLoad` 以门店 id 请求服务端详情；404 显示不存在，其他错误显示重试。登录态有序门店图由 `photo_material_ids` 逐张授权，游客使用公开投影的有效媒体；页面回显设备来自同一详情响应。

| 交互/handler | 条件/校验 | 执行与反馈 |
| --- | --- | --- |
| 查看设备 `openDevice` | 非空 id | 进入门店供给的商品详情 |
| 地址/联系 `showAddress/showContact` | 点击地址或电话区 | 仅用宿主弹窗显示地址、电话和营业时间；未调用地图导航或拨号 |
| 返回 `goBack` | 返回入口 | 回上一页 |

详情的 `deviceCount` 来自当前服务端 `supplies` 数组，不代表门店实时物理库存。平台是门店 B2C 业务责任主体，门店为履约资源。

<a id="mp-region"></a>

## MP-REGION 城市选择

- 路由：`pages/region/index`。来源：[TS](../../miniprogram/pages/region/index.ts)、[WXML](../../miniprogram/pages/region/index.wxml)、[地区读取](../../miniprogram/shared/api/discovery-regions.ts)。测试：`city-discovery.test.ts`。
- `onShow/loadCities` 从当前已发布地区 API 读取省级与城市数据，核验同一 dataset_id、城市级别及唯一 id；热门城市和字母分组只从本次真实结果派生。没有 GPS 定位，搜索只过滤已读取城市。

| 交互/handler | 条件/校验 | 执行与反馈 |
| --- | --- | --- |
| 读取／重试 `onShow/loadCities` | 页面仍可见且读取代次有效；API 数据层级和版本一致 | 显示读取态；失败保留错误和“重新读取”，不加载内置城市作为成功回退 |
| 搜索 `onSearchInput/clearSearch/onSearchConfirm` | 输入城市文字 | trim 后按本次城市名包含匹配，空分组移除；清空恢复分组并聚焦，确认收起键盘 |
| 选择城市 `selectCity` | 非 loading，有当前 dataset_id，dataset.id 必须唯一对应本次已读城市 | `selectDiscoveryCity` 保存 datasetId/cityId/name，返回上一页；不接收任意城市名称、不默认上海区县、不弹本地切换成功 toast |
| 全部城市 `selectAllCities` | 点击“全部城市” | 清除发现地区选择后返回，不修改账户地址 |
| 字母定位 `jumpLetter` | 点击字母；必须属于当前 alphaLetters | 设置 `scrollIntoView=city-字母`；只定位，不切换城市 |

当前没有前端“城市已开通”标记；候选城市以服务端已发布地区数据为准，没有当地柜机／门店时发现页展示空态，支持快递的供给仍按自身合法条件发现。选择城市不赋予柜机权限、不修改资产交付方式。

**发现模块关键核对场景（验收入口，结果按综合 Change 记录）：**设备 id 无效或下架时按 API 错误展示重试，不替换另一设备；门店 id 无效时显示读取失败；城市搜索无匹配时分组为空，清空关键词恢复本次 API 城市；切换柜机／门店列表使用替换路由。完整交互绑定见[事件索引](interaction-index.md)。
