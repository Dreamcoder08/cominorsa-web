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
        await page.goto("http://localhost:3001")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Aceptar' button on the cookie/privacy banner, then click the 'Ver servicios' link to open the services list.
        # Aceptar button
        elem = page.get_by_role('button', name='Aceptar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Aceptar' button on the cookie/privacy banner, then click the 'Ver servicios' link to open the services list.
        # Ver servicios link
        elem = page.get_by_role('link', name='Ver servicios', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the service card titled '¿Tu operación aún no está formalizada?' from the services grid.
        # 01 ↗ ¿Tu operación aún no está formalizada?... link
        elem = page.locator('a[href="/igafom-reinfo"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Hablar por WhatsApp' button on the service details page to start a WhatsApp inquiry and verify a prefilled message appears.
        # Hablar por WhatsApp ↗ link
        elem = page.get_by_text('Conversemos por WhatsApp', exact=True).locator("xpath=ancestor-or-self::*[.//a][1]").get_by_role('link', name='Hablar por WhatsApp', exact=True)
        await elem.click(timeout=10000)
        
        # -> Switch to the 'IGAFOM y REINFO — Formalización' tab and verify the service details page (title and description) are visible.
        # Switch to tab CB80
        page = context.pages[-1]  # switch to most recently active tab
        
        # --> Assertions to verify final state
        
        # --> The IGAFOM y REINFO service details page is displayed (URL contains igafom-reinfo).
        # Assert-outcome: passed
        # Assert: The current page URL contains 'igafom-reinfo'.
        await expect(page).to_have_url(re.compile("igafom\\-reinfo"), timeout=15000), "The current page URL contains 'igafom-reinfo'."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    