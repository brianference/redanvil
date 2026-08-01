import pdfplumber
PDF = r'C:\Users\brian\.claude\projects\C--Users-brian\831a72e4-ef93-4437-8f5b-343a04c8c018\tool-results\webfetch-1785568329256-purck4.pdf'
O, W = 104.9, 15.06
with pdfplumber.open(PDF) as pdf:
    p = pdf.pages[1]
    ws = p.extract_words()
    for target in (0, 24):
        hits = [c for c in p.chars if c['text'] in ('T','S') and 90 < c['x0'] < 480
                and round((((c['x0']+c['x1'])/2)-O)/W) == target]
        print(f'--- bin {target}: {len(hits)} marker(s) ---')
        for c in hits[:6]:
            label = ' '.join(w['text'] for w in ws if w['x1'] < 100 and abs(w['top']-c['top']) < 5)
            print(f"   x={c['x0']:.1f} top={c['top']:.1f} '{c['text']}'  row={label[:40]!r}")
