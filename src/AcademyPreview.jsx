// ============================================================
// AcademyPreview.jsx — 학원 원장용 데모 대시보드
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { P } from "./constants";

const C = {
  green: "#2d6e2d",
  soft: "#3d8b3d",
  bg: "#f0f7f0",
  line: "#7aad7a",
  ink: "#0d1a0e",
  muted: "#5a6b5b",
  subtle: "#8a9b8b",
  paper: "#faf8f4",
  white: "#ffffff",
  border: "#e0dbd0",
};

const DEMO_STUDENTS = [
  {
    id: 1,
    name: "김민준",
    total: 45,
    correct: 38,
    topPat: "R2",
    streak: 5,
    lastActive: "2시간 전",
    pats: { R1: 1, R2: 4, R3: 2, R4: 0, L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 },
  },
  {
    id: 2,
    name: "이서연",
    total: 62,
    correct: 48,
    topPat: "L3",
    streak: 12,
    lastActive: "1일 전",
    pats: { R1: 2, R2: 1, R3: 3, R4: 1, L1: 2, L2: 1, L3: 4, L4: 0, L5: 0 },
  },
  {
    id: 3,
    name: "박지호",
    total: 30,
    correct: 21,
    topPat: "R1",
    streak: 2,
    lastActive: "3시간 전",
    pats: { R1: 5, R2: 2, R3: 1, R4: 1, L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 },
  },
  {
    id: 4,
    name: "최수아",
    total: 55,
    correct: 47,
    topPat: "L1",
    streak: 8,
    lastActive: "방금 전",
    pats: { R1: 0, R2: 1, R3: 1, R4: 0, L1: 3, L2: 2, L3: 1, L4: 1, L5: 0 },
  },
  {
    id: 5,
    name: "정도윤",
    total: 40,
    correct: 28,
    topPat: "R3",
    streak: 0,
    lastActive: "2일 전",
    pats: { R1: 2, R2: 3, R3: 4, R4: 1, L1: 1, L2: 1, L3: 0, L4: 0, L5: 0 },
  },
];

// ── 요약 카드 ────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 120,
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "20px 16px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "1.6rem",
          fontWeight: 800,
          color: accent || C.green,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "0.72rem",
          color: C.muted,
          marginTop: 6,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: "0.65rem", color: C.line, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── 학생 상세 모달 ───────────────────────────────────────────
