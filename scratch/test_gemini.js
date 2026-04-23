const axios = require('axios');
const key = 'AIzaSyDCoj-1otdWC8Dq4Ia2HoGq2nbv1NUJQt8'; // From user screenshot

async function test() {
  try {
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    console.log('Models:', res.data.models.map(m => m.name));
  } catch (e) {
    console.error('Error listing models:', e.response?.data || e.message);
  }
}

test();
