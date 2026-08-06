from PIL import Image
import os

path = 'backend/app/assets/certificates/certificate_master.png'
if os.path.exists(path):
    img = Image.open(path)
    print('Size:', img.size)
    print('Mode:', img.mode)
    print('DPI:', img.info.get('dpi', 'not set'))
    print('Format:', img.format)
    print('Width:', img.width, 'Height:', img.height)
else:
    print('FILE MISSING:', path)

fonts_dir = 'backend/app/assets/certificates/fonts'
print('\nFonts directory exists:', os.path.exists(fonts_dir))
if os.path.exists(fonts_dir):
    for f in os.listdir(fonts_dir):
        fp = os.path.join(fonts_dir, f)
        print(' ', f, '-', os.path.getsize(fp), 'bytes')
