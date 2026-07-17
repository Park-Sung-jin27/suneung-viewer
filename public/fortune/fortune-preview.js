/* ============================================================
   지피사주 · 무료 미리보기 위젯
   - 양력/음력 생년월일 + 생시 입력 → 일주/시주 계산 → 3개 무료 질문 미리보기
   - 어디에도 저장·전송되지 않고 브라우저 안에서만 계산
   ============================================================ */
(function () {
  "use strict";

  const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const STEMS_KO = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
  const BRANCHES = [
    "子",
    "丑",
    "寅",
    "卯",
    "辰",
    "巳",
    "午",
    "未",
    "申",
    "酉",
    "戌",
    "亥",
  ];
  const BRANCHES_KO = [
    "자",
    "축",
    "인",
    "묘",
    "진",
    "사",
    "오",
    "미",
    "신",
    "유",
    "술",
    "해",
  ];
  const ZODIAC = [
    "쥐",
    "소",
    "호랑이",
    "토끼",
    "용",
    "뱀",
    "말",
    "양",
    "원숭이",
    "닭",
    "개",
    "돼지",
  ];
  const ELEM_BY_STEM = [
    "목",
    "목",
    "화",
    "화",
    "토",
    "토",
    "금",
    "금",
    "수",
    "수",
  ];

  // 1900~2100 음력 변환표 (builder.html과 동일 출처)
  const LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0,
    0x09ad0, 0x055d2, 0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540,
    0x0d6a0, 0x0ada2, 0x095b0, 0x14977, 0x04970, 0x0a4b0, 0x0b4b5, 0x06a50,
    0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, 0x06566, 0x0d4a0,
    0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2,
    0x0a950, 0x0b557, 0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573,
    0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6, 0x0ab50, 0x04b60, 0x0aae4,
    0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0, 0x04dd5,
    0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46,
    0x0ab60, 0x09570, 0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58,
    0x055c0, 0x0ab60, 0x096d5, 0x092e0, 0x0c960, 0x0d954, 0x0d4a0, 0x0da50,
    0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, 0x0a950, 0x0b4a0,
    0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260,
    0x0ea65, 0x0d530, 0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0,
    0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, 0x0b5a0, 0x056d0, 0x055b2, 0x049b0,
    0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, 0x14b63, 0x09370,
    0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0,
    0x0a6d0, 0x055d4, 0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50,
    0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, 0x0b273, 0x06930, 0x07337, 0x06aa0,
    0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, 0x0e968, 0x0d520,
    0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    0x0d520,
  ];

  function lunarYearDays(y) {
    let sum = 348;
    const info = LUNAR_INFO[y - 1900];
    for (let i = 0x8000; i > 0x8; i >>= 1) sum += info & i ? 1 : 0;
    return sum + leapDays(y);
  }
  function leapMonthOf(y) {
    return LUNAR_INFO[y - 1900] & 0xf;
  }
  function leapDays(y) {
    const lm = leapMonthOf(y);
    if (!lm) return 0;
    return LUNAR_INFO[y - 1900] & 0x10000 ? 30 : 29;
  }
  function lunarMonthDays(y, m) {
    return LUNAR_INFO[y - 1900] & (0x10000 >> m) ? 30 : 29;
  }
  function lunarToSolar(ly, lm, ld, isLeap) {
    if (ly < 1900 || ly > 2100) throw new Error("1900~2100년만 지원");
    let offset = 0;
    for (let y = 1900; y < ly; y++) offset += lunarYearDays(y);
    const leap = leapMonthOf(ly);
    for (let m = 1; m < lm; m++) offset += lunarMonthDays(ly, m);
    if (leap && (lm > leap || (lm === leap && isLeap))) offset += leapDays(ly);
    offset += ld - 1;
    const base = Date.UTC(1900, 0, 31);
    const d = new Date(base + offset * 86400000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }

  function dayPillar(y, m, d) {
    // 율리우스 적일 (양력 기준)
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    const jdn =
      d +
      Math.floor((153 * mm + 2) / 5) +
      365 * yy +
      Math.floor(yy / 4) -
      Math.floor(yy / 100) +
      Math.floor(yy / 400) -
      32045;
    // 기준점: 2000-01-01 = JDN 2451545 = 戊午일 (60갑자 index 54)
    const offset = jdn - 2451545;
    const idx = (((54 + offset) % 60) + 60000) % 60;
    return {
      stem: STEMS[idx % 10],
      stemKo: STEMS_KO[idx % 10],
      branch: BRANCHES[idx % 12],
      branchKo: BRANCHES_KO[idx % 12],
      element: ELEM_BY_STEM[idx % 10],
      idx: idx,
    };
  }
  function hourBranchIndex(timeStr) {
    if (!timeStr) return null;
    const parts = String(timeStr).split(":").map(Number);
    const hour = parts[0];
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
    return Math.floor(((hour + 1) % 24) / 2);
  }
  function hourPillar(dayStemIndex, timeStr) {
    const branchIdx = hourBranchIndex(timeStr);
    if (branchIdx === null) return null;
    const startStemByDayStem = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8];
    const stemIdx = (startStemByDayStem[dayStemIndex] + branchIdx) % 10;
    return {
      stem: STEMS[stemIdx],
      stemKo: STEMS_KO[stemIdx],
      branch: BRANCHES[branchIdx],
      branchKo: BRANCHES_KO[branchIdx],
      tone: HOUR_TONES[BRANCHES_KO[branchIdx]] || "",
    };
  }
  function zodiacOf(y) {
    return ZODIAC[(((y - 4) % 12) + 12) % 12];
  }

  const DEFAULT_QUESTION_IDS = [
    "long_partner",
    "heart_closes",
    "choice_standard",
  ];
  let selectedQuestionIds = DEFAULT_QUESTION_IDS.slice();
  let previewMode = "solo";
  let lastPreview = null;

  const COORDINATE_AXES = [
    { key: "speed", label: "끌림 속도" },
    { key: "attraction", label: "끌림 방식" },
    { key: "expression", label: "표현 방식" },
    { key: "stability", label: "안정 기준" },
    { key: "recovery", label: "회복 방식" },
  ];

  const ELEMENT_COORDS = {
    목: {
      label: "자라는 마음",
      scores: {
        speed: 72,
        attraction: 66,
        expression: 62,
        stability: 54,
        recovery: 58,
      },
      levels: {
        speed: "빠르게 반응",
        attraction: "함께 자람",
        expression: "조심스런 제안",
        stability: "성장감",
        recovery: "대화로 조정",
      },
      teaser:
        "마음이 움직이면 먼저 가능성을 키워보는 쪽이에요. 다만 커지는 마음만큼 내 리듬도 같이 챙겨야 편합니다.",
    },
    화: {
      label: "밝아지는 마음",
      scores: {
        speed: 84,
        attraction: 78,
        expression: 76,
        stability: 48,
        recovery: 64,
      },
      levels: {
        speed: "빠르게 켜짐",
        attraction: "온기와 반응",
        expression: "표현 선명",
        stability: "기분 영향",
        recovery: "풀리면 빠름",
      },
      teaser:
        "마음이 켜지는 순간이 빠른 편이에요. 설렘이 살아날수록, 식은 뒤에도 지킬 태도를 같이 보는 게 좋습니다.",
    },
    토: {
      label: "쌓이는 마음",
      scores: {
        speed: 46,
        attraction: 50,
        expression: 42,
        stability: 82,
        recovery: 48,
      },
      levels: {
        speed: "천천히 확인",
        attraction: "익숙함 선호",
        expression: "말보다 행동",
        stability: "반복과 약속",
        recovery: "시간 필요",
      },
      teaser:
        "마음은 천천히 쌓이지만 한 번 편해진 자리는 오래 갑니다. 약속과 반복되는 태도가 가장 큰 기준이에요.",
    },
    금: {
      label: "선명한 마음",
      scores: {
        speed: 58,
        attraction: 62,
        expression: 54,
        stability: 78,
        recovery: 44,
      },
      levels: {
        speed: "선별 후 반응",
        attraction: "태도와 기준",
        expression: "짧고 분명",
        stability: "경계와 약속",
        recovery: "정리 후 대화",
      },
      teaser:
        "좋고 싫음의 기준이 비교적 선명한 편이에요. 말보다 태도가 맞는 사람에게 오래 마음이 갑니다.",
    },
    수: {
      label: "깊어지는 마음",
      scores: {
        speed: 38,
        attraction: 48,
        expression: 34,
        stability: 62,
        recovery: 38,
      },
      levels: {
        speed: "천천히 깊게",
        attraction: "뉘앙스와 깊이",
        expression: "정리 후 표현",
        stability: "정서적 안심",
        recovery: "혼자 정리",
      },
      teaser:
        "겉으로는 잔잔해 보여도 안에서는 오래 살피는 힘이 있어요. 재촉보다 마음이 움직일 시간이 필요합니다.",
    },
  };

  const BRANCH_ADJUST = {
    인: { speed: 7, expression: 5 },
    묘: { attraction: 8, expression: 4 },
    사: { speed: 8, expression: 8 },
    오: { speed: 10, attraction: 5 },
    신: { stability: 7, recovery: 5 },
    유: { stability: 8, expression: -4 },
    자: { speed: -8, recovery: -5 },
    해: { speed: -7, expression: -5 },
    축: { speed: -5, stability: 7 },
    미: { stability: 6, recovery: 3 },
    진: { stability: 4, recovery: 4 },
    술: { stability: 7, recovery: -2 },
  };

  const QUESTION_BANK = [
    {
      id: "long_partner",
      label: "나와 오래 갈 수 있는 상대는 어떤 사람일까?",
      answer: ({ profile }) =>
        profile.relation +
        " 오래 갈 사람은 첫인상의 강함보다, 대화가 끝난 뒤 내 마음이 편안해지는 쪽에 가깝습니다. 풀 리포트에서는 오래 갈 상대 3유형과 피해야 할 관계 신호를 따로 나눠 보여드립니다.",
    },
    {
      id: "heart_closes",
      label: "나는 관계에서 어떤 순간에 마음이 닫힐까?",
      answer: ({ profile }) =>
        profile.caution +
        " 관계에서는 상대가 나를 재촉한다고 느낄 때 마음이 빨리 닫힐 수 있습니다. 이게 마음이 식은 신호인지, 부담이 커진 신호인지는 풀 리포트에서 따로 갈라 봐야 합니다.",
    },
    {
      id: "date_or_focus",
      label: "소개팅을 해도 괜찮을까, 일에 집중할까?",
      answer: ({ profile }) =>
        profile.decision +
        " 지금은 소개팅과 일 중 하나를 완전히 닫기보다, 에너지를 작게 나누는 쪽이 맞습니다. 풀 리포트에서는 이번 달에 넓혀도 되는 접점과 쉬어야 하는 접점을 구분해드립니다.",
    },
    {
      id: "open_or_rest",
      label: "지금은 인연을 넓힐 때일까, 나를 정리할 때일까?",
      answer: ({ profile }) =>
        profile.self +
        " 지금은 인연을 무작정 넓히기보다, 편안해지는 기준을 먼저 잡는 편이 좋습니다. 풀 리포트에서는 새 만남을 열어도 되는 타이밍과 잠시 쉬는 게 나은 타이밍을 나눠 봅니다.",
    },
    {
      id: "work_drain",
      label: "내가 일에서 지치기 쉬운 패턴은?",
      answer: ({ profile }) =>
        profile.self +
        " 일에서는 혼자 오래 붙잡고 정리하다가 지치는 패턴으로 나타날 수 있습니다. 풀 리포트에서는 어떤 환경에서 에너지가 새는지, 어떤 직무 방식이 덜 지치게 하는지까지 봅니다.",
    },
    {
      id: "work_direction",
      label: "지금 나에게 맞는 일의 방향은 무엇일까?",
      answer: ({ profile }) =>
        profile.decision +
        " 일의 방향은 직업명 하나보다, 내가 편하게 오래 쓰는 기능에서 먼저 보입니다. 풀 리포트에서는 이 기능을 실제 직무군과 연결해 더 구체적으로 좁혀드립니다.",
    },
    {
      id: "money_leak",
      label: "돈이 새기 쉬운 습관은 무엇일까?",
      answer: ({ profile }) =>
        profile.caution +
        " 돈에서는 기분을 달래기 위한 작은 지출이나, 고민을 미루기 위한 결제로 나타날 수 있습니다. 무료 미리보기에서는 수익을 예측하지 않고, 돈을 쓰게 되는 감정의 문턱만 가볍게 봅니다.",
    },
    {
      id: "year_caution",
      label: "올해 내가 가장 조심해야 할 선택은?",
      answer: ({ profile }) =>
        profile.decision +
        " 올해 조심할 선택은 외부의 기대가 내 판단보다 앞서는 순간입니다. 풀 리포트에서는 이 흐름이 관계, 일, 돈 중 어디에서 더 강하게 나타나는지 나눠 봅니다.",
    },
    {
      id: "anxiety_reason",
      label: "요즘 불안이 커지는 이유는 무엇일까?",
      answer: ({ profile }) =>
        profile.self +
        " 불안은 앞이 캄캄할 때만 커지지 않습니다. 내 마음의 박자와 현실의 요구가 어긋날 때도 커집니다. 풀 리포트에서는 불안 밑에 깔린 진짜 질문을 찾아 다음 선택 기준으로 바꿔드립니다.",
    },
    {
      id: "choice_standard",
      label: "지금 선택 앞에서 먼저 봐야 할 기준은?",
      answer: ({ profile }) =>
        profile.decision +
        " " +
        profile.self +
        " 선택이 커질수록 남들이 좋아 보이는 길보다, 내가 반복해서 지킬 수 있는 리듬인지 먼저 봐야 합니다. 풀 리포트에서는 A/B 선택지를 넣어 실제 권고 방향을 더 선명하게 뽑습니다.",
    },
    {
      id: "weekly_action",
      label: "이번 주에 작게 해볼 행동은 무엇일까?",
      answer: ({ profile }) =>
        profile.caution +
        " 이번 주에는 큰 변화보다 내 마음을 확인할 수 있는 장면 하나가 더 중요합니다. 풀 리포트에서는 지금 해볼 행동과 멈춰야 할 행동을 각각 한 줄로 정리해드립니다.",
    },
    {
      id: "one_sentence",
      label: "내 기질을 한 문장으로 말하면?",
      answer: ({ profile, pillarText }) =>
        pillarText +
        "의 큰 결로 보면, 당신은 " +
        profile.self +
        " 한 문장으로 말하면, “내가 납득할 시간을 갖고 정리할 때 가장 단단해지는 사람”입니다. 풀 리포트에서는 이 기질이 연애, 일, 돈에서 각각 어떻게 다르게 드러나는지 펼쳐 봅니다.",
    },
  ];

  function answerCards(pillar, hour) {
    const profile =
      ELEMENT_PREVIEW_PROFILES[pillar.element] ||
      ELEMENT_PREVIEW_PROFILES["토"];
    const hourTone =
      hour?.tone ||
      "태어난 시간을 비워 두면 시주의 세부 리듬은 줄이고, 일주의 큰 결만으로 읽습니다.";
    const pillarText =
      "일주 " +
      pillar.stemKo +
      pillar.branchKo +
      "(" +
      pillar.stem +
      pillar.branch +
      ")";
    const selected = selectedQuestionIds
      .map((id) => QUESTION_BANK.find((item) => item.id === id))
      .filter(Boolean)
      .slice(0, 3);
    return selected.map((item) => ({
      title: item.label,
      text: item.answer({ profile, hourTone, pillarText }),
    }));
  }

  const ELEMENT_PROFILES = {
    목: {
      self: "멈춰 있으면 마음이 답답해지고, 작은 가능성이 보이면 먼저 키워 보고 싶은 결이 강합니다.",
      relation:
        "같이 자라고 배워가는 느낌을 주는 사람에게 편안함을 느끼기 쉽습니다. 이미 완성된 사람보다, 대화 속에서 방향을 함께 넓혀가는 사람이 오래 남습니다.",
      caution:
        "이번 주에는 마음이 앞서서 약속을 크게 잡거나, 상대의 반응을 빨리 확인하고 싶어질 수 있습니다.",
      decision:
        "지금 선택 앞에서는 “이 선택이 나를 조금이라도 자라게 하는가”를 먼저 보세요.",
    },
    화: {
      self: "마음이 켜질 때는 빠르게 밝아지고, 분위기와 반응을 섬세하게 읽는 결이 있습니다.",
      relation:
        "감정을 숨기지 않고 따뜻하게 표현해 주는 사람에게 편안함을 느끼기 쉽습니다. 단, 처음의 설렘보다 식은 뒤에도 예의를 지키는지가 더 중요합니다.",
      caution:
        "이번 주에는 말이 빨라지거나, 순간의 기분으로 답을 정하고 싶어질 수 있습니다.",
      decision:
        "지금 선택 앞에서는 “지금의 뜨거움이 지나도 내가 책임질 수 있는가”를 먼저 보세요.",
    },
    토: {
      self: "천천히 쌓고 오래 지키는 힘이 있습니다. 쉽게 흔들리지 않지만, 마음을 정하기까지 시간이 필요합니다.",
      relation:
        "매일 비슷한 자리에서 꾸준히 보여주는 사람에게 편안함을 느끼기 쉽습니다. 화려한 말보다 약속을 지키는 태도, 급한 밀당보다 안정적인 리듬이 오래 갑니다.",
      caution:
        "이번 주에는 혼자 버티려 하거나, 마음이 정리되지 않았는데도 괜찮은 척할 수 있습니다.",
      decision:
        "지금 선택 앞에서는 “내가 오래 감당할 수 있는 구조인가”를 먼저 보세요.",
    },
    금: {
      self: "기준이 분명하고 애매한 것을 오래 두기 어려운 결이 있습니다. 정리가 되면 빠르고 단단합니다.",
      relation:
        "말과 행동이 일치하는 사람에게 편안함을 느끼기 쉽습니다. 호감 표현이 크지 않아도 태도가 선명하고, 약속과 경계를 존중하는 사람이 오래 갑니다.",
      caution:
        "이번 주에는 마음을 보호하려고 말을 너무 짧게 하거나, 상대의 부족한 부분을 먼저 재단할 수 있습니다.",
      decision:
        "지금 선택 앞에서는 “내 기준을 지키면서도 관계를 너무 빨리 잘라내고 있지는 않은가”를 먼저 보세요.",
    },
    수: {
      self: "흐름을 읽고 깊이 생각하는 힘이 있습니다. 겉으로는 잔잔해 보여도 안에서는 감정과 가능성을 오래 살핍니다.",
      relation:
        "말하지 않은 뉘앙스까지 조심스럽게 읽어 주는 사람에게 편안함을 느끼기 쉽습니다. 재촉하지 않고, 성급한 결론 대신 마음이 움직일 시간을 주는 사람이 오래 남습니다.",
      caution:
        "이번 주에는 생각이 깊어지는 만큼 결정을 미루거나, 마음을 말하지 않은 채 상대가 알아주길 바랄 수 있습니다.",
      decision:
        "지금 선택 앞에서는 “이 선택이 내 마음을 더 흐리게 하는가, 아니면 맑게 하는가”를 먼저 보세요.",
    },
  };

  const ELEMENT_PREVIEW_PROFILES = {
    목: {
      self: "가능성이 보이면 먼저 키워 보고 싶은 쪽입니다.",
      relation: "같이 배우고 넓혀가는 사람에게 편안함을 느끼기 쉽습니다.",
      caution: "마음이 앞서면 약속을 크게 잡고 싶어질 수 있습니다.",
      decision: "지금은 나를 조금이라도 자라게 하는 선택인지가 중요합니다.",
    },
    화: {
      self: "마음이 켜질 때 빠르게 밝아지는 쪽입니다.",
      relation: "따뜻하게 표현해 주는 사람에게 마음이 빨리 열립니다.",
      caution: "순간의 기분으로 답을 정하고 싶어질 수 있습니다.",
      decision: "지금의 뜨거움이 지나도 책임질 수 있는지가 기준입니다.",
    },
    토: {
      self: "천천히 쌓고 오래 지키는 힘이 있습니다.",
      relation: "꾸준히 보여주는 사람에게 편안함을 느끼기 쉽습니다.",
      caution: "혼자 버티거나 괜찮은 척하기 쉬운 때입니다.",
      decision: "오래 감당할 수 있는 구조인지 먼저 봐야 합니다.",
    },
    금: {
      self: "기준이 분명하고 애매한 것을 오래 두기 어려운 쪽입니다.",
      relation: "말과 행동이 일치하는 사람에게 마음이 놓입니다.",
      caution: "마음을 보호하려다 말을 너무 짧게 할 수 있습니다.",
      decision: "기준을 지키되 너무 빨리 잘라내는지는 봐야 합니다.",
    },
    수: {
      self: "겉은 잔잔해도 안에서는 오래 살피는 힘이 있습니다.",
      relation: "재촉하지 않고 기다려주는 사람에게 마음이 놓입니다.",
      caution: "생각이 깊어질수록 결정을 미루기 쉬운 때입니다.",
      decision: "내 마음이 더 맑아지는 선택인지 먼저 봐야 합니다.",
    },
  };

  const HOUR_TONES = {
    자: "속마음이 깊고, 혼자 정리하는 시간이 관계의 안정감과 연결됩니다.",
    축: "천천히 확인하고 안전하다고 느낄 때 마음이 오래 갑니다.",
    인: "새로운 가능성에 반응하지만, 시작 뒤의 꾸준함을 함께 봐야 합니다.",
    묘: "다정한 대화와 섬세한 분위기에 마음이 열리기 쉽습니다.",
    진: "관계 안에서도 현실적인 계획과 책임감을 함께 보고 싶어집니다.",
    사: "따뜻한 표현과 선명한 호감 신호가 있을 때 마음이 움직입니다.",
    오: "표현이 살아나면 매력이 커지지만, 속도 조절이 함께 필요합니다.",
    미: "편안한 반복과 생활 리듬이 맞을 때 오래 안정됩니다.",
    신: "대화의 센스와 현실 감각이 맞는 사람에게 끌리기 쉽습니다.",
    유: "태도와 말의 정확함, 서로의 경계 존중이 중요합니다.",
    술: "의리와 책임감이 보일 때 마음이 깊어지기 쉽습니다.",
    해: "감정의 결을 조용히 받아주는 사람에게 마음을 놓기 쉽습니다.",
  };

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, Number(n) || 0));
  }

  function coordPoint(index, total, score, radius, cx, cy) {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const r = (radius * clamp(score, 0, 100)) / 100;
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    };
  }

  function profileCoordinates(pillar, hour) {
    const base = ELEMENT_COORDS[pillar.element] || ELEMENT_COORDS["토"];
    const scores = Object.assign({}, base.scores);
    const levels = Object.assign({}, base.levels);
    const hourAdj = hour ? BRANCH_ADJUST[hour.branchKo] : null;
    if (hourAdj) {
      Object.keys(hourAdj).forEach((key) => {
        scores[key] = clamp((scores[key] || 56) + hourAdj[key], 24, 90);
      });
      if (hour.branchKo === "사" || hour.branchKo === "오")
        levels.expression = "표현이 살아남";
      if (hour.branchKo === "자" || hour.branchKo === "해")
        levels.recovery = "혼자 정리";
      if (hour.branchKo === "유" || hour.branchKo === "신")
        levels.stability = "태도와 기준";
      if (hour.branchKo === "묘") levels.attraction = "다정한 대화";
    }
    return {
      name: base.label,
      teaser: base.teaser,
      element: pillar.element,
      axes: COORDINATE_AXES.map((axis) => ({
        key: axis.key,
        label: axis.label,
        score: clamp(scores[axis.key], 24, 90),
        level: levels[axis.key] || "중간",
        basis: axisBasis(axis.key, pillar, hour),
      })),
    };
  }

  function axisBasis(key, pillar, hour) {
    const hourText = hour
      ? "시주는 " + hour.branchKo + "시 리듬까지 함께 봅니다."
      : "생시가 없어 일주의 큰 결로만 봅니다.";
    const map = {
      speed: pillar.element + " 일간의 반응 속도와 " + hourText,
      attraction: "일간 오행과 일지의 분위기로 보는 끌림 방식입니다.",
      expression: "일주와 생시가 보여주는 표현 습관을 가볍게 압축했습니다.",
      stability: "관계에서 편안함을 느끼는 기준을 생활어로 바꾼 축입니다.",
      recovery: "마음이 닫힌 뒤 다시 편해지는 방식을 보는 축입니다.",
    };
    return map[key] || "무료 미리보기용 요약 축입니다.";
  }

  function renderMiniRadar(profiles) {
    const items = profiles.filter(Boolean);
    if (!items.length) return "";
    const axes = COORDINATE_AXES;
    const cx = 82,
      cy = 82,
      radius = 52;
    const rings = [33, 66, 100]
      .map(
        (level) =>
          '<polygon points="' +
          axes
            .map((_, i) => {
              const p = coordPoint(i, axes.length, level, radius, cx, cy);
              return p.x.toFixed(1) + "," + p.y.toFixed(1);
            })
            .join(" ") +
          '" fill="none" stroke="rgba(216,161,93,.26)" stroke-width="1"/>',
      )
      .join("");
    const spokes = axes
      .map((_, i) => {
        const p = coordPoint(i, axes.length, 100, radius, cx, cy);
        return (
          '<line x1="' +
          cx +
          '" y1="' +
          cy +
          '" x2="' +
          p.x.toFixed(1) +
          '" y2="' +
          p.y.toFixed(1) +
          '" stroke="rgba(216,161,93,.2)" stroke-width="1"/>'
        );
      })
      .join("");
    const labels = axes
      .map((axis, i) => {
        const p = coordPoint(i, axes.length, 124, radius, cx, cy);
        return (
          '<text x="' +
          p.x.toFixed(1) +
          '" y="' +
          (p.y + 3).toFixed(1) +
          '" text-anchor="middle">' +
          axis.label.replace(" ", "\n") +
          "</text>"
        );
      })
      .join("");
    const colors = ["#f1c987", "#a9d7bf"];
    const polys = items
      .map((profile, profileIndex) => {
        const points = profile.axes
          .map((axis, i) => {
            const p = coordPoint(
              i,
              profile.axes.length,
              axis.score,
              radius,
              cx,
              cy,
            );
            return p.x.toFixed(1) + "," + p.y.toFixed(1);
          })
          .join(" ");
        const color = colors[profileIndex % colors.length];
        return (
          '<polygon points="' +
          points +
          '" fill="' +
          color +
          '" fill-opacity=".16" stroke="' +
          color +
          '" stroke-width="2.2"/>'
        );
      })
      .join("");
    const legend = items
      .map(
        (profile, i) =>
          '<span><i style="background:' +
          colors[i % colors.length] +
          '"></i>' +
          escapeHtml(profile.displayName || profile.name || "나") +
          "</span>",
      )
      .join("");
    const axisCards = axes
      .map((axis, i) => {
        const lines = items
          .map((profile) => {
            const found = profile.axes[i] || {};
            return (
              "<p><b>" +
              escapeHtml(profile.displayName || "나") +
              "</b> " +
              escapeHtml(found.level || "중간") +
              "</p>"
            );
          })
          .join("");
        return "<div><b>" + escapeHtml(axis.label) + "</b>" + lines + "</div>";
      })
      .join("");
    return (
      '<div class="fp-radar-head"><b>무료 요약 좌표</b><span>일주·시주로 보는 간단한 체감 단계입니다</span></div>' +
      '<div class="fp-radar-layout"><div><svg viewBox="0 0 164 164" role="img" aria-label="무료 미리보기 미니 레이더">' +
      rings +
      spokes +
      polys +
      labels +
      '<circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="2.8" fill="#f1c987"/></svg><div class="fp-radar-legend">' +
      legend +
      "</div></div>" +
      '<div class="fp-radar-list">' +
      axisCards +
      "</div></div>"
    );
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  }

  function trackPreviewEvent(name, detail) {
    const payload = {
      name,
      detail: detail || {},
      at: new Date().toISOString(),
    };
    try {
      window.dispatchEvent(
        new CustomEvent("jippi-preview-event", { detail: payload }),
      );
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, jippiPreview: payload.detail });
    } catch (e) {}
  }

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeBirthDateInput(value) {
    const digits = String(value || "")
      .replace(/\D/g, "")
      .slice(0, 8);
    const y = digits.slice(0, 4);
    const m = digits.slice(4, 6);
    const d = digits.slice(6, 8);
    if (d) return y + "-" + m + "-" + d;
    if (m) return y + "-" + m;
    return y;
  }

  function parseBirthDateInput(value) {
    const formatted = normalizeBirthDateInput(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(formatted);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      !y ||
      !m ||
      !d ||
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() + 1 !== m ||
      dt.getUTCDate() !== d
    ) {
      return null;
    }
    return { y, m, d, formatted };
  }

  function bindDateMask(id) {
    const input = $(id);
    if (!input) return;
    input.addEventListener("input", () => {
      input.value = normalizeBirthDateInput(input.value);
    });
    input.addEventListener("blur", () => {
      input.value = normalizeBirthDateInput(input.value);
    });
    input.addEventListener("paste", () => {
      setTimeout(() => {
        input.value = normalizeBirthDateInput(input.value);
      }, 0);
    });
  }

  function pillarLabel(pillar) {
    return (
      pillar.stemKo + pillar.branchKo + "(" + pillar.stem + pillar.branch + ")"
    );
  }

  function readPreviewPerson(opts) {
    const dateInput = $(opts.dateId);
    const dateStr = (dateInput || {}).value || "";
    if (!dateStr) throw new Error(opts.label + " 생년월일을 입력해 주세요.");
    const parsed = parseBirthDateInput(dateStr);
    if (!parsed)
      throw new Error(
        opts.label + " 생년월일은 1999-09-09처럼 4자리 연도로 입력해 주세요.",
      );
    if (dateInput) dateInput.value = parsed.formatted;
    if (parsed.y < 1900 || parsed.y > 2100)
      throw new Error("1900~2100년 사이만 지원합니다.");

    const cal = ($(opts.calendarId) || {}).value || "solar";
    let solar = { y: parsed.y, m: parsed.m, d: parsed.d };
    if (cal === "lunar")
      solar = lunarToSolar(parsed.y, parsed.m, parsed.d, false);

    const pillar = dayPillar(solar.y, solar.m, solar.d);
    const hour = hourPillar(
      STEMS.indexOf(pillar.stem),
      ($(opts.timeId) || {}).value || "",
    );
    const coords = profileCoordinates(pillar, hour);
    coords.displayName = opts.displayName || opts.label;
    return {
      pillar,
      hour,
      coords,
      label: opts.label,
      displayName: opts.displayName || opts.label,
    };
  }

  function setPreviewMode(mode) {
    previewMode = mode === "pair" ? "pair" : "solo";
    const soloBtn = $("fpModeSolo");
    const pairBtn = $("fpModePair");
    if (soloBtn) {
      soloBtn.classList.toggle("is-active", previewMode === "solo");
      soloBtn.setAttribute(
        "aria-pressed",
        previewMode === "solo" ? "true" : "false",
      );
    }
    if (pairBtn) {
      pairBtn.classList.toggle("is-active", previewMode === "pair");
      pairBtn.setAttribute(
        "aria-pressed",
        previewMode === "pair" ? "true" : "false",
      );
    }
    document.querySelectorAll(".fp-pair-only").forEach((el) => {
      el.classList.toggle("hidden", previewMode !== "pair");
    });
    const picker = $("fpQuestionPicker");
    if (picker) picker.classList.toggle("hidden", previewMode === "pair");
    const btn = $("fpRunBtn");
    if (btn)
      btn.textContent =
        previewMode === "pair" ? "둘이 보기 미리보기 →" : "무료 미리보기 →";
  }

  function pairTeaser(a, b) {
    const speedA =
      a.coords.axes.find((axis) => axis.key === "speed")?.score || 56;
    const speedB =
      b.coords.axes.find((axis) => axis.key === "speed")?.score || 56;
    const stabilityA =
      a.coords.axes.find((axis) => axis.key === "stability")?.score || 56;
    const stabilityB =
      b.coords.axes.find((axis) => axis.key === "stability")?.score || 56;
    const speedGap = Math.abs(speedA - speedB);
    const bothStable = stabilityA >= 68 && stabilityB >= 68;

    if (speedGap >= 28) {
      return {
        label: "속도 차이가 먼저 보이는 사이",
        pull: "한쪽은 마음이 빨리 켜지고, 한쪽은 확인한 뒤 움직입니다. 처음엔 그 차이가 매력으로 보일 수 있어요.",
        friction:
          "시간이 지나면 빠른 쪽은 답답해지고, 신중한 쪽은 밀린다고 느끼기 쉽습니다.",
        avoid: "지금 피할 행동은 답을 빨리 정하라고 몰아붙이는 일입니다.",
      };
    }
    if (bothStable) {
      return {
        label: "약속과 태도에서 편해지는 사이",
        pull: "두 사람 모두 큰 말보다 반복되는 태도에서 안심하는 쪽입니다.",
        friction:
          "확실한 약속 없이 분위기로만 흘러가면 둘 다 마음을 덜 열 수 있습니다.",
        avoid: "지금 피할 행동은 불편한 약속 변경을 대충 넘기는 일입니다.",
      };
    }
    return {
      label: "편해서 끌리고 작은 신호에서 멈추는 사이",
      pull: "처음엔 같이 있을 때 부담이 덜해서 마음이 열립니다.",
      friction:
        "작은 서운함을 말로 맞추지 않으면, 둘 사이의 온도가 천천히 낮아질 수 있어요.",
      avoid: "지금 피할 행동은 괜찮은 척하며 확인해야 할 말을 미루는 일입니다.",
    };
  }

  function renderPreviewResult(payload) {
    lastPreview = payload;
    const emptyEl = $("fpEmpty");
    const resultEl = $("fpResult");
    if (emptyEl) emptyEl.classList.add("hidden");
    if (resultEl) resultEl.classList.remove("hidden");

    $("fpPillJuga").textContent = payload.pills[0] || "";
    $("fpPillHour").textContent = payload.pills[1] || "";
    $("fpPillElement").textContent = payload.pills[2] || "";
    $("fpTeaserTitle").textContent = payload.teaserTitle || "오늘의 한 줄";
    $("fpTeaserText").textContent = payload.teaserText || "";
    $("fpMiniRadar").innerHTML = renderMiniRadar(payload.profiles || []);

    const cards = payload.cards || [];
    [
      ["fpQ1Title", "fpQ1Text"],
      ["fpQ2Title", "fpQ2Text"],
      ["fpQ3Title", "fpQ3Text"],
    ].forEach((ids, index) => {
      const card = cards[index] || { title: "", text: "" };
      $(ids[0]).textContent = card.title || "";
      $(ids[1]).textContent = card.text || "";
    });

    const card = $("fpResultCard");
    if (card && card.scrollIntoView)
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    trackPreviewEvent("free_preview_result", { mode: payload.mode });
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || "").split(/\s+/);
    let line = "";
    let lines = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        y += lineHeight;
        lines += 1;
        line = words[i];
        if (maxLines && lines >= maxLines - 1) break;
      } else {
        line = test;
      }
    }
    if (line && (!maxLines || lines < maxLines)) ctx.fillText(line, x, y);
    return y + lineHeight;
  }

  function drawShareImage() {
    if (!lastPreview) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#211c17");
    grad.addColorStop(0.56, "#315e59");
    grad.addColorStop(1, "#5b3f2a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(216,178,106,.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(54, 54, canvas.width - 108, canvas.height - 108);

    ctx.fillStyle = "#f1c987";
    ctx.font = "800 34px Pretendard, Arial, sans-serif";
    ctx.fillText("JIPPI 무료 미리보기", 86, 128);

    ctx.fillStyle = "#fff8ed";
    ctx.font = '900 60px "Nanum Myeongjo", serif';
    wrapCanvasText(
      ctx,
      lastPreview.shareTitle || lastPreview.teaserTitle || "무료 미리보기",
      86,
      230,
      908,
      76,
      3,
    );

    ctx.fillStyle = "#ffe7c7";
    ctx.font = "500 38px Pretendard, Arial, sans-serif";
    wrapCanvasText(ctx, lastPreview.teaserText || "", 86, 468, 908, 58, 4);

    const cx = 540,
      cy = 835,
      radius = 210;
    ctx.strokeStyle = "rgba(241,201,135,.28)";
    ctx.lineWidth = 2;
    [0.33, 0.66, 1].forEach((r) => {
      ctx.beginPath();
      COORDINATE_AXES.forEach((_, i) => {
        const p = coordPoint(
          i,
          COORDINATE_AXES.length,
          r * 100,
          radius,
          cx,
          cy,
        );
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();
    });

    (lastPreview.profiles || [])
      .slice(0, 2)
      .forEach((profile, profileIndex) => {
        const color = profileIndex ? "#a9d7bf" : "#f1c987";
        ctx.beginPath();
        profile.axes.forEach((axis, i) => {
          const p = coordPoint(
            i,
            profile.axes.length,
            axis.score,
            radius,
            cx,
            cy,
          );
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = profileIndex
          ? "rgba(169,215,191,.18)"
          : "rgba(241,201,135,.18)";
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.fill();
        ctx.stroke();
      });

    ctx.fillStyle = "#fff0d7";
    ctx.font = "800 28px Pretendard, Arial, sans-serif";
    ctx.textAlign = "center";
    COORDINATE_AXES.forEach((axis, i) => {
      const p = coordPoint(i, COORDINATE_AXES.length, 122, radius, cx, cy);
      ctx.fillText(axis.label, p.x, p.y + 10);
    });
    ctx.textAlign = "left";

    ctx.fillStyle = "#f1c987";
    ctx.font = "800 30px Pretendard, Arial, sans-serif";
    ctx.fillText(
      "입력 정보는 저장되지 않고 브라우저 안에서만 계산돼요",
      86,
      1230,
    );
    ctx.fillStyle = "#fff8ed";
    ctx.font = "900 34px Pretendard, Arial, sans-serif";
    ctx.fillText("jippi.kr/fortune", 86, 1284);
    return canvas;
  }

  async function sharePreview() {
    if (!lastPreview) return;
    const url = location.origin + location.pathname + "#preview";
    const text =
      (lastPreview.shareTitle ||
        lastPreview.teaserTitle ||
        "JIPPI 무료 미리보기") +
      "\n" +
      (lastPreview.teaserText || "") +
      "\n" +
      url;
    trackPreviewEvent("free_preview_share_click", { mode: lastPreview.mode });
    if (navigator.share) {
      try {
        await navigator.share({ title: "JIPPI 무료 미리보기", text, url });
        trackPreviewEvent("free_preview_share_success", {
          mode: lastPreview.mode,
        });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      alert("공유 문구와 링크를 복사했어요. 카톡 대화창에 붙여넣으면 됩니다.");
    } catch (e) {
      alert(text);
    }
  }

  function savePreviewImage() {
    const canvas = drawShareImage();
    if (!canvas) return;
    trackPreviewEvent("free_preview_image_save", { mode: lastPreview.mode });
    const link = document.createElement("a");
    link.download = "jippi-free-preview.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function updateQuestionCount() {
    const countEl = $("fpQuestionCount");
    if (countEl) countEl.textContent = selectedQuestionIds.length + "/3";
  }

  function renderQuestionChoices() {
    const wrap = $("fpQuestionChoices");
    if (!wrap) return;
    wrap.innerHTML = "";
    QUESTION_BANK.forEach((question) => {
      const isSelected = selectedQuestionIds.includes(question.id);
      const isDisabled = !isSelected && selectedQuestionIds.length >= 3;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "fp-choice" +
        (isSelected ? " is-selected" : "") +
        (isDisabled ? " is-disabled" : "");
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
      btn.textContent = question.label;
      btn.addEventListener("click", () => toggleQuestion(question.id));
      wrap.appendChild(btn);
    });
    updateQuestionCount();
  }

  function toggleQuestion(id) {
    if (selectedQuestionIds.includes(id)) {
      selectedQuestionIds = selectedQuestionIds.filter((item) => item !== id);
      renderQuestionChoices();
      return;
    }
    if (selectedQuestionIds.length >= 3) {
      alert("무료 미리보기는 질문 3개까지 선택할 수 있어요.");
      return;
    }
    selectedQuestionIds = [...selectedQuestionIds, id];
    renderQuestionChoices();
  }

  function run() {
    try {
      const me = readPreviewPerson({
        label: "내",
        displayName: "나",
        calendarId: "fpCalendar",
        dateId: "fpBirthDate",
        timeId: "fpBirthTime",
      });

      if (previewMode === "pair") {
        const partner = readPreviewPerson({
          label: "상대",
          displayName: "상대",
          calendarId: "fpPartnerCalendar",
          dateId: "fpPartnerBirthDate",
          timeId: "fpPartnerBirthTime",
        });
        const teaser = pairTeaser(me, partner);
        renderPreviewResult({
          mode: "pair",
          shareTitle: "두 사람 무료 궁합 미리보기",
          teaserTitle: teaser.label,
          teaserText: teaser.pull,
          pills: [
            "내 일주 " + pillarLabel(me.pillar),
            "상대 일주 " + pillarLabel(partner.pillar),
            "둘이 보기",
          ],
          profiles: [me.coords, partner.coords],
          cards: [
            { title: "처음 끌리는 이유", text: teaser.pull },
            { title: "반복 오해", text: teaser.friction },
            {
              title: "지금 피할 행동",
              text:
                teaser.avoid +
                " 풀 리포트에서는 화해 순서와 첫 문장, 30일 운영표까지 열립니다.",
            },
          ],
        });
        return;
      }

      if (selectedQuestionIds.length !== 3) {
        alert("궁금한 질문을 정확히 3개 골라 주세요.");
        return;
      }
      const cards = answerCards(me.pillar, me.hour);
      const teaser = {
        title: me.coords.name,
        text:
          me.coords.teaser ||
          (ELEMENT_PROFILES[me.pillar.element] || ELEMENT_PROFILES["토"]).self,
      };
      renderPreviewResult({
        mode: "solo",
        shareTitle: "내 무료 운세 미리보기",
        teaserTitle: teaser.title,
        teaserText: teaser.text,
        pills: [
          "일주 " + pillarLabel(me.pillar),
          me.hour ? "시주 " + pillarLabel(me.hour) : "시주 생시 미입력",
          "일간 오행 " + me.pillar.element,
        ],
        profiles: [me.coords],
        cards,
      });
    } catch (e) {
      alert(e.message || "무료 미리보기를 계산하지 못했습니다.");
    }
  }

  function init() {
    renderQuestionChoices();
    const btn = $("fpRunBtn");
    bindDateMask("fpBirthDate");
    bindDateMask("fpPartnerBirthDate");
    const soloBtn = $("fpModeSolo");
    const pairBtn = $("fpModePair");
    if (soloBtn)
      soloBtn.addEventListener("click", () => setPreviewMode("solo"));
    if (pairBtn)
      pairBtn.addEventListener("click", () => setPreviewMode("pair"));
    if (btn) btn.addEventListener("click", run);
    const shareBtn = $("fpShareBtn");
    const saveBtn = $("fpSaveImageBtn");
    if (shareBtn) shareBtn.addEventListener("click", sharePreview);
    if (saveBtn) saveBtn.addEventListener("click", savePreviewImage);
    setPreviewMode("solo");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
