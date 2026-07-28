// step3_v2.mjs — v2 해설 재생성 드라이버 (마커 범위 주입 정식 경로)
//   기존 step3_analysis.js는 프롬프트 내장 + 마커 범위 주입 0이라 v2 확산 경로가 없었음.
//   본 드라이버가 그 배선을 정식화:
//     1) system 프롬프트 = config/step3_prompt_v2.txt 파일 읽기(하드코딩 금지, §2 완화 조건 a)
//     2) payload에 marker_context.buildMarkerBlock 결과 [마커 범위 — 정본] 주입
//     3) 스코프 --yk / --set / --q (yearKey 배치 단위)
//     4) 출력 스키마 = 기존 step3와 동일 [{ qId, num, pat, analysis }]
//     5) --dry-run: LLM 호출 없이 payload를 파일 덤프(크레딧 0 배선 실증)
// 사용:
//   node pipeline/step3_v2.mjs --yk=2026수능 --set=l2026a --q=19 --dry-run
//   node pipeline/step3_v2.mjs --yk=2026수능                 (실호출 — 크레딧 필요)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildMarkerBlock } from "./marker_context.mjs";
import { _s2norm, matchVerseMultiSent } from "./haesol_v2_gate.mjs"; // 결정B 검증 = 게이트와 동일 정규화·verse매처(단일 소스)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public/data/all_data_204.json");
const PROMPT_V2_PATH = path.join(ROOT, "config/step3_prompt_v2.txt");

const args = process.argv.slice(2);
const opt = (k) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=").slice(1).join("=") : null;
};
const DRY = args.includes("--dry-run");
const yk = opt("yk");
const setFilter = opt("set");
const qFilter = opt("q");

