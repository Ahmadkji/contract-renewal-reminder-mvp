/**
 * Test Contract Creation and Contract Detail View Features
 * 
 * This script tests:
 * 1. Contract creation via API
 * 2. Contract detail retrieval via API
 * 3. Data integrity between creation and retrieval
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

/**
 * Test 1: Create Contract
 */
async function testCreateContract() {
  logTest('TEST 1: Contract Creation');
  
  try {
    logInfo('Creating contract with test data...');
    logInfo(`Vendor: ${testContractData.vendorName}`);
    logInfo(`Contract: ${testContractData.contractName}`);
    logInfo(`Dates: ${testContractData.startDate} to ${testContractData.endDate}`);
    
    const response = await fetch(`${API_BASE}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    logInfo(`Contract ID: ${createdContract.id}`);
    logInfo(`Vendor: ${createdContract.vendor_name}`);
    logInfo(`Contract: ${createdContract.contract_name}`);
    logInfo(`Status: ${createdContract.status}`);
    logInfo(`Created at: ${createdContract.created_at}`);
    
    return createdContract;
  } catch (error) {
    logError(`Error creating contract: ${error.message}`);
    return null;
  }
}

/**
 * Test 2: Get Contract Details
 */
async function testGetContractDetails(contractId) {
  logTest('TEST 2: Contract Detail View');
  
  if (!contractId) {
    logError('No contract ID provided. Skipping test.');
    return null;
  }

  try {
    logInfo(`Fetching contract details for ID: ${contractId}`);
    
    const response = await fetch(`${API_BASE}/api/contracts/${contractId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
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
    logInfo(`ID: ${contractDetails.id}`);
    logInfo(`Vendor: ${contractDetails.vendor_name}`);
    logInfo(`Contract: ${contractDetails.contract_name}`);
    logInfo(`Type: ${contractDetails.contract_type}`);
    logInfo(`Status: ${contractDetails.status}`);
    logInfo(`Start Date: ${contractDetails.start_date}`);
    logInfo(`End Date: ${contractDetails.end_date}`);
    logInfo(`Cost: ${contractDetails.cost} ${contractDetails.currency}`);
    logInfo(`Description: ${contractDetails.description || 'N/A'}`);
    logInfo(`Created At: ${contractDetails.created_at}`);
    logInfo(`Updated At: ${contractDetails.updated_at}`);
    
    // Display reminders if any
    if (contractDetails.reminders && contractDetails.reminders.length > 0) {
      logInfo(`\n--- Reminders (${contractDetails.reminders.length}) ---`);
      contractDetails.reminders.forEach((reminder, index) => {
        logInfo(`  ${index + 1}. ${reminder.days_before} days before - ${reminder.type}: ${reminder.message}`);
      });
    } else {
      logInfo('\n--- No Reminders ---');
    }
    
    return contractDetails;
  } catch (error) {
    logError(`Error fetching contract details: ${error.message}`);
    return null;
  }
}

/**
 * Test 3: Verify Data Integrity
 */
async function testDataIntegrity(createdContract, retrievedContract) {
  logTest('TEST 3: Data Integrity Verification');
  
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
      actual: retrievedContract.vendor_name,
    },
    {
      name: 'Contract Name',
      expected: testContractData.contractName,
      actual: retrievedContract.contract_name,
    },
    {
      name: 'Contract Type',
      expected: testContractData.contractType,
      actual: retrievedContract.contract_type,
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
      actual: parseFloat(retrievedContract.cost),
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
      actual: retrievedContract.description,
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

  // Check reminders
  const reminderCountMatch = 
    testContractData.reminders.length === (retrievedContract.reminders?.length || 0);
  
  if (reminderCountMatch) {
    logSuccess(`Reminder count: ✓ ${testContractData.reminders.length}`);
  } else {
    logError(`Reminder count: ✗ Expected ${testContractData.reminders.length}, got ${retrievedContract.reminders?.length || 0}`);
    allPassed = false;
  }

  return allPassed;
}

/**
 * Test 4: List All Contracts
 */
async function testListContracts() {
  logTest('TEST 4: List All Contracts');
  
  try {
    logInfo('Fetching all contracts...');
    
    const response = await fetch(`${API_BASE}/api/contracts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
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

    const contracts = await response.json();
    logSuccess(`Fetched ${contracts.length} contract(s)`);
    
    if (contracts.length > 0) {
      logInfo('\n--- Contracts List ---');
      contracts.forEach((contract, index) => {
        logInfo(`${index + 1}. ${contract.contract_name} (${contract.vendor_name})`);
        logInfo(`   Status: ${contract.status} | Cost: ${contract.cost} ${contract.currency}`);
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
 * Main Test Runner
 */
async function runTests() {
  console.log(`\n${colors.bold}${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}║  Contract Creation & Detail View Integration Test            ║${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  logInfo(`API Base URL: ${API_BASE}`);
  logInfo(`Starting tests at: ${new Date().toISOString()}\n`);

  // Run tests
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
  } else {
    logError('SOME TESTS FAILED! ✗');
    logWarning('Please review the errors above and fix the issues.');
  }
  
  console.log(`${colors.bold}${allPassed ? colors.green : colors.red}═════════════════════════════════════════════════════════════${colors.reset}\n`);
  
  process.exit(allPassed ? 0 : 1);
}

// Run the tests
runTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
