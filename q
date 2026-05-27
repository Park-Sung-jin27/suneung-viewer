[1mdiff --git a/src/Payment.jsx b/src/Payment.jsx[m
[1mindex 8e9b857..81f10f5 100644[m
[1m--- a/src/Payment.jsx[m
[1m+++ b/src/Payment.jsx[m
[36m@@ -1,4 +1,4 @@[m
[31m-// ============================================================[m
[32m+[m[32m﻿// ============================================================[m
 // Payment.jsx — 3티어 구독 결제 (스타터/스탠다드/프리미엄)[m
 // 토스페이먼츠 가맹점 심사 완료 전: 스탠다드·프리미엄 "준비 중" 처리[m
 // ============================================================[m
[36m@@ -61,7 +61,7 @@[m [mconst PLANS = [[m
     badge: "가장 많이 선택",[m
     features: [[m
       { text: "오답 패턴 진단 + 전 시험 형광펜 복기 훈련", ok: true },[m
[31m-      { text: "오류 패턴 8종 진단 무제한", ok: true },[m
[32m+[m[32m      { text: "오류 패턴 9종 진단 무제한", ok: true },[m
       { text: "누적 개인 리포트 + 처방", ok: true },[m
       { text: "주간 진도 트래킹", ok: true },[m
       { text: "1:1 전문가 리뷰", ok: false },[m
[36m@@ -730,3 +730,4 @@[m [mexport default function Payment({ user, onPaySuccess, onFreeStart }) {[m
     </div>[m
   );[m
 }[m
[41m+[m
