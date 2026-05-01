# Archive·이관 실행 계획서

> 작성: 2026-04-25
> 실행 주체: **데이터 엔지니어 (Cowork 모드)**
> 실행 시점: 첫 가동 (백로그 B로 처리)
> 사전 조건: 백로그 A (git 정리) 와 동시 또는 직후 실행

---

## 0. 전체 흐름 요약

```
[현재] 루트에 9개 운영 문서 산재 + ops/employees/data_engineer/만 존재
   ↓
[1단계] ops/ 하위 신규 폴더 5개 생성
   ↓
[2단계] 오늘 만든 6개 파일 정확한 위치 배치 확인
   ↓
[3단계] 기존 9개 문서를 ops/archive/ 또는 직원 폴더로 이관
   ↓
[4단계] INTEGRATION_GUIDE.md 통합 완료 여부 점검
   ↓
[5단계] pipeline/tasks.json 사용처 확인 및 처리
   ↓
[6단계] 검증 (목표 폴더 구조 일치 확인)
   ↓
[7단계] git commit (백로그 A 그룹 분류와 통합)
```

---

## 1. 신규 폴더 생성

PowerShell에서 실행:

```powershell
cd C:\Users\downf\suneung-viewer

# ops 하위 5개 신규 폴더 (data_engineer는 이미 존재)
New-Item -Path "ops\employees\frontend" -ItemType Directory -Force
New-Item -Path "ops\employees\strategist" -ItemType Directory -Force
New-Item -Path "ops\employees\copywriter" -ItemType Directory -Force
New-Item -Path "ops\employees\quality_reviewer" -ItemType Directory -Force
New-Item -Path "ops\daily" -ItemType Directory -Force
New-Item -Path "ops\archive" -ItemType Directory -Force
```

검증:
```powershell
Get-ChildItem ops -Recurse -Directory | Select-Object FullName
```

기대 출력:
```
ops\daily
ops\archive
ops\employees
ops\employees\copywriter
ops\employees\data_engineer
ops\employees\frontend
ops\employees\quality_reviewer
ops\employees\strategist
```

---

## 2. 오늘 생성 파일 배치 확인

대표가 이미 배치한 항목:
- `ops\employees\data_engineer\CLAUDE.md` (어제 v1, 오늘 v2로 덮어씀)
- 루트 `CLAUDE_MASTER.md` (어제 v0, 오늘 v0.1로 덮어씀)

오늘 추가 배치 필요 항목 (대표 액션 또는 데이터 엔지니어 확인):

| 파일명 | 목표 위치 |
|---|---|
| `frontend_CLAUDE.md` | `ops\employees\frontend\CLAUDE.md` |
| `quality_reviewer_CLAUDE.md` | `ops\employees\quality_reviewer\CLAUDE.md` |
| `strategist_CLAUDE.md` | `ops\employees\strategist\CLAUDE.md` |
| `copywriter_CLAUDE.md` | `ops\employees\copywriter\CLAUDE.md` |
| `quality_reviewer_HANDOVER.md` | `ops\employees\quality_reviewer\HANDOVER.md` |
| `data_engineer_HANDOVER.md` | `ops\employees\data_engineer\HANDOVER.md` |

⚠️ 다운로드한 파일명에는 직원명이 prefix로 붙어있으나, **목표 위치에서는 `CLAUDE.md` / `HANDOVER.md`로 단순화**해서 배치할 것 (각 폴더 안에 있으므로 이름 중복 불필요).

검증:
```powershell
Get-ChildItem ops\employees -Recurse -Filter "*.md" | Select-Object FullName
```

---

## 3. 기존 9개 문서 이관

### 3-1. 루트 `CLAUDE.md` → archive

```powershell
Move-Item -Path "CLAUDE.md" -Destination "ops\archive\CLAUDE_v0_root.md" -Force
```

⚠️ 주의: 루트 `CLAUDE_MASTER.md`와 혼동 금지. 이건 **`CLAUDE.md`** (옛 통합 가이드).

