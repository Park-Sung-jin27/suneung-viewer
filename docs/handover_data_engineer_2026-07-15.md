# 인수인계 발주서 — 데이터 엔지니어 (2026-07-15)

> 인계자: 데이터 엔지니어 세션(컨텍스트 소진). 인수자: 신규 데이터 엔지니어 세션.
> **진입 시**: CLAUDE.md → docs/current_state.md → ops/employees/data_engineer/CLAUDE.md → 본 문서 순으로 read.
> **git 상태 수치는 본 문서에 기재하지 않는다** (기재 즉시 stale — 2026-07-17 오보 실증). 커밋·워킹트리 상태는 착수 시 실사로만 확정.

---

## 0. 지금 당장 처리할 것 (인수 직후)

1. **git 상태 실사 (수치 신뢰 금지 — 본 문서에 기재된 커밋 수·해시는 전부 무효로 간주)**:
   - `git fetch origin` → `git log --oneline origin/main..HEAD` → **미푸시 커밋을 눈으로 세고, 커밋별 `git show --stat`으로 건드린 파일까지 확인**.
   - **push 승인은 커밋 단위가 아니라 실제 범위 단위**: 승인 문구가 "N파일 단독"인데 그 위에 후속 커밋이 얹혀 있으면 `git push origin main`은 **승인 범위를 넘겨 배포**한다. 범위 초과 시 push 전에 대표께 불일치를 보고할 것.
   - **Code A(프론트/토스) 동시 push 금지** — 심사관 순서 조율.
   - **배경**: 2026-07-17, 인계자가 "미푸시 1건 / 워킹트리 clean"으로 보고했으나 실사 결과 **미푸시 3건**(뒤 2건은 LIVE `annotations.json`) + **워킹트리 미커밋 13건+**. 실사 없이 push했다면 미승인 LIVE 배포였다.
2. **심사관 회신 대기 2건**:
   - **annotation 누락 225세트 = 별도 트랙 발주 여부** (아래 §3-A 최우선 미결).
   - 1차 배치(2026수능) 착수 전 **2026수능 marker annotation 보강 선행 여부**.
3. **크레딧 0** — LLM 재생성 전면 불가(HTTP 400 "credit balance too low"). 충전 전까지 v2 확산 착수 불가.

---

## 1. 현 상태 (배포 완료)

> **git 상태(origin/main 해시·미푸시 수·워킹트리)는 여기 기재하지 않는다.** §0-1 실사 명령으로 확정할 것. 아래 표는 게이트 측정치만.

| 지표 | 값 |
|---|---|
| release 게이트 | **CRITICAL 0** (검사 스코프 세트 225 / 문항 875 / 선지 4375) |
| 전수 분모 | 세트 353 / 문항 1365 / 선지 6825 |
| 선지 역순 오학습 | **0** (7 reversal 전부 정정·배포) |
| 어휘 pat 오분류(독서) | **0** (144선지 정정) |
| V-dirty (pat=V && cs) | **0** (cs_ids 23 + cs_spans 71 = 94선지 정정) |

### 이번 회기 배포분 (핵심)
- **선지 역순 7문항 재구축**: l2024b Q26 · r2023a Q3 · l2023b Q22 · l2023c Q29 · r2022d Q17 · l2022b Q24 · l2022d Q32. (정답 번호가 틀린 선지를 가리키던 오학습 — 전부 시험지順 재정렬 + ok 재배정 + v2 해설 2건씩.)
- **게이트 신설**: `W_annotation_stale` · `W_bracket_collapse` · `W_choice_anno_stale` · `W_bogi_anchor` · `W_analysis_marker_mismatch` · `C_vpat_dirty 전수 승격` · `structure Layer3(위치-민감 선지 대조 + 전문 char-match 재확인)`.
- **T1 분모 의무화 5게이트**: quality_gate · answer_fidelity · structure_fidelity · passage_fidelity · haesol_v2_gate. `검사 스코프: 세트 S / 문항 Q / 선지 C → 위반 M건` + `SCOPE_EMPTY(S==0 → exit 1)` + release `S≠RELEASE_KEYS → ERROR`.
- **v2 파이프라인**: `config/step3_prompt_v2.txt`(정본 프롬프트) · `pipeline/haesol_v2_gate.mjs`(6축 harness) · `pipeline/marker_context.mjs`(마커 범위 주입 — **배포 여부는 §0-1 실사로 확인**, 본 절의 "배포분"에 push 완료를 함의하지 않음).
- **CLAUDE.md §2 완화**: 자동 해설 재생성 = 허용(조건 a 정본 프롬프트 · b 6축 CRITICAL 0 · c 대표 검수 후 push).

