"""Product-specific illustrated layouts, without changing existing variants/prices."""
import json
from pathlib import Path
from html import escape
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / "attached_assets/generated_images"
OUT = ROOT / "generated-artifacts/catalog-refresh"
OUT.mkdir(parents=True, exist_ok=True)
for sizing_record in (
    OUT / "rendered.json",
    ROOT / "wordpress/sless-refresh/illustrated-catalog-release.json",
):
    if not sizing_record.exists():
        continue
    previous = json.loads(sizing_record.read_text())
    if isinstance(previous, dict):
        previous = previous.get("products", [])
    if any(item.get("printSizing") == "large-front" for item in previous):
        raise SystemExit(
            "Calibrated large-front shirts are protected. Use the explicit "
            "large-tee renderer/operator rather than regenerating padded templates."
        )
before = json.loads((OUT / "before.json").read_text())
products = {p["id"]: p for p in before}
plan = json.loads((ROOT / "wordpress/sless-refresh/merchandise-production-plan.json").read_text())
receipts = json.loads((ROOT / "wordpress/sless-refresh/merchandise-publish-receipts.json").read_text())
sources = {
    "breakout": "sless-ring-breakout-flat-master.png",
    "champion": "sless-champion-flat-master.png",
    "mascot": "sless-mascot-patch-master.png",
    "Thanksgiving": "thanksgiving-be-thankful-for-sless-art.png",
    "Christmas": "christmas-sless-is-cheer-thin-armbands-art.png",
    "Halloween": "merch-refresh-halloween-shirt-transparent.png",
}
art = {}
for key, name in sources.items():
    image = Image.open(ASSETS / name).convert("RGBA")
    if key != "Halloween":
        pixels = np.array(image)
        distance = (255 - pixels[:, :, :3].astype("float32")).max(axis=2)
        pixels[:, :, 3] = np.clip((distance - 4) * 255 / 16, 0, 255).astype("uint8")
        image = Image.fromarray(pixels)
    art[key] = image.crop(image.getchannel("A").getbbox())

palette = {
    "Evergreen": ("#171023", "#7652a4", "#d9b15e"),
    "Halloween": ("#241534", "#9256bf", "#ef8d32"),
    "Thanksgiving": ("#f3e6cc", "#74344a", "#b67934"),
    "Christmas": ("#123c2b", "#ab2840", "#d6a65e"),
}
families = {
    "breakout": ("Sless Ring Breaker", "Sless Taylor bursts out of purple ring-rope energy, with an expressive comic-book pose and the Sless Is More signature."),
    "champion": ("Sless Champion", "Sless Taylor takes center stage with a gold championship belt, purple-and-black gear and bold lightning artwork."),
    "mascot": ("Sless Lightning Mascot", "The Sless Taylor mascot becomes a compact purple-and-gold lightning-shield emblem, replacing the old stacked text."),
    "Halloween": ("Sless After Dark", "Sless Taylor crouches above a haunted Halloween scene with a pumpkin lantern, orange moon and purple clouds."),
    "Thanksgiving": ("Be Thankful for Sless!", "Sless serves up a championship pie in a purple apron, framed by autumn leaves and the words “Be Thankful for Sless!”"),
    "Christmas": ("Sless Is Cheer", "Sless breaks through festive gift wrap in a Santa hat and purple-and-black wrestling gear, with a raised gift, candy-cane prop and slim upper-arm bands."),
}


def place(canvas, source, box, max_inches=8.0):
    x, y, width, height = box
    # Cap physical enlargement using actual cropped source pixels. Pattern and
    # frame elements are drawn at template resolution, not stretched source art.
    cap = min(max_inches * 300, source.width * 300 / 110)
    scale = min(width / source.width, height / source.height, cap / source.width)
    size = (max(1, round(source.width * scale)), max(1, round(source.height * scale)))
    piece = source.resize(size, Image.Resampling.LANCZOS)
    if scale > 1:
        piece = piece.filter(ImageFilter.UnsharpMask(radius=1.0, percent=110, threshold=3))
    canvas.alpha_composite(piece, (round(x + (width - size[0]) / 2), round(y + (height - size[1]) / 2)))


