from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    context = browser.new_context()

    # Authenticate as student
    page = context.new_page()
    page.goto("http://localhost:8000/index.html")
    # Actually, we can use the spoofing trick:
    page.evaluate("localStorage.setItem('dtech_guest_mode', 'true'); localStorage.setItem('dtech_user_role', 'student'); localStorage.setItem('dtech_residence_id', 'test_res');")

    # Check 2D editor
    page.goto("http://localhost:8000/editor.html?readonly=true")
    page.wait_for_timeout(2000)
    page.screenshot(path="student_editor_2d.png", full_page=True)

    # Check 3D viewer
    page.goto("http://localhost:8000/test3d.html?readonly=true")
    page.wait_for_timeout(2000)
    page.screenshot(path="student_test3d.png", full_page=True)

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