### 3-2. `pipeline/CLAUDE.md` → archive

```powershell
Move-Item -Path "pipeline\CLAUDE.md" -Destination "ops\archive\pipeline_CLAUDE_v0.md" -Force
```

### 3-3. `src/CLAUDE.md` → archive

```powershell
Move-Item -Path "src\CLAUDE.md" -Destination "ops\archive\src_CLAUDE_v0.md" -Force
```

### 3-4. 루트 `HANDOVER.md` → archive

```powershell
Move-Item -Path "HANDOVER.md" -Destination "ops\archive\HANDOVER_v0_2026-04-15.md" -Force
```

### 3-5. `TASKS.md` → archive

```powershell
Move-Item -Path "TASKS.md" -Destination "ops\archive\TASKS_v0_2026-04-16.md" -Force
```

### 3-6. `HANDOVER_D_ENGINE.md` → archive (Phase 1 중간 상태)

```powershell
Move-Item -Path "HANDOVER_D_ENGINE.md" -Destination "ops\archive\HANDOVER_D_ENGINE_phase1_midstate.md" -Force
```

### 3-7. `HANDOVER_D_ENGINE_PHASE1_COMPLETE.md` → 데이터 엔지니어 폴더 (Phase 1 기록 보존)

```powershell
Move-Item -Path "HANDOVER_D_ENGINE_PHASE1_COMPLETE.md" -Destination "ops\employees\data_engineer\HANDOVER_D_ENGINE_PHASE1.md" -Force
```

⚠️ **`HANDOVER.md`로 덮어쓰기 금지**. Phase 1 종료 기록은 별도 보존.
이미 만든 `HANDOVER.md`(데이터 엔지니어)와 별도 파일로 공존.

### 3-8. `HANDOVER_QUALITY_REVIEWER.md` → archive (오늘 만든 v1이 대체)

```powershell
Move-Item -Path "HANDOVER_QUALITY_REVIEWER.md" -Destination "ops\archive\HANDOVER_QUALITY_REVIEWER_v0.md" -Force
```

⚠️ 오늘 만든 `ops\employees\quality_reviewer\HANDOVER.md`가 새 정본. 이전 버전은 참고용 보존.

### 3-9. `INTEGRATION_GUIDE.md`

**4단계에서 통합 완료 여부 확인 후 처리**. 아래 4단계 참조.

### 3-10. `pipeline/tasks.json`

**5단계에서 사용처 확인 후 처리**. 아래 5단계 참조.

### 3-11. `README.md` → 그대로 유지

Vite 기본 README. 이동/수정 안 함.

---

## 4. INTEGRATION_GUIDE.md 통합 완료 여부 점검

### 점검 명령

```powershell
# step2_extract.js에 postprocess 통합 여부
Select-String -Path "pipeline\step2_extract.js" -Pattern "step2_postprocess"

# step3_analysis.js에 enforceRules 통합 여부
Select-String -Path "pipeline\step3_analysis.js" -Pattern "step3_rules"
```

### 결과별 처리

**Case 1: 양쪽 다 import 있음 (통합 완료)**
```powershell
Move-Item -Path "INTEGRATION_GUIDE.md" -Destination "ops\archive\INTEGRATION_GUIDE_v0.md" -Force
```

**Case 2: import 없음 (통합 미완)**
- archive 보류
- 데이터 엔지니어 백로그에 "INTEGRATION_GUIDE.md 따라 step2/step3 수정" 추가
- 통합 완료 후 archive

**Case 3: 한쪽만 통합됨**
- 통합 안 된 쪽만 추가 작업
- 둘 다 완료 후 archive

품질 심사관 보고 형식:
```
INTEGRATION_GUIDE.md 점검 결과:
- step2_extract.js: [통합 완료 / 미완]
- step3_analysis.js: [통합 완료 / 미완]
- 처리: [archive / 추가 작업 후 archive]
```

---

## 5. pipeline/tasks.json 사용처 확인

