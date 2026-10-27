# -*- coding: utf-8 -*-
"""이미지 식별용 라벨 그리드 생성 (6x6, 각 200x133 + 라벨)"""
from PIL import Image, ImageDraw
import os

files = [f"{i:02d}.jpg" for i in range(1, 35)]
TW, TH = 240, 160
COLS = 6
ROWS = 6
PAD = 22
sheet = Image.new("RGB", (COLS * TW, ROWS * (TH + PAD)), (255, 255, 255))
d = ImageDraw.Draw(sheet)
for idx, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((TW, TH))
    x = (idx % COLS) * TW
    y = (idx // COLS) * (TH + PAD)
    sheet.paste(im, (x, y + PAD))
    d.rectangle([x, y, x + TW - 1, y + PAD - 1], fill=(0, 0, 0))
    d.text((x + 4, y + 5), f, fill=(255, 255, 0))
sheet.save("_labeled.jpg", quality=88)
print("saved", sheet.size)
