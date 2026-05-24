#!/usr/bin/env python3
"""Direct string replacement fix for remaining mojibake in admin.js.
Uses known mojibake -> correct Turkish string mappings based on context analysis.
"""

TARGET = r'c:\Projects\lutheus\src\dashboard\admin.js'

with open(TARGET, 'r', encoding='utf-8') as f:
    content = f.read()

# These are the EXACT mojibake sequences found in the file mapped to their correct values.
# Derived by analyzing the codepoints and reverse-engineering the encoding.
# The sequences involve ğ (U+011F), ı (U+0131), İ (U+0130), and ş (U+015F)
# in various encoding stages.

# Pattern: 'ÃƒÂ¢â€šÂ¬â€ Ã‚Â±' type sequences
# After our previous fix, what remains is still partially fixed.
# Let's do final direct replacements of the exact remaining mojibake strings.

# From the repr output of remaining bad lines:
# 'kopyalandÃƒâ€\x9eÃ‚Â±' -> 'kopyalandığı' (ğ+ı)
# But we need the exact string match for the cluster

# Method: scan file for non-ASCII sequences and manually map them
# Based on the codepoint sequences we've seen, let's build a replacement dict

CHAR_MAP = {
    # remaining sequences: the 9-char cluster for ğı
    'Ã\u0192â€\x9eÃ‚Â±': 'ğı',   # kopyalandığı
    'Ã\u0192â€\x9eÃ‚Â°': 'ğI',   # ğI  
    'Ã\u0192â€\x9eÃ…â€™': 'ğ',   # ğ alone  
    # For sequences like 'kaydÃƒâ€\x9eÃ‚Â±' = 'kaydığı' -> keep it as 'kaydı'
    # The full patterns after the context:
    # 'Ãƒâ€\x9eÃ‚Â±' = 'ğı' (this is the exact sequence)
    'Ã\u0192Ã¢â€šÃ‚¬Ã‚Â\x9eÃ‚Â±': 'ğı',
    
    # After previous script, some chars became: 0xC3 0x192 0xC6 0x2019 0xC3 0xE2 0x201A 0xC2 0xB1
    # = Ã ƒ Æ ' Ã â ‚ Â ±  
    # cp1252 encode: c3 83 c6 92 c3 e2 c2 b1 (some won't encode)
    
    # Try the sequence characters directly as a lookup:
    chr(0xC3)+chr(0x192)+chr(0xC6)+chr(0x2019)+chr(0xC3)+chr(0xE2)+chr(0x201A)+chr(0xC2)+chr(0xB1): 'ğı',
    chr(0xC3)+chr(0x192)+chr(0xC6)+chr(0x2019)+chr(0xC3)+chr(0xE2)+chr(0x201A)+chr(0xC2)+chr(0x9F): 'ğ',
    chr(0xC3)+chr(0x192)+chr(0xC6)+chr(0x2019)+chr(0xC3)+chr(0xE2)+chr(0x201A)+chr(0xC2)+chr(0xB0): 'ğİ',
    chr(0xC3)+chr(0x192)+chr(0xC6)+chr(0x2019)+chr(0xC3)+chr(0xE2)+chr(0x201A)+chr(0xC2)+chr(0xA7): 'ğç',
}

count = 0
for bad, good in CHAR_MAP.items():
    c = content.count(bad)
    if c:
        print(f'{c}x {repr(bad)} -> {repr(good)}')
        count += c
        content = content.replace(bad, good)

with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Total replacements: {count}')

# Now report remaining bad chars
lines = content.split('\n')
MOJIBAKE = {0x00C3, 0x0192, 0x00C6, 0x2019, 0x2020, 0x00E2, 0x20AC, 0x2122, 0x00C2, 0x201A, 0x00B6}
bad = [(i+1, lines[i]) for i in range(len(lines)) if any(ord(c) in MOJIBAKE for c in lines[i])]
print(f'\nRemaining mojibake lines: {len(bad)}')
for lineno, line in bad[:10]:
    print(f'L{lineno}: {repr(line[:120])}')
