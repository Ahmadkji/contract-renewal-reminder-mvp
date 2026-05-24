// Test Creem Billing Service
require('dotenv').config({ path: '.env.local' });

const CREEM_API_KEY = process.env.CREEM_API_KEY;
const CREEM_API_BASE_URL = process.env.CREEM_API_BASE_URL || 'https://api.creem.io';
const CREEM_MONTHLY_PRODUCT_ID = process.env.CREEM_MONTHLY_PRODUCT_ID;
const CREEM_YEARLY_PRODUCT_ID = process.env.CREEM_YEARLY_PRODUCT_ID;

async function testCreemService() {
  console.log('Testing Creem Billing Service...');
  console.log('API Base URL:', CREEM_API_BASE_URL);
  console.log('Monthly Product:', CREEM_MONTHLY_PRODUCT_ID);
  console.log('Yearly Product:', CREEM_YEARLY_PRODUCT_ID);
  
  if (!CREEM_API_KEY) {
    console.log('❌ CREEM_API_KEY not found');
    return;
  }
  
  try {
    // Test API by fetching product details
    const response = await fetch(`${CREEM_API_BASE_URL}/v1/products?product_id=${CREEM_MONTHLY_PRODUCT_ID}`, {
      method: 'GET',
      headers: {
        'x-api-key': CREEM_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    
    if (response.ok) {
      console.log('✅ Creem Billing Service is configured correctly!');
      console.log('   Product:', data.name || data.id);
      console.log('   Price:', data.price ? `$${data.price/100}` : 'N/A');
    } else {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Creem test error:', error.message);
  }
}

testCreemService();