---

## 2. 대기 트랙 (우선순위順)

### ⓑ v2 확산 — FREE 806 한정 【크레딧 대기·최우선】
- **범위 확정**: FREE(2022~2026수능) **39세트 / 806 구형선지**만. **LIVE Pro 3,525 · 비노출 2,430 = 별도 승인 전 착수 금지**(유료 사용자 0).
- **배치**: yearKey 1개 = 1배치 = 1커밋. 순서 **2026(7세트/155) → 2025(8/170) → 2024(8/153) → 2023(8/164) → 2022(8/164)**.
- **1차 필수 산출 = 실단가 측정**: 155선지 실소모 토큰 → 선지당 단가 → FREE 806 완주 예산 추정. **이 수치 없이 2차 착수 금지.**
- **인계자 권고(미승인)**: 1차를 1세트(20선지)로 쪼개 선단가 측정 후 잔여 6세트 진행 — 예산 초과 위험 완화.
- **배치마다**: 정본 프롬프트(a) → `haesol_v2_gate` 6축 100% PASS(b) → 대표 표본 검수(1차 10선지·2차부터 5선지)(c) → quality_gate release CRITICAL 0 · answer_fidelity 0 · 결론줄=ok → gate↔push 분리 → 대표 승인 push → 배포본 확인(§13⑯).
- **인벤토리**: `scratchpad/v2_inventory.json`(353행: yearKey·setId·LIVE·문항·선지·분류). **세션 임시** — 필요 시 재생성(아래 §5 명령).
- v2 현황: **v2 완전 적용 1**(`2026수능::r2026a` 15/15 = 검증 기준선) / **부분 v2 8**(r2024d 15/30 + 7 reversal 각 2선지) / 미적용 343 / 해설없음 1(`2016_9월B::r20169b`).

### ⓐ 2014수능A LIVE 10세트 시각 직독 【보류 — 대표 판정】
- `2014수능A`(l2014a~e·r2014a~e) = **image-only PDF**(추출 1,267자) → **어떤 자동 게이트로도 본문·구조 검증 불가한 유일 라이브 구간**.
- 대표 판정: **보류**(Pro 구간·유료 사용자 0. 게이트가 매 실행 SCOPE_DIFF로 노출하므로 유실 위험 없음).
- 재개 조건: Pro 유료화 전 또는 대표 지시.

### ⓒ passage_fidelity 정규식 → robust 파서 통일 【승인·저우선】
- `pipeline/passage_fidelity.mjs:37` — RELEASE_KEYS를 **정규식**으로 파싱(§13⑫ 사고와 동일 취약 패턴). **현재는 225개 정확 판독 = 사고 아님·예방 대상**.
- 조치: `quality_gate.mjs:200` 의 robust `indexOf("])")` 파서 재사용. **T3(v2 확산) 이후** 처리.

