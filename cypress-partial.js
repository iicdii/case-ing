/**
 * Primitive load-balancer to split Cypress specs across multiple runners. This script assumes that
 * all your specs are in the folder '<project root>/cypress/e2e'. It uses the number of
 * tests per spec file as sole criteria to split specs between runners.
 *
 * This script accepts two arguments: the total number of runners and the index (starting from 0) of
 * the current runner. Example:
 *    $ node cypress-partial.js 5 2
 * This command asks for specs to give to the third runner of five runners.
 * The output of the script is a coma-separated list of specs that can be given to Cypress. Example:
 *    cypress/e2e/some.spec.ts,cypress/e2e/another.spec.ts
 *
 * Let's assume you have five runners (virtual machines) to run specs in parallel on your CI, and
 * each runner knows its number (from 0 to 4). So the third runner must execute its spec as
 * following:
 *    $ cypress run --spec $(node cypress-partial.js 5 2)
 *
 * Here as example for GitHub actions:
 *
 *    jobs:
 *      e2e:
 *        runs-on: ubuntu-latest
 *        strategy:
 *            fail-fast: false
 *            matrix:
 *                containers: [ 0, 1, 2, 3, 4 ]
 *        steps:
 *            - name: E2E
 *              run: cypress run --spec $(node cypress-partial.js 5 ${{ matrix.containers }})
 */

const fs = require('fs/promises');

const specDir = 'cypress/e2e';
const testPattern = /(^|\s)(it|test)\(/g;

const [ totalRunners, thisRunner ] = process.argv.splice(2);

fs.readdir(specDir).then(async files => {
  const nbTests = {};

  for (const file of files) {
    nbTests[file] = await testCount(file);
  }

  const chunks = [];

  Object
    .entries(nbTests)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .map(file => `${specDir}/${file}`)
    .forEach((file, index) => {
      const chunk = index % totalRunners;
      chunks[chunk] ||= [];
      chunks[chunk].push(file);
    });

  if (!chunks[thisRunner]) return false;

  const output = chunks[thisRunner].join(',');
  return console.log(output);
});

async function testCount(filename) {
  const content = await fs.readFile(`${specDir}/${filename}`, 'utf8');
  return content.match(testPattern).length;
}
