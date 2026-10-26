---
name: Shirt print sizing
description: Repeated owner correction: large physical chest prints, not small motifs padded into a large file.
---

The owner said: “The inmage is too small again. Stop making tshirt images so small.”
Use the previously approved approximately 10.5-inch chest-print direction for
refreshed T-shirts, reducing only where the actual supplier print area requires it.
Keep the original three shirts and already-approved large Halloween tee protected.

**Why:** Full-template PNGs with padded artwork and a source-pixel enlargement cap
produced visibly small physical prints even though the output files were large.
The owner has now corrected small shirt graphics repeatedly.

**How to apply:** Crop transparent padding from the approved art first. Set the
physical artwork width using the supplier catalog's actual front placeholder
dimensions and explicit placement scale, not the old uploaded image dimensions.
Check the supplier garment mockup before live replacement. Do not merely zoom or
crop the website photo, and do not shrink the physical print to satisfy a nominal
native-PPI floor. Upscaling improves presentation but does not create native detail.

Near-transparent background noise can defeat a normal alpha bounding-box crop.
Measure the visible ink boundary with a meaningful alpha threshold, not any
nonzero alpha pixel, before sizing the design. Keep the small-size print-area
height limits in the calculation so the full illustration is not clipped.
