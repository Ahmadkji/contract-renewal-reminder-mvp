import { test, expect, Page } from '@playwright/test';

// ============================================
// Test Data
// ============================================
const testContract = {
  name: 'Test Contract - Playwright',
  vendor: 'Test Vendor Inc.',
  type: 'service',
  value: 50000,
  startDate: new Date(),
  endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  reminderDays: [30, 7, 1],
  notes: 'This is a test contract created by Playwright',
  contactEmail: 'test@example.com',
  contactPhone: '+1-555-123-4567'
};

// ============================================
// Helper Functions
// ============================================
async function login(page: Page) {
  await page.goto('/login');
  await expect(page.locator('h1')).toContainText('Welcome back');
  await page.fill('input[type="email"]', process.env.TEST_EMAIL || 'test@example.com');
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'testpassword123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard', { timeout: 10000 });
  await expect(page).toHaveURL(/\/dashboard/);
}

async function openAddContractForm(page: Page) {
  await page.click('button:has-text("Add Contract")');
  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('[role="dialog"] h2')).toContainText('Add New Contract');
}

async function fillBasicInfoStep(page: Page) {
  await page.fill('input[name="name"]', testContract.name);
  await page.click('select[name="type"]');
  await page.click(`option[value="${testContract.type}"]`);
  await page.fill('input[name="value"]', testContract.value.toString());
  
  const startDay = new Date().getDate();
  await page.click('input[name="startDate"]');
  await page.click(`[aria-label*="${startDay}"]`);
  
  const endDate = new Date(testContract.endDate);
  const endDay = endDate.getDate();
  const endMonth = endDate.toLocaleString('default', { month: 'long' });
  
  await page.click('input[name="endDate"]');
  await page.click(`[aria-label*="${endMonth}"]`);
  await page.click(`[aria-label*="${endDay}"]`);
  
  await page.click('button:has-text("Next")');
  await expect(page.locator('text=Vendor Information')).toBeVisible({ timeout: 3000 });
}

async function fillVendorStep(page: Page) {
  await page.fill('input[name="vendor"]', testContract.vendor);
  await page.fill('input[name="contactEmail"]', testContract.contactEmail);
  await page.fill('input[name="contactPhone"]', testContract.contactPhone);
  await page.fill('textarea[name="notes"]', testContract.notes);
  await page.click('button:has-text("Next")');
  await expect(page.locator('text=Reminders')).toBeVisible({ timeout: 3000 });
}

async function fillRemindersStep(page: Page) {
  for (const day of testContract.reminderDays) {
    await page.click(`button:has-text("${day} days before")`);
  }
  
  for (const day of testContract.reminderDays) {
    const dayButton = page.locator(`button:has-text("${day} days before")`);
    await expect(dayButton).toHaveClass(/bg-\[\.22c55e\]/);
  }
}

async function submitContractForm(page: Page) {
  await page.click('button:has-text("Create Contract")');
  await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('text=Contract created')).toBeVisible({ timeout: 5000 });
}

async function verifyContractCreated(page: Page) {
  await page.goto('/dashboard/contracts');
  await expect(page.locator('text=Contracts')).toBeVisible({ timeout: 5000 });
  await page.fill('input[placeholder*="Search"]', testContract.name);
  await page.waitForTimeout(500);
  await expect(page.locator(`text=${testContract.name}`)).toBeVisible({ timeout: 5000 });
}

