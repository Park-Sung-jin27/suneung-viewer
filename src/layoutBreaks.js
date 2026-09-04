// 줄 구분 규칙 — 단일 정본 (발주 F-56)
//
//   프론트 렌더와 파이프라인 게이트가 같은 규칙을 봐야 한다.
//   marker_chars.json 에 ㉯~㉲ 가 빠져 게이트가 5개 중 1개만 본 사고가 있었다.
//   규칙이 QuizPanel.jsx 안 모듈 스코프 상수로 갇혀 있으면 같은 형태가 반복된다.
//   ★ 이 파일 하나가 정본이다. 규칙 확장·수정은 여기만 고친다.
//
//   ★ 의존성을 두지 않는다. 파이프라인(Node)이 그대로 import 하므로
//     순수 상수·순수 함수만 담는다 — api/pro-data.js → src/freeAccess.js 전례와 같다.
//   ★ vercel.json 은 손대지 않는다. 정적 ESM import 는 node-file-trace 의
//     본업이라 includeFiles 가 불필요하다(0937c70 에서 확인·revert 된 사안).

// 발주 F-55: 지면 조판 줄바꿈과 의미 경계 줄바꿈을 가른다.
//   데이터의 개행에는 두 종류가 섞여 있다.
//     ⑴ 의미 경계 — "선생님 :", "학 생 :", "∙㉮ :" 앞의 줄바꿈. 살려야 한다
//     ⑵ 조판 줄바꿈 — 지면 폭 때문에 문장 중간이 끊긴 것. 합쳐야 한다
//   각주(* ※)도 ⑴ 이다. F-55 최초본이 이를 빠뜨려 문자열 보기 4건에서
//   각주가 본문 뒤에 붙었다 — 후속에서 보존 목록에 넣어 되돌렸다.
//   white-space: pre-wrap 을 그냥 주면 ⑵ 까지 재현해 좁은 화면에서 문장이
//   엉뚱한 자리에서 끊긴다. 그래서 렌더 직전에 ⑵ 만 공백으로 접는다.
//   ★ 원본 데이터는 건드리지 않는다 — 렌더 시점 변환이다.
export const KEEP_BREAK_RE =
  /^\s*(?:(?:선생님|학\s*생|학생\s*\d?|사회자|진행자)\s*[:：]|[∙·•▪]?\s*[㉠-㉤ⓐ-ⓔ㉮-㉲]\s*[:：]|[*※])/;

// 발주 F-57: 화자 이름을 목록으로 열거하면 새 회차마다 빠진다.
//   대신 「블록 안에서 같은 형태가 반복되는가」로 판정한다.
//     1패스 — RE_NAMED 에 맞는 줄을 센다 (첫 줄 포함)
//     2패스 — 2회 이상이거나 씬 표기가 있으면 그 줄들을 보존한다
//   1회만 나오는 「상태1의 출력값:」 같은 항목 라벨은 접힌다 — 반복 조건이 거른다.
//   ★ KEEP_BREAK_RE 는 반복 조건 없이 먼저 검사한다. 확장은 상위집합이라
//     기존 보존(선생님·학 생·원문자·각주)을 잃지 않는다.
//   ★ 판정식은 pipeline/set_intake_gate.mjs 와 한 글자도 다르면 안 된다.
//     그래서 여기서 export 한다 — 게이트가 지역 정의 대신 이것을 import 한다.
//     (marker_chars.json 에 ㉯~㉲ 가 빠져 게이트가 5개 중 1개만 본 사고의 재발 방지)
export const RE_NAMED = /^\s*[가-힣A-Za-z0-9()·\s]{1,12}[:：]/;
export const RE_SCENE = /^\s*S#\s*\d/;

// 이 블록이 대화형인가 — 게이트와 프론트가 같은 답을 내야 한다.
export function isDialogueBlock(lines) {
  const named = lines.filter((l) => RE_NAMED.test(l)).length;
  const scene = lines.some((l) => RE_SCENE.test(l));
  return named >= 2 || scene;
}

export function foldLayoutBreaks(text) {
  if (typeof text !== "string" || !text.includes("\n")) return text;
  const lines = text.split("\n");
  const dialogue = isDialogueBlock(lines);

  let out = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const keep =
      KEEP_BREAK_RE.test(line) ||
      (dialogue && (RE_NAMED.test(line) || RE_SCENE.test(line)));
    if (keep) {
      out += "\n" + line;
    } else {
      const tail = line.replace(/^\s+/, "");
      out += (out.endsWith(" ") || tail === "" ? "" : " ") + tail;
    }
  }
  return out;
}

// 발주 F-55 후속: 정규화가 주석 검색어를 갈라놓으면 밑줄이 통째로 사라진다.
//   모든 ann 이 정규화본에서 여전히 발견될 때만 바꾸고, 하나라도 못 찾으면 원문을 쓴다.
//   문자열 보기와 객체형 보기(.text)가 같은 장치를 쓴다.
export function foldIfAnnSafe(text, anns) {
  const folded = foldLayoutBreaks(text);
  if (folded === text || !Array.isArray(anns) || anns.length === 0) return folded;
  const safe = anns.every((a) => {
    const needle =
      a.type === "blank-box"
        ? (a.marker ?? (a.label ? `[${a.label}]` : null))
        : a.text;
    return !needle || folded.includes(needle);
  });
  return safe ? folded : text;
}

