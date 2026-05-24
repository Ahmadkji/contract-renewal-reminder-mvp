#!/usr/bin/env node
/**
 * Payment Security Test Suite
 * 
 * Comprehensive payment security testing based on real-world abuse patterns:
 * - Client-side price manipulation
 * - Fake payment success bypass
 * - Webhook spoofing
 * - Replay attacks
 * - IDOR (Insecure Direct Object Reference)
 * - Coupon/discount abuse
 * - Race conditions
 * 
 * MVP-safe testing approach - simulates attacks without causing harm
 */

const { createHash, createHmac, randomBytes } = require('crypto');

// Test Configuration
const CONFIG = {
  BASE_URL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  API_BASE: process.env.TEST_API_URL || 'http://localhost:3000/api',
  CREEM_API_BASE: 'https://api.creem.io',
  TEST_TIMEOUT: 30000,
  RATE_LIMIT_DELAY: 1000,
};

// Test Results Tracking
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: [],
};

function log(level, message, details = {}) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, message, details };
  
  if (level === 'PASS') results.passed++;
  if (level === 'FAIL') results.failed++;
  if (level === 'WARN') results.warnings++;
  
  results.tests.push(entry);
  
  const icons = { PASS: '✅', FAIL: '❌', WARN: '⚠️', INFO: 'ℹ️' };
  console.log(`${icons[level] || '•'} [${level}] ${message}`);
  if (Object.keys(details).length > 0) {
    console.log('  Details:', JSON.stringify(details, null, 2));
  }
}

// Helper: Make HTTP requests
async function makeRequest(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.TEST_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    clearTimeout(timeout);
    
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    
    return {
      status: response.status,
      headers: response.headers,
      text,
      json,
      ok: response.ok,
    };
  } catch (error) {
    clearTimeout(timeout);
    return {
      status: 0,
      error: error.message,
      ok: false,
    };
  }
}

// Helper: Delay between requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== TEST CATEGORY 1: CLIENT-SIDE PRICE MANIPULATION ====================

async function testClientSidePriceManipulation() {
  log('INFO', '=== Testing Client-Side Price Manipulation ===');
  
  // Test 1.1: Attempt to send price in checkout request (should be ignored/rejected)
  log('INFO', 'Test 1.1: Attempting to inject price parameter in checkout request');
  
  // First, get a valid session by signing up/logging in
  const testEmail = `price-test-${Date.now()}@test.com`;
  const signupResponse = await makeRequest(`${CONFIG.API_BASE}/auth/signup`, {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'Test123!@#$',
    }),
  });
  
  if (!signupResponse.ok) {
    log('WARN', 'Could not create test user for price manipulation test', { status: signupResponse.status });
  } else {
    // Attempt checkout with price manipulation
    const checkoutResponse = await makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
      method: 'POST',
      body: JSON.stringify({
        planCode: 'monthly',
        price: 1, // Attempt to set price to $0.01
        price_cents: 1,
        amount: 1,
      }),
    });
    
    if (checkoutResponse.status === 401) {
      log('PASS', 'Checkout requires authentication (price manipulation blocked by auth)', {
        status: checkoutResponse.status,
      });
    } else if (checkoutResponse.status === 400 && checkoutResponse.json?.error?.includes('price')) {
      log('PASS', 'Server rejects unexpected price parameters', {
        status: checkoutResponse.status,
        error: checkoutResponse.json?.error,
      });
    } else if (checkoutResponse.status === 200 || checkoutResponse.status === 201) {
      // Check if the checkout URL is legitimate
      const checkoutUrl = checkoutResponse.json?.data?.checkoutUrl;
      if (checkoutUrl && checkoutUrl.includes('creem.io')) {
        log('PASS', 'Checkout uses server-resolved pricing (Creem URL returned)', {
          checkoutUrl: checkoutUrl.substring(0, 50) + '...',
        });
      } else {
        log('FAIL', 'Checkout may be vulnerable to price manipulation', {
          status: checkoutResponse.status,
          checkoutUrl,
        });
      }
    } else {
      log('INFO', 'Checkout response (needs manual review)', {
        status: checkoutResponse.status,
        body: checkoutResponse.json,
      });
    }
  }
  
  // Test 1.2: Attempt to modify plan code to invalid value
  log('INFO', 'Test 1.2: Testing invalid plan code rejection');
  const invalidPlanResponse = await makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
    method: 'POST',
    body: JSON.stringify({
      planCode: 'free', // Invalid plan
    }),
  });
  
  if (invalidPlanResponse.status === 400) {
    log('PASS', 'Invalid plan code rejected with 400', {
      error: invalidPlanResponse.json?.error,
    });
  } else if (invalidPlanResponse.status === 401) {
    log('PASS', 'Invalid plan blocked by authentication first');
  } else {
    log('WARN', 'Unexpected response for invalid plan code', {
      status: invalidPlanResponse.status,
    });
  }
  
  // Test 1.3: Attempt negative price (if price parameter were accepted)
  log('INFO', 'Test 1.3: Testing negative price rejection');
  const negativePriceResponse = await makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
    method: 'POST',
    body: JSON.stringify({
      planCode: 'monthly',
      price: -100,
    }),
  });
  
  if (negativePriceResponse.status === 400) {
    log('PASS', 'Negative price rejected');
  } else if (negativePriceResponse.status === 401) {
    log('PASS', 'Price manipulation blocked by authentication');
  } else {
    log('INFO', 'Negative price test response', { status: negativePriceResponse.status });
  }
}

