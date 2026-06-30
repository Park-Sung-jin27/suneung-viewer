# 현 진행 상황 — 2026-06-30 (일과 종결)

## 2026-06-30 세션 (Code B) — 출시 정합 sprint

### 완료 (push)

- **CS_ALL_NONHIGHLIGHTABLE 트랙 종결**: 발주 28 = 20 정정(A 2·B 7·C 11) + 8 백로그(l2015bB (나) 누락) + 게이트 신설로 발견한 29번째 r20169a 정정 → **release CS_ALL = 0**.
- **마커 트랙 종결**: 진짜 body 마커 3 set 정박(r20259d ⓐ~~ⓔ+㉠·r2016cB ⓐ~~ⓔ·l20149a ㉠) + 게이트 refine 2종(발문 "<보기>의/학습 활동의 [마커]" credit·보기 텍스트 범위 전개) + l2014d bogi 도식 명시 → **release MARKER_INTEGRITY 마커 0**(잔존 = bracket).
- **충실도 정정**: r20259c Q8(학습지 ○/X 선지 1·5 garbled), r2019d Q27(독서기록 점검 표 전면 환각 재구축). 둘 다 페이지 이미지 직독.
- **BOGI_IMAGE_MISSING 게이트 신설**(CRITICAL) + r20236a Q2 매튜효과 도식 이미지 복원(LIVE 답-불가 해소).
- **bracket 단일 [A] 6/10**: r2019d s16~~18·r20199a s20~~21·r20209b s5~~10·r20209a s38~~41·l20249d s19~~31·l2020a s5~~12 (annotations.json, b935417·50cb98d).

### 5 충실도 게이트 release 잔여 (원문 100% 단조감소 추적)

| 게이트                    | release 잔여             | 비고                                                                                          |
| ------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| answer_fidelity           | **0**                    | 정답 불일치 0 (13개년)                                                                        |
| passage_fidelity          | **0**                    | 라이브 본문 의심 0 (56 비노출·2014 image 제외)                                                |
| structure_fidelity Layer2 | 출시 ~4 (전부 FP/Phase3) | 진짜 2(Q8·Q27) 정정 완료. 잔존=l20156b A/B·r20219e(보기-참조 sim FP)·2014_9월A r20149b(image) |
| MARKER_INTEGRITY          | **51**                   | 마커 0 + bracket 51(=구간 형광펜 백로그)                                                      |
| CS_ALL / BOGI_IMAGE       | **0 / 0**                |                                                                                               |

### 잔여 발주 (다음 세션 인계)

1. **bracket 단일 [A] 4건 미완**: l20216d·l20166d·l20176b·l20216c — 지문 [A]가 문항 **앞 지문 페이지**에 위치(발문/선지/보기 [A]와 분리). [A] 텍스트가 PDF 전반 30+회 출현 + 작품명 anchor PUA/옛한글 미추출 → **자동 위치 실패**. **passage-page 수동 식별**(지문 페이지 렌더 후 [A] 괄호 육안) 필요.
2. **bracket [A][B] 8 set + [A]~E 문학 5 set**(l20156a·l20166a·l2016e·l2016bB·l2019a) — 별도 발주.
3. **비노출 text 환각 worklist** (render 직독 진행중):
   - **structure 비노출 triage 완료**: 2017_9월 l20179a/b/c(10문항)=**FP**(직접구성요소 문법, 내용 시험지 일치) · l20206a Q24=**FP**(coherent) · **r20256d Q14=진짜(완료)** — 학습활동지 선지에 해설+sentId 누출 garbling → 재구축 push(7fb795b).
   - **passage 0~0.2 triage**: r20256d s21 '전전→전건' 오타(486be11). **⚠️ l2025d(=LIVE! passage_fidelity가 비노출 오분류) 갑민가 = 미세 오타 클러스터 확정**: s211 '현→헌 잠방이'·s229 '빚기→빗기 차고' 시험지 직독 교정(7ccbb5c). **포함도 0이 옛한글 FP가 아니라 실제 오타였음** — 나머지 대사(l20226a·l2020b·l2020c·l20166b)는 구어 변형 추정(미확정).
   - **🔴 다음 세션 1순위: l2025d 갑민가 전체 line별 PDF(2025수능 page10~11) 대조** — 2건 외 추가 미세 오타 가능(LIVE 출시 set, 학생 노출). 포함도 0 클러스터 전수.
   - **passage_fidelity 비노출/release 오분류 버그**: l2025d가 RELEASE_KEYS에 있는데 passage_fidelity는 비노출로 표기 → 도구 release 판정 소스 점검 필요.
   - **잔여**: passage 0.2~0.85 비노출 다수(옛한글/verse 정상 변형 대부분) — 최저순 끊어 진행.
