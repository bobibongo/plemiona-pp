# tools/xlsx_to_json.py
import json, sys, glob, os
import openpyxl

HEADER = {'data', 'świat', 'swiat', 'transakcja'}

def looks_like_header(row):
    first = (str(row[0]) if row and row[0] is not None else '').strip().lower()
    return first in HEADER

def convert(path, outdir):
    wb = openpyxl.load_workbook(path, read_only=True)
    rows = []
    for ws in wb.worksheets:
        for r in ws.iter_rows(values_only=True):
            if r is None or len(r) < 6 or r[0] is None:
                continue
            if looks_like_header(r):
                continue
            rows.append({
                'dateRaw': str(r[0]).replace('\xa0', ' ').strip(),
                'world': str(r[1]).replace('\xa0', ' ').strip(),
                'txType': str(r[2]).replace('\xa0', ' ').strip(),
                'changeRaw': str(r[3]).replace('\xa0', ' ').strip(),
                'balanceRaw': str(r[4]).replace('\xa0', ' ').strip(),
                'info': str(r[5]).replace('\xa0', ' ').strip(),
            })
    base = os.path.splitext(os.path.basename(path))[0]
    out = os.path.join(outdir, f'legacy-{base}.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'source': os.path.basename(path), 'count': len(rows), 'rows': rows}, f, ensure_ascii=False, indent=2)
    print(f'{path} -> {out} ({len(rows)} wierszy)')

if __name__ == '__main__':
    outdir = 'dist'
    os.makedirs(outdir, exist_ok=True)
    files = sys.argv[1:] or glob.glob('_share/*.xlsx')
    for f in files:
        convert(f, outdir)
