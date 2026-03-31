/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Logout Feature Test Suite
 * Tests the complete logout flow including:
 * - Session destruction
 * - Cookie clearing
 * - Route protection
 * - API authorization
 */

const { requireEnv } = require('./scripts/load-env');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const TEST_USER = {
  email: 'test-logout-' + Date.now() + '@example.com',
  password: 'TestPassword123!'
};

let cookies = [];
let testResults = [];

function log(level, message) {
  const timestamp = new Date().toISOString();
  const prefix = level === 'PASS' ? '✅' : level === 'FAIL' ? '❌' : level === 'INFO' ? 'ℹ️' : '⚠️';
  console.log(`${prefix} [${timestamp}] ${message}`);
  
  if (level === 'PASS' || level === 'FAIL') {
    testResults.push({ level, message, timestamp });
  }
}

async function fetchWithCookies(url, options = {}) {
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
    },
    credentials: 'include'
  });
}

function extractCookies(response) {
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    setCookie.split(',').forEach(cookie => {
      const [nameValue] = cookie.trim().split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        const existing = cookies.findIndex(c => c.name === name);
        if (existing >= 0) {
          cookies[existing] = { name, value: decodeURIComponent(value) };
        } else {
          cookies.push({ name, value: decodeURIComponent(value) });
        }
      }
    });
  }
  return response;
}

// Test 1: Signup
async function testSignup() {
  log('INFO', '=== Test 1: User Signup ===');
  
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
      data: { full_name: 'Logout Test User' }
    })
  });
  
  const data = await response.json();
  
  if (data.user || data.session) {
    log('PASS', 'Signup successful');
    if (data.session) {
      extractCookies({ headers: { get: (h) => h === 'set-cookie' ? null : data.session.access_token } });
    }
    return true;
  } else {
    log('FAIL', `Signup failed: ${JSON.stringify(data)}`);
    return false;
  }
}

// Test 2: Login
async function testLogin() {
  log('INFO', '=== Test 2: User Login ===');
  
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password
    })
  });
  
  const data = await response.json();
  
  if (data.access_token) {
    log('PASS', 'Login successful, access token received');
    // Extract session cookies from response headers
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      setCookieHeader.split(',').forEach(cookie => {
        const [nameValue] = cookie.trim().split(';');
        const [name, value] = nameValue.split('=');
        if (name && value) {
          cookies.push({ name, value: decodeURIComponent(value) });
        }
      });
    }
    return data.access_token;
  } else {
    log('FAIL', `Login failed: ${JSON.stringify(data)}`);
    return null;
  }
}

// Test 3: Verify session works
async function testSession(accessToken) {
  log('INFO', '=== Test 3: Session Verification ===');
  
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY
    }
  });
  
  const data = await response.json();
  
  if (data.id) {
    log('PASS', `Session valid for user: ${data.email}`);
    return true;
  } else {
    log('FAIL', `Session invalid: ${JSON.stringify(data)}`);
    return false;
  }
}

// Test 4: Logout
async function testLogout(accessToken) {
  log('INFO', '=== Test 4: Logout ===');
  
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  
  const response = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
      'Cookie': cookieHeader
    }
  });
  
  // Check for set-cookie headers that should clear the session
  const setCookieHeader = response.headers.get('set-cookie');
  const initialCookieCount = cookies.length;
  
  if (setCookieHeader) {
    // Look for cookies being cleared (empty value or expired)
    let foundClearCookie = false;
    setCookieHeader.split(',').forEach(cookie => {
      const match = cookie.match(/(\w+)=([^;]*)/);
      if (match) {
        const name = match[1];
        const value = match[2];
        if (value === '' || cookie.includes('Max-Age=0')) {
          foundClearCookie = true;
          const existing = cookies.findIndex(c => c.name === name);
          if (existing >= 0) {
            cookies.splice(existing, 1);
          }
        }
      }
    });
    
    if (foundClearCookie) {
      log('PASS', 'Session cookies were cleared');
    } else {
      log('INFO', 'No explicit cookie clearing in response');
    }
  }
  
  if (response.ok || response.status === 204 || response.status === 200) {
    log('PASS', 'Logout request successful');
    return true;
  } else {
    log('FAIL', `Logout request failed with status: ${response.status}`);
    return false;
  }
}

