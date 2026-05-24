/**
 * k6 Load Testing Script for DocRenewal Pro MVP
 * 
 * Tests:
 * - 20 concurrent users performing login + typical user actions
 * - Response time validation (< 2s for API calls)
 * - Error rate monitoring (< 5%)
 * - Database connection stress testing
 * 
 * Run with: k6 run k6-load-test.js
 * Spike test: k6 run --vus 50 --duration 5m k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const loginTrend = new Trend('login_duration');
const apiTrend = new Trend('api_call_duration');
const dashboardTrend = new Trend('dashboard_load_duration');
const paymentTrend = new Trend('payment_checkout_duration');

// Test configuration
export const options = {
  stages: [
    // Ramp up
    { duration: '2m', target: 20 },
    // Steady state
    { duration: '5m', target: 20 },
    // Ramp down
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    // 95% of requests must complete within 2 seconds
    http_req_duration: ['p(95)<2000'],
    // Error rate must be below 5%
    error_rate: ['rate<0.05'],
    // 95% of login requests within 3 seconds
    login_duration: ['p(95)<3000'],
    // 95% of API calls within 1.5 seconds
    api_call_duration: ['p(95)<1500'],
  },
  // Cloud output (optional)
  // ext: {
  //   loadimpact: {
  //     projectID: 123456,
  //     name: 'DocRenewal MVP Load Test',
  //   },
  // },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Test user credentials (create these in your test database)
const TEST_USERS = [
  { email: 'loadtest1@test.com', password: 'Test123!@#' },
  { email: 'loadtest2@test.com', password: 'Test123!@#' },
  { email: 'loadtest3@test.com', password: 'Test123!@#' },
  { email: 'loadtest4@test.com', password: 'Test123!@#' },
  { email: 'loadtest5@test.com', password: 'Test123!@#' },
];

/**
 * Generate random user for this VU
 */
function getTestUser() {
  const vuId = __VU % TEST_USERS.length;
  return TEST_USERS[vuId];
}

/**
 * Login user and return cookies
 */
function login(email, password) {
  const startTime = Date.now();
  
  const response = http.post(`${API_BASE}/v2/auth/login`, JSON.stringify({
    email,
    password,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
  });
  
  const duration = Date.now() - startTime;
  loginTrend.add(duration);
  
  const success = check(response, {
    'login status is 200': (r) => r.status === 200,
    'login returns success': (r) => r.json('success') === true,
    'login sets cookies': (r) => r.cookies.access_token !== undefined,
  });
  
  errorRate.add(!success);
  
  if (!success) {
    console.error(`Login failed: ${response.status} - ${response.body}`);
    return null;
  }
  
  return response.cookies;
}

/**
 * Logout user
 */
function logout(cookies) {
  const startTime = Date.now();
  
  const response = http.post(`${API_BASE}/v2/auth/logout`, JSON.stringify({}), {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    cookies: cookies,
  });
  
  const duration = Date.now() - startTime;
  apiTrend.add(duration);
  
  const success = check(response, {
    'logout status is 200': (r) => r.status === 200,
  });
  
  errorRate.add(!success);
}

/**
 * Load dashboard data
 */
function loadDashboard(cookies) {
  const startTime = Date.now();
  
  const response = http.get(`${API_BASE}/dashboard`, {
    headers: {
      'Origin': BASE_URL,
    },
    cookies: cookies,
  });
  
  const duration = Date.now() - startTime;
  dashboardTrend.add(duration);
  
  const success = check(response, {
    'dashboard loads successfully': (r) => r.status === 200,
    'dashboard response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  errorRate.add(!success);
}

/**
 * Get user contracts
 */
function getContracts(cookies) {
  const startTime = Date.now();
  
  const response = http.get(`${API_BASE}/contracts`, {
    headers: {
      'Origin': BASE_URL,
    },
    cookies: cookies,
  });
  
  const duration = Date.now() - startTime;
  apiTrend.add(duration);
  
  const success = check(response, {
    'contracts API status is 200': (r) => r.status === 200,
    'contracts response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  errorRate.add(!success);
}

/**
 * Create a contract
 */
function createContract(cookies) {
  const startTime = Date.now();
  
  const contractData = {
    name: `Test Contract ${Date.now()}`,
    vendor: 'Test Vendor',
    value: 10000,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  
  const response = http.post(`${API_BASE}/contracts`, JSON.stringify(contractData), {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    cookies: cookies,
  });
  
  const duration = Date.now() - startTime;
  apiTrend.add(duration);
  
  const success = check(response, {
    'create contract status is 201': (r) => r.status === 201,
    'create contract returns success': (r) => r.json('success') === true,
  });
  
  errorRate.add(!success);
  
  return success ? response.json('data.id') : null;
}

/**
 * Initiate payment checkout
 */
function initiateCheckout(cookies) {
  const startTime = Date.now();
  
  const response = http.post(`${API_BASE}/billing/checkout`, JSON.stringify({
    planCode: 'monthly',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    cookies: cookies,
  });
  
  const duration = Date.now() - startTime;
  paymentTrend.add(duration);
  
  const success = check(response, {
    'checkout API status is 200': (r) => r.status === 200,
    'checkout returns checkout URL': (r) => r.json('data.checkoutUrl') !== undefined,
    'checkout response time < 3s': (r) => r.timings.duration < 3000,
  });
  
  errorRate.add(!success);
}

/**
 * Get billing status
 */
function getBillingStatus(cookies) {
  const startTime = Date.now();
  
  const response = http.get(`${API_BASE}/billing/status`, {
    headers: {
      'Origin': BASE_URL,
    },
    cookies: cookies,
  });
  
  const duration = Date.now() - startTime;
  apiTrend.add(duration);
  
  const success = check(response, {
    'billing status API status is 200': (r) => r.status === 200,
  });
  
  errorRate.add(!success);
}

/**
 * Main test scenario
 */
export default function () {
  const user = getTestUser();
  
  group('Authentication Flow', () => {
    // Step 1: Login
    const cookies = login(user.email, user.password);
    
    if (!cookies) {
      console.error('Login failed, skipping remaining tests');
      return;
    }
    
    sleep(1);
    
    // Step 2: Load dashboard (typical first action after login)
    loadDashboard(cookies);
    sleep(2);
    
    group('User Actions', () => {
      // Get contracts list
      getContracts(cookies);
      sleep(1);
      
      // Create a contract
      const contractId = createContract(cookies);
      sleep(2);
      
      // Check billing status
      getBillingStatus(cookies);
      sleep(1);
      
      // Initiate checkout (don't complete, just test the flow)
      initiateCheckout(cookies);
      sleep(2);
    });
    
    // Step 3: Logout
    logout(cookies);
  });
  
  // Random sleep between iterations to simulate real user behavior
  sleep(Math.random() * 3 + 1);
}

/**
 * Setup - runs once before all VUs
 */
export function setup() {
  console.log('Starting load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Virtual Users: 20`);
  console.log(`Duration: ~9 minutes`);
  
  // Health check
  const healthCheck = http.get(`${API_BASE}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('API health check failed');
  }
  
  return { startTime: Date.now() };
}

/**
 * Teardown - runs once after all VUs
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration}s`);
}
