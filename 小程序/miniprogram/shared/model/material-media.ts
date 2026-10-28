import type { components } from '../../../types/api/schema';

type Schema = components['schemas'];
export type MaterialUploadClass = Extract<Schema['MaterialClass'], 'PROFILE_IMAGE' | 'EVIDENCE_IMAGE' | 'EVIDENCE_VIDEO' | 'RENTAL_ASSET_IMAGE' | 'RENTAL_ASSET_VIDEO' | 'CHAT_IMAGE' | 'CONTRACT_SIGNATURE_IMAGE'>;
export type Material = Schema['Material'];
export type MaterialFileResult = Schema['MaterialFileResult'];
export type PublicMaterialMedia = Schema['PublicMaterialMedia'];
export type MaterialPhoto = Schema['MaterialPhoto'];
export type MaterialPoster = Schema['MaterialPoster'];
export type MediaMetadata = Schema['MediaMetadataV1'];
export type ReadyMaterialMedia = Pick<MaterialFileResult, 'material_id' | 'public_url' | 'playback_url' | 'mime_type' | 'size_bytes' | 'metadata' | 'poster'> & {src:string;posterURL:string};

export type MaterialUploadPhase = 'SELECTED' | 'UPLOADING' | 'PROCESSING' | 'UNKNOWN' | 'FAILED' | 'READY' | 'CANCELLED';

/** Local intent only. Business material facts are supplied by generated DTOs. */
export interface MaterialUploadIntent {
 readonly owner: string;
 readonly field: string;
 readonly item: string;
 readonly generation: number;
 readonly file: string;
 readonly key: string;
 readonly materialClass: MaterialUploadClass;
 materialId: string | null;
 phase: MaterialUploadPhase;
 progress: number;
 error: string;
}

export function createMaterialUploadIntent(input: Omit<MaterialUploadIntent, 'materialId' | 'phase' | 'progress' | 'error'>): MaterialUploadIntent {
 if(!input.owner||!input.field||!input.item||!input.file||!Number.isSafeInteger(input.generation)||input.generation<1||!/^[!-~]{1,64}$/.test(input.key))throw new Error('素材上传原意图无效');
 return {...input,materialId:null,phase:'SELECTED',progress:0,error:''};
}

export function materialUploadBlocksSave(intent: MaterialUploadIntent | undefined): boolean {
 return !!intent&&intent.phase!=='READY'&&intent.phase!=='CANCELLED';
}

export function matchesMaterialUploadIntent(intent: MaterialUploadIntent, target: Pick<MaterialUploadIntent, 'owner' | 'field' | 'item' | 'generation'>): boolean {
 return intent.phase!=='CANCELLED'&&intent.owner===target.owner&&intent.field===target.field&&intent.item===target.item&&intent.generation===target.generation;
}