4. **structure-번호 트랙 (text 환각 아님)**: 2017_9월 l20179a/b/c = 직접구성요소 **문법** set인데 데이터 Q16~~19 라벨. 시험지 렌더는 Q11~~14, 정답표상 문법은 Q11~~15 영역(독서 16~~) → **데이터 +5 오추출 강력**(LEGACY Q16~~34 관례 위반). 내용 정상이라 우선순위 낮으나 원문 번호 정합 위해 별 트랙 정정 대상(데이터 16~~19 → 11~14 재배정 검토).
5. **r2014e Q30 보기표** PDF 대조 + 해설(patch 대기, patch_r2014e_recon.json 지시 4·5).
6. **l2015bB (나) 유한라산기 본문 누락 복원**(비노출, _done/2015수능B PDF 전사).

### 운영 강화 (이번 세션 확립)

- 게이트↔push 분리 준수 / 데이터·도구·이미지·annotations **단독 push**(fortune 가드) / 표·학습지·도식 문항은 **페이지 이미지 직독이 유일 검증법**(pdftotext 불가).

---

# (이전) 현 진행 상황 — 2026-06-22 (일과 종결)

> **운영 메모 (2026-06-12)**: 컨설팅\_데모 `js/scenario_engine.js` 4건 수정(① 수시 전형필터 ② 정시 capacity/모집단위 필터 ③ 학교명 오타 14종 정규화 ④ 분교 5종 지역연결 + 이름기반 region_index)이 수능 커밋 `23e367e`("기출 충실도…")에 **혼입된 채 push됨**. 변경 자체는 origin/main 반영 완료(손실 없음), 워킹트리=HEAD 동일. 원인=동시 세션 `git add .` 일괄 스테이징(§4 동시 push 금지 정황). 재발 방지: 커밋 시 파일 지정(`git add <경로>`), 동시 활성 채팅 시 한쪽만 push.

## 현황

| 범위                                 | 진척                                              | 비율              |
| ------------------------------------ | ------------------------------------------------- | ----------------- |
| **전체**                             | 350 set                                           | 100%              |
| 수능 22~26                           | 40/40 release_ready 통과                          | 100% ✓            |
| 모의 22~26                           | 78/78 marker 정합 + annotation 정합               | 100% ✓            |
| LEGACY 수능 14~21                    | 61/76                                             | 80%               |
| LEGACY 모의 14~21                    | 1차 53 setId 출시 / 136 set (Phase A 즉시가능 81) | 진행중 (2차 대기) |
| cs_ids 결함 (release_ready 1/4 위반) | 1075 → 887 (188 자동/batch 반영)                  | -17.5%            |
| setId 충돌 33 set 안전화             | 영구 자산화 ✓                                     |                   |
| annotation None-None entries         | 78건 정정 (60 target=bogi 매핑 + 18 정정)         | ✓                 |

---

## 오늘(06-03) 완료 sprint

### Sprint 1 — setId 충돌 안전장치 (도구 7개 + AuditPanel v4)

| 영역                     | 변경                                          |
| ------------------------ | --------------------------------------------- |
| cs_ids_recovery v3.0     | 전역 sentIndex 폐기 — set 내부 sents 기준     |
| cs_ids_apply v1.2        | findChoice yearKey+area 격리 + ambiguous skip |
| cs_ids_revert v2         | 동일 패턴 적용                                |
| bracket_audit v2         | findSet yearKey 우선 검색                     |
| visual_mark_extractor v2 | findSet yearKey 인자                          |
| quality_gate v2          | --fix 시 annotations 백업                     |
| step4_csids v2           | retarget + extract-spans 백업                 |
| apply_para.cjs           | archive 이동                                  |
| AuditPanel v4            | ?yearKey= 라우팅 + 충돌 선택 화면             |

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

| yearKey  | 정정                                                          |
| -------- | ------------------------------------------------------------- |
| 2023_9월 | annotation 5 + cs_ids 1 + 본문 marker 11 (r20239b/c/d)        |
| 2022_9월 | 본문 marker 20 + annotation 16                                |
| 2024_6월 | 본문 marker 25 + Q34 ⓐ~~ⓔ→㉠~~㉤ + annotation 15 + bogi image |
| 2024_9월 | 본문 marker 17 + Q7/Q10/Q14 stem 정정 + annotation 15         |
| 2025_9월 | l20259b 본문 marker 8 + l20259c 본문 재구축 (16 sent 추가)    |
| 2026_6월 | 본문 marker 16 + Q9/Q13 stem 정정 + annotation 11             |

### Sprint 6 — annotation None-None entries 정정

- l2025c 7 entries 정정 (5 underline → marker type + 본문 sent.t ㉠~㉤ 삽입)
- 60 None-None entries → target='bogi' + qId 매핑 (72건)

### Sprint 7 — CLAUDE.md 룰 정정

- §1.D 명확한 설명 강제 (결론 먼저 / 옵션 나열 X / 검증 sample 의무)
- §6 메타 발문 예외 룰
- §16 v1.3 변경 이력 추가

---

## 다음 액션 (우선순위) — 2026-06-21 기준

