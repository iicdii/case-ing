require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

axios
  .get(`${process.env.CYPRESS_LAMBDA_API_URL}/cases`)
  .then(res => {
    fs.writeFileSync('./cypress/fixtures/cases.json', JSON.stringify(res.data.data.slice(1)));
  })
  .catch(e => console.error(e))
