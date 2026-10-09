export const TEAMS = ['H팀', 'M팀'];
export const SEASONS = ['시즌1', '시즌2', '시즌3'];
export const DEFAULT_ROUND = 'HM크루 직급전';
export const UPLOAD_ROUNDS = [
  DEFAULT_ROUND,
  ...Array.from({ length: 12 }, (_, i) => `HM크루 ${i + 1}회차`)
];

// 기존 환경변수 이름과 서버 주소를 유지하고, 알려진 구 경로만 전용 API로 연결한다.
export const DATA_API_URL = (
  import.meta.env.VITE_DATA_API_URL ||
  'https://asg-b2.onrender.com/supabase-datab'
).replace(/(?:\/newdata)?\/supabase-datab?(?=[?#]|$)/, '/newdata/supabase-datab');

export const UPLOAD_API_URL = (
  import.meta.env.VITE_UPLOAD_API_URL ||
  'https://asg-b2.onrender.com/upload-supabaseb'
).replace(/(?:\/newdata)?\/upload-supabaseb?(?=[?#]|$)/, '/newdata/upload-supabaseb');

// TOP 200도 기존 조회 API와 같은 서버를 사용한다. 별도 URL이 필요한 경우만 재정의한다.
export const TOP200_API_URL = import.meta.env.VITE_TOP200_API_URL ||
  new URL('/newdata/top200', new URL(DATA_API_URL, window.location.href)).href;