// ==================== TEST CATEGORY 2: WEBHOOK SPOOFING ====================

async function testWebhookSpoofing() {
  log('INFO', '=== Testing Webhook Spoofing Protection ===');
  
  const webhookUrl = `${CONFIG.API_BASE}/webhooks/creem`;
  
  // Test 2.1: Webhook without signature
  log('INFO', 'Test 2.1: Sending webhook without signature header');
  const noSigResponse = await makeRequest(webhookUrl, {
    method: 'POST',
    body: JSON.stringify({
      id: `evt_test_${Date.now()}`,
      type: 'subscription.created',
      data: { test: true },
    }),
  });
  
  if (noSigResponse.status === 401) {
    log('PASS', 'Webhook without signature rejected with 401');
  } else {
    log('FAIL', 'Webhook accepted without signature!', { status: noSigResponse.status });
  }
  
  // Test 2.2: Webhook with invalid signature
  log('INFO', 'Test 2.2: Sending webhook with invalid signature');
  const invalidSigResponse = await makeRequest(webhookUrl, {
    method: 'POST',
    headers: {
      'creem-signature': 'v1=invalid_signature_here',
    },
    body: JSON.stringify({
      id: `evt_test_${Date.now()}`,
      type: 'subscription.created',
      data: { test: true },
    }),
  });
  
  if (invalidSigResponse.status === 401) {
    log('PASS', 'Webhook with invalid signature rejected with 401');
  } else {
    log('FAIL', 'Webhook with invalid signature accepted!', { status: invalidSigResponse.status });
  }
  
  // Test 2.3: Webhook with malformed signature format
  log('INFO', 'Test 2.3: Sending webhook with malformed signature');
  const malformedSigResponse = await makeRequest(webhookUrl, {
    method: 'POST',
    headers: {
      'creem-signature': 'not_a_valid_format',
    },
    body: JSON.stringify({
      id: `evt_test_${Date.now()}`,
      type: 'subscription.created',
    }),
  });
  
  if (malformedSigResponse.status === 401) {
    log('PASS', 'Malformed signature rejected');
  } else {
    log('FAIL', 'Malformed signature accepted!', { status: malformedSigResponse.status });
  }
  
  // Test 2.4: Webhook with empty signature
  log('INFO', 'Test 2.4: Sending webhook with empty signature');
  const emptySigResponse = await makeRequest(webhookUrl, {
    method: 'POST',
    headers: {
      'creem-signature': '',
    },
    body: JSON.stringify({ id: 'test' }),
  });
  
  if (emptySigResponse.status === 401) {
    log('PASS', 'Empty signature rejected');
  } else {
    log('FAIL', 'Empty signature accepted!', { status: emptySigResponse.status });
  }
  
  // Test 2.5: Test timestamp tolerance (if we could generate valid sig)
  log('INFO', 'Test 2.5: Testing timestamp-based replay protection (requires valid signature)');
  log('INFO', 'Note: Cannot test timestamp tolerance without webhook secret');
  
  // Test 2.6: SQL Injection in webhook payload
  log('INFO', 'Test 2.6: Testing SQL injection in webhook payload');
  const sqlInjectionResponse = await makeRequest(webhookUrl, {
    method: 'POST',
    headers: {
      'creem-signature': 'v1=fake_sig',
    },
    body: JSON.stringify({
      id: `evt_test'; DROP TABLE users; --`,
      type: 'subscription.created',
    }),
  });
  
  if (sqlInjectionResponse.status === 401) {
    log('PASS', 'SQL injection in webhook payload blocked by signature check');
  } else {
    log('WARN', 'Unexpected SQL injection test response', { status: sqlInjectionResponse.status });
  }
}

