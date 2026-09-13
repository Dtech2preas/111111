from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    context = browser.new_context()
    page = context.new_page()

    # Authenticate as a manager instead to draw a wall
    page.goto("http://localhost:8000/index.html")
    page.evaluate("localStorage.setItem('dtech_user_role', 'manager'); localStorage.setItem('dtech_residence_id', 'test_res'); localStorage.setItem('dtech_floorplan_v2_floor_0', JSON.stringify({walls: [{id: 'w1', start: {x: 200, y: 200}, end: {x: 400, y: 400}, thickness: 15}]}))")

    page.goto("http://localhost:8000/editor.html")
    page.wait_for_timeout(2000)
    page.screenshot(path="manager_editor.png")

    # Test 3D as manager
    page.goto("http://localhost:8000/test3d.html")
    page.wait_for_timeout(2000)
    page.screenshot(path="manager_test3d.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
