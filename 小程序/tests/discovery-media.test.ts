import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discoveryMedia } from '../miniprogram/shared/presentation/discovery-media';
import { designAssets } from '../miniprogram/shared/design/assets';
import { getDevice } from '../miniprogram/shared/fixture';
import { deviceView } from '../miniprogram/shared/design/supply-display';

beforeEach(() => vi.stubGlobal('wx', { getSystemInfoSync: () => ({ fontSizeSetting: 16 }) }));
afterEach(() => vi.unstubAllGlobals());

describe('discovery reference media', () => {
  it('changes only the illustration while retaining business values', () => {
    const source = [deviceView({ ...getDevice('fujifilm-x100-cabinet'), image: '' }, 'old')];
    const result = discoveryMedia(source);
    expect(result[0]).toMatchObject({ ...source[0], displayTags: result[0]?.displayTags, displayImage: designAssets.discoveryReferenceFuji });
    expect(result[0]?.id).toBe(source[0]?.id);
    expect(source[0]?.displayImage).toBe('old');
  });
  it('does not use a different product photograph for an unknown model', () => {
    const unknown = deviceView({ ...getDevice('fujifilm-x100-cabinet'), id: 'unknown', name: 'unknown', image: '' }, 'wrong-photo');
    expect(discoveryMedia([unknown])[0]?.displayImage).toBe('');
  });
});