def background(width, height, collection, repeat=False):
    base, purple, gold = palette[collection]
    canvas = Image.new("RGBA", (width, height), base)
    draw = ImageDraw.Draw(canvas)
    step = min(1100, max(240, min(width, height) // 3))
    for row, y in enumerate(range(-step, height + step, step)):
        for x in range(-step, width + step, step):
            x += step // 2 if row % 2 else 0
            d = step * .15
            bolt = [(x, y-d), (x+d*.5, y-d*.1), (x+d*.1, y),
                    (x+d*.6, y+d), (x-d*.6, y+d*.1), (x-d*.1, y)]
            draw.polygon(bolt, fill=purple)
            r = max(3, step // 60)
            draw.ellipse((x+step*.4-r, y+step*.4-r, x+step*.4+r, y+step*.4+r), fill=gold)
            if repeat:
                place(canvas, art["mascot"], (x+step*.2, y+step*.05, step*.52, step*.72), max_inches=2.0)
    return canvas


def layout(item, family, position, width, height):
    category = item["category"]
    method = position.get("decoration_method", "")
    name = item["catalogTitle"]
    small = category == "Headwear"
    allover = "AOP" in name or name == "Backpack"
    full = category in ("Drinkware", "Desk and tech", "Home") or name == "Weekender Bag" or allover
    image = background(width, height, item["collection"], repeat=allover) if full else Image.new("RGBA", (width, height))
    source = art["mascot" if small else family]
    wrap = (category == "Drinkware" and width / height > 1.8) or "Pillow" in name or "Hardcover Journal" in name
    if allover:
        return image, "An all-over lightning-and-mascot repeat is arranged across the selected print panels."
    if small:
        place(image, source, (width*.08, height*.05, width*.84, height*.9), max_inches=3)
        return image, "A simplified mascot shield is centered in the available front decoration area."
    if "Phone Cases" in name:
        place(image, source, (width*.20, height*.25, width*.60, height*.69), max_inches=4.0)
        return image, "The character and lettering sit below the camera area, with a coordinated pattern extending around the case."
    if "Full Zip" in name:
        for index, other in enumerate((source, art["mascot"])):
            place(image, other, (width*(.04+.5*index), height*.10, width*.42, height*.70), max_inches=4.0)
        return image, "Two separated illustrated placements keep the design clear of the center zipper."
    if wrap:
        if category == "Drinkware":
            place(image, source, (width*.29, height*.06, width*.42, height*.88), max_inches=4.5)
            for center in (.13, .87):
                place(image, art["mascot"], (width*(center-.07), height*.30, width*.14, height*.40), max_inches=1.5)
            return image, "The main illustration is centered on a coordinated wrap, with small mascot accents at the sides."
        for center in (.25, .75):
            place(image, source, (width*(center-.20), height*.06, width*.40, height*.88), max_inches=4.5)
        return image, "The illustration is repeated across the wrap so it can be seen from either side."
    if category == "Apparel":
        place(image, source, (width*.08, height*.045, width*.84, height*.88), max_inches=9.0)
        return image, "The illustrated graphic is printed on the front with a shaped perimeter, not a solid rectangular panel."
    place(image, source, (width*.08, height*.08, width*.84, height*.84), max_inches=8.0)
    return image, "A character illustration sits within a coordinated lightning-pattern composition."


manifest = []
for item in plan["products"]:
    record = receipts["products"][item["sku"]]
    product = products[record["id"]]
    number = int(item["sku"].split("-")[1])
    family = item["collection"] if item["collection"] != "Evergreen" else ("champion" if number % 2 else "breakout")
    if item["category"] == "Headwear":
        family = "mascot"
    family_title, intro = families[family]
    if item["collection"] == "Christmas" and item["category"] == "Headwear":
        family_title = "Sless Holiday Lightning Mascot"
    noun = item["catalogTitle"].replace("Unisex ", "").replace("™", "").replace("\\", "/")
    if item["sku"] == "SLESS-052":
        noun = "Matte Canvas, 12 × 20 in"
    title = f"{family_title} — {noun}"
    position_files = []
    explanation = ""
    seen = set()
    for area in product["print_areas"]:
        for placeholder in area["placeholders"]:
            if not placeholder["images"]:
                continue
            old = placeholder["images"][0]
            width, height = int(old["width"]), int(old["height"])
            key = (placeholder["position"], width, height)
            if key in seen:
                continue
            seen.add(key)
            rendered, explanation = layout(item, family, placeholder, width, height)
            target = OUT / f"{item['sku']}-{placeholder['position']}-{width}x{height}.png"
            rendered.save(target, compress_level=4, dpi=(300, 300))
            position_files.append({"position": key[0], "width": width, "height": height, "file": str(target.relative_to(ROOT))})
    category_copy = {
        "Apparel": "Choose from the garment colors and sizes currently offered in the selector. The garment model and fit remain the ones listed for this product.",
        "Headwear": "A small-format character badge brings Sless to the front of this cap or beanie. The selected product’s original decoration method is retained.",
        "Bags": "Take the Sless artwork beyond the shirt rack: a character-led bag for the everyday carry or your next event trip.",
        "Drinkware": "Bring some Sless personality to your next drink, with illustrated artwork instead of the old text-only treatment. Capacity and available options are shown in the selector.",
        "Desk and tech": "Put a little Sless energy into your everyday setup with a bold character-led design. Select the exact device, size or format offered for this item.",
        "Home": "Give your space a Sless accent with a character illustration and a coordinated palette. Check the offered dimensions before ordering.",
    }[item["category"]]
    description = "".join(f"<p>{escape(text)}</p>" for text in (
        intro, category_copy, explanation, f"Product: {noun}.",
        "Made to order. Shipping and applicable tax are calculated at checkout for supported destinations. Holiday arrival dates are not guaranteed."
    ))
    manifest.append({
        "sku": item["sku"], "id": product["id"], "externalId": product["external"]["id"],
        "title": title, "description": description, "family": family, "category": item["category"],
        "collection": item["collection"], "files": position_files,
        "originalVariantCount": len(product["variants"]),
        "pricesAndSkusPreserved": True,
    })
    print(item["sku"], family, len(position_files), flush=True)

# The Thanksgiving tee already exists in the assortment. Christmas needs its own
# tee; do not replace the existing Christmas crewneck with a different garment.
catalog = json.loads((OUT / "christmas-tee-catalog.json").read_text())
variants = [v for v in catalog["variants"] if v["options"].get("color") in
            ("Forest Green", "Red", "Black") and v["options"].get("size") in ("S", "M", "L", "XL", "2XL", "3XL")]
assert len(variants) == 18, "Expected three Christmas shirt colors and six sizes"
groups = {}
for variant in variants:
    front = next(p for p in variant["placeholders"] if p["position"] == "front")
    groups.setdefault((front["width"], front["height"]), {"placeholder": front, "ids": []})["ids"].append(variant["id"])
files = []
for (width, height), group in groups.items():
    image = Image.new("RGBA", (width, height))
    place(image, art["Christmas"], (width*.08, height*.045, width*.84, height*.88), max_inches=9.0)
    target = OUT / f"CHRISTMAS-TEE-front-{width}x{height}.png"
    image.save(target, compress_level=4, dpi=(300, 300))
    files.append({"position": "front", "width": width, "height": height,
                  "file": str(target.relative_to(ROOT)), "variantIds": group["ids"],
                  "method": group["placeholder"]["decoration_method"]})
manifest.append({
    "sku": "SLESS-CHRISTMAS-TEE", "new": True, "title": "Sless Is Cheer — Christmas Tee",
    "description": "<p>Sless Taylor brings the cheer: a Santa hat, gift-wrap breakout, candy-cane prop and purple-and-black wrestling gear with slim upper-arm bands.</p><p>The approved Sless Is Cheer illustration is printed on the front of a Gildan 5000 heavy cotton tee. Choose Forest Green, Red or Black in adult unisex sizes S–3XL.</p><p>Made to order. Shipping and applicable tax are calculated at checkout for supported destinations. Christmas arrival is not guaranteed.</p>",
    "family": "Christmas", "category": "Apparel", "collection": "Christmas",
    "blueprint": 6, "provider": 99, "files": files,
    "variants": [{"id": v["id"], "price": 3000 if v["options"]["size"] == "3XL" else 2800 if v["options"]["size"] == "2XL" else 2500,
                  "is_enabled": True, "is_default": v["options"] == {"color": "Forest Green", "size": "M"}} for v in variants],
})
(OUT / "rendered.json").write_text(json.dumps(manifest, indent=2))
print("Rendered", len(manifest), "products", flush=True)
