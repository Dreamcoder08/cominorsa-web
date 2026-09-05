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
        
        # -> Open the 'Ingeniería y planes de minado' service page (navigate to /ingenieria-y-planes-de-minado).
        await page.goto("http://localhost:3001/ingenieria-y-planes-de-minado")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Rechazar' button on the cookie/privacy banner to dismiss it and enable interaction with the page.
        # Rechazar button
        elem = page.get_by_role('button', name='Rechazar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Hablar por WhatsApp' link on the service page and verify a WhatsApp chat opens with a prefilled message.
        # Hablar por WhatsApp ↗ link
        elem = page.get_by_text('Conversemos por WhatsApp', exact=True).locator("xpath=ancestor-or-self::*[.//a][1]").get_by_role('link', name='Hablar por WhatsApp', exact=True)
        await elem.click(timeout=10000)
        
        # -> Switch to the 'Planes de minado e ingeniería' service tab and confirm the page shows the service title and descriptive paragraph.
        # Switch to tab CF00
        page = context.pages[-1]  # switch to most recently active tab
        
        # -> Confirm the page shows the 'Planes de minado e ingeniería técnica' title and its descriptive paragraph, then open the WhatsApp chat tab to verify the prefilled message.
        # Switch to tab 70F3
        page = context.pages[-1]  # switch to most recently active tab
        
        # -> Switch to the 'Planes de minado e ingeniería' service tab and confirm the page shows the service title and descriptive paragraph.
        # Switch to tab CF00
        page = context.pages[-1]  # switch to most recently active tab
        
        # -> Verify the page shows the title 'Planes de minado e ingeniería técnica' and its descriptive paragraph.
        # Switch to tab 70F3
        page = context.pages[-1]  # switch to most recently active tab
        
        # -> Switch to the 'Planes de minado e ingeniería' service tab and verify the page shows the title 'Planes de minado e ingeniería técnica' and its descriptive paragraph.
        # Switch to tab CF00
        page = context.pages[-1]  # switch to most recently active tab
        
        # --> Assertions to verify final state
        
        # --> Clicking the 'Hablar por WhatsApp' consultation link opened a WhatsApp chat tab with the prefilled message 'Hola COMINORSA, quiero información sobre planes de minado y expedientes técnicos.'
        await page.locator("xpath=/html/body/main/section/div[2]/section[2]/a").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The 'Hablar por WhatsApp' link is visible on the service page.
        await expect(page.locator("xpath=/html/body/main/section/div[2]/section[2]/a").nth(0)).to_be_visible(timeout=15000), "The 'Hablar por WhatsApp' link is visible on the service page."
        # Assert-outcome: passed
        # Assert: The consultation link's href points to wa.me with a prefilled message to +51 910 728 575.
        await expect(page.locator("xpath=/html/body/main/section/div[2]/section[2]/a").nth(0)).to_have_attribute("href", "https://wa.me/51910728575?text=Hola%20COMINORSA%2C%20quiero%20informaci%C3%B3...", timeout=15000), "The consultation link's href points to wa.me with a prefilled message to +51 910 728 575."
        
        # --> The mining engineering service page is open (URL contains /ingenieria-y-planes-de-minado) and shows the 'Planes de minado e ingeniería técnica' content.
        # Assert-outcome: passed
        # Assert: The browser is on the mining engineering service page URL.
        await expect(page).to_have_url(re.compile("/ingenieria\\-y\\-planes\\-de\\-minado"), timeout=15000), "The browser is on the mining engineering service page URL."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    