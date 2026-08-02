"""
Create a clean certificate background by blanking ONLY the dynamic text fields.
All static text ('has successfully completed', 'and demonstrated...', icons, labels) remain intact.
Only user-specific dynamic values are blanked: recipient name, lab title, date value, duration value, score value, cert ID, QR.
"""
from PIL import Image, ImageDraw

src = 'C:/Users/Udhayakumar/.gemini/antigravity-ide/brain/e0ae55f2-3f63-4c96-aefc-0b0fd774f7bc/media__1785699163093.png'
dst = 'backend/app/assets/certificates/certificate_master.png'

img = Image.open(src).convert('RGBA')
draw = ImageDraw.Draw(img)

W, H = img.size
print(f'Canvas size: {W}x{H}')

BLANK = (255, 255, 255, 255)  # white

# Surgical blanking - ONLY wipe user-specific dynamic values, not static body text.
# All measurements for 1400x990 master reference image.
text_zones = [
    # ── Recipient Name (centered at y=455) ──
    (100, 420, 1300, 515),

    # ── Lab Title (centered at y=605) ──
    (100, 585, 1300, 690),

    # ── Completion Date Value (inside circle at y=765) ──
    (450, 745, 590, 785),

    # ── Certificate ID Value (inside circle at y=765) ──
    (830, 745, 985, 785),
]

w_scale = W / 1400.0
h_scale = H / 990.0

for (x1, y1, x2, y2) in text_zones:
    scaled_zone = [
        int(x1 * w_scale),
        int(y1 * h_scale),
        int(x2 * w_scale),
        int(y2 * h_scale)
    ]
    draw.rectangle(scaled_zone, fill=BLANK)

# Resize to standard 1400x990 canvas so coordinates in certificate_service align perfectly
img_resized = img.resize((1400, 990), Image.Resampling.LANCZOS)
img_resized.convert('RGB').save(dst)
print(f'Surgical clean master saved: {dst}')

check = Image.open(dst)
print(f'Verified size: {check.size}')