function StudentModal({ student, onClose }) {
  if (!student) return null;
  const pct = Math.round((student.correct / student.total) * 100);
  const allPats = Object.entries(student.pats).filter(([, v]) => v > 0);
  allPats.sort((a, b) => b[1] - a[1]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.white,
          borderRadius: 16,
          padding: "28px 24px",
          maxWidth: 420,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              color: C.ink,
              margin: 0,
            }}
          >
            {student.name} 학생 리포트
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.3rem",
              cursor: "pointer",
              color: C.muted,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              flex: 1,
              background: C.bg,
              borderRadius: 10,
              padding: "14px 12px",
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "1.3rem", fontWeight: 800, color: C.green }}
            >
              {student.total}
            </div>
            <div style={{ fontSize: "0.68rem", color: C.muted, marginTop: 3 }}>
              풀이 문항
            </div>
          </div>
          <div
            style={{
              flex: 1,
              background: C.bg,
              borderRadius: 10,
              padding: "14px 12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "1.3rem",
                fontWeight: 800,
                color: pct >= 80 ? C.green : pct >= 60 ? "#b7950b" : "#c0392b",
              }}
            >
              {pct}%
            </div>
            <div style={{ fontSize: "0.68rem", color: C.muted, marginTop: 3 }}>
              정답률
            </div>
          </div>
          <div
            style={{
              flex: 1,
              background: C.bg,
              borderRadius: 10,
              padding: "14px 12px",
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "1.3rem", fontWeight: 800, color: C.green }}
            >
              {student.streak}일
            </div>
            <div style={{ fontSize: "0.68rem", color: C.muted, marginTop: 3 }}>
              연속 학습
            </div>
          </div>
        </div>

        <h4
          style={{
            fontSize: "0.82rem",
            fontWeight: 700,
            color: C.ink,
            marginBottom: 10,
          }}
        >
          오답 패턴 분포
        </h4>
        {allPats.length === 0 ? (
          <p style={{ fontSize: "0.78rem", color: C.subtle }}>오답 패턴 없음</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allPats.map(([key, cnt]) => {
              const info = P[key] || { name: key, color: "#888" };
              const maxCnt = allPats[0][1];
              const barPct = Math.round((cnt / maxCnt) * 100);
              return (
                <div key={key}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.75rem",
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ color: info.color, fontWeight: 700 }}>
                      {key} {info.name}
                    </span>
                    <span style={{ color: C.muted }}>{cnt}회</span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: C.bg,
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${barPct}%`,
                        background: info.color,
                        borderRadius: 3,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p
          style={{
            fontSize: "0.68rem",
            color: C.subtle,
            textAlign: "center",
            marginTop: 20,
            lineHeight: 1.6,
          }}
        >
          * 데모용 더미 데이터입니다
        </p>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function AcademyPreview() {
  const navigate = useNavigate();
  const [selectedStudent, setSelectedStudent] = useState(null);

  const totalStudents = DEMO_STUDENTS.length;
  const avgPct = Math.round(
    DEMO_STUDENTS.reduce((s, st) => s + (st.correct / st.total) * 100, 0) /
      totalStudents,
  );
  const activeThisWeek = DEMO_STUDENTS.filter(
    (s) => !s.lastActive.includes("일 전") || parseInt(s.lastActive) <= 3,
  ).length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      {/* ── 헤더 ── */}
      <header
        style={{
          background: C.white,
          borderBottom: `1px solid ${C.border}`,
          padding: "14px clamp(16px, 4vw, 32px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: "1rem",
              fontWeight: 700,
              color: C.green,
              cursor: "pointer",
            }}
            onClick={() => navigate("/")}
          >
            논리맵핑
          </span>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              color: C.muted,
              letterSpacing: "-0.01em",
            }}
          >
            학원 관리자
          </span>
        </div>
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "#b7950b",
            background: "rgba(183,149,11,0.1)",
            padding: "3px 10px",
            borderRadius: 20,
            letterSpacing: "0.02em",
          }}
        >
          DEMO
        </span>
      </header>

      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "24px clamp(16px, 4vw, 32px) 60px",
        }}
      >
        {/* ── 타이틀 ── */}
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: "clamp(1.2rem, 3vw, 1.5rem)",
              fontWeight: 700,
              color: C.ink,
              margin: "0 0 6px",
              letterSpacing: "-0.03em",
            }}
          >
            학원 현황 대시보드
          </h1>
          <p style={{ fontSize: "0.78rem", color: C.muted, margin: 0 }}>
            우리 학원 학생들의 국어 학습 현황을 한눈에 확인하세요
          </p>
        </div>

        {/* ── 요약 카드 ── */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 28,
            flexWrap: "wrap",
          }}
        >
          <StatCard label="등록 학생" value={`${totalStudents}명`} />
          <StatCard
            label="평균 정답률"
            value={`${avgPct}%`}
            accent={avgPct >= 75 ? C.green : "#b7950b"}
          />
          <StatCard
            label="이번 주 활동"
            value={`${activeThisWeek}명`}
            sub={`${totalStudents}명 중`}
          />
        </div>

        {/* ── 학생 테이블 ── */}
        <div
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 18px 12px",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <h2
              style={{
                fontSize: "0.88rem",
                fontWeight: 700,
                color: C.ink,
                margin: 0,
              }}
            >
              학생별 현황
            </h2>
          </div>

          {/* 테이블 헤더 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 60px 60px 80px 70px 72px",
              padding: "10px 18px",
              borderBottom: `1px solid ${C.border}`,
              background: C.bg,
              fontSize: "0.68rem",
              fontWeight: 600,
              color: C.muted,
              gap: 6,
            }}
          >
            <span>이름</span>
            <span style={{ textAlign: "center" }}>문항</span>
            <span style={{ textAlign: "center" }}>정답률</span>
            <span style={{ textAlign: "center" }}>주요 약점</span>
            <span style={{ textAlign: "center" }}>최근</span>
            <span style={{ textAlign: "center" }}></span>
          </div>

          {/* 테이블 바디 */}
          {DEMO_STUDENTS.map((st) => {
            const pct = Math.round((st.correct / st.total) * 100);
            const patInfo = P[st.topPat] || { name: st.topPat, color: "#888" };
            return (
              <div
                key={st.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 60px 60px 80px 70px 72px",
                  padding: "13px 18px",
                  borderBottom: `1px solid ${C.border}`,
                  alignItems: "center",
                  fontSize: "0.78rem",
                  gap: 6,
                }}
              >
                <span style={{ fontWeight: 600, color: C.ink }}>{st.name}</span>
                <span style={{ textAlign: "center", color: C.muted }}>
                  {st.total}
                </span>
                <span
                  style={{
                    textAlign: "center",
                    fontWeight: 700,
                    color:
                      pct >= 80 ? C.green : pct >= 60 ? "#b7950b" : "#c0392b",
                  }}
                >
                  {pct}%
                </span>
                <span style={{ textAlign: "center" }}>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color: patInfo.color,
                      background: `${patInfo.color}14`,
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {st.topPat}
                  </span>
                </span>
                <span
                  style={{
                    textAlign: "center",
                    fontSize: "0.68rem",
                    color: C.subtle,
                  }}
                >
                  {st.lastActive}
                </span>
                <span style={{ textAlign: "center" }}>
                  <button
                    onClick={() => setSelectedStudent(st)}
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      color: C.green,
                      background: "none",
                      border: `1px solid ${C.green}`,
                      borderRadius: 6,
                      padding: "4px 10px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    리포트
                  </button>
                </span>
              </div>
            );
          })}
        </div>

        {/* ── 모바일: 카드 뷰 (좁은 화면용 대체) ── */}
        <div
          style={{
            display: "none",
            flexDirection: "column",
            gap: 12,
            marginTop: 28,
          }}
        >
          {DEMO_STUDENTS.map((st) => {
            const pct = Math.round((st.correct / st.total) * 100);
            const patInfo = P[st.topPat] || { name: st.topPat, color: "#888" };
            return (
              <div
                key={`card-${st.id}`}
                style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: C.ink,
                      fontSize: "0.88rem",
                    }}
                  >
                    {st.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: C.subtle,
                    }}
                  >
                    {st.lastActive}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                  <span style={{ fontSize: "0.75rem", color: C.muted }}>
                    {st.total}문항
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color:
                        pct >= 80 ? C.green : pct >= 60 ? "#b7950b" : "#c0392b",
                    }}
                  >
                    {pct}%
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: patInfo.color,
                    }}
                  >
                    {st.topPat} {patInfo.name}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedStudent(st)}
                  style={{
                    width: "100%",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: C.green,
                    background: C.bg,
                    border: "none",
                    borderRadius: 8,
                    padding: "8px",
                    cursor: "pointer",
                  }}
                >
                  리포트 보기
                </button>
              </div>
            );
          })}
        </div>

        {/* ── 하단 CTA ── */}
        <div style={{ marginTop: 36, textAlign: "center" }}>
          <button
            onClick={() => {
              navigate("/");
              setTimeout(
                () =>
                  document
                    .getElementById("b2b-waitlist")
                    ?.scrollIntoView({ behavior: "smooth" }),
                300,
              );
            }}
            style={{
              width: "100%",
              maxWidth: 400,
              padding: "15px 24px",
              background: C.green,
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontSize: "0.92rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Noto Sans KR', sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            우리 학원에 도입하기
          </button>
          <p
            style={{
              fontSize: "0.7rem",
              color: C.subtle,
              marginTop: 10,
              lineHeight: 1.6,
            }}
          >
            강사 없이도 학생별 국어 오답 패턴을 진단하고 교정합니다
          </p>
        </div>
      </div>

      {/* ── 학생 상세 모달 ── */}
      <StudentModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />

      {/* ── 반응형 스타일 ── */}
      <style>{`
        @media (max-width: 580px) {
          /* 좁은 화면에서 테이블 숨기고 카드 표시 */
          div[style*="gridTemplateColumns"] { display: none !important; }
          div[style*="display: none"][style*="flexDirection: column"] {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
