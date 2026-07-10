/**
 * 시나리오 엔진 v2 — 잠정 환산공식 제외 (정확도 우선)
 */

var THRESHOLDS = { safe_margin: 0.008, balanced_low: -0.005, reach_low: -0.02 };

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
  기계공학_엄격: ["기계"],
  기계공학: [
    "기계",
    "자동차",
    "로봇",
    "모빌리티",
    "메카트로닉스",
    "항공우주",
    "항공",
    "스마트팩토리",
  ],
  공학전체: [
    "공학",
    "기계",
    "자동차",
    "로봇",
    "모빌리티",
    "메카트로닉스",
    "항공",
    "전기",
    "전자",
    "토목",
    "건축",
    "화공",
    "신소재",
    "재료",
    "산업",
    "반도체",
    "정보통신",
  ],
};

var FIELD_SCOPE_MAP = {
  기계공학: { strict: "기계공학_엄격", related: "기계공학", broad: "공학전체" },
  컴퓨터공학: {
    strict: "컴퓨터공학_엄격",
    related: "컴퓨터공학",
    broad: "IT전체",
  },
  IT: { strict: "IT", related: "IT", broad: "IT전체" },
  공학: { strict: "공학", related: "공학", broad: "공학전체" },
  자연과학: { strict: "자연과학", related: "자연과학", broad: "자연공학전체" },
  경영: { strict: "경영_엄격", related: "경영", broad: "상경전체" },
  경제: { strict: "경제_엄격", related: "경제", broad: "상경전체" },
  사회: { strict: "사회", related: "사회", broad: "사회전체" },
  심리: { strict: "심리", related: "심리", broad: "사회전체" },
  어문: { strict: "어문", related: "어문", broad: "인문전체" },
  교육: { strict: "교육", related: "교육", broad: "교육전체" },
  의학: { strict: "의학", related: "의학", broad: "보건의료전체" },
  약학: { strict: "약학", related: "약학", broad: "보건의료전체" },
};

FIELD_KEYWORDS.컴퓨터공학_엄격 = ["컴퓨터"];
FIELD_KEYWORDS.경영_엄격 = ["경영"];
FIELD_KEYWORDS.경제_엄격 = ["경제"];
FIELD_KEYWORDS.IT전체 = [
  "컴퓨터",
  "소프트웨어",
  "정보",
  "데이터",
  "인공지능",
  "사이버",
  "AI",
  "보안",
  "게임",
  "미디어",
  "콘텐츠",
  "통계",
];
FIELD_KEYWORDS.자연공학전체 = FIELD_KEYWORDS.자연과학.concat(
  FIELD_KEYWORDS.공학전체,
);
FIELD_KEYWORDS.상경전체 = [
  "경영",
  "회계",
  "비즈니스",
  "경제",
  "금융",
  "재무",
  "무역",
  "통상",
  "세무",
  "관광",
];
FIELD_KEYWORDS.사회전체 = [
  "사회",
  "행정",
  "정치",
  "외교",
  "언론",
  "심리",
  "상담",
  "복지",
  "경찰",
  "법",
  "정책",
];
FIELD_KEYWORDS.인문전체 = [
  "국어",
  "영어",
  "중어",
  "일어",
  "독어",
  "불어",
  "문학",
  "언어",
  "사학",
  "철학",
  "문화",
];
FIELD_KEYWORDS.교육전체 = [
  "교육",
  "교직",
  "초등",
  "유아",
  "특수교육",
  "국어교육",
  "수학교육",
  "영어교육",
];
FIELD_KEYWORDS.보건의료전체 = [
  "의예",
  "의학",
  "한의",
  "치의",
  "수의",
  "약학",
  "간호",
  "물리치료",
  "작업치료",
  "임상병리",
  "방사선",
  "치위생",
  "보건",
];

var UNIV_ALIAS = {
  서울과기대학교: "서울과학기술대학교",
  부산외대학교: "부산외국어대학교",
  한국기술교대학교: "한국기술교육대학교",
  한국체대학교: "한국체육대학교",
  광주교대학교: "광주교육대학교",
  춘천교대학교: "춘천교육대학교",
  서울교대학교: "서울교육대학교",
  공주교대학교: "공주교육대학교",
  청주교대학교: "청주교육대학교",
  진주교대학교: "진주교육대학교",
  부산교대학교: "부산교육대학교",
  경인교대학교: "경인교육대학교",
  대구교대학교: "대구교육대학교",
  전주교대학교: "전주교육대학교",
  "한양대(ERICA)": "한양대학교(ERICA)",
  "동국대(WISE)": "동국대학교(WISE)",
  "건국대(글로컬)": "건국대학교(글로컬)",
  "연세대(미래)": "연세대학교(미래)",
  "고려대(세종)": "고려대학교(세종)",
};

function normalizeUniv(name) {
  if (!name) return name;
  if (UNIV_ALIAS[name]) name = UNIV_ALIAS[name];
  name = name.replace(/여자대학교$/, "여대");
  name = name.replace(/한국외국어대학교$/, "한국외대");
  name = name.replace(/대학교$/, "대");
  return name;
}

