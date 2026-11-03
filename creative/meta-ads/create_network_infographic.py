from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path('creative/meta-ads')
canvas = Image.new('RGBA', (1080, 1350), (12, 43, 84, 255))
draw = ImageDraw.Draw(canvas)

navy = (5, 28, 64, 255)
orange = (239, 118, 34, 255)
white = (255, 255, 255, 255)
ivory = (250, 247, 238, 255)
light_orange = (255, 239, 225, 255)
muted = (74, 89, 112, 255)
line_blue = (116, 164, 214, 120)
regular = str(root / 'fonts/Poppins-Regular.ttf')
semi = str(root / 'fonts/Poppins-SemiBold.ttf')
bold = str(root / 'fonts/Poppins-Bold.ttf')

def font(path, size): return ImageFont.truetype(path, size)

def card(x, y, number, title, line1, line2):
    draw.rounded_rectangle((x, y, x + 286, y + 164), radius=24, fill=white, outline=orange, width=3)
    draw.ellipse((x + 20, y + 22, x + 67, y + 69), fill=orange)
    draw.text((x + 43, y + 45), number, font=font(semi, 17), fill=navy, anchor='mm')
    draw.text((x + 86, y + 25), title, font=font(bold, 23), fill=navy)
    draw.text((x + 86, y + 65), line1, font=font(regular, 15), fill=muted)
    draw.text((x + 86, y + 91), line2, font=font(regular, 15), fill=muted)

def curve(p0, p1, p2, colour, width=3):
    """A simple quadratic curve for meaningful, flowing card-to-hub connections."""
    points=[]
    for step in range(25):
        t=step/24
        x=(1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t**2*p2[0]
        y=(1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t**2*p2[1]
        points.append((round(x),round(y)))
    draw.line(points, fill=colour, width=width)

# Clear, single-colour header behind the official brand mark.
draw.rectangle((0, 0, 1080, 275), fill=navy)
draw.rectangle((0, 271, 1080, 275), fill=orange)
logo = Image.open(root / 'nia-official-mark.png').convert('RGBA')
logo = logo.crop(logo.getbbox())
logo_width = 250
logo_height = round(logo.height * logo_width / logo.width)
canvas.alpha_composite(logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS), (760, 42))
draw.text((70, 77), 'BE OUR GUEST AT NIA', font=font(bold, 28), fill=white)
draw.text((70, 117), 'NETWORK IN ACTION', font=font(semi, 20), fill=orange)
draw.text((70, 148), 'MONTHLY MEET', font=font(semi, 20), fill=ivory)
draw.line((70, 184, 350, 184), fill=orange, width=3)

# Headline and a central “network” hub.
draw.text((540, 326), 'A NETWORK BUILT FOR BUSINESS GROWTH', font=font(bold, 27), fill=white, anchor='ma')
draw.text((540, 364), 'Four ways NIA helps good business relationships go further.', font=font(regular, 16), fill=(211, 226, 242, 255), anchor='ma')

# Four intentional connections into the NIA hub (rather than decorative lines).
connections = [
    ((356, 562), (382, 575), (407, 615)),
    ((724, 562), (698, 575), (673, 615)),
    ((356, 824), (382, 812), (407, 767)),
    ((724, 824), (698, 812), (673, 767)),
]
for p0, p1, p2 in connections:
    curve(p0, p1, p2, orange, 4)
    draw.ellipse((p2[0]-5, p2[1]-5, p2[0]+5, p2[1]+5), fill=orange)

# Four benefits as connected, deliberately short cards.
card(70, 480, '01', 'REFERRALS', 'Trusted introductions.', 'Growth through trust.')
card(724, 480, '02', 'RESOURCES', 'Tools, learning', '& wider connections.')
card(70, 742, '03', 'COMMUNITY', 'A credible circle', 'that shows up.')
card(724, 742, '04', 'COACHING', 'Sales mastery', '& shared know-how.')

# Central brand hub, using the supplied official NIA mark—not recreated text.
draw.ellipse((397, 548, 683, 834), fill=navy, outline=orange, width=8)
draw.ellipse((421, 572, 659, 810), outline=(255, 255, 255, 70), width=2)
hub_logo_width = 154
hub_logo_height = round(logo.height * hub_logo_width / logo.width)
canvas.alpha_composite(logo.resize((hub_logo_width, hub_logo_height), Image.Resampling.LANCZOS), (round(540 - hub_logo_width / 2), round(691 - hub_logo_height / 2)))

# Footer is direct and uncluttered.
draw.rounded_rectangle((42, 1005, 1038, 1318), radius=28, fill=navy)
draw.text((540, 1059), 'COME FOR THE CONVERSATION. STAY FOR THE COMMUNITY.', font=font(bold, 23), fill=white, anchor='ma')
draw.text((540, 1100), 'Join us as a guest at one of our monthly meetings and experience NIA firsthand.', font=font(regular, 16), fill=ivory, anchor='ma')
draw.text((540, 1145), '11 NOVEMBER 2026  •  6:00–9:00 PM  •  NOVOTEL HICC HYDERABAD', font=font(semi, 15), fill=white, anchor='ma')
draw.text((540, 1177), 'Rs 2,600 · taxes & dinner included', font=font(regular, 16), fill=ivory, anchor='ma')
draw.rounded_rectangle((172, 1220, 908, 1285), radius=18, fill=orange)
draw.text((540, 1242), 'EXPLORE NIA – NETWORK IN ACTION AS A GUEST  >', font=font(semi, 17), fill=navy, anchor='ma')

canvas.convert('RGB').save(root / 'nia-carousel-slide-2-network-infographic-v3.jpg', quality=95, subsampling=0)
