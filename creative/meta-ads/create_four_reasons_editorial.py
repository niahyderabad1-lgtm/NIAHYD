from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

root = Path('creative/meta-ads')
canvas = Image.new('RGBA', (1080, 1350), (250, 247, 238, 255))
draw = ImageDraw.Draw(canvas)
logo = Image.open(root / 'nia-official-mark.png').convert('RGBA')
logo = logo.crop(logo.getbbox())

navy = (5, 28, 64, 255); orange = (239, 118, 34, 255); ivory = (252, 248, 239, 244); white = (255, 255, 255, 255)
regular = str(root / 'fonts/Poppins-Regular.ttf')
bold = str(root / 'fonts/Poppins-Bold.ttf')
narrow = str(root / 'fonts/Poppins-SemiBold.ttf')
def f(path, size): return ImageFont.truetype(path, size)
def wrapped(text, style, width):
    result=[]
    for paragraph in text.split('\n'):
        line=''
        for word in paragraph.split():
            candidate=(line+' '+word).strip()
            if draw.textbbox((0,0),candidate,font=style)[2] <= width: line=candidate
            else: result.append(line); line=word
        if line: result.append(line)
    return result
def draw_lines(x, y, text, style, colour, width, step):
    for index, line in enumerate(wrapped(text, style, width)):
        draw.text((x, y + index * step), line, font=style, fill=colour)

# A calm, single-colour header protects the NIA logo and keeps the card premium.
draw.rectangle((0, 0, 1080, 300), fill=navy)
draw.rectangle((0, 296, 1080, 300), fill=orange)

# The official NIA mark is now a clean, right-aligned lockup on solid navy.
logo_width=236; logo_height=round(logo.height*logo_width/logo.width)
canvas.alpha_composite(logo.resize((logo_width,logo_height),Image.Resampling.LANCZOS),(774,52))

# A small candid moment keeps this information card connected to real people.
people = Image.open('/Users/kumar/.codex/generated_images/01a18e26-817e-7cf2-8a72-bedee45fc36b/exec-64a2f773-b89f-4c58-b1d9-a570abb5173d.png').convert('RGB')
portrait = ImageOps.fit(people, (122, 122), method=Image.Resampling.LANCZOS, centering=(0.68, 0.42)).convert('RGBA')
mask = Image.new('L', (122, 122), 0)
ImageDraw.Draw(mask).ellipse((4, 4, 118, 118), fill=255)
portrait.putalpha(mask)
# Keep the guest invitation as a single, compact block directly under the logo.
canvas.alpha_composite(portrait, (72, 168))
draw.ellipse((72, 168, 194, 290), outline=orange, width=3)
draw.text((220, 184), 'BE OUR GUEST AT NIA', font=f(narrow,28), fill=white)
draw.text((220, 220), 'NETWORK IN ACTION', font=f(narrow,20), fill=orange)
draw.text((220, 249), 'MONTHLY MEET', font=f(narrow,20), fill=ivory)

draw.text((70, 326), 'WHAT PEOPLE VALUE AT NIA', font=f(narrow,43), fill=navy)
draw.text((72, 376), 'Real relationships, practical support and a stronger circle.', font=f(regular,18), fill=navy)

rows=[
('01', 'REFERRALS', '• High-confidence introductions\n• Relationships first; referrals follow naturally\n• Growth built on trust, value and real results'),
('02', 'RESOURCES', '• NIA App and University\n• Monthly meetings and wider networking opportunities\n• Virtual intercity and interstate meetings'),
('03', 'COMMUNITY', '• Credible business owners who show up for one another\n• Professionally led, thoughtfully selected groups\n• A stronger circle for you and your customers'),
('04', 'COACHING', '• Monthly sales mastery sessions with expert business coaches\n• Best-practice sharing among members\n• Learning you can put to work'),
]
for index,(number,title,body) in enumerate(rows):
    y=414+index*125
    draw.rounded_rectangle((58,y,1022,y+110),radius=18,fill=white,outline=orange,width=3)
    draw.text((85,y+26),number,font=f(narrow,31),fill=orange)
    draw.text((160,y+25),title,font=f(narrow,31),fill=navy)
    draw_lines(410,y+22,body,f(regular,14),navy,565,19)

draw.rounded_rectangle((42, 934, 1038, 1318), radius=18, fill=navy)
draw.text((72, 976), 'COME FOR THE CONVERSATION.', font=f(narrow,31), fill=white)
draw.text((72, 1012), 'STAY FOR THE COMMUNITY.', font=f(narrow,28), fill=orange)
draw.text((72, 1050), 'Join us as a guest at one of our monthly meetings and experience NIA firsthand.', font=f(regular,17), fill=(250,247,238,255))
draw.text((72, 1082), '11 November 2026 · 6:00–9:00 PM · Novotel HICC Hyderabad', font=f(regular,17), fill=(250,247,238,255))
draw.text((72, 1112), 'Rs 2,600 · taxes & dinner included', font=f(regular,17), fill=(250,247,238,255))
draw.rounded_rectangle((72,1150,860,1226),radius=9,fill=orange)
draw.text((105,1173),'EXPLORE NIA – NETWORK IN ACTION AS A GUEST  >',font=f(bold,18),fill=navy)
draw.text((72,1268),'hyderabad.networkinaction.info',font=f(regular,22),fill=(250,247,238,255))
canvas.convert('RGB').save(root / 'nia-carousel-slide-2-humanized-v5-clean.jpg', quality=95, subsampling=0)
