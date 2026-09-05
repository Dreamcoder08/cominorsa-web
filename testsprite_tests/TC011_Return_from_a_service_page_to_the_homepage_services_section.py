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
        
        # -> Open the 'IGAFOM' service page (the IGAFOM/REINFO service) by navigating to its service URL.
        await page.goto("http://localhost:3002/igafom-reinfo")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'ver todos los servicios' link to return to the full services section.
        # ver todos los servicios link
        elem = page.get_by_role('link', name='ver todos los servicios', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Aceptar' button on the cookie/privacy banner to dismiss it and confirm that the 'Especialidades' services section is visible on the homepage.
        # Aceptar button
        elem = page.get_by_role('button', name='Aceptar', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Returned to the homepage services section (URL includes '#servicios').
        # Assert-outcome: passed
        # Assert: Page URL contains '#servicios', indicating the services section anchor.
        await expect(page).to_have_url(re.compile("\\#servicios"), timeout=15000), "Page URL contains '#servicios', indicating the services section anchor."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    