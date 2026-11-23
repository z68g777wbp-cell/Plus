# Browserprüfung (Playwright + Chromium): python3 tests/browser_check.py
# Prüft alle Aufgaben aus Level 1/2 und alle zulässigen Level-3-Strategien auf
# Plättchenanzahl, Farben, Überlagerung, freie Zellen, Rahmen, Abdeckung und Hilfsrechnungen.
import asyncio, json, time, sys
from playwright.async_api import async_playwright
import pathlib
URL=(pathlib.Path(__file__).resolve().parents[1]/'index.html').as_uri()
GAME=str(pathlib.Path(__file__).resolve().parents[1]/'game.js')
VALID_COLS={1,2,3,4,5,7,8,9,10,11}
INSPECT='''(()=>{const q=window.__plusLernspielQA.inspectBoard();
 const f=document.getElementById('pointsField').getBoundingClientRect(), m=document.getElementById('fadeMask').getBoundingClientRect();
 const fr=document.getElementById('redFrame'); const r=fr.getBoundingClientRect();
 return {items:q.items.map(i=>({i:i.index,c:i.color,r:i.row,col:i.col,cx:(i.rect.left+i.rect.right)/2,cy:(i.rect.top+i.rect.bottom)/2})),outside:q.outside,
  mask:getComputedStyle(document.getElementById('fadeMask')).opacity, maskCovers: m.left<=f.left+1&&m.top<=f.top+1&&m.right>=f.right-1&&m.bottom>=f.bottom-1,
  frame:{op:fr.style.opacity,l:r.left,t:r.top,r:r.right,b:r.bottom}, labels:window.__plusLernspielQA.labels()}})()'''
problems=[]
def check(tag, st, x, y, frame_expect=None):
    it=st['items']
    if len(it)!=x+y: problems.append(f'{tag}: Anzahl {len(it)} statt {x+y}')
    nb, nr = (max(x,y), min(x,y)) if tag.startswith('L1') or tag.startswith('L2') else (x, y)
    if sum(1 for i in it if i['c']=='blue')!=nb or sum(1 for i in it if i['c']=='red')!=nr: problems.append(f'{tag}: Farben falsch')
    cells=[(i['r'],i['col']) for i in it]
    if len(set(cells))!=len(cells): problems.append(f'{tag}: Überlagerung {cells}')
    if any(c[1] not in VALID_COLS or c[0] not in (1,2) for c in cells): problems.append(f'{tag}: ungültige Zelle {cells}')
    if st['outside']: problems.append(f'{tag}: außerhalb {st["outside"]}')
    # visual position must equal cell (no leftover transform): same row => same cy
    rows={}
    for i in it: rows.setdefault(i['r'],[]).append(i['cy'])
    for r,v in rows.items():
        if max(v)-min(v)>1.5: problems.append(f'{tag}: Zeile {r} nicht bündig')
    if frame_expect is not None:
        inside={(i['r'],i['col']) for i in it if st['frame']['l']<i['cx']<st['frame']['r'] and st['frame']['t']<i['cy']<st['frame']['b']}
        if inside!=frame_expect: problems.append(f'{tag}: Rahmen {sorted(inside)} statt {sorted(frame_expect)}')
