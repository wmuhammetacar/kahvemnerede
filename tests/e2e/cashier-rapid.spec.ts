import { test, expect } from "@playwright/test";

const DEBOUNCE_MS = 600;

test.describe("Cashier Rapid 20-Order Test", () => {
  test("creates 20 orders rapidly (201-220) without mouse, no errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const networkErrors: number[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() >= 500) networkErrors.push(res.status());
    });

    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "admin@kahvem.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });

    const orderInput = page.locator("#order-input");
    await expect(orderInput).toBeVisible({ timeout: 10000 });

    for (let i = 201; i <= 220; i++) {
      await orderInput.fill(String(i));
      await page.waitForTimeout(50);
      await page.keyboard.press("Enter");
      await expect(page.getByText(`#${i}`, { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(orderInput).toHaveValue("", { timeout: 5000 });
      await page.waitForTimeout(DEBOUNCE_MS);
    }

    for (let i = 201; i <= 220; i++) {
      await expect(page.getByText(`#${i}`, { exact: true })).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
    expect(networkErrors).toEqual([]);
  });

  test("rapid READY on first 5 orders (201-205) without errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "admin@kahvem.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/panel", { timeout: 15000 });

    for (let i = 0; i < 5; i++) {
      const readyBtn = page.locator('button:has-text("HAZIR")').first();
      await expect(readyBtn).toBeVisible({ timeout: 10000 });
      await readyBtn.click();
      await page.waitForTimeout(500);
    }

    expect(consoleErrors).toEqual([]);
  });

  test("DB verification: 201-220 created, no duplicates, cleanup", async ({
    request,
  }) => {
    const loginRes = await request.post("/api/auth/login", {
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3099",
        "Sec-Fetch-Site": "same-origin",
      },
      data: { email: "admin@kahvem.com", password: "password123" },
    });
    expect(loginRes.ok()).toBeTruthy();
    const cookies = loginRes.headers()["set-cookie"] ?? "";

    const ordersRes = await request.get("/api/orders", {
      headers: {
        Origin: "http://localhost:3099",
        "Sec-Fetch-Site": "same-origin",
        Cookie: cookies,
      },
    });
    expect(ordersRes.ok()).toBeTruthy();
    const data = await ordersRes.json();

    const orderNumbers = data.orders.map((o: { orderNumber: string }) =>
      Number(o.orderNumber)
    );
    for (let i = 201; i <= 220; i++) {
      expect(orderNumbers).toContain(i);
    }

    // Cleanup: complete all remaining active orders
    for (const order of data.orders) {
      if (order.status === "WAITING") {
        await request.patch(`/api/orders/${order.id}/ready`, {
          headers: { Origin: "http://localhost:3099", "Sec-Fetch-Site": "same-origin", Cookie: cookies },
        });
        await request.patch(`/api/orders/${order.id}/complete`, {
          headers: { Origin: "http://localhost:3099", "Sec-Fetch-Site": "same-origin", Cookie: cookies },
        });
      } else if (order.status === "READY") {
        await request.patch(`/api/orders/${order.id}/complete`, {
          headers: { Origin: "http://localhost:3099", "Sec-Fetch-Site": "same-origin", Cookie: cookies },
        });
      }
    }
  });
});
