// Test Resend email service
require('dotenv').config({ path: '.env.local' });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

async function testEmailService() {
  console.log('Testing Resend Email Service...');
  console.log('From Email:', RESEND_FROM_EMAIL);
  
  if (!RESEND_API_KEY) {
    console.log('❌ RESEND_API_KEY not found');
    return;
  }
  
  try {
    // Test API key validity by checking account
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: 'test@example.com',
        subject: 'Test Email from DocRenewal',
        text: 'This is a test email to verify Resend configuration.'
      })
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    
    if (response.status === 200 || response.status === 201) {
      console.log('✅ Resend Email Service is configured correctly!');
      console.log('   Email ID:', data.id);
    } else if (response.status === 422 && data.message?.includes('domain')) {
      console.log('⚠️  Resend API key valid, but domain not verified');
      console.log('   You need to verify your domain at https://resend.com/domains');
    } else if (response.status === 403) {
      console.log('⚠️  Resend API key invalid or rate limited');
    } else {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Email test error:', error.message);
  }
}

testEmailService();
