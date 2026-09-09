import { test, expect } from "@playwright/test";

test.describe("Admin Reports", () => {
  test("reports page loads with metrics", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "admin@test.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });

    await page.goto("/panel/reports");
    await page.waitForSelector("text=Raporlar", { timeout: 10000 });

    // Summary cards visible
    await expect(page.getByText("Bugünkü Sipariş")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Ortalama Hazırlama")).toBeVisible();
    await expect(page.locator("p", { hasText: "Aktif" }).first()).toBeVisible();
    await expect(page.locator("p", { hasText: "Hazır" }).first()).toBeVisible();
    await expect(page.locator("p", { hasText: "Tamamlanan" }).first()).toBeVisible();

    // Hourly chart visible
    await expect(page.getByText("Saatlik Yoğunluk")).toBeVisible();

    // CSV button visible
    await expect(page.getByText("CSV İndir")).toBeVisible();
  });

  test("branch filter works", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "admin@test.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });

    await page.goto("/panel/reports");
    await page.waitForSelector("text=Raporlar", { timeout: 10000 });

    // Branch selector visible for admin
    const branchSelect = page.locator("select").last();
    await expect(branchSelect).toBeVisible({ timeout: 10000 });

    // All branches should be in options
    await expect(branchSelect.locator("option")).toHaveCount(3); // All + 2 branches

    // Select Van AVM
    await branchSelect.selectOption({ label: "Van AVM" });
    await page.waitForTimeout(1000);

    // Branch comparison should be hidden when single branch selected
    await expect(page.getByText("Şube Karşılaştırma")).not.toBeVisible({ timeout: 3000 });

    // Select all branches
    await branchSelect.selectOption("all");
    await page.waitForTimeout(1000);

    // Branch comparison should appear
    await expect(page.getByText("Şube Karşılaştırma")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("cell", { name: "Van AVM" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Iskele" })).toBeVisible();
  });

  test("date range filter works", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "admin@test.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });

    await page.goto("/panel/reports");
    await page.waitForSelector("text=Raporlar", { timeout: 10000 });

    // Today is default
    const todayBtn = page.locator("button", { hasText: "Bugün" });
    await expect(todayBtn).toHaveClass(/bg-stone-700/);

    // Switch to 7 days
    await page.locator("button", { hasText: "Son 7 gün" }).click();
    await page.waitForTimeout(1000);

    // Data should still be visible
    await expect(page.getByText("Bugünkü Sipariş")).toBeVisible();
  });

  test("cashier cannot access reports", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "cashier@test.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });

    // Raporlar link should not be visible in nav
    await expect(page.locator('a:has-text("Raporlar")')).not.toBeVisible();

    // Direct URL access should redirect to panel
    await page.goto("/panel/reports");
    await page.waitForURL("**/panel", { timeout: 10000 });
    await expect(page.locator("text=Raporlar")).not.toBeVisible({ timeout: 3000 });
  });

  test("CSV export works", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "admin@test.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });

    await page.goto("/panel/reports");
    await page.waitForSelector("text=Raporlar", { timeout: 10000 });

    const csvBtn = page.locator("button", { hasText: "CSV İndir" });
    await expect(csvBtn).toBeVisible({ timeout: 5000 });

    // Verify CSV download via API
    const response = await page.request.get(
      "http://localhost:3099/api/reports/export?range=today&branchId=all"
    );
    expect(response.ok()).toBeTruthy();
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("text/csv");

    const csvText = await response.text();
    const lines = csvText.split("\n");
    expect(lines[0]).toContain("Order Number");
    expect(lines[0]).toContain("Branch");
    expect(lines[0]).toContain("Preparation Duration");
    expect(lines[0]).toContain("Status");
  });
});
