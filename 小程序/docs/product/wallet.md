# 资金账户与提现

本模块记录本地现金账务投影与提现模拟。资金单位在领域为分，页面输入为元；当前提现只接受正整数元。展示“已到账”只表示本地 Mock 状态，不能用作真实银行/微信到账证明。

<a id="mp-wallet"></a>

## MP-WALLET 资金账户

路由：`pages/wallet/index`。源码：[wallet](../../miniprogram/pages/wallet/index.ts)。onShow 查询 wallet 和 cashAccount，展示托管、预期收益、可提现、待收款、押金持有、备付、冻结、提现处理中和已收款等独立字段。

| 交互与触发 | 条件与校验 | 结果与恢复 |
| --- | --- | --- |
| `chooseTab` | all/settling/settled 合法值 | 待结算含 pending/escrow，已结算含 settled；重新计算列表，不改变账务状态 |
| `openWithdrawal` | 可提现余额至少为100分（¥1）；低于100分时按钮原生禁用且处理函数拦截 | 去 withdrawal 默认 apply 模式；最终金额仍由提现页/命令校验，记录入口不受余额限制 |
| `openWithdrawalRecords` | 点击提现记录 | 去 withdrawal?view=records；记录按独立提现状态展示 |

当前本页没有独立登录拦截，主要正常入口由 profile 的 requireLogin 保护；直接路由及底层命令登录边界需补齐（GAP-11）。不能把正常入口的登录判断当全局安全保证。实际记录查询入口只在提现页；钱包不保留未绑定的查询/重试处理函数。

首次进入默认选“待结算”，返回本页保留当前筛选并重查。列表显示设备/订单、结算状态、结算条件、金额与时间；切“全部”合并已有记录，切“已结算”只取 settled；空列表表示该筛选无记录，不表示上方所有余额为零。现金金额从分格式化为元。

<a id="mp-withdrawal"></a>

## MP-WITHDRAWAL 提现申请与记录

路由：`pages/withdrawal/index`，`view=records` 查看记录，其余 apply。源码：[withdrawal](../../miniprogram/pages/withdrawal/index.ts)。账户显示为本地当前“微信账户·姓名”，没有银行卡绑定或真实收款账户授权。

展示层按语义分区：申请摘要及到账账户为Card，提现说明为平面Section；普通Card统一12px内边距，不嵌套Card或重复提示。记录按时间倒序选最新processing/confirming/unknown作为当前申请Card，其余保留在历史平面列表，UNKNOWN不表示已完成。Section标题距上卡24px、距下内容12px。收款账户无更换能力，不显示假操作；失败记录只在对应记录下展示一行轻量原因；手续费沿用当前规则文案，不承诺免费。用户提供180×128提现插画以独立SVG资产使用。

| 交互与触发 | 条件与校验 | 结果与恢复 |
| --- | --- | --- |
| 进入/重显 `loadWallet` | 读取当前账户钱包；按 idempotencyKey 找原 pending 记录 | 恢复 processing/confirming/unknown 的原金额和意图；终态才释放 |
| `input/fillAll` | 输入或用可提现分金额格式化为元 | 只填表；若余额带小数，“全部”仍可能因命令整数元约束失败（GAP-11） |
| `submit` | singleFlight；同一意图金额指纹一致；命令要求正整数元、余额足够、同键同额 | 创建 processing 记录和提现请求账务事实；成功提示“申请已提交”，不提示已到账；明确失败显示原因，未知保留原键 |
| 重进或改金额再提交 | 原结果尚 processing/confirming/unknown | 禁止换金额生成新业务意图；先在原记录查询；页面卸载不允许绕过 |
| `withdrawalAction` 查询 | 当前记录属于本人、状态为 processing/confirming/unknown | 当前 Mock 将 processing/confirming→unknown，再查 unknown→completed；这是模拟推进，不是真实查询语义 |
| `withdrawalAction` 重试 | dataset failed 分支，命令再次要求本人记录明确 failed | 复用原记录回 processing；不重复新增提现请求，失败不假定到账 |
| 联系客服 | 固定 support chat | 不自动取消提现或释放冻结款 |

钱包可提现余额不等于托管押金、待收款或预期收益；不得把其中任何一项直接加入可提现。订单完成与出租方收款状态也要分别展示。

当前视觉验收开关 `WITHDRAWAL_REFERENCE_PREVIEW` 位于 `shared/presentation/withdrawal-layout.ts`：只在 develop + devtools 下为钱包、申请提现与提现记录投影同一只读资金快照及5条参考记录，切换Tab/重进重新加载；不写storage或钱包账务，提交/查询/重试入口拦截。真机、trial、release不启用；设为false即可恢复开发者工具原账务展示。该预览不是业务验收数据。

**从申请到结果的功能清单：**

| 功能 | 入口与触发 | 交互逻辑 | 必要校验 | 结果与例外 |
| --- | --- | --- | --- | --- |
| 填写申请 | 钱包点申请提现，进入 apply | 展示当前可提现金额、账户名称，输入元金额；“全部”只回填 | 命令要求有限的正整数元且不超过可提现余额 | 空、0、负数、小数、超余额均不能成功申请；余额有小数时“全部”也需遵守当前整数限制 |
| 提交申请 | 点提交按钮 | 在本账户意图中绑定金额，创建提现记录后重读钱包 | 提交防重，同键必须同额 | 进入 processing；仍在申请页显示“提现申请已提交”，不是自动切记录页或确认到账 |
| 继续原申请 | 原申请未收敛时返回、重进或再提交 | 根据钱包记录中的 idempotencyKey 恢复原金额与意图 | processing/confirming/unknown 不能更换金额重复申请 | 改金额提示“已有提现结果待确认…”；查询原记录后再根据结果处理 |
| 查看记录 | 钱包点提现记录，view=records | 展示金额、创建时间和独立状态 | 当前账户记录；id 非空 | processing=提现处理中、confirming=到账确认中、unknown=结果未知、failed=提现失败、completed=已到账（本地） |
| 查询/失败提示 | 当前卡 processing/confirming 只展示进度，unknown 显示查询；其他历史未决记录保留查询；失败只显示轻量原因，无行内操作 | 查询处理函数不变；不新增记录详情或更换账户功能 | 命令复核状态；原retry处理函数保留但此页无按钮入口 | 查询异常仍提示待确认；无取消提现、删除记录、改收款账户入口；当前卡不提供手动推进 Mock 的按钮 |

**关键核对场景（预期，未运行）：**余额 100 元，输入 101 或 1.5 均被拒绝；输入 10 提交后出现原申请，重进恢复金额 10；未决时改为 20 再提交应提示先查询；Mock 原记录查询按 processing/confirming→unknown→completed 展示，金额和记录 id 保持；失败记录重试使用原记录。
