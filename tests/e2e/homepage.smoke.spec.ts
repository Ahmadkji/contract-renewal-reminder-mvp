import { test, expect } from '@playwright/test'

test.describe('Homepage smoke', () => {
  test('renders landing page shell', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Renewly/i)
    await expect(page.getByText(/Track contracts/i).first()).toBeVisible()
  })
})
