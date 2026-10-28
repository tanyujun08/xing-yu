import {expect,test} from 'vitest';
import {rentalActions} from '../miniprogram/shared/presentation/rental-order';
const action=(code:string,allowed=true)=>({action_code:code,allowed,display_reason:allowed?null:'等待官方处理'});
test('shipping is the single primary task without enabling or hiding server actions',()=>{
  const input=[action('VIEW_CONTRACT'),action('START_RETURN'),action('SHIP'),action('CONTACT_OFFICIAL')];
  const result=rentalActions(input);
  expect(result.filter(a=>a.primary).map(a=>a.action_code)).toEqual(['SHIP']);
  expect(result.map(({action_code,allowed,display_reason})=>({action_code,allowed,display_reason}))).toEqual(input.slice(0,3));
});
test('unavailable payment remains disabled and cannot displace an allowed query',()=>{
  const result=rentalActions([action('PAY_INITIAL',false),action('QUERY_PAYMENT'),action('VIEW_CONTRACT')]);
  expect(result.filter(a=>a.primary).map(a=>a.action_code)).toEqual(['QUERY_PAYMENT']);
  expect(result[0]).toMatchObject({allowed:false,primary:false,display_reason:'等待官方处理'});
  expect(rentalActions([action('VIEW_CONTRACT')]).some(a=>a.primary)).toBe(false);
});
