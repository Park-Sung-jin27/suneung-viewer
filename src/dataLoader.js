// dataLoader.js
let _cache = null;

async function _load() {
  if (_cache) return _cache;
  const res = await fetch("/data/all_data_204.json");
  if (!res.ok) throw new Error("데이터 로드 실패");
  _cache = await res.json();
  return _cache;
}

function _buildSentCs(yearData) {
  for (const sec of ["reading", "literature"]) {
    for (const set of yearData[sec] || []) {
      const sentMap = {};
      for (const s of set.sents) sentMap[s.id] = s;
      for (const q of set.questions) {
        for (const c of q.choices) {
          const key = `q${q.id}_c${c.num}`;
          // cs_ids → sent.cs (문장 전체 하이라이트용, 기존 유지)
          for (const sid of c.cs_ids || []) {
            const s = sentMap[sid];
            if (s) (s.cs ||= []).includes(key) || s.cs.push(key);
          }
          // cs_spans → sent.csSpans (부분 하이라이트용, 신규)
          //   스키마: { sent_id, text } — text는 해당 문장 내부 어구
          for (const span of c.cs_spans || []) {
            const sid = span.sent_id;
            const text = span.text;
            if (!sid || !text) continue;
            const s = sentMap[sid];
            if (!s) continue;
            // cs에도 추가 (스크롤/fallback용 — cs_ids에 없더라도 cs_spans만 있는 경우 대비)
            (s.cs ||= []).includes(key) || s.cs.push(key);
            // csSpans: { key: [text1, text2, ...] }
            s.csSpans ||= {};
            (s.csSpans[key] ||= []).push(text);
          }
        }
      }
    }
  }
}

export async function loadYear(yearKey) {
  const data = await _load();
  if (!data[yearKey]) throw new Error(`연도 데이터 없음: ${yearKey}`);
  const yd = data[yearKey];
  if (!yd._csBuilt) {
    _buildSentCs(yd);
    yd._csBuilt = true;
  }
  return yd;
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
