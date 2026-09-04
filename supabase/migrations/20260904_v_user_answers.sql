-- v_user_answers — 답안 조회에 이메일을 붙인다 (관리용)
--
-- ★ 이 뷰는 auth.users 를 조인한다. 열어 두는 대상이 곧 유출 범위다.
--   user_answers 에는 RLS 「본인 응답만」(auth.uid() = user_id)이 걸려 있는데,
--   Postgres 뷰는 기본적으로 **뷰 소유자 권한**으로 실행되므로 그 RLS 를 우회한다.
--   anon / authenticated 에 열면 로그인한 학생이 남의 답안과 전 회원 이메일을
--   그대로 조회할 수 있다. anon 키는 클라이언트 번들에 들어 있어 사실상 공개다.
--   그래서 service_role 로만 연다 — 서버(api/*.js)와 SQL Editor 에서만 쓴다.
--
-- ★ 클라이언트에서 「내 이메일」이 필요하면 이 뷰를 쓰지 말 것.
--   세션에 이미 있다: supabase.auth.getUser() → data.user.email

create or replace view public.v_user_answers as
select
  ua.*,
  u.email
from public.user_answers ua
join auth.users u on u.id = ua.user_id;

-- 권한: 기본으로 딸려오는 것을 먼저 걷어내고 service_role 에만 준다.
--   revoke 를 grant 앞에 둔다 — 순서가 바뀌면 잠깐이라도 열린 창이 생긴다.
revoke all on public.v_user_answers from public;
revoke all on public.v_user_answers from anon, authenticated;
grant select on public.v_user_answers to service_role;

comment on view public.v_user_answers is
  '관리용. user_answers + auth.users.email. service_role 전용 — anon/authenticated 에 grant 금지.';

-- ── 적용 뒤 확인 (SQL Editor 에서 그대로 돌려 보십시오) ────────────────────
--
-- ① 권한이 service_role 에만 있는가 — 결과가 service_role 한 줄이어야 한다
--   select grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_name = 'v_user_answers';
--
-- ② 뷰가 실제로 도는가
--   select count(*) from public.v_user_answers;
--
-- ③ anon 으로는 막히는가 — 「permission denied」가 나와야 정상이다
--   set role anon;
--   select count(*) from public.v_user_answers;   -- ERROR 를 기대한다
--   reset role;
