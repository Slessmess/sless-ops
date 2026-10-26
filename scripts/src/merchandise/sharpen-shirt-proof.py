"""Faithful 4x super-resolution proof; original RGBA artwork is never overwritten.

Model: RealESRGAN x4plus anime 6B, ONNX, CPU-only. This is an enhanced upscale,
not a claim that the original artwork contained native 4096-pixel detail.
"""
import hashlib
import json
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

SOURCE = Path("attached_assets/generated_images/merch-refresh-halloween-shirt-transparent.png")
MODEL = Path("generated-artifacts/models/RealESRGAN_x4plus_anime_6B.onnx")
OUTPUT = Path("attached_assets/generated_images/halloween-large-proof")
MODEL_SHA = "82f458db35dd94f2200f9a32fd0232c581da861c1b2e5c956d5574b0e9c5aea2"

if hashlib.sha256(MODEL.read_bytes()).hexdigest() != MODEL_SHA:
    raise RuntimeError("Model checksum mismatch")
OUTPUT.mkdir(parents=True, exist_ok=True)
source_bytes = SOURCE.read_bytes()
source = Image.open(SOURCE).convert("RGBA")
rgb = np.asarray(source.convert("RGB"), dtype=np.float32) / 255.0
height, width = rgb.shape[:2]
options = ort.SessionOptions()
options.intra_op_num_threads = 3
options.inter_op_num_threads = 1
session = ort.InferenceSession(str(MODEL), sess_options=options, providers=["CPUExecutionProvider"])
input_name = session.get_inputs()[0].name
output = np.empty((height * 4, width * 4, 3), dtype=np.uint8)
tile, pad = 192, 24
started = time.monotonic()
for y in range(0, height, tile):
    for x in range(0, width, tile):
        left, top = max(0, x - pad), max(0, y - pad)
        right, bottom = min(width, x + tile + pad), min(height, y + tile + pad)
        crop = rgb[top:bottom, left:right].transpose(2, 0, 1)[None]
        result = session.run(None, {input_name: np.ascontiguousarray(crop)})[0]
        result = np.clip(np.rint(result[0].transpose(1, 2, 0) * 255), 0, 255).astype(np.uint8)
        x_end, y_end = min(x + tile, width), min(y + tile, height)
        output[y * 4:y_end * 4, x * 4:x_end * 4] = result[
            (y - top) * 4:(y_end - top) * 4, (x - left) * 4:(x_end - left) * 4
        ]
    print(json.dumps({"rowsComplete": min(y + tile, height), "rows": height,
                      "elapsedSeconds": round(time.monotonic() - started)}), flush=True)

# Keep the original alpha contour, lettering and composition. Blend a small
# amount of the original resampling back in to reduce artificial oversharpening.
enhanced = Image.fromarray(output)
baseline = source.convert("RGB").resize((width * 4, height * 4), Image.Resampling.LANCZOS)
enhanced = Image.blend(baseline, enhanced, 0.82)
enhanced.putalpha(source.getchannel("A").resize(enhanced.size, Image.Resampling.LANCZOS))
path = OUTPUT / "shirt-art-enhanced-4096.png"
enhanced.save(path, dpi=(300, 300))
receipt = {
    "source": str(SOURCE), "sourceSha256": hashlib.sha256(source_bytes).hexdigest(),
    "sourcePixels": list(source.size), "output": str(path), "outputPixels": list(enhanced.size),
    "method": "RealESRGAN 4x anime 6B; 82% enhanced RGB + 18% original Lanczos RGB; original alpha retained",
    "modelSha256": MODEL_SHA, "nativeDetailClaim": False, "liveProductChanged": False,
    "canvasChanged": False, "elapsedSeconds": round(time.monotonic() - started),
}
(OUTPUT / "enhancement-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt), flush=True)
