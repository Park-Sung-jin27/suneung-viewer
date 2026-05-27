/**
 * 시나리오 엔진 — 학생 점수 → 안전/균형/도전 3안 자동 산출
 */

// 임계값
var THRESHOLDS = {
  safe_margin: 0.008,
  balanced_low: -0.005,
  reach_low: -0.02,
};

// 희망 계열 keyword
var FIELD_KEYWORDS = {
  경영: ["경영", "회계", "비즈니스"],
  경제: ["경제", "금융", "재무"],
  심리: ["심리", "상담"],
  공학: [
    "공학",
    "기계",
    "전기",
    "전자",
    "토목",
    "건축",
    "산업",
    "화공",
    "신소재",
    "재료",
  ],
  자연과학: ["물리", "화학", "생명", "수학", "지구과학", "통계", "생물"],
  IT: ["컴퓨터", "소프트웨어", "정보", "데이터", "인공지능", "사이버", "AI"],
  컴퓨터공학: ["컴퓨터", "소프트웨어", "정보", "데이터"],
  의학: ["의예", "의학", "한의", "치의", "수의"],
  약학: ["약학"],
  교육: ["교육", "교직"],
  어문: [
    "국어국문",
    "영어영문",
    "중어중문",
    "일어일문",
    "독어독문",
    "불어불문",
  ],
  사회: ["사회", "행정", "정치", "외교", "언론"],
};

function normalizeUniv(name) {
  if (!name) return name;
  name = name.replace(/여자대학교$/, "여대");
  name = name.replace(/한국외국어대학교$/, "한국외대");
  name = name.replace(/대학교$/, "대");
  return name;
}

function normalizeCampus(name) {
  if (!name) return "본";
  if (name === "본교" || name === "본") return "본";
  if (name === "분교" || name === "분") return "분";
  return name;
}

