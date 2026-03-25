// ============================================================
// dataLoader.js
// 통합 데이터(all_data_204.json) 하나만 안전하게 로드하도록 수정
// ============================================================

import ALL_DATA_RAW from './data/all_data_204.json';

const _cache = {};

export async function loadYear(yearKey) {
  // 이미 불러온 데이터면 그대로 사용
  if (_cache[yearKey]) return _cache[yearKey];

  // 통합 JSON 파일에서 선택한 연도의 데이터만 쏙 빼서 전달
  if (ALL_DATA_RAW[yearKey]) {
    _cache[yearKey] = ALL_DATA_RAW[yearKey];
    return _cache[yearKey];
  }

  // 데이터가 없을 경우 에러 처리
  throw new Error(`데이터를 찾을 수 없습니다: ${yearKey}`);
}

export function getYearKeys() {
  // 어떤 연도들이 있는지 목록을 뽑아줌
  return Object.keys(ALL_DATA_RAW);
}