// Template: mobile-viewport QA, including the fixed-position-overlay
// reachability check (see SKILL.md step 4). Adapt the URL/selectors below.
// Assumes the dev server is already up at http://localhost:3000.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, // iPhone-ish
  isMobile: true,
  hasTouch: true,
});

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/m-hero.png" });

// Mobile nav open/close.
await page.getByLabel(/men/i).first().click().catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/m-nav-open.png" });

// --- Fixed-overlay reachability check ---
// Any position:fixed element (cookie banner, sticky CTA, toast) doesn't grow
// document height, so it can permanently cover the last bit of a short
// page's content with no room left to scroll past it. Verify for real —
// don't trust a fullPage screenshot or boundingBox() overlap math alone.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(300);

const scrollCheck = await page.evaluate(() => ({
  scrollY: window.scrollY,
  atTrueMax: window.scrollY === document.body.scrollHeight - window.innerHeight,
}));
console.log("Scrolled to true max:", JSON.stringify(scrollCheck));
await page.screenshot({ path: "/tmp/m-max-scroll.png" });
// Read /tmp/m-max-scroll.png and visually confirm nothing important
// (footer legal links, a CTA, a close button) is hidden under a fixed
// element at this exact scroll position.

console.log("errors:", JSON.stringify(errors));
await browser.close();
