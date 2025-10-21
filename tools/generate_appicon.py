#!/usr/bin/env python3
import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except Exception:
    print("Pillow (PIL) not found. Install with: pip install pillow", file=sys.stderr)
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
APPICON_DIR = PROJECT_ROOT / "ios/AfetNet/Images.xcassets/AppIcon.appiconset"
BASE_ICON = PROJECT_ROOT / "tools/afetneticon_fixed.png"

# Required outputs
SPECS = [
    # iPhone
    ("iphone-notification-20@2x.png", 40),
    ("iphone-notification-20@3x.png", 60),
    ("iphone-settings-29@2x.png", 58),
    ("iphone-settings-29@3x.png", 87),
    ("iphone-spotlight-40@2x.png", 80),
    ("iphone-spotlight-40@3x.png", 120),
    ("iphone-app-60@2x.png", 120),
    ("iphone-app-60@3x.png", 180),
    # iPad
    ("ipad-notification-20@1x.png", 20),
    ("ipad-notification-20@2x.png", 40),
    ("ipad-settings-29@1x.png", 29),
    ("ipad-settings-29@2x.png", 58),
    ("ipad-spotlight-40@1x.png", 40),
    ("ipad-spotlight-40@2x.png", 80),
    ("ipad-app-76@1x.png", 76),
    ("ipad-app-76@2x.png", 152),
    ("ipad-pro-app-83.5@2x.png", 167),
    # Marketing
    ("app-store-1024.png", 1024),
]


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)

def backup_existing(dir_path: Path):
    if dir_path.exists():
        # create a lightweight backup of previous Contents.json to avoid losing manual edits
        import time, shutil
        ts = time.strftime('%Y%m%d-%H%M%S')
        backup_dir = dir_path.parent / f"AppIcon.appiconset.backup-{ts}"
        backup_dir.mkdir(parents=True, exist_ok=True)
        for p in dir_path.glob("*.png"):
            shutil.copy2(p, backup_dir / p.name)
        cj = dir_path / "Contents.json"
        if cj.exists():
            shutil.copy2(cj, backup_dir / cj.name)


def load_or_create_base() -> Image.Image:
    size = 1024
    if BASE_ICON.exists():
        img = Image.open(BASE_ICON).convert("RGB")
        return img.resize((size, size), Image.LANCZOS)

    # Create red background with white AFN monogram
    img = Image.new("RGB", (size, size), "#D72638")
    draw = ImageDraw.Draw(img)
    # Safe margin 144px on each side
    margin = 144
    # Try SF Pro Rounded Heavy-like fallback using a bold system font if available
    font_size = 640
    font = None
    # Common font fallbacks
    candidates = [
        "/System/Library/Fonts/SFNSRounded.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/SFNS.ttf",
    ]
    for p in candidates:
        if Path(p).exists():
            try:
                font = ImageFont.truetype(p, font_size)
                break
            except Exception:
                continue
    if font is None:
        font = ImageFont.load_default()

    text = "AFN"
    # Compute max font size to fit within safe area
    # Reduce until fits
    while True:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        if tw <= (size - 2 * margin) and th <= (size - 2 * margin):
            break
        if hasattr(font, "path"):
            font_size -= 8
            if font_size <= 100:
                break
            try:
                font = ImageFont.truetype(font.path, font_size)
            except Exception:
                break
        else:
            break

    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) // 2
    y = (size - th) // 2
    draw.text((x, y), text, fill="#FFFFFF", font=font)
    return img


def write_contents_json():
    # Static Contents.json matching required idioms/sizes
    contents = {
        "images": [
            {"size": "20x20", "idiom": "iphone", "filename": "iphone-notification-20@2x.png", "scale": "2x"},
            {"size": "20x20", "idiom": "iphone", "filename": "iphone-notification-20@3x.png", "scale": "3x"},
            {"size": "29x29", "idiom": "iphone", "filename": "iphone-settings-29@2x.png", "scale": "2x"},
            {"size": "29x29", "idiom": "iphone", "filename": "iphone-settings-29@3x.png", "scale": "3x"},
            {"size": "40x40", "idiom": "iphone", "filename": "iphone-spotlight-40@2x.png", "scale": "2x"},
            {"size": "40x40", "idiom": "iphone", "filename": "iphone-spotlight-40@3x.png", "scale": "3x"},
            {"size": "60x60", "idiom": "iphone", "filename": "iphone-app-60@2x.png", "scale": "2x"},
            {"size": "60x60", "idiom": "iphone", "filename": "iphone-app-60@3x.png", "scale": "3x"},
            {"size": "20x20", "idiom": "ipad", "filename": "ipad-notification-20@1x.png", "scale": "1x"},
            {"size": "20x20", "idiom": "ipad", "filename": "ipad-notification-20@2x.png", "scale": "2x"},
            {"size": "29x29", "idiom": "ipad", "filename": "ipad-settings-29@1x.png", "scale": "1x"},
            {"size": "29x29", "idiom": "ipad", "filename": "ipad-settings-29@2x.png", "scale": "2x"},
            {"size": "40x40", "idiom": "ipad", "filename": "ipad-spotlight-40@1x.png", "scale": "1x"},
            {"size": "40x40", "idiom": "ipad", "filename": "ipad-spotlight-40@2x.png", "scale": "2x"},
            {"size": "76x76", "idiom": "ipad", "filename": "ipad-app-76@1x.png", "scale": "1x"},
            {"size": "76x76", "idiom": "ipad", "filename": "ipad-app-76@2x.png", "scale": "2x"},
            {"size": "83.5x83.5", "idiom": "ipad", "filename": "ipad-pro-app-83.5@2x.png", "scale": "2x"},
            {"size": "1024x1024", "idiom": "ios-marketing", "filename": "app-store-1024.png", "scale": "1x"}
        ],
        "info": {"version": 1, "author": "xcode"}
    }
    import json
    with open(APPICON_DIR / "Contents.json", "w", encoding="utf-8") as f:
        json.dump(contents, f, ensure_ascii=False, indent=2)


def main():
    ensure_dir(APPICON_DIR)
    backup_existing(APPICON_DIR)
    base = load_or_create_base()

    # Ensure sRGB PNG without alpha
    for name, size in SPECS:
        out = APPICON_DIR / name
        img = base.resize((size, size), Image.LANCZOS)
        # remove alpha by converting to RGB explicitly
        img = img.convert("RGB")
        img.save(out, format="PNG", optimize=True)

    write_contents_json()
    print("Icons generated:")
    for name, _ in SPECS:
        print(f" - {name}")


if __name__ == "__main__":
    main()


