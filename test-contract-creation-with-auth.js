/**
 * Test Contract Creation and Contract Detail View Features with Authentication
 * 
 * This script tests:
 * 1. User signup/login
 * 2. Contract creation via API
 * 3. Contract detail retrieval via API
 * 4. Data integrity between creation and retrieval
 */

const API_BASE = 'http://localhost:3000';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  console.log(`\n${colors.bold}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  ${testName}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

// Test data for contract creation
const testContractData = {
  vendorName: 'Test Vendor Inc.',
  contractName: 'Test Contract - Integration Test',
  contractType: 'services',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  cost: 15000.00,
  currency: 'USD',
  status: 'active',
  description: 'This is a test contract for integration testing',
  reminders: [
    {
      id: '1',
      daysBefore: 30,
      type: 'email',
      message: 'Contract expires in 30 days'
    },
    {
      id: '2',
      daysBefore: 7,
      type: 'email',
      message: 'Contract expires in 7 days'
    }
  ]
};

// Test user credentials
const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!'
};

// Store cookies for authenticated requests
let authCookies = '';

/**
 * Helper function to extract cookies from response headers
 */
function extractCookies(response) {
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    // Parse all cookies from the set-cookie header
    const cookies = setCookieHeader.split(',').map(cookie => {
      const [nameValue] = cookie.trim().split(';');
      return nameValue.trim();
    }).join('; ');
    return cookies;
  }
  return '';
}

/**
 * Test 1: User Signup
 */
async function testUserSignup() {
  logTest('TEST 1: User Signup');
  
  try {
    logInfo('Creating test user...');
    logInfo(`Email: ${testUser.email}`);
    
    const response = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    logInfo(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      logError(`Failed to signup user`);
      logError(`Status: ${response.status}`);
      logError(`Response: ${errorText}`);
      return false;
    }

    // Extract auth cookies
    authCookies = extractCookies(response);
    
    const result = await response.json();
    logSuccess('User signed up successfully!');
    logInfo(`User ID: ${result.user?.id}`);
    
    return true;
  } catch (error) {
    logError(`Error signing up: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Create Contract (with auth)
 */
async function testCreateContract() {
  logTest('TEST 2: Contract Creation (Authenticated)');
  
  if (!authCookies) {
    logError('No auth cookies available. Skipping test.');
    return null;
  }

  try {
    logInfo('Creating contract with test data...');
    logInfo(`Vendor: ${testContractData.vendorName}`);
    logInfo(`Contract: ${testContractData.contractName}`);
    logInfo(`Dates: ${testContractData.startDate} to ${testContractData.endDate}`);
    
    const response = await fetch(`${API_BASE}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookies,
      },
      body: JSON.stringify(testContractData),
    });

    logInfo(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      logError(`Failed to create contract`);
      logError(`Status: ${response.status}`);
      logError(`Response: ${errorText}`);
      return null;
    }

    const createdContract = await response.json();
    logSuccess('Contract created successfully!');
    logInfo(`Contract ID: ${createdContract.data?.id}`);
    logInfo(`Vendor: ${createdContract.data?.vendor}`);
    logInfo(`Contract: ${createdContract.data?.name}`);
    logInfo(`Status: ${createdContract.data?.status}`);
    logInfo(`Created at: ${createdContract.data?.created_at}`);
    
    return createdContract.data;
  } catch (error) {
    logError(`Error creating contract: ${error.message}`);
    return null;
  }
}

/**
 * Test 3: Get Contract Details (with auth)
 */
async function testGetContractDetails(contractId) {
  logTest('TEST 3: Contract Detail View (Authenticated)');
  
  if (!contractId) {
    logError('No contract ID provided. Skipping test.');
    return null;
  }

  if (!authCookies) {
    logError('No auth cookies available. Skipping test.');
    return null;
  }

  try {
    logInfo(`Fetching contract details for ID: ${contractId}`);
    
    const response = await fetch(`${API_BASE}/api/contracts/${contractId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookies,
      },
    });

    logInfo(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      logError(`Failed to fetch contract details`);
      logError(`Status: ${response.status}`);
      logError(`Response: ${errorText}`);
      return null;
    }

    const contractDetails = await response.json();
    logSuccess('Contract details fetched successfully!');
    
    // Display contract details
    logInfo('\n--- Contract Details ---');
    logInfo(`ID: ${contractDetails.data?.id}`);
    logInfo(`Vendor: ${contractDetails.data?.vendor}`);
    logInfo(`Contract: ${contractDetails.data?.name}`);
    logInfo(`Type: ${contractDetails.data?.type}`);
    logInfo(`Status: ${contractDetails.data?.status}`);
    logInfo(`Start Date: ${contractDetails.data?.start_date}`);
    logInfo(`End Date: ${contractDetails.data?.end_date}`);
    logInfo(`Cost: ${contractDetails.data?.value} ${contractDetails.data?.currency}`);
    logInfo(`Description: ${contractDetails.data?.notes || 'N/A'}`);
    logInfo(`Created At: ${contractDetails.data?.created_at}`);
    logInfo(`Updated At: ${contractDetails.data?.updated_at}`);
    
    // Display reminders if any
    if (contractDetails.data?.reminder_days && contractDetails.data.reminder_days.length > 0) {
      logInfo(`\n--- Reminder Days (${contractDetails.data.reminder_days.length}) ---`);
      contractDetails.data.reminder_days.forEach((days, index) => {
        logInfo(`  ${index + 1}. ${days} days before expiration`);
      });
    } else {
      logInfo('\n--- No Reminder Days ---');
    }
    
    return contractDetails.data;
  } catch (error) {
    logError(`Error fetching contract details: ${error.message}`);
    return null;
  }
}