def gc(c): return c if c<=5 else c+1
async def level12(b, tasks):
    pg=await b.new_page(viewport={'width':1180,'height':820}); await pg.goto(URL); await pg.wait_for_timeout(300)
    out=[]
    for (x,y,l) in tasks:
        t0=time.time()
        task=asyncio.create_task(pg.evaluate(f'window.__plusLernspielQA.runIntroForTest({x},{y},{l})'))
        await pg.wait_for_timeout(150)
        s1=await pg.evaluate(INSPECT); big,small=max(x,y),min(x,y); d=big-small
        check(f'L{l} {x}+{y} Start',s1,x,y)
        if d<=2:
            r1=[i for i in s1['items'] if i['r']==1]; r2=[i for i in s1['items'] if i['r']==2]
            if len(r1)!=big or len(r2)!=small: problems.append(f'L{l} {x}+{y}: untereinander falsch')
        else:
            if any(i['r']!=1 for i in s1['items']): problems.append(f'L{l} {x}+{y}: nicht nebeneinander')
            exp={(1,gc(c)) for c in range(6, big+small+1)} if big>=5 else set()
            if len(exp) < 2: exp = set()   # einzelnes Plättchen: kein Rahmen
            if exp: check(f'L{l} {x}+{y} Rahmen',s1,x,y,exp)
            elif s1['frame']['op'] not in ('0',''): problems.append(f'L{l} {x}+{y}: Rahmen ohne Grund (z. B. um ein einzelnes Plättchen)')
        if d==2:
            await pg.wait_for_timeout(1100)  # t≈1.25s: noch keine Bewegung
            s=await pg.evaluate(INSPECT)
            if any(i['r']==2 and i['c']=='blue' for i in s['items']): problems.append(f'{x}+{y}: Bewegung vor 1,5 s')
            await pg.wait_for_timeout(700)  # mitten in der Bewegung
            mid=await pg.evaluate("[...document.querySelectorAll('.dot')].some(d=>d.getAnimations().length>0)")
            if not mid: problems.append(f'{x}+{y}: keine sichtbare Bewegung')
            await pg.wait_for_timeout(900)
            s2=await pg.evaluate(INSPECT); check(f'L{l} {x}+{y} nach Bewegung',s2,x,y)
            m=(x+y)//2
            if sorted([sum(1 for i in s2['items'] if i['r']==r) for r in (1,2)])!=[m,m]: problems.append(f'{x}+{y}: keine Verdoppelung nach Bewegung')
            moved=[i for i in s2['items'] if i['r']==2 and i['c']=='blue']
            if len(moved)!=1: problems.append(f'{x}+{y}: Farbe des bewegten Plättchens')
            t_anim_end=time.time()
        else:
            t_anim_end=t0
        # Abdeckung
        while True:
            s=await pg.evaluate(INSPECT)
            if float(s['mask'])>0.01: break
            await pg.wait_for_timeout(50)
        dt=time.time()-t_anim_end
        await task; await pg.wait_for_timeout(250)
        s=await pg.evaluate(INSPECT)
        if not s['maskCovers'] or float(s['mask'])<0.99: problems.append(f'{x}+{y}: Abdeckung unvollständig')
        out.append((f'{x}+{y}',round(dt,2)))
        check(f'L{l} {x}+{y} Ende',s,x,y)
    await pg.close(); return out
async def level3(b, tasks):
    pg=await b.new_page(viewport={'width':1180,'height':820}); await pg.goto(URL); await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelector('[data-level=\"3\"]').click()"); await pg.wait_for_timeout(200)
    for (x,y,s_) in tasks:
        await pg.evaluate(f'window.__plusLernspielQA.runStrategyForTest({x},{y},"{s_}")'); await pg.wait_for_timeout(250)
        st=await pg.evaluate(INSPECT); check(f'L3 {x}+{y} {s_}',st,x,y)
        lab=st['labels']; res=str(x+y)
        if lab['top'] or lab['bottom'] or lab['hint']: problems.append(f'L3 {x}+{y} {s_}: Text sichtbar {lab}')
        if not await pg.evaluate("document.getElementById('fadeMask').classList.contains('green-cover')"): problems.append(f'L3 {x}+{y}: Abdeckung nicht grün')
        if s_=='double':
            sm=min(x,y); exp={(r,gc(c)) for r in (1,2) for c in range(1,sm+1)}
            check(f'L3 {x}+{y} Verdoppeln-Rahmen',st,x,y,exp)
        if s_=='nine':
            if not any(i['r']==1 and i['col']==11 and i['c']==('red' if x==9 else 'blue') for i in st['items']): problems.append(f'L3 {x}+{y}: 9er-Trick-Plättchen fehlt im 10. Feld')
        if float(st['mask'])<0.99 or not st['maskCovers']: problems.append(f'L3 {x}+{y} {s_}: Abdeckung')
        await pg.evaluate(f'window.__plusLernspielQA.runStrategyHelpForTest({x},{y},"{s_}")'); await pg.wait_for_timeout(350)
        st=await pg.evaluate(INSPECT); check(f'L3 Hilfe {x}+{y} {s_}',st,x,y)
        lab=st['labels']
        if lab['top'] or lab['bottom'] or lab['hint']: problems.append(f'L3 Hilfe {x}+{y} {s_}: Text sichtbar {lab}')
        if float(st['mask'])<0.99: problems.append(f'L3 Hilfe {x}+{y} {s_}: nach Wiederholung nicht abgedeckt')
    await pg.close()
