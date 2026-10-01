"""Chromium UI smoke without navigation, for locked-down CI sandboxes.

Loads the actual Studio HTML/CSS and the compiled browser module closure into
about:blank. API requests are proxied to a real local Studio server by the
Playwright host (Chromium itself cannot navigate to localhost here).
This is a browser interaction test, NOT an HTTP navigation smoke test.

Run after `npm run studio:build`:
  node scripts/studio-offline-bundle.mjs
  python scripts/studio-browser-injected-smoke.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = Path(os.environ.get('VERTAX_BROWSER_BUNDLE', str(ROOT / '.studio-browser-bootstrap.js')))
SCREENSHOT = Path(os.environ.get('VERTAX_BROWSER_SCREENSHOT', str(ROOT / '.studio-browser-screenshot.png')))
HTML = (ROOT / 'apps/studio/public/index.html').read_text()
CSS = (ROOT / 'apps/studio/public/studio.css').read_text()
HTML = re.sub(r'<script\s+type="module"\s+src="/apps/studio/src/main\.js"></script>', '', HTML)


def browser_smoke():
    with tempfile.TemporaryDirectory(prefix='vertax-chromium-') as temp_dir:
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        env = dict(os.environ, PORT=str(port), VERTAX_STUDIO_PROJECT=str(Path(temp_dir) / 'smoke.vertax'))
        server_log = Path(temp_dir) / 'studio-server.log'
        with server_log.open('w') as output:
            server = subprocess.Popen(['node', 'apps/studio/server.mjs'], cwd=ROOT, env=env, stdout=output, stderr=output)
            try:
                base = f'http://127.0.0.1:{port}'
                for _ in range(100):
                    try:
                        with urlopen(base + '/', timeout=.5) as response:
                            if response.status == 200:
                                break
                    except Exception:
                        if server.poll() is not None:
                            raise RuntimeError('Studio server exited: ' + server_log.read_text())
                        time.sleep(.05)
                else:
                    raise RuntimeError('Studio server did not start: ' + server_log.read_text())

                for path in ['/studio.css', '/apps/studio/src/main.js']:
                    with urlopen(base + path,timeout=2) as response:
                        assert response.status == 200, f'Studio asset {path} unavailable'
                print('PASS: Studio server serves HTML, CSS, and emitted browser entrypoint')

                def server_request(request):
                    path = request['path']
                    if not isinstance(path, str) or not path.startswith('/api/'):
                        raise ValueError('Only local Studio API paths may be proxied')
                    data = request.get('body')
                    payload = data.encode('utf8') if data is not None else None
                    req = Request(base + path, data=payload, method=request.get('method','GET'),headers=request.get('headers') or {})
                    try:
                        with urlopen(req,timeout=15) as resp:
                            return {'status':resp.status, 'body':resp.read().decode('utf8')}
                    except HTTPError as err:
                        return {'status':err.code,'body':err.read().decode('utf8')}

                with sync_playwright() as playwright:
                    browser = playwright.chromium.launch(executable_path=os.environ.get('VERTAX_CHROMIUM', '/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
                    try:
                        page = browser.new_page(viewport={'width': 1440, 'height': 900},accept_downloads=True)
                        errors = []
                        page.on('pageerror', lambda error: errors.append(str(error)))
                        page.expose_function('vertaxProxyFetch',server_request)
                        page.set_content(HTML)
                        page.add_style_tag(content=CSS)
                        page.add_script_tag(content='''
                          window.fetch=async function(url, options={}) {
                            const result=await window.vertaxProxyFetch({
                              path:String(url),method:options.method||'GET',
                              headers:options.headers||{},body:options.body??null
                            });
                            return new Response(result.body,{status:result.status,headers:{'content-type':'application/json'}});
                          };
                        ''')
                        page.add_script_tag(content=BUNDLE.read_text())
                        page.locator('#vertax-studio[data-mounted="true"]').wait_for(timeout=10000)
                        print('MOUNTED',page.locator('body').inner_text()[:140].replace('\n',' | '))
                        # Real browser gestures, not synthetic DOM events.
                        page.get_by_role('button', name='Morphology', exact=True).click()
                        node = page.locator('#graph-canvas .graph-node').first
                        previous = node.get_attribute('transform')
                        rect = node.bounding_box()
                        assert rect, 'No visible graph node to drag'
                        page.mouse.move(rect['x']+100, rect['y']+47)
                        page.mouse.down()
                        page.mouse.move(rect['x']+160, rect['y']+86, steps=7)
                        page.mouse.up()
                        moved = page.locator('#graph-canvas .graph-node').first.get_attribute('transform')
                        assert moved != previous, f'Graph drag was not committed: {previous}'
                        page.get_by_role('button', name='Undo', exact=True).click()
                        assert page.locator('#graph-canvas .graph-node').first.get_attribute('transform') == previous, 'Undo lost graph layout'
                        page.get_by_role('button', name='Redo', exact=True).click()
                        assert page.locator('#graph-canvas .graph-node').first.get_attribute('transform') == moved, 'Redo lost graph layout'
                        print('PASS: graph pointer drag / undo / redo')

                        page.locator('#graph-canvas').focus()
                        page.keyboard.press('Space')
                        page.locator('.node-shelf-search').fill('select allomorph')
                        page.get_by_role('button', name='Select allomorph').click()
                        inspector = page.locator('#inspector-panel')
                        inspector.get_by_label('Candidate rules').fill('[{"form":"went","when":{"tense":"past"}},{"form":"go","fallback":true}]')
                        inspector.get_by_label('Candidate rules').dispatch_event('change')
                        assert 'Select allomorph' in inspector.inner_text(), 'Inspector lost the inserted node'
                        assert page.locator('.graph-node').count() >= 2, 'Node Shelf did not add a node'
                        status_after_edit=page.locator('#status-bar').inner_text()
                        assert 'Failed to execute' not in status_after_edit, 'Chromium native DOM failure after editing parameters'
                        print('PASS: Node Shelf insertion / typed Inspector parameters')

                        # Wire two compatible morph ports with a real mouse gesture.
                        output_port=page.locator('#graph-canvas .graph-node').first.locator('.port-socket.output[data-port-id="value"]')
                        input_port=page.locator('#graph-canvas .graph-node.selected .port-socket.input[data-port-id="value"]')
                        source_rect=output_port.bounding_box()
                        target_rect=input_port.bounding_box()
                        assert source_rect and target_rect, 'Cannot find both on-screen morph sockets'
                        before_edges=page.locator('#graph-canvas .graph-edge').count()
                        page.mouse.move(source_rect['x']+source_rect['width']/2,source_rect['y']+source_rect['height']/2)
                        page.mouse.down()
                        page.mouse.move(target_rect['x']+target_rect['width']/2,target_rect['y']+target_rect['height']/2,steps=9)
                        page.mouse.up()
                        assert page.locator('#graph-canvas .graph-edge').count()==before_edges+1,'Port-to-port connection was not created'
                        print('PASS: real pointer-based morphology port connection')

                        # Pan the empty canvas and check the viewport transform changes.
                        svg=page.locator('#graph-canvas .graph-svg')
                        canvas_rect=svg.bounding_box()
                        viewport_before=page.locator('#graph-canvas .graph-svg > g').get_attribute('transform')
                        assert canvas_rect, 'No visible graph canvas'
                        page.mouse.move(canvas_rect['x']+canvas_rect['width']-45,canvas_rect['y']+canvas_rect['height']-45)
                        page.mouse.down()
                        page.mouse.move(canvas_rect['x']+canvas_rect['width']-95,canvas_rect['y']+canvas_rect['height']-100,steps=7)
                        page.mouse.up()
                        viewport_after=page.locator('#graph-canvas .graph-svg > g').get_attribute('transform')
                        assert viewport_after!=viewport_before,'Canvas pan did not update the viewport'
                        print('PASS: canvas pan from blank SVG space')
                        breadcrumb_background=page.locator('.studio-breadcrumbs').evaluate('(el)=>getComputedStyle(el).backgroundColor')
                        assert breadcrumb_background!='rgba(0, 0, 0, 0)','Breadcrumb needs an opaque backdrop when graph nodes pan underneath it'

                        # Port labels on opposite sides must not intersect in Chrome.
                        overlaps = page.locator('#graph-canvas .graph-node').first.evaluate("""node=>{
                          const labels=[...node.querySelectorAll('text.port-label')];
                          return labels.flatMap((label,i)=>labels.slice(i+1).filter(other=>{
                            const a=label.getBoundingClientRect(),b=other.getBoundingClientRect();
                            return a.width>0&&b.width>0&&a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
                          }).map(other=>[label.textContent,other.textContent]));
                        }""")
                        assert not overlaps, f'Overlapping node port labels: {overlaps}'
                        page.screenshot(path=str(SCREENSHOT), full_page=True)

                        page.get_by_role('button', name='Analysis / Translation', exact=True).click()
                        page.get_by_label('Source language').select_option('english-pack')
                        page.get_by_label('Target language').select_option('reference-conlang')
                        page.get_by_label('Source sentence').fill('The person cooks the food.')
                        page.get_by_role('button', name='Analyze and translate').click()
                        page.locator('.translation-surface').get_by_text('person cook food').wait_for(timeout=25000)
                        print('PASS: Studio translation English → reference conlang')
                        page.get_by_label('Source sentence').fill('I saw the man with the telescope.')
                        page.get_by_role('button', name='Analyze and translate').click()
                        page.get_by_text('Choose one of the meanings below.').wait_for(timeout=25000)
                        assert page.locator('.translation-candidates button').count() >= 2, 'Source ambiguity lost'
                        print('PASS: ambiguous meanings require selection')
                        page.get_by_role('button', name='Open target pack in Graph Studio').click()
                        page.wait_for_function("() => document.querySelector('#status-bar')?.textContent?.includes('Opened ')",timeout=15000)
                        page.locator('.studio-toolbar').get_by_role('button', name='Grammar', exact=True).click()
                        assert page.locator('#graph-canvas .graph-node').count() > 0, 'Opening real pack lost its graph'
                        print('PASS: open persisted language pack in Graph Studio')

                        # A real authoring pass for sound-rule controls and the orthographic table selector.
                        page.locator('.studio-toolbar').get_by_role('button', name='Phonology', exact=True).click()
                        page.locator('#graph-canvas').focus()
                        page.keyboard.press('Space')
                        page.locator('.node-shelf-search').fill('assimilate')
                        page.get_by_role('button', name='Assimilate').click()
                        phon_inspector = page.locator('#inspector-panel')
                        phon_inspector.get_by_label('Target phoneme').fill('n')
                        phon_inspector.get_by_label('Target phoneme').dispatch_event('change')
                        phon_inspector.get_by_label('Target:neighbor → replacement').fill('{"n:p":"m"}')
                        phon_inspector.get_by_label('Target:neighbor → replacement').dispatch_event('change')
                        phon_inspector.get_by_label('Neighbor side').select_option('left')
                        assert phon_inspector.get_by_label('Target phoneme').input_value() == 'n'
                        assert phon_inspector.get_by_label('Neighbor side').input_value() == 'left'
                        assert json.loads(phon_inspector.get_by_label('Target:neighbor → replacement').input_value()) == {'n:p':'m'}
                        print('PASS: phonology rule insertion / contextual JSON / typed option')
                        phon_inspector.get_by_role('button', name='Delete node').click()

                        page.locator('.studio-toolbar').get_by_role('button', name='Surface', exact=True).click()
                        page.locator('#graph-canvas').focus()
                        page.keyboard.press('Space')
                        page.locator('.node-shelf-search').fill('spell phonemes')
                        page.get_by_role('button', name='Spell phonemes').click()
                        spelling = page.locator('#inspector-panel').get_by_label('Spelling table')
                        assert spelling.count() == 1, 'Surface table picker not rendered'
                        assert spelling.locator('option').count() == 1, 'No data tables exist in this pack: picker must only show (none)'
                        print('PASS: Surface spelling table picker excludes unavailable resources')
                        page.locator('#inspector-panel').get_by_role('button', name='Delete node').click()

                        page.locator('.studio-toolbar').get_by_role('button', name='Sentence Lab', exact=True).click()
                        page.get_by_role('button', name='▶ Compile confirmed meaning').click()
                        assert page.locator('#sentence-lab-workspace').is_visible()
                        final = page.locator('.lab-final').inner_text(timeout=1500)
                        assert 'person' in final and 'cook' in final, f'Sentence Lab did not generate a sentence: {final}'
                        print('PASS: Sentence Lab compiled confirmed meaning →', final)

                        composer = page.locator('#sentence-lab-workspace .lab-composer')
                        composer.locator('.composer-view-tabs').get_by_role('button', name='Tree', exact=True).click()
                        assert composer.locator('.meaning-tree-node').count() >= 3, 'Meaning Tree dropped semantic relations'
                        assert 'agent → agent' in composer.locator('.meaning-tree').inner_text(), 'Agent role not present in Meaning Tree'
                        composer.locator('.composer-view-tabs').get_by_role('button', name='Graph', exact=True).click()
                        assert composer.locator('.meaning-graph svg g').count() >= 3, 'Meaning Graph dropped nodes'
                        assert composer.locator('.meaning-graph svg line').count() >= 2, 'Meaning Graph dropped semantic edges'
                        composer.locator('.meaning-graph svg g').filter(has_text='agent').first.click()
                        concept = composer.get_by_label('Concept ID')
                        assert concept.input_value() == 'sem:entity.person', 'Selecting Graph node did not open its Form'
                        concept.fill('sem:entity.food')
                        concept.press('Tab')
                        page.get_by_role('button', name='▶ Compile confirmed meaning').click()
                        changed = page.locator('.lab-final').inner_text()
                        assert changed != final and 'food' in changed, f'Editing the confirmed MeaningGraph did not affect generation: {changed}'
                        composer.get_by_label('Concept ID').fill('sem:entity.person')
                        composer.get_by_label('Concept ID').press('Tab')
                        page.get_by_role('button', name='▶ Compile confirmed meaning').click()
                        assert page.locator('.lab-final').inner_text() == final, 'Meaning edit did not round-trip through the same Form/Tree/Graph state'
                        print('PASS: Meaning Composer Form / Tree / Graph round-trip changes compilation authority')

                        for tab in ['Gloss','Structure','Trace']:
                            page.locator('.lab-output-tabs').get_by_role('button', name=tab, exact=True).click()
                            assert page.locator('.lab-result-body').inner_text().strip(), f'Sentence Lab {tab} view is empty'
                        assert page.locator('.trace-timeline .trace-step').count() > 0, 'Trace panel does not expose compiler execution frames'
                        assert 'Scope tree' in page.locator('.lab-result-body').inner_text(), 'Trace frame has no scope inspection'
                        page.locator('.lab-output-tabs').get_by_role('button', name='Final', exact=True).click()
                        assert page.locator('.lab-final .lab-trace-span').count() > 0, 'Final text lacks provenance spans'
                        assert any('Sources:' in title for title in page.locator('.lab-final .lab-trace-span').evaluate_all('(nodes)=>nodes.map(n=>n.title)')), 'Final text lacks semantic source provenance'
                        page.get_by_label('Name of saved sentence test').fill('Browser-confirmed semantic round trip')
                        page.get_by_role('button', name='Save as test').click()
                        page.get_by_text('Saved test browser-confirmed-semantic-round-trip.').wait_for(timeout=10000)
                        print('PASS: Sentence Lab output tabs, trace frames, and persisted test authoring')

                        with page.expect_download(timeout=10000) as pending:
                            page.get_by_role('button', name='Export', exact=True).click()
                        download = pending.value
                        assert download.suggested_filename.endswith('.vertax.json')
                        exported = Path(temp_dir) / download.suggested_filename
                        download.save_as(str(exported))
                        with page.expect_file_chooser(timeout=10000) as chooser:
                            page.get_by_role('button', name='Import', exact=True).click()
                        chooser.value.set_files(str(exported))
                        page.get_by_text('Project imported').wait_for(timeout=10000)
                        print('PASS: browser project export / import')
                        page.get_by_role('button', name='Save', exact=True).click()
                        page.get_by_text('Saved to local .vertax workspace').wait_for(timeout=10000)
                        assert (Path(temp_dir) / 'smoke.vertax' / 'project.json').exists(), 'Studio did not persist the imported project'
                        assert (Path(temp_dir) / 'smoke.vertax' / 'tests' / 'browser-confirmed-semantic-round-trip.json').exists(), 'Saved Sentence Lab test did not survive export / import / Save'
                        print('PASS: Studio Save persisted the project and newly authored semantic test')
                        persisted = subprocess.run(['node','dist/apps/cli/src/main.js','test-project',str(Path(temp_dir) / 'smoke.vertax')], cwd=ROOT, capture_output=True, text=True, timeout=60)
                        assert persisted.returncode == 0, 'The saved project no longer passes its executable corpus: ' + persisted.stderr + persisted.stdout
                        assert '60/60 passed' in persisted.stdout, 'Saved browser-authored test did not execute alongside original 59 tests: ' + persisted.stdout
                        print('PASS: saved and reimported project executes its original corpus plus browser-authored test')
                        assert not errors, 'Browser page errors: ' + json.dumps(errors)
                        print('PASS: full injected Chromium workflow, no page errors')
                    finally:
                        browser.close()
            finally:
                server.terminate()
                try:server.wait(timeout=5)
                except subprocess.TimeoutExpired:server.kill();server.wait()


if __name__ == '__main__':
    browser_smoke()
