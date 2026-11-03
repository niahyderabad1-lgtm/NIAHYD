from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path('creative/meta-ads')
source = Image.open('/Users/kumar/.codex/generated_images/01a18e26-817e-7cf2-8a72-bedee45fc36b/exec-197c820a-f758-47bc-9f9a-d16a10aeeca0.png').convert('RGBA')
canvas = source.resize((1080, 1350), Image.Resampling.LANCZOS)
draw = ImageDraw.Draw(canvas)

navy = (5, 28, 64, 255)
orange = (239, 118, 34, 255)
white = (255, 255, 255, 255)
ivory = (250, 247, 238, 255)
regular = str(root / 'fonts/Poppins-Regular.ttf')
semi = str(root / 'fonts/Poppins-SemiBold.ttf')
bold = str(root / 'fonts/Poppins-Bold.ttf')

def font(path, size):
    return ImageFont.truetype(path, size)

def centered(lines, cx, cy, title_size=25, body_size=16):
    """Render a short benefit card in the generous centre of a hexagon."""
    title, *body = lines
    y = cy - 46
    draw.text((cx, y), title, font=font(bold, title_size), fill=navy, anchor='ma')
    for line in body:
        y += 30
        draw.text((cx, y), line, font=font(regular, body_size), fill=navy, anchor='ma')

# Solid-header logo lockup: no portrait and no visual noise beneath the official logo.
logo = Image.open(root / 'nia-official-mark.png').convert('RGBA')
logo = logo.crop(logo.getbbox())
logo_width = 250
logo_height = round(logo.height * logo_width / logo.width)
canvas.alpha_composite(logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS), (760, 42))

# Three-line guest invitation, cleanly arranged in the free space opposite the logo.
draw.text((70, 73), 'BE OUR GUEST AT NIA', font=font(bold, 28), fill=white)
draw.text((70, 113), 'NETWORK IN ACTION', font=font(semi, 20), fill=orange)
draw.text((70, 144), 'MONTHLY MEET', font=font(semi, 20), fill=ivory)
draw.line((70, 181, 360, 181), fill=orange, width=3)

# Four short, visual benefits—purposefully concise so the honeycomb breathes.
centered(['REFERRALS', 'Trusted introductions', 'that create growth.'], 300, 486)
centered(['RESOURCES', 'Tools, learning', '& wider connections.'], 780, 486)
centered(['COMMUNITY', 'A trusted circle', 'that shows up.'], 300, 935)
centered(['COACHING', 'Sales mastery', '& shared know-how.'], 780, 935)

# Compact event footer.
draw.text((540, 1214), '11 NOVEMBER 2026  •  6:00–9:00 PM', font=font(semi, 17), fill=white, anchor='ma')
draw.text((540, 1241), 'NOVOTEL HICC HYDERABAD  •  Rs 2,600 incl. taxes & dinner', font=font(regular, 15), fill=ivory, anchor='ma')
draw.rounded_rectangle((205, 1270, 875, 1326), radius=18, fill=orange)
draw.text((540, 1288), 'EXPLORE NIA – NETWORK IN ACTION AS A GUEST  >', font=font(semi, 16), fill=navy, anchor='ma')

canvas.convert('RGB').save(root / 'nia-carousel-slide-2-honeycomb.jpg', quality=95, subsampling=0)
