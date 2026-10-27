# -*- coding: utf-8 -*-
import struct, os

def dims(p):
    d = open(p, 'rb').read()
    i = 2
    while i < len(d) - 9:
        if d[i] != 0xFF:
            i += 1
            continue
        m = d[i + 1]
        if m in (0xC0, 0xC1, 0xC2, 0xC3):
            h, w = struct.unpack('>HH', d[i + 5:i + 9])
            return (w, h)
        if m in (0xD8, 0xD9) or 0xD0 <= m <= 0xD7:
            i += 2
            continue
        ln = struct.unpack('>H', d[i + 2:i + 4])[0]
        i += 2 + ln
    return None

for f in sorted(os.listdir('.')):
    if f.endswith('.jpg'):
        print(f, dims(f))
