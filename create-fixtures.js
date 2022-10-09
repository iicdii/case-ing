const env = require('./cypress.env.json');
const axios = require('axios');
const fs = require('fs');

const FIXTURE_FOLDER_PATH = './cypress/fixtures';
const SPEC_FOLDER_PATH = './cypress/e2e';

if (!fs.existsSync(FIXTURE_FOLDER_PATH)){
  fs.mkdirSync(FIXTURE_FOLDER_PATH);
}

const chunkArray = (array, chunk_size) =>
	Array(Math.ceil(array.length / chunk_size))
    .fill()
		.map((_, index) => index * chunk_size)
		.map(begin => array.slice(begin, begin + chunk_size))

axios
  .get(`${env.CYPRESS_LAMBDA_API_URL}/cases`)
  .then(res => {
    // 배열의 자식 배열에 로우 인덱스를 추가함
    const indexedArray = res.data.data.slice(1).map((arr, i) => {
      arr.unshift(i+2);
      return arr;
    });
    // 5개 단위로 배열을 쪼갬
    const items = chunkArray(indexedArray, 5);
    const spec = fs.readFileSync(`${SPEC_FOLDER_PATH}/spec.cy.js`, 'utf8');
    // 5개 단위로 `spec_chunk_1.cy.js`, `spec_chunk_2.cy.js`, ... 를 생성
    items.forEach((cases, i) => {
      fs.writeFileSync(`${FIXTURE_FOLDER_PATH}/cases_chunk_${i}.json`, JSON.stringify(cases));
      console.info(`${FIXTURE_FOLDER_PATH}/cases_chunk_${i}.json created`);
      // 원본 spec인 경우 새 스펙 생성 안함
      if (i === 0) return;
      const newSpec = spec.replace('cases_chunk_0.json', `cases_chunk_${i}.json`);
      fs.writeFileSync(`${SPEC_FOLDER_PATH}/spec_chunk_${i}.cy.js`, newSpec, 'utf8');
      console.info(`${SPEC_FOLDER_PATH}/spec_chunk_${i}.cy.js created`);
    });
  })
  .catch(e => console.error(e))
