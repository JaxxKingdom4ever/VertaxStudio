"""Optional real-browser smoke: python scripts/browser-english-analysis-smoke.py.

Requires Python playwright and a Chromium executable. Build with npm run studio:build first.
This test does not mutate .vertax projects and is deliberately outside the portable npm suite.
"""
from __future__ import annotations
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 45100 + os.getpid() % 2000
BASE = f"http://127.0.0.1:{PORT}"

def ensure_server_up() -> None:
    for _ in range(80):
        try:
            with urllib.request.urlopen(BASE, timeout=0.2) as res:
                if res.status == 200:
                    return
        except Exception:
            time.sleep(0.1)
    raise AssertionError("Studio server did not start")

server = subprocess.Popen(
    ["node", "apps/studio/server.mjs"], cwd=ROOT,
    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
    env={**os.environ, "PORT": str(PORT)}, text=True
)
try:
    ensure_server_up()
    with sync_playwright() as p:
        browser_bin = os.environ.get("VERTAX_CHROMIUM_BIN", "/usr/bin/chromium")
        browser = p.chromium.launch(executable_path=browser_bin if Path(browser_bin).exists() else None,
                                    headless=True, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1366, "height": 900})
        errors: list[str] = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.goto(BASE, wait_until="networkidle")
        page.get_by_role("button", name="Analysis / Translation").click()
        page.get_by_label("Source language").select_option("english-pack")
        source = page.get_by_label("Source sentence")
        source.fill("The happy small girl saw the boy.")
        page.get_by_role("button", name="Analyze only").click()
        page.locator(".translation-status").get_by_text("Analysis completed.").wait_for(timeout=10000)
        graph = json.loads(page.locator(".translation-meaning").inner_text())
        event = graph["objects"][graph["roots"][0]]
        assert event["conceptId"] == "sem:event.see"
        assert len(graph["objects"][event["roles"]["agent"][0]]["roles"]["quality"]) == 2
        assert page.locator(".translation-surface").inner_text() == ""

        source.fill("The girl saw the boy with the telescope.")
        page.get_by_role("button", name="Analyze only").click()
        page.locator(".translation-status").get_by_text("2 meanings found.").wait_for(timeout=10000)
        assert page.locator(".translation-candidates button").count() == 2
        page.locator(".translation-candidates button").first.click()
        assert 'sem:entity.telescope' in page.locator('.translation-meaning').inner_text()

        source.fill("The girls sees the boy.")
        page.get_by_role("button", name="Analyze only").click()
        page.locator(".translation-status").get_by_text("NO_ANALYSIS_CANDIDATES", exact=False).wait_for(timeout=10000)
        assert not errors, f"Browser JavaScript errors: {errors}"
        print("Chromium smoke PASS: analysis, ambiguity, no-match diagnostics, no browser JS errors")
        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=3)
    except subprocess.TimeoutExpired:
        server.kill()