var DEPT_NOISE_PATTERNS = [
  /^[‘’'"][가-힣A-Z][‘’'"]군$/,
  /^군=/,
  /^합계$/,
  /^소계$/,
  /^총계$/,
  /^[\d.]+$/,
];
function isValidDept(dept) {
  if (!dept || typeof dept !== "string") return false;
  if (dept.length < 2) return false;
  for (var i = 0; i < DEPT_NOISE_PATTERNS.length; i++) {
    if (DEPT_NOISE_PATTERNS[i].test(dept)) return false;
  }
  return true;
}

function computeStudentScore(student, formula) {
  var w = formula.weights;
  var m = formula.metric;
  var scores = student.scores;
  var kor =
    m["국어"] === "백분위" ? scores["국어"].percentile : scores["국어"].std;
  var math =
    m["수학"] === "백분위" ? scores["수학"].percentile : scores["수학"].std;
  var t1 =
    m["탐구"] === "백분위" ? scores["탐구1"].percentile : scores["탐구1"].std;
  var t2 =
    m["탐구"] === "백분위" ? scores["탐구2"].percentile : scores["탐구2"].std;
  var expl_avg = (t1 + t2) / 2;
  var max_score = formula.max_score || 1000;
  var scale_unit = m["국어"] === "백분위" ? 100 : 200;
  var reflected_pct = (w["국어"] + w["수학"] + w["탐구"]) / 100;
  var base = (kor * w["국어"] + math * w["수학"] + expl_avg * w["탐구"]) / 100;
  var scaled = (base / scale_unit) * max_score * reflected_pct;

  var eng_raw = 0;
  if (formula.english_grade_table && scores["영어"]) {
    var eg = scores["영어"].grade;
    eng_raw = formula.english_grade_table[eg - 1] || 0;
  }
  var eng_contrib = 0;
  if (w["영어"] > 0 && eng_raw >= 10) {
    eng_contrib = eng_raw * (w["영어"] / 100) * (max_score / 100);
  } else {
    eng_contrib = eng_raw;
  }

  var hist_contrib = 0;
  if (formula.korean_history_grade_table && scores["한국사"]) {
    var hg = scores["한국사"].grade;
    hist_contrib = formula.korean_history_grade_table[hg - 1] || 0;
  }

  var total = scaled + eng_contrib + hist_contrib;
  return {
    total: Math.round(total * 10) / 10,
    breakdown: {
      국어: Math.round(((kor * w["국어"]) / 100) * 10) / 10,
      수학: Math.round(((math * w["수학"]) / 100) * 10) / 10,
      탐구: Math.round(((expl_avg * w["탐구"]) / 100) * 10) / 10,
      영어: Math.round(eng_contrib * 10) / 10,
      한국사: hist_contrib,
    },
    max_score: max_score,
  };
}

function classify(student_score, cut70, max_score) {
  var diff = student_score - cut70;
  var ratio = diff / max_score;
  if (ratio >= THRESHOLDS.safe_margin) return "safe";
  if (ratio >= THRESHOLDS.balanced_low) return "balanced";
  if (ratio >= THRESHOLDS.reach_low) return "reach";
  return "fail";
}

function matchesWish(dept_name, wish_fields) {
  if (!wish_fields || wish_fields.length === 0) return true;
  for (var i = 0; i < wish_fields.length; i++) {
    var field = wish_fields[i];
    var keywords = FIELD_KEYWORDS[field] || [field];
    for (var j = 0; j < keywords.length; j++) {
      if (dept_name && dept_name.indexOf(keywords[j]) !== -1) return true;
    }
  }
  return false;
}

var REGION_MAP = {
  서울: ["서울"],
  수도권: ["서울", "경기", "인천"],
};

function matchesRegion(univ_region, wish_regions) {
  if (!wish_regions || wish_regions.length === 0) return true;
  var allowed = {};
  for (var i = 0; i < wish_regions.length; i++) {
    var rs = REGION_MAP[wish_regions[i]] || [wish_regions[i]];
    for (var j = 0; j < rs.length; j++) allowed[rs[j]] = true;
  }
  return !!allowed[univ_region];
}

function generateScenarios(student, data) {
  var universities = data.universities;
  var formulas = data.formulas;
  var jeongsi_cuts = data.jeongsi_cuts;

  var valid_formulas = formulas.filter(function (f) {
    if (!f.track) return true;
    if (student.track === "자연" && f.track.indexOf("인문") !== -1)
      return false;
    if (
      student.track === "인문" &&
      (f.track.indexOf("자연") !== -1 || f.track.indexOf("이공") !== -1)
    )
      return false;
    return true;
  });

  var univ_index = {};
  universities.forEach(function (u) {
    var key = normalizeUniv(u.name) + "|" + normalizeCampus(u.campus);
    univ_index[key] = u;
  });

  var cuts_by_univ = {};
  jeongsi_cuts.forEach(function (c) {
    if (!isValidDept(c.dept)) return;
    var key = normalizeUniv(c.univ);
    if (!cuts_by_univ[key]) cuts_by_univ[key] = [];
    cuts_by_univ[key].push(c);
  });

  var results = { safe: [], balanced: [], reach: [], fail: [] };

  for (var fi = 0; fi < valid_formulas.length; fi++) {
    var formula = valid_formulas[fi];
    var student_calc = computeStudentScore(student, formula);
    if (!student_calc) continue;

    var norm_univ = normalizeUniv(formula.univ);
    var f_campus = normalizeCampus(formula.campus);
    var dept_cuts_all = (cuts_by_univ[norm_univ] || []).filter(function (c) {
      return normalizeCampus(c.campus) === f_campus;
    });
    if (dept_cuts_all.length === 0) continue;

    // 컷 분포 분석 — outlier 제거 후 max/min 추정
    var cut_values_raw = dept_cuts_all
      .map(function (c) {
        return c.cut70;
      })
      .filter(function (v) {
        return typeof v === "number" && v > 50;
      });
    if (cut_values_raw.length === 0) continue;
    var cut_sorted = cut_values_raw.slice().sort(function (a, b) {
      return a - b;
    });
    var cut_max = cut_sorted[cut_sorted.length - 1];
    var cut_min = cut_sorted[0];
    var p25 = cut_sorted[Math.floor(cut_sorted.length * 0.25)];
    var p75 = cut_sorted[Math.floor(cut_sorted.length * 0.75)];

    // 학생 환산을 컷 스케일로 정규화
    // 그 학교의 cut_max ≈ 학교 만점 ~ 95% (의예/최상위 학과)
    // 환산공식 max는 그 학교 만점. 학생 비율 * cut_max
    var student_ratio = student_calc.total / student_calc.max_score;
    var student_scaled =
      Math.round(((student_ratio * cut_max) / 0.95) * 10) / 10;

    for (var di = 0; di < dept_cuts_all.length; di++) {
      var dept = dept_cuts_all[di];
      if (!isValidDept(dept.dept)) continue;
      if (typeof dept.cut70 !== "number" || dept.cut70 < 50) continue;
      // outlier: 같은 학교 cut_max의 50% 미만은 제외 (계열별 환산 단위 다름 등)
      if (dept.cut70 < cut_max * 0.5) continue;
      if (!matchesWish(dept.dept, student["희망_계열"])) continue;
      var u = univ_index[norm_univ + "|" + f_campus];
      if (u && !matchesRegion(u.region, student["희망_지역"])) continue;

      // 분류: 학생 점수와 cut의 차이를 cut_max 대비 비율로
      var diff = Math.round((student_scaled - dept.cut70) * 10) / 10;
      var ratio = (student_scaled - dept.cut70) / cut_max;
      var bucket;
      if (ratio >= 0.015) bucket = "safe";
      else if (ratio >= -0.01) bucket = "balanced";
      else if (ratio >= -0.03) bucket = "reach";
      else bucket = "fail";

      results[bucket].push({
        univ: formula.univ,
        univ_short: norm_univ,
        campus: formula.campus,
        dept: dept.dept,
        group: dept.group,
        capacity: dept.capacity,
        competition: dept.competition,
        cut70: dept.cut70,
        student_score: student_scaled,
        max_score: Math.round(cut_max * 10) / 10,
        diff: diff,
        breakdown: student_calc.breakdown,
        formula_source: formula.source,
        region: u ? u.region : null,
      });
    }
  }

  results.safe.sort(function (a, b) {
    return b.diff - a.diff;
  });
  results.balanced.sort(function (a, b) {
    return Math.abs(a.diff) - Math.abs(b.diff);
  });
  results.reach.sort(function (a, b) {
    return b.diff - a.diff;
  });
  results.fail.sort(function (a, b) {
    return b.diff - a.diff;
  });
  return results;
}

function pickRecommendation(scenarios) {
  return {
    safe: scenarios.safe.slice(0, 5),
    balanced: scenarios.balanced.slice(0, 5),
    reach: scenarios.reach.slice(0, 5),
  };
}

function generateBalancedRationale(pick) {
  if (!pick) return "추천 학과 없음 (희망 계열/지역 조건 완화 권장)";
  var cut_ratio = ((pick.student_score / pick.max_score) * 100).toFixed(1);
  var margin = pick.diff >= 0 ? "+" + pick.diff : String(pick.diff);
  return (
    pick.univ +
    " " +
    pick.dept +
    " (" +
    (pick.group || "정시") +
    "): 작년 70cut " +
    pick.cut70 +
    " vs 학생 환산 " +
    pick.student_score +
    " (" +
    margin +
    "). " +
    "만점 대비 " +
    cut_ratio +
    "%. 모집 " +
    pick.capacity +
    "명, 작년 경쟁률 " +
    pick.competition +
    "배."
  );
}

function generateRisks(scenarios, student) {
  var risks = [];
  if (scenarios.balanced.length === 0) {
    risks.push(
      "균형권 학과 없음 — 학생 환산점수가 30개 환산공식 대학 70cut과 거리 큼",
    );
  }
  if (scenarios.safe.length < 2) {
    risks.push("안전권 부족 — 추가 안전권 확보 필요");
  }
  if (scenarios.reach.length === 0 && scenarios.balanced.length > 0) {
    risks.push("도전권 없음 — 학생 잠재력 대비 보수적 포트폴리오");
  }
  if (student.scores["영어"] && student.scores["영어"].grade >= 4) {
    risks.push(
      "영어 " +
        student.scores["영어"].grade +
        "등급 — 영어 감점 큰 대학 환산 불리",
    );
  }
  if (student.scores["한국사"] && student.scores["한국사"].grade >= 5) {
    risks.push(
      "한국사 " + student.scores["한국사"].grade + "등급 — 일부 대학 감점",
    );
  }
  risks.push(
    "INFO: 데이터 잠정 — 환산공식 30개 대학만 검증 중. 시험_변환표 작년 11월 수능 기준.",
  );
  return risks;
}

function generateParentSummary(picks, student) {
  var b = picks.balanced[0];
  var s = picks.safe[0];
  var r = picks.reach[0];
  return {
    student_name: student.name,
    season_label: "2026학년도 정시 (잠정)",
    headline: b
      ? student.name + " 학생, 균형권 추천: " + b.univ + " " + b.dept
      : student.name + " 학생 — 균형권 미확보",
    three_options: {
      safe: s ? { name: s.univ + " " + s.dept, prob: "약 80%" } : null,
      balanced: b ? { name: b.univ + " " + b.dept, prob: "약 50%" } : null,
      reach: r ? { name: r.univ + " " + r.dept, prob: "약 20%" } : null,
    },
    this_week_do: [
      "6월 모의고사 응시 (백분위 확정)",
      "균형권 학과 모집요강 출력 (수능최저·반영비율 재확인)",
      "원서접수 일정 캘린더 등록",
    ],
    this_week_dont: [
      "타 학원/유튜브 정시 컨설팅 동시 진행 — 혼선 유발",
      "지금 환산점수만으로 지원 확정 — 6월 모평 후 재산정 필수",
    ],
    next_meeting: "6월 모평 직후 (예정)",
  };
}

function generateDirectorScript(picks, student) {
  var b = picks.balanced[0];
  if (!b) {
    return [
      student.name +
        " 학생, 현재 환산점수로는 30개 환산공식 대학 균형권이 잡히지 않습니다.",
      "6월 모평 결과로 백분위가 확정되면 재산정하겠습니다.",
      "그 사이 학생부 정량 점검과 비교과 활동 정리를 권합니다.",
    ];
  }
  var diff_str = b.diff >= 0 ? "+" + b.diff : String(b.diff);
  return [
    student.name +
      " 학생, " +
      b.univ +
      " " +
      b.dept +
      "이(가) 작년 70cut(" +
      b.cut70 +
      ")과 가장 가까운 균형권입니다 (" +
      diff_str +
      "점).",
    "작년 경쟁률 " +
      b.competition +
      "배, 모집 " +
      b.capacity +
      "명 기준 합격 가능성 약 50% 구간입니다.",
    "6월 모평 직후 백분위가 확정되면 환산점수를 다시 산정하고, 안전권 1개·도전권 1개를 함께 확정합시다.",
  ];
}


// ============================================================================
// 수시 매칭 엔진
// ============================================================================

// 전형명 분류 (안전·균형·도전 시 카드별 라벨)
function classifyTransType(name) {
  if (!name) return "기타";
  if (name.indexOf("논술") !== -1) return "논술";
  if (name.indexOf("실기") !== -1 || name.indexOf("특기") !== -1) return "실기";
  if (name.indexOf("교과") !== -1) return "학생부교과";
  if (name.indexOf("종합") !== -1 || name.indexOf("우수자") !== -1 || name.indexOf("인재") !== -1 || name.indexOf("잠재") !== -1) return "학생부종합";
  if (name.indexOf("지역균형") !== -1 || name.indexOf("지역인재") !== -1) return "지역균형";
  if (name.indexOf("일반") !== -1) return "일반전형";
  return "기타";
}

// 수시: 학생 내신 vs cut70_grade
function classifySusi(student_grade, cut70_grade) {
  // 내신은 숫자가 작을수록 좋음. diff = cut - 학생 → +면 학생이 우수
  // 실제 수시 컨설팅 관행:
  //   학생이 cut보다 1등급 이상 우수 → 안전 (80%)
  //   0.3~1.0 우수 → 균형 (50%)
  //   -0.3~0.3 → 도전 (20%)
  //   -0.3 미만 → 미달
  var diff = cut70_grade - student_grade;
  if (diff >= 1.0) return "safe";
  if (diff >= 0.3) return "balanced";
  if (diff >= -0.3) return "reach";
  return "fail";
}

function generateSusiScenarios(student, data) {
  var universities = data.universities;
  var susi_cuts = data.susi_cutoffs;
  var student_grade = student["내신"];
  if (typeof student_grade !== "number") {
    return { safe: [], balanced: [], reach: [], fail: [] };
  }

  var univ_index = {};
  universities.forEach(function (u) {
    var key = normalizeUniv(u.name) + "|" + normalizeCampus(u.campus);
    univ_index[key] = u;
  });

  var results = { safe: [], balanced: [], reach: [], fail: [] };

  // 특별 전형 / 야간 등 일반 학생 부적합 키워드
  var SPECIAL_TRANS_KW = ["취업자", "장애인", "교육기회배려자", "기회균형", "농어촌", "특수교육", "특성화고", "재외국민", "북한", "탈북", "다문화"];

  for (var i = 0; i < susi_cuts.length; i++) {
    var c = susi_cuts[i];
    if (!isValidDept(c.dept)) continue;
    if (typeof c.cut70_grade !== "number") continue;
    if (c.cut70_grade < 1 || c.cut70_grade > 9) continue;
    // 야간 학과 제외
    if (c.dept.indexOf("(야)") !== -1 || c.dept.indexOf("야간") !== -1) continue;
    // 특별 전형 제외
    var tname = c["전형"] || "";
    var skip = false;
    for (var sk = 0; sk < SPECIAL_TRANS_KW.length; sk++) {
      if (tname.indexOf(SPECIAL_TRANS_KW[sk]) !== -1) { skip = true; break; }
    }
    if (skip) continue;

    // 희망/지역 필터
    if (!matchesWish(c.dept, student["희망_계열"])) continue;
    var key = normalizeUniv(c.univ) + "|" + normalizeCampus(c.campus);
    var u = univ_index[key];
    if (u && !matchesRegion(u.region, student["희망_지역"])) continue;

    var bucket = classifySusi(student_grade, c.cut70_grade);
    var diff = Math.round((c.cut70_grade - student_grade) * 100) / 100;
    var trans_type = classifyTransType(c["전형"]);

    results[bucket].push({
      univ: c.univ,
      univ_short: normalizeUniv(c.univ),
      campus: c.campus,
      dept: c.dept,
      전형: c["전형"],
      전형분류: trans_type,
      capacity: c.capacity,
      competition: c.competition,
      cut70_grade: c.cut70_grade,
      student_grade: student_grade,
      diff: diff,
      region: u ? u.region : null,
      source: c.source,
    });
  }

  // 정렬: 균형은 차이 작은 순, 안전/도전은 차이 큰 순
  results.safe.sort(function (a, b) { return b.diff - a.diff; });
  results.balanced.sort(function (a, b) { return Math.abs(a.diff) - Math.abs(b.diff); });
  results.reach.sort(function (a, b) { return b.diff - a.diff; });
  results.fail.sort(function (a, b) { return b.diff - a.diff; });

  return results;
}

function pickSusiRecommendation(scenarios) {
  return {
    safe: scenarios.safe.slice(0, 5),
    balanced: scenarios.balanced.slice(0, 5),
    reach: scenarios.reach.slice(0, 5),
  };
}

function generateSusiRationale(pick) {
  if (!pick) return "수시 균형권 추천 없음 (희망 계열/지역 조건 완화 권장)";
  var margin = pick.diff >= 0 ? "+" + pick.diff : String(pick.diff);
  return (
    pick.univ + " " + pick.dept + " (" + (pick["전형분류"] || "수시") + " - " + (pick["전형"] || "") + "): " +
    "작년 70cut 등급 " + pick.cut70_grade + " vs 학생 내신 " + pick.student_grade + " (차이 " + margin + "). " +
    "모집 " + pick.capacity + "명, 작년 경쟁률 " + pick.competition + "배."
  );
}

// 수시 + 정시 통합 학부모 리포트
function generateCombinedParentSummary(jeongsi_picks, susi_picks, student) {
  var jB = jeongsi_picks ? jeongsi_picks.balanced[0] : null;
  var sB = susi_picks ? susi_picks.balanced[0] : null;
  var headline;
  if (sB) headline = student.name + " 수시 균형권: " + sB.univ + " " + sB.dept;
  else if (jB) headline = student.name + " 정시 균형권: " + jB.univ + " " + jB.dept;
  else headline = student.name + " — 균형권 미확보 (조건 완화 필요)";

  return {
    student_name: student.name,
    season_label: "2027학년도 수시 + 정시 (잠정)",
    headline: headline,
    susi_picks: susi_picks ? {
      safe: susi_picks.safe[0] ? { name: susi_picks.safe[0].univ + " " + susi_picks.safe[0].dept, type: susi_picks.safe[0]["전형분류"], prob: "약 80%" } : null,
      balanced: sB ? { name: sB.univ + " " + sB.dept, type: sB["전형분류"], prob: "약 50%" } : null,
      reach: susi_picks.reach[0] ? { name: susi_picks.reach[0].univ + " " + susi_picks.reach[0].dept, type: susi_picks.reach[0]["전형분류"], prob: "약 20%" } : null,
    } : null,
    jeongsi_picks: jeongsi_picks ? {
      safe: jeongsi_picks.safe[0] ? { name: jeongsi_picks.safe[0].univ + " " + jeongsi_picks.safe[0].dept, prob: "약 80%" } : null,
      balanced: jB ? { name: jB.univ + " " + jB.dept, prob: "약 50%" } : null,
      reach: jeongsi_picks.reach[0] ? { name: jeongsi_picks.reach[0].univ + " " + jeongsi_picks.reach[0].dept, prob: "약 20%" } : null,
    } : null,
    this_week_do: [
      "수시 6장 학과별 모집요강 출력 (수능최저·반영비율 재확인)",
      "9월 모의평가 응시 (수능최저 충족 여부 + 정시 백업안 백분위 확정)",
      "학교생활기록부 마감 (8월 31일) 전 누락 항목 보완",
    ],
    this_week_dont: [
      "수시 균형/도전권만 6장 — 안전권 최소 2장 확보",
      "타 학원/유튜브 정시 컨설팅 병행 — 혼선 유발",
    ],
    next_meeting: "9월 모평 직후 (예정)",
  };
}

// 원장 3문장 (수시 우선)
function generateCombinedDirectorScript(jeongsi_picks, susi_picks, student) {
  var sB = susi_picks ? susi_picks.balanced[0] : null;
  var sS = susi_picks ? susi_picks.safe[0] : null;
  var jB = jeongsi_picks ? jeongsi_picks.balanced[0] : null;

  if (sB) {
    var diff_str = sB.diff >= 0 ? "+" + sB.diff : String(sB.diff);
    return [
      student.name + " 학생, 수시 균형권은 " + sB.univ + " " + sB.dept + " (" + sB["전형분류"] + ")입니다. 작년 70cut 등급 " + sB.cut70_grade + ", 학생 내신 " + sB.student_grade + " (차이 " + diff_str + ").",
      sS ? "안전권은 " + sS.univ + " " + sS.dept + "을(를) 우선 검토합니다. 정시 백업은 " + (jB ? jB.univ + " " + jB.dept : "9월 모평 후 확정") + "입니다." : "안전권 확보가 부족해 1-2장 추가 발굴이 필요합니다.",
      "9월 모평 직후 수능최저 충족 가능성을 다시 확인하고, 수시 6장을 최종 확정합시다.",
    ];
  }
  return [
    student.name + " 학생, 현재 내신(" + student["내신"] + ")으로는 102개 수시 컷 데이터에서 균형권이 잡히지 않습니다.",
    "희망 학과/지역 조건을 완화하거나, 수시 종합전형(비교과 강점) 쪽으로 방향 전환을 검토합시다.",
    jB ? "정시 균형권은 " + jB.univ + " " + jB.dept + "이 잡혀 있어 정시 비중 강화 전략도 가능합니다." : "9월 모평 결과로 정시 백업안을 확정하겠습니다.",
  ];
}


var __api = {
  computeStudentScore: computeStudentScore,
  classify: classify,
  generateScenarios: generateScenarios,
  pickRecommendation: pickRecommendation,
  generateBalancedRationale: generateBalancedRationale,
  generateRisks: generateRisks,
  generateParentSummary: generateParentSummary,
  generateDirectorScript: generateDirectorScript,
  generateSusiScenarios: generateSusiScenarios,
  pickSusiRecommendation: pickSusiRecommendation,
  generateSusiRationale: generateSusiRationale,
  generateCombinedParentSummary: generateCombinedParentSummary,
  generateCombinedDirectorScript: generateCombinedDirectorScript,
  classifyTransType: classifyTransType,
  classifySusi: classifySusi,
  normalizeUniv: normalizeUniv,
  normalizeCampus: normalizeCampus,
  isValidDept: isValidDept,
};

if (typeof window !== "undefined") {
  window.ScenarioEngine = __api;
}
if (typeof module !== "undefined") {
  module.exports = __api;
}
