from pathlib import Path
import re
files = list(Path('.').glob('*.html'))
updated = []
for path in files:
    text = path.read_text(encoding='utf-8')
    if 'class="productCart"' in text and 'assets/js/cart-system.js' not in text:
        # standardize cart icon href to #
        text = re.sub(r'<a\s+href="cart\.html"\s+class="productCart"','<a href="#" class="productCart"', text)
        text = re.sub(r'<a\s+href="[^\"]*"\s+class="productCart"','<a href="#" class="productCart"', text)
        # insert cart-system.js before </body>
        if '</body>' in text:
            text = text.replace('</body>', '        <script src="assets/js/cart-system.js"></script>\n    </body>')
        path.write_text(text, encoding='utf-8')
        updated.append(str(path))
print('updated', updated)
