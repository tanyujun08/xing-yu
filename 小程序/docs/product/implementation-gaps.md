# 当前实现边界与差异

订单/柜机部分于2026-10-08按v1.0.1.7源码更新；其他条目仍是2026-09-06历史取样，未重新验收，不能作为现行缺陷结论或施工计划。旧订单小时租、免押中间态、假设备订单、旧归还/争议材料和Mock验收轨迹条目已移除；当前流程见checkout-orders、fulfillment-after-sales与本版Change。

| ID | 当前事实与源码证据 | 根因/对文档使用的影响 | 状态 |
| --- | --- | --- | --- |
| GAP-05 | [publish](../../miniprogram/pages/publish/index.ts) 直接自由品牌型号创建 listing；[fixture](../../miniprogram/shared/fixture/index.ts) 用 reviewing→pricing→listed | 与批准的选标准产品、单资产与审核/可见性独立语义不一致；型号补充审核没有对应注册页面。不要照此追加SKU或新产品创建入口 | 确认：规格差异 |
| GAP-06 | [publish-eligibility](../../miniprogram/pages/publish-eligibility/index.ts) 黄金达标与服务项done固定，实际按钮只看实名和额度 | 资格展示不等于领域校验；没有证据证明会员门槛和服务余额被完整强制 | 确认：展示/命令边界 |
| GAP-07 | [rental-service](../../miniprogram/pages/rental-service/index.ts) 卡片用粉钻、记录 `priceText` 用¥，命令实际扣粉钻 | 展示价格对象与实际计价重复维护；购买记录金额单位不可信，不能推导现金支付 | 确认：币种文案差异 |
| GAP-08 | [publish](../../miniprogram/pages/publish/index.ts) 编辑时自动保存转draft；[fixture](../../miniprogram/shared/fixture/index.ts) updateMockListing仅驳回→reviewing，其他状态保留；[listings](../../miniprogram/pages/listings/index.ts) 旧priceOpen无打开路径 | 创建/编辑/草稿语义耦合，审核失效规则与当前批准复审要求不符；“更新成功等待审核”不能证明重新审核，旧弹窗不当第二流程 | 确认：复审/遗留实现差异 |
| GAP-09 | [check-in](../../miniprogram/pages/check-in/index.ts) 已读取本人月记录、原奖励快照和当前规则；[growth-tasks](../../miniprogram/pages/growth-tasks/index.ts)、[level-rights](../../miniprogram/pages/level-rights/index.ts)、[membership](../../miniprogram/pages/membership/index.ts) 仍有独立展示/任务缺口；任务部分 guide 链接不带 id，提醒/邀请仍非已接入命令 | 签到页不再固定每日奖励或伪造任务进度；其他页面的补签、邀请、浏览任务统计与权益交付须分别验收 | 确认：签到读写已接 API，周边功能仍局部占位 |
| GAP-10 | [powder-mall](../../miniprogram/pages/powder-mall/index.ts) redeem仅spendDiamonds，兑换次数从流水推算；[lottery](../../miniprogram/pages/lottery/index.ts) 客户端随机并传奖项，没有文案中券奖项 | 扣积分事实不等同发可消费券；前端奖池不可成为真实权益结算可信来源 | 确认：权益闭环缺口 |
| GAP-11 | [wallet](../../miniprogram/pages/wallet/index.ts)、[withdrawal](../../miniprogram/pages/withdrawal/index.ts) 无页内登录拦截；submitMockWithdrawal校验账户金额而非会话；fillAll可填小数但命令只收整数元 | 依赖入口守卫而非统一会话边界；“全部提现”不保证符合底层金额格式。正常资料入口要求登录不覆盖直达路径 | 确认：访问/校验分层缺口 |
| GAP-12 | [fixture](../../miniprogram/shared/fixture/index.ts) `ensureState` 在读取时做历史标准化与写回，含旧版本订单付款状态修正；部分主动查询直接推进模拟结果 | query 命名不保证纯读；不能把本地查询收敛策略直接搬到远端API，也不能用查询证明真实第三方结果 | 确认：本地边界差异 |
| GAP-15 | [fixture](../../miniprogram/shared/fixture/index.ts) createMockListing安排listing_review，只有runMockOrchestrator执行才进入pricing；当前发布/列表调用链未发现消费入口 | 有审核任务不等于用户等待后能自动设价；功能清单明确“已存在pricing记录可设价”和Mock任务推进边界 | 确认：页面流程推进缺口，未运行复现 |

## 当前订单与柜机边界

登录使用真实微信会话接口；实名是本人资料登记，不宣称外部人脸核验。官方订单、凭证和柜机任务使用当前 API；取件自动弹窗与实柜反馈已在本会话验证。支付回调使用离线模拟，无真实扣款。归还材料、退款、真机、扫码相机及其他页面状态按各自证据记录，不从取件成功扩大验收。

cabinet-open 是原取件任务恢复页面，cabinet-code 是柜体 scene 的本人输码入口，不再称作不可达历史页。材料处理和其他模块仍有实际调用的字段/代码保留；旧 fixture 不作为当前订单业务 authority。
