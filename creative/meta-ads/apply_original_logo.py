from pathlib import Path
from PIL import Image, ImageDraw

root = Path('creative/meta-ads')
horizontal_logo = Image.open(root / 'nia-official-horizontal-logo.png').convert('RGBA')
horizontal_logo = horizontal_logo.crop(horizontal_logo.getbbox())
compact_logo = Image.open(root / 'nia-official-mark.png').convert('RGBA')
compact_logo = compact_logo.crop(compact_logo.getbbox())

def apply_logo(source_name, output_name, logo, badge, logo_position, logo_width, badge_color):
    canvas = Image.open(root / source_name).convert('RGB').convert('RGBA')
    ratio = logo_width / logo.width
    mark = logo.resize((logo_width, round(logo.height * ratio)), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(badge, radius=10, fill=badge_color)
    canvas.alpha_composite(mark, logo_position)
    canvas.convert('RGB').save(root / output_name, quality=95, subsampling=0)

apply_logo(
    'nia-humanized-feed-source.png',
    'nia-hyderabad-meta-feed-ad-humanized.jpg',
    horizontal_logo,
    (44, 38, 466, 246),
    (66, 59),
    376,
    (4, 24, 55, 255),
)
apply_logo(
    'nia-hyderabad-reel-cover.png',
    'nia-hyderabad-reel-cover-humanized.jpg',
    compact_logo,
    (38, 32, 458, 276),
    (64, 71),
    338,
    (4, 24, 55, 255),
)
