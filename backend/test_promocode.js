#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

async function testPromocodeCreation() {
  try {
    const data = {
      "code": "TEST123",
      "type": "balance",
      "value": 1,
      "usageLimit": 2,
      "duration": 1,
      "description": "Test promocode",
      "isActive": true,
      "createdBy": 418684940
    };

    console.log('Sending request to:', 'http://localhost:3001/api/admin/promocodes');
    console.log('Data:', JSON.stringify(data, null, 2));

    const response = await axios.post('http://localhost:3001/api/admin/promocodes', data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 317d322b2be8728ea5da6e0c26d16d24ffc635b6ccb0d09b43f2f374e534b74d'
      }
    });

    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
  }
}

testPromocodeCreation();