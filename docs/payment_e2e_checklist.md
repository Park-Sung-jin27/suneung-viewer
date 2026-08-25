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

---

# 실행 결과 — 2026-08-21 (발주 F-26)

> 수행 환경: Vercel **Preview** (`e2e/payment-preview` 브랜치, `test_ck_`/`test_sk_`).
> 차단 스위치 2개(`public/suneung/index.html` `PAYMENT_TEMPORARILY_DISABLED`,
> `src/Payment.jsx` 스탠다드 `available`)를 해제한 상태로 수행했다.
> 값은 **심사관·대표 실측**이며, 프론트(Code A)가 대신 측정한 값이 아니다.

## 판정: 4/4 합격 → main 머지(`fe9a4d7`) → Production 재배포 완료

| # | 항목 | 실측 | 판정 |
|---|---|---|---|
| ① | 정상 결제 → Pro 세트 실제 열림 | `growth27` 계정에 **신규 구독 생성**, 뷰어에서 **`/api/pro-data` 200** | 합격 |
| ② | 재결제 → 만료일 연장 | `expires_at` = **`2026-09-25T15:01:00.654Z`** = 직전값 + 1개월. **밀리초까지 보존** = 덮어쓰기가 아니라 연장 | 합격 |
| ③ | 89,000원 거절 | **400 `Invalid subscription amount`** (로그인 세션 기준). 비로그인은 **401 선행** | 합격 |
| ④ | 권한 부여 실패 → 안내·알림 | 화면 문구 표시 + Discord 알림 수신, **알림에 민감정보 없음**, DB 무결 | 합격 |

②의 합격 근거는 **밀리초(`.654Z`)가 보존됐다**는 점이다. 오늘 기준으로 다시 계산했다면
밀리초가 달라진다. 잔여 기간이 살아서 그 끝에 1개월이 더해졌다는 직접 증거다.

## ④ 재현 방법 (다음 회차에 재사용)

체크리스트 4번 원문 SQL은 그대로 쓰면 실패한다. `plan='pro'` 행이 이미 있으면
`ADD CONSTRAINT` 가 기존 행 검사에서 에러난다. **`not valid`** 를 붙여야 한다 —
기존 행 검사는 건너뛰고 신규 INSERT/UPDATE 에만 적용된다.

```sql
alter table subscriptions add constraint tmp_block check (plan <> 'pro') not valid;
-- 39,900원 결제 1건 수행 → 화면·Discord·DB 확인
alter table subscriptions drop constraint tmp_block;   -- 반드시 제거
```

🔴 제약이 남아 있으면 **모든 실고객 결제의 권한 부여가 실패**한다. 확인:

```sql
select conname from pg_constraint where conrelid = 'subscriptions'::regclass;
```

🔴 `ORDER_DISCORD_WEBHOOK_URL` 이 Preview 스코프에 없으면 알림이 **오류 없이 건너뛴다**
(`skipped: true`). 그러면 ④는 합격/불합격 판정 자체가 성립하지 않는다.
이번 회차를 위해 Preview 에 등록했고, 다음 회차를 위해 **유지한다**.

## 서버 응답 계약

| 상황 | HTTP | body |
|---|---|---|
| 정상 | 200 | `{ ok: true, plan: "pro" }` |
| 금액 화이트리스트 밖 | 400 | `{ error: "Invalid subscription amount" }` |
| orderId 사용자 불일치 | 403 | `{ error: "Order does not match user" }` |
| Toss 승인 실패 | 402 | `{ error: "Payment confirmation failed" }` |
| **승인 성공 + 권한 부여 실패** | **500** | **`{ error: "Subscription update failed", code: "ENTITLEMENT_FAILED" }`** |

`ENTITLEMENT_FAILED` 는 **돈이 이미 나간 상태**다. 「결제 실패」로 알리면 안 된다.
클라이언트는 `src/App.jsx` 결제 확인 effect 에서 이 `code` 를 따로 분기한다.

## 오픈 검증 (Production)

| 항목 | 실측 |
|---|---|
| 번들 클라이언트 키 | **`live_ck_6BYq…`** |
| 서버 시크릿 키 | `live_sk_` (키 짝 정합 확인) |
| 진단 호출 | Toss `tossCode: NOT_FOUND_PAYMENT_SESSION` — 라이브 경로가 살아 있다는 증거 |
| 결제창 금액 | **39,900원** |
| `/suneung/` 정적 페이지 | `PAYMENT_TEMPORARILY_DISABLED = false` |
| `/payment` 「결제 준비 중입니다」 | **0건** (해제 전에는 노출) |
| 89,000 프리미엄 | `available: false` 유지 — 「출시 준비 중」 배지 1건 |

## 남긴 것

- 브랜치 `e2e/payment-preview` **보존** (다음 E2E 재사용).
- Preview 환경변수 `test_ck_`/`test_sk_`/`ORDER_DISCORD_WEBHOOK_URL` **유지**.
- 89,000원 상품은 `ALLOWED_AMOUNTS` 에 없다. 열려면 **서버 금액 등록과 함께 별도 발주**.
