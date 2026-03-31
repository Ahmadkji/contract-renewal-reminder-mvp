import { test, expect, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

async function login(page: Page) {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    test.skip(true, "TEST_EMAIL and TEST_PASSWORD are required for billing pricing smoke test");
  }

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(TEST_EMAIL!);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD!);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.describe("Billing pricing smoke", () => {
  test.describe.configure({ timeout: 120000 });

  test("renders professional pricing cards and checkout actions", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/billing");

    await expect(page.getByRole("heading", { name: "Plans & Pricing" })).toBeVisible();
    await expect(page.getByText("Free").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Upgrade Monthly" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upgrade Yearly" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Manage Billing" })).toBeVisible();
  });
});
