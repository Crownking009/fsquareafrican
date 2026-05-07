from pathlib import Path
miss=[]
for path in Path('.').glob('*.html'):
    text = path.read_text(encoding='utf-8')
    if 'class="productCart"' in text and 'assets/js/cart-system.js' not in text:
        miss.append(path.name)
print('missing', miss)