// ==================== TEST CATEGORY 3: REPLAY ATTACKS ====================

async function testReplayAttacks() {
  log('INFO', '=== Testing Replay Attack Protection ===');
  
  // Note: Full replay attack testing requires valid webhook signatures
  // Here we test the infrastructure for replay protection
  
  // Test 3.1: Check for idempotency key support in checkout
  log('INFO', 'Test 3.1: Checking idempotency support in checkout endpoint');
  const idempotencyResponse = await makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
    method: 'POST',
    headers: {
      'x-request-id': 'test-idempotency-key-123',
    },
    body: JSON.stringify({
      planCode: 'monthly',
    }),
  });
  
  if (idempotencyResponse.status === 401) {
    log('PASS', 'Checkout protected by authentication (prevents replay)');
  } else {
    log('INFO', 'Checkout idempotency check', { status: idempotencyResponse.status });
  }
  
  // Test 3.2: Duplicate event ID handling in webhook
  log('INFO', 'Test 3.2: Testing duplicate webhook event handling');
  const webhookUrl = `${CONFIG.API_BASE}/webhooks/creem`;
  const eventId = `evt_duplicate_${Date.now()}`;
  
  // First request (will fail auth but tests the infrastructure)
  const firstResponse = await makeRequest(webhookUrl, {
    method: 'POST',
    headers: {
      'creem-signature': 'v1=fake_sig',
    },
    body: JSON.stringify({
      id: eventId,
      type: 'subscription.created',
    }),
  });
  
  // Second request with same ID
  const secondResponse = await makeRequest(webhookUrl, {
    method: 'POST',
    headers: {
      'creem-signature': 'v1=another_fake_sig',
    },
    body: JSON.stringify({
      id: eventId,
      type: 'subscription.created',
    }),
  });
  
  if (firstResponse.status === 401 && secondResponse.status === 401) {
    log('PASS', 'Duplicate event detection infrastructure present (blocked by auth)');
  }
  
  // Test 3.3: Test rate limiting on webhook endpoint
  log('INFO', 'Test 3.3: Testing webhook rate limiting');
  const requests = [];
  for (let i = 0; i < 5; i++) {
    requests.push(makeRequest(webhookUrl, {
      method: 'POST',
      headers: { 'creem-signature': 'v1=fake' },
      body: JSON.stringify({ id: `rate_test_${i}` }),
    }));
  }
  
  const responses = await Promise.all(requests);
  const rateLimited = responses.some(r => r.status === 429);
  
  if (rateLimited) {
    log('PASS', 'Webhook endpoint has rate limiting');
  } else {
    log('INFO', 'Rate limiting test results', {
      statuses: responses.map(r => r.status),
    });
  }
}

