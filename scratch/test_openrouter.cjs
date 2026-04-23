const axios = require('axios');
const key = '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'; 

async function test() {
  try {
    const res = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    console.log('OpenRouter Models (Free):', res.data.data.filter(m => m.id.includes('free')).map(m => m.id));
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
  }
}

test();
