import { formatCNYMinorUnits } from '../format/money';

type DraftFields = {
 product_id?: string; display_name?: string; condition?: string; identifier_type?: string; identifier_value?: string;
 defect_description?: string; accessories_text?: string; description?: string; rental_unit?: string;
 unit_price_fen?: string; deposit_fen?: string; minimum_units?: string; reference_value_fen?: string;
 available_from?: string; available_until?: string; timezone?: string;
 publication_location?: PublicationLocationInput;
 publication_position?: PublicationPositionInput;
 media?: readonly { material_id:string;role:string;sort_order:number }[];
 delivery_options?: readonly { method: string; outbound_fee_payer?: string; return_fee_payer?: string; source_address_id?: string; meeting_time_text?: string; instruction?: string }[];
 rule_version_id?:string;eligibility_rule_version_id?:string;
};
export type PublicationLocationInput = {
 dataset_id:string;province_id:string;city_id:string;district_id:string;detail_address:string;
 recipient_name:string;phone_country_code:string;phone:string;
 location?:{latitude:string;longitude:string;coordinate_system:'GCJ02';source:'MAP_PICK'};
};
export type PublicationPositionInput = {latitude:string;longitude:string;coordinate_system:'GCJ02';source:'WECHAT_CLIENT'};
export type DeliveryChoice = {id:'express'|'runner';label:string;selected:boolean;outbound:'TENANT'|'LESSOR'|'';return:'TENANT'|'LESSOR'|''};
export type AssetMediaChoice={material_id:string;role:'COVER'|'IMAGE'|'VIDEO';sort_order:number};
type Draft = { draft_id: string; version: string; origin_kind: string; status: string; asset: DraftFields };
export const draftEditableFields = ['displayName','condition','identifierType','serialNumber','notes','accessories','description','expectedRent','expectedDeposit','minimumUnits','referenceValue','availabilityStart','availabilityEnd'] as const;
export type DraftEditableField = typeof draftEditableFields[number];
export type DraftChanges = Partial<Record<DraftEditableField,string>>;
const integerMaximum='9223372036854775807';
/** Mirrors the personal asset identifier contract before a draft is saved or submitted. */
export function publicationIdentifierIssue(kind:string|undefined,value:string|undefined,required=false):string|undefined{
 const identifier=(value??'').trim();
 if(!kind)return required?'设备标识类型':identifier?'请先选择设备标识类型':undefined;
 if(kind!=='IMEI'&&kind!=='MANUFACTURER_SERIAL')return '请选择设备标识类型';
 if(!identifier)return required?'设备唯一标识':undefined;
 if(kind==='IMEI'){
  if(!/^[0-9]{15}$/.test(identifier))return 'IMEI 须为 15 位数字';
  let sum=0;
  for(let index=0;index<identifier.length;index++){
   let digit=identifier.charCodeAt(index)-48;
   if(index%2===1){digit*=2;if(digit>9)digit-=9;}
   sum+=digit;
  }
  return sum%10===0?undefined:'IMEI 校验位不正确，请核对设备上的完整号码';
 }
 return /^[\x20-\x7e]{1,128}$/.test(identifier)?undefined:'厂家序列号须为 1–128 位可打印英文字母、数字或符号';
}
function fen(value:string):string {
 if (!/^(0|[1-9][0-9]{0,18})$/.test(value) || value.length===19 && value>integerMaximum) throw new Error('金额超出允许范围');
 return value;
}
export function draftMoneyInput(value:string):string {
 if(!/^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(value)) throw new Error('金额最多填写两位小数');
 const [whole,fraction='']=value.split('.');
 return fen((whole+fraction.padEnd(2,'0')).replace(/^0+(?=\d)/,''));
}
function money(value:string|undefined):string { return value===undefined?'':formatCNYMinorUnits(fen(value)).slice(1); }
export function publicationLocalDay(value:string|undefined,end=false):string {
 if(value===undefined)return '';
 const at=Date.parse(value);if(!Number.isFinite(at))throw new Error('草稿日期无效');
 return new Date(at+8*3600000-(end?86400000:0)).toISOString().slice(0,10);
}
function localDay(value:string,end=false):string {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)!==value)throw new Error('请选择有效日期');
 return new Date(Date.parse(value+'T00:00:00.000Z')-8*3600000+(end?86400000:0)).toISOString();
}
export function publicationDraftView(draft:Draft){
 const a=draft.asset;
 if(!['EDITING','SUBMITTED','ARCHIVED'].includes(draft.status) || !['CREATE','EDIT'].includes(draft.origin_kind) || !/^[1-9][0-9]{0,19}$/.test(draft.version)) throw new Error('草稿状态无效');
 const methods=[{id:'express',method:'EXPRESS',label:'快递配送'},{id:'runner',method:'RUNNER',label:'跑腿配送'}] as const;
 const deliveries:DeliveryChoice[]=methods.map(m=>{const option=a.delivery_options?.find(o=>o.method===m.method);return {id:m.id,label:m.label,selected:!!option,outbound:option?.outbound_fee_payer==='TENANT'||option?.outbound_fee_payer==='LESSOR'?option.outbound_fee_payer:'',return:option?.return_fee_payer==='TENANT'||option?.return_fee_payer==='LESSOR'?option.return_fee_payer:''};});
 if(a.condition!==undefined&&(Array.from(a.condition).length<1||Array.from(a.condition).length>128))throw new Error('草稿成色无效');
 if(a.rental_unit!==undefined&&!['HOUR','DAY'].includes(a.rental_unit))throw new Error('草稿计费单位无效');
 return {
  productId:a.product_id??'',displayName:a.display_name??'',model:'',condition:a.condition??'',
  identifierType:a.identifier_type??'',serialNumber:a.identifier_value??'',identifierLabel:a.identifier_type==='IMEI'?'IMEI':'设备序列号',identityLocked:draft.origin_kind==='EDIT',
  notes:a.defect_description??'',accessories:a.accessories_text??'',description:a.description??'',
  expectedRent:money(a.unit_price_fen),expectedDeposit:money(a.deposit_fen),minimumUnits:a.minimum_units??'',referenceValue:money(a.reference_value_fen),priceUnitLabel:a.rental_unit==='HOUR'?'小时租金':'日租金',
  availabilityStart:publicationLocalDay(a.available_from),availabilityEnd:publicationLocalDay(a.available_until,true),
  location:a.publication_location?.detail_address??'',deliveries,deliveryText:deliveries.filter(d=>d.selected).map(d=>d.label).join('、')||'尚未设置',
  publicationAddressId:a.delivery_options?.find(o=>o.source_address_id)?.source_address_id??'',
  meetingTime:a.delivery_options?.find(o=>o.method==='MEET')?.meeting_time_text??'',
  mediaNotice:(a.media?.length??0)>0?'已保存设备素材，可点击加载短效预览。':'草稿尚未绑定素材',
 };
}
/** PATCH/POST replaces the entire asset branch: retain every field outside the explicit edit set. */
export function applyDraftChanges<T extends DraftFields>(source:T,changes:DraftChanges,identityLocked:boolean):T{
 const next:Record<string,unknown>={...source};
 const textFields:Record<string,[string,number]>={displayName:['display_name',128],notes:['defect_description',2000],accessories:['accessories_text',2000],description:['description',4000],serialNumber:['identifier_value',128]};
 for(const [field,value] of Object.entries(changes)){
  if(!draftEditableFields.includes(field as DraftEditableField) || typeof value!=='string')throw new Error('草稿字段不可修改');
  if((field==='serialNumber'||field==='identifierType')&&identityLocked)throw new Error('已有资产的物理标识不可修改');
  let key:string;let normalized:string;
  if(field==='expectedRent'||field==='expectedDeposit'||field==='referenceValue'){key=field==='expectedRent'?'unit_price_fen':field==='expectedDeposit'?'deposit_fen':'reference_value_fen';normalized=value===''?'':draftMoneyInput(value);}
  else if(field==='minimumUnits'){key='minimum_units';if(value!==''&&!/^[1-9][0-9]*$/.test(value))throw new Error('最低租期须为正整数天');normalized=value;}
  else if(field==='condition'){key='condition';if(value!==''&&(Array.from(value).length<1||Array.from(value).length>128))throw new Error('成色描述须为 1–128 字');normalized=value;}
  else if(field==='identifierType'){key='identifier_type';if(value!==''&&!['IMEI','MANUFACTURER_SERIAL'].includes(value))throw new Error('请选择设备标识类型');normalized=value;}
  else if(field==='availabilityStart'||field==='availabilityEnd'){key=field==='availabilityStart'?'available_from':'available_until';normalized=value===''?'':localDay(value,field==='availabilityEnd');if(normalized!=='')next['timezone']='Asia/Shanghai';}
  else {const mapping=textFields[field];if(!mapping)throw new Error('草稿字段无效');key=mapping[0];if(Array.from(value).length>mapping[1])throw new Error('资料内容过长');normalized=value;}
 if(normalized==='')delete next[key];else next[key]=normalized;
 }
 const identifierIssue=publicationIdentifierIssue(next['identifier_type'] as string|undefined,next['identifier_value'] as string|undefined);
 if(identifierIssue)throw new Error(identifierIssue);
 return next as T;
}
/**
 * Binds the selected catalog entry onto the draft payload. The catalog is the only source of a
 * bindable standard product, so the value must be an opaque server identifier; an empty selection
 * removes the binding instead of writing an empty string.
 */