function isWomensUniv(univ) {
  if (!univ) return false;
  return /여자대학/.test(univ) || /여대$/.test(normalizeUniv(univ));
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

function matchesFormulaDept(formula, dept) {
  if (!formula) return true;
  var dept_name = dept && dept.dept ? String(dept.dept) : "";
  var include = Array.isArray(formula.dept_include) ? formula.dept_include : [];
  var exclude = Array.isArray(formula.dept_exclude) ? formula.dept_exclude : [];
  if (include.length > 0) {
    var matched = include.some(function (keyword) {
      return keyword && dept_name.indexOf(keyword) !== -1;
    });
    if (!matched) return false;
  }
  if (exclude.length > 0) {
    return !exclude.some(function (keyword) {
      return keyword && dept_name.indexOf(keyword) !== -1;
    });
  }
  return true;
}

function computeStudentScore(student, formula) {
  var w = formula.weights;
  var m = formula.metric;
  var sc = student.scores;
  if (!sc || !sc["국어"] || !sc["수학"] || !sc["탐구1"] || !sc["탐구2"])
    return null;
  var kor = m["국어"] === "백분위" ? sc["국어"].percentile : sc["국어"].std;
  var math = m["수학"] === "백분위" ? sc["수학"].percentile : sc["수학"].std;
  var t1 = m["탐구"] === "백분위" ? sc["탐구1"].percentile : sc["탐구1"].std;
  var t2 = m["탐구"] === "백분위" ? sc["탐구2"].percentile : sc["탐구2"].std;
  if (
    [kor, math, t1, t2].some(function (v) {
      return typeof v !== "number" || !isFinite(v);
    })
  )
    return null;
  var expl_avg = (t1 + t2) / 2;
  var max_score = formula.max_score || 1000;
  var returned_max_score = formula.total_max_score || max_score;
  function scaleUnit(subject) {
    return m[subject] === "백분위" ? 100 : 200;
  }
  function optionExploreValue() {
    if (formula.option_explore_method === "average") return expl_avg;
    if (formula.option_explore_method === "best_one") return Math.max(t1, t2);
    return t1 + t2;
  }
  if (formula.score_method === "best_of_weight_options") {
    var options = Array.isArray(formula.weight_options)
      ? formula.weight_options
      : [];
    if (options.length === 0) return null;
    var eng_add = 0;
    if (formula.english_grade_table && sc["영어"]) {
      eng_add = formula.english_grade_table[sc["영어"].grade - 1] || 0;
    }
    var hist_add = 0;
    if (formula.korean_history_grade_table && sc["한국사"]) {
      hist_add =
        formula.korean_history_grade_table[sc["한국사"].grade - 1] || 0;
    }
    var best = null;
    for (var oi = 0; oi < options.length; oi++) {
      var option = options[oi] || {};
      var optionTotal;
      var optionBreakdown;
      if (formula.option_score_method === "percent_scaled") {
        var optionKor =
          (kor / scaleUnit("국어")) * max_score * (option["국어"] || 0);
        var optionMath =
          (math / scaleUnit("수학")) * max_score * (option["수학"] || 0);
        var optionExplore =
          (expl_avg / scaleUnit("탐구")) * max_score * (option["탐구"] || 0);
        var optionEng = 0;
        var optionEngScale = formula.english_score_scale || 0;
        if (optionEngScale > 0) {
          optionEng =
            (eng_add / optionEngScale) * max_score * ((w["영어"] || 0) / 100);
        } else {
          optionEng = eng_add;
        }
        optionTotal =
          optionKor + optionMath + optionExplore + optionEng + hist_add;
        optionBreakdown = {
          국어: optionKor,
          수학: optionMath,
          탐구: optionExplore,
          영어: optionEng,
        };
      } else {
        var optionExploreRaw = optionExploreValue();
        optionTotal =
          kor * (option["국어"] || 0) +
          math * (option["수학"] || 0) +
          optionExploreRaw * (option["탐구"] || 0) +
          eng_add +
          hist_add;
        optionBreakdown = {
          국어: kor * (option["국어"] || 0),
          수학: math * (option["수학"] || 0),
          탐구: optionExploreRaw * (option["탐구"] || 0),
          영어: eng_add,
        };
      }
      if (!best || optionTotal > best.total) {
        best = {
          label: option.label || "",
          total: optionTotal,
          weights: option,
          breakdown: optionBreakdown,
        };
      }
    }
    return {
      total: Math.round(best.total * 100) / 100,
      breakdown: {
        국어: Math.round(best.breakdown.국어 * 10) / 10,
        수학: Math.round(best.breakdown.수학 * 10) / 10,
        탐구: Math.round(best.breakdown.탐구 * 10) / 10,
        영어: Math.round(best.breakdown.영어 * 10) / 10,
        한국사: hist_add,
        방식: best.label,
      },
      max_score: returned_max_score,
    };
  }
  var kor_scaled =
    (kor / scaleUnit("국어")) * max_score * ((w["국어"] || 0) / 100);
  var math_scaled =
    (math / scaleUnit("수학")) * max_score * ((w["수학"] || 0) / 100);
  var explore_scaled =
    (expl_avg / scaleUnit("탐구")) * max_score * ((w["탐구"] || 0) / 100);
  var scaled = kor_scaled + math_scaled + explore_scaled;
  var eng_raw = 0;
  if (formula.english_grade_table && sc["영어"]) {
    var eg = sc["영어"].grade;
    eng_raw = formula.english_grade_table[eg - 1] || 0;
  }
  var english_scale = formula.english_score_scale || 0;
  var eng_contrib =
    w["영어"] > 0 && english_scale > 0
      ? (eng_raw / english_scale) * max_score * (w["영어"] / 100)
      : w["영어"] > 0 && eng_raw >= 10
        ? eng_raw * (w["영어"] / 100) * (max_score / 100)
        : eng_raw;
  var hist_contrib = 0;
  if (formula.korean_history_grade_table && sc["한국사"]) {
    hist_contrib =
      formula.korean_history_grade_table[sc["한국사"].grade - 1] || 0;
  }
  return {
    total: Math.round((scaled + eng_contrib + hist_contrib) * 10) / 10,
    breakdown: {
      국어: Math.round(((kor * w["국어"]) / 100) * 10) / 10,
      수학: Math.round(((math * w["수학"]) / 100) * 10) / 10,
      탐구: Math.round(((expl_avg * w["탐구"]) / 100) * 10) / 10,
      영어: Math.round(eng_contrib * 10) / 10,
      한국사: hist_contrib,
    },
    max_score: returned_max_score,
  };
}

function classify(student_score, cut70, max_score) {
  var ratio = (student_score - cut70) / max_score;
  if (ratio >= THRESHOLDS.safe_margin) return "safe";
  if (ratio >= THRESHOLDS.balanced_low) return "balanced";
  if (ratio >= THRESHOLDS.reach_low) return "reach";
  return "fail";
}

function matchesWish(dept_name, wish_fields) {
  if (!wish_fields || wish_fields.length === 0) return true;
  for (var i = 0; i < wish_fields.length; i++) {
    var kws = FIELD_KEYWORDS[wish_fields[i]] || [wish_fields[i]];
    for (var j = 0; j < kws.length; j++) {
      if (dept_name && dept_name.indexOf(kws[j]) !== -1) return true;
    }
  }
  return false;
}

function excludeTerms(student) {
  var raw = student && student["제외_학과키워드"];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw)
    .split(/[,\s·/]+/)
    .map(function (x) {
      return x.trim();
    })
    .filter(Boolean);
}

