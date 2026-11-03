from pathlib import Path
from shutil import copyfile
from PIL import Image, ImageDraw, ImageFont

root = Path('creative/meta-ads')
source = Image.open('/Users/kumar/.codex/generated_images/01a18e26-817e-7cf2-8a72-bedee45fc36b/exec-64a2f773-b89f-4c58-b1d9-a570abb5173d.png').convert('RGB')
canvas = source.resize((1080, 1350), Image.Resampling.LANCZOS).convert('RGBA')
draw = ImageDraw.Draw(canvas)
logo = Image.open(root / 'nia-official-horizontal-logo.png').convert('RGBA')
logo = logo.crop(logo.getbbox())

navy = (5, 28, 64, 255); orange = (239, 118, 34, 255); ivory = (250, 247, 238, 255); white = (255,255,255,255)
regular = '/System/Library/Fonts/Supplemental/Arial.ttf'; bold = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'; narrow = '/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf'
def f(path, size): return ImageFont.truetype(path, size)

# Add a transparent navy reading field, allowing the human event photo to remain visible at right.
overlay = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
overlay_draw = ImageDraw.Draw(overlay)
overlay_draw.polygon([(0,0),(570,0),(745,1350),(0,1350)], fill=(3,20,47,220))
canvas = Image.alpha_composite(canvas, overlay); draw = ImageDraw.Draw(canvas)
logo_width=330; logo_height=round(logo.height*logo_width/logo.width)
canvas.alpha_composite(logo.resize((logo_width,logo_height),Image.Resampling.LANCZOS),(64,58))
draw.rectangle((64,210,156,216),fill=orange)
draw.text((64,277),'BE OUR GUEST AT NIA',font=f(narrow,24),fill=orange)
draw.text((64,345),'Your next',font=f(bold,50),fill=white)
draw.text((64,409),'good conversation',font=f(bold,43),fill=orange)
draw.text((64,465),'starts here.',font=f(bold,50),fill=white)
draw.rectangle((64,577,495,581),fill=orange)
draw.text((64,616),'Meet fellow business owners. Share what you do.',font=f(regular,20),fill=ivory)
draw.text((64,646),'See whether the NIA community feels right for you.',font=f(regular,20),fill=ivory)
draw.text((64,702),'NETWORK IN ACTION MONTHLY MEET',font=f(narrow,22),fill=white)
draw.text((64,744),'11 NOVEMBER 2026 · 6:00–9:00 PM',font=f(narrow,24),fill=white)
draw.text((64,781),'NOVOTEL HICC HYDERABAD',font=f(narrow,22),fill=white)
draw.text((64,819),'Rs 2,600 · taxes & dinner included',font=f(regular,18),fill=ivory)
draw.rounded_rectangle((64,885,526,982),radius=13,fill=orange)
draw.text((94,906),'EXPLORE NIA – NETWORK IN ACTION',font=f(bold,17),fill=navy)
draw.text((94,937),'AS A GUEST  →',font=f(bold,21),fill=navy)
draw.text((64,1294),'hyderabad.networkinaction.info',font=f(regular,21),fill=ivory)
canvas.convert('RGB').save(root / 'nia-carousel-slide-1-humanized.jpg',quality=95,subsampling=0)
