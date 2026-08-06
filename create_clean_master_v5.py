from PIL import Image, ImageDraw
import os

src = 'backend/app/assets/certificates/certificate_master_cropped.png'
dst = 'backend/app/assets/certificates/certificate_master.png'

img = Image.open(src).convert('RGBA')
draw = ImageDraw.Draw(img)

# Dynamic and text placeholder zones to wipe on the cropped 1024x723 certificate template
# Exact canvas background color is RGB(250, 250, 251)
bg_color = (250, 250, 251, 255)

text_zones = [
    # ── Title "CERTIFICATE" ──
    (200, 160, 824, 206),
    
    # ── Subtitle header "OF COMPLETION" — widened to cover ghost N at right edge ──
    (340, 228, 810, 252),
    
    # ── Certify Label "THIS IS TO CERTIFY THAT" ──
    (350, 285, 674, 305),
    
    # ── Recipient Name zone "UDHAYA K" ──
    (180, 320, 844, 370),
    
    # ── Subtitle action label "HAS SUCCESSFULLY COMPLETED THE LAB" ──
    (260, 400, 764, 418),
    
    # ── Target Name zone "OT RAILROAD SIGNALING..." ──
    (160, 430, 864, 482),
    
    # ── Completed On Label + Value ──
    (320, 525, 490, 568),
    
    # ── Certificate ID Label + Value ──
    (595, 525, 800, 568)
]

for (x1, y1, x2, y2) in text_zones:
    draw.rectangle([x1, y1, x2, y2], fill=bg_color)

# Resize to standard 1400x990 canvas so rendering coordinates align perfectly
img_resized = img.resize((1400, 990), Image.Resampling.LANCZOS)
os.makedirs(os.path.dirname(dst), exist_ok=True)
img_resized.convert('RGB').save(dst)
print(f'Cropped dynamic clean master saved successfully: {dst}')
