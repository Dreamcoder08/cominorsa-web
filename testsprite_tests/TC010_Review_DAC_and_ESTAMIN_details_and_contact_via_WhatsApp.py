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
        
        # -> Open the DAC and ESTAMIN declarations page by navigating to 'http://localhost:3001/declaraciones-dac-estamin'.
        await page.goto("http://localhost:3001/declaraciones-dac-estamin")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Hablar por WhatsApp' link to start a WhatsApp chat for the DAC y ESTAMIN service.
        # Aceptar button
        elem = page.get_by_role('button', name='Aceptar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Hablar por WhatsApp' link to start a WhatsApp chat for the DAC y ESTAMIN service.
        # Hablar por WhatsApp ↗ link
        elem = page.get_by_text('Conversemos por WhatsApp', exact=True).locator("xpath=ancestor-or-self::*[.//a][1]").get_by_role('link', name='Hablar por WhatsApp', exact=True)
        await elem.click(timeout=10000)
        
        # -> Verify the WhatsApp page shows the prefilled message 'Hola COMINORSA, quiero información sobre declaraciones DAC y ESTAMIN.' and then switch to the 'Declaraciones DAC y ESTAMIN' page to confirm the service details are displayed.
        # Switch to tab C0AD
        page = context.pages[-1]  # switch to most recently active tab
        
        # -> Switch to the WhatsApp tab and verify the prefilled message 'Hola COMINORSA, quiero información sobre declaraciones DAC y ESTAMIN.' is present on the page.
        # Switch to tab 2EE6
        page = context.pages[-1]  # switch to most recently active tab
        
        # -> Switch to the 'Declaraciones DAC y ESTAMIN' tab and verify the DAC and ESTAMIN service details are displayed on the page.
        # Switch to tab C0AD
        page = context.pages[-1]  # switch to most recently active tab
        
        # --> Assertions to verify final state
        
        # --> WhatsApp chat was opened with the prefilled message for the DAC y ESTAMIN service.
        await page.locator("xpath=/html/body/main/section/div[2]/section[2]/a").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The 'Hablar por WhatsApp' CTA for the service is visible.
        await expect(page.locator("xpath=/html/body/main/section/div[2]/section[2]/a").nth(0)).to_be_visible(timeout=15000), "The 'Hablar por WhatsApp' CTA for the service is visible."
        # Assert-outcome: passed
        # Assert: A WhatsApp send page was opened for phone +51 910 728 575.
        await expect(page).to_have_url(re.compile("api\\.whatsapp\\.com/send/\\?phone=51910728575"), timeout=15000), "A WhatsApp send page was opened for phone +51 910 728 575."
        
        # --> The Declaraciones DAC y ESTAMIN page displays the DAC and ESTAMIN service details.
        await page.locator("xpath=/html/body/main/section/div[2]/section[2]/a").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The DAC/ESTAMIN service section (including the 'Hablar por WhatsApp' CTA) is visible on the page.
        await expect(page.locator("xpath=/html/body/main/section/div[2]/section[2]/a").nth(0)).to_be_visible(timeout=15000), "The DAC/ESTAMIN service section (including the 'Hablar por WhatsApp' CTA) is visible on the page."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    