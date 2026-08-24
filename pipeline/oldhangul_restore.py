# oldhangul_restore.py — 한양PUA 옛한글 복원 (발주 2026-08-24 ③)
#
# 한양 사제 폰트의 옛한글은 유니코드 사용자영역(U+E000~U+F8FF)에 배치된다.
# 폰트가 없으면 화면에 아무것도 안 보이고, 검색·형광펜(indexOf)도 조용히 실패한다.
# hypua2jamo 로 **첫가끝(초성·중성·종성) 자모**로 되돌린다.
#   - glyph 육안 판독 금지. 매핑표(hypua2jamo)만 근거로 삼는다.
#   - 제로폭 6종은 게이트가 보는 집합과 동일하게 제거한다.
#
# 사용: python pipeline/oldhangul_restore.py <in.json> <out.json>
#       (표준출력에 통계 1줄 — 변환 실패 시 exit 1)

import io, json, re, sys

try:
    from hypua2jamo import translate
except ImportError:
    print("🔴 hypua2jamo 미설치 — pip install hypua2jamo", file=sys.stderr)
    sys.exit(1)

PUA = re.compile("[\uE000-\uF8FF]")
ZERO = re.compile("[\u200B\u200C\u200D\uFEFF\u00AD\u2060]")

stat = {"pua_in": 0, "pua_out": 0, "zero": 0, "fields": 0}


def fix(s):
    if not isinstance(s, str):
        return s
    n_pua = len(PUA.findall(s))
    n_zero = len(ZERO.findall(s))
    if n_pua == 0 and n_zero == 0:
        return s
    stat["pua_in"] += n_pua
    stat["zero"] += n_zero
    stat["fields"] += 1
    out = translate(s) if n_pua else s   # PUA → 첫가끝 자모
    out = ZERO.sub("", out)              # 제로폭 제거는 변환 뒤에
    stat["pua_out"] += len(PUA.findall(out))
    return out


def walk(o):
    if isinstance(o, str):
        return fix(o)
    if isinstance(o, list):
        return [walk(x) for x in o]
    if isinstance(o, dict):
        return {k: walk(v) for k, v in o.items()}
    return o


src, dst = sys.argv[1], sys.argv[2]
data = json.load(io.open(src, encoding="utf-8"))
out = walk(data)
json.dump(out, io.open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(
    f"fields={stat['fields']} PUA {stat['pua_in']}→{stat['pua_out']} "
    f"zerowidth-removed={stat['zero']}"
)
if stat["pua_out"] > 0:
    print("🔴 PUA 가 남았다 — 매핑표에 없는 글자다. 원본 대조가 필요하다.", file=sys.stderr)
    sys.exit(1)
