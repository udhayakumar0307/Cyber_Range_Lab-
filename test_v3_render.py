"""
V3 Test Renderer — reads layout from certificate_layout.json and overlays all dynamic fields.
Run: python test_v3_render.py  -> test_v3_output.png
"""
import os, json
from PIL import Image, ImageDraw, ImageFont
import qrcode

ASSETS = 'backend/app/assets/certificates'
FONTS  = os.path.join(ASSETS, 'fonts')
MASTER = os.path.join(ASSETS, 'certificate_master.png')
LAYOUT = os.path.join(ASSETS, 'certificate_layout.json')

with open(LAYOUT) as f:
    layout = json.load(f)

fields = layout['fields']

def get_font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)

def draw_field(draw, key, val, fill_override=None):
    if key not in fields:
        print(f'  [skip] {key} not in layout')
        return
    f = fields[key]
    font = get_font(f['font'], f['size'])
    fill = fill_override or f['color']
    bb = font.getbbox(str(val))
    tw = bb[2] - bb[0]
    x = f['x']
    if f['align'] == 'center':
        x = f['x'] - tw // 2
    elif f['align'] == 'right':
        x = f['x'] - tw
    draw.text((x, f['y']), str(val), fill=fill, font=font)
    print(f'  {key}: "{val}" at ({x},{f["y"]}) size={f["size"]}')

# ── Load master ──────────────────────────────────────────────────────────────
img  = Image.open(MASTER).convert('RGBA')
draw = ImageDraw.Draw(img)
print(f'Master loaded: {img.size}')

# ── Sample data ───────────────────────────────────────────────────────────────
data = {
    'recipient_name':  'Udhaya K',
    'lab_title':       'OT Railroad Signaling & Control Security Lab',
    'completion_date': '29 May 2026',
    'duration':        '1.5 Hours',
    'score':           '125 / 125',
    'accuracy':        '100%',
    'certificate_id':  'CYR-2026-000001',
}
VERIFY = 'https://cyberrange.io/certificate/verify/CYR-2026-000001'

# ── QR Code ───────────────────────────────────────────────────────────────────
qr_cfg = fields['qr_code']
qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=14, border=4)
qr.add_data(VERIFY)
qr.make(fit=True)
qr_img = qr.make_image(fill_color='#0F172A', back_color='white').convert('RGBA')
qr_img = qr_img.resize((qr_cfg['width'], qr_cfg['height']), Image.Resampling.LANCZOS)
img.paste(qr_img, (qr_cfg['x'], qr_cfg['y']), mask=qr_img)
print(f'  qr_code: pasted at ({qr_cfg["x"]},{qr_cfg["y"]}) size=({qr_cfg["width"]}x{qr_cfg["height"]})')

# ── Dynamic text fields ───────────────────────────────────────────────────────
for key, val in data.items():
    draw_field(draw, key, val)

# ── Save ──────────────────────────────────────────────────────────────────────
out = 'test_v3_output.png'
img.convert('RGB').save(out)
print(f'\nSaved: {out}')