1. **대표 결정 (A vs B)**: (A) **해설 더 자세히(2027_6월) 사양 개편** — 강사가 부족한 해설 2~3개 + 본인 방식 재작성 1개 입력 시 착수(학습가치 ROI 최대; 입력 없으면 시작 불가) / (B) non-CRITICAL 백로그 mechanical cleanup 계속
2. ~~**출시 게이트 강화 (차기 1순위 의제)**~~ → **✅ 완료 (2026-06-22)**: `quality_gate.mjs --scope=release` CRITICAL 0 = release_ready 단일 신호로 가동. 결론줄=ok(REV 자동 차단) + 📌 지문근거 artifact CRITICAL + 구간 bracket FP 제거 자동화. 상세는 변경 이력 참조.
3. **메타발문 R3 룰 확정 (대표 한마디)**: "R3 확정" 시 CLAUDE.md §6 메타 예외표 R1→R3 보정 + 기존 메타 set(r2022c Q10 등) 정렬. 미확정 시 Code B는 R3+보고로 진행
4. **non-CRITICAL 백로그**: 마커 밑줄 exact-fail 36(출시 14 우선·per-case: artifact는 본문 교정/오타는 annotation)·D 극문학 l20166d(이강백 결혼)·l2016cB(채만식 제향날)·stale "판단불가" 2(r2014e·l20229a)
5. **토스 결제**: 운세 /fortune 별도 mid 연동 — 결제 코드(api/fortune-order.js·assets/jippi-payments.js)가 **미커밋 워킹트리 잔존**(라이브 미배포 가능) → 누가 commit/push할지 확정

---

## 사업

| 항목                          | 상태                               |
| ----------------------------- | ---------------------------------- |
| 토스 페이먼츠                 | 심사 예정                          |
| 모두의창업                    | 심사 기간 진행 중                  |
| Tally 베타 테스터             | 베타 출시 진입 완료                |
| FREE 5수능 (22~26수능) 40 set | 100% release_ready 통과 ✓          |
| 모의 22~26 78 set             | 100% (마커 + annotation 정합 완료) |
| LEGACY 모의 cs_ids 자동/batch | 188건 영구 반영                    |

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

- **2026-06-22 — 출시 게이트 자동화 완료(차기 1순위 의제 종결) + release CRITICAL 0**: §13⑤⑥를 `quality_gate.mjs --scope=release`(src/dataLoader.js `RELEASE_KEYS` 198 정규식 파싱, setId 단위 필터)에 **출시 전 자동 차단**으로 박음. ① `F_content_reversed` **결론줄(라인) 정밀화**(마지막 ✅/❌ 줄 맨 앞 이모지 vs ok, 본문 중간 이모지 오탐 차단) + **CRITICAL 승격** = REV(정답-반대 오결론) 자동 차단. ② `C_anchor_exact_fail` 신설 — 📌 지문근거를 **raw exact**(정규화 금지) 판정, **단어내 공백 artifact 한정 CRITICAL**(다문장 연결·말줄임표·verse \n·화자표지 콜론·paraphrase는 정상으로 제외; 마커 앞뒤 공백=`C_anchor_marker_space` WARNING 강등). ③ `bracket_audit` FP룰에 **다문장 구간 bracket**(`isMultiSentRange`, [A]~[F] box 렌더=인라인 마커 불요) 추가 → `SOURCE_BODY_MARKER_MISSING` FP 제거 + bracket findings RELEASE_KEYS 필터(scope-갭 수정). **검출 실결함 정정**: 📌 공백 artifact sent.t 교정 8건(FREE r2025b/r2025c·r2024d PDF 확정 포함, passage_fidelity 라이브 0) / 화자표지 콜론 analysis quote 교정 3건(sent "왕 : " 보존) / F_content 결론줄 추가 4건 / r20176a Q19⑤ **LLM 스크래치패드 누출 재작성**(결론 동일·R4). CRITICAL 추이 **74→31→22→11→0**. 커밋: 도구 9f3ac06(scope/F_content/C_anchor v1)·d1d4d88(C_anchor v2)·c126a26(bracket FP) / 데이터 e04e8bb·75726ea. 전부 gate↔push 분리 + 결제(fortune) 미커밋 워크트리 무손상(워크트리 격리 push). **운영 룰 신설: 출시 전 `node pipeline/quality_gate.mjs --scope=release` CRITICAL 0 = release_ready 단일 신호.** 남은 WARNING(비차단, 별도 품질 회기): `C_anchor_marker_space` 6·`E_empty_pat_cs_present` 2147·paraphrase 1093·placeholder_suspect 492. **§6 메타 예외표 R1→R3 보정 완료**(대표 R3 확정, §13⑨ 정합).

