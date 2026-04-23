const axios = require('axios');
const key = 'AIzaSyDCoj-1otdWC8Dq4Ia2HoGq2nBv1NUJQt8'; 

async function test() {
  try {
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    console.log('Available Models:', res.data.models.map(m => m.name));
  } catch (e) {
    if (e.response) {
      console.error('Error listing models:', e.response.status, e.response.data);
    } else {
      console.error('Error:', e.message);
    }
  }
}

test();
