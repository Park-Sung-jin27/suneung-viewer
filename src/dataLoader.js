// dataLoader.js
import ALL_DATA_RAW from './data/all_data_204.json';

const _cache = {};

export async function loadYear(yearKey) {
  if (_cache[yearKey]) return _cache[yearKey];
  if (ALL_DATA_RAW[yearKey]) {
    _cache[yearKey] = ALL_DATA_RAW[yearKey];
    return _cache[yearKey];
  }
  throw new Error(`연도 데이터 없음: ${yearKey}`);
}

export function getYearKeys() {
  return Object.keys(ALL_DATA_RAW);
}

export function getYearSync(yearKey) {
  return _cache[yearKey] ?? ALL_DATA_RAW[yearKey] ?? null;
}

export default ALL_DATA_RAW;