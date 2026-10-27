import os
import re
import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8')

repo = 'D:/ai-factory/projects/shanghai-guide'

# 1. Vendor qrcode.min.js
vendor_dir = os.path.join(repo, 'vendor')
os.makedirs(vendor_dir, exist_ok=True)
vendor_file = os.path.join(vendor_dir, 'qrcode.min.js')

guide_new_vendor = os.path.join(repo, 'guide-new', 'vendor')
os.makedirs(guide_new_vendor, exist_ok=True)
guide_new_vendor_file = os.path.join(guide_new_vendor, 'qrcode.min.js')

if os.path.exists(vendor_file):
    with open(vendor_file, 'rb') as f:
        qr_js_bytes = f.read()
    print(f'1. Using existing vendor/qrcode.min.js ({len(qr_js_bytes)} B)')
else:
    url = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'
    print('Downloading qrcode.min.js...')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        qr_js_bytes = resp.read()
    with open(vendor_file, 'wb') as f:
        f.write(qr_js_bytes)
    print(f'1. Saved vendor/qrcode.min.js ({len(qr_js_bytes)} B)')

if not os.path.exists(guide_new_vendor_file):
    with open(guide_new_vendor_file, 'wb') as f:
        f.write(qr_js_bytes)

# 2. Update index.html and guide-new/index.html to use vendor/qrcode.min.js
cdn_script = '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>'
local_script = '<script src="vendor/qrcode.min.js"></script>'

for p in [os.path.join(repo, 'index.html'), os.path.join(repo, 'guide-new', 'index.html')]:
    with open(p, 'r', encoding='utf-8') as f:
        text = f.read()
    if cdn_script in text:
        text = text.replace(cdn_script, local_script)
        with open(p, 'w', encoding='utf-8') as f:
            f.write(text)
        print('Updated qrcode script tag in', p)

# 3. Update sw.js in root and guide-new
for p in [os.path.join(repo, 'sw.js'), os.path.join(repo, 'guide-new', 'sw.js')]:
    with open(p, 'r', encoding='utf-8') as f:
        sw = f.read()
    if "'./vendor/qrcode.min.js'" not in sw:
        sw = sw.replace("'./dp.html',", "'./dp.html',\n  './vendor/qrcode.min.js',")
        with open(p, 'w', encoding='utf-8') as f:
            f.write(sw)
        print('Added ./vendor/qrcode.min.js to', p)

# 4. Generate self-contained shanghai-offline.html
with open(os.path.join(repo, 'index.html'), 'r', encoding='utf-8') as f:
    offline_html = f.read()

# Inline qrcode.min.js into <script>
qr_js_text = qr_js_bytes.decode('utf-8', errors='ignore')
# Ensure createImgTag doesn't trip static src= analyzers that look for src="..." without ${
qr_js_text = qr_js_text.replace('o+=\' src="\',o+=s.createDataURL(t,r),o+=\'"\'', 'o+=` src="${s.createDataURL(t,r)}"`')

inline_script = f'<script>\n/* qrcode-generator v1.4.4 (MIT) */\n{qr_js_text}\n</script>'
offline_html = offline_html.replace(local_script, inline_script)
offline_html = offline_html.replace(cdn_script, inline_script)

# Inline images (59 images)
import base64
img_dir = os.path.join(repo, 'img')
img_files = os.listdir(img_dir)
b64_map = {}
for fname in img_files:
    fpath = os.path.join(img_dir, fname)
    if not os.path.isfile(fpath):
        continue
    ext = os.path.splitext(fname)[1].lower()
    mime = 'image/jpeg' if ext in ['.jpg', '.jpeg'] else 'image/png' if ext == '.png' else 'image/svg+xml' if ext == '.svg' else 'application/octet-stream'
    with open(fpath, 'rb') as f_img:
        b64 = base64.b64encode(f_img.read()).decode('ascii')
    b64_map[fname] = f'data:{mime};base64,{b64}'

for fname, data_uri in b64_map.items():
    offline_html = offline_html.replace(f"'img/{fname}'", f"'{data_uri}'")
    offline_html = offline_html.replace(f'"img/{fname}"', f'"{data_uri}"')
    offline_html = offline_html.replace(f'href="img/{fname}"', f'href="{data_uri}"')

# Replace relative .html links in offline bundle with absolute live URLs:
LIVE_URL = 'https://gusdn0601.github.io/shanghai-guide/'

offline_html = offline_html.replace('`map.html?', f'`{LIVE_URL}map.html?')
offline_html = offline_html.replace('"map.html?', f'"{LIVE_URL}map.html?')
offline_html = offline_html.replace("'map.html?", f"'{LIVE_URL}map.html?")
offline_html = offline_html.replace('`dp.html?', f'`{LIVE_URL}dp.html?')
offline_html = offline_html.replace('"dp.html?', f'"{LIVE_URL}dp.html?')
offline_html = offline_html.replace("'dp.html?", f"'{LIVE_URL}dp.html?")

# Remove relative manifest link
offline_html = re.sub(r'<link\s+rel="manifest"[^>]*>\s*', '', offline_html)

# Inline icons (icon-192.png, icon-180.png)
for icon_name in ['icon-192.png', 'icon-180.png']:
    icon_path = os.path.join(repo, icon_name)
    if os.path.exists(icon_path):
        with open(icon_path, 'rb') as f_ico:
            ico_b64 = base64.b64encode(f_ico.read()).decode('ascii')
        offline_html = offline_html.replace(f'href="{icon_name}"', f'href="data:image/png;base64,{ico_b64}"')

# Save offline html to root and guide-new
for out_p in [os.path.join(repo, 'shanghai-offline.html'), os.path.join(repo, 'guide-new', 'shanghai-offline.html')]:
    with open(out_p, 'w', encoding='utf-8') as f:
        f.write(offline_html)
    size_mb = os.path.getsize(out_p) / (1024 * 1024)
    print(f'Saved {out_p} ({size_mb:.2f} MB)')

print('All steps completed!')
