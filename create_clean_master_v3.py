from PIL import Image, ImageDraw
import os

src = '/Users/keshikachandru/.gemini/antigravity/brain/254cc657-e630-4763-8c64-d3d31df8151f/.user_uploaded/media_1785954946651.png'
dst = 'backend/app/assets/certificates/certificate_master.png'

img = Image.open(src).convert('RGBA')
draw = ImageDraw.Draw(img)

W, H = img.size
print(f'Original Template Size: {W}x{H}')

BLANK = (255, 255, 255, 255) # white

# Dynamic and text placeholder zones to wipe
text_zones = [
    # ── Certificate Title "CERTIFICATE" ──
    (240, 140, 784, 205),
    
    # ── Subtitle header "OF COMPLETION" (preserving brackets flanking it) ──
    (380, 205, 640, 225),
    
    # ── Certify Label "THIS IS TO CERTIFY THAT" ──
    (350, 255, 674, 278),
    
    # ── Recipient Name zone "UDHAYA K" ──
    (200, 280, 824, 345),
    
    # ── Subtitle action label "HAS SUCCESSFULLY COMPLETED THE LAB" ──
    (280, 355, 744, 380),
    
    # ── Target Name zone "OT RAILROAD SIGNALING..." ──
    (180, 385, 844, 450),
    
    # ── Completed On / Date zone (preserving calendar icon) ──
    (315, 460, 500, 520),
    
    # ── Certificate ID zone (preserving ID card icon) ──
    (595, 460, 800, 520)
]

for (x1, y1, x2, y2) in text_zones:
    draw.rectangle([x1, y1, x2, y2], fill=BLANK)

# Resize to standard 1400x990 canvas so rendering coordinates align perfectly
img_resized = img.resize((1400, 990), Image.Resampling.LANCZOS)
os.makedirs(os.path.dirname(dst), exist_ok=True)
img_resized.convert('RGB').save(dst)
print(f'Dynamic clean master saved successfully: {dst}')
