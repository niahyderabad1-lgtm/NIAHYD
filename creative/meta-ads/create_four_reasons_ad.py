from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path('creative/meta-ads')
source = Image.open('/Users/kumar/.codex/generated_images/01a18e26-817e-7cf2-8a72-bedee45fc36b/exec-558c6440-05f1-4a1d-b826-7097d6d6ca7d.png').convert('RGB')
source = source.resize((1080, 1350), Image.Resampling.LANCZOS).convert('RGBA')
logo = Image.open(root / 'nia-official-horizontal-logo.png').convert('RGBA')
logo = logo.crop(logo.getbbox())

navy = (5, 28, 64, 255)
orange = (239, 118, 34, 255)
ivory = (250, 247, 238, 245)
dark = (8, 36, 75, 255)

regular = '/System/Library/Fonts/Supplemental/Arial.ttf'
bold = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
narrow = '/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf'
def font(path, size): return ImageFont.truetype(path, size)
def center(draw, text, y, style, colour):
    box = draw.textbbox((0, 0), text, font=style)
    draw.text(((1080 - (box[2] - box[0])) / 2, y), text, font=style, fill=colour)
def fit(draw, text, box, style, colour, spacing=6):
    x, y, w, h = box
    lines=[]
    for paragraph in text.split('\n'):
        words = paragraph.split(); line=''
        for word in words:
            trial = (line + ' ' + word).strip()
            if draw.textbbox((0, 0), trial, font=style)[2] <= w:
                line = trial
            else:
                lines.append(line); line = word
        if line: lines.append(line)
    for index, line in enumerate(lines):
        draw.text((x, y + index * (style.size + spacing)), line, font=style, fill=colour)

canvas = source.copy(); draw = ImageDraw.Draw(canvas)
draw.rounded_rectangle((38, 30, 1042, 228), radius=20, fill=navy)
logo_width = 320; logo_height = round(logo.height * logo_width / logo.width)
canvas.alpha_composite(logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS), (72, 70))
draw.text((72, 178), 'HYDERABAD', font=font(bold, 23), fill=orange, spacing=2)
draw.text((610, 76), 'BE OUR GUEST AT NIA', font=font(narrow, 26), fill=(255, 255, 255, 255))
draw.text((610, 112), 'NETWORK IN ACTION', font=font(narrow, 21), fill=orange)
draw.text((610, 140), 'MONTHLY MEET', font=font(narrow, 21), fill=(255, 255, 255, 255))
center(draw, '4 REASONS WHY PEOPLE JOIN NIA', 260, font(narrow, 44), dark)
center(draw, 'Grow your business with Network In Action.', 316, font(regular, 21), dark)

cards = [
    ('01  REFERRALS', '• High-confidence, high-quality referrals\n• Relationships first; referrals follow naturally\n• Growth driven by trust, value and real results\n• Focus on referrals for strategic growth'),
    ('02  RESOURCES', '• NIA App and University\n• Monthly meetings with optional networking opportunities\n• Monthly virtual Intercity and Interstate meets'),
    ('03  COMMUNITY', '• Thoughtfully selected, credible members only\n• Professional networkers leading every group\n• A trusted network of business owners ready to support you and your customers'),
    ('04  COACHING', '• Expert business coaches providing monthly Sales Mastery training\n• Best practice and knowledge sharing among members\n• Continuous learning as a core part of the experience'),
]
positions = [(58, 385), (552, 385), (58, 660), (552, 660)]
for (title, body), (x, y) in zip(cards, positions):
    draw.rounded_rectangle((x, y, x + 470, y + 224), radius=22, fill=ivory, outline=orange, width=3)
    draw.rectangle((x + 28, y + 31, x + 35, y + 90), fill=orange)
    draw.text((x + 55, y + 30), title, font=font(narrow, 30), fill=dark)
    fit(draw, body, (x + 30, y + 100, 407, 108), font(regular, 16), dark, spacing=5)

draw.rounded_rectangle((0, 965, 1080, 1350), radius=0, fill=navy)
draw.text((72, 1008), 'EXPERIENCE NIA FIRSTHAND', font=font(narrow, 32), fill=(255, 255, 255, 255))
draw.text((72, 1050), 'Join one of our mandatory monthly meetings as a guest', font=font(regular, 19), fill=(250, 247, 238, 255))
draw.text((72, 1080), 'and see how the NIA community works.', font=font(regular, 19), fill=(250, 247, 238, 255))
draw.text((72, 1115), '11 November 2026 · 6:00–9:00 PM · Novotel HICC Hyderabad', font=font(regular, 18), fill=(250, 247, 238, 255))
draw.text((72, 1144), 'Rs 2,600 · taxes & dinner included', font=font(regular, 18), fill=(250, 247, 238, 255))
draw.rounded_rectangle((72, 1182, 680, 1258), radius=10, fill=orange)
draw.text((105, 1203), 'EXPLORE A GUEST VISIT  →', font=font(bold, 26), fill=navy)
draw.text((72, 1290), 'hyderabad.networkinaction.info', font=font(regular, 23), fill=(250, 247, 238, 255))
canvas.convert('RGB').save(root / 'nia-hyderabad-four-reasons-ad.jpg', quality=95, subsampling=0)
