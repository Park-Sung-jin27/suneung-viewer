/**
 * pipeline/step3_rules.mjs
 *
 * step3_analysis.js의 postProcess() 함수에 통합.
 * 기존 postProcess 로직을 강화하는 규칙 레이어.
 *
 * 연동:
 *   step3_analysis.js 상단에:
 *     import { enforceRules } from './step3_rules.mjs';
 *
 *   postProcess() 함수 내 updatedChoices.push(choice) 직전에:
 *     enforceRules(choice, q.questionType, section);
 */

/**
 * enforceRules(choice, questionType, sec)
 * 선지 하나에 대해 규칙을 강제 적용. 원본 mutate.
 * @returns {string[]} 경고 메시지 배열
 */
export function enforceRules(choice, questionType, sec) {
  const warnings = [];

  // 1. ok:true면 pat 반드시 null
  if (choice.ok === true && choice.pat !== null && choice.pat !== undefined) {
    warnings.push(`ok:true인데 pat:${choice.pat} → null`);
    choice.pat = null;
  }

  // 2. ok:false면 pat 있어야 함 (0은 미분류 플래그 — 허용하되 경고)
  if (
    choice.ok === false &&
    (choice.pat === null || choice.pat === undefined)
  ) {
    warnings.push(`ok:false인데 pat 없음 → 0으로 플래그`);
    choice.pat = 0;
  }

  // 3. analysis 결론 줄 vs ok 불일치 감지 + 자동 수정
  if (choice.analysis) {
    const lines = choice.analysis.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.includes("✅") && !line.includes("❌")) continue;

      const hasOk = line.includes("✅");
      const hasFail = line.includes("❌");

      if (choice.ok === true && hasFail && !hasOk) {
        warnings.push(`ok:true인데 결론 ❌ → ✅ 자동 수정`);
        lines[i] = line
          .replace(/❌.*\[.*?\]\s*$/, "✅ 지문과 일치하는 적절한 진술")
          .replace(/❌.*$/, "✅ 지문과 일치하는 적절한 진술");
        choice.analysis = lines.join("\n");
      }

      if (choice.ok === false && hasOk && !hasFail) {
        warnings.push(`ok:false인데 결론 ✅ → ❌ 자동 수정 (pat 재확인 필요)`);
        lines[i] = line.replace(/✅.*$/, "❌ 지문과 어긋나는 부적절한 진술[?]");
        choice.analysis = lines.join("\n");
      }
      break;
    }
  }

  // 4. 구체계 패턴명 치환 (혹시 남아있으면)
  const OLD_PAT_MAP = {
    "팩트 왜곡": sec === "reading" ? "R1" : "L1",
    "관계·인과 전도": sec === "reading" ? "R2" : "L4",
    "과도한 추론": sec === "reading" ? "R3" : "L3",
    "개념 혼합": sec === "reading" ? "R4" : "L1",
    "개념 짜깁기": sec === "reading" ? "R4" : "L1",
  };
  if (choice.analysis) {
    for (const [oldName, newPat] of Object.entries(OLD_PAT_MAP)) {
      if (choice.analysis.includes(`[${oldName}]`)) {
        const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        choice.analysis = choice.analysis.replace(
          new RegExp(`\\[${escaped}\\]`, "g"),
          `[${newPat}]`,
        );
        if (choice.pat === "0" || choice.pat === 0) choice.pat = newPat;
        warnings.push(`구체계 [${oldName}] → [${newPat}]`);
      }
    }
  }

  return warnings;
}
