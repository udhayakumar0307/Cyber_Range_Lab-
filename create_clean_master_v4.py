from PIL import Image, ImageDraw
import os

src = '/Users/keshikachandru/.gemini/antigravity/brain/254cc657-e630-4763-8c64-d3d31df8151f/.user_uploaded/media_1785954946651.png'
dst = 'backend/app/assets/certificates/certificate_master.png'

img = Image.open(src).convert('RGBA')
draw = ImageDraw.Draw(img)

# Dynamic and text placeholder zones to wipe, paired with local background color sample pixels
text_zones = [
    # (x1, y1, x2, y2, sample_x, sample_y)
    # ── Title "CERTIFICATE" ──
    (235, 140, 788, 204, 200, 172),
    
    # ── Subtitle header "OF COMPLETION" ──
    (380, 205, 640, 226, 200, 215),
    
    # ── Certify Label "THIS IS TO CERTIFY THAT" ──
    (350, 255, 674, 278, 200, 266),
    
    # ── Recipient Name zone "UDHAYA K" ──
    (200, 280, 824, 345, 150, 312),
    
    # ── Subtitle action label "HAS SUCCESSFULLY COMPLETED THE LAB" ──
    (280, 355, 744, 380, 200, 368),
    
    # ── Target Name zone "OT RAILROAD SIGNALING..." ──
    (180, 385, 844, 450, 150, 418),
    
    # ── Completed On Label "COMPLETED ON" ──
    (320, 470, 490, 492, 310, 480),
    
    # ── Completed On Value "31 JULY 2026" ──
    (320, 492, 490, 520, 310, 506),
    
    # ── Certificate ID Label "CERTIFICATE ID" ──
    (595, 470, 780, 492, 585, 480),
    
    # ── Certificate ID Value "CYR-2026-000001" ──
    (595, 492, 780, 520, 585, 506)
]

for (x1, y1, x2, y2, sx, sy) in text_zones:
    local_color = img.getpixel((sx, sy))
    draw.rectangle([x1, y1, x2, y2], fill=local_color)

# Resize to standard 1400x990 canvas so rendering coordinates align perfectly
img_resized = img.resize((1400, 990), Image.Resampling.LANCZOS)
os.makedirs(os.path.dirname(dst), exist_ok=True)
img_resized.convert('RGB').save(dst)
print(f'Gradient-matched clean master saved successfully: {dst}')
