# Lovengers Router Project

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
VITE_DATA_API_URL=http://localhost:8888/supabase-data
VITE_UPLOAD_API_URL=http://localhost:8888/upload-supabase
```

배포 서버를 사용하려면:

```env
VITE_DATA_API_URL=https://asg-b2.onrender.com/supabase-data
VITE_UPLOAD_API_URL=https://asg-b2.onrender.com/upload-supabase
```

## 엑셀 필수 헤더

- 아이디
- 닉네임
- 채팅
- 스트리머
- 종류
- 개수
- 시간

선택한 회차는 프론트에서 `회차` 필드로 추가되어 서버에 전송됩니다.