### 기타 잔여
- **T1-b partial 4건**: 심사관 시험지 전문 대조로 **전부 FP 확정** → Layer3 char-match 재확인으로 자동 소거 완료. **추가 조치 불요**.
- **문학 5선지**(l2022d Q34c3=L2 · l20159c Q44 c1/c2/c4/c5=L5): 심사관 판정 **L*(보기/문학) 확정 = V 아님**. harness 문학 제외 반영됨. **재론 금지**.
- **Layer2 구조 의심 18문항**(sim<0.6): 보기·그래프 별블록 추출 artifact로 특성화(문항 시험지 실재 확인). 저순위.
- **W_bogi_anchor 160 backlog**: 구 해설이 보기를 paraphrase(§7 verbatim 미달). v2 재생성으로 해소 예정(T3 흡수).
- **오결론 B 14선지**: 🔍가 ok와 반대 논증(해설 재작성 필요). v2 롤아웃 흡수 후보.
- **r2024d Q14~16**: 보기·㉠㉡ 복잡 문항 — 옵션 A(자동 API) 재실행으로 30/30 완결 대기.

---

## 3. 최우선 미결 (심사관 회신 필요)

### A. annotation 누락 225세트 【v2 확산 선결의 선결】
- **`685d362`로 주입 경로는 완성**(annotations.json → `[마커 범위 — 정본]` payload 블록 + 프롬프트 규칙 10).
- **그러나 데이터가 62% 부재**:
```
전수: 마커 문항 572개(2,860선지) 중 → 범위 주입 216 / 범위 정보 없음 356(1,780선지)
FREE: 마커 문항  71개(  355선지) 중 → 주입  44 / 범위없음 27
K 목록 = 225세트 (l2026b Q24[㉠~㉣]·l2026c Q30[㉠~㉤]·r2024c Q9·Q11[ⓐ~ⓔ]·r2025c Q13 …)
```
- **의미**: 1차(2026수능) 착수 시 l2026b Q24·Q25·l2026c Q30 등은 "범위 정보 없음"으로 생성 → 그 마커의 구체 어구를 못 짚음(안전하나 해설 깊이 저하).
- **결정 요망**: (1) annotation 보강 트랙(legacy 직원) 선행 여부 (2) 최소 2026수능만 보강 후 1차 착수 여부.
- **절대 금지**: 범위 없는 마커를 추측 주입 — 그것이 원 결함(§7.4).

---

## 4. 이 회기에서 확립된 규율 (반드시 승계)

### 커밋·push (§4 인시던트 3회 실증)
1. **`git add .` / `-A` / `commit -a` 전면 금지** — 항상 `git add <정확한 경로>`.
2. `git commit`은 **인덱스의 모든 staged**를 커밋 → **커밋 전 `git diff --cached --name-only`로 본인 파일만인지 확인**.
3. **stage→commit atomic**(같은 턴). staged 상태로 턴 넘기지 말 것.
4. **push 전 `git log --oneline origin/main..HEAD` 범위 실사** — divergence 숫자만 보면 안 됨. **본인의 대표-승인-대기 커밋도 얹혀 조기 배포됨**(실증: `875c131`).
5. **`.git/index.lock`**: 강제삭제 금지가 원칙. 단 **소유자=심사관 샌드박스 + 0바이트 + 수시간 경과 = 고아**로 판정되면 심사관 승인 후 `rm -f`. 네이티브 git lock(대표 계정)과 구분.
6. **Code A(프론트) 동시 push 금지** — 심사관 순서 조율.

### 데이터 편집
- **§13⑪ git-object 우회 강제**: `git cat-file -p HEAD:<path> > $TMP/x.json` → 편집 → `cat $TMP/x.json > <path>` → readback → `git add <path>`. mount plain read+write 금지.
- **`git show | node` stdin 파이프 금지**(멀티바이트 U+FFFD 손상) — 파일로 받아 `fs.readFileSync`.
- **§13⑭ 3계층 정합**: sent.t 수정 시 cs_spans.text·analysis(📌) 동시 치환 + 잔존 0 grep.
- 적용 후 **`only <setId> changed` + `U+FFFD 0`** 검증 관행.

