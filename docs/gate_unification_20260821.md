# 게이트 단일화 — 결론: 승계 불필요 (발주 D-91 · 2026-08-21)

> **origin 판이 이미 완전판이다.** 공유 트리의 미커밋 게이트는 그보다 **옛 사본**이다.
> 승계할 것이 없다. 공유 트리 원본은 손대지 않았다.

## 확인 결과

`pipeline/haesol_v2_gate.mjs` 의 확장 함수 7개가 **origin 에 전부 있다**:

| 함수 | origin | 공유 트리 |
|---|--:|--:|
| `detectAnalysisPollution` (축5) | ✅ | ✅ |
| `detectFormatDefect` (축6) | ✅ | ✅ |
| `detectPatDomainMismatch` (축2 도메인) | ✅ | ✅ |
| `conclusionLineOf` · `detectStampMismatch` · `detectPatNullMismatch` · `detectNarrativeReversal` | ✅ | ✅ |

채택식도 동일하다 — origin `haesol_v2_gate.mjs:180`:
```js
const accept = stampOk && patOk && poll.clean && fmt.clean;
```

`quality_gate.mjs` 의 신축 2개도 **origin 에 이미 등재**돼 있고 실제로 잡는다:
```
F_markdown_emphasis_exposed: 9건
D_false_no_pat: 33건
```

## 그런데 왜 「미승계」로 보였나

`git diff` 를 **공유 트리 안에서** 떴기 때문이다. 공유 트리의 베이스는 `c398bb2`(8/11)이라
8/4~5 작업이 「미커밋 변경」으로 보이지만, 그 작업은 이후 **origin 에 정식 반영**됐다.
origin 은 거기에 8/20~21 작업(D-44·D-56·D-73 축)까지 더해진 **상위집합**이다.

### 실제로 벌어진 사고

공유 트리 판을 origin 위에 덮어썼더니 **origin 축 4개가 사라졌다**:
`OK_ANALYSIS_CONFLICT`(D-56) · `CS_SPAN_UNRESOLVED`(D-44) · `W_release_key_missing`(D-73) · `F_answer_reads_as_distractor`

판정이 **487 → 484로 줄어든 것**이 단서였다(축을 추가했는데 총계가 줄면 이상하다).
축별 비교로 소실을 찾아 즉시 원복했다. 그대로 뒀다면 이후 모든 병합 게이트가
검사 4개가 빠진 채 돌았을 것이다.

## 교훈 — 비교 기준을 먼저 못박는다

> **diff 는 반드시 `origin` 대비로 뜬다.** 작업 트리 안의 diff 는 그 트리의 베이스가
> 얼마나 낡았는지를 보여줄 뿐이고, 「최신인가」를 말해 주지 않는다.

승계·병합 작업에서는 착수 전에 **비교 기준(무엇 대비 무엇)** 을 명시한다.

## 현재 상태

- 게이트 3파일: **origin 판 그대로.** 승계도 수정도 하지 않았다.
- 국어 도구 4개(`choice_source_diff` · `choice_symbol_seq` · `para_derive` · `symbol_defect_grade`):
  origin 에 없던 신규 파일이라 가져왔다. 공유 트리 8/4~8/7 원작업의 **복사 승계이며 원본은 무접촉**이다.
- 공유 트리 미커밋 **162건**(컨설팅·영어·수학·모집요강 PDF 등)은 목록만 기록하고 하나도 건드리지 않았다.

## 남는 일 — 공유 트리 쪽

공유 트리의 게이트 3파일은 **되돌려도 되는 상태**(origin 이 상위집합)지만,
그 판단과 실행은 그 트리를 쓰는 세션의 몫이다. 여기서는 건드리지 않는다.
