"""Crop only the artwork from a concept mockup for a new illustrated proof.

These references are not print masters; their native source detail is limited.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[3]
assets = root / "attached_assets/generated_images"
source = Image.open(assets / "merch-refresh-holiday-christmas-gift-breakout.png")
assert source.size == (1024, 1024), "Re-measure reference crop after source changes"
source.crop((345, 245, 715, 760)).save(assets / "christmas-art-only-reference.png")