- **2026-06-21 — LIVE 감사: 출시 set 198/198 CRITICAL 0 + 극문학 stage/speech 표준**: ① **2021_6월 whole-exam 완성**(per-yearKey CRITICAL 0) — l20216c·d 오결론 controlled 정정+pat null(Step1)·ok:false 정답 pat 부여+cs 트림(Step2)·**l20216b "전우치전 구조결함"은 오귀속 → 실제는 지문 교체 후 stale 해설**(황만근 PDF 정합, 해설 20선지 §7 전면 재작성, Step3)·l20216d cs density 644→38 재정박+r20216a Q21 어휘 빈해설(Step4·5). ② **극문학 표준 확립**: l20216d(전우치 시나리오)에 stage/speech sentType 전수 분류(Code A 렌더 e5606d2 페어)+㉠~~㉤ 마커 밑줄(PDF 벡터 경계, ㉣ 부분 밑줄 시각확정)+merged sent 분리. 라이브 DOM 검증(행 구분+밑줄 ✓). l20199d·l2016c 복제(출시 산문-blob 해소). ③ **LIVE 감사**: RELEASE_KEYS 198 출시 set 전수 quality_gate → 25 결함 적발 → 오탐 필터(결론줄=ok 기준) → 진짜 24 set 정정 완결(REV 오결론=정답 반대 노출 중이었음; FREE l2022b Q26 포함, 본문 재작성). 커밋 ~~10(7561f91~~0e0d195), 전부 gate↔push 분리+answer_fidelity 0+📌 exact-substring 준수. ④ **신설 운영 원칙**(CLAUDE.md §13 ④~~⑨): gate↔push 분리·결론줄=ok 검사·📌 exact-substring(공백/특수문자 정규화 금지; l2022b s7 줄바꿈→공백 artifact 교정)·마커 인라인 정박(l2016c ㉡ 동일어구 2회 함정)·극문학 stage/speech·메타발문 R3[Adopted]. **주의(주요 발견)**: ㉠ "출시 후 검증 없이 나간 배치"가 정답-반대 오결론을 누적 노출 → 출시 게이트에 결론줄=ok+exact-substring 자동화 박는 게 차기 1순위. ㉡ sandbox 대용량 JSON 동기화 중 truncate로 json.load 간헐 실패 → raw grep 폴백. ㉢ 마커 audit의 setId 추론 버그(비정규 sentId `l2024_22_27sN`)로 FREE 8건 오탐(44→36 보정). **잔여 백로그(non-CRITICAL)**: 마커 밑줄 exact-fail 36(밑줄 미렌더, 정답해설 무영향)·D 극문학 2(l20166d·l2016cB)·stale 2(r2014e·l20229a)·**해설 더 자세히(2027_6월) 사양 개편 — 강사 예시 입력 대기**.

- **2026-06-17 — 게이트 3종 체계 + FREE 3중 통과 + LEGACY 모의 1차 출시**: (8차 이후) structure_fidelity·passage_fidelity 게이트 신설(pipeline/). ① structure_fidelity가 r2015cB Q27 신채호 오삽입 + **r2025b Q4 환각(LIVE FREE)** 적발→재구축(정답④, 동 set 2번째 환각). ② passage_fidelity로 FREE 본문 verbatim 정렬: r2026 5 sent·r2024 2 sent·고전 오타 3(앓는/얽은/낯). ③ 2025수능 manual 정답소스(config/manual_answer_keys.json)+answer_fidelity image_only 폴백 → 미대조 68→34(2027_6월 no_pdf만). **FREE 수능(2022~2026) 3중 게이트(정답·본문·구조) 통과 입증.** ④ formatExamTitle 라벨 통일(src/examTitle.js, 76e58b3). ⑤ LEGACY 모의 1차 배치 출시(42b03a5) — Phase A 진단으로 '해설 미생성·cs56%' 가정 **stale 판명**(해설 거의 완비), setId 충돌 안전분류로 53 setId(69 instance) release(batch1.md), 비마스터 라이브 확인. **주의: api/claude.js 무인증=비용누수 미해결(차기 P0) / python3 게이트 PYTHONUTF8 필수(cp949 mojibake) / setId 충돌(2014~2016 A/B 공유) release 시 충돌-혼합 금지.** 차기: LEGACY 2차 완성·AI P0 보안·문법 MVP(2028 통합 대비).

- **2026-06-14 (8차) — LEGACY 정답 충실도 0 달성**: answer_fidelity 적발 14건 전건 해소(정답오류 9 정정 + 구조결함 5=흥부전 재구축 4 + 숙향전 Q36 재구축 1). 흥부전(l20156c): 모래톱 중복본 제거 후 시험지 전사 복원(지문 19 sent+Q39~~42+선지20, commit 946cfe4). 숙향전(r2015dB): 시 중복 Q36 제거+본문 확장(post-중략 s23~~s33 신규 전사+㉠~㉤ 마커)+Q36 교체(commit 97bd1bb). answer_fidelity 14→0(잔존 ok분포1=r2022c Q10 메타발문 정상, 미대조68=image_only+no_pdf 인프라). 품질심사관 검증: ok-map 정답표 대조 + 신규 전사 11/11 한글단위 PDF 일치. 출시영역 회귀 0.

- **2026-06-14 (6차) — P0 라이브 정답 오류 7건 정정**: answer_fidelity 인코딩 수정으로 적발된 21건 중 라이브 노출 7건 정정(commit f540407·2c4fec4·6c0c6f6·894ed9f·3f7884a·ff3c5fb·d276d0b, set별 단일파일). 좁은 범위 트랙(ok 교정+영향선지 §7 3단 해설+새 ok:false pat·cs), set 전체 release_ready 부채는 분리. answer_fidelity 21→14(P0 100% 해소, 잔존 14=전부 비노출). 품질심사관: ok방향 7건+pat 도메인(intact 2건) 검증. 미완 검수=절단영역 5건 해설 본문 내용검증(특히 r2021c Q36 R1 vs R3) + touched 7 set quality_gate. 차기: 비노출 14건 배치 정정.

