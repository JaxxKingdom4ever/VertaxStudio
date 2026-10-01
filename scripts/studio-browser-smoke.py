"""Optional, local end-user Chromium acceptance pass (does not save the project).

Run `npm run studio` in another terminal, then:
  python -m pip install playwright
  python -m playwright install chromium
  python scripts/studio-browser-smoke.py

This sandbox may refuse Chromium navigation with ERR_BLOCKED_BY_ADMINISTRATOR;
this script is intentionally not part of npm test until the environment permits it.
"""
from __future__ import annotations
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get('VERTAX_STUDIO_URL', 'http://127.0.0.1:4173/')

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page_errors: list[str] = []
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    page.goto(URL, wait_until='networkidle')
    page.locator('#vertax-studio[data-mounted="true"]').wait_for()

    # A real graph gesture, a shelf addition, a typed edit, and Undo/Redo.
    page.get_by_role('button', name='Morphology', exact=True).click()
    node = page.locator('#graph-canvas .graph-node').first
    start = node.get_attribute('transform')
    rect = node.bounding_box()
    assert rect, 'Morphology graph has no visible node'
    page.mouse.move(rect['x'] + 40, rect['y'] + 28)
    page.mouse.down()
    page.mouse.move(rect['x'] + 90, rect['y'] + 60, steps=5)
    page.mouse.up()
    assert page.locator('#graph-canvas .graph-node').first.get_attribute('transform') != start, 'Node drag did not move'

    page.locator('#graph-canvas').focus()
    page.keyboard.press('Space')
    page.locator('.node-shelf-search').fill('select allomorph')
    page.get_by_role('button', name='Select allomorph').click()
    panel = page.locator('#inspector-panel')
    panel.get_by_label('Candidate rules').fill('[{"form":"went","when":{"tense":"past"}},{"form":"go","fallback":true}]')
    panel.get_by_label('Candidate rules').dispatch_event('change')
    assert 'Select allomorph' in panel.inner_text(), 'Typed parameter editor did not show selected node'
    page.get_by_role('button', name='Undo', exact=True).click()
    page.get_by_role('button', name='Redo', exact=True).click()

    # Sentence Lab and translation workspaces must remain operational.
    page.get_by_role('button', name='Sentence Lab', exact=True).click()
    page.get_by_role('button', name='▶ Compile confirmed meaning').click()
    assert page.locator('#sentence-lab-workspace').is_visible()
    page.get_by_role('button', name='Analysis / Translation').click()
    page.get_by_label('Source language').select_option('english-pack')
    page.get_by_label('Target language').select_option('reference-conlang')
    page.get_by_label('Source sentence').fill('The person cooks the food.')
    page.get_by_role('button', name='Analyze and translate').click()
    page.locator('.translation-surface').get_by_text('person cook food').wait_for()
    assert not page_errors, f'Browser console errors: {page_errors}'
    print('PASS: graph drag, shelf, Inspector, undo/redo, Sentence Lab, and translation')
    browser.close()
