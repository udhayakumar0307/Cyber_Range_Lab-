from PIL import Image

src = 'C:/Users/Udhayakumar/.gemini/antigravity-ide/brain/e0ae55f2-3f63-4c96-aefc-0b0fd774f7bc/media__1785699163093.png'
img = Image.open(src).convert('RGB')
W, H = img.size

# Let's search the row y=540 (which is in the middle of the circles)
# and find the x ranges where the pixels are dark blue / golden (not white background)
y = int(H * 0.77) # y around 556
print(f"Scanning row y={y}...")
non_white = []
for x in range(W):
    p = img.getpixel((x, y))
    # if it's not white (sum of RGB < 700)
    if sum(p) < 700:
        non_white.append(x)

# Group consecutive x coordinates
if non_white:
    groups = []
    curr = [non_white[0]]
    for x in non_white[1:]:
        if x == curr[-1] + 1:
            curr.append(x)
        else:
            groups.append(curr)
            curr = [x]
    groups.append(curr)
    
    for g in groups:
        print(f"Range: {g[0]} to {g[-1]} (center={sum(g)/len(g)})")