- **2026-06-14 — 13개년 수능 placeholder + [B] 재작성 cascade 종결**: bracket workTag 24건 일괄 복구 (l20259a/c + r2021b + 2014~2020 22건) / placeholder [?]제거·✅ 플립 16건 (2015B·2016B·2018·2019 yearKey별 단독 commit) / [B] 재작성 4건 (2016B Q41-[4] L1·2020 Q43-[2] L1·2019 Q40-[2] R1·2017 Q24-[3] L3) + cs_ids 매핑 정합 사실 — 각 yearKey 게이트0 CRITICAL 0. 잔여 보류: **l2017a 본문 누락(굶주린 이리떼 구간) 복원 필요** — 사용자 명시 raw 인용("사람들은 굶주린 이리떼처럼…") ↔ 현 지문 안 사양("갈가마귀떼처럼") mismatch 식별 사실, Q24-[3] = 갈가마귀떼 사양 정합 정정 사실 단 — 원문 사양 안 굶주린 이리떼 구간 누락 잠재 (PDF 대조 의무 path). l2014bB [A][B][C] = PDF 참조 없음 사양 보류.

- **2026-06-14 (5차) — answer_fidelity 인코딩 버그 수정 → 정답 오류 21건 적발**: v2 미대조 1251의 정체 = Windows python stdout cp949 인코딩으로 정답표 ①②③④⑤가 mojibake(`�`) 손실된 게이트 버그(데이터 무결함). PYTHONUTF8 강제(commit d494d6c)로 미대조 1319→68(전부 image_only/no_pdf). 가려졌던 실제 정답 불일치 21건 신규 적발(품질 심사관 정답표 측 21/21 PDF 재검증 + 라이브 2건 데이터측 검증 = 메타 아닌 평범한 ok오류). 라이브 노출 7건=P0(l20146a Q40·l2015b Q36·l2020c Q35·l20219b Q38·r2021c Q36·l2021c Q40·l2021d Q44), 비노출 14건. 정정=선지 재지정+해설/pat/cs 재구축(사용자 승인 의무). 차기 1순위.

- **2026-06-14 (4차) — answer_fidelity 잔여 reconcile**: intact 검증으로 2014~~2016(A/B 전부)+2022~~2026 미대조 0 확인(2025수능 image_only 34 제외). 잔여 미대조는 2017~~2021 한정 + 형식/파서 무관(정답표 45/45 파싱 확인). 차기 1순위: 호스트 v2 "미대조 yearKey별" 실제 숫자 목록 확보 → 2017~~2021만 조사. 단 1319 총계가 2017~2021로 산술 reconcile 안 됨 = 목록 확보 전까지 [Unverified].

- **2026-06-14 (3차) — answer_fidelity v2 계측판 (commit 4d200cb)**: A/B형 디렉터리 해소(no_dir skip 사각지대 제거)+image_only/no_pdf 분류+yk별 status 분해. 결과: 불일치 0·분포이상 0. 미대조 1319 = image_only 34(2025수능, LLM검증 무영향)+no_pdf 34(2027_6월)+**status=ok 1251건(LEGACY 35~45 q.id 미대조 — 본 트랙 본래 목표, 미해결)**. 차기 1순위: v2 "미대조 yearKey별" 목록 확보→1251 정체(q.id 범위/번호체계) 특정→정정.

- **2026-06-14 (2차) — step1 LEGACY 정답 보강 + 정답 충실도 게이트 신설**: step1_answer.js LEGACY 정답 1~~45 통합추출 보강(선택과목 분리 이전 형식) [Confirmed: commit 1c6c3cf]. `pipeline/answer_fidelity.mjs` 영구 게이트 신설 — 데이터 정답 사양 ↔ 시험지 정답표 PDF 대조, 검증된 영역 0 불일치 [Confirmed: commit d3fb1ae]. 정답표 커버리지 진단: 미대조 1319건 = 전부 정답표 PDF 형식차 (2025수능 = image-only PDF → step1 LLM 폴백 필요 / 2018~~2021수능 = 홀짝 2표 형식 / 모의 = 형식차) [Inference]. 보강 시 LEGACY 35~45 전수 검증 완성 — 차기 1순위.

- **2026-06-13 — 2025_9월 8 set 재추출·재구축 종결**: 2025_9월 8 set 전수 재추출(Gemini PDF) + 재구축. 중간 Gemini 재추출 사양 안 회귀 사고 발생 + 복구 완료. [A] workTag 복원 (l20259a + l20259c 안 사양 보강 사실). step2_extract.js 가드 정정 — `getExamProfile().reading_range[1]` 기반 상한 사양 안 r20259e/f 회귀 원천 차단 (3 영역 정정). 검증: node --check 정합.

