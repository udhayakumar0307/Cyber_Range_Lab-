from PIL import Image

src = 'C:/Users/Udhayakumar/.gemini/antigravity-ide/brain/e0ae55f2-3f63-4c96-aefc-0b0fd774f7bc/media__1785699163093.png'
img = Image.open(src).convert('RGB')
W, H = img.size

# Find the bounding box of the certificate (which has a white background)
# We scan from edges to find where the white canvas starts.
left, top, right, bottom = 0, 0, W-1, H-1

# Simple thresholding: find first row/col with many white pixels
# Or we can scan from edges and find the first pixel that is near white (e.g. > 240)
for x in range(W):
    col = [img.getpixel((x, y)) for y in range(H)]
    if any(sum(p)/3 > 240 for p in col):
        left = x
        break

for x in range(W-1, -1, -1):
    col = [img.getpixel((x, y)) for y in range(H)]
    if any(sum(p)/3 > 240 for p in col):
        right = x
        break

for y in range(H):
    row = [img.getpixel((x, y)) for x in range(W)]
    if any(sum(p)/3 > 240 for p in row):
        top = y
        break

for y in range(H-1, -1, -1):
    row = [img.getpixel((x, y)) for x in range(W)]
    if any(sum(p)/3 > 240 for p in row):
        bottom = y
        break

print(f"Certificate bounding box: left={left}, top={top}, right={right}, bottom={bottom}")
# Crop it and save
cropped = img.crop((left, top, right, bottom))
cropped.save('backend/app/assets/certificates/certificate_master_cropped.png')
print(f"Cropped size: {cropped.size}")
