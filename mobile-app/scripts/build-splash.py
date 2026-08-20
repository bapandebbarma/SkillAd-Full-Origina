#!/usr/bin/env python3
"""
Build SkillAd native splash icon from the official icon.png.

Android 12+ / Expo splash-screen:
  - System splash shows a CENTERED ICON on a solid background (not a full-bleed billboard).
  - Title/tagline cannot reliably appear in the native splash — those belong on the
    short branded JS screen (see components/BrandedSplash.tsx).
  - Android recommends splash icon display width <= ~200dp (expo imageWidth).
  - Keep artwork inside the center ~66% safe zone so circular masking does not clip.

Outputs:
  assets/images/splash-icon.png  — square logo asset used by expo-splash-screen
  assets/images/splash.png       — same asset (legacy app.json splash.image path)

Does NOT modify icon.png or adaptive-icon.png.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ICON = ROOT / "assets" / "images" / "icon.png"
OUT_ICON = ROOT / "assets" / "images" / "splash-icon.png"
OUT_LEGACY = ROOT / "assets" / "images" / "splash.png"

CANVAS = 1024
# Center safe zone (~66%) — Android circular splash mask safe area.
SAFE_FRAC = 0.66


def content_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    """Bounding box of non-near-white, non-transparent pixels."""
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 10:
                continue
            if r > 248 and g > 248 and b > 248:
                continue
            xs.append(x)
            ys.append(y)
    if not xs:
        return (0, 0, w, h)
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)


def main() -> None:
    src = Image.open(ICON).convert("RGBA")
    if src.size != (CANVAS, CANVAS):
        src = src.resize((CANVAS, CANVAS), Image.Resampling.LANCZOS)

    safe = int(CANVAS * SAFE_FRAC)
    logo = src.resize((safe, safe), Image.Resampling.LANCZOS)

    # Opaque white canvas — matches splash backgroundColor #FFFFFF.
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (255, 255, 255, 255))
    offset = (CANVAS - safe) // 2
    canvas.paste(logo, (offset, offset), logo)

    rgb = canvas.convert("RGB")
    rgb.save(OUT_ICON, "PNG", optimize=True)
    rgb.save(OUT_LEGACY, "PNG", optimize=True)

    bbox = content_bbox(canvas)
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    print(
        f"Wrote {OUT_ICON.relative_to(ROOT)} and {OUT_LEGACY.relative_to(ROOT)}\n"
        f"  canvas={CANVAS}x{CANVAS}\n"
        f"  logo_placed={safe}x{safe} ({SAFE_FRAC:.0%} of canvas, Android safe zone)\n"
        f"  content_bbox={bbox} -> {bw}x{bh} "
        f"({100 * bw / CANVAS:.1f}% W, {100 * bh / CANVAS:.1f}% H)\n"
        f"  padding LTRB=({bbox[0]}, {bbox[1]}, {CANVAS - bbox[2]}, {CANVAS - bbox[3]})\n"
        f"  bytes splash-icon={OUT_ICON.stat().st_size}"
    )


if __name__ == "__main__":
    main()
