# Contract Creation E2E Tests

This directory contains end-to-end tests for the contract creation feature using Playwright.

## Prerequisites

1. Ensure you have a test user account set up in your application
2. Set environment variables for test credentials:
   ```bash
   export TEST_EMAIL="your-test-email@example.com"
   export TEST_PASSWORD="your-test-password"
   ```

## Running Tests

### Run all tests
```bash
npx playwright test
```

### Run tests in headed mode (visible browser)
```bash
npx playwright test --headed
```

### Run specific test file
```bash
npx playwright test contract-creation.spec.ts
```

### Run specific test
```bash
npx playwright test -g "should create contract successfully"
```

### Run tests in specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run tests in debug mode
```bash
npx playwright test --debug
```

### Run tests with UI mode
```bash
npx playwright test --ui
```

## Test Coverage

The test suite covers:

1. **Opening the contract creation form**
   - From dashboard
   - From mobile menu

2. **Filling form steps**
   - Basic Info (name, type, value, dates)
   - Vendor Information (vendor, contact, notes)
   - Reminders (selecting reminder days)

3. **Form validation**
   - Required field validation
   - Error messages display

4. **Form submission**
   - Successful contract creation
   - Loading states
   - Error handling

5. **User interactions**
   - Navigating between steps
   - Canceling form creation
   - Step indicator navigation

6. **Different contract types**
   - License
   - Service
   - Support
   - Subscription

7. **Mobile responsiveness**
   - Mobile menu access
   - Form filling on mobile viewport

## Test Data

Test contracts use the following default data:
- Name: Test Contract - Playwright
- Vendor: Test Vendor Inc.
- Type: service
- Value: 50000
- Duration: 1 year
- Reminders: 30, 7, 1 days before expiry

## Viewing Test Results

After running tests, view the HTML report:
```bash
npx playwright show-report
```

## Troubleshooting

### Tests fail to connect to server
Ensure the dev server is running:
```bash
npm run dev
```

### Authentication failures
Verify test credentials are correct:
```bash
echo $TEST_EMAIL
echo $TEST_PASSWORD
```

### Timeout errors
Increase timeout in `playwright.config.ts` if needed.

## CI/CD Integration

For CI/CD, set the `CI` environment variable:
```bash
export CI=true
npx playwright test
```

This will:
- Run tests in single worker mode
- Retry failed tests up to 2 times
- Generate JUnit XML reports
