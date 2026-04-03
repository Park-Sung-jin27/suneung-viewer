// ============================================================
// constants.js
// 패턴 정의(R1~R4 독서, L1~L5 문학), 선지 색상 팔레트, 전역 상수
// ============================================================

// 오답 패턴 정의 (R1~R4: 독서, L1~L5: 문학)
export const P = {
  R1: { name: '사실 왜곡',       color: '#c0392b', bg: 'rgba(192,57,43,0.08)',  desc: '수치·상태·방향을 정반대나 다른 값으로 서술' },
  R2: { name: '인과·관계 전도',  color: '#7d3c98', bg: 'rgba(125,60,152,0.08)', desc: '주체-객체, 원인-결과, 포함관계를 뒤바꿈' },
  R3: { name: '과잉 추론',       color: '#1565c0', bg: 'rgba(21,101,192,0.08)', desc: '지문에 없는 내용, 1단계 이상 비약' },
  R4: { name: '개념 혼합',       color: '#b7950b', bg: 'rgba(183,149,11,0.08)', desc: '서로 다른 문단의 개념어를 섞어 거짓 문장 구성' },
  L1: { name: '표현·형식 오독',  color: '#e74c3c', bg: 'rgba(231,76,60,0.08)',  desc: '시어·이미지·수사법·서술 방식을 잘못 파악' },
  L2: { name: '정서·태도 오독',  color: '#2980b9', bg: 'rgba(41,128,185,0.08)', desc: '화자·인물의 감정·태도·심리를 반대로 파악' },
  L3: { name: '주제·의미 과잉',  color: '#27ae60', bg: 'rgba(39,174,96,0.08)',  desc: '작품에 없는 의미 도출, 근거 없는 확대 해석' },
  L4: { name: '구조·맥락 오류',  color: '#8e44ad', bg: 'rgba(142,68,173,0.08)', desc: '시점·구성·대비 구조·장면 전환을 잘못 설명' },
  L5: { name: '보기 대입 오류',  color: '#d35400', bg: 'rgba(211,84,0,0.08)',   desc: '보기 조건을 작품에 잘못 적용하거나 보기 자체를 오독' },
};

// 미분류 패턴 (자동 분류 실패)
export const P0 = { name: '미분류', color: '#888', bg: 'rgba(136,136,136,0.08)', desc: '자동 분류 실패 — 수동 검토 필요' };

// V: 어휘 문제 (패턴 분류 제외, 오답률만 측정)
export const VOCAB_PAT = { name: '어휘', color: '#546e7a', bg: 'rgba(84,110,122,0.08)', desc: '어휘의 문맥적 의미 파악 문제 — 오답 패턴 분류 제외' };

// 선지번호별 형광펜 색상 팔레트 (1~5번)
export const CC = {
  1: { bg: 'rgba(59,130,246,0.18)',  border: '#3b82f6', text: '#1d4ed8' },
  2: { bg: 'rgba(34,197,94,0.18)',   border: '#22c55e', text: '#15803d' },
  3: { bg: 'rgba(234,179,8,0.22)',   border: '#eab308', text: '#854d0e' },
  4: { bg: 'rgba(239,68,68,0.18)',   border: '#ef4444', text: '#b91c1c' },
  5: { bg: 'rgba(168,85,247,0.18)',  border: '#a855f7', text: '#7e22ce' },
};

export const MODE = {
  STUDY: 'study', // 풀이 모드
  VIEW:  'view',  // 보기 모드
};

// 연도 메타정보
export const YEAR_INFO = [
  { key: '2026수능', label: '2026학년도 수능',    tag: '2025.11', badge: '최신', color: '#c0392b' },
  { key: '2025수능', label: '2025학년도 수능',    tag: '2024.11', badge: '',     color: '#2980b9' },
  { key: '2025_9월', label: '2025학년도 9월 모의', tag: '2024.09', badge: '',    color: '#27ae60' },
  { key: '2024수능', label: '2024학년도 수능',    tag: '2023.11', badge: '',     color: '#8e44ad' },
  { key: '2024_9월', label: '2024학년도 9월 모의', tag: '2023.09', badge: '',    color: '#d35400' },
  { key: '2024_6월', label: '2024학년도 6월 모의', tag: '2023.06', badge: '',    color: '#e67e22' },
  { key: '2023수능', label: '2023학년도 수능',    tag: '2022.11', badge: '',     color: '#d35400' },
  { key: '2023_9월', label: '2023학년도 9월 모의', tag: '2022.09', badge: '',    color: '#1abc9c' },
  { key: '2023_6월', label: '2023학년도 6월 모의', tag: '2022.06', badge: '',    color: '#3498db' },
  { key: '2022수능', label: '2022학년도 수능',    tag: '2021.11', badge: '',     color: '#2c3e50' },
  { key: '2022_6월', label: '2022학년도 6월 모의', tag: '2021.06', badge: '',    color: '#2ecc71' },
];

// 선지 기호 이미지 매핑 ([[sym:box]] 등 치환용)
export const SYMBOLS = {
  box:      '/images/sym_box.png',
  numbered: '/images/sym_numbered.png',
  check:    '/images/sym_check.png',
  wavy:     '/images/sym_wavy.png',
};
