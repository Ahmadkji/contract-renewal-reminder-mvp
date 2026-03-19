/**
 * Debug script to check cookie setting during login
 */

const response = await fetch('http://localhost:3000/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'email=test@example.com&password=TestPassword123'
});

console.log('Response status:', response.status);
console.log('Set-Cookie headers:', response.headers.get('set-cookie'));
