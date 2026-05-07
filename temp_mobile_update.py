from pathlib import Path
import re
pattern = re.compile(r'<div class="navbar-option-item navbar-option-dots mobile-hide">\s*<button[^>]*>\s*<i class="flaticon-menu-1"></i>\s*</button>\s*<div class="dropdown-menu"[^>]*>\s*<div class="navbar-option-item navbar-option-cart">[\s\S]*?</div>\s*<div class="navbar-option-item navbar-option-order">[\s\S]*?</div>\s*</div>\s*</div>\s*', re.MULTILINE)
for path in Path('.').glob('*.html'):
    text = path.read_text(encoding='utf-8')
    new_text, n = pattern.subn('', text)
    if n > 0:
        print(f'Updated {path} ({n} removals)')
        path.write_text(new_text, encoding='utf-8')
