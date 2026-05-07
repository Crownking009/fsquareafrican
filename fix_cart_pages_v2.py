from pathlib import Path
import re
updated=[]
for path in Path('.').glob('*.html'):
    text=path.read_text(encoding='utf-8')
    if 'class="productCart"' in text and 'assets/js/cart-system.js' not in text:
        def fix_anchor(match):
            tag=match.group(0)
            if 'class="productCart"' in tag or "class='productCart'" in tag:
                if 'href="#"' in tag:
                    return tag
                if 'href=' in tag:
                    tag=re.sub(r'href=("[^"]*"|\'[^\']*\')', 'href="#"', tag, count=1)
                else:
                    tag=tag.replace('<a ', '<a href="#" ', 1)
            return tag
        text=re.sub(r'<a\s+[^>]*>', fix_anchor, text)
        if '</body>' in text:
            text=text.replace('</body>', '        <script src="assets/js/cart-system.js"></script>\n    </body>')
            path.write_text(text, encoding='utf-8')
            updated.append(path.name)
print('updated', updated)
