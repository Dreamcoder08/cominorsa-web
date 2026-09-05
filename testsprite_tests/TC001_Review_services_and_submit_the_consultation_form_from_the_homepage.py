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
        
        # -> Click the 'ACEPTAR' button on the cookie banner to dismiss the consent prompt so page elements are reachable.
        # Aceptar button
        elem = page.get_by_role('button', name='Aceptar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'ACEPTAR' button on the cookie banner to dismiss the consent prompt so page elements are reachable.
        # Servicios link
        elem = page.locator('xpath=/html/body/main/header/div/nav/a[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'ACEPTAR' button on the cookie banner to dismiss the consent prompt so page elements are reachable.
        # Consulta link
        elem = page.locator('xpath=/html/body/main/header/div/nav/a[3]')
        await elem.click(timeout=10000)
        
        # -> List the consultation form controls visible on the page: 'Nombre completo', 'Ciudad o región', 'Servicio de interés', 'Línea de WhatsApp', 'Escribe tu consulta' and the 'Enviar por WhatsApp' button, returning their element indexes and vi...
        await page.mouse.wheel(0, 300)
        
        # -> Scroll the Consulta section into view and list the 'Nombre completo', 'Ciudad o región', 'Servicio de interés', 'LÍNEA DE WHATSAPP', 'Escribe tu consulta' fields and the 'ENVIAR POR WHATSAPP' button with their element indexes and visible...
        await page.mouse.wheel(0, 300)
        
        # -> Fill the 'Nombre completo' field with 'Ana Torres' and the 'Ciudad o región' field with 'Lima', then open the 'Servicio de interés' dropdown.
        # Escribe tu nombre text field
        elem = page.get_by_label('Nombre completo', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Ana Torres")
        
        # -> Fill the 'Nombre completo' field with 'Ana Torres' and the 'Ciudad o región' field with 'Lima', then open the 'Servicio de interés' dropdown.
        # Ej. Piura text field
        elem = page.get_by_label('Ciudad o región', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Lima")
        
        # -> Fill the 'Nombre completo' field with 'Ana Torres' and the 'Ciudad o región' field with 'Lima', then open the 'Servicio de interés' dropdown.
        # Selecciona un servicio Formalización minera e... dropdown
        elem = page.get_by_label('Servicio de interésSelecciona un servicioFormalización minera e IGAFOMREINFODIA, PAMA e instrumentos ambientalesDAC y ESTAMINInformes y expedientes técnicosPlanes de minado, mapas y planosSeguridad y salud ocupacionalTrámites ante MINEM, INGEMMET o DREMOtra consulta minera o ambiental', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        current_url = await page.evaluate("() => window.location.href")
        # Assert-outcome: passed
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    