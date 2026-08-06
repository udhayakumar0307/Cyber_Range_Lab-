from PIL import Image

src = 'C:/Users/Udhayakumar/.gemini/antigravity-ide/brain/e0ae55f2-3f63-4c96-aefc-0b0fd774f7bc/media__1785699163093.png'
img = Image.open(src).convert('RGB')
W, H = img.size

# Find the bounding box of the non-gray region.
# Let's inspect the top-left pixel color.
bg_color = img.getpixel((0, 0))
print(f"Top-left background pixel: {bg_color}")

# Scan cols from left to find where it is NOT bg_color
left = 0
for x in range(W):
    col = [img.getpixel((x, y)) for y in range(H)]
    if any(p != bg_color for p in col):
        left = x
        break

# Scan cols from right
right = W - 1
for x in range(W-1, -1, -1):
    col = [img.getpixel((x, y)) for y in range(H)]
    if any(p != bg_color for p in col):
        right = x
        break

# Scan rows from top
top = 0
for y in range(H):
    row = [img.getpixel((x, y)) for x in range(W)]
    if any(p != bg_color for p in row):
        top = y
        break

# Scan rows from bottom
bottom = H - 1
for y in range(H-1, -1, -1):
    row = [img.getpixel((x, y)) for x in range(W)]
    if any(p != bg_color for p in row):
        bottom = y
        break

print(f"Detected certificate bounds: left={left}, top={top}, right={right}, bottom={bottom}")
print(f"Certificate width={right-left+1}, height={bottom-top+1}")
# Crop and save to temp to view size
cropped = img.crop((left, top, right + 1, bottom + 1))
cropped.save('app/assets/certificates/certificate_master_cropped.png')
print(f"Cropped size saved: {cropped.size}")