- **2026-06-09 — 2027_6월 출시 + LEGACY 수능 결함 종결**: 2027학년도 6월 정식 release(양쪽 목록+R3/V 22건 정박). LEGACY 수능 결함 set 재구축(r2014aB 문법 삭제·bB/cB/dB 전사·선지 절단 3 set 정답표 복원). 2027 Q6 3중 결함(마커 주체·해설 ㉮㉯ 인물 역전·cs) 정정. 중복 <보기> 라벨 전수 32건 제거+step2 본체 규칙. 완성도 실측: 베타 126 해설100%/cs98%, LEG수능 72 해설97%/cs91%, LEG모의 136 cs56%(해설 생성 미결). 다음 1순위=LEGACY 모의 해설 생성(대표 머신 LLM).

- **2026-06-07 — LEGACY 모의 구조·정합 전 단계 종결 (8 sprint)**: marker 2차 59건(fitz 좌표) / 중복 set 22개 dedupe(문항 보전 이관, 수능 3쌍 포함) / 구조 재구축 14 set(r20219e (나) 복원+Q23 이미지 보기 재구축·황만근 본문 교체·보리 placeholder 복원·r20169b Q21~24 정답표 복원) / 분포 14건 ok 반전 / bogi 누락 7건(표 판독 3·그림 추출 4) / PUA 표준화 225건(겹낫표 『』·옛한글 첫가끝 — 폰트 불요 확인) / LEGACY 독서 para 93 set / cs_spans 415건 재정박 → **전체 350 set 결함 0**. 베타: 2026_9월 Q17 데이터표·Q25 어휘 오판(isVocabQuestion 마지막문항 룰)·문학 순서 등 정렬 12곳·l20269b Q25 해설 재정박 5건·2027_6월 bracket [X] 5건(CRITICAL 0 회복). 잔여: LEGACY 해설·cs 생성(대표 결정)·수능 결함 8 set·para 28 set.