/**
 * Test 4: List All Contracts (with auth)
 */
async function testListContracts() {
  logTest('TEST 4: List All Contracts (Authenticated)');
  
  if (!authCookies) {
    logError('No auth cookies available. Skipping test.');
    return [];
  }

  try {
    logInfo('Fetching all contracts...');
    
    const response = await fetch(`${API_BASE}/api/contracts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookies,
      },
    });

    logInfo(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      logError(`Failed to fetch contracts list`);
      logError(`Status: ${response.status}`);
      logError(`Response: ${errorText}`);
      return [];
    }

    const result = await response.json();
    const contracts = result.data || [];
    logSuccess(`Fetched ${contracts.length} contract(s)`);
    
    if (contracts.length > 0) {
      logInfo('\n--- Contracts List ---');
      contracts.forEach((contract, index) => {
        logInfo(`${index + 1}. ${contract.name} (${contract.vendor})`);
        logInfo(`   Status: ${contract.status} | Cost: ${contract.value} ${contract.currency}`);
        logInfo(`   ID: ${contract.id}\n`);
      });
    } else {
      logWarning('No contracts found in database');
    }
    
    return contracts;
  } catch (error) {
    logError(`Error fetching contracts list: ${error.message}`);
    return [];
  }
}

/**
 * Test 5: Verify Data Integrity
 */
async function testDataIntegrity(createdContract, retrievedContract) {
  logTest('TEST 5: Data Integrity Verification');
  
  if (!createdContract || !retrievedContract) {
    logError('Missing contract data. Skipping integrity test.');
    return false;
  }

  const checks = [
    {
      name: 'Contract ID',
      expected: createdContract.id,
      actual: retrievedContract.id,
    },
    {
      name: 'Vendor Name',
      expected: testContractData.vendorName,
      actual: retrievedContract.vendor,
    },
    {
      name: 'Contract Name',
      expected: testContractData.contractName,
      actual: retrievedContract.name,
    },
    {
      name: 'Contract Type',
      expected: testContractData.contractType,
      actual: retrievedContract.type,
    },
    {
      name: 'Start Date',
      expected: testContractData.startDate,
      actual: retrievedContract.start_date,
    },
    {
      name: 'End Date',
      expected: testContractData.endDate,
      actual: retrievedContract.end_date,
    },
    {
      name: 'Cost',
      expected: testContractData.cost,
      actual: parseFloat(retrievedContract.value),
    },
    {
      name: 'Currency',
      expected: testContractData.currency,
      actual: retrievedContract.currency,
    },
    {
      name: 'Status',
      expected: testContractData.status,
      actual: retrievedContract.status,
    },
    {
      name: 'Description',
      expected: testContractData.description,
      actual: retrievedContract.notes,
    },
  ];

  let allPassed = true;
  
  checks.forEach(check => {
    const passed = String(check.expected) === String(check.actual);
    if (passed) {
      logSuccess(`${check.name}: ✓ ${check.actual}`);
    } else {
      logError(`${check.name}: ✗ Expected "${check.expected}", got "${check.actual}"`);
      allPassed = false;
    }
  });

  return allPassed;
}

/**
 * Main Test Runner
 */
async function runTests() {
  console.log(`\n${colors.bold}${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}║  Contract Creation & Detail View Integration Test            ║${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}║  (With Authentication)                                     ║${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  logInfo(`API Base URL: ${API_BASE}`);
  logInfo(`Starting tests at: ${new Date().toISOString()}\n`);

  // Run tests
  const signupPassed = await testUserSignup();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  
  const createdContract = await testCreateContract();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  
  const retrievedContract = await testGetContractDetails(createdContract?.id);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  
  const integrityPassed = await testDataIntegrity(createdContract, retrievedContract);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  
  await testListContracts();

  // Summary
  logTest('TEST SUMMARY');
  
  const results = [
    { name: 'User Signup', passed: signupPassed },
    { name: 'Contract Creation', passed: !!createdContract },
    { name: 'Contract Detail View', passed: !!retrievedContract },
    { name: 'Data Integrity', passed: integrityPassed },
  ];

  results.forEach(result => {
    if (result.passed) {
      logSuccess(`${result.name}: PASSED`);
    } else {
      logError(`${result.name}: FAILED`);
    }
  });

  const allPassed = results.every(r => r.passed);
  
  console.log(`\n${colors.bold}${allPassed ? colors.green : colors.red}═════════════════════════════════════════════════════════════${colors.reset}`);
  
  if (allPassed) {
    logSuccess('ALL TESTS PASSED! ✓');
    logInfo('Contract creation and detail view features are working correctly.');
    logInfo('Authentication is properly integrated.');
  } else {
    logError('SOME TESTS FAILED! ✗');
    logWarning('Please review errors above and fix the issues.');
  }
  
  console.log(`${colors.bold}${allPassed ? colors.green : colors.red}═════════════════════════════════════════════════════════════${colors.reset}\n`);
  
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
