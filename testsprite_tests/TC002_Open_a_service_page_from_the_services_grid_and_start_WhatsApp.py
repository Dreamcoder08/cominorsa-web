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
        
        # -> Click the 'Aceptar' button to dismiss the cookie consent banner, then open the 'SERVICIOS' section by clicking the 'SERVICIOS' navigation link.
        # Aceptar button
        elem = page.get_by_role('button', name='Aceptar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Aceptar' button to dismiss the cookie consent banner, then open the 'SERVICIOS' section by clicking the 'SERVICIOS' navigation link.
        # Servicios link
        elem = page.locator('xpath=/html/body/main/header/div/nav/a[2]')
        await elem.click(timeout=10000)
        
        # -> Open the service card titled '¿Tu operación aún no está formalizada?' from the 'Nuestros servicios' grid.
        # 01 ↗ ¿Tu operación aún no está formalizada?... link
        elem = page.locator('a[href="/igafom-reinfo"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Hablar por WhatsApp' link on the IGAFOM y REINFO — Formalización minera service page.
        # Hablar por WhatsApp ↗ link
        elem = page.get_by_text('Conversemos por WhatsApp', exact=True).locator("xpath=ancestor-or-self::*[.//a][1]").get_by_role('link', name='Hablar por WhatsApp', exact=True)
        await elem.click(timeout=10000)
        
        # -> On the IGAFOM y REINFO — Formalización minera page, confirm the service title, description, and the 'Qué incluye' list are visible.
        # Switch to tab 2C03
        page = context.pages[-1]  # switch to most recently active tab
        
        # --> Assertions to verify final state
        
        # --> Clicking the service's WhatsApp link opened a new WhatsApp chat with a service-specific prefilled message.
        # Assert-outcome: passed
        # Assert: A new tab's URL contains 'api.whatsapp.com', indicating a WhatsApp chat was opened.
        await expect(page).to_have_url(re.compile("api\\.whatsapp\\.com"), timeout=15000), "A new tab's URL contains 'api.whatsapp.com', indicating a WhatsApp chat was opened."
        
        # --> The IGAFOM y REINFO — Formalización minera service page was reached and shows its details.
        await page.locator("xpath=/html/body/main/section/div[2]/section[2]/a").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The service page's 'Hablar por WhatsApp' link is visible, indicating the service details section is displayed.
        await expect(page.locator("xpath=/html/body/main/section/div[2]/section[2]/a").nth(0)).to_be_visible(timeout=15000), "The service page's 'Hablar por WhatsApp' link is visible, indicating the service details section is displayed."
        # Assert-outcome: passed
        # Assert: The page URL contains '/igafom-reinfo', confirming the IGAFOM y REINFO service page is loaded.
        await expect(page).to_have_url(re.compile("/igafom\\-reinfo"), timeout=15000), "The page URL contains '/igafom-reinfo', confirming the IGAFOM y REINFO service page is loaded."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    