function isExcludedDept(dept_name, student) {
  var terms = excludeTerms(student);
  for (var i = 0; i < terms.length; i++) {
    if (dept_name && dept_name.indexOf(terms[i]) !== -1) return true;
  }
  return false;
}

var NATURAL_DEPT_FALSE_POSITIVE = [
  "스포츠",
  "체육",
  "예술",
  "음악",
  "미술",
  "디자인",
  "무용",
];

function isNaturalDeptFalsePositive(dept_name, student) {
  if (!dept_name || !student || student.track !== "자연") return false;
  var wishes = student["희망_계열"] || [];
  var explicitArtsWish = [
    "스포츠",
    "체육",
    "예술",
    "음악",
    "미술",
    "디자인",
  ].some(function (term) {
    return wishes.indexOf(term) !== -1;
  });
  if (explicitArtsWish) return false;
  return NATURAL_DEPT_FALSE_POSITIVE.some(function (term) {
    return dept_name.indexOf(term) !== -1;
  });
}

function normalizeFieldScope(scope) {
  if (scope === "strict") return "strict";
  if (scope === "engineering" || scope === "broad") return "broad";
  return "related";
}

function scopedWishFields(wish_fields, scope) {
  var level = normalizeFieldScope(scope);
  return (wish_fields || []).map(function (field) {
    var rule = FIELD_SCOPE_MAP[field];
    if (!rule) return field;
    return rule[level] || rule.related || field;
  });
}

function classifyDeptScope(dept_name, wish_fields) {
  var fields = wish_fields || [];
  for (var i = 0; i < fields.length; i++) {
    var rule = FIELD_SCOPE_MAP[fields[i]];
    if (!rule) continue;
    if (matchesWish(dept_name, [rule.strict])) return "direct";
    if (matchesWish(dept_name, [rule.related])) return "related";
    if (matchesWish(dept_name, [rule.broad])) return "expanded";
  }
  return "related";
}

var REGION_MAP = { 서울: ["서울"], 수도권: ["서울", "경기", "인천"] };

function matchesRegion(univ_region, wish_regions) {
  if (!wish_regions || wish_regions.length === 0) return true;
  var allowed = {};
  for (var i = 0; i < wish_regions.length; i++) {
    var rs = REGION_MAP[wish_regions[i]] || [wish_regions[i]];
    for (var j = 0; j < rs.length; j++) allowed[rs[j]] = true;
  }
  return !!allowed[univ_region];
}

function isFormulaReviewPending(formula) {
  if (!formula || !formula.source) return true;
  var src = String(formula.source);
  return src.indexOf("잠정") !== -1 || src.indexOf("검증필요") !== -1;
}

function summarizeFormulaVerification(formulas) {
  var summary = {
    verified_rows: 0,
    pending_rows: 0,
    verified_univs: {},
    pending_univs: {},
  };
  (formulas || []).forEach(function (f) {
    var univ = normalizeUniv(f.univ || "");
    if (isFormulaReviewPending(f)) {
      summary.pending_rows += 1;
      if (univ) summary.pending_univs[univ] = true;
    } else {
      summary.verified_rows += 1;
      if (univ) summary.verified_univs[univ] = true;
    }
  });
  summary.verified_univ_count = Object.keys(summary.verified_univs).length;
  summary.pending_univ_count = Object.keys(summary.pending_univs).length;
  return summary;
}