// Test 5: Verify session destroyed after logout
async function testSessionDestroyed(accessToken) {
  log('INFO', '=== Test 5: Session Destruction Verification ===');
  
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
      'Cookie': cookieHeader
    }
  });
  
  const data = await response.json();
  
  if (response.status === 401 || data.error || !data.id) {
    log('PASS', 'Session correctly destroyed after logout');
    return true;
  } else {
    log('FAIL', 'Session still valid after logout!');
    return false;
  }
}

// Test 6: Test Supabase signOut API directly
async function testSupabaseSignOut() {
  log('INFO', '=== Test 6: Supabase signOut API Test ===');
  
  // First login to get fresh session
  const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password
    })
  });
  
  const loginData = await loginResponse.json();
  
  if (!loginData.access_token) {
    log('FAIL', 'Cannot test signOut without valid session');
    return false;
  }
  
  // Clear cookies and rebuild from login
  cookies = [];
  const setCookieHeader = loginResponse.headers.get('set-cookie');
  if (setCookieHeader) {
    setCookieHeader.split(',').forEach(cookie => {
      const [nameValue] = cookie.trim().split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        cookies.push({ name, value: decodeURIComponent(value) });
      }
    });
  }
  
  const token = loginData.access_token;
  
  // Test signOut
  const signOutResponse = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    }
  });
  
  log('INFO', `signOut response status: ${signOutResponse.status}`);
  
  // Check if session is invalid after signOut
  const verifyResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON_KEY
    }
  });
  
  const verifyData = await verifyResponse.json();
  
  if (verifyResponse.status === 401 || verifyData.error) {
    log('PASS', 'signOut correctly invalidates session');
    return true;
  } else {
    log('FAIL', `Session still valid after signOut. Status: ${verifyResponse.status}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('\n🔍 LOGOUT FEATURE TEST SUITE');
  console.log('==============================\n');
  
  log('INFO', `Testing against Supabase at: ${SUPABASE_URL}`);
  log('INFO', `Test user email: ${TEST_USER.email}`);
  
  try {
    // Run tests
    const signupSuccess = await testSignup();
    if (!signupSuccess) {
      log('INFO', 'Signup may have failed - continuing with login test anyway');
    }
    
    const accessToken = await testLogin();
    if (!accessToken) {
      log('FAIL', 'Cannot continue tests without valid login');
      printSummary();
      return;
    }
    
    const sessionValid = await testSession(accessToken);
    if (!sessionValid) {
      log('FAIL', 'Session verification failed');
    }
    
    const logoutSuccess = await testLogout(accessToken);
    
    const sessionDestroyed = await testSessionDestroyed(accessToken);
    
    // Additional direct API test
    await testSupabaseSignOut();
    
  } catch (error) {
    log('FAIL', `Test error: ${error.message}`);
    console.error(error);
  }
  
  printSummary();
}

function printSummary() {
  console.log('\n📊 TEST SUMMARY');
  console.log('=================\n');
  
  const passed = testResults.filter(r => r.level === 'PASS').length;
  const failed = testResults.filter(r => r.level === 'FAIL').length;
  
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.filter(r => r.level === 'FAIL').forEach(r => {
      console.log(`  - ${r.message}`);
    });
  }
  
  console.log('\n🍪 Current Cookies:');
  cookies.forEach(c => {
    console.log(`  - ${c.name}: ${c.value.substring(0, 20)}...`);
  });
  
  console.log('\n');
}

// Run tests
runTests().catch(console.error);
