/* ============================================================
   지피사주 · 무료 미리보기 위젯
   - 양력/음력 생년월일 입력 → 일주 간지 계산 → 5행 기반 3줄 메시지
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
  function zodiacOf(y) {
    return ZODIAC[(((y - 4) % 12) + 12) % 12];
  }

  // 5행별 3줄 미리보기 메시지
  const MESSAGES = {
    목: [
      "당신은 멈춰 있을수록 답답해지는 사람입니다. 한 발만 떼면 빠르게 자라는 결을 타고났습니다.",
      "관계에서도 잔잔함보다 함께 변하는 느낌에 끌립니다. 멈춰 선 사람보다, 같이 자라는 사람과 오래갑니다.",
      "2026년은 가지를 펴는 해입니다. 작은 시도를 미루지 않는 것이 한 해 운을 결정합니다.",
    ],
    화: [
      "당신은 빛나는 순간엔 누구보다 환한 사람입니다. 다만 환할 때만큼 빨리 식는 결도 있습니다.",
      "관계에서는 첫 화력은 강하지만, 식은 뒤의 태도가 진짜 모습입니다. 끝을 잘 짓는 연습이 필요합니다.",
      "2026년은 표현이 무기가 되는 해입니다. 안 보여주면 아무 일도 일어나지 않습니다.",
    ],
    토: [
      "당신은 천천히 쌓는 사람입니다. 약속을 지키지 않는 사람을 가장 늦게 용서합니다.",
      "관계에서 화려한 출발보다, 매일 같은 자리에 있어 주는 사람에게 깊이 끌립니다.",
      "2026년은 흩어진 것을 모으는 해입니다. 새로 벌이기보다 다듬어 마무리하는 쪽이 이깁니다.",
    ],
    금: [
      "당신은 옳고 그름이 분명한 사람입니다. 한 번 정한 것은 잘 안 굽히는 단단함이 있습니다.",
      "관계에서는 모호한 태도를 가장 싫어합니다. 분명한 사람 옆에서 가장 안정됩니다.",
      "2026년은 칼을 갈고 잘라낼 것을 잘라내는 해입니다. 정리하는 용기가 운을 살립니다.",
    ],
    수: [
      "당신은 흐름을 읽는 사람입니다. 적응력은 좋지만, 속으로 오래 품어둔 바람이 많습니다.",
      "관계에서는 표면적 친절보다, 자신의 결을 읽어주는 상대에게 깊게 무너집니다.",
      "2026년은 머리보다 직관이 맞는 해입니다. 너무 오래 재지 마세요. 흐름이 답을 줍니다.",
    ],
  };

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeBirthDateInput(value) {
    const digits = String(value || "")
      .replace(/\D/g, "")
      .slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return digits.slice(0, 4) + "-" + digits.slice(4);
    return (
      digits.slice(0, 4) + "-" + digits.slice(4, 6) + "-" + digits.slice(6)
    );
  }

  function parseBirthDateInput(value) {
    const formatted = normalizeBirthDateInput(value);
    const match = formatted.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    if (!y || !m || !d) return null;
    return { y, m, d, formatted };
  }

  function run() {
    const dateInput = $("fpBirthDate");
    const dateStr = (dateInput || {}).value || "";
    if (!dateStr) {
      alert("생년월일을 입력해 주세요.");
      return;
    }
    const parsed = parseBirthDateInput(dateStr);
    if (!parsed) {
      alert("생년월일은 YYYY-MM-DD 형식으로 입력해 주세요.");
      return;
    }
    if (dateInput) dateInput.value = parsed.formatted;
    const { y, m, d } = parsed;
    if (!y || !m || !d) {
      alert("생년월일 형식이 올바르지 않습니다.");
      return;
    }
    if (y < 1900 || y > 2100) {
      alert("1900~2100년 사이만 지원합니다.");
      return;
    }

    const cal = ($("fpCalendar") || {}).value || "solar";
    let solar = { y: y, m: m, d: d };
    if (cal === "lunar") {
      try {
        solar = lunarToSolar(y, m, d, false);
      } catch (e) {
        alert("음력 변환에 실패했습니다. 양력으로 다시 시도해 주세요.");
        return;
      }
    }
    const pillar = dayPillar(solar.y, solar.m, solar.d);
    const zodiac = zodiacOf(y);
    const elem = pillar.element;
    const msgs = MESSAGES[elem] || MESSAGES["토"];

    $("fpPillJuga").textContent =
      "일주 " +
      pillar.stemKo +
      pillar.branchKo +
      "(" +
      pillar.stem +
      pillar.branch +
      ")";
    $("fpPillElement").textContent = "오행 " + elem;
    $("fpPillZodiac").textContent = zodiac + "띠";
    $("fpPillYear").textContent = "2026 병오년 흐름";
    $("fpLine1").textContent = "① " + msgs[0];
    $("fpLine2").textContent = "② " + msgs[1];
    $("fpLine3").textContent = "③ " + msgs[2];

    const emptyEl = $("fpEmpty");
    const resultEl = $("fpResult");
    if (emptyEl) emptyEl.classList.add("hidden");
    if (resultEl) resultEl.classList.remove("hidden");

    const card = $("fpResultCard");
    if (card && card.scrollIntoView)
      card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function init() {
    const btn = $("fpRunBtn");
    if (btn) btn.addEventListener("click", run);
    const birthInput = $("fpBirthDate");
    if (birthInput) {
      birthInput.addEventListener("input", () => {
        birthInput.value = normalizeBirthDateInput(birthInput.value);
      });
      birthInput.addEventListener("blur", () => {
        birthInput.value = normalizeBirthDateInput(birthInput.value);
      });
      birthInput.addEventListener("paste", () => {
        setTimeout(() => {
          birthInput.value = normalizeBirthDateInput(birthInput.value);
        }, 0);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
