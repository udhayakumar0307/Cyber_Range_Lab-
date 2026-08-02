"""
Create a clean certificate background by blanking ONLY the dynamic text fields.
All static text ('has successfully completed', 'and demonstrated...', icons, labels) remain intact.
Only user-specific dynamic values are blanked: recipient name, lab title, date value, duration value, score value, cert ID, QR.
"""
from PIL import Image, ImageDraw

src = 'backend/app/assets/certificates/certificate_master_original.png'
dst = 'backend/app/assets/certificates/certificate_master.png'

img = Image.open(src).convert('RGBA')
draw = ImageDraw.Draw(img)

W, H = img.size
print(f'Canvas size: {W}x{H}')

BLANK = (255, 255, 255, 255)  # white

# Surgical blanking - ONLY wipe user-specific dynamic values, not static body text.
# All measurements for 1400x990 master reference image.
text_zones = [
    # ── Certificate ID text (top right, right-aligned before ribbon) ──
    # The original has a cert ID here, wipe it; we'll redraw our cert ID
    (870, 28, 1285, 78),

    # ── Recipient Name (large script font - the biggest dynamic element) ──
    # "This is to certify that" stays (y~330-360), only wipe name area below it
    (100, 358, 1260, 502),

    # ── Lab Title (bold blue text - the lab name) ──
    # "has successfully completed the lab" stays above (~y=510-528)
    # "and demonstrated..." stays below (~y=595-625)
    # Only wipe the lab title value line
    (90, 530, 1310, 578),

    # ── Metrics Row: Wipe the entire icon+label+value zone ──
    # Baked-in: calendar icon, COMPLETED ON label, date value, dividers, clock icon, DURATION, duration value, trophy, SCORE, score value
    # Y range ~y=627 to y=702
    (130, 625, 1300, 708),

    # ── QR Code area (entire QR placeholder, preserving surrounding text) ──
    (1080, 730, 1260, 905),
]

for (x1, y1, x2, y2) in text_zones:
    draw.rectangle([x1, y1, x2, y2], fill=BLANK)

img.convert('RGB').save(dst)
print(f'Surgical clean master saved: {dst}')

check = Image.open(dst)
print(f'Verified size: {check.size}')
