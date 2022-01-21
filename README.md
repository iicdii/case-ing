# case-ing
대법원 나의 사건 조회 자동화 API & 크롤러

<a href="https://github.com/iicdii/case-ing/blob/master/LICENSE" alt="License">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</a>
<a href="https://github.com/iicdii/case-ing/actions/workflows/update-sheet-cron.yml" alt="Cron">
    <img src="https://github.com/iicdii/case-ing/actions/workflows/update-sheet-cron.yml/badge.svg" />
</a>
<a href="https://github.com/iicdii/case-ing/actions/workflows/update-sheet-manually.yml" alt="Manual Cron">
    <img src="https://github.com/iicdii/case-ing/actions/workflows/update-sheet-manually.yml/badge.svg" />
</a>

case-ing는 case + ~ing의 합성어로 여러개의 사건 진행현황을 쉽게 조회하도록 도와주는
자동화 도구입니다.

## 사용된 기술
- [Cypress](https://www.cypress.io/) - 크롤링
- [Scikit-learn](https://scikit-learn.org/) - Captcha 학습, 분석
- [Serverless Framework](https://www.serverless.com/) - Captcha 분석 API, 구글 스프레드시트 조회/수정 API 생성

## 요구사항
- Node.js >= 14
- yarn v1.x
- Docker

## 폴더 구조
```
project
└── api
│   └──certification
│   │   │  service-account.json // 구글 스프레드시트 인증을 위한 파일
│   └──model
│   │   │  model.pickle // 미리 학습된 scikit-learn 모델
│   │ app.py // 캡챠 handler
│   │ cases.py // 구글 스프레드시트 Read, Update handler
│   │ docker-requirements.txt // 캡챠 handler 도커 배포에 필요한 패키지 정의 
│   │ Dockerfile // 캡챠 도커파일
│   │ requirements.txt // 구글 스프레드시트 handler 배포에 필요한 패키지 정의
│   │ s3.py // s3 업로드 handler
│   │ serverless.yml // 서버리스 설정파일
└── cypress
│   └──fixtures // 사건들이 create-fixtures.js 실행 후 여기에 생성됨
│   └──integration
│   │   │  spec.js // 메인 크롤링 파일
│   └──js
│   │   │  caseTypes.js // 대법원 홈페이지에서 추출한 사건 구분 데이터
│   │   │  courts.js // 대법원 홈페이지에서 추출한 법원 데이터
│   └──plugins
│       │  index.js // dotenv 등 설정을 위한 플러그인 파일
│ create-fixtures.js // 구글 스프레드시트를 조회해서 필요한 fixtures를 생성함
│ cypress-partial.js // Cypress 병렬 실행용 스크립트
```

## 사건 자동 조회 프로세스

### 사전 준비

#### 1. 구글 스프레드시트에 조회할 데이터 입력
<img width="592" alt="process_1" src="https://user-images.githubusercontent.com/4951716/150552370-41dea747-98d8-40f3-87ae-f805402feb67.png">

#### 2. 서비스 계정 생성 및 스프레드시트 편집자 권한 부여
계정 인증 정보는 `api/certification/service-account.json`에 저장

#### 3. Captcha 우회용 Scikit-learn 학습 후 `api/model/model.pickle`에 모델 저장

#### 4. S3 버킷 생성
사건 진행 내용 스크린샷을 저장할 S3 버킷을 생성합니다.

#### 5. IAM 역할 생성
정책 예)
- `AWSLambdaBasicExecutionRole`
- `AmazonS3FullAccess`
- `AWSLambda_FullAccess`

역할 생성 후 `serverless.yml`에 ARN 입력

#### 6. 서버리스 배포
```
cd api
sls deploy
```

#### 7. Actions Secrets 입력
- `CYPRESS_LAMBDA_API_URL` - 서버리스 API URL
- `CYPRESS_S3_BUCKET_URL` - S3 Bucket URL

### workflow 실행 프로세스

#### 1. `node create-fixtures.js` 실행
- Serverless를 통해 배포된 Lambda API에서 스프레드시트 데이터를 받아옴
- `cypress/fixtures` 폴더에 5개 단위로 `cases_chunk_<number>.json`를 생성함. 5개씩 나누는 이유는 Cypress 병렬 실행을 위함임.
- `cypress/integration` 폴더에 5개 단위로 `spec_chunk_<number>.json`를 생성함.

#### 2. `yarn start --spec $(node cypress-partial.js n ${{ matrix.containers }})` 실행
- `n`개의 runner 중 현재 실행해야할 순번의 테스트 파일을 실행함

### 테스트 프로세스

#### 1. 나의 사건 조회 페이지 접속

#### 2. 사건 번호 / 법원 데이터 강제 입력
EUC-KR 인코딩으로 인해 깨진 데이터들을 아래의 파일에서 직접 넣어줌

- `cypress/js/caseTypes.js`
- `cypress/js/courts.js`

#### 3. 자동입력방지 문자 입력
Lambda API에 캡챠 이미지를 전송하여 예측된 숫자를 입력함
단, 정확도가 100%가 아니므로 실패시 최대 10번까지 재시도함

#### 4. 사건 진행내역 스크린샷 캡쳐
#### 5. S3에 스크린샷 업로드
#### 6. 구글 시트 업데이트
Lambda API를 통해 사건 별로 S3 이미지 링크를 시트에 업데이트
