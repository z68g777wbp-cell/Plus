# Browserprüfung Level 4–6 (Playwright + Chromium): python3 tests/browser_zr100.py
# Spielt ausgewählte Aufgaben über alle Rechenweg-Typen durch und prüft Material, Farben,
# Überlagerung, Felder, Abdeckung, Zeiten (0,3 s Prüfung, 0,5 s Zurücksetzen, 1,5 s neue Rechnung)
# und Hinweise bei unpassenden Buttons.
import asyncio, json, pathlib, subprocess, sys, time
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = (ROOT / 'index.html').as_uri()
GAME = str(ROOT / 'game.js')
problems = []
def inside(a, f, tol=1.5): return a['l'] >= f['l'] - tol and a['t'] >= f['t'] - tol and a['r'] <= f['r'] + tol and a['b'] <= f['b'] + tol
def overlap(a, b): return min(a['r'], b['r']) - max(a['l'], b['l']) > 1 and min(a['b'], b['b']) - max(a['t'], b['t']) > 1
def level_of(tag): return int(tag[1])
def check_board(tag, z, x, y):
    it = z['items']
    val = lambda items: sum(10 if i['kind'] == 'rod' else 1 for i in items)
    if val(it) != x + y: problems.append(f'{tag}: Material {val(it)} statt {x+y}')
    if val([i for i in it if i['origin'] == 'yellow']) != x or val([i for i in it if i['origin'] == 'blue']) != y: problems.append(f'{tag}: Farben/Herkunft falsch')
    for i in it:
        if f"pv-from-{i['origin']}" not in i['cls']: problems.append(f'{tag}: Farbe gewechselt')
        if not inside(i, z['fields'][i['field']]): problems.append(f"{tag}: {i['kind']} außerhalb von {i['field']}")
    for a in range(len(it)):
        for b in range(a + 1, len(it)):
            if overlap(it[a], it[b]): problems.append(f'{tag}: Überlagerung'); return
    rem = z.get('remNow')
    if rem and level_of(tag) >= 5:
        green = val([i for i in it if i['field'] == 'green'])
        expect = x + y - (rem['AT'] * 10 + rem['AE'] + rem['BT'] * 10 + rem['BE'])
        if green != expect: problems.append(f"{tag}: grünes Feld {green} statt {expect}")
        if val([i for i in it if i['field'] == 'yellow']) != rem['AT'] * 10 + rem['AE'] or val([i for i in it if i['field'] == 'blue']) != rem['BT'] * 10 + rem['BE']: problems.append(f'{tag}: Restmaterial in Gelb/Blau falsch')
async def type_digits(pg, digits):
    for d in digits: await pg.click(f'[data-key="{d}"]')
async def wait_idle(pg, timeout=15):
    t0 = time.time()
    while time.time() - t0 < timeout:
        z = await pg.evaluate('__plusLernspielQA.zr()')
        if not z['busy'] and (z['choiceVisible'] or z['active']): return z
        await pg.wait_for_timeout(80)
    raise TimeoutError('kein Ruhezustand')
async def answer(pg, tag, expected, wrong_first=False):
    z = await pg.evaluate('__plusLernspielQA.zr()')
    if z['expected'] != str(expected): problems.append(f"{tag}: erwartet {z['expected']} statt {expected}")
    sel = '#answerInput' if z['active'] == 'main' else '#zrSteps .zr-step:last-child input'
    if wrong_first:
        bad = str((expected + 1) % (10 ** len(str(expected))) or 1).zfill(len(str(expected)))
        await type_digits(pg, bad); t = time.time()
        while 'bad' not in (await pg.eval_on_selector(sel, 'e=>e.className')):
            await pg.wait_for_timeout(20)
            if time.time() - t > 2: problems.append(f'{tag}: kein Rot'); break
        dt = time.time() - t
        if not (0.2 < dt < 0.6): problems.append(f'{tag}: Prüfung nach {dt:.2f}s statt 0,3s')
        await pg.wait_for_timeout(650)
        if await pg.eval_on_selector(sel, 'e=>e.value') != '': problems.append(f'{tag}: Feld nach 0,5 s nicht zurückgesetzt')
    await type_digits(pg, str(expected)); t = time.time()
    while 'ok' not in (await pg.eval_on_selector(sel, 'e=>e.className')):
        await pg.wait_for_timeout(20)
        if time.time() - t > 2: problems.append(f'{tag}: kein Grün'); break
    return time.time()
