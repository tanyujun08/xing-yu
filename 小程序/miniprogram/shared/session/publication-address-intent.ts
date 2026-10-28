import { demoStorage } from '../../preview/storage';
import type { AddressInput } from '../api/account-api';
import { newIdempotencyKey } from '../api/idempotency';
import { readStoredApiSession } from './api-session';

export type PublicationAddressIntent = {
  owner:string;draftId:string;key:string;body:AddressInput;label:string;
};
const prefix='xingyu.publication-address-intent.v1:';
const opaque=(value:unknown):value is string=>typeof value==='string'&&/^[!-~]{1,64}$/.test(value);
function storageKey(owner:string,draftId:string):string{
 if(!opaque(owner)||!opaque(draftId)||readStoredApiSession()?.accountId!==owner)throw new Error('登录或草稿已变化，不能继续原地址请求。');
 return prefix+encodeURIComponent(owner)+':'+encodeURIComponent(draftId);
}
function valid(value:unknown,owner:string,draftId:string):value is PublicationAddressIntent{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const item=value as Partial<PublicationAddressIntent>;
 if(Object.keys(item).sort().join(',')!=='body,draftId,key,label,owner'||item.owner!==owner||item.draftId!==draftId||!opaque(item.key)||typeof item.label!=='string'||item.label.length<1||item.label.length>512)return false;
 const body=item.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='city_id,dataset_id,detail_address,district_id,is_default,location,phone,phone_country_code,province_id,recipient_name')return false;
 return body.is_default===false&&body.location===null&&body.phone_country_code==='+86'&&/^1[3-9]\d{9}$/.test(body.phone)
  &&['dataset_id','province_id','city_id','district_id'].every(key=>opaque(body[key as keyof AddressInput]))
  &&typeof body.detail_address==='string'&&body.detail_address.length>0&&typeof body.recipient_name==='string'&&body.recipient_name.length>0;
}
export function readPublicationAddressIntent(owner:string,draftId:string):PublicationAddressIntent|null{
 const value:unknown=demoStorage.getStorageSync(storageKey(owner,draftId));
 if(value===undefined||value===null||value==='')return null;
 if(!valid(value,owner,draftId))throw new Error('原地址请求记录无效，请先核实本人地址簿。');
 return JSON.parse(JSON.stringify(value)) as PublicationAddressIntent;
}
export function preparePublicationAddressIntent(owner:string,draftId:string,body:AddressInput,label:string):PublicationAddressIntent{
 const existing=readPublicationAddressIntent(owner,draftId);if(existing)return existing;
 const intent:PublicationAddressIntent={owner,draftId,key:newIdempotencyKey('publication-address'),body,label};
 if(!valid(intent,owner,draftId))throw new Error('微信地址资料无效，尚未提交保存。');
 demoStorage.setStorageSync(storageKey(owner,draftId),JSON.parse(JSON.stringify(intent)));
 const readback=readPublicationAddressIntent(owner,draftId);
 if(!readback||JSON.stringify(readback)!==JSON.stringify(intent))throw new Error('原地址请求未能安全保存，尚未提交。');
 return readback;
}
export function releasePublicationAddressIntent(intent:PublicationAddressIntent):void{
 const current=readPublicationAddressIntent(intent.owner,intent.draftId);
 if(current?.key===intent.key)demoStorage.removeStorageSync(storageKey(intent.owner,intent.draftId));
}
