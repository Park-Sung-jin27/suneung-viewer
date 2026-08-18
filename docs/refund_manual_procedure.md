# 환불 수동 처리 절차 (발주 D-4 ④ · 2026-08-18)

> 토스 웹훅은 구현하지 않았다(판정 265 ⑤). 환불해도 `subscriptions` 는 자동으로 바뀌지 않는다.
> **고객 20명을 넘으면 웹훅 구현을 재판정한다.**

1. 토스페이먼츠 관리자에서 해당 결제를 **환불**한다.
2. Supabase SQL Editor 에서 구독을 해지 처리한다.
   ```sql
   update subscriptions set status = 'canceled'
   where user_id = '<환불한 사용자 UUID>';
   ```
3. 반영을 확인한다. `is_pro()` 는 `status='active'` 만 참으로 보므로 이 한 줄로 Pro 가 닫힌다.
   ```sql
   select user_id, plan, status, expires_at from subscriptions
   where user_id = '<환불한 사용자 UUID>';
   ```
4. 사용자 UUID 는 결제 실패 알림(Discord) 또는 `subscriptions.toss_order_id`(`order_{userId}_{ts}`)에서 얻는다.
5. 사용자는 다음 페이지 새로고침부터 Pro 가 닫힌다. 즉시 반영이 필요하면 재로그인을 안내한다.
