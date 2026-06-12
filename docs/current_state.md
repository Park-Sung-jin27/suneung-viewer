# 현 진행 상황 — 2026-06-09 (일과 종결)

> **운영 메모 (2026-06-12)**: 컨설팅_데모 `js/scenario_engine.js` 4건 수정(① 수시 전형필터 ② 정시 capacity/모집단위 필터 ③ 학교명 오타 14종 정규화 ④ 분교 5종 지역연결 + 이름기반 region_index)이 수능 커밋 `23e367e`("기출 충실도…")에 **혼입된 채 push됨**. 변경 자체는 origin/main 반영 완료(손실 없음), 워킹트리=HEAD 동일. 원인=동시 세션 `git add .` 일괄 스테이징(§4 동시 push 금지 정황). 재발 방지: 커밋 시 파일 지정(`git add <경로>`), 동시 활성 채팅 시 한쪽만 push.


## 현황

| 범위 | 진척 | 비율 |
|---|---|---|
| **전체** | 350 set | 100% |
| 수능 22~26 | 40/40 release_ready 통과 | 100% ✓ |
| 모의 22~26 | 78/78 marker 정합 + annotation 정합 | 100% ✓ |
| LEGACY 수능 14~21 | 61/76 | 80% |
| LEGACY 모의 14~21 | 0/156 (cs_ids 자동/batch 170건 반영) | 0% (cs_ids 부분) |
| cs_ids 결함 (release_ready 1/4 위반) | 1075 → 887 (188 자동/batch 반영) | -17.5% |
| setId 충돌 33 set 안전화 | 영구 자산화 ✓ | |
| annotation None-None entries | 78건 정정 (60 target=bogi 매핑 + 18 정정) | ✓ |

---

## 오늘(06-03) 완료 sprint

### Sprint 1 — setId 충돌 안전장치 (도구 7개 + AuditPanel v4)

| 영역 | 변경 |
|---|---|
| cs_ids_recovery v3.0 | 전역 sentIndex 폐기 — set 내부 sents 기준 |
| cs_ids_apply v1.2 | findChoice yearKey+area 격리 + ambiguous skip |
| cs_ids_revert v2 | 동일 패턴 적용 |
| bracket_audit v2 | findSet yearKey 우선 검색 |
| visual_mark_extractor v2 | findSet yearKey 인자 |
| quality_gate v2 | --fix 시 annotations 백업 |
| step4_csids v2 | retarget + extract-spans 백업 |
| apply_para.cjs | archive 이동 |
| AuditPanel v4 | ?yearKey= 라우팅 + 충돌 선택 화면 |

### Sprint 2 — cs_ids C sprint (92건 반영)

- Phase 1 (자동 score=1.00): 8건
- Phase 2a (batch tier1 score=1.00): 66건
- Phase 2b (live 검수 score 0.5~0.84): 18건
- LEGACY 모의 영역 영구 반영

### Sprint 3 — viewer UI 정정

- QuizPanel showBadge 정정 — 학생 클릭 선지 + ok:false 만 PatternBadge
- V (어휘) pat 사양 추가 (constants.js) + QuizPanel V badge skip

### Sprint 4 — 메타 발문 audit + CLAUDE.md 룰

- 메타 발문 전수 audit (3 set 정정: r2022c Q10 / r2014aB Q16 / r20149f Q30)
- CLAUDE.md §6 메타 발문 예외 룰 추가
- 모의 22~26 ok:false+pat 누락 17건 정정

### Sprint 5 — 본문 marker 정정 (사용자 PDF 인용 협업)

| yearKey | 정정 |
|---|---|
| 2023_9월 | annotation 5 + cs_ids 1 + 본문 marker 11 (r20239b/c/d) |
| 2022_9월 | 본문 marker 20 + annotation 16 |
| 2024_6월 | 본문 marker 25 + Q34 ⓐ~ⓔ→㉠~㉤ + annotation 15 + bogi image |
| 2024_9월 | 본문 marker 17 + Q7/Q10/Q14 stem 정정 + annotation 15 |
| 2025_9월 | l20259b 본문 marker 8 + l20259c 본문 재구축 (16 sent 추가) |
| 2026_6월 | 본문 marker 16 + Q9/Q13 stem 정정 + annotation 11 |

### Sprint 6 — annotation None-None entries 정정

- l2025c 7 entries 정정 (5 underline → marker type + 본문 sent.t ㉠~㉤ 삽입)
- 60 None-None entries → target='bogi' + qId 매핑 (72건)

