---
name: Native image dimensions
description: Avoid incorrect product crops caused by treating a resized image-reading preview as the source pixel size.
---

Measure an image's native dimensions before doing pixel-based crops. A rendered
image-reading preview can have different dimensions from the underlying file.

**Why:** Cropping a three-shirt collage using its resized display dimensions cut
off designs and omitted the third shirt, even though the resulting filenames
and caption-to-URL mappings looked correct.

**How to apply:** Use image metadata tools to get the actual width and height,
calculate crop coordinates against those values, and visually inspect the
resulting images before uploading. Matching filenames and alt text do not prove
the pictured product is correct.

Inspect transparent apparel art on the intended garment color, especially when
the artwork contains pale lettering or disconnected ornaments.

**Why:** Semantic background removal can retain the central character while
silently deleting cream logo letters that resemble the background. A white-backed
preview concealed this loss; the dark-shirt composition exposed it.

**How to apply:** Check all lettering, small accents, and interior negative spaces
after masking. For deliberately uniform backgrounds, a controlled color-key mask
can preserve pale ink better than semantic subject extraction. Do not assume a
valid alpha channel means the whole design survived.