import { test, expect, type Page } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

const configuredEmail = process.env.TEST_EMAIL?.trim() || null
const configuredPassword = process.env.TEST_PASSWORD?.trim() || null
const requiresEphemeralUser = !(configuredEmail && configuredPassword)

const defaultSmokePassword = `SmokeTest-${Date.now()}-Aa1!`
let runtimeEmail = configuredEmail ?? `dashboard-smoke-${Date.now()}@example.com`
let runtimePassword = configuredPassword ?? defaultSmokePassword
let ephemeralUserId: string | null = null

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Set TEST_EMAIL+TEST_PASSWORD or provide Supabase admin env vars to auto-provision a smoke user.'
    )
  }
  return value
}

async function createEphemeralSmokeUserIfNeeded(): Promise<void> {
  if (!requiresEphemeralUser) {
    return
  }

  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  runtimeEmail = `dashboard-smoke-${uniqueSuffix}@example.com`
  runtimePassword = defaultSmokePassword

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: runtimeEmail,
      password: runtimePassword,
      email_confirm: true,
    }),
  })

  const responseText = await response.text()
  if (!response.ok) {
    throw new Error(`Failed to create smoke test user (${response.status}): ${responseText}`)
  }

  const parsed = JSON.parse(responseText) as { id?: string }
  if (!parsed.id) {
    throw new Error('Failed to create smoke test user: missing user id in response')
  }

  ephemeralUserId = parsed.id
}

async function deleteEphemeralSmokeUserIfNeeded(): Promise<void> {
  if (!ephemeralUserId) {
    return
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return
  }

  await fetch(`${supabaseUrl}/auth/v1/admin/users/${ephemeralUserId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  })
}

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(runtimeEmail)
  await page.getByLabel(/password/i).fill(runtimePassword)
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.getByRole('button', { name: /sign in|log in|login/i }).click(),
  ])
}

async function openContractForm(page: Page) {
  await page.getByRole("button", { name: /add contract/i }).click();
  await expect(page.getByRole("heading", { name: "Add New Contract" })).toBeVisible();
}

async function pickDate(page: Page, triggerName: RegExp, day: number) {
  await page.getByRole("button", { name: triggerName }).click();
  await page.getByRole("button", { name: new RegExp(`^${day}$`) }).click();
}

async function createContract(page: Page, contractName: string, vendorName: string) {
  await openContractForm(page);
  await page
    .getByPlaceholder("e.g., Microsoft 365 Enterprise")
    .fill(contractName);
  await page
    .getByPlaceholder("e.g., Microsoft Corporation")
    .fill(vendorName);
  await pickDate(page, /select start date/i, 10);
  await pickDate(page, /select end date/i, 20);
  const emailReminderSwitch = page.getByRole('switch', { name: /send email reminders/i })
  if ((await emailReminderSwitch.getAttribute('aria-checked')) === 'true') {
    await emailReminderSwitch.click()
  }
  await page.getByRole("button", { name: "Create Contract" }).click();
  await expect(page.locator(".main-scroll-container").getByText(contractName).first()).toBeVisible({
    timeout: 30000,
  });
}

async function openContractFromMainContent(page: Page, contractName: string) {
  const content = page.locator(".main-scroll-container");
  await expect(content.getByText(contractName).first()).toBeVisible({ timeout: 30000 });
  await content.getByText(contractName).first().click();
  await expect(
    page.getByRole("dialog").filter({ hasText: "Contract Details" }).first()
  ).toBeVisible();
}

test.describe("Dashboard contract smoke", () => {
  test.describe.configure({ timeout: 120000 });
  test.beforeAll(async () => {
    await createEphemeralSmokeUserIfNeeded()
  })

  test.afterAll(async () => {
    await deleteEphemeralSmokeUserIfNeeded()
  })

  test("creates, edits, and deletes a contract from the active dashboard flow", async ({
    page,
  }) => {
    const uniqueId = Date.now();
    const contractName = `Smoke Contract ${uniqueId}`;
    const updatedName = `Smoke Contract Updated ${uniqueId}`;
    const vendorName = `Smoke Vendor ${uniqueId}`;

    await login(page);

    await createContract(page, contractName, vendorName);

    await openContractFromMainContent(page, contractName);
    await page.keyboard.press("Escape");

    await page.goto("/dashboard/contracts");
    await expect(page.getByText("Loading contracts...")).not.toBeVisible({
      timeout: 30000,
    });
    await openContractFromMainContent(page, contractName);

    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit Contract" })).toBeVisible();
    await page
      .getByPlaceholder("e.g., Microsoft 365 Enterprise")
      .fill(updatedName);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(
      page.locator(".main-scroll-container").getByText(updatedName).first()
    ).toBeVisible({
      timeout: 30000,
    });

    await openContractFromMainContent(page, updatedName);
    await page.getByRole("button", { name: "Delete" }).click();

    const deleteDialog = page.getByRole("alertdialog");
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Delete" }).click();
    await expect(
      page.locator(".main-scroll-container").getByText(updatedName)
    ).toHaveCount(0, { timeout: 30000 });
  });
});
