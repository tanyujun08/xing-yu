import { demoExtras } from '../../preview/extras';
import {unavailableOrderPage,blockOrderAction} from '../../shared/interaction/order-unavailable';
Page({
 ...unavailableOrderPage({routeId:'',resumePending:false,order:null,phase:'',title:'微信免押校验',copy:'免押服务暂不可用。',paymentAmount:'—',submitting:false},()=>null),
 backOrder: blockOrderAction,
 queryVerification: blockOrderAction,
 startPayment: blockOrderAction,
  ...demoExtras('wechat-waiver'),
});