### Sprint 7 — CLAUDE.md 룰 정정

- §1.D 명확한 설명 강제 (결론 먼저 / 옵션 나열 X / 검증 sample 의무)
- §6 메타 발문 예외 룰
- §16 v1.3 변경 이력 추가

---

## 다음 액션 (우선순위)

1. **방향 결정 (대표)**: viewer 측 target='bogi' annotation 처리 (코드 변경) vs LEGACY 모의 14~21 진입 (156 set, 13개년 비전 path)
2. **LEGACY cs_spans 420건** — LEGACY 진입 시 본문 품질 검증과 함께 처리 (베타용 자동 스크립트 무검토 적용 금지)
3. **Phase 2b reject 9건 manual 정정** (PDF cross-check 의무)
4. 토스 페이먼츠 결제 연동 (심사 대기)

---

## 사업

| 항목 | 상태 |
|---|---|
| 토스 페이먼츠 | 심사 예정 |
| 모두의창업 | 심사 기간 진행 중 |
| Tally 베타 테스터 | 베타 출시 진입 완료 |
| FREE 5수능 (22~26수능) 40 set | 100% release_ready 통과 ✓ |
| 모의 22~26 78 set | 100% (마커 + annotation 정합 완료) |
| LEGACY 모의 cs_ids 자동/batch | 188건 영구 반영 |

---

## 미해결 사항 / 리스크

- **Cowork 환경 file 절단 결함**: Edit/Write 도구 사용 시 file 일부 잘림 결함 반복. cat heredoc 또는 cp 명령 path 우선 권고.
- **viewer 측 target='bogi' 처리 path**: schema 확장 완료, 코드 변경 의무 잔존.
- **LEGACY 모의 14~21**: 진입 개시 (06-05) — marker 1차 198건 완료. 잔존: marker 99건(2차)·구조 12 set·분포 14 set. 해설·cs_ids 생성은 구조 정합 완료 후 별도 결정(LLM 비용).
- **LEGACY cs_spans 420건** (dead 303 + text_miss 117): 베타는 0건 달성, LEGACY는 미착수.
- **para 보류 2 set** (r20249d·r20259d 내부 문단): 이미지 판독 신뢰 한계 — 검수 보드에서 경계 직접 지정 path 후보. 작품 구분·발문 결함은 06-05 정정 완료.
- **release_ready 기준 공백**: 발문·선지의 시험지 원문 일치를 검사하지 않음 — r2025b Q5 환각 문항이 기준 통과한 채 FREE 공개돼 있었음 (06-05 정정). 차기 gate 보강 후보 (PDF 원문 대조 자동화).

---

## 변경 이력

- **2026-06-09 — 2027_6월 출시 + LEGACY 수능 결함 종결**: 2027학년도 6월 정식 release(양쪽 목록+R3/V 22건 정박). LEGACY 수능 결함 set 재구축(r2014aB 문법 삭제·bB/cB/dB 전사·선지 절단 3 set 정답표 복원). 2027 Q6 3중 결함(마커 주체·해설 ㉮㉯ 인물 역전·cs) 정정. 중복 <보기> 라벨 전수 32건 제거+step2 본체 규칙. 완성도 실측: 베타 126 해설100%/cs98%, LEG수능 72 해설97%/cs91%, LEG모의 136 cs56%(해설 생성 미결). 다음 1순위=LEGACY 모의 해설 생성(대표 머신 LLM).

- **2026-06-07 — LEGACY 모의 구조·정합 전 단계 종결 (8 sprint)**: marker 2차 59건(fitz 좌표) / 중복 set 22개 dedupe(문항 보전 이관, 수능 3쌍 포함) / 구조 재구축 14 set(r20219e (나) 복원+Q23 이미지 보기 재구축·황만근 본문 교체·보리 placeholder 복원·r20169b Q21~24 정답표 복원) / 분포 14건 ok 반전 / bogi 누락 7건(표 판독 3·그림 추출 4) / PUA 표준화 225건(겹낫표 『』·옛한글 첫가끝 — 폰트 불요 확인) / LEGACY 독서 para 93 set / cs_spans 415건 재정박 → **전체 350 set 결함 0**. 베타: 2026_9월 Q17 데이터표·Q25 어휘 오판(isVocabQuestion 마지막문항 룰)·문학 순서 등 정렬 12곳·l20269b Q25 해설 재정박 5건·2027_6월 bracket [X] 5건(CRITICAL 0 회복). 잔여: LEGACY 해설·cs 생성(대표 결정)·수능 결함 8 set·para 28 set.

