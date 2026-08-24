#!/usr/bin/env bash
# repair_all.sh — 재추출 43세트 수리 전체 파이프라인 (발주 2026-08-24)
#
# 원본(_backup_20260824)에서 시작해 순서대로 돌린다. 순서가 결과를 바꾼다:
#   ① 줄바꿈 정리 → ② cs_spans 재정박 → ③ 옛한글 → ④ id 제거 → ⑤ U+FFFD
# ②는 ①이 끝난 본문을 기준으로 정박하므로 반드시 뒤에 온다.
#
# 사용: bash pipeline/repair_all.sh
set -u
cd "$(dirname "$0")/.."
LOG=/tmp/repair_all.log
: > "$LOG"

say() { echo "== $*" | tee -a "$LOG"; }

say "0. 원본 복원"
for f in pipeline/reextract/_backup_20260824/*_step4.json; do
  yk=$(basename "$f" _step4.json)
  cp "$f" "pipeline/reextract/step3/$yk/step4_result.json"
done

say "1. 줄바꿈 정리 (sents.t + 발문·선지·보기)"
node pipeline/newline_fix.mjs --fields --apply >> "$LOG" 2>&1

say "2. cs_spans 재추출 + 재정박"
node pipeline/respan_reextract.mjs --apply >> "$LOG" 2>&1

say "3. 옛한글 복원 (PUA -> 첫가끝)"
for yk in 2020_9월 2015_6월B 2016_9월A; do
  p="pipeline/reextract/step3/$yk/step4_result.json"
  [ -f "$p" ] || continue
  # 매핑표에 없는 글자가 있으면 exit 1 — 그 회차는 손대지 않고 넘어간다
  if python pipeline/oldhangul_restore.py "$p" "/tmp/oh_$yk.json" >> "$LOG" 2>&1; then
    cp "/tmp/oh_$yk.json" "$p"
    echo "   $yk 적용" | tee -a "$LOG"
  else
    echo "   $yk 보류 — 매핑표 밖 글자 (원본 대조 필요)" | tee -a "$LOG"
  fi
done

say "4. analysis 내부 id 제거"
node pipeline/idleak_clean.mjs --apply >> "$LOG" 2>&1

say "5. U+FFFD 복구"
node pipeline/fffd_repair.mjs --apply >> "$LOG" 2>&1

say "6. 극성 (A) 결론 표지 교체"
node pipeline/polarity_fix.mjs --apply >> "$LOG" 2>&1

say "7. 극성 (B) 해설 재생성 (API 4회)"
if [ "${SKIP_API:-0}" = "1" ]; then
  echo "   SKIP_API=1 — 건너뜀" | tee -a "$LOG"
else
  node pipeline/polarity_regen.mjs --apply >> "$LOG" 2>&1
fi

say "8. C_anchor 건별 정정 (본문 공백 + 인용 재정박)"
node pipeline/anchor_fix.mjs --apply >> "$LOG" 2>&1

say "9. cs_spans 재정박 (8단계가 본문을 고쳤으므로 다시 맞춘다)"
node pipeline/respan_reextract.mjs --apply >> "$LOG" 2>&1

say "완료 — 상세 로그 $LOG"
