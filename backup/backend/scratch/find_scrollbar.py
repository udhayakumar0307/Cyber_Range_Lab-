from PIL import Image

src = 'C:/Users/Udhayakumar/.gemini/antigravity-ide/brain/e0ae55f2-3f63-4c96-aefc-0b0fd774f7bc/media__1785699163093.png'
img = Image.open(src).convert('RGB')
W, H = img.size

# Let's save columns to see where the scrollbar starts.
# A scrollbar is usually a solid gray vertical bar on the right side.
# Let's print the average color of each column from right to left.
for x in range(W - 1, W - 40, -1):
    col = [img.getpixel((x, y)) for y in range(H)]
    avg_color = [sum(p[i] for p in col)/H for i in range(3)]
    print(f"Col {x}: {avg_color}")