// CLI 진입 여부 — import(테스트·재사용) 시 아래 종료 로직이 돌지 않게 가드
const IS_CLI =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (IS_CLI && !yk) {
  console.error("--yk=<yearKey> 필수 (배치 단위)");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
if (IS_CLI && !data[yk]) {
  console.error(`SCOPE_EMPTY: ${yk} 데이터 없음`);
  process.exit(1);
}
// 프롬프트 정본 = 파일 단일 소스 (하드코딩 금지)
const systemPrompt = fs.readFileSync(PROMPT_V2_PATH, "utf8");

// ── 어휘(V) 문항 판별 — API 생성 대상에서 제외 ──────────────────────────────
//   v2 구조의 일반 지시("📌 지문 근거를 대라")와 어휘 예외("V 오답은 📌에 지문 인용
//   금지")가 충돌해 LLM이 2회 모두 일반 지시를 따랐다(2026-07-20 r2025b 실증).
//   문구로 교정되지 않으므로 payload에서 아예 제외하고 옵션 B로 작성한다.
//   판별: 선지에 pat=V가 있거나, 발문이 어휘 유형.
const VOCAB_STEM_RE =
  /바꿔 쓰기에|문맥상.*의미|가장 가까운|의미로 쓰인|의미로 적절하지/;
export function isVocabQuestion(q) {
  if ((q.choices || []).some((c) => c.pat === "V")) return true;
  return VOCAB_STEM_RE.test(String(q.t || ""));
}

function selectSets() {
  const out = [];
  for (const sec of ["reading", "literature"])
    for (const s of data[yk][sec] || []) {
      if (setFilter && s.id !== setFilter) continue;
      out.push(s);
    }
  return out;
}

// userPrompt = 기존 step3 형식(정답 정보 + 세트 데이터 + 반환 스키마) + 마커 범위 블록
// 정답 선지 판정 — 발문 유형 무관 "소수(minority) 선지" 규칙.
//   5지선다의 정답은 항상 홀로 다른 ok 값을 갖는 1개 선지다. 나머지 4개가 그 반대.
//     · negative("적절하지 않은 것") → 정답 ok:false 1개 · 나머지 ok:true (722건)
//     · positive("적절한 것")       → 정답 ok:true 1개 · 나머지 ok:false (642건)
//     · positive 메타("답을 찾을 수 없는 질문") → 정답 ok:false 1개 (r2022c Q10, §6)
//   구 로직 `find(c => c.ok)`는 첫 ok:true를 정답으로 봐서 부정발문 722건 전건 + 메타 1건을
//   오답으로 전달했다(2026-07-23 실증). questionType 분기(isNeg)로는 positive 메타를 못 잡으므로
//   소수 규칙으로 통합한다 — 전 코퍼스 1,365 문항 전건 정답 특정 성공.
export function pickCorrect(q) {
  const T = (q.choices || []).filter((c) => c.ok === true);
  const F = (q.choices || []).filter((c) => c.ok === false);
  if (T.length === 1 && F.length >= 1) return T[0];
  if (F.length === 1 && T.length >= 1) return F[0];
  return null; // 소수가 유일하지 않음 → answerGuide 생략(정답 특정 불가)
}

function buildUserPrompt(set) {
  const answerGuide = set.questions
    .map((q) => {
      const correct = pickCorrect(q);
      return correct
        ? `문항 ${q.id}번 (${q.questionType}): 정답 선지 = ${correct.num}번`
        : null;
    })
    .filter(Boolean)
    .join("\n");

  // 문항별 [마커 범위 — 정본] 블록 (marker_context — annotations.json 단일 소스)
  const markerBlocks = set.questions
    .map((q) => {
      const { block } = buildMarkerBlock(yk, set.id, q);
      return `▷ 문항 ${q.id}\n${block}`;
    })
    .join("\n\n");

  // 선지별 ok 정본 — LLM이 스스로 적절/부적절을 판단하면 결론줄이 뒤집힌다
  //   (2026-07-20 r2025b: Q7①④⑤·Q8① 4건이 반대로 서술됨 = 오학습 직결).
  //   ok는 데이터에 확정된 값이므로 판단 여지를 주지 않고 명시한다.
  const okBlocks = set.questions
    .map(
      (q) =>
        `문항 ${q.id}: ` +
        (q.choices || [])
          .map((c) => `${"①②③④⑤⑥⑦"[c.num - 1] || c.num}ok:${c.ok === true}`)
          .join(" "),
    )
    .join("\n");

  return `다음 세트를 분석해줘.

[정답 정보]
${answerGuide}

[선지 판정 — 정본(절대)]
${okBlocks}

[마커 범위 — 문항별 정본]
${markerBlocks}

[세트 데이터]
${JSON.stringify(set)}

각 선지의 pat과 analysis만 작성해줘. ok 필드는 출력하지 마.
- 정답 선지(ok:true에 해당): pat: null
- 오답 선지(ok:false에 해당): 독서 세트는 R1~R4, 문학 세트는 L1~L5, 어휘는 V 중 하나
- 위 [마커 범위 — 정본]의 범위를 근거로 마커 관련 선지를 서술할 것(범위 밖 어구 추측 금지).

choices 배열만 JSON으로 반환해줘.
형식: [{ qId: 1, num: 1, pat: null, analysis: "..." }, ...]
반드시 qId(문항 id)를 포함해줘.`;
}

// ── 인용 자동 복원 (마커 기호 누락 한정) ──────────────────────────────────────
//   LLM이 인용문에서 마커 기호(㉠·ⓐ·[A])를 "편집 기호"로 보고 지우는 경향이 있어
//   exact-substring이 깨진다(프롬프트 지시로 교정되지 않음 — 2026-07-20 실호출 2회 실증).
//   기계적 패턴이므로 결정적 로직으로 복원한다.
//   안전장치: 마커 제거 후 exact 매치가 "유일"할 때만 치환. 0건/2건 이상은 손대지 않고
//   FAIL로 남긴다(오교정 방지). 부분 유사도·정규화 매칭 금지. 다문장 병합·보기 변형은
//   복원 대상이 아니다(그건 진짜 규칙 위반).
const MARKER_STRIP_RE = /[㉠-㉿]|[ⓐ-ⓩ]|[Ⓐ-Ⓩ]|\[[A-F가-힣]\]/g;
// 정규화: 마커 기호 + 공백 제거. 지문에 PDF 추출 artifact(단어 내 공백, 예 "시급 하지만")가
//   있으면 LLM이 자연스럽게 붙여 인용해 exact가 깨진다 — 원문 구간으로 되돌린다(§13⑥).
const normForMatch = (s) =>
  String(s || "")
    .replace(MARKER_STRIP_RE, "")
    .replace(/\s+/g, "");

export function repairQuotes(analysis, sents) {
  let out = String(analysis || "");
  const repairs = [];
  // 인용 위치는 불릿(·)·📌 라인·본문 어디든 될 수 있으므로 큰따옴표 전체를 후보로 본다.
  //   (불릿만 보면 `📌 지문 근거: ㉠ = "..."` 형식의 마커 누락을 놓친다 — 2026-07-20 실증)
  //   복원은 "마커 제거 후 유일 매치"일 때만 일어나므로 과다 치환은 발생하지 않는다.
  for (const m of [...out.matchAll(/"([^"]{6,})"/g)]) {
    const q = m[1];
    if (sents.some((s) => String(s.t || "").includes(q))) continue; // 이미 정상
    // 정규화본(마커·공백 제거)에서 후보 탐색
    const qn = normForMatch(q);
    if (qn.length < 6) continue;
    const skip = (ch) => {
      MARKER_STRIP_RE.lastIndex = 0;
      return /\s/.test(ch) || MARKER_STRIP_RE.test(ch);
    };
    const hits = [];
    for (const s of sents) {
      const raw = String(s.t || "");
      const norm = normForMatch(raw);
      let from = 0;
      for (;;) {
        const i = norm.indexOf(qn, from);
        if (i < 0) break;
        hits.push({ sentId: s.id, raw, i });
        from = i + 1;
      }
    }
    if (hits.length !== 1) continue; // 0건·다중 = 치환 금지(FAIL로 남김)
    const { sentId, raw, i } = hits[0];
    // 정규화 인덱스 i..i+qn.length 를 raw 인덱스로 역매핑(제거된 마커·공백을 되살림)
    let si = 0,
      start = -1,
      end = -1;
    for (let ri = 0; ri <= raw.length; ri++) {
      if (si === i && start < 0) start = ri;
      if (si === i + qn.length) {
        end = ri;
        break;
      }
      if (ri === raw.length) break;
      if (!skip(raw[ri])) si++;
    }
    if (start < 0 || end < 0) continue;
    const restored = raw.slice(start, end);
    // 복원 결과가 실제로 원문 substring이고 내용이 동일한지 최종 확인(불변식)
    if (!raw.includes(restored) || normForMatch(restored) !== qn) continue;
    out = out.split(`"${q}"`).join(`"${restored}"`);
    repairs.push({ sentId, before: q, after: restored });
  }
  return { analysis: out, repairs };
}

// 기존 step3 산출물 호환 파서 (마크다운 펜스 제거 후 JSON 배열 추출)
function parseChoices(text) {
  let t = String(text || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const lo = t.indexOf("[");
  const hi = t.lastIndexOf("]");
  if (lo < 0 || hi < 0) throw new Error("JSON 배열 미검출");
  return JSON.parse(t.slice(lo, hi + 1));
}

const sets = IS_CLI ? selectSets() : [];
if (IS_CLI && !sets.length) {
  console.error(
    `SCOPE_EMPTY: ${yk}${setFilter ? "::" + setFilter : ""} 검사 대상 0세트`,
  );
  process.exit(1);
}

const OUT_DIR = path.join(ROOT, "pipeline/output/v2_dryrun");

async function main() {
  let client = null;
  if (!DRY) {
    // 실호출 경로 — 크레딧 필요 (dry-run이 아닐 때만 SDK 로드)
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { default: dotenv } = await import("dotenv");
    dotenv.config({ path: path.join(ROOT, ".env"), override: true });
    // 스트리밍 장문 생성은 SDK 기본 타임아웃(10분)을 넘길 수 있다
    //   (2026-07-20 r2025b: 834초에 terminated). 30분으로 상향.
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 30 * 60 * 1000,
      maxRetries: 2,
    });
    fs.mkdirSync(OUT_DIR, { recursive: true });
  } else {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // [발주A] 세트별 작업 수집 → runBatch로 격리·재시도·단언.
  const jobs = [];

  for (const set of sets) {
    // --q 필터: 해당 문항만 남긴 세트 사본(sents는 전체 유지 = 근거 문맥 보존)
    let scoped = qFilter
      ? {
          ...set,
          questions: set.questions.filter(
            (q) => String(q.id) === String(qFilter),
          ),
        }
      : set;
    // 어휘(V) 문항 제외 — 옵션 B 대상(감사성 로그 필수)
    const vocabQs = scoped.questions.filter(isVocabQuestion);
    if (vocabQs.length) {
      scoped = {
        ...scoped,
        questions: scoped.questions.filter((q) => !isVocabQuestion(q)),
      };
      console.log(
        `[제외] 어휘 문항 ${vocabQs.length}개 API 제외 → 옵션 B 대상: Q${vocabQs.map((q) => q.id).join(", Q")}`,
      );
    }
    if (!scoped.questions.length) {
      console.warn(`  ${set.id}: API 대상 문항 0 — skip(전부 어휘 문항)`);
      continue;
    }
    if (qFilter && !scoped.questions.length) {
      console.warn(`  ${set.id}: 문항 ${qFilter} 없음 — skip`);
      continue;
    }
    const userPrompt = buildUserPrompt(scoped);

    if (DRY) {
      const fname = `${yk}_${set.id}${qFilter ? "_q" + qFilter : ""}.txt`;
      const fpath = path.join(OUT_DIR, fname);
      fs.writeFileSync(
        fpath,
        `===== SYSTEM PROMPT (config/step3_prompt_v2.txt, ${systemPrompt.length}자) =====\n` +
          `${systemPrompt}\n\n` +
          `===== USER PAYLOAD (${userPrompt.length}자) =====\n${userPrompt}\n`,
        "utf8",
      );
      console.log(`[dry-run] 덤프: ${path.relative(ROOT, fpath)}`);
      continue;
    }

    // [발주A] 세트별 작업으로 수집 → runBatch가 격리·재시도·단언(테스트 가능하게 순수화).
    const expectC = scoped.questions.reduce(
      (a, q) => a + (q.choices || []).length,
      0,
    );
    const _set = set,
      _scoped = scoped,
      _up = userPrompt,
      _ec = expectC;
    jobs.push({
      id: set.id,
      run: () => generateOneSet(client, _set, _scoped, _up, _ec),
    });
  } // end for(set)

  const batch = await runBatch(jobs);
  // [발주A] 종료 단언 — DRY 아닐 때만. 요청 세트 == 산출물(result.json) 수 대조.
  if (!DRY) {
    const resultFiles = fs
      .readdirSync(OUT_DIR)
      .filter((f) => f.startsWith(`${yk}_`) && f.endsWith("_result.json"));
    console.log(
      `\n[배치 요약] 요청 ${batch.requested.length} · 생성 ${batch.produced.length} · 실패 ${batch.failed.length} · result.json ${resultFiles.length}`,
    );
    if (batch.failed.length)
      console.error(
        `[배치 실패] ${batch.failed.map((f) => `${f.id}(${f.err.slice(0, 40)})`).join(" · ")}`,
      );
    if (batch.missing.length) {
      console.error(
        `🔴 미생성 ${batch.missing.length}세트: ${batch.missing.join(", ")} — 요청≠산출물(무증상 중단 차단)`,
      );
      process.exit(1);
    }
  }
}

// [발주A] 배치 실행 — 세트별 격리 + 재시도 1회(§8 D엔진 retry 정합).
//   한 세트 throw가 나머지를 중단시키지 않는다(실패는 기록·계속). 종료 시 missing 산출.
//   job.run()은 async(성공=resolve, 실패=throw). §13⑮(7) 양성 회귀를 mock run으로 재현.
export async function runBatch(jobs) {
  const requested = [],
    produced = [],
    failed = [];
  for (const j of jobs) {
    requested.push(j.id);
    let done = false;
    for (let attempt = 1; attempt <= 2 && !done; attempt++) {
      try {
        await j.run();
        produced.push(j.id);
        done = true;
      } catch (e) {
        console.error(`[생성실패] ${j.id} 시도 ${attempt}/2: ${e.message}`);
        if (attempt === 2) failed.push({ id: j.id, err: e.message });
      }
    }
  }
  const missing = requested.filter((id) => !produced.includes(id));
  return { requested, produced, failed, missing };
}

// ── [결정B] 생성후 결정론 검증 — 📌 인용 exact substring(결정A _s2norm 정합) ──
//   각 12+ 큰따옴표 인용이 sent.t/bogi에 (KNOWN 구조표기 정규화 후) 실재하는지 검사.
//   char-level(古語 하난↔하나·의역·괄호 부연 삽입)은 _s2norm 후에도 불일치 → 실패.
//   notation diff(각주*·전각·한자병기)는 통과 = 결정A 게이트와 동일 판정(헛 재호출 방지, B-3).
//   또한 근거 필수 선지(ok:false + 비-AUTO pat)인데 유효 지문 앵커 0개면 실패
//   (문학 E_required_cs_missing 예방 — 결정B③ 강제).
const NO_ANCHOR_PATS = new Set(["R3", "V", null]);
function _nearestSentId(quote, sents) {
  if (!quote) return null;
  const nq = _s2norm(quote);
  let best = null,
    bl = -1;
  for (const s of sents) {
    const B = _s2norm(s.t || "");
    let i = 0;
    while (i < nq.length && B.includes(nq.slice(0, i + 1))) i++;
    if (i > bl) {
      bl = i;
      best = s;
    }
  }
  return best ? best.id : null;
}
// 한 세트 선지 검증 → 실패 앵커 목록 [{qId,num,quote,nearestSentId[,reason]}].
//   quote=null + reason:"no_anchor" = 근거 필수인데 유효 인용 자체가 없음.
export function verifyAnchors(choices, set) {
  const sents = set.sents || [];
  const failures = [];
  for (const c of choices) {
    const q = (set.questions || []).find((x) => String(x.id) === String(c.qId));
    const dc = q && (q.choices || []).find((x) => x.num === c.num);
    const ok = dc ? dc.ok : undefined; // ok는 데이터 정본(생성물엔 없음)
    const bogi =
      q &&
      (typeof q.bogi === "string"
        ? q.bogi
        : q.bogi
          ? JSON.stringify(q.bogi)
          : "");
    let passSent = 0,
      failedHere = false;
    for (const m of String(c.analysis || "").matchAll(/"([^"]{12,})"/g)) {
      const qt = m[1];
      // [보완] 따옴표 짝 꼬임 시 정규식이 여러 줄을 삼켜 만든 garbage 인용 제외.
      //   지문 verbatim은 줄바꿈·풀이화살표(→)·섹션 이모지(📌🎯…)를 포함하지 않는다
      //   (검증기 오탐 방지 — l2014a Q33c2 실증). 정상 인용은 이 토큰이 없어 그대로 추출.
      if (/[\n→]|[📌🎯🔍⚡🧠🔗🔎❌✅]/u.test(qt)) continue;
      // 다문장은 WARNING(게이트 정합) — exact 대상 아님
      if (qt.split(/[.!?]/).filter(Boolean).length > 1 || /…|\.{2,}/.test(qt))
        continue;
      const nq = _s2norm(qt);
      if (nq.length < 6) continue;
      if (sents.some((sn) => _s2norm(sn.t || "").includes(nq))) {
        passSent++;
        continue;
      }
      if (bogi && _s2norm(bogi).includes(nq)) continue; // 보기 인용(앵커로 안 셈)
      if (matchVerseMultiSent(qt, sents)) {
        passSent++; // 연속 verse 다행 = 유효 앵커(§13⑬)
        continue;
      }
      failedHere = true;
      failures.push({
        qId: c.qId,
        num: c.num,
        quote: qt,
        nearestSentId: _nearestSentId(qt, sents),
      });
    }
    const needsAnchor = ok === false && !NO_ANCHOR_PATS.has(c.pat);
    if (!failedHere && needsAnchor && passSent === 0)
      failures.push({
        qId: c.qId,
        num: c.num,
        quote: null,
        nearestSentId: null,
        reason: "no_anchor",
      });
  }
  return failures;
}

