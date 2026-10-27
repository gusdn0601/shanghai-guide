"""Assemble the guide: template + data → dist/index.html (+ img/)."""
import json, os, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = lambda f: open(os.path.join(R, 'src', f), encoding='utf-8').read()
html = src('template.html')
photos_path = os.path.join(R, 'src', 'photos.json')
photos = json.load(open(photos_path, encoding='utf-8')) if os.path.exists(photos_path) else {}
html = html.replace('/*__ART__*/', src('art.js'))
html = html.replace('/*__PLACES__*/', src('places.js'))
html = html.replace('/*__PHRASES__*/', src('phrases.js'))
html = html.replace('/*__PHOTOS__*/', 'const PHOTOS = ' + json.dumps(photos, ensure_ascii=False) + ';')
os.makedirs(os.path.join(R, 'dist'), exist_ok=True)
out = os.path.join(R, 'dist', 'index.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, len(html))
