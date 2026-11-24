#!/usr/bin/env python3
"""Build the Spanish, French and Polish pages from the English index.html.

Run after every change to index.html:  python3 build_i18n.py
Translations live in i18n/translations.json (English text -> es / fr / pl).
It writes es/index.html, fr/index.html and pl/index.html, and lists any English text it couldn't translate.
"""
import json, re, html, os, sys

LANGS = ['es', 'fr', 'pl']
KEEP = {'Flixbnb', 'Hostaway', 'Airbnb', 'Booking.com', 'WhatsApp', 'Chekin', 'Telegram', 'Gmail', 'Google Maps',
        'Maria', 'Nikos', 'hello@flixbnb.com', '&times;', 'Nikis 54 · 23:40', 'Email', 'Message', 'Pause', 'online', 'control',
        'English', 'Español', 'Français', 'Polski'}

here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'index.html'), encoding='utf-8').read()
data = json.load(open(os.path.join(here, 'i18n', 'translations.json'), encoding='utf-8'))
T = data['strings']

def esc_attr(s):
    return s.replace('&', '&amp;').replace('"', '&quot;')

def build(lang):
    s = src
    s = s.replace('<html lang="en">', f'<html lang="{lang}">', 1)
    # attributes: title text, description, aria-label / title / alt
    s = re.sub(r'<title>(.*?)</title>', lambda m: '<title>' + T.get(m.group(1), {}).get(lang, m.group(1)) + '</title>', s, count=1)
    s = re.sub(r'(name="description" content=")([^"]*)(")', lambda m: m.group(1) + esc_attr(T.get(m.group(2), {}).get(lang, m.group(2))) + m.group(3), s, count=1)
    s = re.sub(r'\b(aria-label|title|alt)="([^"]*)"', lambda m: f'{m.group(1)}="{esc_attr(T[m.group(2)][lang])}"' if m.group(2) in T else m.group(0), s)
    # text between tags, outside <script> blocks
    parts = re.split(r'(<script\b.*?</script>)', s, flags=re.S)
    for i in range(0, len(parts), 2):
        parts[i] = re.sub(r'>([^<>]+)<', lambda m: '>' + T[m.group(1)][lang] + '<' if m.group(1) in T else m.group(0), parts[i])
    s = ''.join(parts)
    # the flag switcher: mark this language as the current one
    s = s.replace(' class="is-on" aria-current="page" title=', ' title=', 1)
    s = re.sub(rf'(<a href="/{lang}/" hreflang="{lang}" lang="{lang}")', r'\1 class="is-on" aria-current="page"', s, count=1)
    # strings the scripts look up
    js = {k: T[k][lang] for k in data['js']}
    s = s.replace('</head>', '  <script>window.FLX_T = ' + json.dumps(js, ensure_ascii=False) + ';</script>\n</head>', 1)
    # anything left in English?
    body = re.sub(r'<script\b.*?</script>|<svg\b.*?</svg>', '', s[s.index('<body'):], flags=re.S)
    left = sorted({t for t in re.findall(r'>([^<>]+)<', body) if re.search('[A-Za-z]', t) and t.strip() not in KEEP and t in T and T[t][lang] != t})
    os.makedirs(os.path.join(here, lang), exist_ok=True)
    open(os.path.join(here, lang, 'index.html'), 'w', encoding='utf-8').write(s)
    return left

missing_keys = []
body = re.sub(r'<script\b.*?</script>|<svg\b.*?</svg>', '', src[src.index('<body'):], flags=re.S)
for t in sorted(set(re.findall(r'>([^<>]+)<', body))):
    if re.search('[A-Za-z]', t) and t not in T and t.strip() not in KEEP:
        missing_keys.append(t)
for a in sorted(set(re.findall(r'\b(?:aria-label|title|alt)="([^"]*[A-Za-z][^"]*)"', src))):
    if a not in T and a not in ('English', 'Español', 'Français', 'Polski'):
        missing_keys.append('[attr] ' + a)

ok = True
for lang in LANGS:
    left = build(lang)
    if left:
        ok = False; print(lang, 'still English:', left)
if missing_keys:
    ok = False
    print('No translation yet for:')
    for k in missing_keys: print('  ', repr(k))
print('Built', ', '.join(f'/{l}/' for l in LANGS), '' if ok else '(see the list above)')
sys.exit(0 if ok else 1)