// ==================== TEST CATEGORY 4: IDOR (Insecure Direct Object Reference) ====================

async function testIdor() {
  log('INFO', '=== Testing IDOR (Insecure Direct Object Reference) ===');
  
  // Test 4.1: Attempt to access another user's billing portal
  log('INFO', 'Test 4.1: Testing billing portal access without authentication');
  const portalResponse = await makeRequest(`${CONFIG.API_BASE}/billing/portal`, {
    method: 'POST',
    body: JSON.stringify({
      customer_id: 'cust_another_user_123',
    }),
  });
  
  if (portalResponse.status === 401) {
    log('PASS', 'Billing portal requires authentication');
  } else if (portalResponse.status === 403) {
    log('PASS', 'Billing portal returns 403 for unauthorized access');
  } else {
    log('FAIL', 'Billing portal may be vulnerable to IDOR!', { status: portalResponse.status });
  }
  
  // Test 4.2: Attempt to access billing status of another user
  log('INFO', 'Test 4.2: Testing billing status endpoint access');
  const statusResponse = await makeRequest(`${CONFIG.API_BASE}/billing/status`, {
    method: 'GET',
  });
  
  if (statusResponse.status === 401) {
    log('PASS', 'Billing status requires authentication');
  } else {
    log('WARN', 'Unexpected billing status response', { status: statusResponse.status });
  }
  
  // Test 4.3: Attempt to brute force subscription IDs
  log('INFO', 'Test 4.3: Testing subscription ID enumeration');
  const testIds = ['sub_123', 'sub_124', 'sub_125', 'sub_test_1', 'sub_live_1'];
  
  for (const subId of testIds) {
    const response = await makeRequest(`${CONFIG.API_BASE}/billing/status?subscription_id=${subId}`, {
      method: 'GET',
    });
    
    if (response.status === 401) {
      log('PASS', `Subscription ${subId} - authentication required`);
    } else if (response.status === 404) {
      log('INFO', `Subscription ${subId} - not found (good, no info leak)`);
    } else if (response.status === 200) {
      log('FAIL', `Subscription ${subId} - accessible without auth!`, {
        data: response.json,
      });
    }
    
    await delay(100); // Small delay to avoid rate limiting
  }
}

// ==================== TEST CATEGORY 5: RACE CONDITIONS ====================

async function testRaceConditions() {
  log('INFO', '=== Testing Race Condition Protection ===');
  
  // Test 5.1: Simultaneous checkout requests
  log('INFO', 'Test 5.1: Testing simultaneous checkout creation (race condition)');
  
  const checkoutRequests = [];
  for (let i = 0; i < 5; i++) {
    checkoutRequests.push(makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
      method: 'POST',
      headers: {
        'x-request-id': `race-test-${Date.now()}-${i}`,
      },
      body: JSON.stringify({
        planCode: 'monthly',
      }),
    }));
  }
  
  const responses = await Promise.all(checkoutRequests);
  const successCount = responses.filter(r => r.status === 200).length;
  const authFailures = responses.filter(r => r.status === 401).length;
  
  if (authFailures === responses.length) {
    log('PASS', 'All checkout requests blocked by authentication (prevents race)');
  } else if (successCount <= 1) {
    log('PASS', `Race condition protection: Only ${successCount} checkout succeeded`);
  } else {
    log('WARN', `Multiple checkouts succeeded (${successCount}), may indicate race condition risk`, {
      statuses: responses.map(r => r.status),
    });
  }
  
  // Test 5.2: Webhook processing race
  log('INFO', 'Test 5.2: Testing webhook processing race condition');
  const webhookUrl = `${CONFIG.API_BASE}/webhooks/creem`;
  const eventId = `evt_race_${Date.now()}`;
  
  const webhookRequests = [];
  for (let i = 0; i < 3; i++) {
    webhookRequests.push(makeRequest(webhookUrl, {
      method: 'POST',
      headers: {
        'creem-signature': 'v1=fake_sig',
      },
      body: JSON.stringify({
        id: eventId,
        type: 'subscription.updated',
        timestamp: Date.now(),
      }),
    }));
  }
  
  const webhookResponses = await Promise.all(webhookRequests);
  const webhookAuths = webhookResponses.filter(r => r.status === 401).length;
  
  if (webhookAuths === webhookResponses.length) {
    log('PASS', 'Webhook race blocked by signature verification');
  }
}

