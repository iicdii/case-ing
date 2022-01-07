const courts = require('../js/courts');
const caseTypes = require('../js/caseTypes');
const cases = require('../fixtures/cases.json');

const LAMBDA_API_URL = Cypress.env('LAMBDA_API_URL');
const S3_BUCKET_URL = Cypress.env('S3_BUCKET_URL');
const SCREENSHOT_URL = `${S3_BUCKET_URL}/screenshots`;
const caseLookup = {};
const doneCaseLookup = {};

describe('Search case', function () {
  cases.forEach(([court, year, caseType, caseNumber, manager], idx) => {
    it(`Search ${court} ${year} ${caseType} ${caseNumber} ${manager}`, function() {
      cy.log(idx);
      cy.visit({
        url: 'https://safind.scourt.go.kr/sf/mysafind.jsp',
        headers: {
          'Accept-Language': 'ko,en;q=0.9,ko-KR;q=0.8,en-US;q=0.7'
        },
        retryOnStatusCodeFailure: true
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

      const courtToSelect = courts.find(n => n.name === court);
      cy.get('#sch_bub_nm')
        .select(courtToSelect.value)
        .should('have.value', courtToSelect.value);
      cy.get('#sel_sa_year')
        .select(year)
        .should('have.value', year);

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

      cy.get('#sa_gubun').select(0);
      cy.get('#sa_gubun').find('option:selected').should('have.text', caseType);

      // 사건번호
      cy.get('#sa_serial')
        .type(caseNumber)
        .should('have.value', caseNumber);

      // 당사자명
      cy.get('#ds_nm')
        .type(manager)
        .should('have.value', manager);

      cy.document().then($document => {
        cy
          .get('#captcha')
          .find('img')
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
                expect(new TextDecoder().decode(response.body)).length(6);

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
        cy.get('#subTab2 .tableHor tbody tr').last().then(function (elem) {
          const [dateElem] = elem.children();
          const date = dateElem.innerText.trim();
          expect(date.length).gt(0);

          const filename = `${court}_${year}_${caseType}_${caseNumber}_${manager}`;
          cy.get('#subTab2 .tableHor').screenshot(filename, {
            onAfterScreenshot($el, {name, path}) {
              caseLookup[idx] = [path, name, date];
            },
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
    Object.keys(caseLookup).forEach(idx => {
      // 이미 시트에 업데이트 한 사건은 스킵
      if (doneCaseLookup[idx]) return;
      const now = new Date();
      const today = `${now.getFullYear()}.${('' + now.getMonth()+1).padStart(2, '0')}.${('' + now.getDate()).padStart(2, '0')}`;
      const [imgPath, filename, date] = caseLookup[idx];

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
          range: `F${Number(idx)+2}:H${Number(idx)+2}`,
          values: [[date, today, `=HYPERLINK("${SCREENSHOT_URL}/${filename}.png", "이미지 링크")`]],
        },
        headers: {
          'content-type': 'application/json',
        },
      })
        .then((response) => {
          expect(response.status).eq(200);
          doneCaseLookup[idx] = true;
        });
    });
  });
});
