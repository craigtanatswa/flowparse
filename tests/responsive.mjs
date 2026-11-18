/**
 * Responsive layout smoke test for the public marketing and auth pages.
 *
 * Start the app first:
 *   npm run dev
 * Then:
 *   npm run test:responsive
 *
 * It launches an installed Chrome (not a downloaded browser) and checks for
 * horizontal overflow, failed navigations, console errors and the mobile menu
 * at the common Tailwind breakpoints. Authenticated workspace pages are covered
 * by the manual checklist because they require a Supabase session.
 */
import { chromium } from "playwright-core";

const base = process.env.APP_URL ?? "http://localhost:3000";
const executablePath = process.env.PLAYWRIGHT_CHROME_PATH;
const pages = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/banks",
  "/banks/barclays",
  "/resources",
  "/resources/how-to-convert-bank-statement-pdf-to-excel",
  "/convert-bank-statement-pdf-to-excel",
];
const widths = [390, 640, 768, 1024, 1440];

const launchOptions = executablePath
  ? { executablePath, headless: true }
  : { channel: "chrome", headless: true };
const browser = await chromium.launch(launchOptions);
const results = [];

for (const width of widths) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 },
    deviceScaleFactor: 1,
  });
  for (const path of pages) {
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));

    let status = null;
    try {
      const response = await page.goto(base + path, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      status = response?.status() ?? null;
    } catch (error) {
      errors.push(`navigation: ${error.message}`);
    }

    const metrics = await page.evaluate(() => {
      const viewport = window.innerWidth;
      const offenders = [];
      for (const element of document.querySelectorAll("body *")) {
        const rect = element.getBoundingClientRect();
        if (rect.width <= viewport + 2 || rect.right <= viewport + 2) continue;
        let parent = element.parentElement;
        let clipped = false;
        while (parent) {
          const style = getComputedStyle(parent);
          if (["auto", "scroll", "hidden"].includes(style.overflowX)) {
            clipped = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (!clipped && getComputedStyle(element).position !== "fixed") {
          offenders.push(
            `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 80)} width=${Math.round(rect.width)}`
          );
        }
      }
      return {
        viewport,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        offenders: offenders.slice(0, 5),
        h1: document.querySelector("h1")?.textContent?.trim().slice(0, 80) ?? null,
      };
    });

    results.push({ width, path, status, ...metrics, errors });
    await page.close();
  }
  await context.close();
}

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const menuPage = await mobile.newPage();
await menuPage.goto(base + "/", { waitUntil: "networkidle" });
const menuButton = menuPage.getByRole("button", { name: "Open menu" });
const menuVisible = await menuButton.isVisible();
if (menuVisible) await menuButton.click();
const navVisible = await menuPage
  .getByRole("navigation", { name: "Mobile navigation" })
  .isVisible()
  .catch(() => false);
const menuMetrics = await menuPage.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
}));
results.push({
  width: 390,
  path: "/ (mobile nav)",
  status: 200,
  menuVisible,
  navVisible,
  ...menuMetrics,
  errors: [],
});
await mobile.close();
await browser.close();

const failures = results.filter(
  (item) =>
    item.status !== 200 ||
    (item.scrollWidth ?? 0) > (item.viewport ?? item.innerWidth ?? 0) + 1 ||
    (item.offenders && item.offenders.length > 0) ||
    (item.errors && item.errors.length > 0) ||
    item.menuVisible === false ||
    item.navVisible === false
);

console.log(JSON.stringify({ checks: results.length, failures }, null, 2));
process.exit(failures.length ? 1 : 0);