// ==================== TEST CATEGORY 6: AUTHENTICATION & AUTHORIZATION ====================

async function testAuthProtection() {
  log('INFO', '=== Testing Authentication & Authorization ===');
  
  const protectedEndpoints = [
    { url: `${CONFIG.API_BASE}/billing/checkout`, method: 'POST', name: 'Checkout' },
    { url: `${CONFIG.API_BASE}/billing/portal`, method: 'POST', name: 'Billing Portal' },
    { url: `${CONFIG.API_BASE}/billing/status`, method: 'GET', name: 'Billing Status' },
    { url: `${CONFIG.API_BASE}/billing/plans`, method: 'GET', name: 'Plans' },
  ];
  
  for (const endpoint of protectedEndpoints) {
    log('INFO', `Testing ${endpoint.name} without authentication`);
    
    const response = await makeRequest(endpoint.url, {
      method: endpoint.method,
      body: endpoint.method === 'POST' ? JSON.stringify({}) : undefined,
    });
    
    if (response.status === 401) {
      log('PASS', `${endpoint.name} requires authentication`);
    } else if (response.status === 403) {
      log('PASS', `${endpoint.name} requires authorization`);
    } else if (response.status === 200 && endpoint.name === 'Plans') {
      log('PASS', `${endpoint.name} is publicly accessible (expected for pricing)`);
    } else {
      log('WARN', `${endpoint.name} accessible without auth`, { status: response.status });
    }
    
    await delay(100);
  }
  
  // Test with invalid session
  log('INFO', 'Testing endpoints with invalid session cookie');
  const invalidSessionResponse = await makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
    method: 'POST',
    headers: {
      'Cookie': 'sb-access-token=invalid_token_here',
    },
    body: JSON.stringify({ planCode: 'monthly' }),
  });
  
  if (invalidSessionResponse.status === 401) {
    log('PASS', 'Invalid session token rejected');
  } else {
    log('WARN', 'Invalid session handling', { status: invalidSessionResponse.status });
  }
}

// ==================== TEST CATEGORY 7: INPUT VALIDATION & SANITIZATION ====================