export function bindCatalogProduct<T extends DraftFields>(source:T,productId:string):T{
 const next:Record<string,unknown>={...source};
 if(productId===''){delete next['product_id'];delete next['rule_version_id'];delete next['eligibility_rule_version_id'];return next as T;}
 if(!/^[!-~]{1,64}$/.test(productId))throw new Error('商品标识无效');
 next['product_id']=productId;
 return next as T;
}
/** The WeChat address is structured account data; a C2C publication does not invent map coordinates. */
export function bindPublicationLocation<T extends DraftFields>(source:T,location:PublicationLocationInput|undefined):T{
 const next:Record<string,unknown>={...source};
 if(location===undefined){delete next['publication_location'];return next as T;}
 next['publication_location']={...location};
 return next as T;
}
export function bindDeliveryOptions<T extends DraftFields>(source:T,choices:readonly DeliveryChoice[],addressId:string):T {
 const next:Record<string,unknown>={...source};
 const selected=choices.filter(choice=>choice.selected);
 if(selected.length===0){delete next['delivery_options'];return next as T;}
 if(addressId!==''&&!/^[!-~]{1,64}$/.test(addressId))throw new Error('原发布地址标识无效');
 next['delivery_options']=selected.map(choice=>{
  if(!['TENANT','LESSOR'].includes(choice.outbound)||!['TENANT','LESSOR'].includes(choice.return))throw new Error('请分别选择去程和返程费用承担方');
  return {...(addressId?{source_address_id:addressId}:{}),method:choice.id==='express'?'EXPRESS':'RUNNER',outbound_fee_payer:choice.outbound,return_fee_payer:choice.return};
 });
 return next as T;
}
export function bindPublicationContext<T extends DraftFields>(source:T,context:{product_id:string;rental_unit:string;rule_version_id:string;eligibility_rule_version_id:string}):T{
 if(!/^[!-~]{1,64}$/.test(context.product_id)||context.rental_unit!=='DAY'||!/^[!-~]{1,64}$/.test(context.rule_version_id)||!/^[!-~]{1,64}$/.test(context.eligibility_rule_version_id))throw new Error('发布规则上下文无效');
 return {...source,product_id:context.product_id,rental_unit:'DAY',rule_version_id:context.rule_version_id,eligibility_rule_version_id:context.eligibility_rule_version_id};
}
export function bindAssetMedia<T extends DraftFields>(source:T,media:readonly AssetMediaChoice[]):T{
 if(media.length>20||new Set(media.map(item=>item.material_id)).size!==media.length||media.some(item=>!/^[!-~]{1,64}$/.test(item.material_id)||!['COVER','IMAGE','VIDEO'].includes(item.role)))throw new Error('设备素材清单无效');
 const next:Record<string,unknown>={...source};
 if(media.length===0)delete next['media'];else next['media']=media.map((item,index)=>({material_id:item.material_id,role:item.role,sort_order:index}));
 return next as T;
}
