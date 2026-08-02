from PIL import Image

src = 'C:/Users/Udhayakumar/.gemini/antigravity-ide/brain/e0ae55f2-3f63-4c96-aefc-0b0fd774f7bc/media__1785699163093.png'
img = Image.open(src).convert('RGB')
W, H = img.size

# Scan for gold-ish pixels: R > 180, G > 140, B < 100
gold_pixels = []
for y in range(H):
    for x in range(W):
        r, g, b = img.getpixel((x, y))
        if r > 180 and g > 140 and b < 100:
            gold_pixels.append((x, y))

if gold_pixels:
    xs = [p[0] for p in gold_pixels]
    ys = [p[1] for p in gold_pixels]
    print(f"Gold pixels range: X: {min(xs)} to {max(xs)}, Y: {min(ys)} to {max(ys)}")
else:
    print("No gold pixels found!")