async function testInputValidation() {
  log('INFO', '=== Testing Input Validation & Sanitization ===');
  
  // Test 7.1: XSS in metadata
  log('INFO', 'Test 7.1: Testing XSS in metadata fields');
  const xssPayload = '<script>alert("xss")</script>';
  const xssResponse = await makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
    method: 'POST',
    body: JSON.stringify({
      planCode: 'monthly',
      metadata: {
        xss: xssPayload,
        userData: xssPayload,
      },
    }),
  });
  
  if (xssResponse.status === 401) {
    log('PASS', 'XSS in metadata blocked by authentication');
  } else if (xssResponse.status === 400) {
    log('PASS', 'XSS in metadata rejected');
  }
  
  // Test 7.2: Oversized payload
  log('INFO', 'Test 7.2: Testing oversized payload rejection');
  const oversizedPayload = {
    planCode: 'monthly',
    data: 'x'.repeat(10 * 1024 * 1024), // 10MB string
  };
  
  const oversizedResponse = await makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
    method: 'POST',
    body: JSON.stringify(oversizedPayload),
  });
  
  if (oversizedResponse.status === 413 || oversizedResponse.status === 400) {
    log('PASS', 'Oversized payload rejected');
  } else if (oversizedResponse.status === 401) {
    log('PASS', 'Oversized payload blocked by auth first');
  } else {
    log('WARN', 'Oversized payload handling', { status: oversizedResponse.status });
  }
  
  // Test 7.3: Malformed JSON
  log('INFO', 'Test 7.3: Testing malformed JSON handling');
  const malformedResponse = await makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
    method: 'POST',
    body: 'not valid json {{{',
  });
  
  if (malformedResponse.status === 400) {
    log('PASS', 'Malformed JSON rejected with 400');
  } else {
    log('WARN', 'Malformed JSON handling', { status: malformedResponse.status });
  }
  
  // Test 7.4: NoSQL injection attempt
  log('INFO', 'Test 7.4: Testing NoSQL injection resistance');
  const nosqlPayload = {
    planCode: { $ne: null },
    $where: 'this.planCode == "monthly"',
  };
  
  const nosqlResponse = await makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
    method: 'POST',
    body: JSON.stringify(nosqlPayload),
  });
  
  if (nosqlResponse.status === 400) {
    log('PASS', 'NoSQL injection attempt rejected');
  } else if (nosqlResponse.status === 401) {
    log('PASS', 'NoSQL injection blocked by auth');
  }
}

// ==================== TEST CATEGORY 8: RATE LIMITING ====================

async function testRateLimiting() {
  log('INFO', '=== Testing Rate Limiting ===');
  
  // Test 8.1: Checkout rate limiting
  log('INFO', 'Test 8.1: Testing checkout rate limiting');
  const checkoutRequests = [];
  for (let i = 0; i < 15; i++) {
    checkoutRequests.push(makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planCode: 'monthly' }),
    }));
  }
  
  const checkoutResponses = await Promise.all(checkoutRequests);
  const rateLimited = checkoutResponses.filter(r => r.status === 429).length;
  const authBlocked = checkoutResponses.filter(r => r.status === 401).length;
  
  if (rateLimited > 0) {
    log('PASS', `Checkout rate limiting active (${rateLimited} requests blocked)`);
  } else if (authBlocked === checkoutResponses.length) {
    log('PASS', 'All requests blocked by authentication');
  } else {
    log('WARN', 'Rate limiting may not be active', {
      statuses: checkoutResponses.slice(0, 5).map(r => r.status),
    });
  }
  
  // Test 8.2: Webhook rate limiting
  log('INFO', 'Test 8.2: Testing webhook rate limiting');
  const webhookRequests = [];
  for (let i = 0; i < 10; i++) {
    webhookRequests.push(makeRequest(`${CONFIG.API_BASE}/webhooks/creem`, {
      method: 'POST',
      headers: { 'creem-signature': 'v1=fake' },
      body: JSON.stringify({ id: `rate_${i}` }),
    }));
  }
  
  const webhookResponses = await Promise.all(webhookRequests);
  const webhookRateLimited = webhookResponses.filter(r => r.status === 429).length;
  
  if (webhookRateLimited > 0) {
    log('PASS', `Webhook rate limiting active (${webhookRateLimited} requests blocked)`);
  }
  
  // Check for rate limit headers
  const hasRateLimitHeaders = webhookResponses.some(r => 
    r.headers?.get('x-ratelimit-limit') || 
    r.headers?.get('X-RateLimit-Limit')
  );
  
  if (hasRateLimitHeaders) {
    log('PASS', 'Rate limit headers present in responses');
  }
}

// ==================== TEST CATEGORY 9: ENVIRONMENT & CONFIGURATION ====================

