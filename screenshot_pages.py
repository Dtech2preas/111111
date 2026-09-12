from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.set_viewport_size({"width": 1280, "height": 800})

    # Take screenshot of landing page
    page.goto("http://localhost:8000/index.html")
    page.screenshot(path="landing_desktop.png")

    # mobile view
    page.set_viewport_size({"width": 375, "height": 667})
    page.screenshot(path="landing_mobile.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
