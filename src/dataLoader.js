// dataLoader.js
let _cache = null;

async function _load() {
  if (_cache) return _cache;
  const res = await fetch('/data/all_data_204.json');
  if (!res.ok) throw new Error('데이터 로드 실패');
  _cache = await res.json();
  return _cache;
}

export async function loadYear(yearKey) {
  const data = await _load();
  if (!data[yearKey]) throw new Error(`연도 데이터 없음: ${yearKey}`);
  return data[yearKey];
}

export async function getYearKeys() {
  const data = await _load();
  return Object.keys(data);
}

export function getYearSync(yearKey) {
  return _cache?.[yearKey] ?? null;
}

export async function loadAllData() {
  return await _load();
}

export default { loadYear, getYearKeys, getYearSync, loadAllData };
