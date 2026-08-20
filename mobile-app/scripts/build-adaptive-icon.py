#!/usr/bin/env python3
"""
Build a padded Android adaptive-icon foreground from icon.png.

Does NOT alter icon.png artwork. Scales the full existing logo into the
center 66% safe zone of a 1024x1024 transparent canvas (Android / Expo guidance).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "images" / "icon.png"
OUT = ROOT / "assets" / "images" / "adaptive-icon.png"
PREVIEW = ROOT / "scripts" / "adaptive-icon-preview.png"

CANVAS = 1024
# Android / Expo: keep important content in center ~66% (676px).
SAFE_FRAC = 0.66
SAFE = int(CANVAS * SAFE_FRAC)  # 675–676


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    if src.size != (CANVAS, CANVAS):
        src = src.resize((CANVAS, CANVAS), Image.Resampling.LANCZOS)

    # Scale full artwork into the safe zone (preserves logo; adds transparent padding).
    scaled = src.resize((SAFE, SAFE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    offset = (CANVAS - SAFE) // 2
    canvas.paste(scaled, (offset, offset), scaled)
    canvas.save(OUT, "PNG", optimize=True)

    # Local preview: circle + squircle masks over white background (not shipped).
    def mask_preview(shape: str) -> Image.Image:
        bg = Image.new("RGBA", (CANVAS, CANVAS), (255, 255, 255, 255))
        composed = Image.alpha_composite(bg, canvas)
        mask = Image.new("L", (CANVAS, CANVAS), 0)
        draw = ImageDraw.Draw(mask)
        margin = int(CANVAS * 0.02)
        box = [margin, margin, CANVAS - margin, CANVAS - margin]
        if shape == "circle":
            draw.ellipse(box, fill=255)
        else:
            # Approximate squircle / rounded square
            radius = int(CANVAS * 0.22)
            draw.rounded_rectangle(box, radius=radius, fill=255)
        out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        out.paste(composed, (0, 0), mask)
        return out

    circle = mask_preview("circle").resize((320, 320), Image.Resampling.LANCZOS)
    squircle = mask_preview("squircle").resize((320, 320), Image.Resampling.LANCZOS)
    preview = Image.new("RGBA", (680, 360), (30, 30, 36, 255))
    preview.paste(circle, (20, 20), circle)
    preview.paste(squircle, (360, 20), squircle)
    d = ImageDraw.Draw(preview)
    d.text((20, 345), "circle mask", fill=(200, 200, 200, 255))
    d.text((360, 345), "squircle mask", fill=(200, 200, 200, 255))
    # Safe-zone guide on a third mini view
    preview.save(PREVIEW, "PNG", optimize=True)

    pad = offset
    print(
        f"Wrote {OUT.relative_to(ROOT)} "
        f"(safe={SAFE}px / {SAFE_FRAC:.0%}, pad={pad}px each side)"
    )
    print(f"Wrote preview {PREVIEW.relative_to(ROOT)}")
    print(f"icon.png unchanged: {SRC.stat().st_size} bytes")
    print(f"adaptive-icon.png: {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
