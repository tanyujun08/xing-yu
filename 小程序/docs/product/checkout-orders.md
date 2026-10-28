# 下单与订单

当前 v1.0.1.7 使用真实开发 API。本文替换旧 Mock、小时租、免押、面交/跑腿、续租与租客争议裁决流程说明；这些流程不属于当前订单主链。源码入口为 shared/api/rental-api.ts、各页面 TS/WXML 和治理 Feature/Flow。运行结果只以本版 Change S3/S4 为准。

<a id="mp-confirm"></a>

## MP-CONFIRM 确认订单

[源码](../../miniprogram/pages/confirm/index.ts)。从设备详情进入，参数为 deviceId 或 asset_id。官方设备固定 CABINET，个人固定 EXPRESS；快递需要本人有效收货地址，柜机不要求快递地址。

页面保留“租赁信息→确认费用”两步。日历只选择开始、结束日期；最早当天，历史日期禁选，结束晚于开始并满足商品最短租期。确认前的日历选择为临时草稿，取消不应用。按业务日边界提交给服务端，页面不显示时分秒。

核对费用读取服务端报价，分别展示租金、押金、优惠、合计；最多一张适用租赁券。日期/地址/券变化重新报价。准备订单冻结本单条件，实名登记及协议明确同意完成后才可正式确认。错误通过通用弹窗显示具体原因并保留可更正输入；未知准备结果按原请求查询/恢复，不另建替代订单。

<a id="mp-identity"></a>

## MP-IDENTITY 实名信息

[源码](../../miniprogram/pages/identity/index.ts)。通过 accountApi 读取本人实名状态；保存姓名、身份证后，以服务端 REAL_NAME/VERIFIED 回执和回读为完成依据。当前为实名信息登记，不宣称外部人脸或公安核验。退出或换号清除敏感页面值；未决保存仍绑定原账号与原内容。

<a id="mp-wechat-waiver"></a>

## MP-WECHAT-WAIVER 微信免押

[源码](../../miniprogram/pages/wechat-waiver/index.ts)。当前不可用，不进入本期下单主链，不用旧 Mock 的 success 状态作为免押或付款事实。

<a id="mp-contract"></a>

## MP-CONTRACT 租赁协议

[源码](../../miniprogram/pages/contract/index.ts)。按 orderId/id 读取服务端协议正文、租期费用快照、签署人和合同次数状态。阅读和勾选仅是明确同意前置，提交成功后回读签署结果；过期、权限、并发版本及账号变化按服务端结果处理。不是外部电子签平台或本地延时签署。

<a id="mp-orders"></a>

## MP-ORDERS 订单列表

[源码](../../miniprogram/pages/orders/index.ts)与[共用控制器](../../miniprogram/shared/interaction/rental-orders-page.ts)。按当前账号、租入/租出视角与筛选读取真实订单分页；首屏、空态、刷新失败和加载更多失败分别呈现。切换条件或账号隔离旧响应；列表只导航，不直接付款或开柜。

<a id="mp-order-detail"></a>

## MP-ORDER-DETAIL 订单详情与动作

[源码](../../miniprogram/pages/order-detail/index.ts)。按 orderId/id 读取原订单，按钮取服务端 allowed_actions。协议、正式确认、支付、原支付查单、发货、归还与实收均使用当前 API、对象版本和原意图；收到受理或支付宿主返回不等于服务端业务成功。

官方订单支付确认后可查看/复制本单六位取件码，显示柜机、地址、格口和日期窗口。租期开始前可以看码但不能开柜，租期结束不能新增取件。到柜后扫描柜体码，柜详情手输六位码并明确提交；详情不带码自动开柜。已消耗码隐藏。取物关门后由服务端可信结果自动确认，成功弹窗可回原单。

个人发货和更正物流、出租方实际收回、返程地址在原 task-sheet 中办理。归还材料与实物事实分别推进，官方核费和原退款/补缴各有独立结果；订单展示不能把未知付款、退款或柜机观测当成功。客服使用微信原生入口。当前不提供旧续租、面交、跑腿及双方反复议价裁决流程。

<a id="mp-device-orders"></a>

## MP-DEVICE-ORDERS 设备订单

[源码](../../miniprogram/pages/device-orders/index.ts)。复用真实订单列表控制器，按资产上下文查询；不再按刊登上下架状态伪造出租中、空闲和订单数量。权限以当前会话和服务端订单归属为准。

<a id="mp-service-detail"></a>

## MP-SERVICE-DETAIL 服务说明

[源码](../../miniprogram/pages/service-detail/index.ts)。guard/insurance 预览是说明展示；订单购买详情目前不可用。说明页不产生保险出单、理赔或购买成功事实，本期确认订单不提供这些选项。

柜机、归还和异常恢复详见[柜机与归还](fulfillment-after-sales.md)，当前事件绑定见[事件索引](interaction-index.md)。实际测试覆盖与未验边界见本版 Change，不从文档更新推导整版验收通过。
