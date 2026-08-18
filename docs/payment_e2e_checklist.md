# 결제 E2E 체크리스트 (발주 D-2 B단계 · 2026-08-18)

> 대상 배포: `f9af946` (D-4 반영분). 테스트 키 상태에서 수행한다.
> **라이브 키 전환 전에 완료해야 한다.**

## 0. 엔지니어가 이미 실측한 구간 (재확인 불요)

프로덕션 `https://www.jippi.kr/api/payment-confirm`

| 요청 | 결과 |
|---|---|
| `GET` | **405** Method not allowed |
| `POST` + `Content-Type: text/plain` | **415** |
| `POST` + JSON + 인증 헤더 없음 | **401** Login required |

가드 체인의 앞 세 단계가 배포본에서 동작한다.

## 1. 정상 결제 → Pro 화면 열림 `[합격선]`

1. 프로덕션에 로그인한다.
2. 요금제에서 **스탠다드 39,900원** 결제 → 토스 **테스트 카드**로 승인.
3. 리다이렉트 후 **Pro 회차(무료 5개년 밖)가 열리는지** 확인한다.
   ★ 「결제 성공」 화면이 아니라 **Pro 세트가 실제로 열리는 것**이 합격선이다.
4. 열리지 않으면 브라우저를 새로고침한다. `is_pro` 는 로그인 세션 변화 시점에만 조회된다.
5. DB 확인:
   ```sql
   select user_id, plan, status, expires_at, toss_order_id
   from subscriptions where user_id = '<내 UUID>';
   ```
   **기대**: `plan='pro'` · `status='active'` · `expires_at` = **결제일 + 1개월**

## 2. 재결제 → 만료일 연장

1. 1번 상태에서 **한 번 더** 39,900원 결제한다.
2. 위 SQL 재실행.
   **기대**: `expires_at` 이 **직전 값 + 1개월** (오늘 기준이 아니다).
   덮어쓰기면 결함이다 — 잔여 기간이 사라진 것이다.

## 3. 89,000원 거절

로그인 상태에서 **브라우저 콘솔**에 붙여 넣는다. 카드 입력이 필요 없다.

```js
const { data: { session } } = await window.supabase.auth.getSession();
const r = await fetch("/api/payment-confirm", {
  method: "POST",
  headers: { "Content-Type": "application/json",
             Authorization: `Bearer ${session.access_token}` },
  body: JSON.stringify({ paymentKey: "x", orderId: `order_${session.user.id}_1`, amount: 89000 }),
});
console.log(r.status, await r.json());
```
**기대**: `400 { error: "Invalid subscription amount" }`
※ `amount` 검증(③)이 토스 호출(⑤)보다 앞이므로 **실제 결제가 발생하지 않는다.**
※ `window.supabase` 가 없으면 이 검증은 심사관이 아니라 대표가 Supabase 대시보드에서 토큰을 얻어 curl 로 수행한다.

## 4. 권한 부여 실패 → Discord 알림

실패를 인위적으로 만들어야 한다. **DB 제약을 잠깐 건다.**

1. Supabase 에서 일시적으로 제약을 추가한다.
   ```sql
   alter table subscriptions add constraint tmp_block check (plan <> 'pro');
   ```
2. 39,900원 결제를 한 번 더 한다(테스트 카드).
3. **기대**
   - 화면: 「결제는 완료됐습니다. 이용권 활성화에 문제가 있어 확인 중입니다.」 + 문의처
     ★ 「결제 확인에 실패했습니다」가 뜨면 분기가 잘못된 것이다.
   - Discord: `[JIPPI 결제] 권한 부여 실패 — 수동 확인 필요` + userId/orderId/paymentKey/plan/reason/at
   - 알림에 **카드정보·시크릿 키가 없어야 한다.**
4. 제약을 반드시 제거한다.
   ```sql
   alter table subscriptions drop constraint tmp_block;
   ```
5. 테스트로 나간 결제는 토스에서 환불하고, `docs/refund_manual_procedure.md` 대로 정리한다.

🔴 `ORDER_DISCORD_WEBHOOK_URL` 은 **Production 전용**이다.
   Preview 배포에서 이 시험을 하면 알림은 **오류 없이 건너뛴다**(`skipped: true`).
   **반드시 Production 에서 테스트 키로 수행한다.**

## 5. 실패 경로 (B-2)

| 경우 | 기대 화면 |
|---|---|
| 결제창 닫기 | 「결제가 취소됐습니다」 후 홈 이동 (`code` 파라미터 분기) |
| 카드 거절 | 토스 승인 실패 → `402` → 「결제 확인에 실패했습니다」 |
| 승인 API 오류 | `500` → 위 4번의 ENTITLEMENT_FAILED 문구 또는 일반 오류 |

## 6. 중복 결제 (B-3)

같은 사용자가 두 번 결제하면 `subscriptions` 는 `UNIQUE(user_id)` 라 **행이 하나로 유지**되고
만료일만 연장된다(2번 항목). **행이 두 개 생기면 결함이다.**

## 완료 조건

1~4 전부 기대대로일 때만 라이브 키 전환으로 넘어간다.
