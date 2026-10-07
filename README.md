# HM NEW DATA

React Router 기반 전체 프로젝트입니다.

## 경로

- `/` : 사용자 조회 페이지
- `/admin` : 운영자 엑셀 업로드 페이지

## 실행

```bash
npm install
npm run dev
```

## 환경변수

`.env` 파일 생성:

```env
VITE_DATA_API_URL=http://localhost:8888/newdata/supabase-datab
VITE_UPLOAD_API_URL=http://localhost:8888/newdata/upload-supabaseb
```

배포 서버를 사용하려면:

```env
VITE_DATA_API_URL=https://asg-b2.onrender.com/newdata/supabase-datab
VITE_UPLOAD_API_URL=https://asg-b2.onrender.com/newdata/upload-supabaseb
```

## 엑셀 필수 헤더

- 아이디
- 닉네임
- 채팅
- 스트리머
- 종류
- 개수
- 시간

환경변수 이름은 그대로 유지합니다. 기존 `/supabase-data`, `/supabase-datab`,
`/upload-supabase`, `/upload-supabaseb` URL도 프론트 설정에서 위 전용 경로로 연결합니다.
기존 백엔드 API 자체는 유지됩니다. 전용 경로를 제공하는 백엔드 코드와 함께 사용해야 합니다.

## 조회 흐름

기존 `public/logo.jpg`를 보여주는 첫 화면에서 H팀 또는 M팀을 선택한 뒤
시즌 → 회차 → 스트리머 순서로 조회합니다. 팀을 바꾸면 시즌과 회차를,
시즌을 바꾸면 회차를 초기화합니다.

`src/newDataConfig.js`의 `SEASONS`에서 시즌1/2/3을 관리하며, 시즌4는 이 배열에 추가하면 됩니다.
회차 문자열은 기존 `HM크루 직급전`, `HM크루 1회차`부터 `HM크루 12회차`까지 유지합니다.
조회 페이지의 회차 목록은 선택한 팀/시즌에 실제로 존재하는 데이터에서 가져옵니다.

- 회차 목록/전체 회차 누적: `GET /newdata/supabase-datab?team=H팀&season=시즌1`
- 선택 회차: `GET /newdata/supabase-datab?team=H팀&season=시즌1&round=HM크루 3회차`

## 업로드 흐름

팀 → 시즌 → 회차 → Excel 파일 → 업로드 순서입니다.
Excel 파싱, 숫자/날짜 변환은 기존처럼 프론트에서 수행합니다.
Excel에 team/season/round 컬럼은 필요 없으며, 있더라도 UI 선택값을 사용합니다.

`POST /newdata/upload-supabaseb`는 기존 JSON 형식에 metadata만 추가합니다.

```json
{
  "team": "H팀",
  "season": "시즌2",
  "round": "HM크루 3회차",
  "data": [
    { "아이디": "donor", "닉네임": "후원자", "스트리머": "스트리머", "개수": 100 }
  ]
}
```

서버는 team/season/round를 검증한 뒤 모든 `donation_logs_b` 행에 명시적으로 저장합니다.
기존 100건 배치 처리와 성공/일부 실패(207) 응답은 유지합니다.

## 검증

프론트: `npm run build`

백엔드 폴더: `node --test tests/newdata.test.cjs`

브라우저 테스트: 프론트 개발 서버를 `npm run dev -- --host 127.0.0.1 --port 5178`로 실행하고
`node tests/newdata.browser.cjs`를 실행합니다. 테스트 도구 Playwright는 별도 테스트 환경에서
제공하며 앱의 의존성에는 추가하지 않습니다. 별도 설치 경로는 `NODE_PATH`로 지정할 수 있습니다.
기본 브라우저는 Windows Chrome이며 `NEWDATA_CHROME_PATH`로 경로를,
`NEWDATA_BROWSER_URL`로 테스트할 프론트 주소를 지정할 수 있습니다.
테스트는 API와 DB를 모의 처리하며 운영 데이터는 변경하지 않습니다.