// 세트 1개 API 생성 → 파싱 → 선지수 검증 → 마커 복원. write 없음(검증·병합은 generateOneSet).
async function produceChoices(client, set, userPrompt, expectC, tag = "") {
  const resp = await client.messages.create(
    {
      model: "claude-sonnet-4-5",
      // 16000 초과는 SDK가 스트리밍을 요구하므로 stream:true와 함께 상향(2026-07-20 r2025b 실증).
      max_tokens: 40000,
      stream: true,
      // [캐싱] system(안정 프롬프트)만 블록화 + cache_control ephemeral(5분 TTL).
      //   가변부(세트·answerGuide·okBlocks·markerBlocks)는 전부 userPrompt에 있어 system은 호출 간 완전 동일 → 캐시 warm.
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    },
    { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
  );
  let text = "",
    stopReason = null;
  const usage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };
  for await (const ev of resp) {
    if (ev.type === "message_start" && ev.message?.usage) {
      usage.input_tokens = ev.message.usage.input_tokens ?? 0;
      usage.output_tokens = ev.message.usage.output_tokens ?? 0;
      usage.cache_read_input_tokens =
        ev.message.usage.cache_read_input_tokens ?? 0;
      usage.cache_creation_input_tokens =
        ev.message.usage.cache_creation_input_tokens ?? 0;
    }
    if (ev.type === "content_block_delta" && ev.delta?.text)
      text += ev.delta.text;
    if (ev.type === "message_delta") {
      if (ev.usage?.output_tokens != null)
        usage.output_tokens = ev.usage.output_tokens;
      if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
    }
  }
  // [캐싱 검증] 캐시 적중(read>0) / 최초 기록(write>0) 로그 — 배치 비용 실측.
  console.log(
    `[usage] ${set.id}${tag}: in=${usage.input_tokens} out=${usage.output_tokens} cache_read=${usage.cache_read_input_tokens} cache_write=${usage.cache_creation_input_tokens}`,
  );
  fs.writeFileSync(
    path.join(OUT_DIR, `${yk}_${set.id}${tag}_raw.txt`),
    `stop_reason=${stopReason}\nusage=${JSON.stringify(usage)}\n\n${text}`,
    "utf8",
  );
  const choices = parseChoices(text);
  if (choices.length !== expectC)
    throw new Error(
      `선지 개수 불일치 ${choices.length} ≠ 기대 ${expectC} (stop=${stopReason})`,
    );
  let repairN = 0;
  for (const c of choices) {
    const { analysis, repairs } = repairQuotes(c.analysis, set.sents);
    c.analysis = analysis;
    for (const r of repairs) {
      repairN++;
      console.log(
        `[repair] Q${c.qId}[${c.num}] @${r.sentId}: ${JSON.stringify(r.before.slice(0, 30))} → ${JSON.stringify(r.after.slice(0, 30))}`,
      );
    }
  }
  if (repairN) console.log(`[repair] 마커 복원 ${repairN}건`);
  return { choices, usage, stopReason };
}

