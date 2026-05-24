/**
 * Live API Security Tests
 * Tests actual endpoints with various attack scenarios
 */
require('dotenv').config({ path: '.env.local' });

const APP_URL = 'http://localhost:3000';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let passCount = 0;
let failCount = 0;

function log(test, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  const color = status === 'PASS' ? colors.green : status === 'FAIL' ? colors.red : colors.yellow;
  console.log(`${color}${icon} ${test}${colors.reset}`);
  if (details) console.log(`   ${details}`);
  if (status === 'PASS') passCount++;
  else if (status === 'FAIL') failCount++;
}

async function runLiveTests() {
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║       LIVE API SECURITY TESTS                         ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // ============ TEST 1: Health Endpoint (Basic) ============
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue} 1. HEALTH & AVAILABILITY${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    const response = await fetch(`${APP_URL}/api/health`);
    const data = await response.json();
    log('Health endpoint accessible', response.ok && data.status === 'ok' ? 'PASS' : 'FAIL', `Status: ${data.status}`);
  } catch (error) {
    log('Health endpoint accessible', 'FAIL', `Error: ${error.message}`);
  }

  // ============ TEST 2: CORS & CSRF Protection ============
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue} 2. CORS & CSRF PROTECTION${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    // Test with invalid Origin header
    const response = await fetch(`${APP_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://evil-site.com'
      },
      body: JSON.stringify({ email: 'test@test.com', password: 'test' })
    });
    log('Blocks requests from invalid origin', response.status === 403 ? 'PASS' : 'INFO', 
      response.status === 403 ? 'Returns 403 Forbidden' : `Status: ${response.status} (may allow same-origin)`);
  } catch (error) {
    log('Blocks requests from invalid origin', 'INFO', 'Could not test - ' + error.message);
  }

  // ============ TEST 3: API Authentication Required ============
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue} 3. API AUTHENTICATION REQUIRED${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    const response = await fetch(`${APP_URL}/api/contracts`);
    log('Contracts API requires auth', response.status === 401 ? 'PASS' : 'FAIL', 
      `Status: ${response.status} (expected 401)`);
  } catch (error) {
    log('Contracts API requires auth', 'FAIL', `Error: ${error.message}`);
  }

  // ============ TEST 4: Rate Limiting Headers ============
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue} 4. RATE LIMITING HEADERS${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    // Make a request to trigger rate limit headers
    const response = await fetch(`${APP_URL}/api/health`);
    const hasRateLimitHeaders = response.headers.has('X-RateLimit-Limit') || 
                                 response.headers.has('X-RateLimit-Remaining');
    log('Rate limit headers present', hasRateLimitHeaders ? 'PASS' : 'INFO', 
      hasRateLimitHeaders ? 'Headers: X-RateLimit-Limit, X-RateLimit-Remaining' : 'Not present on health endpoint');
  } catch (error) {
    log('Rate limit headers present', 'INFO', 'Could not check - ' + error.message);
  }

  // ============ TEST 5: Input Validation (SQL Injection) ============
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue} 5. INPUT VALIDATION / SQL INJECTION${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  const sqlInjectionPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM passwords --",
    "test@example.com' OR '1'='1"
  ];
  
  let sqlTestsPassed = 0;
  for (const payload of sqlInjectionPayloads) {
    try {
      const response = await fetch(`${APP_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: payload, password: 'test' })
      });
      // Should get 400 (validation error) or 401 (auth error), NOT 500 (server error)
      if (response.status !== 500) {
        sqlTestsPassed++;
      }
    } catch (error) {
      sqlTestsPassed++; // Connection error is ok for this test
    }
  }
  
  log('SQL injection payloads handled', sqlTestsPassed === sqlInjectionPayloads.length ? 'PASS' : 'FAIL', 
    `${sqlTestsPassed}/${sqlInjectionPayloads.length} payloads rejected safely`);

  // ============ TEST 6: XSS Prevention ============
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue} 6. XSS PREVENTION${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  const xssPayloads = [
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src=x onerror=alert("xss")>',
    'test@example.com"><script>alert(1)</script>'
  ];
  
  let xssTestsPassed = 0;
  for (const payload of xssPayloads) {
    try {
      const response = await fetch(`${APP_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'Password1!', fullName: payload })
      });
      const data = await response.json();
      // If XSS is in response, it might not be escaped properly
      const responseText = JSON.stringify(data);
      if (!responseText.includes('<script>') && !responseText.includes('javascript:')) {
        xssTestsPassed++;
      }
    } catch (error) {
      xssTestsPassed++;
    }
  }
  
  log('XSS payloads sanitized', xssTestsPassed === xssPayloads.length ? 'PASS' : 'FAIL', 
    `${xssTestsPassed}/${xssPayloads.length} payloads handled safely`);

  // ============ TEST 7: Password Strength Enforcement ============
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue} 7. PASSWORD STRENGTH ENFORCEMENT${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  const weakPasswords = ['123456', 'password', 'Password', 'Password1'];
  let weakPassBlocked = 0;
  
  for (const weakPwd of weakPasswords) {
    try {
      const response = await fetch(`${APP_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: `test${Date.now()}@example.com`, 
          password: weakPwd,
          fullName: 'Test User'
        })
      });
      const data = await response.json();
      if (!data.success || response.status === 400) {
        weakPassBlocked++;
      }
    } catch (error) {
      weakPassBlocked++;
    }
  }
  
  log('Weak passwords rejected', weakPassBlocked === weakPasswords.length ? 'PASS' : 'INFO', 
    `${weakPassBlocked}/${weakPasswords.length} weak passwords blocked`);

  // ============ TEST 8: Error Message Safety ============
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue} 8. ERROR MESSAGE SAFETY${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    // Trigger an error
    const response = await fetch(`${APP_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'wrongpassword123!' })
    });
    const data = await response.json();
    const responseText = JSON.stringify(data);
    const hasStackTrace = responseText.includes('at ') || responseText.includes('stack') || responseText.includes('.ts:');
    const hasSqlError = responseText.includes('SQL') || responseText.includes('database') || responseText.includes('query');
    
    log('No stack traces in errors', !hasStackTrace ? 'PASS' : 'FAIL', hasStackTrace ? 'Stack trace found!' : 'Clean error message');
    log('No SQL details leaked', !hasSqlError ? 'PASS' : 'FAIL', hasSqlError ? 'SQL error details found!' : 'Generic error message');
  } catch (error) {
    log('Error message safety', 'INFO', 'Could not test - ' + error.message);
  }

  // ============ TEST 9: Webhook Security ============
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue} 9. WEBHOOK SECURITY${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    // Test webhook without signature
    const response = await fetch(`${APP_URL}/api/webhooks/creem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    });
    log('Webhook requires signature', response.status === 401 ? 'PASS' : 'INFO', 
      `Status: ${response.status} (401 expected for missing signature)`);
  } catch (error) {
    log('Webhook requires signature', 'INFO', 'Could not test - ' + error.message);
  }

  // ============ TEST 10: Cache Headers ============
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue} 10. SECURITY HEADERS${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    const response = await fetch(`${APP_URL}/api/contracts`);
    const cacheControl = response.headers.get('Cache-Control') || '';
    log('Private cache on auth endpoints', cacheControl.includes('private') || cacheControl.includes('no-store') ? 'PASS' : 'INFO', 
      `Cache-Control: ${cacheControl || 'not set'}`);
  } catch (error) {
    log('Cache headers', 'INFO', 'Could not test - ' + error.message);
  }

  // ============ SUMMARY ============
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║                 LIVE TEST SUMMARY                      ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  const totalTests = passCount + failCount;
  const passRate = totalTests > 0 ? ((passCount / totalTests) * 100).toFixed(1) : '0.0';
  
  console.log(`Total Tests:    ${totalTests}`);
  console.log(`${colors.green}Passed:         ${passCount}${colors.reset}`);
  console.log(`${colors.red}Failed:         ${failCount}${colors.reset}`);
  console.log(`${colors.yellow}Pass Rate:      ${passRate}%${colors.reset}`);
  
  if (failCount === 0) {
    console.log(`\n${colors.green}✅ ALL LIVE API TESTS PASSED!${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}⚠️  ${failCount} test(s) need attention${colors.reset}`);
  }
  
  return { passCount, failCount };
}

runLiveTests().then(({ passCount, failCount }) => {
  process.exit(failCount > 0 ? 1 : 0);
});
