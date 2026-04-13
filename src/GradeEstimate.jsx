// GradeEstimate.jsx
// ResultPage.jsx에서 import해서 사용
//
// 사용 예시 (ResultPage.jsx 내부):
//   import GradeEstimate from './GradeEstimate';
//   ...
//   <GradeEstimate correct={correctCount} total={totalCount} yearKey={yearKey} />
//
// Props:
//   correct  {number} — 맞은 문항 수
//   total    {number} — 전체 문항 수
//   yearKey  {string} — '2026수능', '2025수능' 등 YEAR_INFO의 키

import React from "react";
import { GRADE_CUTS, estimateGrade } from "./constants";

// 등급별 색상 (1~9)
const GRADE_COLORS = {
  1: { bg: "#EEF6FF", border: "#3B82F6", text: "#1D4ED8", badge: "#2563EB" },
  2: { bg: "#F0FDF4", border: "#22C55E", text: "#15803D", badge: "#16A34A" },
  3: { bg: "#F0FDF4", border: "#86EFAC", text: "#166534", badge: "#4ADE80" },
  4: { bg: "#FEFCE8", border: "#FACC15", text: "#854D0E", badge: "#EAB308" },
  5: { bg: "#FFF7ED", border: "#FB923C", text: "#9A3412", badge: "#F97316" },
  6: { bg: "#FFF1F2", border: "#F87171", text: "#B91C1C", badge: "#EF4444" },
  7: { bg: "#FFF1F2", border: "#F87171", text: "#B91C1C", badge: "#DC2626" },
  8: { bg: "#F9FAFB", border: "#D1D5DB", text: "#374151", badge: "#6B7280" },
  9: { bg: "#F9FAFB", border: "#D1D5DB", text: "#374151", badge: "#6B7280" },
};

// 등급별 피드백 메시지
const GRADE_FEEDBACK = {
  1: "최상위권입니다. 실전에서도 이 집중력을 유지하세요!",
  2: "상위권입니다. 틀린 문제 패턴을 분석하면 1등급도 가능합니다.",
  3: "중상위권입니다. 오답 패턴 집중 훈련으로 점수 향상이 가능합니다.",
  4: "중위권입니다. 독서·문학 각 영역별 취약 유형을 확인하세요.",
  5: "기본기 보완이 필요합니다. 핵심 개념어와 구조 독해를 다시 점검하세요.",
  6: "기초 재정비가 필요합니다. 지문 독해 속도와 정확도를 함께 키우세요.",
  7: "집중적인 기초 훈련이 필요합니다.",
  8: "기초부터 체계적으로 다시 시작하세요.",
  9: "기초부터 체계적으로 다시 시작하세요.",
};

export default function GradeEstimate({ correct, total, yearKey }) {
  const result = estimateGrade(correct, total, yearKey);

  // 해당 연도 데이터가 없으면 렌더링하지 않음
  if (!result) return null;

  const { grade, pct, verified, source } = result;
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS[8];
  const feedback = GRADE_FEEDBACK[grade] ?? "";

  // 등급컷 바 표시용 데이터
  const cutsData = GRADE_CUTS[yearKey]?.cuts ?? [];

  return (
    <div
      style={{
        margin: "20px 0",
        borderRadius: "12px",
        border: `2px solid ${colors.border}`,
        background: colors.bg,
        padding: "20px 24px",
        fontFamily: "inherit",
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#6B7280",
            letterSpacing: "0.05em",
          }}
        >
          예상 등급 (공통 34문항 기준)
        </span>
        {!verified && (
          <span
            style={{
              fontSize: "11px",
              background: "#FEF9C3",
              color: "#92400E",
              border: "1px solid #FDE68A",
              borderRadius: "4px",
              padding: "1px 6px",
              fontWeight: 600,
            }}
          >
            참고용
          </span>
        )}
      </div>

      {/* 등급 + 정답률 */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "16px",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          <span
            style={{
              fontSize: "48px",
              fontWeight: 900,
              color: colors.badge,
              lineHeight: 1,
            }}
          >
            {grade}
          </span>
          <span
            style={{ fontSize: "20px", fontWeight: 700, color: colors.text }}
          >
            등급
          </span>
        </div>
        <div style={{ fontSize: "15px", color: "#4B5563" }}>
          정답률 <strong>{pct}%</strong> ({correct}/{total}문항)
        </div>
      </div>

      {/* 피드백 */}
      <p
        style={{
          fontSize: "14px",
          color: colors.text,
          margin: "0 0 16px",
          lineHeight: 1.5,
        }}
      >
        {feedback}
      </p>

      {/* 등급컷 바 */}
      {cutsData.length > 0 && (
        <div>
          <div
            style={{
              fontSize: "12px",
              color: "#9CA3AF",
              marginBottom: "8px",
              fontWeight: 600,
            }}
          >
            {yearKey} 등급컷 (화법과 작문 기준)
          </div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {cutsData.map((cut, idx) => {
              const g = idx + 1;
              const isMyGrade = g === grade;
              return (
                <div
                  key={g}
                  style={{
                    textAlign: "center",
                    minWidth: "44px",
                    borderRadius: "6px",
                    padding: "6px 4px",
                    background: isMyGrade ? colors.badge : "#E5E7EB",
                    color: isMyGrade ? "#fff" : "#6B7280",
                    fontWeight: isMyGrade ? 800 : 500,
                    fontSize: "12px",
                    transition: "all 0.2s",
                    border: isMyGrade
                      ? `2px solid ${colors.border}`
                      : "2px solid transparent",
                  }}
                >
                  <div style={{ fontSize: "11px", marginBottom: "2px" }}>
                    {g}등급
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700 }}>
                    {cut}점+
                  </div>
                </div>
              );
            })}
            <div
              style={{
                textAlign: "center",
                minWidth: "44px",
                borderRadius: "6px",
                padding: "6px 4px",
                background: grade === 8 ? colors.badge : "#E5E7EB",
                color: grade === 8 ? "#fff" : "#6B7280",
                fontWeight: grade === 8 ? 800 : 500,
                fontSize: "12px",
                border:
                  grade === 8
                    ? `2px solid ${colors.border}`
                    : "2px solid transparent",
              }}
            >
              <div style={{ fontSize: "11px", marginBottom: "2px" }}>8등급</div>
              <div style={{ fontSize: "13px", fontWeight: 700 }}>~</div>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p
        style={{
          fontSize: "11px",
          color: "#9CA3AF",
          margin: "12px 0 0",
          lineHeight: 1.5,
          borderTop: "1px solid #E5E7EB",
          paddingTop: "10px",
        }}
      >
        ※ 공통 영역(독서·문학) 34문항만 기준. 선택과목(화법과작문·언어와매체)
        미포함. 실제 등급은 표준점수·선택과목 포함 원점수로 결정되므로
        참고용으로만 활용하세요.
        {!verified && ` 데이터 출처: ${source}.`}
      </p>
    </div>
  );
}
