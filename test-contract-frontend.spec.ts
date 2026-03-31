import { loadEnvConfig } from '@next/env';
import { test, expect } from '@playwright/test';

loadEnvConfig(process.cwd());

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const TEST_EMAIL = `frontend-test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

test.describe('Contract Creation from Frontend', () => {
  let testUserId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    // Create a test user via Supabase Admin API
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const response = await page.request.post(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true
      }
    });

    const data = await response.json();
    testUserId = data.id;
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup test user
    if (testUserId) {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.request.delete(`${SUPABASE_URL}/auth/v1/admin/users/${testUserId}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY
        }
      });
      
      await context.close();
    }
  });

  test('should create a contract from the frontend', async ({ page }) => {
    // Step 1: Navigate to login page
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    // Step 2: Sign in with test user
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 30000 });

    // Step 3: Click "Add Contract" button in header
    await page.click('button:has-text("Add Contract")');
    
    // Wait for form to open
    await page.waitForSelector('text=Add New Contract', { timeout: 5000 });

    // Step 4: Fill in Basic Info using placeholder text
    // The placeholder is "e.g., Microsoft 365 Enterprise"
    await page.fill('input[placeholder*="Microsoft"]', 'Frontend Test Contract');
    
    // The Select component is custom, click to open and select type
    await page.click('button:has-text("Select type")');
    await page.click('button:has-text("Service")');
    
    // The DatePickers are custom components - click to open and select date
    // Start date
    const startDateBtn = page.locator('button').filter({ hasText: 'Select start date' });
    await startDateBtn.click();
    // Select a day in the calendar (e.g., day 15)
    await page.locator('button:has-text("15")').first().click();
    
    // End date
    const endDateBtn = page.locator('button').filter({ hasText: 'Select end date' });
    await endDateBtn.click();
    // Select a day in the calendar (e.g., day 15, next year)
    await page.locator('button:has-text("15")').first().click();

    // Click Next
    await page.click('button:has-text("Next")');

    // Wait for Vendor step
    await page.waitForTimeout(500);

    // Step 5: Vendor step (optional - skip or fill)
    await page.click('button:has-text("Next")');

    // Wait for Reminders step
    await page.waitForTimeout(500);

    // Step 6: Reminders step - just click Create
    const createButton = page.locator('button[type="button"]:has-text("Create Contract")');
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Wait for success toast
    await page.waitForSelector('text=Contract created', { timeout: 10000 });

    // Verify success
    await expect(page.locator('text=Contract created')).toBeVisible();
    await expect(page.locator('text=Frontend Test Contract has been added')).toBeVisible();

    console.log('✅ Contract created successfully from frontend!');
  });
});