### 점검 명령

```powershell
# pipeline 폴더 내에서 tasks.json 참조 검색
Get-ChildItem -Path "pipeline" -Recurse -File -Include "*.js","*.mjs","*.cjs" | 
  Select-String -Pattern "tasks\.json" |
  Select-Object Filename, LineNumber, Line
```

### 결과별 처리

**Case 1: 참조 스크립트 없음**
```powershell
Move-Item -Path "pipeline\tasks.json" -Destination "ops\archive\pipeline_tasks_v0.json" -Force
```

**Case 2: 참조 스크립트 있음**
- 해당 스크립트가 현재 사용 중인지 확인
- 사용 중이면 **삭제 금지**. 그대로 유지
- 미사용이면 스크립트와 함께 검토 (백로그 추가)

**Case 3: setId 명명 규칙 불일치 (`lsep25a`, `sep25_a` 형식)**
- 현재 표준(`r2025_9월a` 형식)과 다른 옛 형식
- 사용처 없으면 archive
- 사용처 있으면 **다음 처리는 보류** (5/15 이후 데이터 표준화)

---

## 6. 검증

### 목표 폴더 구조

```
suneung-viewer/
├── CLAUDE_MASTER.md                    ✅ 유일 공통
├── README.md                           ✅ Vite 기본 (유지)
├── public/
│   ├── data/
│   │   ├── all_data_204.json           ✅ 정본
│   │   └── annotations.json
│   └── images/
├── src/                                ← CLAUDE.md 없어야 함 (이관됨)
├── api/claude.js
├── pipeline/                           ← CLAUDE.md 없어야 함 (이관됨)
│   └── d_engine/
└── ops/
    ├── employees/
    │   ├── data_engineer/
    │   │   ├── CLAUDE.md                          (v2)
    │   │   ├── HANDOVER.md                        (오늘 작성)
    │   │   └── HANDOVER_D_ENGINE_PHASE1.md        (Phase 1 기록)
    │   ├── frontend/
    │   │   └── CLAUDE.md
    │   ├── strategist/
    │   │   └── CLAUDE.md                          (스켈레톤 v0)
    │   ├── copywriter/
    │   │   └── CLAUDE.md                          (스켈레톤 v0)
    │   └── quality_reviewer/
    │       ├── CLAUDE.md
    │       └── HANDOVER.md
    ├── daily/                                     (빈 폴더, 향후 일일 기록)
    └── archive/
        ├── CLAUDE_v0_root.md
        ├── pipeline_CLAUDE_v0.md
        ├── src_CLAUDE_v0.md
        ├── HANDOVER_v0_2026-04-15.md
        ├── TASKS_v0_2026-04-16.md
        ├── HANDOVER_D_ENGINE_phase1_midstate.md
        ├── HANDOVER_QUALITY_REVIEWER_v0.md
        ├── INTEGRATION_GUIDE_v0.md                (통합 완료 시)
        └── pipeline_tasks_v0.json                 (미참조 시)
```

### 검증 명령

```powershell
# 루트에 운영 문서가 CLAUDE_MASTER.md + README.md만 있는지
Get-ChildItem -File -Filter "*.md" | Select-Object Name

# 기대 출력: CLAUDE_MASTER.md, README.md (그 외 .md 파일은 src/ 등 코드 폴더 안)

# pipeline/, src/ 에 CLAUDE.md 없음 확인
Test-Path "pipeline\CLAUDE.md"   # False 기대
Test-Path "src\CLAUDE.md"        # False 기대

# ops 구조 전체 확인
Get-ChildItem ops -Recurse | Select-Object FullName
```

---

## 7. git commit (백로그 A와 통합)

본 이관 작업은 **백로그 A의 그룹 A (운영 문서)**와 같은 커밋에 묶기 권장:

```powershell
# 신규 폴더 + 신규 문서 + archive 이관까지 한꺼번에
git add CLAUDE_MASTER.md
git add ops/
git add -u CLAUDE.md HANDOVER.md TASKS.md   # 삭제도 추적
git add -u pipeline/CLAUDE.md src/CLAUDE.md HANDOVER_D_ENGINE.md
git add -u HANDOVER_D_ENGINE_PHASE1_COMPLETE.md HANDOVER_QUALITY_REVIEWER.md
git add -u INTEGRATION_GUIDE.md             # 통합 완료 시
# pipeline/tasks.json은 참조 처리에 따라 결정

git commit -m "refactor(ops): AI 직원 운영 체제 v0.1 도입

- CLAUDE_MASTER.md v0.1 (공통 원칙 통합)
- 직원 5명 CLAUDE.md (data_engineer v2, frontend, quality_reviewer, strategist v0, copywriter v0)
- HANDOVER 2종 신규 (quality_reviewer, data_engineer)
- 9개 기존 문서 ops/archive/로 이관
- HANDOVER_D_ENGINE_PHASE1_COMPLETE → ops/employees/data_engineer/HANDOVER_D_ENGINE_PHASE1.md
"
```

---

## 8. 실행 순서 권장 (데이터 엔지니어 첫 가동 시)

### Phase 1: 환경 점검 (10분)

1. git status 보고
2. 4단계 INTEGRATION_GUIDE 통합 점검 → 결과 보고
3. 5단계 tasks.json 사용처 점검 → 결과 보고
4. 품질 심사관 승인 대기

### Phase 2: 폴더·파일 이관 (15분)

5. 1단계: 신규 폴더 생성
6. 2단계: 오늘 만든 6개 파일 배치 확인
7. 3단계: 기존 9개 문서 이관
8. 4단계 결과에 따라 INTEGRATION_GUIDE 처리
9. 5단계 결과에 따라 tasks.json 처리

### Phase 3: 검증 (5분)

10. 6단계: 목표 폴더 구조 검증

### Phase 4: git 정리 (백로그 A와 통합, 30분)

11. .gitignore 보강
12. 그룹 A~F 단계별 커밋
13. 품질 심사관 승인 후 push

**총 예상**: 60분 (백로그 A + B 통합)

---

## 9. 실패·롤백

### 실패 케이스 1: Move-Item 충돌 (대상 파일 이미 존재)

`-Force` 옵션이 덮어쓰지만, 의도하지 않은 덮어쓰기 방지 위해 **이동 전 양쪽 파일 내용 한 번 확인**:

```powershell
# 예: archive 위치에 이미 같은 이름 파일 있는지
Test-Path "ops\archive\CLAUDE_v0_root.md"
```

### 실패 케이스 2: 폴더 생성 실패 (권한/경로)

PowerShell 관리자 권한 또는 경로 재확인.

### 롤백

git commit 전이라면:
```powershell
git checkout -- .              # working tree 복원
git clean -fd                  # untracked 파일 제거 (주의: 백업 후)
```

git commit 후라면:
```powershell
git revert HEAD                # 마지막 커밋 되돌리기
```

---

## 10. 보고 형식 (데이터 엔지니어 → 품질 심사관)

작업 완료 후:

```
[완료 보고 — 백로그 A + B]
실행:
  - 신규 폴더 5개 생성
  - 오늘 만든 6개 파일 배치 확인
  - 기존 9개 문서 ops/archive/ 이관
  - INTEGRATION_GUIDE.md: [통합 완료 / 미완 → 처리]
  - pipeline/tasks.json: [archive / 사용 중 → 보존]
  - .gitignore 보강
  - 그룹 A~F 단계별 커밋
  - push 완료

확인:
  - 목표 폴더 구조 일치
  - git status 깨끗
  - Vercel 배포 정상 (push 후 5분 내 확인)

미처리 이슈:
  - (있으면 명시)

승인 필요:
  - (push 직전 시점에 묻기)

다음 액션 1개:
  - 백로그 C (2022수능 이미지 JSON 삽입) 또는 다른 우선 작업
```