- **2026-06-05 (오늘) 7차 — 2027_6월 해설 개편 + LEGACY 모의 진입**: ① 2027_6월 해설 품질 개편 — ok:true 91건 전부 '근거→뜻풀이→선지 판정' 3단 서술로 재작성 (3~~5등급 눈높이), 🔎 배제근거/정답비교 블록 170건 제거 (선지 해설 자립), Q6 ㉮㉯ 근거 라벨 교정, 문학 c5 페이지 푸터 4건 해소 + step2 tail-cutter 푸터 규칙 2종 본체 추가. 전수 원문 대조(정규화 substring) 신규 검수법 확립 — 검사기 오탐 3건 제외 실결함 전부 정정. ② LEGACY 모의 14~~21 진입 — 1단계 전수 진단 (156 set 중 결함 88: marker 75 / 분포 14 / 구조 12 / 오염 1) + 2단계 marker batch 1차: PDF anchor 유일 매칭 198건 자동 삽입 (295→99건, 75→43 set, span 영향 0, 라이브 검증 ✓). 잔존: marker 2차 99건(fitz 좌표 정밀), 구조 12 set(본문 재구축), 분포 14 set(메타 발문 판별).
- **2026-06-05 (오늘) 6차 — para 미부여 종결**: fitz 좌표 기반 정밀 들여쓰기 추출(특수문자 『』󰡔󰡕 정규화 + y그룹 5pt)로 8 set 경계 회수·적용 — 베타 독서 para 커버 62/64. 추가 발견·정정: r20249d (가)(나) prefix 소실 복원, r20259d s1 발문 쪼가리 제거 + (나) prefix 복원 (둘 다 r20276b class). 잔존 2 set 내부 문단 = 보류 (무리한 추정 대신 검수 보드 직접 지정 path 권고). 사본 경유 적용 + suneung5 gate CRITICAL 0 유지.
- **2026-06-05 (오늘) 5차 — suneung5 CRITICAL 21건 종결 (FREE 공개 영역)**: ① **r2025b Q5 환각 문항 발견·전면 재구축** — 발문("개화에 대한 이해로 적절하지 않은 것은?")·선지 5개가 통째로 원문과 다른 상태로 공개 중이었음. 시험지 PDF 원문 교체 + questionType negative 정정 + 해설 5건 지문 근거 재작성 + 내부 ID 노출 5건 해소 (ok 분포는 정답표 ⑤ 정합으로 유지). ② bracket 14건 본문 [X] 복원 — workTag 단독 sent 삽입 (viewer 숨김 사양, 렌더 영향 0). ③ r2022c Q10 = 메타 발문 정상 데이터 확인 → quality_gate에 §6 메타 발문 예외 추가 (오탐 정정, 데이터 무수정). gate 결과: **suneung5 CRITICAL 0건 — release_ready 회복**. 작업 경로: sandbox all_data 캐시 결함 우회 위해 사본(pipeline/test_data/all_data_working.json) 경유 + 역복사. 발견된 기준 공백: release_ready가 발문·선지 원문 일치 미검사 — 차기 gate 보강 후보.
- **2026-06-05 (오늘) 4차 — 2027_6월 검수 + 추출 자동화 본체 반영**: ① annotation 0건 상태 발견 → PDF 도형 좌표(fitz line/rect) + 고해상 crop 판독으로 46건 신규 (밑줄 41 멀티라인 포함 + bracket 5: 나룻배[A]·홍길동[A]·만전춘[A][B][C]). ② 해설 내부 ID 노출 11건 제거 + 보기 유형 라벨 11건 (§7 정합). ③ 구조 검수: 발문 sent 혼입 4 + 페이지 노이즈 2 제거, 문학 title 4건 작품명 추출, verse/workTag/author/footnote 분류, (가)(나)(다) 6건 삽입 + 독서 r20276b (가)(나) prefix 복원, para 캐시 직접 부여(재머지 보존). ④ **본체 자동화**: step2_postprocess.cleanSentStructure 신설 (발문·노이즈·분류·verse 추정·title 추출 — 백업본 검증으로 수동 정정과 대등 확인) + step2_extract "(가)" 3자 필터 소실 결함 수정. 잔여 차기 과제: 독서 marker 오염 자동 검증, annotation 자동 초안 도구화, 연(stanza) 스키마(대표 결정). 라이브 검증 완결 (만전춘 set: workTag+bracket+verse 렌더 ✓).
- **2026-06-05 (오늘) 3차 — 신규 시험 진입 + 문단 기능**: ① **2027_6월 진입 완료** (8 set, 라이브 검수 모드 노출): 정답표 PNG 신형식 — step1_answer.js 본체 PNG/JPG/WebP 지원 추가, PNG 추출 34문항 = AI 직접 판독과 100% 일치. step2 독서 4 set Gemini 경로 marker 오염 (①ⓕⓖ 오염·한 칸 밀림·㉮㉯ 소실) → 시험지 PDF 대조 전수 정정 + 재정박 14건, 최종 본문=문항 marker 4/4 정합·정답 34/34·치명 0. 문학 4 set = pdf-parse 경로 원본 보존. 원천 PDF·PNG `_done/2027_6월/` 보관. release_status 미지정 = 학생 비노출 (release 전환은 검수 후 대표 결정). ② **독서 문단 기능 출시**: `pipeline/para_assign.mjs` 영구 도구 (PDF -layout 들여쓰기 기반 경계 추출 + --bounds 옵션) + 베타 독서 51 set + 2027_6월 3 set para 부여 + PassagePanel 문단 들여쓰기 렌더 + QuizPanel 'N문단' badge 활성화 (해설 무수정). para 미부여 12 set = 수동 목록 (r2022d/r20256d/r20229d/r20239d/r20259c/r20259d/r2024c/r20249c/r20249d/r20249a/r20276d 등 — (가)(나) 복합·본문 결함 set). ③ Gemini 크레딧 소진 1회 (충전 후 재개). 환경 결함 추가 기록: host 쓰기 파일의 sandbox 캐시 절단 (Edit 도구·사용자 머신 node 쓰기 모두 해당) → 해당 파일 commit·검증은 대표 머신 path 의무.
- **2026-06-05 (오늘)**: 오염 글자·marker 누락 잔존 sprint — 회기 시작 검수에서 ⑦계열(⑥~~⑪) 오염 글자 class 발견 (기존 검출기 공백: ㉠ⓐ㉮ 계열만 탐지). 베타 전수 스캔 후 9 set 정정: l20246a Q20 (stem '과에 대한' + ⑦①→㉠㉡ + body ㉠㉡ 삽입) / l20246b Q23 (⑦~~⑪→㉠~~㉤ + body 5건 삽입, s27 '큰'=㉣ 오독 정정) / l20246c Q29 (⑦→㉠) / l20256a Q20 (③⑥→ⓐⓑ + 선지 번호 prefix 제거 + body ⓐⓑ 삽입) / r20266c Q11 (marker 한 칸 밀림 — ⑦→㉠, ㉠→㉡ swap + body ⑦·㉡ 오염 3건 정정 + ㉡ 정위치 삽입) / r20226b Q7 (㉡ 4건 drop) / r2023a Q3 (ⓔ→㉠ + body ㉠ 삽입) / l20259a (body ㉠ 삽입) / l20249c (원미동 시인 — ⓓ 누락으로 화자 marker 한 칸 shift: ⓓ 삽입 + ⓓⓔⓕ→ⓔⓕⓖ + Q29 stem 'ⓐ~~ⓖ' + 선지·해설 재구성, 정답표 ④ 정합). 이미지·도식 보기 내 marker 4건 (r2025c/r2023d/r20246a/r20246c) = 정상 판정. 베타 span 0건 유지, 손댄 yearKey QG CRITICAL 신규 0.
- **2026-06-04 4차**: cs_spans 잔존 138건 종결 — PDF 대조 분류 (본문 누락 0건 확인 / 인용 의역·표기 차이) 후 재정박: LCS 정규화 v2 (한자 병기 괄호 제거 + 인용부호·쉼표 무시) 자동 133건 + 수동 5건 (따옴표 종류 차이 3 / 쓰레기 조각 삭제 1 / l20266c s51 ㉥ 오염 글자 본문 정정 1). **베타 영역 cs_spans 결함 0건 달성** (dead 0 / text_miss 0). 안전 규칙: 동일 문장 재정박 또는 일치율 0.85+ 한정, 전 건 원문 substring 검증. LEGACY 420건 잔존 (별도 sprint). suneung5 QG CRITICAL 21건 동일 (신규 0).
- **2026-06-04 (오늘) 3차**: cs_spans 무결성 sprint (베타 영역 15 yearKey) — dead sentId 참조(구 포맷 r20236d_s* / l2024_18_21s* / l202311as\* 등) + 인용 text 불일치 전수 정정. 정규화 매칭(marker/인용부호/공백 무시 → 원문 substring 복원) 기반 자동 정정 1,107건 (remap 811 + text 재계산 233 + 전체탐색 41 + fragment 22). 베타 잔존 1,245→138 (-89%) — 잔존분은 본문에 해당 구절 부재(고전 표기 차이·본문 축약) = PDF cross-check 의무 needs_human. LEGACY 420건 미착수 (별도 sprint). suneung5 quality_gate CRITICAL 21건 동일 (신규 0). 백업: pipeline/backups/all_data_204.before_span_fix_20260604.json
- **2026-06-04 (오늘) 2차**: 잔여 yearKey 16건 sprint — PDF 직접 대조 path (사용자 인용 불필요 확인). 2023_6월: r20236d ⓐ~~ⓔ 5건 + l20236c ㉠ + l20236d ㉠㉡ⓑⓒⓓⓔ 6건 + Q29/Q30 stem·선지 글자 오염 정정 + Q29 c2~~c5 해설 재작성 (referent 오류). 2026_9월: l20269a ㉠㉡㉢ + **Q19 발문 유형 정정 (부정→긍정, 정답표 ① [Confirmed]) + ok 5건 재배정 + 해설 5건 재작성** + l20269b ㉠~~㉤ (㉮ scheme 폐기) + Q25 정정 + l20269c ㉡㉢㉣㉤ (ⓕⓗⓘ 오염 글자 정정) + r20269c Q13 ⓐ~~ⓔ. 2022_6월: r20226a ㉠ + r20226d Q17 빈칸 ㉮㉯㉰ 재구축 (선지 ①④ 방향 오염 정정, 정답표 ② 정합) + r20226c Q10 questionType 정정 (발문 부정형). 3 yearKey quality_gate CRITICAL 0건 (잔존 bracket 의심 11건 = 사전 존재). 신규 발견 결함 class: cs_spans dead sentId 참조 (r20236d_s* / l20236es* / l202311as\* 포맷 위반 + 인용부호 오염) — 2023_6월 집중, 별도 sprint 의무.
- **2026-06-04 (오늘)**: 2025_6월 4 set 정합 sprint — 본문 marker 10건 삽입/정정 (r20256a ㉠㉡ / r20256c ⓐ㉠ / r20256d ⓑⓒⓓⓔ㉠) + stem/선지 marker 오염 정정 (Q2/Q3/Q10/Q15/Q17/Q33) + r20256c Q10 ④⑤ 선지 방향 반전 정정 + r20256d Q14 6지선다 결함 정정 (phantom 선지 삭제 + 정답 ④ ok 재배정 — 정답표 PDF [Confirmed]) + 해설 anchor 오류 재작성 (Q17 c3/c4/c5, Q2 c1/c5) + pat 2건 정정 (Q2 c1 R3→R4 / c5 R3→R1) + annotation 12건 추가 (box 에이어 + bracket A 포함) + 2건 정정. quality_gate 2025_6월 CRITICAL 0건. 사용자 미명시 영역 (r20256c ⓐ / r20256d ⓕ / l20256d ⓒⓓⓔ) = 시험지 PDF 대조로 전부 해소 (ⓕ·ⓒⓓⓔ는 실존하지 않음 확인).
- **2026-06-03**: setId 충돌 안전장치 sprint (도구 7개 + AuditPanel v4) + cs_ids C sprint 92건 + QuizPanel showBadge + V 사양 + 메타 발문 audit 3건 + 모의 22~26 pat 17건 + 본문 marker 6 yearKey 정정 + annotation None-None 78건 + l2025c marker type 정정 + 60 entries target=bogi 매핑 + CLAUDE.md §1.D §6 §16 룰 추가.
- 2026-05-31: cs_ids 영구 자산화 + 진단 도구 v2 보강 + 검수 보드 v3.1+v3.2 + B sprint duplicate_sentid 재매핑 + 모의 22~26 marker batch 16 set + stem/선지 환각 12 set + annotation 15 set + 96건 cs_ids 자동 반영. 베타 출시 진입.
- 2026-05-28: 181 set RELEASED. UX W2/W3. 모의 78 set + LEGACY 수능 61 set 전환. release_ready 6기준 도입.
- 2026-05-26: W1 완료. FREE 100% release.