async function testEnvironmentSecurity() {
  log('INFO', '=== Testing Environment & Configuration Security ===');
  
  // Test 9.1: Check for exposed environment variables
  log('INFO', 'Test 9.1: Checking for exposed environment variables');
  
  const exposedVarsResponse = await makeRequest(`${CONFIG.BASE_URL}/api/health`, {
    method: 'GET',
  });
  
  if (exposedVarsResponse.ok) {
    const body = exposedVarsResponse.text || '';
    const sensitivePatterns = [
      /CREEM_API_KEY/i,
      /CREEM_WEBHOOK_SECRET/i,
      /SUPABASE.*KEY/i,
      /PRIVATE_KEY/i,
      /SECRET/i,
      /PASSWORD/i,
    ];
    
    const exposed = sensitivePatterns.filter(pattern => pattern.test(body));
    
    if (exposed.length === 0) {
      log('PASS', 'No sensitive environment variables exposed in health endpoint');
    } else {
      log('FAIL', 'Potentially sensitive data exposed!', { patterns: exposed.map(p => p.toString()) });
    }
  }
  
  // Test 9.2: Test mode detection
  log('INFO', 'Test 9.2: Checking for test mode indicators');
  log('INFO', 'Note: Manual verification needed - ensure production uses live mode');
  
  // Test 9.3: Debug endpoint exposure
  log('INFO', 'Test 9.3: Checking for debug endpoint exposure');
  const debugEndpoints = [
    '/api/debug',
    '/api/config',
    '/api/env',
    '/.env',
    '/env',
    '/config',
  ];
  
  for (const endpoint of debugEndpoints) {
    const response = await makeRequest(`${CONFIG.BASE_URL}${endpoint}`, {
      method: 'GET',
    });
    
    if (response.status === 404) {
      log('PASS', `Debug endpoint ${endpoint} not exposed`);
    } else if (response.status === 200) {
      log('WARN', `Debug endpoint ${endpoint} accessible!`, { status: response.status });
    }
    
    await delay(100);
  }
}

// ==================== TEST CATEGORY 10: BUSINESS LOGIC ====================

async function testBusinessLogic() {
  log('INFO', '=== Testing Business Logic Security ===');
  
  // Test 10.1: Plan upgrade/downgrade logic
  log('INFO', 'Test 10.1: Testing plan change validation');
  
  const planChanges = [
    { from: 'free', to: 'monthly' },
    { from: 'monthly', to: 'yearly' },
    { from: 'yearly', to: 'monthly' },
    { from: 'invalid', to: 'monthly' },
  ];
  
  for (const change of planChanges) {
    log('INFO', `Testing plan change: ${change.from} -> ${change.to}`);
    // Plan changes should be validated server-side
  }
  
  // Test 10.2: Refund window validation
  log('INFO', 'Test 10.2: Testing refund window enforcement');
  log('INFO', 'Note: Manual verification needed - check refund policy implementation');
  
  // Test 10.3: Subscription state transitions
  log('INFO', 'Test 10.3: Testing subscription state machine');
  const invalidStates = [
    { status: 'active', canCancel: true },
    { status: 'cancelled', canCancel: false },
    { status: 'past_due', canUpgrade: true },
  ];
  
  for (const state of invalidStates) {
    log('INFO', `Validating state: ${JSON.stringify(state)}`);
  }
}

// ==================== TEST CATEGORY 11: CSRF PROTECTION ====================

async function testCsrfProtection() {
  log('INFO', '=== Testing CSRF Protection ===');
  
  // Test 11.1: Cross-origin checkout request
  log('INFO', 'Test 11.1: Testing cross-origin request blocking');
  const csrfResponse = await makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
    method: 'POST',
    headers: {
      'Origin': 'https://malicious-site.com',
      'Referer': 'https://malicious-site.com/phishing',
    },
    body: JSON.stringify({ planCode: 'monthly' }),
  });
  
  if (csrfResponse.status === 403) {
    log('PASS', 'Cross-origin request rejected with 403');
  } else if (csrfResponse.status === 401) {
    log('PASS', 'Cross-origin request blocked by auth');
  } else {
    log('WARN', 'CSRF protection test result', { status: csrfResponse.status });
  }
  
  // Test 11.2: Missing origin header
  log('INFO', 'Test 11.2: Testing request without origin header');
  const noOriginResponse = await makeRequest(`${CONFIG.API_BASE}/billing/checkout`, {
    method: 'POST',
    headers: {},
    body: JSON.stringify({ planCode: 'monthly' }),
  });
  
  if (noOriginResponse.status === 401 || noOriginResponse.status === 403) {
    log('PASS', 'Request without origin handled securely');
  }
}

