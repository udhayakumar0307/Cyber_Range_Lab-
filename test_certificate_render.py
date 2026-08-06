"""
Certificate Rendering Test - Generates a test certificate with sample data
and saves it to test_output.png for visual inspection.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from PIL import Image, ImageDraw, ImageFont
import qrcode, json, io

ASSETS = 'backend/app/assets/certificates'
FONTS = os.path.join(ASSETS, 'fonts')
MASTER = os.path.join(ASSETS, 'certificate_master.png')
LAYOUT = os.path.join(ASSETS, 'certificate_layout.json')

with open(LAYOUT) as f:
    layout = json.load(f)

fields = layout['fields']

def get_font(name, size):
    path = os.path.join(FONTS, name)
    return ImageFont.truetype(path, size)

# Load master
img = Image.open(MASTER).convert('RGBA')
print(f'Master loaded: {img.size}')
draw = ImageDraw.Draw(img)

# Text fields (static labels + dynamic values)
test_data = {
    'recipient_name': 'Udhaya K',
    'lab_title': 'OT Railroad Signaling & Control Security Lab',
    'completion_date': '31 JULY 2026',
    'certificate_id': 'CYR-2026-000001',
}

for key, val in test_data.items():
    if key in fields:
        f = fields[key]
        font = get_font(f['font'], f['size'])
        bbox = font.getbbox(val)
        w = bbox[2] - bbox[0]
        x = f['x']
        if f['align'] == 'center':
            x = f['x'] - w / 2
        elif f['align'] == 'right':
            x = f['x'] - w
        y = f['y']
        print(f'{key}: "{val}" size={f["size"]} draw_at=({x:.0f},{y})')
        draw.text((x, y), val, fill=f['color'], font=font)

img.convert('RGB').save('test_certificate_output.png')
print('Saved: test_certificate_output.png')
