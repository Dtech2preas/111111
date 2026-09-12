from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    # Take screenshot of auth section on desktop
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto("http://localhost:8000/index.html")
    page.click("button[data-role='manager']")
    page.screenshot(path="auth_desktop.png")

    # auth section on mobile
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto("http://localhost:8000/index.html")
    page.click("button[data-role='manager']")
    page.screenshot(path="auth_mobile.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
