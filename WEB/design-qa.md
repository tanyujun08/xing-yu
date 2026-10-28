# XY-20260828-001 列表规范化设计 QA

- Source visual truth:
  - `C:\Users\xyyxx\AppData\Local\Temp\codex-clipboard-8a543a5b-5f64-459d-b3da-49635bb98229.png`（订单管理修订前实图，2355×1967）
  - `C:\Users\xyyxx\AppData\Local\Temp\codex-clipboard-936e53a3-01c9-450c-b30d-df0a00dec089.png`（商品管理修订前实图，2355×1899）
  - 用户明确目标：列表标题加重；内容块不贴靠；页签、统计、筛选、列表使用一致区块间距；商品与订单复用同一 Token 和列表组件结构。
- Rendered implementation:
  - `C:\xy-new\.local\evidence\XY-20260828-001\visual\catalog-1440x1024-final.png`（1440×1024，CSS viewport 1440×1024，devicePixelRatio 1）
  - `C:\xy-new\.local\evidence\XY-20260828-001\visual\orders-1440x1024-final.png`（1440×1024，CSS viewport 1440×1024，devicePixelRatio 1）
- Full-view comparison: `C:\xy-new\.local\evidence\XY-20260828-001\visual\comparison-before-final.png`。两组修订前/后截图统一缩放到 900px 比较宽度并并排放置；修订前截图包含浏览器栏且视口不同，因此不把整体缩放差异作为问题，结构与局部层级以计算样式和同一 1440×1024 最终截图判断。
- State: 已登录 Mock 管理员；商品管理“标准商品”页签；订单管理默认列表；确定性 Seed 数据。

## Comparison history

### Iteration 1 — blocked

- [P1] 商品与订单没有复用同一列表结构。
  - Evidence: 修订前订单筛选区位于 `.admin-list-panel` 内并使用灰色背景；商品筛选区是页面自定义的独立白色卡。
  - Impact: 同一后台出现两套容器层级、间距和筛选密度，后续页面仍可继续分叉。
  - Fix: `AdminListPanel` 统一输出“独立筛选面板 → 16px → 独立列表卡”；商品、资产删除页面级筛选卡壳，订单和其他带筛选列表自动接入共享结构。
- [P2] 列表标题层级不足。
  - Evidence: 商品和订单修订前计算样式均为 16px/600，中文系统字体下与表格主信息区分不明显。
  - Fix: `--xy-admin-list-title-weight` 从 600 调整为 700，组件只消费该 Token。
- [P2] 页签、统计块和后续内容的垂直节奏不一致。
  - Evidence: 修订前 `--xy-admin-tabs-content-gap` 为 0；商品页页签与统计块相接，商品/资产另用页面 margin，订单则使用 24px 页面级 margin。
  - Fix: 页签内容、统计块、筛选面板与列表卡统一为 16px 区块间距；移除订单 24px 和商品/资产重复壳层。
- [P2] 筛选容器出现重复背景和边框。
  - Evidence: 修订前订单的 `ListFilterBar` 为灰底、有边框且嵌在白色列表卡内。
  - Fix: 标准筛选面板保留一层白色容器；内部 `ListFilterBar` 透明、无边框、无重复内边距。

### Iteration 2 — passed

- 商品页计算结果：页签→统计 16px、统计→筛选 16px、筛选→列表 16px；标题 16px/700；内部筛选背景透明、边框 0；筛选不在列表卡内；document 横向溢出 0。
- 订单页计算结果：筛选→列表 16px；标题 16px/700；内部筛选背景透明、边框 0；筛选不在列表卡内；document 横向溢出 0。
- 商品与订单一致性 E2E 在 1366、1440、1920、2560、3840 和 1440/200% 有效布局下 6/6 通过。
- 5155 浏览器交互：商品关键词筛选后只保留 1 条数据行，重置恢复空关键词；订单号筛选后只保留 1 条数据行，重置恢复空关键词；浏览器 console error 为 0。

## Required fidelity surfaces

- Fonts and typography: 后台继续使用现有无衬线栈；列表标题统一 16px/700，表头 13px/600，正文 14px/22，未新增字体或造成异常换行。
- Spacing and layout rhythm: 页面标题、页签内容、统计、筛选和列表按 16px 节奏排列；筛选面板和列表卡各自拥有 16px 内边距，不再贴靠或重复嵌套。
- Colors and visual tokens: 保留现有白色容器、浅灰页面底、星轨蓝和语义状态色；筛选区删除内部灰底后，层级由单层边框和空间分组表达。
- Image quality and asset fidelity: 本次没有新增或替换图像资产；商品缩略图仍使用既有 Mock 媒体组件，清晰度、裁切和圆角未改变。
- Copy and content: 商品、订单标题、筛选标签、数据和操作文案保持原业务含义；只调整结构与视觉层级。
- Icons and states: 沿用 TDesign 图标与交互状态；筛选、重置、页签、分页和表格 hover 保持可用。
- Accessibility and responsiveness: 筛选容器保留 `role=search` 与标签；标题由 `aria-labelledby` 关联；6 个桌面/高缩放布局通过且无 document 级横向溢出。

## Findings

没有剩余可执行的 P0、P1 或 P2 视觉差异。修订前截图与最终截图的整体尺寸差异来自来源截图的浏览器栏、DPR 和视口不同，已通过同宽并排比较、同视口最终截图和计算样式复核消除误判。

## Follow-up polish

- [P3] 订单列数较多时仍会使用表格内部横向滚动；这是现有业务信息密度与固定操作列的受控行为，不影响页面级布局。

final result: passed
