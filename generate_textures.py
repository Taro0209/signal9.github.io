#!/usr/bin/env python3
"""Generate placeholder textures for Signal 9"""
import struct, zlib, os

def png_chunk(chunk_type, data):
    c = chunk_type + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

def make_png(width, height, pixels):
    raw = b''
    for row in pixels:
        raw += b'\x00' + bytes(row)
    compressed = zlib.compress(raw, 9)
    return (
        b'\x89PNG\r\n\x1a\n' +
        png_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) +
        png_chunk(b'IDAT', compressed) +
        png_chunk(b'IEND', b'')
    )

import random
random.seed(42)

# static.png - TV static noise (grayscale noise as RGB)
w, h = 256, 256
pixels = []
for y in range(h):
    row = []
    for x in range(w):
        v = random.randint(0, 200)
        row += [v, v, v]
    pixels.append(row)
with open('assets/textures/static.png', 'wb') as f:
    f.write(make_png(w, h, pixels))
print("Generated static.png")

# metal.png - scratched dark metal
pixels = []
for y in range(h):
    row = []
    for x in range(w):
        base = 60 + random.randint(-15, 15)
        # horizontal scratches
        if random.random() < 0.03:
            base = random.randint(100, 160)
        # vertical scratches
        if random.random() < 0.01:
            base = random.randint(80, 140)
        row += [base, base+2, base+4]
    pixels.append(row)
with open('assets/textures/metal.png', 'wb') as f:
    f.write(make_png(w, h, pixels))
print("Generated metal.png")

print("Textures generated!")