async def run_task(pg, level, x, y, path, wrong_step=None):
    tag = f'L{level} {x}+{y} {"→".join(path) if path else ""}'
    await pg.evaluate(f'__plusLernspielQA.startTaskForTest({level},{x},{y})')
    await pg.wait_for_timeout(800)
    z = await pg.evaluate('__plusLernspielQA.zr()')
    if z['covers']['yellow']['op'] != '0' or z['covers']['blue']['op'] != '0': problems.append(f'{tag}: zu früh abgedeckt')
    await pg.wait_for_timeout(1300)  # t≈2,1 s: Gelb abgedeckt, Blau sichtbar
    z = await pg.evaluate('__plusLernspielQA.zr()')
    if float(z['covers']['yellow']['op']) < 0.99: problems.append(f'{tag}: Gelb nicht abgedeckt')
    if not any(i['origin'] == 'blue' for i in z['items']): problems.append(f'{tag}: Blau nicht gezeigt')
    z = await wait_idle(pg)
    if float(z['covers']['blue']['op']) < 0.99: problems.append(f'{tag}: Blau nicht abgedeckt')
    check_board(tag + ' Start', z, x, y)
    if level == 4:
        await pg.wait_for_timeout(400); z = await pg.evaluate('__plusLernspielQA.zr()')
        if not z['mainVisible']: problems.append(f'{tag}: Ergebnisfeld fehlt')
        if float(z['covers']['green']['op']) < 0.99: problems.append(f'{tag}: Grün nach Animation nicht abgedeckt')
        if any(i['field'] != 'green' for i in z['items']): problems.append(f'{tag}: nicht alles im grünen Feld')
        t_green = await answer(pg, tag, x + y, wrong_first=wrong_step == 0)
    else:
        for n, label in enumerate(path):
            z = await wait_idle(pg)
            labels = [b['label'] for b in z['buttons']]
            if label not in labels: problems.append(f'{tag}: Button {label} fehlt in Schritt {n+1}: {labels}'); return
            # einen unpassenden Button testen: rot + Feld 1 s aufgedeckt, kein Fortschritt
            for b in labels:
                ok = await pg.evaluate(f"!!window.PlusGameCore.planByLabel(__plusLernspielQA.zr().state,'{b}')")
                if not ok:
                    await pg.click(f'[data-label="{b}"]'); await pg.wait_for_timeout(400)
                    z2 = await pg.evaluate('__plusLernspielQA.zr()')
                    peek = any(float(c['op']) < 0.5 for c in z2['covers'].values())
                    red = any(x_['wrong'] for x_ in z2['buttons'] if x_['label'] == b)
                    if not peek or not red or z2['state'] != z['state'] or not z2['choiceVisible']: problems.append(f'{tag}: Fehlwahl {b}: rot={red} aufgedeckt={peek}')
                    await pg.wait_for_timeout(1100)
                    z3 = await pg.evaluate('__plusLernspielQA.zr()')
                    if any(float(c['op']) < 0.99 for f, c in z3['covers'].items() if f != 'green' or n > 0): problems.append(f'{tag}: Abdeckung nach Fehlwahl nicht zurück')
                    break
            plan = json.loads(await pg.evaluate(f"JSON.stringify(window.PlusGameCore.planByLabel(__plusLernspielQA.zr().state,'{label}'))"))
            await pg.click(f'[data-label="{label}"]')
            if plan['moves']:
                await pg.wait_for_timeout(700)
                zg = await pg.evaluate('__plusLernspielQA.zr()')
                if float(zg['covers']['green']['op']) > 0.01: problems.append(f'{tag} Schritt {n+1}: Grün während der Bewegung abgedeckt')
            z = await wait_idle(pg); await pg.wait_for_timeout(400); z = await pg.evaluate('__plusLernspielQA.zr()')
            if z['active'] != 'step': problems.append(f'{tag}: kein Hilfsrechnungsfeld'); return
            if float(z['covers']['green']['op']) < 0.99: problems.append(f'{tag} Schritt {n+1}: Grün nicht abgedeckt')
            check_board(f'{tag} Schritt {n+1}', z, x, y)
            t_green = await answer(pg, f'{tag} Schritt {n+1}', plan['result'], wrong_first=wrong_step == n)
            if plan['final']:
                await pg.wait_for_timeout(700)
                z = await pg.evaluate('__plusLernspielQA.zr()')
                if z['mainValue'] != str(x + y) or not z['mainVisible']: problems.append(f'{tag}: Ergebnis nicht in die Startrechnung eingetragen')
    t = t_green
    while True:
        cur = await pg.evaluate('__plusLernspielQA.zr().task')
        if cur and (cur['x'], cur['y']) != (x, y): break
        await pg.wait_for_timeout(40)
        if time.time() - t > 4: problems.append(f'{tag}: keine neue Rechnung'); return
    dt = time.time() - t
    if not (1.2 < dt + 0.0 < 1.9): problems.append(f'{tag}: neue Rechnung nach {dt:.2f}s (erwartet ≈1,5 s ab Grün)')
async def worker(b, jobs, w, h):
    pg = await b.new_page(viewport={'width': w, 'height': h}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(300)
    for job in jobs:
        try: await run_task(pg, *job)
        except Exception as e: problems.append(f'{job}: Ausnahme {e}')
    if errs: problems.append(f'JS-Fehler: {errs[:3]}')
    await pg.close()
def all_paths(x, y, level):
    code = '''const C=require(process.argv[1]);const [x,y,l]=process.argv.slice(2).map(Number);const out=[];
    const walk=(st,i,p)=>{for(const o of C.validSteps(st)){if(o.final)out.push([...p,o.label]);else walk(o.next,i+1,[...p,o.label]);}};
    walk(C.initSteps(x,y),0,[]);console.log(JSON.stringify(out));'''
    return json.loads(subprocess.check_output(['node', '-e', code, GAME, str(x), str(y), str(level)]))
async def main():
    jobs = [(4, 34, 5, [], None), (4, 34, 20, [], 0), (4, 91, 8, [], None), (4, 19, 80, [], None)]
    for (lv, x, y) in [(5, 34, 25), (5, 18, 71), (6, 38, 37), (6, 38, 42), (6, 55, 45), (6, 19, 81)]:
        for k, pth in enumerate(all_paths(x, y, lv)):
            jobs.append((lv, x, y, pth, (k % 3) if k % 2 == 0 else None))
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'], **({'executable_path': '/usr/bin/google-chrome'} if pathlib.Path('/usr/bin/google-chrome').exists() else {}))
        n = 6
        await asyncio.gather(*[worker(b, jobs[i::n], *((1180, 820) if i % 2 == 0 else (820, 1180))) for i in range(n)])
        await b.close()
    print('Level 4–6 Fälle:', len(jobs))
    print('PROBLEME:', len(problems)); print('\n'.join(problems[:60]))
    sys.exit(1 if problems else 0)
asyncio.run(main())
