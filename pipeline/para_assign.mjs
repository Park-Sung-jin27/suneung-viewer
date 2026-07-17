/**
 * pipeline/para_assign.mjs — 독서 지문 문단(para) 경계 추출·부여 (영구 도구)
 *
 * 원리:
 *   시험지 PDF(-layout)에서 문단 첫 줄은 컬럼 기본 indent보다 1~2칸 더 들여쓰기됨.
 *   문단 경계는 항상 문장(sent) 시작과 일치하므로, "들여쓰기된 줄의 머리글"과
 *   sent 머리글을 정규화 매칭하여 para 경계 sent 를 식별한다.
 *
 * 사용법:
 *   node pipeline/para_assign.mjs --year 2026수능            # dry-run (기본)
 *   node pipeline/para_assign.mjs --year 2026수능 --apply    # 적용 (백업 자동)
 *   node pipeline/para_assign.mjs --scope beta [--apply]     # 베타 15 yearKey 일괄
 *
 * 적용 결과: 독서 set 의 모든 sent 에 para: N (1부터). 경계 미검출 set 은 skip + 보고.
 * 요구사항: pdftotext (poppler). PDF 경로: _done/{yearKey}/{yearKey}_시험지.pdf
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const BETA = [
  "2026수능",
  "2025수능",
  "2024수능",
  "2023수능",
  "2022수능",
  "2022_6월",
  "2023_6월",
  "2024_6월",
  "2025_6월",
  "2026_6월",
  "2022_9월",
  "2023_9월",
  "2024_9월",
  "2025_9월",
  "2026_9월",
];

const args = process.argv.slice(2);
const getArg = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const APPLY = args.includes("--apply");
const yearArg = getArg("--year");
const scope = getArg("--scope");
const boundsFile = getArg("--bounds"); // 사전 산출 경계 파일 {setId:[sentIdx,...]} — pdftotext 없는 환경(Windows)용
const years = yearArg ? [yearArg] : scope === "beta" ? BETA : null;
if (!years) {
  console.error("사용법: --year <yearKey> | --scope beta [--apply]");
  process.exit(1);
}

const MARK = /[㉠-㋿①-⓿]/g; // 원문자 일체
const norm = (t) => t.replace(MARK, "").replace(/[\s'’‘"”“….·*,()\[\]-]/g, "");

function pdfLines(yearKey) {
  const pdf = path.join(ROOT, "_done", yearKey, `${yearKey}_시험지.pdf`);
  if (!fs.existsSync(pdf)) return null;
  const txt = execFileSync("pdftotext", ["-layout", pdf, "-"], {
    maxBuffer: 64e6,
  }).toString("utf8");
  return txt.split("\n");
}

// 들여쓰기 후보 줄 추출: 컬럼 base(빈도 최다 indent) + 1~2 칸
function paraStartHeads(lines) {
  const recs = lines
    .map((l) => ({ ind: l.length - l.trimStart().length, text: l.trim() }))
    .filter((r) => r.text.length >= 6);
  const heads = new Set();
  for (const side of [(r) => r.ind < 30, (r) => r.ind >= 30]) {
    const grp = recs.filter(side);
    const freq = {};
    for (const r of grp) freq[r.ind] = (freq[r.ind] || 0) + 1;
    const base = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (base === undefined) continue;
    const b = parseInt(base);
    for (const r of grp) {
      if (r.ind === b + 1 || r.ind === b + 2) {
        const h = norm(r.text).slice(0, 12);
        if (h.length >= 6) heads.add(h);
      }
    }
  }
  return heads;
}

function assignSet(set, heads) {
  const sents = set.sents || [];
  const bounds = [];
  sents.forEach((s, i) => {
    if (typeof s.t !== "string") return;
    // (가)(나) 복합 지문: workTag sent 또는 "(가)"~"(라)" 로 시작하는 sent 는 자동 경계
    if (s.sentType === "workTag" || /^\((가|나|다|라)\)/.test(s.t.trim())) {
      bounds.push(i);
      return;
    }
    const h = norm(s.t).slice(0, 12);
    if (h.length >= 6 && heads.has(h)) bounds.push(i);
  });
  // para 부여: 첫 sent = 1, boundary 마다 +1 (boundary 가 0번이면 중복 증가 방지)
  let para = 1;
  const boundSet = new Set(bounds.filter((i) => i > 0));
  const assigned = sents.map((s, i) => {
    if (boundSet.has(i)) para++;
    return para;
  });
  return { bounds, totalParas: para, assigned };
}

function assignFromBounds(set, bounds) {
  const sents = set.sents || [];
  let para = 1;
  const boundSet = new Set(bounds.filter((i) => i > 0));
  const assigned = sents.map((s, i) => {
    if (boundSet.has(i)) para++;
    return para;
  });
  return { bounds, totalParas: para, assigned };
}

const d = JSON.parse(fs.readFileSync(DATA, "utf8"));
let applied = 0,
  skipped = 0;
const report = [];
for (const yk of years) {
  const Y = d[yk];
  if (!Y) {
    report.push(`${yk}: yearKey 없음 — skip`);
    continue;
  }
  let preBounds = null;
  if (boundsFile) preBounds = JSON.parse(fs.readFileSync(boundsFile, "utf8"));
  let heads = null;
  if (!preBounds) {
    const lines = pdfLines(yk);
    if (!lines) {
      report.push(`${yk}: PDF 없음 — skip`);
      skipped++;
      continue;
    }
    heads = paraStartHeads(lines);
  }
  for (const set of Y.reading || []) {
    if (preBounds && !preBounds[set.id]) {
      report.push(`  ${yk} ${set.id}: bounds 파일에 없음 — skip`);
      skipped++;
      continue;
    }
    const { bounds, totalParas, assigned } = preBounds
      ? assignFromBounds(set, preBounds[set.id])
      : assignSet(set, heads);
    const sc = (set.sents || []).length;
    const avg = sc / totalParas;
    if (totalParas < 2 || totalParas > 15 || avg > 11) {
      report.push(
        `  ⚠ ${yk} ${set.id}: 문단 ${totalParas}개 (sents ${sc}, 평균 ${avg.toFixed(1)}) — 비정상, skip (needs_human)`,
      );
      skipped++;
      continue;
    }
    report.push(
      `  ${yk} ${set.id}: 문단 ${totalParas}개 / sents ${sc} (경계 sentIdx: ${bounds.join(",")})`,
    );
    if (APPLY) {
      set.sents.forEach((s, i) => {
        s.para = assigned[i];
      });
      applied++;
    }
  }
}
report.forEach((r) => console.log(r));
console.log(
  `\n${APPLY ? "적용" : "dry-run"} — set ${applied}개 적용 / ${skipped}건 skip`,
);
if (APPLY) {
  const bak = path.join(
    ROOT,
    "pipeline/backups",
    `all_data_204.before_para_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.json`,
  );
  if (!fs.existsSync(bak)) fs.copyFileSync(DATA, bak);
  fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
  console.log("기록 완료 + 백업:", path.basename(bak));
}
