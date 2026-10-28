import { readDemo, saveDemo } from '../../preview/engine';
import { isLinked, linkedAction, refreshLinked } from '../../preview/linked';
Page({
 data: { content: '', messages: [{ id: 'welcome', mine: false, text: '你好，我是离线演示客服。可以体验订单、取还、退款和资料相关咨询。所有消息只保存在本机。' }] },
 onShow() { const render=()=>{const items=readDemo().receipts['support-messages']?.['items'];if(items)this.setData({messages:items});};render();if(isLinked())void refreshLinked().then(render).catch(()=>wx.showToast({title:'请先启动本机 Mock 服务',icon:'none'})); },
 input(event: WechatMiniprogram.Input) { this.setData({ content: event.detail.value }); },
 send() { const text = this.data.content.trim(); if (!text) return; const answer = /退款|押金/.test(text) ? '演示订单中有退押处理中和已完成样本。可以在订单详情查看退款，点击查询模拟完成。' : /柜|取件/.test(text) ? '演示取件码为 123456。开柜只模拟页面反馈，请从官方柜机订单进入。' : /归还/.test(text) ? '在租赁中订单点击办理归还，填写返程单号或选择柜格，再查看归还材料。' : '已收到演示留言。可从演示中心查看全部页面，并恢复初始数据重新体验。'; const messages = [...this.data.messages, { id: 'mine-' + Date.now(), mine: true, text }, { id: 'reply-' + Date.now(), mine: false, text: answer }]; if(isLinked()){void linkedAction('support',{messages}).then(()=>this.setData({messages,content:''})).catch(()=>wx.showToast({title:'请先启动本机 Mock 服务',icon:'none'}));return;} readDemo().receipts['support-messages'] = { items: messages }; saveDemo(); this.setData({ messages, content: '' }); },
 back() { wx.navigateBack({ fail: () => wx.navigateTo({ url: '/pages/demo-center/index' }) }); },
});
