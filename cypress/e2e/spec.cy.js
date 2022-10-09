const dayjs = require('dayjs');
const minMax = require('dayjs/plugin/minMax')
dayjs.extend(minMax);

const courts = require('../js/courts');
const caseTypes = require('../js/caseTypes');
const cases = require('../fixtures/cases_chunk_0.json');

const LAMBDA_API_URL = Cypress.env('CYPRESS_LAMBDA_API_URL');
const S3_BUCKET_URL = Cypress.env('CYPRESS_S3_BUCKET_URL');
const SCREENSHOT_URL = `${S3_BUCKET_URL}/screenshots`;
const caseLookup = {};
const doneCaseLookup = {};

describe('Search case', function () {
  cases.forEach(([rowIndex, court, caseNumber, manager]) => {
    it(`[${rowIndex}] Search and Update sheet`, function() {
      cy.visit({
        url: 'https://safind.scourt.go.kr/sf/mysafind.jsp',
        headers: {
          'Accept-Language': 'ko,en;q=0.9,ko-KR;q=0.8,en-US;q=0.7'
        },
        retryOnStatusCodeFailure: true
      });

      cy.get('img').each(($img) => {
        cy.wrap($img).scrollIntoView().should('be.visible');

        expect($img[0].naturalWidth).to.be.greaterThan(0);
        expect($img[0].naturalHeight).to.be.greaterThan(0);
      });

      cy.get('#sch_bub_nm').then(elem => {
        elem.get(0).options.length = 0;
        expect(elem.get(0).options).length(0);

        for (const {name, value} of courts) {
          elem.append(new Option(name, value));
        }

        expect(elem.get(0).options).length(courts.length);
      });
      cy.wait(500);

      // 법원 선택
      const courtToSelect = courts.find(n => n.name === court);
      cy.get('#sch_bub_nm')
        .select(courtToSelect.value)
        .should('have.value', courtToSelect.value);

      const [caseYear, caseSerialNumber] = caseNumber.match(/[0-9]+/g);
      const [caseType] = caseNumber.match(/([가-힣])+/g);

      cy.get('#sel_sa_year')
        .select(caseYear)
        .should('have.value', caseYear);

      cy.get('#sa_gubun').then(elem => {
        elem.get(0).options.length = 0;
        expect(elem.get(0).options).length(0);

        const caseTypeIdxToSelect = caseTypes.findIndex(n => n.name === caseType);
        elem.append(
          new Option(caseTypes[caseTypeIdxToSelect].name, caseTypes[caseTypeIdxToSelect].value)
        );
        expect(elem.get(0).options).length(1);
      });
      cy.wait(500);

      // 사건번호 입력
      cy.get('#sa_serial')
        .type(caseSerialNumber)
        .should('have.value', caseSerialNumber);

      // 당사자명 입력
      cy.get('#ds_nm')
        .type(manager)
        .should('have.value', manager);

      cy.document().then($document => {
        cy
          .get('#captcha')
          .find('img')
          .should('have.attr', 'src', '/sf/captchaImg?t=image')
          .then(async $img => {
            const canvas = $document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = $img.width();
            canvas.height = $img.height();
            ctx.drawImage($img.get(0), 0, 0, $img.width(), $img.height());

            let blob;
            await new Cypress.Promise((resolve) => {
              canvas.toBlob(function (b) {
                blob = b;
                resolve(b);
              }, 'image/wbmp');
            });

            const formData = new FormData();
            formData.append("image", blob);

            // 자동입력방지 문자 해석하기
            cy.request({
              method: 'POST',
              url: `${LAMBDA_API_URL}/predict`,
              body: formData,
              headers: {
                'content-type': 'multipart/form-data',
              },
            })
              .then((response) => {
                const number = new TextDecoder().decode(response.body);
                expect(number).length(6);

                // 자동입력방지 문자 입력
                cy.get('#answer')
                  .type(number)
                  .should('have.value', number);
              });
          });
      });


      function finalStep() {
        cy.get('li.subTab2').click();
        cy.get('#subTab2 .tableHor tbody tr').then(elem => {
          expect(elem.length).gt(0);
        });
        cy.get('#subTab2 .tableHor tbody tr').last().prev().then(function (prevElem) {
          const [prevDateElem,,prevResultElem] = prevElem.children();
          const prevDate = prevDateElem.innerText.trim();
          const prevResultDate = prevResultElem.innerText.trim().substr(0, 10);

          cy.get('#subTab2 .tableHor tbody tr').last().then(function (elem) {
            const [dateElem,,resultElem] = elem.children();
            const date = dateElem.innerText.trim();
            const resultDate = resultElem.innerText.trim().substr(0, 10);
            const finalDate = dayjs.max(
              [prevDate, prevResultDate, date, resultDate]
                .filter(n => n)
                .filter(n => dayjs(n).isValid())
                .map(n => dayjs(n))
            ).format('YYYY. MM. DD');

            // 최종 변경일자에 기입할 날짜
            expect(finalDate.length).gt(0);

            const filename = `${caseNumber}`;
            cy.get('#subTab2 .tableHor').screenshot(filename, {
              onAfterScreenshot($el, {name, path}) {
                caseLookup[rowIndex] = [
                  court, caseNumber, manager, path, name, finalDate
                ];
              },
            });
          });
        });
      }

      const alertStub = cy.stub();
      cy.on('window:alert', alertStub);
      cy.get('.tableVer .redBtn').click().then(() => {
        const alertChain = alertStub.getCall(0);
        if ((alertChain || {}).lastArg !== '사건이 존재하지 않습니다.') {
          finalStep();
        }
      });
    });
  });

  afterEach(() => {
    Object.keys(caseLookup).forEach((rowIndex) => {
      // 이미 시트에 업데이트 한 사건은 스킵
      if (doneCaseLookup[rowIndex]) return;
      const today = dayjs().format('YYYY-MM-DD');
      const [
        court, caseNumber, manager, imgPath, filename, date
      ] = caseLookup[rowIndex];

      cy.readFile(imgPath, 'base64').then(img => {
        // 스크린샷 s3에 업로드
        cy.request({
          method: 'POST',
          url: `${LAMBDA_API_URL}/upload`,
          body: JSON.stringify({
            name: `screenshots/${filename}.png`,
            file: img,
          }),
          headers: {
            'content-type': 'application/json',
          },
        })
          .then((response) => {
            expect(response.status).eq(200);
          });
      });

      // 구글 시트 업데이트
      cy.request({
        method: 'POST',
        url: `${LAMBDA_API_URL}/cases`,
        body: {
          range: `A${rowIndex}:G${rowIndex}`,
          values: [[
            court,
            caseNumber,
            manager,
            dayjs(date).format('YYYY-MM-DD'),
            today,
            `=HYPERLINK("${SCREENSHOT_URL}/${filename}.png", "이미지 링크")`,
            `='사건 목록'!D${rowIndex}`
          ]],
        },
        headers: {
          'content-type': 'application/json',
        },
      })
        .then((response) => {
          expect(response.status).eq(200);
          doneCaseLookup[rowIndex] = true;
        });
    });
  });
});