function generateScenarios(student, data) {
  var universities = data.universities;
  var formulas = data.formulas;
  var jeongsi_cuts = data.jeongsi_cuts;
  var formula_review = summarizeFormulaVerification(formulas);

  var valid_formulas = formulas.filter(function (f) {
    if (!f.track) return true;
    if (student.track === "자연" && f.track.indexOf("인문") !== -1)
      return false;
    if (
      student.track === "인문" &&
      (f.track.indexOf("자연") !== -1 || f.track.indexOf("이공") !== -1)
    )
      return false;
    if (isFormulaReviewPending(f)) return false;
    return true;
  });

  var univ_index = {};
  var region_index = {};
  universities.forEach(function (u) {
    univ_index[normalizeUniv(u.name) + "|" + normalizeCampus(u.campus)] = u;
    if (u.region) region_index[normalizeUniv(u.name)] = u.region;
  });

  var cuts_by_univ = {};
  jeongsi_cuts.forEach(function (c) {
    if (!isValidDept(c.dept)) return;
    var k = normalizeUniv(c.univ);
    if (!cuts_by_univ[k]) cuts_by_univ[k] = [];
    cuts_by_univ[k].push(c);
  });

  var results = {
    safe: [],
    balanced: [],
    reach: [],
    fail: [],
    formula_review: formula_review,
  };

  for (var fi = 0; fi < valid_formulas.length; fi++) {
    var formula = valid_formulas[fi];
    var sc = computeStudentScore(student, formula);
    if (!sc) continue;
    var norm_univ = normalizeUniv(formula.univ);
    var f_campus = normalizeCampus(formula.campus);
    var dept_cuts_all = (cuts_by_univ[norm_univ] || []).filter(function (c) {
      return normalizeCampus(c.campus) === f_campus;
    });
    if (dept_cuts_all.length === 0) continue;

    var cut_values = dept_cuts_all
      .map(function (c) {
        return c.cut70;
      })
      .filter(function (v) {
        return typeof v === "number" && v > 50;
      });
    if (cut_values.length === 0) continue;
    var cut_sorted = cut_values.slice().sort(function (a, b) {
      return a - b;
    });
    var cut_max = cut_sorted[cut_sorted.length - 1];
    var student_scaled =
      Math.round((((sc.total / sc.max_score) * cut_max) / 0.95) * 10) / 10;

    for (var di = 0; di < dept_cuts_all.length; di++) {
      var dept = dept_cuts_all[di];
      if (!isValidDept(dept.dept)) continue;
      // 이상 데이터 제외
      if (
        dept.dept === "모집단위" ||
        dept.dept === "모집인원" ||
        dept.dept.indexOf("모집단위") === 0 ||
        dept.dept.indexOf("모집인원") === 0
      )
        continue;
      if (!dept.capacity || dept.capacity === 0) continue;
      if (typeof dept.cut70 !== "number" || dept.cut70 < 50) continue;
      if (!matchesFormulaDept(formula, dept)) continue;
      if (dept.cut70 < cut_max * 0.5) continue;
      if (isNaturalDeptFalsePositive(dept.dept, student)) continue;
      if (!matchesWish(dept.dept, student["희망_계열"])) continue;
      var reg = region_index[norm_univ];
      if (reg && !matchesRegion(reg, student["희망_지역"])) continue;
      if (student["성별"] === "남" && isWomensUniv(formula.univ)) continue;
      var diff = Math.round((student_scaled - dept.cut70) * 10) / 10;
      var ratio = (student_scaled - dept.cut70) / cut_max;
      var bucket =
        ratio >= 0.015
          ? "safe"
          : ratio >= -0.01
            ? "balanced"
            : ratio >= -0.03
              ? "reach"
              : "fail";
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
        breakdown: sc.breakdown,
        formula_source: formula.source,
        region: reg || null,
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

function pickRecommendation(s) {
  return {
    safe: s.safe.slice(0, 5),
    balanced: s.balanced.slice(0, 5),
    reach: s.reach.slice(0, 5),
    formula_review: s.formula_review || null,
  };
}

function generateBalancedRationale(p) {
  if (!p) return "추천 학과 없음 (희망 계열/지역 조건 완화 권장)";
  var cr = ((p.student_score / p.max_score) * 100).toFixed(1);
  var m = p.diff >= 0 ? "+" + p.diff : String(p.diff);
  return (
    p.univ +
    " " +
    p.dept +
    " (" +
    (p.group || "정시") +
    "): 작년 70cut " +
    p.cut70 +
    " vs 학생 환산 " +
    p.student_score +
    " (" +
    m +
    "). 만점 대비 " +
    cr +
    "%. 모집 " +
    p.capacity +
    "명, 작년 경쟁률 " +
    p.competition +
    "배."
  );
}

function generateRisks(scenarios, student) {
  var risks = [];
  if (scenarios.balanced.length === 0) risks.push("균형권 학과 없음");
  if (scenarios.safe.length < 2)
    risks.push("안전권 부족 — 추가 안전권 확보 필요");
  if (scenarios.reach.length === 0 && scenarios.balanced.length > 0)
    risks.push("도전권 없음 — 보수적 포트폴리오");
  if (student.scores["영어"] && student.scores["영어"].grade >= 4)
    risks.push(
      "영어 " + student.scores["영어"].grade + "등급 — 감점 큰 대학 불리",
    );
  if (student.scores["한국사"] && student.scores["한국사"].grade >= 5)
    risks.push(
      "한국사 " + student.scores["한국사"].grade + "등급 — 일부 대학 감점",
    );
  var formulaReview = scenarios.formula_review || {
    verified_rows: 4,
    pending_rows: 28,
    verified_univ_count: 2,
    pending_univ_count: 20,
  };
  risks.push(
    "INFO: 정시 환산공식 " +
      formulaReview.verified_rows +
      "개 검증 (" +
      formulaReview.verified_univ_count +
      "개 대학). 잠정 " +
      formulaReview.pending_rows +
      "개 제외 중 (" +
      formulaReview.pending_univ_count +
      "개 대학 검수 대기).",
  );
  return risks;
}

function generateParentSummary(picks, student) {
  var b = picks.balanced[0],
    s = picks.safe[0],
    r = picks.reach[0];
  var formulaReview = picks.formula_review || {
    verified_univ_count: 2,
    verified_rows: 4,
  };
  return {
    student_name: student.name,
    season_label:
      "2027학년도 정시 (검증 " +
      formulaReview.verified_univ_count +
      "개 대학 · " +
      formulaReview.verified_rows +
      "행)",
    headline: b
      ? student.name + " 학생, 정시 균형권: " + b.univ + " " + b.dept
      : student.name + " 학생 — 정시 균형권 미확보",
    three_options: {
      safe: s ? { name: s.univ + " " + s.dept, prob: "안전 후보" } : null,
      balanced: b ? { name: b.univ + " " + b.dept, prob: "균형 후보" } : null,
      reach: r ? { name: r.univ + " " + r.dept, prob: "도전 후보" } : null,
    },
    this_week_do: [
      "6월 모의고사 응시 (백분위 확정)",
      "균형권 학과 모집요강 출력",
      "원서접수 일정 캘린더 등록",
    ],
    this_week_dont: [
      "타 학원/유튜브 정시 컨설팅 병행 — 혼선",
      "지금 환산점수만으로 지원 확정",
    ],
    next_meeting: "6월 모평 직후 (예정)",
  };
}

function generateDirectorScript(picks, student) {
  var b = picks.balanced[0];
  if (!b)
    return [
      student.name + " 학생, 정시 균형권 확보가 어렵습니다.",
      "6월 모평 결과로 백분위 확정 후 재산정 권장.",
      "그 사이 학생부 정량 점검 + 비교과 활동 정리 권장.",
    ];
  var d = b.diff >= 0 ? "+" + b.diff : String(b.diff);
  return [
    student.name +
      " 학생, " +
      b.univ +
      " " +
      b.dept +
      " 작년 70cut " +
      b.cut70 +
      ", 학생 환산 " +
      b.student_score +
      " (차이 " +
      d +
      ").",
    "작년 경쟁률 " +
      b.competition +
      "배, 모집 " +
      b.capacity +
      "명. 본인 검수 + 학부모 확인 후 확정 후보.",
    "6월 모평 후 백분위 확정 시 환산점수 재산정 + 안전 1 도전 1 함께 확정.",
  ];
}

function classifyTransType(name) {
  if (!name) return "기타";
  if (name.indexOf("논술") !== -1) return "논술";
  if (name.indexOf("실기") !== -1 || name.indexOf("특기") !== -1) return "실기";
  if (name.indexOf("교과") !== -1) return "학생부교과";
  if (
    name.indexOf("종합") !== -1 ||
    name.indexOf("우수자") !== -1 ||
    name.indexOf("인재") !== -1 ||
    name.indexOf("잠재") !== -1
  )
    return "학생부종합";
  if (name.indexOf("지역균형") !== -1 || name.indexOf("지역인재") !== -1)
    return "지역균형";
  if (name.indexOf("일반") !== -1) return "일반전형";
  return "기타";
}

function susiCutKey(c) {
  return [
    normalizeUniv(c && c.univ),
    normalizeCampus(c && c.campus),
    (c && c.dept) || "",
    (c && c["전형"]) || "",
    (c && c["전형유형"]) || "",
  ].join("|");
}

function normalizeSusiCutsForRecommendation(susiCuts) {
  var grouped = {};
  (susiCuts || []).forEach(function (c) {
    var key = susiCutKey(c);
    if (!key) return;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });
  var out = [];
  Object.keys(grouped).forEach(function (key) {
    var list = grouped[key];
    if (list.length === 1) {
      out.push(list[0]);
      return;
    }
    var best = list.slice().sort(function (a, b) {
      var ag = typeof a.cut70_grade === "number" ? a.cut70_grade : 99;
      var bg = typeof b.cut70_grade === "number" ? b.cut70_grade : 99;
      return ag - bg;
    })[0];
    var copy = Object.assign({}, best);
    copy.__duplicateCut = true;
    copy.__duplicateCutCount = list.length;
    copy.__duplicateCutValues = list
      .map(function (x) {
        return x.cut70_grade;
      })
      .filter(function (x) {
        return typeof x === "number";
      });
    out.push(copy);
  });
  return out;
}

function classifySusi(student_grade, cut70_grade) {
  var diff = cut70_grade - student_grade;
  if (diff >= 1.0) return "safe";
  if (diff >= 0.3) return "balanced";
  if (diff >= -0.3) return "reach";
  return "fail";
}

function susiSafeRankScore(item) {
  var diff = typeof item.diff === "number" ? item.diff : 99;
  var capacity = typeof item.capacity === "number" ? item.capacity : 0;
  var competition =
    typeof item.competition === "number" && item.competition > 0
      ? item.competition
      : 8;
  var idealSafeGap = 1.05;
  var score = 100 - Math.abs(diff - idealSafeGap) * 24;
  if (diff > 1.8) score -= (diff - 1.8) * 35;
  score += Math.min(8, Math.log(capacity + 1) * 2);
  score += Math.max(-7, Math.min(4, (8 - competition) * 0.5));
  return score;
}

function susiCutBasis(row) {
  return row && row.cut_basis ? row.cut_basis : "70%컷";
}

function susiCutLabel(row) {
  return "작년 " + susiCutBasis(row);
}

function generateSusiScenarios(student, data) {
  var universities = data.universities,
    susi_cuts = normalizeSusiCutsForRecommendation(data.susi_cutoffs);
  var student_grade = student["내신"];
  if (typeof student_grade !== "number")
    return { safe: [], balanced: [], reach: [], fail: [] };

  var univ_index = {};
  universities.forEach(function (u) {
    univ_index[normalizeUniv(u.name) + "|" + normalizeCampus(u.campus)] = u;
  });

  var region_index = {};
  universities.forEach(function (u) {
    if (u.region) region_index[normalizeUniv(u.name)] = u.region;
  });

  var results = { safe: [], balanced: [], reach: [], fail: [] };
  var SPECIAL = [
    "취업자",
    "장애인",
    "교육기회배려자",
    "기회균형",
    "고른기회",
    "농어촌",
    "사회기여",
    "사회배려",
    "사회통합",
    "국가보훈",
    "기초생활",
    "수급",
    "차상위",
    "한부모",
    "서해5도",
    "특수교육",
    "특성화",
    "특성화고",
    "재외국민",
    "북한",
    "탈북",
    "다문화",
  ];

  for (var i = 0; i < susi_cuts.length; i++) {
    var c = susi_cuts[i];
    if (!isValidDept(c.dept)) continue;
    // 이상 데이터 제외
    if (
      c.dept === "모집단위" ||
      c.dept === "모집인원" ||
      c.dept.indexOf("모집단위") === 0 ||
      c.dept.indexOf("모집인원") === 0
    )
      continue;
    if (
      c["전형"] === "모집단위" ||
      c["전형"] === "모집인원" ||
      (c["전형"] &&
        (c["전형"].indexOf("모집단위") === 0 ||
          c["전형"].indexOf("모집인원") === 0))
    )
      continue;
    if (typeof c.cut70_grade !== "number") continue;
    if (c.cut70_grade < 1 || c.cut70_grade > 9) continue;
    if (c.cut70_grade >= 8.5) continue;
    if (!c.capacity || c.capacity === 0) continue;
    if (c.dept.indexOf("(야)") !== -1 || c.dept.indexOf("야간") !== -1)
      continue;
    var tname = c["전형"] || "";
    var skip = false;
    for (var sk = 0; sk < SPECIAL.length; sk++) {
      if (tname.indexOf(SPECIAL[sk]) !== -1) {
        skip = true;
        break;
      }
    }
    if (skip) continue;
    if (isExcludedDept(c.dept, student)) continue;
    if (isNaturalDeptFalsePositive(c.dept, student)) continue;
    if (!matchesWish(c.dept, student["희망_계열"])) continue;
    var reg = region_index[normalizeUniv(c.univ)];
    if (
      !student["지역조건완화"] &&
      reg &&
      !matchesRegion(reg, student["희망_지역"])
    )
      continue;
    if (student["성별"] === "남" && isWomensUniv(c.univ)) continue;
    var bucket = classifySusi(student_grade, c.cut70_grade);
    var diff = Math.round((c.cut70_grade - student_grade) * 100) / 100;
    var trans_type = c["전형유형"] || classifyTransType(tname);
    results[bucket].push({
      univ: c.univ,
      univ_short: normalizeUniv(c.univ),
      campus: c.campus,
      dept: c.dept,
      전형: tname,
      전형분류: trans_type,
      capacity: c.capacity,
      competition: c.competition,
      cut70_grade: c.cut70_grade,
      cut_basis: susiCutBasis(c),
      duplicateCut: !!c.__duplicateCut,
      duplicateCutCount: c.__duplicateCutCount || 0,
      student_grade: student_grade,
      diff: diff,
      region: reg || null,
      source: c.source,
    });
  }
  results.safe.sort(function (a, b) {
    return susiSafeRankScore(b) - susiSafeRankScore(a);
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

function pickSusiRecommendation(s) {
  return {
    safe: s.safe.slice(0, 5),
    balanced: s.balanced.slice(0, 5),
    reach: s.reach.slice(0, 5),
  };
}

function generateSusiRationale(p) {
  if (!p) return "수시 균형권 없음";
  var m = p.diff >= 0 ? "+" + p.diff : String(p.diff);
  return (
    p.univ +
    " " +
    p.dept +
    " (" +
    (p["전형분류"] || "수시") +
    " - " +
    (p["전형"] || "") +
    "): " +
    susiCutLabel(p) +
    " " +
    p.cut70_grade +
    " vs 학생 내신 " +
    p.student_grade +
    " (차이 " +
    m +
    "). 모집 " +
    p.capacity +
    "명, 경쟁률 " +
    p.competition +
    "배."
  );
}

function generateCombinedParentSummary(jp, sp, student) {
  var jB = jp ? jp.balanced[0] : null,
    sB = sp ? sp.balanced[0] : null;
  var headline = sB
    ? student.name + " 수시 균형: " + sB.univ + " " + sB.dept
    : jB
      ? student.name + " 정시 균형: " + jB.univ + " " + jB.dept
      : student.name + " — 균형권 미확보";
  return {
    student_name: student.name,
    season_label: "2027학년도 수시 원서 상담 초안",
    headline: headline,
    susi_picks: sp
      ? {
          safe: sp.safe[0]
            ? {
                name: sp.safe[0].univ + " " + sp.safe[0].dept,
                type: sp.safe[0]["전형분류"],
                prob: "안전 후보",
              }
            : null,
          balanced: sB
            ? {
                name: sB.univ + " " + sB.dept,
                type: sB["전형분류"],
                prob: "균형 후보",
              }
            : null,
          reach: sp.reach[0]
            ? {
                name: sp.reach[0].univ + " " + sp.reach[0].dept,
                type: sp.reach[0]["전형분류"],
                prob: "도전 후보",
              }
            : null,
        }
      : null,
    jeongsi_picks: jp
      ? {
          safe: jp.safe[0]
            ? {
                name: jp.safe[0].univ + " " + jp.safe[0].dept,
                prob: "안전 후보",
              }
            : null,
          balanced: jB
            ? { name: jB.univ + " " + jB.dept, prob: "균형 후보" }
            : null,
          reach: jp.reach[0]
            ? {
                name: jp.reach[0].univ + " " + jp.reach[0].dept,
                prob: "도전 후보",
              }
            : null,
        }
      : null,
    this_week_do: [
      "수시 6장 모집요강 출력",
      "9월 모평 응시",
      "학생부 마감 (8월 31일) 전 보완",
    ],
    this_week_dont: ["수시 균형/도전권만 6장", "타 학원 정시 병행"],
    next_meeting: "9월 모평 직후",
  };
}

function generateCombinedDirectorScript(jp, sp, student) {
  var sB = sp ? sp.balanced[0] : null,
    sS = sp ? sp.safe[0] : null,
    jB = jp ? jp.balanced[0] : null;
  if (sB) {
    var d = sB.diff >= 0 ? "+" + sB.diff : String(sB.diff);
    return [
      student.name +
        " 학생 수시 균형: " +
        sB.univ +
        " " +
        sB.dept +
        " (" +
        sB["전형분류"] +
        "). " +
        susiCutLabel(sB) +
        " " +
        sB.cut70_grade +
        ", 학생 " +
        sB.student_grade +
        " (차이 " +
        d +
        ").",
      sS
        ? "안전권은 " +
          sS.univ +
          " " +
          sS.dept +
          " 우선 검토. 정시 백업은 " +
          (jB ? jB.univ + " " + jB.dept : "9월 모평 후 확정") +
          "."
        : "안전권 1-2장 추가 발굴 필요.",
      "9월 모평 직후 수능최저 충족 가능성 재확인 + 수시 6장 최종 확정.",
    ];
  }
  return [
    student.name +
      " 학생, 현재 내신(" +
      student["내신"] +
      ")로 수시 균형권 어려움.",
    "희망 학과/지역 완화 또는 종합전형 (비교과 강점) 전환 검토.",
    jB
      ? "정시 균형 " + jB.univ + " " + jB.dept + " 잡힘 — 정시 비중 강화 가능."
      : "9월 모평 결과로 정시 백업 확정.",
  ];
}

function studentPercentileAvg(student) {
  var sc = student.scores;
  if (!sc) return null;
  var k = sc["국어"] && sc["국어"].percentile;
  var m = sc["수학"] && sc["수학"].percentile;
  var t1 = sc["탐구1"] && sc["탐구1"].percentile;
  var t2 = sc["탐구2"] && sc["탐구2"].percentile;
  if (
    typeof k !== "number" ||
    typeof m !== "number" ||
    typeof t1 !== "number" ||
    typeof t2 !== "number"
  )
    return null;
  return Math.round(((k + m + (t1 + t2) / 2) / 3) * 10) / 10;
}

function generateJeongsiReference(student, trendData) {
  var avg = studentPercentileAvg(student);
  if (avg === null) return { avg: null, safe: [], balanced: [], reach: [] };
  var wish = student["희망_계열"];
  var results = { avg: avg, safe: [], balanced: [], reach: [] };
  var keys = Object.keys(trendData || {});
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key.indexOf("|정시") === -1) continue;
    var arr = trendData[key];
    if (!arr || !arr.length) continue;
    var nums = arr.filter(function (x) {
      return typeof x.cut70 === "number" && x.cut70 <= 100;
    });
    if (nums.length < 2) continue;
    var parts = key.split("|");
    var dept = parts[1];
    if (!matchesWish(dept, wish)) continue;
    var last3 = nums.slice(-3);
    var sum = 0;
    for (var j = 0; j < last3.length; j++) sum += last3[j].cut70;
    var avgcut = Math.round((sum / last3.length) * 100) / 100;
    var diff = Math.round((avg - avgcut) * 10) / 10;
    var bucket =
      diff >= 2
        ? "safe"
        : diff >= -1.5
          ? "balanced"
          : diff >= -4
            ? "reach"
            : null;
    if (!bucket) continue;
    results[bucket].push({
      univ: parts[0],
      dept: dept,
      avgcut: avgcut,
      latest: nums[nums.length - 1].cut70,
      yfrom: nums[0].year,
      yto: nums[nums.length - 1].year,
      yrs: nums.length,
      diff: diff,
    });
  }
  results.safe.sort(function (a, b) {
    return Math.abs(a.diff) - Math.abs(b.diff);
  });
  results.balanced.sort(function (a, b) {
    return Math.abs(a.diff) - Math.abs(b.diff);
  });
  results.reach.sort(function (a, b) {
    return Math.abs(a.diff) - Math.abs(b.diff);
  });
  return results;
}

function computeSusiGyogwa(student, banyeong) {
  var SUBMAP = { 국: "국어", 수: "수학", 영: "영어", 사: "사회", 과: "과학" };
  var subjStr =
    student.track === "자연"
      ? banyeong["반영교과_자연"]
      : banyeong["반영교과_인문"];
  subjStr =
    subjStr || banyeong["반영교과_인문"] || banyeong["반영교과_자연"] || "";
  var g = student["교과등급"] || {};
  var keys;
  if (String(subjStr).indexOf("전과목") !== -1) {
    keys = ["국어", "수학", "영어", "사회", "과학"];
  } else {
    keys = String(subjStr)
      .split(/[·,\s]+/)
      .filter(Boolean)
      .map(function (s) {
        return SUBMAP[s.charAt(0)] || s;
      });
  }
  var vals = keys
    .map(function (k) {
      return g[k];
    })
    .filter(function (v) {
      return typeof v === "number" && v >= 1 && v <= 9;
    });
  if (!vals.length) return null;
  var ilban =
    vals.reduce(function (a, b) {
      return a + b;
    }, 0) / vals.length;
  var jinroPct = (banyeong["진로선택_반영비율"] || 0) / 100;
  var ilbanPct =
    (banyeong["일반선택_반영비율"] != null
      ? banyeong["일반선택_반영비율"]
      : 100) / 100;
  var jinro =
    typeof student["진로선택등급"] === "number"
      ? student["진로선택등급"]
      : ilban;
  var avg =
    jinroPct + ilbanPct === 0 ? ilban : ilban * ilbanPct + jinro * jinroPct;
  return {
    avg: Math.round(avg * 100) / 100,
    ilban: Math.round(ilban * 100) / 100,
    jinro: Math.round(jinro * 100) / 100,
    subjects: keys,
  };
}

function aggregateGyogwaByYear(yearGrades) {
  var out = {};
  Object.keys(yearGrades || {}).forEach(function (k) {
    var arr = (yearGrades[k] || []).filter(function (v) {
      return typeof v === "number" && v >= 1 && v <= 9;
    });
    if (arr.length)
      out[k] =
        Math.round(
          (arr.reduce(function (a, b) {
            return a + b;
          }, 0) /
            arr.length) *
            100,
        ) / 100;
  });
  return out;
}

function recommendSusiByGyogwa(student, banyeongList, susiCuts) {
  var results = { safe: [], balanced: [], reach: [], pending: [], fail: [] };
  var normalizedSusiCuts = normalizeSusiCutsForRecommendation(susiCuts || []);
  var region_index = {};
  if (typeof window !== "undefined" && window.DEMO_DATA) {
    (window.DEMO_DATA.universities || []).forEach(function (u) {
      if (u.region) region_index[normalizeUniv(u.name)] = u.region;
    });
  }
  (banyeongList || []).forEach(function (b) {
    var res = computeSusiGyogwa(student, b);
    if (!res) return;
    var matched = false;
    normalizedSusiCuts.forEach(function (c) {
      if (typeof c.cut70_grade !== "number") return;
      if (normalizeUniv(c.univ) !== normalizeUniv(b["대학명"])) return;
      var cCode = String(c.univCode || c["대학코드"] || "");
      var bCode = String(b["대학코드"] || "");
      if (cCode && bCode && cCode !== bCode) return;
      var jt = String(c["전형"] || "").replace(/\s+/g, "");
      var bt = String(b["전형명"] || "").replace(/\s+/g, "");
      while (/(전형|선발)$/.test(jt)) jt = jt.replace(/(전형|선발)$/, "");
      while (/(전형|선발)$/.test(bt)) bt = bt.replace(/(전형|선발)$/, "");
      if (!bt || (jt.indexOf(bt) === -1 && bt.indexOf(jt) === -1)) return;
      if (!isValidDept(c.dept)) return;
      if (isExcludedDept(c.dept, student)) return;
      if (isNaturalDeptFalsePositive(c.dept, student)) return;
      if (!matchesWish(c.dept, student["희망_계열"])) return;
      if (student["성별"] === "남" && isWomensUniv(c.univ)) return;
      var reg =
        region_index[normalizeUniv(c.univ)] ||
        region_index[normalizeUniv(b["대학명"])];
      if (
        !student["지역조건완화"] &&
        reg &&
        !matchesRegion(reg, student["희망_지역"])
      )
        return;
      matched = true;
      var bucket = classifySusi(res.avg, c.cut70_grade);
      results[bucket].push({
        univ: b["대학명"],
        campus: b["캠퍼스"] || "",
        dept: c.dept,
        전형: b["전형명"],
        minreq: b["수능최저"] || "",
        환산등급: res.avg,
        cut70_grade: c.cut70_grade,
        cut_basis: susiCutBasis(c),
        duplicateCut: !!c.__duplicateCut,
        duplicateCutCount: c.__duplicateCutCount || 0,
        diff: Math.round((c.cut70_grade - res.avg) * 100) / 100,
        capacity: c.capacity,
        competition: c.competition,
        region: reg || null,
        source: c.source,
        source_url: c.source_url || c.sourceUrl || "",
        source_file_url: c.source_file_url || c.sourceFileUrl || "",
        source_note: c.source_note || c.sourceNote || "",
        label_source: c.label_source || c.labelSource || "",
        label_source_url: c.label_source_url || c.labelSourceUrl || "",
        univCode: b["대학코드"] || c.unvCd || c.univCode || "",
        대학코드: b["대학코드"] || c["대학코드"] || "",
      });
    });
    if (!matched) {
      var pendingReg = region_index[normalizeUniv(b["대학명"])] || null;
      if (student["성별"] === "남" && isWomensUniv(b["대학명"])) return;
      if (
        !student["지역조건완화"] &&
        pendingReg &&
        !matchesRegion(pendingReg, student["희망_지역"])
      )
        return;
      results.pending.push({
        univ: b["대학명"],
        campus: b["캠퍼스"] || "",
        univCode: b["대학코드"] || "",
        대학코드: b["대학코드"] || "",
        dept: "학과별 입결 미연결",
        전형: b["전형명"],
        minreq: b["수능최저"] || "",
        환산등급: res.avg,
        cut70_grade: null,
        diff: null,
        capacity: null,
        competition: null,
        region: pendingReg,
        source: b["출처URL"] || "교과반영방법_수시",
        preparing: true,
      });
    }
  });
  ["safe", "balanced", "reach", "fail"].forEach(function (k) {
    results[k].sort(function (a, b) {
      return b.diff - a.diff;
    });
  });
  results.pending.sort(function (a, b) {
    return a.환산등급 - b.환산등급;
  });
  return results;
}

var __api = {
  computeStudentScore: computeStudentScore,
  computeSusiGyogwa: computeSusiGyogwa,
  aggregateGyogwaByYear: aggregateGyogwaByYear,
  recommendSusiByGyogwa: recommendSusiByGyogwa,
  classify: classify,
  generateScenarios: generateScenarios,
  pickRecommendation: pickRecommendation,
  generateBalancedRationale: generateBalancedRationale,
  generateRisks: generateRisks,
  generateParentSummary: generateParentSummary,
  generateDirectorScript: generateDirectorScript,
  generateSusiScenarios: generateSusiScenarios,
  pickSusiRecommendation: pickSusiRecommendation,
  generateJeongsiReference: generateJeongsiReference,
  studentPercentileAvg: studentPercentileAvg,
  generateSusiRationale: generateSusiRationale,
  generateCombinedParentSummary: generateCombinedParentSummary,
  generateCombinedDirectorScript: generateCombinedDirectorScript,
  classifyTransType: classifyTransType,
  classifySusi: classifySusi,
  normalizeUniv: normalizeUniv,
  normalizeCampus: normalizeCampus,
  scopedWishFields: scopedWishFields,
  classifyDeptScope: classifyDeptScope,
  isValidDept: isValidDept,
};

if (typeof window !== "undefined") {
  window.ScenarioEngine = __api;
}
if (typeof module !== "undefined") {
  module.exports = __api;
}

// INTEGRITY_MARKER_END_OF_FILE
