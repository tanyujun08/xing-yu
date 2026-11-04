// 订单流程状态头：很浅的同色渐变 + 右侧 3D 插画。标题前不放图标，说明最多两行。
// 色调和插画在模板里直接换算（见 index.wxml 的 wxs），不经过 setData，避免状态切换时没有刷新。
Component({
  options: { multipleSlots: true, styleIsolation: 'isolated' },
  properties: {
    tone: { type: String, value: 'green' },
    art: { type: String, value: '' },
    title: { type: String, value: '' },
    description: { type: String, value: '' },
  },
});
