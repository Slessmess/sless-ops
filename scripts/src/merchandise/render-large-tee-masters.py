"""Trim approved artwork before enlargement; never pad it into a full template."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parents[3]
out = root / "generated-artifacts/large-tee-correction"
out.mkdir(parents=True, exist_ok=True)
sources = {
    "breakout": "sless-ring-breakout-flat-master.png",
    "champion": "sless-champion-flat-master.png",
    "Halloween": "merch-refresh-halloween-shirt-transparent.png",
    "Thanksgiving": "thanksgiving-be-thankful-for-sless-art.png",
    "Christmas": "christmas-sless-is-cheer-thin-armbands-art.png",
}
result = {}
for family, name in sources.items():
    im = Image.open(root / "attached_assets/generated_images" / name).convert("RGBA")
    if family != "Halloween":
        pixels = np.array(im)
        distance = (255 - pixels[:, :, :3].astype("float32")).max(axis=2)
        pixels[:, :, 3] = np.clip((distance - 4) * 255 / 16, 0, 255).astype("uint8")
        im = Image.fromarray(pixels)
    # Very faint white-background compression noise must not enlarge the crop.
    # Measure the visible ink, not pixels with alpha of only 1/255.
    visible = im.getchannel("A").point(lambda alpha: 255 if alpha >= 128 else 0)
    im = im.crop(visible.getbbox())
    native = im.size
    im = im.resize((3150, round(3150 * im.height / im.width)), Image.Resampling.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=115, threshold=3))
    path = out / f"{family}-trimmed-large.png"
    im.save(path, dpi=(300, 300), compress_level=4)
    result[family] = {
        "file": str(path.relative_to(root)), "width": im.width, "height": im.height,
        "nativeWidth": native[0], "nativeHeight": native[1], "enhancedNotNative300Dpi": True,
    }
(out / "masters.json").write_text(json.dumps(result, indent=2))
print(json.dumps(result))
