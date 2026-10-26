"""Build review-only organic posts from verified live supplier mockups."""
import base64
import html
import io
import json
from pathlib import Path
import re
import textwrap
import urllib.parse
import urllib.request
import zipfile

from PIL import Image, ImageDraw, ImageFont, ImageOps

OUT = Path("generated-artifacts/live-shop-launch")
OUT.mkdir(parents=True, exist_ok=True)
FONTS = Path("generated-artifacts/holiday-marketing/fonts")
catalog = json.loads(Path("wordpress/sless-refresh/printify-popup-drafts.json").read_text())
audit = json.loads(Path("wordpress/sless-refresh/marketing-launch-audit.json").read_text())
verified_urls = {p["url"] for p in audit["liveProducts"] if p.get("status") == 200 and p.get("addToCartReference")}

posts = [
    {
        "id": "L01", "match": "Halloween Canvas", "headline": "SLESS AFTER DARK.",
        "subhead": "Halloween art. Full Sless attitude.",
        "copy": "Small canvas. Full Sless attitude.\n\nBring Sless After Dark to your space with the original Halloween scene on a 6 × 6 inch canvas.",
        "hashtags": "#SlessIsMore #SlessAfterDark #HalloweenDecor",
        "slot": "First post after approval",
        "alt": "Sless After Dark Halloween canvas featuring the original wrestler illustration, orange moon, pumpkins and purple haunted-house scene.",
    },
    {
        "id": "L02", "match": "Cork Back Coaster", "headline": "BE THANKFUL.",
        "subhead": "A little Sless for your table.",
        "copy": "Bring a little Sless to the table.\n\nThe Be Thankful for Sless! cork-back coaster adds a seasonal touch to your desk, coffee table or next gathering.",
        "hashtags": "#SlessIsMore #BeThankfulForSless #FallDecor",
        "slot": "At least 18 hours after L01",
        "alt": "The Be Thankful for Sless! cork-back coaster in its supplier product mockup.",
    },
    {
        "id": "L03", "match": "Spun Polyester Square Pillow", "headline": "SLESS IS CHEER.",
        "subhead": "Give your couch some holiday spirit.",
        "copy": "Your couch could use a little cheer.\n\nMeet the Sless Is Cheer square pillow. Bring the Sless holiday design into your space before the season gets busy.",
        "hashtags": "#SlessIsMore #SlessIsCheer #HolidayDecor",
        "slot": "At least 18 hours after L02",
        "alt": "Sless Is Cheer square pillow in its supplier product mockup.",
    },
]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "SlessLaunchReadiness/1.0"})
    with urllib.request.urlopen(req, timeout=45) as response:
        data = response.read(8_000_001)
    if len(data) > 8_000_000:
        raise ValueError("Asset exceeds download budget")
    return data


def font(size, display=False):
    return ImageFont.truetype(str(FONTS / ("Anton-Regular.ttf" if display else "Inter.ttf")), size)


def centered(draw, text, y, size, color, display=False):
    f = font(size, display)
    while draw.textbbox((0, 0), text, font=f)[2] > 964:
        size -= 1
        f = font(size, display)
    draw.text((540, y), text, anchor="mt", font=f, fill=color)


