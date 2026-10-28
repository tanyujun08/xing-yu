import { describe, expect, test } from 'vitest';
import dockerfile from '../../../Dockerfile?raw';
import nginxConfig from '../../../deploy/nginx.conf?raw';

describe('packaged site network policy', () => {
  test('allows the Tencent map SDK and service without opening a business API channel', () => {
    expect(nginxConfig).toContain(
      "script-src 'self' 'unsafe-eval' https://map.qq.com https://mapapi.qq.com https://apikey.map.qq.com https://confinfo.map.qq.com https://overseactrl.map.qq.com https://apis.map.qq.com",
    );
    expect(nginxConfig).toContain(
      'connect-src https://map.qq.com https://apis.map.qq.com https://mapapi.qq.com https://vectorsdk.map.qq.com https://pr.map.qq.com https://mapstyle.qpic.cn https://rt0.map.gtimg.com https://rt1.map.gtimg.com https://rt2.map.gtimg.com https://rt3.map.gtimg.com',
    );
    expect(nginxConfig).not.toContain('connect-src *');
    expect(nginxConfig).not.toMatch(/(?:script|connect)-src[^;]*https:\/\/\*\.(?:qq\.com|qpic\.cn)/);
    expect(nginxConfig).not.toMatch(/connect-src[^;]*(127\.0\.0\.1|localhost|https?:\/\/[^;\s]+\/api(?:[\s;/]|$))/);
  });

  test('limits the approved dynamic evaluation exception to the packaged script policy', () => {
    expect(nginxConfig.match(/'unsafe-eval'/g)).toHaveLength(1);
    expect(nginxConfig).not.toMatch(/(?:default|style|connect|worker)-src[^;]*'unsafe-eval'/);
  });

  test('passes the demo map key through build ARG without rendering it in the RUN command', () => {
    expect(dockerfile).toContain('ARG VITE_TENCENT_MAP_KEY=""');
    expect(dockerfile).toContain('RUN npm run build');
    expect(dockerfile).not.toMatch(/RUN\s+VITE_TENCENT_MAP_KEY=/);
  });

  test('limits direct object uploads and playback to one validated bucket origin in API mode', () => {
    expect(dockerfile).toContain('ARG DIRECT_OSS_ORIGIN=""');
    expect(dockerfile).toContain('Invalid direct OSS origin');
    expect(dockerfile).toContain('replace("connect-src "');
    expect(dockerfile).toContain('replace("img-src "');
    expect(dockerfile).toContain('replace("media-src "');
    expect(nginxConfig).not.toContain('https://*.oss-cn-');
  });
});
