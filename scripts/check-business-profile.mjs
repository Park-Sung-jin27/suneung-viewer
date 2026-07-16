import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legalTradeName = "지니쌤과 공부하자";
const representative = "박성진";
const phoneRaw = "050219442070";
const phoneDisplay = "0502-1944-2070";

const requiredFiles = [
  "src/App.jsx",
  "src/Privacy.jsx",
  "public/privacy.html",
  "public/terms.html",
  "public/fortune/index.html",
  "public/fortune/privacy.html",
  "public/fortune/terms.html",
  "public/suneung/index.html",
  "public/success.html",
  "public/fortune/success.html",
  "public/payment-success.html",
];

const failures = [];

for (const relativePath of requiredFiles) {
  const content = await readFile(path.join(root, relativePath), "utf8");

  if (!content.includes(legalTradeName)) {
    failures.push(`${relativePath}: 상호명 누락`);
  }
  if (!content.includes(representative)) {
    failures.push(`${relativePath}: 대표자명 누락`);
  }
  if (!content.includes(phoneRaw) && !content.includes(phoneDisplay)) {
    failures.push(`${relativePath}: 사업장 연락처 누락`);
  }
  if (/<span>상호명<\/span>\s*<b>박성진<\/b>/.test(content)) {
    failures.push(`${relativePath}: 상호명에 대표자명이 잘못 사용됨`);
  }
  if (/상호명\s*:\s*["']박성진["']/.test(content)) {
    failures.push(`${relativePath}: 상호명 객체 값이 대표자명으로 되돌아감`);
  }
}

if (failures.length) {
  console.error("BUSINESS_PROFILE_CHECK FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("BUSINESS_PROFILE_CHECK PASS");
console.log(
  `상호명=${legalTradeName} | 대표자=${representative} | 연락처=${phoneDisplay}`,
);