// 세트 1개: 생성 → [결정B] 결정론 검증 → 실패 시 재호출 1회 → 병합 → flagged 격리 → write.
//   병합(B-4): 1차 통과 선지 원본 유지, 1차 실패 && 2차 통과 선지만 교체. 여전히 실패=flagged.
//   throw 시 상위 runBatch가 격리(선지수 불일치 등). scoped는 호출 호환 위해 유지(미사용).
async function generateOneSet(client, set, scoped, userPrompt, expectC) {
  const r1 = await produceChoices(client, set, userPrompt, expectC);
  let choices = r1.choices;
  let usageNote = r1.usage;
  const fpFlag = path.join(OUT_DIR, `${yk}_${set.id}_flagged.json`);
  let flagged = [];

  const fails1 = verifyAnchors(choices, set);
  if (fails1.length) {
    const failKeys = new Set(fails1.map((f) => `${f.qId}_${f.num}`));
    console.log(
      `[검증] ${set.id}: 1차 앵커 실패 ${fails1.length}건 [${[...failKeys].join(", ")}] → 재호출 1회`,
    );
    const r2 = await produceChoices(
      client,
      set,
      userPrompt,
      expectC,
      "_recall",
    );
    const fails2Keys = new Set(
      verifyAnchors(r2.choices, set).map((f) => `${f.qId}_${f.num}`),
    );
    const c2 = new Map(r2.choices.map((c) => [`${c.qId}_${c.num}`, c]));
    // 병합: 1차 실패 && 2차 통과인 선지만 재호출본으로 교체
    choices = choices.map((c) => {
      const k = `${c.qId}_${c.num}`;
      return failKeys.has(k) && !fails2Keys.has(k) && c2.has(k) ? c2.get(k) : c;
    });
    usageNote = { first: r1.usage, recall: r2.usage };
    flagged = verifyAnchors(choices, set); // 병합 결과 재검증 = 잔여 실패
  }

  // flagged 파일: 잔여 있으면 기록, 없으면 이전 잔재 제거(재실행 청결)
  if (flagged.length) {
    fs.writeFileSync(fpFlag, JSON.stringify(flagged, null, 2), "utf8");
    console.log(
      `[flagged] ${set.id}: 잔여 ${flagged.length}건 옵션B 격리 → ${path.basename(fpFlag)}`,
    );
  } else if (fs.existsSync(fpFlag)) {
    fs.unlinkSync(fpFlag);
  }

  const fpath = path.join(OUT_DIR, `${yk}_${set.id}_result.json`);
  fs.writeFileSync(fpath, JSON.stringify(choices, null, 2), "utf8");
  console.log(
    `[생성] ${set.id}: ${choices.length}선지 → ${path.relative(ROOT, fpath)}` +
      (flagged.length ? ` · flagged ${flagged.length}` : " · 앵커 clean"),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, `${yk}_${set.id}_usage.json`),
    JSON.stringify(
      {
        setId: set.id,
        choices: choices.length,
        usage: usageNote,
        flagged: flagged.length,
      },
      null,
      2,
    ),
    "utf8",
  );
}

if (IS_CLI)
  main().catch((e) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  });
