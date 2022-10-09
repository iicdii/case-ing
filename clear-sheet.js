const env = require('./cypress.env.json');
const axios = require('axios');

axios
  .delete(`${env.CYPRESS_LAMBDA_API_URL}/cases`)
  .catch(e => console.error(e))
