"""Illustrative shirt-color proofs; not supplier mockups or print-quality tests."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / "attached_assets/generated_images"
OUTPUT = ROOT / "generated-artifacts/holiday-shirts"
OUTPUT.mkdir(parents=True, exist_ok=True)

def transparent_white(source_name, output_name):
    # These flat references have an intentionally pure-white background. A
    # semantic subject mask incorrectly removed the pale SLESS lettering.
    image = Image.open(ASSETS / source_name).convert("RGBA")
    pixels = np.array(image)
    distance = (255 - pixels[:, :, :3].astype("float32")).max(axis=2)
    pixels[:, :, 3] = np.clip((distance - 4) * 255 / 16, 0, 255).astype("uint8")
    Image.fromarray(pixels).save(ASSETS / output_name)


transparent_white(
    "thanksgiving-be-thankful-for-sless-art.png",
    "thanksgiving-be-thankful-for-sless-transparent.png",
)
transparent_white(
    "christmas-sless-is-cheer-thin-armbands-art.png",
    "christmas-sless-is-cheer-thin-armbands-transparent.png",
)


def font(size):
    return ImageFont.truetype(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size
    )


def proof(art_name, color, title, subtitle, destination):
    canvas = Image.new("RGB", (1100, 1300), "#eeeae4")
    draw = ImageDraw.Draw(canvas)
    draw.text((550, 48), title, font=font(32), fill="#24201f", anchor="mt")
    draw.text((550, 98), subtitle, font=font(19), fill="#655d57", anchor="mt")
    outline = [
        (355, 195), (449, 170), (651, 170), (745, 195),
        (958, 380), (831, 540), (801, 481), (816, 1100),
        (284, 1100), (299, 481), (269, 540), (142, 380),
    ]
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).polygon(outline, fill=255)
    shadow = Image.new("RGBA", canvas.size)
    shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(14)).point(lambda a: a // 5))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow)
    garment = Image.new("RGBA", canvas.size, color)
    garment.putalpha(mask)
    canvas = Image.alpha_composite(canvas, garment)
    draw = ImageDraw.Draw(canvas)
    # A simple neckline and seams make the placement readable without implying
    # these are actual Printify garment photographs.
    draw.ellipse((443, 145, 657, 267), fill="#eeeae4")
    draw.arc((437, 148, 663, 281), 0, 180, fill="#77736c", width=3)
    draw.line([(295, 1076), (805, 1076)], fill="#77736c", width=2)
    draw.line([(163, 379), (275, 518)], fill="#77736c", width=2)
    draw.line([(937, 379), (825, 518)], fill="#77736c", width=2)
    art = Image.open(ASSETS / art_name).convert("RGBA")
    art_preview = Image.new("RGBA", art.size, color)
    art_preview.alpha_composite(art)
    art_preview.convert("RGB").save(
        OUTPUT / destination.replace("shirt-proof", "art-preview")
    )
    art = art.crop(art.getchannel("A").getbbox())
    art.thumbnail((450, 654), Image.Resampling.LANCZOS)
    canvas.alpha_composite(art, (550 - art.width // 2, 335))
    draw = ImageDraw.Draw(canvas)
    draw.text(
        (550, 1232), "DESIGN PROOF • Illustrative placement, not a supplier mockup",
        font=font(17), fill="#655d57", anchor="mt",
    )
    canvas.convert("RGB").save(OUTPUT / destination)


proof(
    "thanksgiving-be-thankful-for-sless-transparent.png", "#f4ead4",
    "THANKSGIVING · BE THANKFUL FOR SLESS!", "Warm ivory shirt concept",
    "thanksgiving-be-thankful-shirt-proof.png",
)
proof(
    "christmas-sless-is-cheer-thin-armbands-transparent.png", "#153c2b",
    "CHRISTMAS · SLESS IS CHEER", "Forest green shirt concept",
    "christmas-sless-is-cheer-thin-armbands-shirt-proof.png",
)
for name in ("thanksgiving", "christmas"):
    image = Image.open(ASSETS / (
        "thanksgiving-be-thankful-for-sless-transparent.png" if name == "thanksgiving"
        else "christmas-sless-is-cheer-thin-armbands-transparent.png"
    ))
    print(name, "source size:", image.size, "alpha:", image.getchannel("A").getextrema())
