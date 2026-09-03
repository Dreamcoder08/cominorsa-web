// Template: adapt the selectors/paths below, run from any dir with
// `playwright` installed (npm install --no-save playwright).
// Assumes the dev server is already up at http://localhost:3000.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(500); // let load-triggered animations settle

// Whole-page above-the-fold shot.
await page.screenshot({ path: "/tmp/shot-hero.png" });

// Scroll to a specific section and shoot it.
await page.locator("#servicios").scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/shot-services.png" });

// Reduced-motion pass (new context, not the same page).
const rmPage = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
await rmPage.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
await rmPage.screenshot({ path: "/tmp/shot-reduced-motion.png" });

console.log("errors:", JSON.stringify(errors));
await browser.close();
