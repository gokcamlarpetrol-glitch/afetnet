#!/usr/bin/env python3
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[1]
HOME = Path.home()
DESKTOP = HOME / 'Desktop'
SRC_CANDIDATES = [
    # Desktop priority as requested
    DESKTOP / 'afetnet2.png',
    DESKTOP / 'afetnet2.jpg',
    DESKTOP / 'afetnet2.jpeg',
    DESKTOP / 'afetneticon2.png',
    DESKTOP / 'afetneticon2.jpg',
    DESKTOP / 'afetneticon2.jpeg',
    DESKTOP / 'afetneticon.png',
    DESKTOP / 'afetneticon.jpg',
    DESKTOP / 'afetneticon.jpeg',
    # Fallbacks in repo
    ROOT / 'tools' / 'base_icon_1024.png',
    ROOT / 'tools' / 'source.png',
    ROOT / 'assets' / 'icon-1024.png',
    ROOT / 'assets' / 'icon.png',
]
OUT = ROOT / 'tools' / 'afetneticon_fixed.png'

# INVERTED COLORS: White background + Red content
BG_WHITE = '#FFFFFF'
RED = '#E63226'

def load_source():
    for p in SRC_CANDIDATES:
        if p.exists():
            print(f'Using source: {p}')
            return Image.open(p).convert('RGBA')
    raise SystemExit('No source icon found (looked in tools/, assets/, and Desktop)')

def isolate_white(im: Image.Image) -> Image.Image:
    """Extract white pixels (map+text) and convert to RED on transparent background."""
    if im.mode != 'RGBA':
        im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    
    # Build binary mask for near-white regions
    mask = Image.new('L', (w, h), 0)
    mpx = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # Detect white pixels
            if r >= 235 and g >= 235 and b >= 235 and a > 10:
                mpx[x, y] = 255
    
    # Dilate mask to capture anti-aliased edges
    mask = mask.filter(ImageFilter.MaxFilter(size=9))
    
    # Create RED layer using mask (inverted: white becomes red)
    red_layer = Image.new('RGBA', (w, h), (*tuple(int(RED.lstrip('#')[i:i+2], 16) for i in (0, 2, 4)), 255))
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(red_layer, (0, 0), mask)
    return out

def main():
    size = 1024
    # WHITE background (inverted)
    base = Image.new('RGB', (size, size), BG_WHITE)
    src = load_source().convert('RGBA')

    # Extract white pixels and convert to RED
    try:
        src = isolate_white(src)
    except Exception as e:
        print(f'Warning: isolate_white failed: {e}')
        pass

    # MAXIMUM FILL: Scale to 105% to fill entire canvas with minimal margin
    # This ensures map and text fill the icon completely
    fill_scale = 1.05
    target = int(size * fill_scale)
    src_resized = src.resize((target, target), Image.LANCZOS)
    
    # Center with slight crop to fill edges
    x = -(target - size) // 2
    y = -(target - size) // 2
    
    # Paste red content on white background
    base.paste(src_resized, (x, y), src_resized)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Save as RGB (zero alpha channel)
    base.save(OUT, format='PNG', optimize=False)
    print(f'✅ Wrote {OUT} (1024x1024, WHITE bg + RED content, fill scale={fill_scale})')

if __name__ == '__main__':
    main()
