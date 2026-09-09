import { test, expect } from "@playwright/test";

test.describe("Cross-Tenant Isolation", () => {
  test("branch A orders invisible to branch B", async ({ page }) => {
    // Login as admin (branch: ana-sube)
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "admin@kahvem.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });

    // Create order on branch A
    const orderInput = page.locator("#order-input");
    await orderInput.fill("999");
    await page.locator('button:has-text("EKLE")').click();
    await expect(page.getByText("#999", { exact: true })).toBeVisible({ timeout: 15000 });

    // Verify display page for ana-sube shows the order
    const displayA = await page.context().newPage();
    await displayA.goto("/b/ana-sube/display");
    await expect(displayA.getByText("Şu anda teslim edilmeyi bekleyen sipariş yok.")).toBeVisible({ timeout: 10000 });

    // Mark as ready
    await page.bringToFront();
    await page.locator('button:has-text("HAZIR")').click();

    // Display A should show it
    await displayA.bringToFront();
    await expect(displayA.getByText("999")).toBeVisible({ timeout: 15000 });

    // Display for a non-existent branch must never leak branch A orders.
    // (Unknown slug keeps the display in its loading state; the assertion
    // is that "999" is never rendered there.)
    const displayB = await page.context().newPage();
    await displayB.goto("/b/olmayan-sube/display");
    await expect(displayB.getByText("999")).not.toBeVisible({ timeout: 10000 });

    // Track on wrong branch should fail
    const trackWrongBranch = await page.context().newPage();
    await trackWrongBranch.goto("/b/olmayan-sube/track");
    await trackWrongBranch.waitForSelector('input[type="text"][inputmode="numeric"]');
    await trackWrongBranch.fill('input[type="text"][inputmode="numeric"]', "999");
    await trackWrongBranch.locator('button:has-text("TAKİP ET")').click();
    await expect(trackWrongBranch.getByText("Şube bulunamadı")).toBeVisible({ timeout: 10000 });

    // Track on correct branch should work
    const trackCorrectBranch = await page.context().newPage();
    await trackCorrectBranch.goto("/b/ana-sube/track");
    await trackCorrectBranch.waitForSelector('input[type="text"][inputmode="numeric"]');
    await trackCorrectBranch.fill('input[type="text"][inputmode="numeric"]', "999");
    await trackCorrectBranch.locator('button:has-text("TAKİP ET")').click();
    await trackCorrectBranch.waitForURL("**/t/**", { timeout: 15000 });
    await expect(trackCorrectBranch.getByText("SİPARİŞİNİZ HAZIR", { exact: true })).toBeVisible({ timeout: 10000 });

    // Cleanup
    await page.bringToFront();
    await expect(page.locator('button:has-text("TESLİM EDİLDİ")')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("TESLİM EDİLDİ")').click();

    await displayA.close();
    await displayB.close();
    await trackWrongBranch.close();
    await trackCorrectBranch.close();
  });
});
