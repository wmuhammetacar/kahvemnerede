import { test, expect } from "@playwright/test";

test.describe("Full Order Flow", () => {
  test("complete flow", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "admin@kahvem.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });

    const orderInput = page.locator("#order-input");
    await expect(orderInput).toBeVisible({ timeout: 10000 });

    await orderInput.fill("184");
    await page.locator('button:has-text("EKLE")').click();

    await expect(page.getByText("#184", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Hazırlanıyor", { exact: true })).toBeVisible();
    await expect(orderInput).toHaveValue("");

    const customerPage = await page.context().newPage();
    await customerPage.goto("/b/ana-sube/track");
    await customerPage.waitForSelector('input[type="text"][inputmode="numeric"]');
    await customerPage.fill('input[type="text"][inputmode="numeric"]', "184");
    await customerPage.locator('button:has-text("TAKİP ET")').click();
    await customerPage.waitForURL("**/t/**", { timeout: 15000 });
    await expect(customerPage.getByText("HAZIRLANIYOR", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(customerPage.getByText("#184", { exact: true })).toBeVisible();

    await page.bringToFront();
    await expect(page.locator('button:has-text("HAZIR")')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("HAZIR")').click();

    await customerPage.bringToFront();
    await expect(customerPage.getByText("SİPARİŞİNİZ HAZIR", { exact: true })).toBeVisible({ timeout: 15000 });

    await page.bringToFront();
    await expect(page.locator('button:has-text("TESLİM EDİLDİ")')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("TESLİM EDİLDİ")').click();
    await expect(page.getByText("#184", { exact: true })).not.toBeVisible({ timeout: 10000 });

    await page.goto("/panel/history");
    await expect(page.getByText("#184", { exact: true })).toBeVisible({ timeout: 10000 });

    await customerPage.close();
  });
});

test.describe("Duplicate Order Protection", () => {
  test("prevents duplicate active order", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "admin@kahvem.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });

    const orderInput = page.locator("#order-input");

    await orderInput.fill("301");
    await page.locator('button:has-text("EKLE")').click();
    await expect(page.getByText("#301", { exact: true })).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(600);

    await orderInput.fill("301");
    await page.locator('button:has-text("EKLE")').click();
    await expect(page.getByText("Bu sipariş numarası zaten aktif")).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("HAZIR")').first().click();
    await expect(page.locator('button:has-text("TESLİM EDİLDİ")').first()).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("TESLİM EDİLDİ")').first().click();
    await expect(page.getByText("#301", { exact: true })).not.toBeVisible({ timeout: 10000 });
  });
});

test.describe("Ready Undo", () => {
  test("can undo ready within undo window", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "admin@kahvem.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });

    const orderInput = page.locator("#order-input");

    await orderInput.fill("401");
    await page.locator('button:has-text("EKLE")').click();
    await expect(page.getByText("#401", { exact: true })).toBeVisible({ timeout: 15000 });

    await page.locator('button:has-text("HAZIR")').click();

    await expect(page.getByText("HAZIR", { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("GERİ AL")')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("GERİ AL")').click();
    await expect(page.getByText("Hazırlanıyor", { exact: true })).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("HAZIR")').click();
    await expect(page.locator('button:has-text("TESLİM EDİLDİ")')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("TESLİM EDİLDİ")').click();
    await expect(page.getByText("#401", { exact: true })).not.toBeVisible({ timeout: 10000 });
  });
});

test.describe("Display Page", () => {
  test("shows only READY orders in realtime", async ({ page, context }) => {
    const displayPage = await context.newPage();
    await displayPage.goto("/b/ana-sube/display");
    await expect(displayPage.getByText("Şu anda teslim edilmeyi bekleyen sipariş yok.")).toBeVisible({ timeout: 15000 });

    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "admin@kahvem.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });

    const orderInput = page.locator("#order-input");
    await orderInput.fill("501");
    await page.locator('button:has-text("EKLE")').click();
    await expect(page.getByText("#501", { exact: true })).toBeVisible({ timeout: 15000 });

    await displayPage.bringToFront();
    await expect(displayPage.getByText("501")).not.toBeVisible({ timeout: 3000 });

    await page.bringToFront();
    await page.locator('button:has-text("HAZIR")').click();

    await displayPage.bringToFront();
    await expect(displayPage.getByText("501")).toBeVisible({ timeout: 15000 });

    await page.bringToFront();
    await expect(page.locator('button:has-text("TESLİM EDİLDİ")')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("TESLİM EDİLDİ")').click();

    await displayPage.bringToFront();
    await expect(displayPage.getByText("501")).not.toBeVisible({ timeout: 10000 });

    await displayPage.close();
  });
});