- **2026-06-05 (오늘) 7차 — 2027_6월 해설 개편 + LEGACY 모의 진입**: ① 2027_6월 해설 품질 개편 — ok:true 91건 전부 '근거→뜻풀이→선지 판정' 3단 서술로 재작성 (3~5등급 눈높이), 🔎 배제근거/정답비교 블록 170건 제거 (선지 해설 자립), Q6 ㉮㉯ 근거 라벨 교정, 문학 c5 페이지 푸터 4건 해소 + step2 tail-cutter 푸터 규칙 2종 본체 추가. 전수 원문 대조(정규화 substring) 신규 검수법 확립 — 검사기 오탐 3건 제외 실결함 전부 정정. ② LEGACY 모의 14~21 진입 — 1단계 전수 진단 (156 set 중 결함 88: marker 75 / 분포 14 / 구조 12 / 오염 1) + 2단계 marker batch 1차: PDF anchor 유일 매칭 198건 자동 삽입 (295→99건, 75→43 set, span 영향 0, 라이브 검증 ✓). 잔존: marker 2차 99건(fitz 좌표 정밀), 구조 12 set(본문 재구축), 분포 14 set(메타 발문 판별).
- **2026-06-05 (오늘) 6차 — para 미부여 종결**: fitz 좌표 기반 정밀 들여쓰기 추출(특수문자 『』󰡔󰡕 정규화 + y그룹 5pt)로 8 set 경계 회수·적용 — 베타 독서 para 커버 62/64. 추가 발견·정정: r20249d (가)(나) prefix 소실 복원, r20259d s1 발문 쪼가리 제거 + (나) prefix 복원 (둘 다 r20276b class). 잔존 2 set 내부 문단 = 보류 (무리한 추정 대신 검수 보드 직접 지정 path 권고). 사본 경유 적용 + suneung5 gate CRITICAL 0 유지.
- **2026-06-05 (오늘) 5차 — suneung5 CRITICAL 21건 종결 (FREE 공개 영역)**: ① **r2025b Q5 환각 문항 발견·전면 재구축** — 발문("개화에 대한 이해로 적절하지 않은 것은?")·선지 5개가 통째로 원문과 다른 상태로 공개 중이었음. 시험지 PDF 원문 교체 + questionType negative 정정 + 해설 5건 지문 근거 재작성 + 내부 ID 노출 5건 해소 (ok 분포는 정답표 ⑤ 정합으로 유지). ② bracket 14건 본문 [X] 복원 — workTag 단독 sent 삽입 (viewer 숨김 사양, 렌더 영향 0). ③ r2022c Q10 = 메타 발문 정상 데이터 확인 → quality_gate에 §6 메타 발문 예외 추가 (오탐 정정, 데이터 무수정). gate 결과: **suneung5 CRITICAL 0건 — release_ready 회복**. 작업 경로: sandbox all_data 캐시 결함 우회 위해 사본(pipeline/test_data/all_data_working.json) 경유 + 역복사. 발견된 기준 공백: release_ready가 발문·선지 원문 일치 미검사 — 차기 gate 보강 후보.
- **2026-06-05 (오늘) 4차 — 2027_6월 검수 + 추출 자동화 본체 반영**: ① annotation 0건 상태 발견 → PDF 도형 좌표(fitz line/rect) + 고해상 crop 판독으로 46건 신규 (밑줄 41 멀티라인 포함 + bracket 5: 나룻배[A]·홍길동[A]·만전춘[A][B][C]). ② 해설 내부 ID 노출 11건 제거 + 보기 유형 라벨 11건 (§7 정합). ③ 구조 검수: 발문 sent 혼입 4 + 페이지 노이즈 2 제거, 문학 title 4건 작품명 추출, verse/workTag/author/footnote 분류, (가)(나)(다) 6건 삽입 + 독서 r20276b (가)(나) prefix 복원, para 캐시 직접 부여(재머지 보존). ④ **본체 자동화**: step2_postprocess.cleanSentStructure 신설 (발문·노이즈·분류·verse 추정·title 추출 — 백업본 검증으로 수동 정정과 대등 확인) + step2_extract "(가)" 3자 필터 소실 결함 수정. 잔여 차기 과제: 독서 marker 오염 자동 검증, annotation 자동 초안 도구화, 연(stanza) 스키마(대표 결정). 라이브 검증 완결 (만전춘 set: workTag+bracket+verse 렌더 ✓).
- **2026-06-05 (오늘) 3차 — 신규 시험 진입 + 문단 기능**: ① **2027_6월 진입 완료** (8 set, 라이브 검수 모드 노출): 정답표 PNG 신형식 — step1_answer.js 본체 PNG/JPG/WebP 지원 추가, PNG 추출 34문항 = AI 직접 판독과 100% 일치. step2 독서 4 set Gemini 경로 marker 오염 (①ⓕⓖ 오염·한 칸 밀림·㉮㉯ 소실) → 시험지 PDF 대조 전수 정정 + 재정박 14건, 최종 본문=문항 marker 4/4 정합·정답 34/34·치명 0. 문학 4 set = pdf-parse 경로 원본 보존. 원천 PDF·PNG `_done/2027_6월/` 보관. release_status 미지정 = 학생 비노출 (release 전환은 검수 후 대표 결정). ② **독서 문단 기능 출시**: `pipeline/para_assign.mjs` 영구 도구 (PDF -layout 들여쓰기 기반 경계 추출 + --bounds 옵션) + 베타 독서 51 set + 2027_6월 3 set para 부여 + PassagePanel 문단 들여쓰기 렌더 + QuizPanel 'N문단' badge 활성화 (해설 무수정). para 미부여 12 set = 수동 목록 (r2022d/r20256d/r20229d/r20239d/r20259c/r20259d/r2024c/r20249c/r20249d/r20249a/r20276d 등 — (가)(나) 복합·본문 결함 set). ③ Gemini 크레딧 소진 1회 (충전 후 재개). 환경 결함 추가 기록: host 쓰기 파일의 sandbox 캐시 절단 (Edit 도구·사용자 머신 node 쓰기 모두 해당) → 해당 파일 commit·검증은 대표 머신 path 의무.
- **2026-06-05 (오늘)**: 오염 글자·marker 누락 잔존 sprint — 회기 시작 검수에서 ⑦계열(⑥~⑪) 오염 글자 class 발견 (기존 검출기 공백: ㉠ⓐ㉮ 계열만 탐지). 베타 전수 스캔 후 9 set 정정: l20246a Q20 (stem '과에 대한' + ⑦①→㉠㉡ + body ㉠㉡ 삽입) / l20246b Q23 (⑦~⑪→㉠~㉤ + body 5건 삽입, s27 '큰'=㉣ 오독 정정) / l20246c Q29 (⑦→㉠) / l20256a Q20 (③⑥→ⓐⓑ + 선지 번호 prefix 제거 + body ⓐⓑ 삽입) / r20266c Q11 (marker 한 칸 밀림 — ⑦→㉠, ㉠→㉡ swap + body ⑦·㉡ 오염 3건 정정 + ㉡ 정위치 삽입) / r20226b Q7 (㉡ 4건 drop) / r2023a Q3 (ⓔ→㉠ + body ㉠ 삽입) / l20259a (body ㉠ 삽입) / l20249c (원미동 시인 — ⓓ 누락으로 화자 marker 한 칸 shift: ⓓ 삽입 + ⓓⓔⓕ→ⓔⓕⓖ + Q29 stem 'ⓐ~ⓖ' + 선지·해설 재구성, 정답표 ④ 정합). 이미지·도식 보기 내 marker 4건 (r2025c/r2023d/r20246a/r20246c) = 정상 판정. 베타 span 0건 유지, 손댄 yearKey QG CRITICAL 신규 0.
- **2026-06-04 4차**: cs_spans 잔존 138건 종결 — PDF 대조 분류 (본문 누락 0건 확인 / 인용 의역·표기 차이) 후 재정박: LCS 정규화 v2 (한자 병기 괄호 제거 + 인용부호·쉼표 무시) 자동 133건 + 수동 5건 (따옴표 종류 차이 3 / 쓰레기 조각 삭제 1 / l20266c s51 ㉥ 오염 글자 본문 정정 1). **베타 영역 cs_spans 결함 0건 달성** (dead 0 / text_miss 0). 안전 규칙: 동일 문장 재정박 또는 일치율 0.85+ 한정, 전 건 원문 substring 검증. LEGACY 420건 잔존 (별도 sprint). suneung5 QG CRITICAL 21건 동일 (신규 0).
- **2026-06-04 (오늘) 3차**: cs_spans 무결성 sprint (베타 영역 15 yearKey) — dead sentId 참조(구 포맷 r20236d_s* / l2024_18_21s* / l202311as* 등) + 인용 text 불일치 전수 정정. 정규화 매칭(marker/인용부호/공백 무시 → 원문 substring 복원) 기반 자동 정정 1,107건 (remap 811 + text 재계산 233 + 전체탐색 41 + fragment 22). 베타 잔존 1,245→138 (-89%) — 잔존분은 본문에 해당 구절 부재(고전 표기 차이·본문 축약) = PDF cross-check 의무 needs_human. LEGACY 420건 미착수 (별도 sprint). suneung5 quality_gate CRITICAL 21건 동일 (신규 0). 백업: pipeline/backups/all_data_204.before_span_fix_20260604.json
- **2026-06-04 (오늘) 2차**: 잔여 yearKey 16건 sprint — PDF 직접 대조 path (사용자 인용 불필요 확인). 2023_6월: r20236d ⓐ~ⓔ 5건 + l20236c ㉠ + l20236d ㉠㉡ⓑⓒⓓⓔ 6건 + Q29/Q30 stem·선지 글자 오염 정정 + Q29 c2~c5 해설 재작성 (referent 오류). 2026_9월: l20269a ㉠㉡㉢ + **Q19 발문 유형 정정 (부정→긍정, 정답표 ① [Confirmed]) + ok 5건 재배정 + 해설 5건 재작성** + l20269b ㉠~㉤ (㉮ scheme 폐기) + Q25 정정 + l20269c ㉡㉢㉣㉤ (ⓕⓗⓘ 오염 글자 정정) + r20269c Q13 ⓐ~ⓔ. 2022_6월: r20226a ㉠ + r20226d Q17 빈칸 ㉮㉯㉰ 재구축 (선지 ①④ 방향 오염 정정, 정답표 ② 정합) + r20226c Q10 questionType 정정 (발문 부정형). 3 yearKey quality_gate CRITICAL 0건 (잔존 bracket 의심 11건 = 사전 존재). 신규 발견 결함 class: cs_spans dead sentId 참조 (r20236d_s* / l20236es* / l202311as* 포맷 위반 + 인용부호 오염) — 2023_6월 집중, 별도 sprint 의무.
- **2026-06-04 (오늘)**: 2025_6월 4 set 정합 sprint — 본문 marker 10건 삽입/정정 (r20256a ㉠㉡ / r20256c ⓐ㉠ / r20256d ⓑⓒⓓⓔ㉠) + stem/선지 marker 오염 정정 (Q2/Q3/Q10/Q15/Q17/Q33) + r20256c Q10 ④⑤ 선지 방향 반전 정정 + r20256d Q14 6지선다 결함 정정 (phantom 선지 삭제 + 정답 ④ ok 재배정 — 정답표 PDF [Confirmed]) + 해설 anchor 오류 재작성 (Q17 c3/c4/c5, Q2 c1/c5) + pat 2건 정정 (Q2 c1 R3→R4 / c5 R3→R1) + annotation 12건 추가 (box 에이어 + bracket A 포함) + 2건 정정. quality_gate 2025_6월 CRITICAL 0건. 사용자 미명시 영역 (r20256c ⓐ / r20256d ⓕ / l20256d ⓒⓓⓔ) = 시험지 PDF 대조로 전부 해소 (ⓕ·ⓒⓓⓔ는 실존하지 않음 확인).
- **2026-06-03**: setId 충돌 안전장치 sprint (도구 7개 + AuditPanel v4) + cs_ids C sprint 92건 + QuizPanel showBadge + V 사양 + 메타 발문 audit 3건 + 모의 22~26 pat 17건 + 본문 marker 6 yearKey 정정 + annotation None-None 78건 + l2025c marker type 정정 + 60 entries target=bogi 매핑 + CLAUDE.md §1.D §6 §16 룰 추가.
- 2026-05-31: cs_ids 영구 자산화 + 진단 도구 v2 보강 + 검수 보드 v3.1+v3.2 + B sprint duplicate_sentid 재매핑 + 모의 22~26 marker batch 16 set + stem/선지 환각 12 set + annotation 15 set + 96건 cs_ids 자동 반영. 베타 출시 진입.
- 2026-05-28: 181 set RELEASED. UX W2/W3. 모의 78 set + LEGACY 수능 61 set 전환. release_ready 6기준 도입.
- 2026-05-26: W1 완료. FREE 100% release.