async def interrupted(b):
    # Schnelle Antwort / Fehlversuch mitten in der Bewegung: Die nächste Darstellung muss korrekt sein.
    pg=await b.new_page(viewport={'width':1180,'height':820}); await pg.goto(URL); await pg.wait_for_timeout(300)
    pairs=[(4,2,4,1),(2,4,3,1),(5,3,5,2),(4,2,4,2),(6,4,2,6),(3,5,4,1)]
    for (x,y,nx,ny) in pairs:
        for cut in (1600,1950,2300):
            asyncio.create_task(pg.evaluate(f'window.__plusLernspielQA.runIntroForTest({x},{y},1)'))
            await pg.wait_for_timeout(cut)
            asyncio.create_task(pg.evaluate(f'window.__plusLernspielQA.runIntroForTest({nx},{ny},1)'))
            await pg.wait_for_timeout(250)
            st=await pg.evaluate(INSPECT); check(f'L1 {nx}+{ny} nach Abbruch von {x}+{y} bei {cut}ms',st,nx,ny)
            big,small=max(nx,ny),min(nx,ny)
            r1=[i for i in st['items'] if i['r']==1 and i['c']=='blue']
            if len(r1)!=big: problems.append(f'{nx}+{ny} nach Abbruch: größerer Summand nicht in einer Zeile')
            await pg.wait_for_timeout(3000)
            st=await pg.evaluate(INSPECT); check(f'L1 {nx}+{ny} Ende nach Abbruch',st,nx,ny)
    await pg.close()
async def main():
    import subprocess
    core=json.loads(subprocess.check_output(['node','-e','''const C=require(process.argv[1]);const r={};for(const l of [1,2,3]){r[l]=C.enumerateTasks(l).map(t=>[t.x,t.y,["double","hand","nine","ten","giant"].filter(s=>C.strategyValidity(s,t.x,t.y))])};console.log(JSON.stringify(r))''',GAME]))
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-sandbox'], **({'executable_path': '/usr/bin/google-chrome'} if pathlib.Path('/usr/bin/google-chrome').exists() else {}))
        l12=[(x,y,1) for x,y,_ in core['1']]+[(x,y,2) for x,y,_ in core['2']]
        chunks=[l12[i::6] for i in range(6)]
        l3=[(x,y,s) for x,y,ss in core['3'] for s in ss]
        c3=[l3[i::6] for i in range(6)]
        res=await asyncio.gather(*[level12(b,c) for c in chunks], *[level3(b,c) for c in c3], interrupted(b))
        times=[t for r in res[:6] for t in r]
        print('Level 1/2 Aufgaben:',len(times),' Level 3 Fälle:',len(l3))
        print('Abdeckung nach Animationsende (s): min',min(t for _,t in times),'max',max(t for _,t in times))
        await b.close()
    print('PROBLEME:',len(problems)); print('\n'.join(problems[:60]))
asyncio.run(main())
