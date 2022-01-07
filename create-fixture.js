require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const FIXTURE_FOLDER_PATH = './cypress/fixtures';

if (!fs.existsSync(FIXTURE_FOLDER_PATH)){
  fs.mkdirSync(FIXTURE_FOLDER_PATH);
}

axios
  .get(`${process.env.CYPRESS_LAMBDA_API_URL}/cases`)
  .then(res => {
    fs.writeFileSync(`${FIXTURE_FOLDER_PATH}/cases.json`, JSON.stringify(res.data.data.slice(1)));
  })
  .catch(e => console.error(e))