// ============================================
// Test Suite
// ============================================
test.describe('Contract Creation Feature', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should open add contract form from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await openAddContractForm(page);
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text=Add New Contract')).toBeVisible();
  });

  test('should fill and submit basic info step', async ({ page }) => {
    await page.goto('/dashboard');
    await openAddContractForm(page);
    await fillBasicInfoStep(page);
    await expect(page.locator('text=Vendor Information')).toBeVisible();
  });

  test('should fill and submit vendor step', async ({ page }) => {
    await page.goto('/dashboard');
    await openAddContractForm(page);
    await fillBasicInfoStep(page);
    await fillVendorStep(page);
    await expect(page.locator('text=Reminders')).toBeVisible();
  });

  test('should fill and submit reminders step', async ({ page }) => {
    await page.goto('/dashboard');
    await openAddContractForm(page);
    await fillBasicInfoStep(page);
    await fillVendorStep(page);
    await fillRemindersStep(page);
    
    for (const day of testContract.reminderDays) {
      const dayButton = page.locator(`button:has-text("${day} days before")`);
      await expect(dayButton).toHaveClass(/bg-\[\.22c55e\]/);
    }
  });

  test('should create contract successfully', async ({ page }) => {
    await page.goto('/dashboard');
    await openAddContractForm(page);
    await fillBasicInfoStep(page);
    await fillVendorStep(page);
    await fillRemindersStep(page);
    await submitContractForm(page);
    await verifyContractCreated(page);
  });

  test('should show validation errors for required fields', async ({ page }) => {
    await page.goto('/dashboard');
    await openAddContractForm(page);
    await page.click('button:has-text("Next")');
    await expect(page.locator('text=required')).toBeVisible({ timeout: 2000 });
  });

  test('should cancel form creation', async ({ page }) => {
    await page.goto('/dashboard');
    await openAddContractForm(page);
    await page.fill('input[name="name"]', testContract.name);
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 3000 });
  });

  test('should navigate between steps using step indicators', async ({ page }) => {
    await page.goto('/dashboard');
    await openAddContractForm(page);
    await fillBasicInfoStep(page);
    await page.click('button:has-text("Basic Info")');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await page.click('button:has-text("Reminders")');
    await expect(page.locator('text=Reminders')).toBeVisible();
  });

  test('should show loading state during submission', async ({ page }) => {
    await page.goto('/dashboard');
    await openAddContractForm(page);
    await fillBasicInfoStep(page);
    await fillVendorStep(page);
    await fillRemindersStep(page);
    
    const createButton = page.locator('button:has-text("Create Contract")');
    await createButton.click();
    await expect(createButton.locator('svg.animate-spin')).toBeVisible({ timeout: 1000 });
    await expect(createButton).toContainText('Creating...');
  });

  test('should handle different contract types', async ({ page }) => {
    const types = ['license', 'service', 'support', 'subscription'];
    
    for (const type of types) {
      await page.goto('/dashboard');
      await openAddContractForm(page);
      await page.fill('input[name="name"]', `Test ${type} Contract`);
      await page.click('select[name="type"]');
      await page.click(`option[value="${type}"]`);
      await page.fill('input[name="value"]', '10000');
      await page.click('input[name="startDate"]');
      await page.click('[aria-label*="Choose date"]:first-child');
      await page.click('input[name="endDate"]');
      await page.click('[aria-label*="Choose date"]:first-child');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Create Contract")');
      await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });
      await page.waitForTimeout(1000);
    }
  });

  test('should show error toast on submission failure', async ({ page }) => {
    await page.route('**/api/contracts', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    await page.goto('/dashboard');
    await openAddContractForm(page);
    await fillBasicInfoStep(page);
    await fillVendorStep(page);
    await fillRemindersStep(page);
    await page.click('button:has-text("Create Contract")');
    await expect(page.locator('text=Failed to create contract')).toBeVisible({ timeout: 5000 });
  });

  test('should persist form data when navigating between steps', async ({ page }) => {
    await page.goto('/dashboard');
    await openAddContractForm(page);
    await page.fill('input[name="name"]', testContract.name);
    await page.click('select[name="type"]');
    await page.click(`option[value="${testContract.type}"]`);
    await page.fill('input[name="value"]', testContract.value.toString());
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Back")');
    await expect(page.locator('input[name="name"]')).toHaveValue(testContract.name);
    await expect(page.locator('select[name="type"]')).toHaveValue(testContract.type);
    await expect(page.locator('input[name="value"]')).toHaveValue(testContract.value.toString());
  });
});

// ============================================
// Mobile Responsive Tests
// ============================================
test.describe('Contract Creation - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should open form from mobile menu', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('button[aria-label*="menu"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.click('button:has-text("Add Contract")');
    await expect(page.locator('[role="dialog"]:has-text("Add New Contract")')).toBeVisible();
  });

  test('should fill form on mobile viewport', async ({ page }) => {
    await page.goto('/dashboard');
    await openAddContractForm(page);
    await page.fill('input[name="name"]', testContract.name);
    await page.click('select[name="type"]');
    await page.click(`option[value="${testContract.type}"]`);
    await page.fill('input[name="value"]', testContract.value.toString());
    await page.click('button:has-text("Next")');
    await page.fill('input[name="vendor"]', testContract.vendor);
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Create Contract")');
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });
  });
});
