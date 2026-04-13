import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 커맨드라인 ───────────────────────────────────────────────

const examKey = process.argv[2];

if (!examKey) {
  console.error("사용법: node pipeline/step7_deploy.js <시험키>");
  console.error('예시: node pipeline/step7_deploy.js "2022수능"');
  process.exit(1);
}

// ─── 데이터 로드 ─────────────────────────────────────────────

const allDataPath = path.resolve(__dirname, "../public/data/all_data_204.json");
const allData = JSON.parse(fs.readFileSync(allDataPath, "utf8"));

if (!allData[examKey]) {
  console.error(`시험 키를 찾을 수 없음: "${examKey}"`);
  console.error("사용 가능한 키:", Object.keys(allData).join(", "));
  process.exit(1);
}

const exam = allData[examKey];

// ─── 검증 ────────────────────────────────────────────────────

console.log(`\n[step7] 검증 중: ${examKey} (${exam.label})`);
console.log("=".repeat(50));

const issues = [];

for (const section of ["reading", "literature"]) {
  const sets = exam[section] ?? [];
  for (const set of sets) {
    for (const q of set.questions ?? []) {
      for (const c of q.choices ?? []) {
        // analysis 비어 있음
        if (!c.analysis || !c.analysis.trim()) {
          issues.push(`[${set.id}] ${q.id}번 선지${c.num}: analysis 없음`);
        }
        // ok:false인데 pat null
        if (c.ok === false && (c.pat === null || c.pat === undefined)) {
          issues.push(
            `[${set.id}] ${q.id}번 선지${c.num}: ok=false인데 pat 없음`,
          );
        }
        // ok:true인데 pat이 있음
        if (c.ok === true && c.pat !== null && c.pat !== undefined) {
          issues.push(
            `[${set.id}] ${q.id}번 선지${c.num}: ok=true인데 pat=${c.pat}`,
          );
        }
      }
    }
  }
}

// 통계
let totalSets = 0,
  totalQuestions = 0,
  totalChoices = 0;
let filledAnalysis = 0,
  filledCsIds = 0;

for (const section of ["reading", "literature"]) {
  const sets = exam[section] ?? [];
  totalSets += sets.length;
  for (const set of sets) {
    totalQuestions += set.questions?.length ?? 0;
    for (const q of set.questions ?? []) {
      totalChoices += q.choices?.length ?? 0;
      for (const c of q.choices ?? []) {
        if (c.analysis && c.analysis.trim()) filledAnalysis++;
        if (Array.isArray(c.cs_ids) && c.cs_ids.length > 0) filledCsIds++;
      }
    }
  }
}

console.log(
  `세트: ${totalSets}개 | 문항: ${totalQuestions}개 | 선지: ${totalChoices}개`,
);
console.log(`analysis: ${filledAnalysis}/${totalChoices}`);
console.log(`cs_ids:   ${filledCsIds}/${totalChoices}`);

if (issues.length > 0) {
  console.warn(`\n⚠️  검증 경고 (${issues.length}건):`);
  issues.slice(0, 20).forEach((i) => console.warn("  " + i));
  if (issues.length > 20) console.warn(`  ... 외 ${issues.length - 20}건`);

  // analysis 빈 선지에 기본값 채우기
  let fixed = 0;
  for (const section of ["reading", "literature"]) {
    for (const set of exam[section] ?? []) {
      for (const q of set.questions ?? []) {
        for (const c of q.choices ?? []) {
          if (!c.analysis || !c.analysis.trim()) {
            c.analysis = c.ok
              ? "지문의 내용과 일치한다."
              : "지문의 내용과 일치하지 않는다.";
            fixed++;
          }
        }
      }
    }
  }
  if (fixed > 0) {
    const allDataPath = path.resolve(
      __dirname,
      "../public/data/all_data_204.json",
    );
    const allData = JSON.parse(fs.readFileSync(allDataPath, "utf8"));
    allData[examKey] = exam;
    fs.writeFileSync(allDataPath, JSON.stringify(allData), "utf8");
    console.warn(`  → analysis 기본값 ${fixed}건 채움`);
  }
  console.log("\n⚠️  경고 있지만 진행\n");
} else {
  console.log("\n✅ 검증 통과\n");
}

// ─── 빌드 ────────────────────────────────────────────────────

console.log("[step7] npm run build 실행 중...");
console.log("=".repeat(50));

const rootDir = path.resolve(__dirname, "..");

try {
  execSync("npm run build", {
    cwd: rootDir,
    stdio: "inherit",
  });
} catch {
  console.error("\n❌ 빌드 실패");
  process.exit(1);
}

console.log("\n✅ 빌드 완료");
console.log(`   출력: ${path.join(rootDir, "dist")}`);
