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
function buildUserPrompt(set) {
  const answerGuide = set.questions
    .map((q) => {
      const correct = (q.choices || []).find((c) => c.ok);
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

    // 실호출 (크레딧 필요) — 스키마: [{ qId, num, pat, analysis }]
    const resp = await client.messages.create(
      {
        model: "claude-sonnet-4-5",
        // 30선지 세트는 16000으로 잘려 JSON이 미완성됨(2026-07-20 r2025b 실증).
        // 30선지 세트는 16000으로 잘려 JSON이 미완성됨(2026-07-20 r2025b 실증).
        // 16000 초과는 SDK가 스트리밍을 요구하므로 stream:true와 함께 상향한다.
        max_tokens: 40000,
        stream: true,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      },
      { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
    );
    // 스트리밍 응답을 텍스트·usage로 합산 (16000 초과 요청은 SDK가 스트리밍을 요구)
    let text = "",
      stopReason = null;
    const usage = { input_tokens: 0, output_tokens: 0 };
    for await (const ev of resp) {
      if (ev.type === "message_start" && ev.message?.usage) {
        usage.input_tokens = ev.message.usage.input_tokens ?? 0;
        usage.output_tokens = ev.message.usage.output_tokens ?? 0;
      }
      if (ev.type === "content_block_delta" && ev.delta?.text)
        text += ev.delta.text;
      if (ev.type === "message_delta") {
        if (ev.usage?.output_tokens != null)
          usage.output_tokens = ev.usage.output_tokens;
        if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
      }
    }
    // 파싱 실패 진단용 원문 보존(절단·형식 이탈 원인 규명)
    fs.writeFileSync(
      path.join(OUT_DIR, `${yk}_${set.id}_raw.txt`),
      `stop_reason=${stopReason}\nusage=${JSON.stringify(usage)}\n\n${text}`,
      "utf8",
    );
    const choices = parseChoices(text);
    // 마커 기호 누락 자동 복원(유일 매치만). 감사성 로그 출력.
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
    const fpath = path.join(OUT_DIR, `${yk}_${set.id}_result.json`);
    fs.writeFileSync(fpath, JSON.stringify(choices, null, 2), "utf8");
    // 실단가 측정용 usage 기록 (배치 예산 산출 근거 — 추정 아닌 실측)
    const u = usage;
    console.log(
      `[생성] ${set.id}: ${choices.length}선지 → ${path.relative(ROOT, fpath)} (stop=${stopReason})`,
    );
    console.log(
      `[usage] input=${u.input_tokens ?? "?"} output=${u.output_tokens ?? "?"}` +
        (u.cache_read_input_tokens != null
          ? ` cache_read=${u.cache_read_input_tokens}`
          : ""),
    );
    fs.writeFileSync(
      path.join(OUT_DIR, `${yk}_${set.id}_usage.json`),
      JSON.stringify(
        { setId: set.id, choices: choices.length, usage: u },
        null,
        2,
      ),
      "utf8",
    );
  }
}

if (IS_CLI)
  main().catch((e) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  });
