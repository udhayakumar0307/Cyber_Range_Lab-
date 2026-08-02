"""
Pixel-precise coordinate calibration script.
Analyzes the master certificate layout to identify exact text placement zones.
"""
from PIL import Image
import os

src_orig = 'backend/app/assets/certificates/certificate_master.png'
img = Image.open(src_orig)
W, H = img.size
print(f'Canvas: {W} x {H}')
print()
print('Reference measurements from master image (1400x990):')
print('The certificate structure top-to-bottom:')
print()
print('Header: Logo top-left ~y=30-120')
print('Certificate ID: top-right ~y=50-80, right edge ~x=1260 (stops before ribbon at x=1280)')
print()
print('CERTIFICATE title: center ~y=170-270')
print('OF COMPLETION: center ~y=285-310')
print()
print('"This is to certify that": center ~y=335-360')
print('Recipient Name (script): center ~y=370-480')
print('Gold underline: ~y=487')
print()
print('"has successfully completed the lab": center ~y=505-530')
print('Lab Title (bold blue): center ~y=545-580')
print('"and demonstrated...": center ~y=590-615')
print()
print('Metrics separator line top: ~y=630')
print('Metric labels (COMPLETED ON, DURATION, SCORE): ~y=645-660')
print('Metric values (date, time, score): ~y=668-688')
print('Metrics separator line bottom: ~y=700')
print()
print('Footer area: y=730-990')
print('Signature: left ~x=80-270, y=755-830')
print('Seal badge: center ~x=590-810, y=730-900')
print('QR code: right ~x=1095-1245, y=745-895')
print('QR "Verify Certificate": ~x=1170 center, y=903-920')
print('QR "Scan to verify": ~x=1170 center, y=920-935')
