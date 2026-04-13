// =====================================================================
// constants.js 에 아래 내용을 추가 (기존 export 목록 하단에 붙여넣기)
// =====================================================================

// 수능 국어 등급컷 (화법과 작문 선택 기준, 원점수 100점 만점 역산치)
// ※ 2022학년도 이후 국어 공식 등급은 표준점수 기반이며,
//    아래 원점수는 입시기관 역산 참고치로 실제와 다를 수 있습니다.
// ※ 이 앱은 공통 34문항(독서+문학)만 포함 — 선택과목 미포함
//
// verified: true  → 평가원 확정 채점 결과 기반
// verified: false → 입시기관(EBSi·메가·종로 등) 추정치 기반
//
// cuts 배열: [1등급컷, 2등급컷, 3등급컷, 4등급컷, 5등급컷, 6등급컷, 7등급컷]
// 각 값은 해당 등급에 진입하기 위한 최저 원점수 (100점 만점 기준 %)로 사용
//
// 출처:
//   2026수능: infogoodman.com (2025.12) — 평가원 확정 채점 결과 기반
//   2025수능: 오르비/입시기관 거피셜 (2024.12) — 다수 기관 95점 일치
//   2024수능: EBSi 가채점 발표 (2023.11) — 87점 (화작 기준)
//   2023수능: 입시기관 추정치 — 단일 출처 미검증
//   2022수능: 입시기관 추정치 — 단일 출처 미검증

export const GRADE_CUTS = {
  "2026수능": {
    // 출처: 평가원 확정 채점 결과 역산 (infogoodman.com 2025.12)
    cuts: [89, 81, 71, 61, 48, 36, 26],
    verified: true,
    source: "평가원 확정 채점 결과",
  },
  "2025수능": {
    // 출처: 오르비/다수 입시기관 거피셜 (1등급 95 다수 일치, 하위 등급 추정)
    cuts: [95, 87, 77, 65, 52, 39, 27],
    verified: false,
    source: "입시기관 추정치",
  },
  "2025_9월": null, // 9월 모의평가 — 학년도별 등급컷 적용 불가
  "2024수능": {
    // 출처: EBSi 가채점 결과 (2023.11.16) — 화작 87점, 하위 등급 추정
    cuts: [87, 79, 71, 61, 48, 36, 25],
    verified: false,
    source: "EBSi 가채점 기반",
  },
  "2023수능": {
    // 출처: 입시기관 추정치 — 미검증 참고용
    cuts: [93, 85, 75, 63, 50, 37, 25],
    verified: false,
    source: "입시기관 추정치 (미검증)",
  },
  "2022수능": {
    // 출처: 입시기관 추정치 — 통합수능 첫해, 미검증 참고용
    cuts: [89, 81, 71, 59, 46, 34, 23],
    verified: false,
    source: "입시기관 추정치 (미검증)",
  },
  "2022_6월": null, // 6월 모의평가 — 등급컷 데이터 적용 불가
};

// 등급 추정 헬퍼 함수
// correct: 맞은 문항 수, total: 전체 문항 수, yearKey: '2026수능' 등
// 반환값: { grade: 1~9, pct: 정답률 %, cut: 해당 등급컷, verified, source }
//         데이터 없으면 null 반환
export function estimateGrade(correct, total, yearKey) {
  const data = GRADE_CUTS[yearKey];
  if (!data || total === 0) return null;

  const pct = (correct / total) * 100;
  const cuts = data.cuts; // [1등급컷, 2등급컷, ..., 7등급컷]

  let grade = 8; // 기본값: 8등급 이하
  for (let i = 0; i < cuts.length; i++) {
    if (pct >= cuts[i]) {
      grade = i + 1;
      break;
    }
  }

  return {
    grade,
    pct: Math.round(pct),
    cutUsed: cuts[grade - 1] ?? null,
    verified: data.verified,
    source: data.source,
  };
}