### 검증 (§13⑮ — 이번 회기 핵심 교훈)
- **"N=0 clean"은 분모 없이는 무효 신호**. 오늘 거짓 clean 6건. 3유형 = **스코프 붕괴 / 매처 협소 / 판정축 누락**.
- 실증: ① `passage_fidelity` 빈 RELEASE로 "라이브 0 클린"(§13⑫) ② `isVocab` regex가 "바꿔 쓰기에 **가장** 적절"·"**가장 가까운 의미로** 쓰인"을 못 잡아 63선지 누락 ③ `C_vpat_dirty`가 cs_ids만 봐서 cs_spans 71선지 거짓 0.
- **원칙**: 판정식은 **결함 클래스만큼 넓게**(발문 매처 의존 최소화) · "0" 선언 전 **독립 매처 교차검증** · **worklist 방향 점검**(pat≠V 목록은 pat=V+cs 잔존을 구조적으로 놓침).
- **§13⑯**: 파일 0 ≠ 화면 0. 배포본 렌더 육안 확인까지가 완료(cs_spans가 렌더된다는 이번 사례가 정확히 그 증거).

### 자가보고 금지
- 게이트 통과는 **스크립트 로그**로만 증명. "게이트 ✔" 자가보고 금지(심사관 실증 précédent).

---

## 5. 도구 인벤토리 (자주 쓰는 명령)

```bash
# 게이트 (분모 확인 필수)
node pipeline/quality_gate.mjs --scope=release   # release CRITICAL 0 + 스코프 225
node pipeline/quality_gate.mjs                   # 전수 353
node pipeline/answer_fidelity.mjs                # 정답↔정답표 (SCOPE_DIFF 사유별 출력)
node pipeline/structure_fidelity.mjs             # 발문·선지 구조 + Layer3 선지 순서
node pipeline/passage_fidelity.mjs               # 본문 포함도 (LIVE/비노출 분리)
node pipeline/haesol_v2_gate.mjs --sets=<yk>::<setId>[,...]   # v2 6축 harness

# v2 인벤토리 재생성 (세션 임시본 소실 시)
git cat-file -p HEAD:public/data/all_data_204.json > "$TMP/inv.json"
#   → 353세트 순회하며 analysis.startsWith("🎯")로 v2/미적용 분류 (본 문서 §2 수치 참조)

# 마커 범위 payload 확인
node -e 'import("./pipeline/marker_context.mjs").then(M=>console.log(M.buildMarkerBlock("2026수능","l2026a",<question>).block))'
```

| 자산 | 역할 |
|---|---|
| `config/step3_prompt_v2.txt` | v2 해설 생성 **정본 프롬프트**(구조 §2-A/B/C · 강제 10규칙 · pat 학생어 · few-shot 3종) |
| `pipeline/haesol_v2_gate.mjs` | 재생성 6축 검증(§2 인용·C_anchor·bogi_anchor·marker·cs_anchor·결론줄·DEAD·V-dirty·어휘pat·근거완전성) |
| `pipeline/marker_context.mjs` | annotations.json → `[마커 범위 — 정본]` payload 블록 (`685d362`에서 도입 — 배포 여부는 §0-1 실사) |
| `docs/haesol_structure_v2_proposal.md` | v2 구조 정본(대표 승인 2026-07-08) |
| `docs/haesol_quality_standard.md` | 해설 품질 rubric v1 |

---

## 6. 인계자 판단 (참고 — 승계자가 재검토할 것)

- **v2 확산의 실질 병목은 크레딧이 아니라 annotation 62% 부재**일 수 있음. 마커 범위 없이 생성하면 "범위 정보 없음" 처리로 안전하되, 해설이 마커 어구를 못 짚어 **v2의 핵심 가치(📌 정밀 근거)가 반감**. 1차 착수 전 최소 2026수능 annotation 보강을 권고.
- **분모 의무화(T1)가 이번 회기 최대 자산**. 앞으로 어떤 "0건" 보고도 분모와 함께 읽을 것. SCOPE_DIFF 경고(answer 345/353 · structure·passage 333/353)는 **결함이 아니라 도구 한계의 정직한 노출**.
- **7 reversal 정정이 이번 회기 최대 품질 성과**(정답 오지시 = 오학습 직결). 동종 결함(선지 순서·정답 매핑)은 Layer3가 상시 감시.
