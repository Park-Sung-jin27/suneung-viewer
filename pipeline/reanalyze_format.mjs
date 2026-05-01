/**
 * pipeline/reanalyze_format.mjs
 *
 * 포맷 정합성 regen — analysis가 `📌 지문 근거: "..."` 포맷을 만족하지 못해
 * extractAnalysisSpans가 cs_spans를 만들 수 없는 선지를 타깃해 재생성한다.
 *
 * 타깃 조건:
 *   - choice.cs_ids.length > 0
 *   - analysis에 /📌\s*지문\s*근거\s*:\s*["“]/ 패턴 0건 (포맷 부재)
 *
 * 프롬프트:
 *   step3의 SYSTEM_PROMPT 원칙(도메인 가드·조건 분해·표현 분석) +
 *   "📌 지문 근거: "직접 인용문" 포맷 강제 / paraphrase 절대 금지" 제약
 *
 * 사용법:
 *   node pipeline/reanalyze_format.mjs <연도키>
 *   node pipeline/reanalyze_format.mjs --scope=2025_9월
 *   node pipeline/reanalyze_format.mjs --scope=모의고사전체
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { jsonrepair } from "jsonrepair";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DATA_PATH = path.resolve(__dirname, "../public/data/all_data_204.json");
const BACKUP_DIR = path.resolve(__dirname, "backups");

const SCOPE_PRESETS = {
  모의고사전체: [
    "2022_6월", "2022_9월",
    "2023_6월", "2023_9월",
    "2024_6월", "2024_9월",
    "2025_6월", "2025_9월",
    "2026_6월", "2026_9월",
  ],
  suneung5: ["2022수능", "2023수능", "2024수능", "2025수능", "2026수능"],
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const yearArg = args.find((a) => a !== "--dry-run");
if (!yearArg) {
  console.error(
    "사용법: node pipeline/reanalyze_format.mjs [--dry-run] <연도키|--scope=...>",
  );
  process.exit(1);
}
const scopeMatch = yearArg.match(/^--scope=(.+)$/);
const yearsToProcess = scopeMatch
  ? SCOPE_PRESETS[scopeMatch[1]] || [scopeMatch[1]]
  : [yearArg];

// ─── 포맷 강제 시스템 프롬프트 ─────────────────────────────────────────────
const SYSTEM = `너는 수능 국어 전문 해설 작성자다.
반드시 순수 JSON 객체만 출력하라. 마크다운, 설명 텍스트 없음.

[출력 포맷 — 엄수]
형식 1 (일반 문항 / ok:true):
'📌 지문 근거: "<지문에서 직접 인용한 한 구절>"\\n🔍 ...\\n✅ 지문과 일치하는 적절한 진술'

형식 2 (일반 문항 / ok:false):
'📌 지문 근거: "<지문에서 직접 인용한 한 구절>"\\n🔍 ...\\n❌ 지문과 어긋나는 부적절한 진술 [패턴]'

형식 3 (보기 문항 / ok:true):
'📌 보기 근거: "<보기에서 직접 인용>"\\n📌 지문 근거: "<지문에서 직접 인용>"\\n🔍 ...\\n✅ 보기 조건과 지문이 일치하는 적절한 진술'

형식 4 (보기 문항 / ok:false):
'📌 보기 근거: "<보기에서 직접 인용>"\\n📌 지문 근거: "<지문에서 직접 인용>"\\n🔍 ...\\n❌ 지문과 어긋나는 부적절한 진술 [패턴]'

[📌 지문 근거 절대 규칙 — 위반 시 전체 출력 무효]
- 📌 지문 근거: 뒤에는 반드시 큰따옴표 "…"로 감싼 **지문의 원문 인용**이 와야 한다.
- paraphrase(바꿔 쓰기), 괄호 보충 설명, "지문에서 ~ 내용이 제시됨" 같은 요약 금지.
- 지문의 실제 문장 중 해당 선지의 판단 근거가 되는 구절을 그대로 복사해 따옴표로 감싼다.
- 인용은 한 선지당 1개 이상 반드시 포함. 길이 6자 이상 권장.

[패턴(pat) 규칙 — ok:false에만]
- set.id가 r로 시작(독서): R1(사실 왜곡) / R2(인과·관계 전도) / R3(과잉 추론) / R4(개념 혼합)
- set.id가 l로 시작(문학): L1(표현·형식 오독) / L2(정서·태도 오독) / L3(주제·의미 과잉) / L4(구조·맥락 오류) / L5(보기 대입 오류)
- 도메인 위반 금지 (r→R_, l→L_만).
- 결론 말미 라벨 예: [L2] / [R1]

[해설 원칙 — 본문 🔍 줄]
- 선지 조건을 ①②③으로 분해하여 각 조건을 지문 근거와 직접 대조하라.
- 선지에 인용표현·원문자가 있으면 그 기능·상징·효과를 언급하라.
- "없다"로 끝내지 말고 왜 없는지까지 설명하라.
- 3~5등급 학생도 이해할 수 있게 짧고 구체적으로.

[내부 식별자 노출 금지]
- 본문에 sent.id(예: l2026cs2, r2024as7) 같은 내부 식별자 출력 절대 금지. 인용은 따옴표 안 자연어만.

[ok:true 부정 표현 금지]
- ok:true 해설에서 "어긋나다, 왜곡, 잘못, 부적절, 맞지 않다" 등의 부정 판정 단어 사용 금지.

출력: { "analysis": "..." }`;

// ─── 유틸 ────────────────────────────────────────────────────────────────
async function callWithRetry(fn, max = 3, delay = 4000) {
  for (let i = 0; i < max; i++) {
    try { return await fn(); }
    catch (e) {
      const retryable = e.status === 529 || e.status === 500 || /timeout|Connection/i.test(e.message);
      if (retryable && i < max - 1) {
        console.warn(`  ⚠️ API 오류(${i+1}/${max}) ${e.message} — ${delay/1000}s 후 재시도`);
        await new Promise(r => setTimeout(r, delay));
      } else throw e;
    }
  }
}
function parseAnalysis(raw) {
  const text = raw.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
  try { return JSON.parse(text).analysis; } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]).analysis; }
    catch { try { return JSON.parse(jsonrepair(m[0])).analysis; } catch {} }
  }
  return null;
}

function hasPoduhFormat(ana) {
  return /📌\s*지문\s*근거\s*:\s*["“]/.test(ana || "");
}

// ─── 메인 ────────────────────────────────────────────────────────────────
async function regenFormat(yearKey, data) {
  const yd = data[yearKey];
  if (!yd) {
    console.warn(`⚠️ ${yearKey} 없음 — 스킵`);
    return { targets: 0, ok: 0, fail: 0 };
  }

  // 타깃 수집
  const targets = [];
  for (const sec of ["reading", "literature"]) {
    for (const set of yd[sec] || []) {
      for (const q of set.questions || []) {
        for (const c of q.choices || []) {
          const hasCs = Array.isArray(c.cs_ids) && c.cs_ids.length > 0;
          if (hasCs && !hasPoduhFormat(c.analysis)) {
            targets.push({ sec, set, q, c });
          }
        }
      }
    }
  }

  console.log(`\n[${yearKey}] 타깃 ${targets.length}개 선지 재생성 시작`);
  let okCount = 0, failCount = 0;
  const failures = [];

  for (let i = 0; i < targets.length; i++) {
    const { set, q, c } = targets[i];
    const loc = `${yearKey}/${set.id}/Q${q.id}/#${c.num}`;
    const bogi = q.bogi
      ? (typeof q.bogi === "string" ? q.bogi : q.bogi.description || "")
      : "";

    // 지문 본문 (body/verse/author만, figure 제외) 자연어
    const sentsText = (set.sents || [])
      .filter(s => ["body","verse","footnote","author","workTag"].includes(s.sentType) || !s.sentType)
      .map(s => s.t || "")
      .join("\n");

    const userPrompt = `[지문 본문]
${sentsText}

${bogi ? `[<보기>]\n${bogi}\n` : ""}
[세트 정보]
set.id = "${set.id}"  → 도메인: ${set.id.startsWith("l") ? "문학(L1~L5)" : "독서(R1~R4)"}

[문항] Q${q.id} questionType=${q.questionType || "?"}
${q.t || ""}

[현재 선지 #${c.num}]
"${c.t || ""}"

[메타]
ok = ${c.ok}
pat = ${c.pat ?? "null"}

SYSTEM_PROMPT의 모든 규칙, 특히 [📌 지문 근거 절대 규칙]을 반드시 준수하라.
반드시 📌 지문 근거: "지문 원문 직접 인용" 으로 쓸 것. paraphrase 금지.
출력: { "analysis": "..." }`;

    process.stdout.write(`  [${i+1}/${targets.length}] ${loc} (ok=${c.ok})... `);
    try {
      const resp = await callWithRetry(() =>
        client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 2200,
          system: SYSTEM,
          messages: [{ role: "user", content: userPrompt }],
        }, { headers: { "anthropic-beta": "output-128k-2025-02-19" } })
      );
      const newAna = parseAnalysis(resp.content[0].text);
      if (!newAna) throw new Error("parse fail");
      if (!hasPoduhFormat(newAna)) {
        console.log("⚠️ 포맷 미준수 — skip");
        failures.push({ loc, reason: "format_fail", preview: newAna.slice(0, 80) });
        failCount++;
        continue;
      }
      c.analysis = newAna;
      console.log(`✅ (${newAna.length}자)`);
      okCount++;

      // 10개마다 중간 저장
      if ((okCount % 10) === 0) {
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
      failures.push({ loc, reason: "api_fail", msg: e.message });
      failCount++;
    }
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  console.log(`\n[${yearKey}] 완료 — 성공 ${okCount} / 실패 ${failCount}`);
  if (failures.length > 0 && failures.length <= 20) {
    console.log("실패 목록:");
    for (const f of failures) console.log(`  ${f.loc} — ${f.reason} ${f.preview||f.msg||""}`);
  }
  return { targets: targets.length, ok: okCount, fail: failCount };
}

// 타깃 집계만 (API 호출 없음)
function countTargets(yearKey, data) {
  const yd = data[yearKey];
  if (!yd) return { missing: true, total: 0, targets: 0, bySet: {} };
  let total = 0, targets = 0;
  const bySet = {};
  for (const sec of ["reading", "literature"]) {
    for (const set of yd[sec] || []) {
      let setTargets = 0;
      for (const q of set.questions || []) {
        for (const c of q.choices || []) {
          total++;
          const hasCs = Array.isArray(c.cs_ids) && c.cs_ids.length > 0;
          if (hasCs && !hasPoduhFormat(c.analysis)) {
            targets++;
            setTargets++;
          }
        }
      }
      if (setTargets > 0) bySet[set.id] = setTargets;
    }
  }
  return { total, targets, bySet };
}

(async () => {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

  if (DRY_RUN) {
    console.log("═".repeat(60));
    console.log(" reanalyze_format — DRY RUN (집계만, API 호출 없음)");
    console.log("═".repeat(60));
    console.log(
      "연도키        | 선지 | 타깃 | 예상 API 호출 | 예상 소요\n" +
        "--------------+------+------+---------------+----------",
    );
    // 선지 1건당 평균 ~3.2초 (이전 2025_9월 실제 실행 기준: 112건 약 6분 — 보수적 상향)
    const SEC_PER_CALL = 3.2;
    let totalTargets = 0;
    const missingYears = [];
    for (const yr of yearsToProcess) {
      const r = countTargets(yr, data);
      if (r.missing) {
        missingYears.push(yr);
        console.log(`  ${yr.padEnd(12)} | 데이터 없음 (스킵)`);
        continue;
      }
      const secEst = Math.round(r.targets * SEC_PER_CALL);
      const minEst = Math.floor(secEst / 60);
      const remSec = secEst % 60;
      console.log(
        `  ${yr.padEnd(12)} | ${String(r.total).padStart(4)} | ${String(r.targets).padStart(4)} | ${String(r.targets).padStart(13)} | ${String(minEst).padStart(2)}분 ${String(remSec).padStart(2)}초`,
      );
      totalTargets += r.targets;
    }
    console.log("--------------+------+------+---------------+----------");
    const totalSec = Math.round(totalTargets * SEC_PER_CALL);
    const totalMin = Math.floor(totalSec / 60);
    const totalHr = Math.floor(totalMin / 60);
    const restMin = totalMin % 60;
    console.log(
      `  ${"합계".padEnd(12)} |      | ${String(totalTargets).padStart(4)} | ${String(totalTargets).padStart(13)} | ${
        totalHr > 0 ? `${totalHr}시간 ${restMin}분` : `${totalMin}분 ${totalSec % 60}초`
      }`,
    );

    console.log("\n[세트별 상세 (타깃 >0)]");
    for (const yr of yearsToProcess) {
      const r = countTargets(yr, data);
      if (r.missing || r.targets === 0) continue;
      const entries = Object.entries(r.bySet)
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => `${id}:${n}`)
        .join("  ");
      console.log(`  ${yr}: ${entries}`);
    }

    console.log("\n[비용 참고]");
    console.log(`  평균 프롬프트 길이 ~2~3K 토큰 / 응답 ~0.5~1K 토큰 (sonnet 4.5)`);
    console.log(`  총 API 호출: ${totalTargets}회`);
    console.log(`  실패율 ~25% (포맷 미준수 skip) — 2025_9월 실측 기준`);
    if (missingYears.length)
      console.log(`\n⚠️  데이터 없는 연도(스킵): ${missingYears.join(", ")}`);
    console.log(
      "\n실제 실행: --dry-run 플래그 제거 후 동일 명령 재실행",
    );
    process.exit(0);
  }

  // 백업
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const bkp = path.join(BACKUP_DIR, `all_data_204_backup_${ts}_reanalyze_format.json`);
  fs.copyFileSync(DATA_PATH, bkp);
  console.log(`✅ 백업: ${bkp}`);

  const summary = {};
  for (const yr of yearsToProcess) {
    summary[yr] = await regenFormat(yr, data);
  }

  console.log("\n" + "=".repeat(60));
  console.log(" reanalyze_format 요약");
  console.log("=".repeat(60));
  for (const [yr, s] of Object.entries(summary)) {
    console.log(`  ${yr}: 타깃 ${s.targets} / 성공 ${s.ok} / 실패 ${s.fail}`);
  }
})().catch(e => { console.error("오류:", e); process.exit(1); });