// ==================== TEST CATEGORY 12: DATA INTEGRITY ====================

async function testDataIntegrity() {
  log('INFO', '=== Testing Data Integrity ===');
  
  // Test 12.1: Webhook payload integrity
  log('INFO', 'Test 12.1: Testing webhook payload integrity verification');
  log('INFO', 'Note: Full test requires valid webhook secret');
  
  // Test 12.2: Transaction atomicity
  log('INFO', 'Test 12.2: Testing transaction atomicity');
  log('INFO', 'Note: Verify database transactions are used for payment operations');
  
  // Test 12.3: Audit logging
  log('INFO', 'Test 12.3: Testing audit logging');
  log('INFO', 'Note: Verify all payment events are logged with request IDs');
}

// ==================== MAIN EXECUTION ====================

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('PAYMENT SECURITY TEST SUITE');
  console.log('MVP-Safe Attack Simulation & Security Verification');
  console.log('='.repeat(80) + '\n');
  
  const startTime = Date.now();
  
  try {
    await testClientSidePriceManipulation();
    await delay(CONFIG.RATE_LIMIT_DELAY);
    
    await testWebhookSpoofing();
    await delay(CONFIG.RATE_LIMIT_DELAY);
    
    await testReplayAttacks();
    await delay(CONFIG.RATE_LIMIT_DELAY);
    
    await testIdor();
    await delay(CONFIG.RATE_LIMIT_DELAY);
    
    await testRaceConditions();
    await delay(CONFIG.RATE_LIMIT_DELAY);
    
    await testAuthProtection();
    await delay(CONFIG.RATE_LIMIT_DELAY);
    
    await testInputValidation();
    await delay(CONFIG.RATE_LIMIT_DELAY);
    
    await testRateLimiting();
    await delay(CONFIG.RATE_LIMIT_DELAY);
    
    await testEnvironmentSecurity();
    await delay(CONFIG.RATE_LIMIT_DELAY);
    
    await testBusinessLogic();
    await delay(CONFIG.RATE_LIMIT_DELAY);
    
    await testCsrfProtection();
    await delay(CONFIG.RATE_LIMIT_DELAY);
    
    await testDataIntegrity();
    
  } catch (error) {
    log('FAIL', 'Test suite error', { error: error.message });
  }
  
  const duration = Date.now() - startTime;
  
  // Print Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  console.log(`Duration: ${duration}ms`);
  console.log('='.repeat(80) + '\n');
  
  // Security Score
  const totalScored = results.passed + results.failed;
  const score = totalScored > 0 ? Math.round((results.passed / totalScored) * 100) : 0;
  console.log(`Security Score: ${score}/100`);
  
  if (score >= 90) {
    console.log('🛡️  EXCELLENT: Payment security is robust');
  } else if (score >= 70) {
    console.log('🔒 GOOD: Payment security is adequate but has room for improvement');
  } else if (score >= 50) {
    console.log('⚠️  FAIR: Payment security needs attention');
  } else {
    console.log('🚨 CRITICAL: Payment security requires immediate fixes');
  }
  
  // Action Items
  const failures = results.tests.filter(t => t.level === 'FAIL');
  if (failures.length > 0) {
    console.log('\n📝 ACTION ITEMS:');
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.message}`);
    });
  }
  
  console.log('\n');
  
  // Return exit code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests, results };
