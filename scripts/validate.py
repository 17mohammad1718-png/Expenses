#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""اعتبارسنجی data/expenses.json — مجموع‌ها را با مقادیر تثبیت‌شده چک می‌کند.

استفاده: python scripts/validate.py    (خروجی ۰ یعنی همه‌چیز درست است)
"""
import json, sys
from collections import defaultdict
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent / 'data' / 'expenses.json'

# مقادیر تثبیت‌شده از اکسل اصلی (مرداد ۱۴۰۵)
EXPECTED = {
    'rows': 76,
    'total': 92_419_900,
    'per_category': {           # بعد از انتقال «پول شکری منبع آب» به دستهٔ آب
        'personal':   22_100_000,
        'settlement': 41_900_000,
        'water':      13_200_000,
        'materials':   9_743_000,
        'hospitality': 3_298_500,
        'ads':         1_678_400,
        'tax':           330_000,
        'misc':          170_000,
    },
    'personal': {               # ردیف‌های مشترک نصف نصف به هر نفر اضافه می‌شوند
        'mohammad_effective': 10_600_000,
        'zahra_effective':    11_500_000,
        'both_total':         10_400_000,
    },
}

def main():
    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    errors = []

    if len(data) != EXPECTED['rows']:
        errors.append(f"تعداد ردیف‌ها: {len(data)} (انتظار {EXPECTED['rows']})")

    total = sum(r['amount'] for r in data)
    if total != EXPECTED['total']:
        errors.append(f"جمع کل: {total:,} (انتظار {EXPECTED['total']:,})")

    cat_sum = defaultdict(int)
    cat_cnt = defaultdict(int)
    for r in data:
        cat_sum[r['category']] += r['amount']
        cat_cnt[r['category']] += 1

    for cat, expected in EXPECTED['per_category'].items():
        if cat_sum.get(cat, 0) != expected:
            errors.append(f"دستهٔ {cat}: {cat_sum.get(cat,0):,} (انتظار {expected:,})")

    m_eff = z_eff = both = 0
    for r in data:
        if r['category'] != 'personal':
            continue
        if r['who'] == 'm':
            m_eff += r['amount']
        elif r['who'] == 'z':
            z_eff += r['amount']
        else:
            both += r['amount']
            m_eff += r['amount'] // 2
            z_eff += r['amount'] // 2
    if (m_eff, z_eff, both) != (EXPECTED['personal']['mohammad_effective'],
                               EXPECTED['personal']['zahra_effective'],
                               EXPECTED['personal']['both_total']):
        errors.append(f"برداشت شخصی: محمد={m_eff:,} زهرا={z_eff:,} مشترک={both:,}")

    # ترتیب id یکتا و متوالی
    ids = [r['id'] for r in data]
    if ids != sorted(ids) or len(set(ids)) != len(ids):
        errors.append('شناسه‌ها یکتا/متوالی نیستند')

    if errors:
        print('❌ اعتبارسنجی ناموفق:')
        for e in errors:
            print('  -', e)
        sys.exit(1)

    print(f'✅ اعتبارسنجی گذشت — {len(data)} ردیف، جمع کل {total:,} تومان')
    print(f'   برداشت مؤثر: محمد {m_eff:,} | زهرا {z_eff:,} | مشترک {both:,}')

if __name__ == '__main__':
    main()
