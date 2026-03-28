import os
from PIL import Image, ImageOps

base_path = r'C:\Users\PublicDomain\.gemini\antigravity\brain\c094e33b-c2c1-4948-9f3b-4743b2897b4d'
files = {
    '0': 'media__1774401333650.png',
    '1': 'media__1774401345799.png',
    '2': 'media__1774401358941.png',
    '3': 'media__1774401367424.png',
    '4': 'media__1774401378421.png',
    '5': 'media__1774401387283.png',
    '6': 'media__1774401413020.png',
    '7': 'media__1774401422891.png',
    '8': 'media__1774401442767.png',
    '9': 'media__1774401432527.png'
}

print('TEMPLATES = {')
for char, fname in sorted(files.items()):
    try:
        fpath = os.path.join(base_path, fname)
        if not os.path.exists(fpath):
            continue
        
        img = Image.open(fpath).convert('L')
        # Invert if it looks like dark-on-light (but usually it's light-on-dark in MD)
        # Check corners to estimate background
        corners = [img.getpixel((0,0)), img.getpixel((img.width-1, 0)), img.getpixel((0, img.height-1))]
        bg = sum(corners)/3
        if bg > 128: img = ImageOps.invert(img)
        
        # Binarize with high threshold to catch the glows
        binary = img.point(lambda p: 255 if p > 50 else 0)
        
        # Bounding box
        bbox = binary.getbbox()
        if not bbox: continue
        digit = binary.crop(bbox)
        
        # Normalization (128x128 centered)
        target = Image.new('L', (128, 128), 0)
        w, h = digit.size
        sc = min(100.0/w, 100.0/h)
        new_w, new_h = int(w*sc), int(h*sc)
        digit_res = digit.resize((new_w, new_h), Image.Resampling.LANCZOS)
        target.paste(digit_res, ((128-new_w)//2, (128-new_h)//2))
        
        # 8-segment Profiles
        hPro = []
        vPro = []
        pix = target.load()
        for g in range(8):
            y1, y2 = 20+g*11, 20+(g+1)*11
            x1, x2 = 20+g*11, 20+(g+1)*11
            h_sum = 0
            v_sum = 0
            for py in range(y1, y2):
                for px in range(20, 108):
                    if pix[px, py] == 255: h_sum += 1
            for px in range(x1, x2):
                for py in range(20, 108):
                    if pix[px, py] == 255: v_sum += 1
            hPro.append(min(round(h_sum / 25.0), 32)) # Adjusting scale for 128x128
            vPro.append(min(round(v_sum / 25.0), 32))
        print(f'  "{char}": {{ h: {hPro}, v: {vPro} }},')
    except Exception as e:
        print(f'  # Error on {char}: {e}')
print('};')
