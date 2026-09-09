import { chromium } from "@playwright/test";
import path from "path";

const BASE = "http://localhost:3099";
const DIR = path.join(import.meta.dirname ?? __dirname, "..", "..", "screenshots");

async function main() {
  const fs = await import("fs");
  fs.mkdirSync(DIR, { recursive: true });

  const browser = await chromium.launch();

  async function loginPanel(viewport?: { width: number; height: number }) {
    const ctx = await browser.newContext(viewport ? { viewport } : undefined);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', "admin@kahvem.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });
    await page.waitForSelector("#order-input", { timeout: 10000 });
    return { ctx, page };
  }

  // 1. Panel — desktop
  const { ctx: desktopCtx, page: desktopPage } = await loginPanel({ width: 1366, height: 768 });
  for (const num of ["184", "185", "186"]) {
    await desktopPage.fill("#order-input", num);
    await desktopPage.click('button:has-text("EKLE")');
    await desktopPage.waitForTimeout(600);
  }
  await desktopPage.waitForTimeout(500);
  await desktopPage.screenshot({ path: path.join(DIR, "panel-desktop.png"), fullPage: true });

  // 2. Mark #185 as READY
  const hazirBtns = desktopPage.locator('button:has-text("HAZIR")');
  if (await hazirBtns.count() > 1) {
    await hazirBtns.nth(1).click();
  } else {
    await hazirBtns.first().click();
  }
  await desktopPage.waitForTimeout(1000);
  await desktopPage.screenshot({ path: path.join(DIR, "panel-desktop-ready.png"), fullPage: true });

  // 3. Panel — tablet
  const { ctx: tabletCtx, page: tabletPage } = await loginPanel({ width: 1024, height: 768 });
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: path.join(DIR, "panel-tablet.png"), fullPage: true });
  await tabletCtx.close();

  // 4. Track — mobile
  const trackCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const trackPage = await trackCtx.newPage();
  await trackPage.goto(`${BASE}/track`);
  await trackPage.waitForSelector('input[inputmode="numeric"]', { timeout: 10000 });
  await trackPage.screenshot({ path: path.join(DIR, "track-mobile.png"), fullPage: true });
  await trackCtx.close();

  // 5. Tracking WAITING
  const waitCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const waitPage = await waitCtx.newPage();
  await waitPage.goto(`${BASE}/track`);
  await waitPage.waitForSelector('input[inputmode="numeric"]', { timeout: 10000 });
  await waitPage.fill('input[inputmode="numeric"]', "184");
  await waitPage.click('button:has-text("TAKİP ET")');
  await waitPage.waitForURL("**/t/**", { timeout: 15000 });
  await waitPage.waitForSelector("text=Siparişiniz", { timeout: 10000 });
  await waitPage.waitForTimeout(500);
  await waitPage.screenshot({ path: path.join(DIR, "tracking-waiting-mobile.png"), fullPage: true });
  await waitCtx.close();

  // 6. Tracking READY
  const readyCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const readyPage = await readyCtx.newPage();
  await readyPage.goto(`${BASE}/track`);
  await readyPage.waitForSelector('input[inputmode="numeric"]', { timeout: 10000 });
  await readyPage.fill('input[inputmode="numeric"]', "185");
  await readyPage.click('button:has-text("TAKİP ET")');
  await readyPage.waitForURL("**/t/**", { timeout: 15000 });
  await readyPage.waitForSelector("text=teslim", { timeout: 15000 });
  await readyPage.waitForTimeout(500);
  await readyPage.screenshot({ path: path.join(DIR, "tracking-ready-mobile.png"), fullPage: true });
  await readyCtx.close();

  // 7. Settings
  const { ctx: settingsCtx, page: settingsPage } = await loginPanel({ width: 1366, height: 768 });
  await settingsPage.goto(`${BASE}/panel/settings`);
  await settingsPage.waitForSelector("img[alt='Müşteri takip QR kodu']", { timeout: 10000 });
  await settingsPage.waitForTimeout(1500);
  await settingsPage.screenshot({ path: path.join(DIR, "settings-desktop.png"), fullPage: true });
  await settingsCtx.close();

  // 8. Login
  const loginCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const loginPage = await loginCtx.newPage();
  await loginPage.goto(`${BASE}/login`);
  await loginPage.waitForSelector('input[type="email"]', { timeout: 10000 });
  await loginPage.waitForTimeout(500);
  await loginPage.screenshot({ path: path.join(DIR, "login-mobile.png"), fullPage: true });
  await loginCtx.close();

  await desktopCtx.close();

  // 9. Display page
  const displayCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const displayPage = await displayCtx.newPage();
  await displayPage.goto(`${BASE}/display`);
  await displayPage.waitForTimeout(2000);
  await displayPage.screenshot({ path: path.join(DIR, "display-1920x1080.png"), fullPage: true });
  await displayCtx.close();

  await browser.close();
  console.log("Screenshots saved to", DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
