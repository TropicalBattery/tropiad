from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"c:\Users\dwalters\Downloads\tropiAd")
PUBLIC = ROOT / "public"
APP = ROOT / "app"
PUBLIC.mkdir(exist_ok=True)

BRAND = (204, 43, 43, 255)  # #CC2B2B
WHITE = (255, 255, 255, 255)


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = max(1, size // 16)
    radius = max(2, size // 5)
    draw.rounded_rectangle(
        (pad, pad, size - pad - 1, size - pad - 1),
        radius=radius,
        fill=BRAND,
    )

    font = None
    for candidate in [
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]:
        try:
            font = ImageFont.truetype(candidate, int(size * 0.48))
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default()

    text = "TB"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1] - size * 0.03
    draw.text((x, y), text, font=font, fill=WHITE)
    return img


sizes = [16, 32, 48]
icons = [make_icon(s) for s in sizes]

for dest in [PUBLIC / "favicon.ico", APP / "favicon.ico"]:
    icons[0].save(
        dest,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=icons[1:],
    )

make_icon(32).save(PUBLIC / "favicon-32x32.png")
make_icon(16).save(PUBLIC / "favicon-16x16.png")
make_icon(180).save(PUBLIC / "apple-touch-icon.png")
make_icon(192).save(PUBLIC / "icon-192.png")
make_icon(512).save(PUBLIC / "icon-512.png")
make_icon(32).save(APP / "icon.png")
make_icon(180).save(APP / "apple-icon.png")

print("Wrote favicon assets")
for p in [
    PUBLIC / "favicon.ico",
    APP / "favicon.ico",
    PUBLIC / "favicon-32x32.png",
    PUBLIC / "apple-touch-icon.png",
    APP / "icon.png",
    APP / "apple-icon.png",
]:
    print(f"  {p.name}: {p.stat().st_size} bytes")
