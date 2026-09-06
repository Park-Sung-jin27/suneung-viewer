-- signup_attribution — 가입 유입 경로 기록 (발주 F-69)
--
-- ★ 이 파일의 목적은 둘이다: 「이미 있는 것의 기록」 + 「새 환경 재현」.
--   테이블은 프로덕션에 이미 존재한다(대시보드에서 생성됨). 이 파일을 DB 에
--   실행한 적은 없다. 그래서 멱등형으로 쓴다 — 재실행해도 실패하지 않는다.
--   (schema.sql 이 CREATE TABLE IF NOT EXISTS 를 쓰는 것과 같은 이유)
--
-- 실측 근거: 대시보드 SQL 조회(2026-09-06), rls_enabled = true
--   constraints:
--     signup_attribution_pkey         :: PRIMARY KEY (id)
--     signup_attribution_user_id_fkey :: FOREIGN KEY (user_id)
--                                        REFERENCES auth.users(id) ON DELETE CASCADE
--
-- ⚠ user_id 유일성 — pg_constraint 조회에는 UNIQUE 제약이 없었다(위 둘뿐).
--   앞선 인덱스 실측에는 unique(user_id) 가 있었으므로 실물은 제약이 아니라
--   유니크 인덱스로 보인다. 아래는 발주 지시대로 컬럼에 unique 를 선언한다.
--   새 환경에서의 동작은 같다 — 중복 INSERT 는 23505 로 막히고,
--   src/attribution.js 의 23505 처리("이미 기록됨")도 그대로 맞는다.
--   차이는 제약 이름뿐이다.
--
-- 쓰는 곳
--   src/attribution.js        가입 직후 1회 INSERT (첫 유입 채널 보존)
--   scripts/signup_channels.mjs  채널별 가입자 수 조회 (읽기 전용)

begin;

create table if not exists public.signup_attribution (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  landing_path  text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

-- 이미 켜져 있으면 무해한 no-op 이다.
alter table public.signup_attribution enable row level security;

-- CREATE POLICY 에는 IF NOT EXISTS 가 없다. drop → create 로 재실행 안전하게 한다.
drop policy if exists "own signup attribution insert" on public.signup_attribution;
create policy "own signup attribution insert" on public.signup_attribution
  for insert with check (auth.uid() = user_id);

drop policy if exists "own signup attribution select" on public.signup_attribution;
create policy "own signup attribution select" on public.signup_attribution
  for select using (auth.uid() = user_id);

-- ★ UPDATE / DELETE 정책은 두지 않는다(실물도 없다).
--   유입 채널은 가입 1회만 쓰고 이후 방문의 UTM 으로 덮어쓰지 않는다(발주 F-69 ③).
--   쓸 수 있는 경로를 아예 만들지 않는 것이 그 규율을 DB 쪽에서 받쳐 준다.

commit;
