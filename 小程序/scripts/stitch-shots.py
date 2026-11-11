#!/usr/bin/env python3
"""把 auto-measure 的分段截图拼成一张完整长图。
用法：python3 scripts/stitch-shots.py <截图目录> <输出目录> [前缀]
读取 <前缀>*.shots.json（每张截图的文件名与实际滚动位置），固定的顶栏和底栏只保留一份。"""
import json, sys, glob, os
from PIL import Image, ImageChops

def same_rows(a, b, from_top):
    """两张图从顶部（或底部）起完全相同的行数。"""
    w, h = a.size
    diff = ImageChops.difference(a.convert('RGB'), b.convert('RGB'))
    rows = range(h) if from_top else range(h - 1, -1, -1)
    n = 0
    for y in rows:
        if diff.crop((0, y, w, y + 1)).getbbox():
            break
        n += 1
    return n

def stitch(meta_path, out_dir):
    meta = json.load(open(meta_path, encoding='utf8'))
    base = os.path.dirname(meta_path)
    shots = [s for s in meta['shots'] if os.path.exists(os.path.join(base, s['file']))]
    if not shots:
        return None
    images = [Image.open(os.path.join(base, s['file'])).convert('RGB') for s in shots]
    w, h = images[0].size
    out = os.path.join(out_dir, os.path.basename(meta_path).replace('.shots.json', '-long.png'))
    if len(images) == 1:
        images[0].save(out); return out
    scale = w / meta['window']['width'] if meta.get('window', {}).get('width') else h / 844
    head = min(same_rows(images[0], im, True) for im in images[1:])
    foot = min(same_rows(images[0], im, False) for im in images[1:])
    total = h + round(shots[-1]['top'] * scale)
    canvas = Image.new('RGB', (w, total), 'white')
    canvas.paste(images[0], (0, 0))
    for shot, im in zip(shots[1:], images[1:]):
        y = round(shot['top'] * scale)
        canvas.paste(im.crop((0, head, w, h - foot)), (0, y + head))
    if foot:
        canvas.paste(images[-1].crop((0, h - foot, w, h)), (0, total - foot))
    canvas.save(out)
    return out

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    prefix = sys.argv[3] if len(sys.argv) > 3 else ''
    os.makedirs(dst, exist_ok=True)
    for meta in sorted(glob.glob(os.path.join(src, prefix + '*.shots.json'))):
        print(stitch(meta, dst))
