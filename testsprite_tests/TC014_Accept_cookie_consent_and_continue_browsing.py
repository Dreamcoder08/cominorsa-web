import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:3002")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'ACEPTAR' button on the cookie banner to accept cookies.
        # Aceptar button
        elem = page.get_by_role('button', name='Aceptar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Scroll the homepage and confirm the 'Quiénes somos' section and the WhatsApp phone number '+51 910 728 575' are visible.
        await page.mouse.wheel(0, 300)
        
        # --> Assertions to verify final state
        
        # --> The header navigation link 'Nosotros' is visible on the homepage.
        await page.locator("xpath=/html/body/main/header/div/nav/a[1]").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The header 'Nosotros' navigation link is visible.
        await expect(page.locator("xpath=/html/body/main/header/div/nav/a[1]").nth(0)).to_be_visible(timeout=15000), "The header 'Nosotros' navigation link is visible."
        
        # --> The WhatsApp contact link with phone number +51 910 728 575 is present on the homepage.
        # Assert-outcome: passed
        # Assert: The WhatsApp contact link displays +51 910 728 575.
        await expect(page.locator("xpath=/html/body/main/section/div[2]/aside/div[2]/div/a[1]").nth(0)).to_have_text("+51 910 728 575", timeout=15000), "The WhatsApp contact link displays +51 910 728 575."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    