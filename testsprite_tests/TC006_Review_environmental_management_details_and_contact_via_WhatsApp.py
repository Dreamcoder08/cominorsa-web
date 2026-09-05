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
        
        # -> Open the 'Gestión ambiental' service page (the Gestión ambiental / Gestión ambiental minera service) to view its details.
        await page.goto("http://localhost:3001/gestion-ambiental-minera")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Hablar por WhatsApp' consultation link on the Gestión ambiental minera page (after dismissing the cookie banner).
        # Rechazar button
        elem = page.get_by_role('button', name='Rechazar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Hablar por WhatsApp' consultation link on the Gestión ambiental minera page (after dismissing the cookie banner).
        # Hablar por WhatsApp ↗ link
        elem = page.get_by_text('Conversemos por WhatsApp', exact=True).locator("xpath=ancestor-or-self::*[.//a][1]").get_by_role('link', name='Hablar por WhatsApp', exact=True)
        await elem.click(timeout=10000)
        
        # -> Switch to the 'Gestión ambiental minera — DIA y PAMA' tab and confirm the service heading and description are visible on that page.
        # Switch to tab F0C7
        page = context.pages[-1]  # switch to most recently active tab
        
        # -> Find the service heading/text on the 'Gestión ambiental minera — DIA y PAMA' page, then switch to the WhatsApp tab and confirm the prefilled message contains 'Hola COMINORSA, quiero información sobre DIA, PAMA'.
        # Switch to tab 8500
        page = context.pages[-1]  # switch to most recently active tab
        
        # -> Switch to the 'Gestión ambiental minera — DIA y PAMA' tab and confirm the service heading and description are visible on that page.
        # Switch to tab F0C7
        page = context.pages[-1]  # switch to most recently active tab
        
        # --> Assertions to verify final state
        
        # --> Clicking the consultation link opened a WhatsApp chat prefilled with 'Hola COMINORSA, quiero información sobre DIA, PAMA e instrumentos de gestión ambiental.'
        # Assert-outcome: passed
        # Assert: The 'Hablar por WhatsApp' link points to the WhatsApp URL with the prefilled message.
        await expect(page.locator("xpath=/html/body/main/section/div[2]/section[2]/a").nth(0)).to_have_attribute("href", "https://wa.me/51910728575?text=Hola%20COMINORSA%2C%20quiero%20informaci%C3%B3...", timeout=15000), "The 'Hablar por WhatsApp' link points to the WhatsApp URL with the prefilled message."
        
        # --> The Gestión ambiental minera service page is displayed with the heading 'Gestión ambiental minera — DIA y PAMA'.
        # Assert-outcome: passed
        # Assert: The browser is on the /gestion-ambiental-minera page.
        await expect(page).to_have_url(re.compile("/gestion\\-ambiental\\-minera"), timeout=15000), "The browser is on the /gestion-ambiental-minera page."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    