def render(post, source, story):
    height = 1920 if story else 1350
    image = Image.new("RGB", (1080, height), "#0d0d0d")
    draw = ImageDraw.Draw(image)
    top = 290 if story else 62
    centered(draw, "SLESS IS MORE", top, 30, "#e0b34c")
    centered(draw, post["headline"], top + 61, 84, "#fff8e7", True)
    centered(draw, post["subhead"], top + 166, 28, "#fff8e7")
    y = top + 236
    box = (936, 760 if story else 736)
    fitted = ImageOps.contain(source, box)
    image.paste(fitted, ((1080 - fitted.width) // 2, y + (box[1] - fitted.height) // 2))
    bottom = y + box[1] + 40
    centered(draw, "SHOP THIS DESIGN" if story else "EXPLORE THE LIVE COLLECTION", bottom, 38, "#e0b34c", True)
    if not story:
        centered(draw, "Made to order. Shipping and tax additional.", bottom + 65, 23, "#e7dfcf")
        centered(draw, "Holiday arrival is not guaranteed.", bottom + 98, 23, "#e7dfcf")
    name = f'{post["id"]}-{"story" if story else "feed"}.jpg'
    image.save(OUT / name, quality=93, optimize=True)
    return name


for post in posts:
    product = next(p for p in catalog["products"].values() if p.get("public") and post["match"] in p["title"])
    url = product["destinationUrl"]
    if url not in verified_urls:
        raise ValueError("Product did not pass the current live-page audit")
    markup = get(url).decode("utf-8")
    match = re.search(r'<meta[^>]*property="og:image"[^>]*content="([^"]+)"', markup)
    if not match:
        raise ValueError("Public product image is missing")
    image_url = html.unescape(match.group(1))
    if urllib.parse.urlsplit(image_url).hostname != "images-api.printify.com":
        raise ValueError("Unexpected product image host")
    source = Image.open(io.BytesIO(get(image_url))).convert("RGB")
    post["sourceImageDimensions"] = list(source.size)
    post["title"] = product["title"]
    post["productUrl"] = url
    post["sourceImageUrl"] = image_url
    post["feedFile"] = render(post, source, False)
    post["storyFile"] = render(post, source, True)
    post["facebookUrl"] = url + "?" + urllib.parse.urlencode({
        "utm_source": "facebook", "utm_medium": "organic_social",
        "utm_campaign": "live_shop_launch", "utm_content": post["id"].lower(),
    })
    post["storyLink"] = url + "?" + urllib.parse.urlencode({
        "utm_source": "instagram", "utm_medium": "organic_social",
        "utm_campaign": "live_shop_launch", "utm_content": post["id"].lower() + "_story",
    })
    disclaimer = "Made to order. Shipping and tax additional. Holiday arrival is not guaranteed."
    post["instagram"] = f'{post["copy"]}\n\nShop the live collection through the link in bio.\n\n{disclaimer}\n\n{post["hashtags"]}'
    post["facebook"] = f'{post["copy"]}\n\nShop this design: {post["facebookUrl"]}\n\n{disclaimer}\n\n{post["hashtags"]}'
    post["approvalStatus"] = "needs_owner_approval"
    post["published"] = False

manifest = {
    "status": "review_only", "automaticSchedulingActive": False, "paidSpendAuthorized": False,
    "trackingDeferredByOwner": True, "retargetingReady": False,
    "minimumHoursBetweenPosts": 18, "posts": posts,
}
(OUT / "launch-posts.json").write_text(json.dumps(manifest, indent=2))
notes = """LIVE SHOP LAUNCH — REVIEW ONLY

No posts have been published or scheduled from this pack. No paid spend.
Approve these new creatives and captions before posting; earlier sale approval
does not cover these changed products, images or captions.

1. Publish L01 first, then L02 and L03 at least 18 hours apart.
2. Use feed images at 1080 x 1350 and Story images at 1080 x 1920.
3. For Instagram, verify the bio link reaches the live shop.
4. Add the supplied URL as a REAL native Instagram Story link sticker.
   The image itself is not a clickable link. Place the sticker below the CTA,
   within the central safe area; do not claim it was added by an API.
5. Use the Facebook caption's direct product link unchanged.
6. Enter the supplied alt text where the platform supports it.
7. Do not reuse the older holiday-sale ads: their seven shirt destinations
   currently resolve to the general shop, not the advertised products.
8. Review existing Facebook schedules in Meta Business Suite before launch.
   The saved Facebook credential was rejected (HTTP 401 / code 190), so their
   current state is unverified and no schedule was changed.
9. Tracking remains as the owner left it. Page views were observed, but consent
   gating and ecommerce events are unresolved. Do not claim retargeting is ready.
10. No paid-order, shipping/tax, payout or purchase-event verification is claimed.
"""
(OUT / "posting-notes.txt").write_text(notes)
text = notes + "\n\n"
for post in posts:
    text += f'{post["id"]} — {post["title"]}\n\nFACEBOOK\n{post["facebook"]}\n\nINSTAGRAM\n{post["instagram"]}\n\nSTORY LINK\n{post["storyLink"]}\n\nALT TEXT\n{post["alt"]}\n\n{"-" * 60}\n\n'
(OUT / "captions-and-links.txt").write_text(text)
cards = []
for post in posts:
    def embedded(name):
        return "data:image/jpeg;base64," + base64.b64encode((OUT / name).read_bytes()).decode()
    cards.append(f"""<section><h2>{post['id']} — {html.escape(post['title'])}</h2>
    <p class="badge">Approval pending · {html.escape(post['slot'])}</p>
    <div class="visuals"><figure><img alt="{html.escape(post['alt'], quote=True)}" src="{embedded(post['feedFile'])}"><figcaption>Feed · 1080 × 1350</figcaption></figure>
    <figure><img alt="Story version" src="{embedded(post['storyFile'])}"><figcaption>Story · 1080 × 1920 · add native link sticker</figcaption></figure></div>
    <h3>Facebook caption</h3><pre>{html.escape(post['facebook'])}</pre>
    <h3>Instagram caption</h3><pre>{html.escape(post['instagram'])}</pre>
    <p><strong>Story link:</strong> <a href="{html.escape(post['storyLink'], quote=True)}">{html.escape(post['storyLink'])}</a></p></section>""")
page = """<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sless live-shop launch — review</title><style>
*{box-sizing:border-box}body{margin:0;background:#101010;color:#f4eedf;font:16px/1.6 system-ui,sans-serif}
main{max-width:1080px;margin:auto;padding:36px 24px}h1{font-size:clamp(32px,6vw,58px);line-height:1.1}
h1,h2,h3,a{color:#e0b34c}.notice,section{border:1px solid #444;padding:24px;margin:24px 0;border-radius:10px}
.badge{color:#e0b34c}.visuals{display:grid;grid-template-columns:1fr 1fr;gap:24px}figure{margin:0}
img{width:100%;height:auto;display:block}figcaption{color:#bbb;margin:8px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;background:#1e1e1e;padding:18px;border-radius:6px}
p{overflow-wrap:anywhere}@media(max-width:650px){.visuals{grid-template-columns:1fr}main{padding:20px 12px}section{padding:16px}}
</style><main><p>SLESS IS MORE · ORGANIC SOCIAL</p><h1>Live-shop launch pack</h1>
<div class="notice"><strong>Review only. Nothing published or scheduled.</strong>
<p>Three live products, direct links, no discount claims. Use these instead of the old sale campaign.</p>
<p>Tracking is deferred, not fixed. Facebook publishing access needs renewal. Review any existing native schedules before starting.</p>
<p>Stagger posts by at least 18 hours. Stories need a native clickable link sticker.</p></div>""" + "".join(cards) + "</main></html>"
(OUT / "review.html").write_text(page)
with zipfile.ZipFile(OUT / "sless-live-shop-launch.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for name in ["launch-posts.json", "captions-and-links.txt", "posting-notes.txt"] + [p[k] for p in posts for k in ["feedFile", "storyFile"]]:
        archive.write(OUT / name, name)
print(json.dumps({"posts": len(posts), "images": 6, "status": "review_only", "output": str(OUT)}))
