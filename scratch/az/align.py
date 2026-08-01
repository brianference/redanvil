"""Anchor AZ1005's grid using the ROW STRUCTURE rather than the vertical rules.

The header confirms 24 half-month columns but exists only in the content stream,
so it gives no x-anchor. The rules disagree page to page. What does not disagree
is the markers themselves: across ~40 crop rows every marker must land in one of
24 evenly spaced bins, so the correct origin is the one that makes every marker
sit near a bin centre. A wrong origin smears them.
"""
import pypdf, pdfplumber
from statistics import median
PDF = r'C:\Users\brian\.claude\projects\C--Users-brian\831a72e4-ef93-4437-8f5b-343a04c8c018\tool-results\webfetch-1785568329256-purck4.pdf'

with pdfplumber.open(PDF) as pdf:
    for pi in (1, 2):
        p = pdf.pages[pi]
        xs = [ (c['x0']+c['x1'])/2 for c in p.chars if c['text'] in ('T','S') and c['x0'] > 90 and c.get('upright', True) ]
        xs = [x for x in xs if x < 480]
        if not xs: continue
        best = None
        # Search origin and width; width is tightly constrained by the rules (~14.86).
        for w10 in range(1450, 1520):
            w = w10/100
            for o10 in range(int(min(xs)*10)-200, int(min(xs)*10)+40):
                o = o10/10
                idx = [ (x-o)/w for x in xs ]
                if max(idx) > 23.9 or min(idx) < -0.1: continue
                err = sum(abs(i-round(i)) for i in idx)/len(idx)
                if best is None or err < best[0]: best = (err, o, w)
        err, o, w = best
        cols = sorted({round((x-o)/w) for x in xs})
        print(f'page {pi+1}: origin={o:.1f} width={w:.2f} mean-bin-error={err:.3f} '
              f'columns-used={len(cols)} range={cols[0]}..{cols[-1]}')
