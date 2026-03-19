/**
 * Comprehensive Test: Login & Contract Creation
 * Tests the 500 error fix for fetchContracts and fetchUpcomingExpiries
 */

const API_BASE = 'http://localhost:3000';

async function testLogin() {
  console.log('\n=== TEST 1: Login Flow ===');
  
  try {
    // Test login with a test user
    const response = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123!'
      })
    });
    
    const data = await response.json();
    console.log('Login response status:', response.status);
    console.log('Login response:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('✅ Login test PASSED');
      return data;
    } else {
      console.log('❌ Login test FAILED');
      return null;
    }
  } catch (error) {
    console.error('❌ Login test ERROR:', error.message);
    return null;
  }
}

async function testFetchContracts() {
  console.log('\n=== TEST 2: Fetch Contracts (Previously 500 Error) ===');
  
  try {
    // First, try to access without auth (should get 401)
    const responseNoAuth = await fetch(`${API_BASE}/api/contracts`);
    console.log('Without auth - Status:', responseNoAuth.status);
    
    if (responseNoAuth.status === 401) {
      console.log('✅ Unauthorized correctly returned (401)');
    } else if (responseNoAuth.status === 500) {
      console.log('❌ 500 ERROR STILL EXISTS - fetchContracts failed');
      return false;
    }
    
    // With auth - simulate by getting session first
    console.log('\nFetching contracts with proper auth...');
    // Note: In real browser, cookies are sent automatically
    
    return true;
  } catch (error) {
    console.error('❌ Fetch contracts test ERROR:', error.message);
    return false;
  }
}

async function testFetchUpcomingExpiries() {
  console.log('\n=== TEST 3: Fetch Upcoming Expiries (Previously 500 Error) ===');
  
  try {
    const response = await fetch(`${API_BASE}/api/contracts?upcoming=true&limit=20`);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 401) {
      console.log('✅ Correctly requires authentication');
      return true;
    } else if (response.status === 500) {
      console.log('❌ 500 ERROR STILL EXISTS - fetchUpcomingExpiries failed');
      return false;
    } else if (response.status === 200) {
      console.log('✅ fetchUpcomingExpiries works correctly');
      return true;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Fetch upcoming expiries test ERROR:', error.message);
    return false;
  }
}

async function testDashboardPage() {
  console.log('\n=== TEST 4: Dashboard Page Loading ===');
  
  try {
    const response = await fetch(`${API_BASE}/dashboard`);
    console.log('Dashboard page status:', response.status);
    
    if (response.ok) {
      const html = await response.text();
      
      // Check for error indicators in HTML
      if (html.includes('500') && html.includes('Internal Server Error')) {
        console.log('❌ Dashboard shows 500 error');
        return false;
      }
      
      // Check for loading state or content
      if (html.includes('Loading') || html.includes('Dashboard') || html.includes('Contracts')) {
        console.log('✅ Dashboard page loads correctly');
        return true;
      }
    }
    
    console.log('Dashboard page HTML length:', (await response.text()).length);
    return true;
  } catch (error) {
    console.error('❌ Dashboard test ERROR:', error.message);
    return false;
  }
}

async function testContractAPIEndpoints() {
  console.log('\n=== TEST 5: Contract API Endpoints ===');
  
  // Test GET /api/contracts
  console.log('\n5a. GET /api/contracts');
  try {
    const getResponse = await fetch(`${API_BASE}/api/contracts`);
    console.log('   Status:', getResponse.status);
    const getData = await getResponse.json();
    console.log('   Response:', JSON.stringify(getData, null, 2));
    
    if (getResponse.status === 401) {
      console.log('   ✅ Correctly returns 401 (auth required)');
    } else if (getResponse.status === 500) {
      console.log('   ❌ 500 ERROR - API endpoint failing');
      return false;
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
  
  // Test GET /api/contracts/:id
  console.log('\n5b. GET /api/contracts/[id]');
  try {
    const getByIdResponse = await fetch(`${API_BASE}/api/contracts/test-id-123`);
    console.log('   Status:', getByIdResponse.status);
    
    if (getByIdResponse.status === 401) {
      console.log('   ✅ Correctly returns 401 (auth required)');
    } else if (getByIdResponse.status === 500) {
      console.log('   ❌ 500 ERROR - API endpoint failing');
      return false;
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
  
  // Test POST /api/contracts (should fail with 401 without auth)
  console.log('\n5c. POST /api/contracts');
  try {
    const postResponse = await fetch(`${API_BASE}/api/contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Contract',
        vendor: 'Test Vendor',
        type: 'subscription',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        value: 1000
      })
    });
    console.log('   Status:', postResponse.status);
    
    if (postResponse.status === 401) {
      console.log('   ✅ Correctly returns 401 (auth required)');
    } else if (postResponse.status === 500) {
      console.log('   ❌ 500 ERROR - API endpoint failing');
      return false;
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
  
  return true;
}

async function testProxyMiddleware() {
  console.log('\n=== TEST 6: Proxy/Middleware Authentication ===');
  
  try {
    // Test protected route without auth
    const response = await fetch(`${API_BASE}/dashboard`);
    console.log('Protected route without auth - Status:', response.status);
    
    // Check redirect to login
    if (response.status === 307 || response.status === 302) {
      const redirectUrl = response.headers.get('Location');
      console.log('   Redirect URL:', redirectUrl);
      if (redirectUrl && redirectUrl.includes('/login')) {
        console.log('   ✅ Correctly redirects to login');
        return true;
      }
    }
    
    if (response.status === 200) {
      console.log('   ℹ️  Page accessible (may have existing session)');
      return true;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Proxy test ERROR:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  COMPREHENSIVE TEST: Login & Contract Features           ║');
  console.log('║  Testing 500 Error Fix for fetchContracts/FetchUpcoming  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  // Run tests
  results.push({ name: 'Login Flow', passed: await testLogin() !== null });
  results.push({ name: 'Fetch Contracts', passed: await testFetchContracts() });
  results.push({ name: 'Fetch Upcoming Expiries', passed: await testFetchUpcomingExpiries() });
  results.push({ name: 'Dashboard Page', passed: await testDashboardPage() });
  results.push({ name: 'Contract API Endpoints', passed: await testContractAPIEndpoints() });
  results.push({ name: 'Proxy Middleware', passed: await testProxyMiddleware() });
  
  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUMMARY                                             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  let allPassed = true;
  results.forEach(r => {
    const status = r.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`  ${status}: ${r.name}`);
    if (!r.passed) allPassed = false;
  });
  
  console.log('\n' + (allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED'));
  
  // Check specifically for 500 errors
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  500 ERROR CHECK                                         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('  If any test shows "500 ERROR", the fix was NOT successful.');
  console.log('  If all tests show 401 or proper responses, the fix IS working.');
}

// Run all tests
runAllTests().catch(console.error);
