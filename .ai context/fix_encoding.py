#!/usr/bin/env python3
"""Fix triple-encoded UTF-8 mojibake in admin.js.

Characters were triple-encoded: each round encodes as cp1252 and decodes as utf-8.
We reverse 3 rounds for each non-ASCII cluster.
"""
import re

TARGET = r'c:\Projects\lutheus\src\dashboard\admin.js'

def fix_cluster(s: str) -> str:
    """Apply up to 5 rounds of cp1252->utf-8 fix on a non-ASCII cluster."""
    result = s
    for _ in range(5):
        try:
            b = result.encode('cp1252')
            candidate = b.decode('utf-8')
            if candidate == result:
                break
            result = candidate
        except (UnicodeEncodeError, UnicodeDecodeError):
            break
    return result

# Match maximal runs of chars where any char is in the mojibake-typical range
# We look for sequences that contain chars like: Ã(0xC3) ƒ(0x192) Æ(0xC6) '(0x2019) etc.
MOJIBAKE_CHARS = {0x00C3, 0x0192, 0x00C6, 0x2019, 0x2020, 0x00E2, 0x20AC, 0x2122,
                   0x00C2, 0x0161, 0x201A, 0x00B6, 0x00BC, 0x00B1, 0x2026, 0x0178,
                   0x00A7, 0x0160, 0x2013, 0x2014, 0x017E, 0x017D, 0x0153, 0x0152,
                   0x00A9, 0x00AE, 0x00A1, 0x00BF, 0x00B0, 0x00A8, 0x00B4, 0x00A4}

def is_mojibake_char(c: str) -> bool:
    return ord(c) in MOJIBAKE_CHARS or (0x0080 <= ord(c) <= 0x00FF and ord(c) not in (0x00A0,))

def fix_line(line: str) -> str:
    """Fix all non-ASCII substrings in a line."""
    # Split into alternating ASCII/non-ASCII runs
    # Non-ASCII run: consecutive chars where at least one char is a mojibake char
    # We also include chars like â€™ (U+2019) which are part of sequences
    result = []
    i = 0
    n = len(line)
    while i < n:
        if is_mojibake_char(line[i]):
            # Start of a non-ASCII cluster
            j = i
            while j < n and (is_mojibake_char(line[j]) or (j > i and 0x80 <= ord(line[j]) <= 0xFF)):
                j += 1
            cluster = line[i:j]
            fixed = fix_cluster(cluster)
            result.append(fixed)
            i = j
        else:
            result.append(line[i])
            i += 1
    return ''.join(result)

with open(TARGET, 'r', encoding='utf-8') as f:
    lines = f.readlines()

fixed_lines = []
changed_count = 0
for idx, line in enumerate(lines):
    if any(is_mojibake_char(c) for c in line):
        fixed = fix_line(line)
        if fixed != line:
            changed_count += 1
            print(f'L{idx+1}:')
            print(f'  Before: {repr(line.rstrip()[:120])}')
            print(f'  After:  {repr(fixed.rstrip()[:120])}')
        fixed_lines.append(fixed)
    else:
        fixed_lines.append(line)

with open(TARGET, 'w', encoding='utf-8') as f:
    f.writelines(fixed_lines)

print(f'\nTotal lines changed: {changed_count}')
