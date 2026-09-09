# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: reports.spec.ts >> Admin Reports >> branch filter works
- Location: tests/e2e/reports.spec.ts:29:7

# Error details

```
Error: Channel closed
```

```
Error: page.waitForTimeout: Test ended.
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - alert [ref=f1e2]
  - generic [ref=f1e3]:
    - banner [ref=f1e4]:
      - generic [ref=f1e5]:
        - heading "Raporlar" [level=1] [ref=f1e6]
        - generic [ref=f1e7]:
          - button "CSV İndir" [ref=f1e8]
          - link "Geri" [ref=f1e9] [cursor=pointer]:
            - /url: /panel
    - main [ref=f1e10]:
      - generic [ref=f1e11]:
        - generic [ref=f1e12]:
          - button "Bugün" [ref=f1e13]
          - button "Son 7 gün" [ref=f1e14]
          - button "Son 30 gün" [ref=f1e15]
        - combobox [ref=f1e16]:
          - option "Tüm Şubeler"
          - option "Van AVM" [selected]
          - option "Iskele"
      - generic [ref=f1e17]:
        - generic [ref=f1e18]:
          - paragraph [ref=f1e19]: Bugünkü Sipariş
          - paragraph [ref=f1e20]: "0"
        - generic [ref=f1e21]:
          - paragraph [ref=f1e22]: Ortalama Hazırlama
          - paragraph [ref=f1e23]: "-"
        - generic [ref=f1e24]:
          - paragraph [ref=f1e25]: Ortalama Teslim
          - paragraph [ref=f1e26]: "-"
        - generic [ref=f1e27]:
          - paragraph [ref=f1e28]: Aktif
          - paragraph [ref=f1e29]: "0"
        - generic [ref=f1e30]:
          - paragraph [ref=f1e31]: Hazır
          - paragraph [ref=f1e32]: "0"
        - generic [ref=f1e33]:
          - paragraph [ref=f1e34]: Tamamlanan
          - paragraph [ref=f1e35]: "0"
      - generic [ref=f1e36]:
        - generic [ref=f1e37]:
          - paragraph [ref=f1e38]: Ortalama Toplam Süre
          - paragraph [ref=f1e39]: "-"
        - generic [ref=f1e40]:
          - paragraph [ref=f1e41]: 10 dk+ Hazırlanan
          - paragraph [ref=f1e42]: "0"
        - generic [ref=f1e43]:
          - paragraph [ref=f1e44]: Hazır Bekleyen
          - paragraph [ref=f1e45]: "0"
      - generic [ref=f1e46]:
        - heading "Saatlik Yoğunluk" [level=2] [ref=f1e47]
        - generic [ref=f1e48]:
          - generic [ref=f1e49]:
            - generic "00:00 - 0 sipariş" [ref=f1e50]
            - generic [ref=f1e51]: "00"
          - generic "01:00 - 0 sipariş" [ref=f1e53]
          - generic "02:00 - 0 sipariş" [ref=f1e55]
          - generic [ref=f1e56]:
            - generic "03:00 - 0 sipariş" [ref=f1e57]
            - generic [ref=f1e58]: "03"
          - generic "04:00 - 0 sipariş" [ref=f1e60]
          - generic "05:00 - 0 sipariş" [ref=f1e62]
          - generic [ref=f1e63]:
            - generic "06:00 - 0 sipariş" [ref=f1e64]
            - generic [ref=f1e65]: "06"
          - generic "07:00 - 0 sipariş" [ref=f1e67]
          - generic "08:00 - 0 sipariş" [ref=f1e69]
          - generic [ref=f1e70]:
            - generic "09:00 - 0 sipariş" [ref=f1e71]
            - generic [ref=f1e72]: "09"
          - generic "10:00 - 0 sipariş" [ref=f1e74]
          - generic "11:00 - 0 sipariş" [ref=f1e76]
          - generic [ref=f1e77]:
            - generic "12:00 - 0 sipariş" [ref=f1e78]
            - generic [ref=f1e79]: "12"
          - generic "13:00 - 0 sipariş" [ref=f1e81]
          - generic "14:00 - 0 sipariş" [ref=f1e83]
          - generic [ref=f1e84]:
            - generic "15:00 - 0 sipariş" [ref=f1e85]
            - generic [ref=f1e86]: "15"
          - generic "16:00 - 0 sipariş" [ref=f1e88]
          - generic "17:00 - 0 sipariş" [ref=f1e90]
          - generic [ref=f1e91]:
            - generic "18:00 - 0 sipariş" [ref=f1e92]
            - generic [ref=f1e93]: "18"
          - generic "19:00 - 0 sipariş" [ref=f1e95]
          - generic "20:00 - 0 sipariş" [ref=f1e97]
          - generic [ref=f1e98]:
            - generic "21:00 - 0 sipariş" [ref=f1e99]
            - generic [ref=f1e100]: "21"
          - generic "22:00 - 0 sipariş" [ref=f1e102]
          - generic "23:00 - 0 sipariş" [ref=f1e104]
      - generic [ref=f1e105]:
        - paragraph [ref=f1e106]: Bu dönem için veri bulunamadı.
        - paragraph [ref=f1e107]: Farklı bir tarih aralığı veya şube deneyin.
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | test.describe("Admin Reports", () => {
  4   |   test("reports page loads with metrics", async ({ page }) => {
  5   |     await page.goto("/login");
  6   |     await page.waitForSelector('input[type="email"]');
  7   |     await page.fill('input[type="email"]', "admin@test.com");
  8   |     await page.fill('input[type="password"]', "password123");
  9   |     await page.click('button[type="submit"]');
  10  |     await page.waitForURL("**/panel", { timeout: 15000 });
  11  | 
  12  |     await page.goto("/panel/reports");
  13  |     await page.waitForSelector("text=Raporlar", { timeout: 10000 });
  14  | 
  15  |     // Summary cards visible
  16  |     await expect(page.getByText("Bugünkü Sipariş")).toBeVisible({ timeout: 10000 });
  17  |     await expect(page.getByText("Ortalama Hazırlama")).toBeVisible();
  18  |     await expect(page.locator("p", { hasText: "Aktif" }).first()).toBeVisible();
  19  |     await expect(page.locator("p", { hasText: "Hazır" }).first()).toBeVisible();
  20  |     await expect(page.locator("p", { hasText: "Tamamlanan" }).first()).toBeVisible();
  21  | 
  22  |     // Hourly chart visible
  23  |     await expect(page.getByText("Saatlik Yoğunluk")).toBeVisible();
  24  | 
  25  |     // CSV button visible
  26  |     await expect(page.getByText("CSV İndir")).toBeVisible();
  27  |   });
  28  | 
  29  |   test("branch filter works", async ({ page }) => {
  30  |     await page.goto("/login");
  31  |     await page.waitForSelector('input[type="email"]');
  32  |     await page.fill('input[type="email"]', "admin@test.com");
  33  |     await page.fill('input[type="password"]', "password123");
  34  |     await page.click('button[type="submit"]');
  35  |     await page.waitForURL("**/panel", { timeout: 15000 });
  36  | 
  37  |     await page.goto("/panel/reports");
  38  |     await page.waitForSelector("text=Raporlar", { timeout: 10000 });
  39  | 
  40  |     // Branch selector visible for admin
  41  |     const branchSelect = page.locator("select").last();
  42  |     await expect(branchSelect).toBeVisible({ timeout: 10000 });
  43  | 
  44  |     // All branches should be in options
  45  |     await expect(branchSelect.locator("option")).toHaveCount(3); // All + 2 branches
  46  | 
  47  |     // Select Van AVM
  48  |     await branchSelect.selectOption({ label: "Van AVM" });
> 49  |     await page.waitForTimeout(1000);
      |                ^ Error: page.waitForTimeout: Test ended.
  50  | 
  51  |     // Branch comparison should be hidden when single branch selected
  52  |     await expect(page.getByText("Şube Karşılaştırma")).not.toBeVisible({ timeout: 3000 });
  53  | 
  54  |     // Select all branches
  55  |     await branchSelect.selectOption("all");
  56  |     await page.waitForTimeout(1000);
  57  | 
  58  |     // Branch comparison should appear
  59  |     await expect(page.getByText("Şube Karşılaştırma")).toBeVisible({ timeout: 5000 });
  60  |     await expect(page.getByRole("cell", { name: "Van AVM" })).toBeVisible();
  61  |     await expect(page.getByRole("cell", { name: "Iskele" })).toBeVisible();
  62  |   });
  63  | 
  64  |   test("date range filter works", async ({ page }) => {
  65  |     await page.goto("/login");
  66  |     await page.waitForSelector('input[type="email"]');
  67  |     await page.fill('input[type="email"]', "admin@test.com");
  68  |     await page.fill('input[type="password"]', "password123");
  69  |     await page.click('button[type="submit"]');
  70  |     await page.waitForURL("**/panel", { timeout: 15000 });
  71  | 
  72  |     await page.goto("/panel/reports");
  73  |     await page.waitForSelector("text=Raporlar", { timeout: 10000 });
  74  | 
  75  |     // Today is default
  76  |     const todayBtn = page.locator("button", { hasText: "Bugün" });
  77  |     await expect(todayBtn).toHaveClass(/bg-stone-700/);
  78  | 
  79  |     // Switch to 7 days
  80  |     await page.locator("button", { hasText: "Son 7 gün" }).click();
  81  |     await page.waitForTimeout(1000);
  82  | 
  83  |     // Data should still be visible
  84  |     await expect(page.getByText("Bugünkü Sipariş")).toBeVisible();
  85  |   });
  86  | 
  87  |   test("cashier cannot access reports", async ({ page }) => {
  88  |     await page.goto("/login");
  89  |     await page.waitForSelector('input[type="email"]');
  90  |     await page.fill('input[type="email"]', "cashier@test.com");
  91  |     await page.fill('input[type="password"]', "password123");
  92  |     await page.click('button[type="submit"]');
  93  |     await page.waitForURL("**/panel", { timeout: 15000 });
  94  | 
  95  |     // Raporlar link should not be visible in nav
  96  |     await expect(page.locator('a:has-text("Raporlar")')).not.toBeVisible();
  97  | 
  98  |     // Direct URL access should redirect to panel
  99  |     await page.goto("/panel/reports");
  100 |     await page.waitForURL("**/panel", { timeout: 10000 });
  101 |     await expect(page.locator("text=Raporlar")).not.toBeVisible({ timeout: 3000 });
  102 |   });
  103 | 
  104 |   test("CSV export works", async ({ page }) => {
  105 |     await page.goto("/login");
  106 |     await page.waitForSelector('input[type="email"]');
  107 |     await page.fill('input[type="email"]', "admin@test.com");
  108 |     await page.fill('input[type="password"]', "password123");
  109 |     await page.click('button[type="submit"]');
  110 |     await page.waitForURL("**/panel", { timeout: 15000 });
  111 | 
  112 |     await page.goto("/panel/reports");
  113 |     await page.waitForSelector("text=Raporlar", { timeout: 10000 });
  114 | 
  115 |     const csvBtn = page.locator("button", { hasText: "CSV İndir" });
  116 |     await expect(csvBtn).toBeVisible({ timeout: 5000 });
  117 | 
  118 |     // Verify CSV download via API
  119 |     const response = await page.request.get(
  120 |       "http://localhost:3099/api/reports/export?range=today&branchId=all"
  121 |     );
  122 |     expect(response.ok()).toBeTruthy();
  123 |     const contentType = response.headers()["content-type"];
  124 |     expect(contentType).toContain("text/csv");
  125 | 
  126 |     const csvText = await response.text();
  127 |     const lines = csvText.split("\n");
  128 |     expect(lines[0]).toContain("Order Number");
  129 |     expect(lines[0]).toContain("Branch");
  130 |     expect(lines[0]).toContain("Preparation Duration");
  131 |     expect(lines[0]).toContain("Status");
  132 |   });
  133 | });
  134 | 
```