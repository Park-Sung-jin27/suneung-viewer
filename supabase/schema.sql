-- ── 1. 풀이 세션 ──────────────────────────────────────────
-- 학생이 특정 시험을 한 번 푸는 단위
CREATE TABLE IF NOT EXISTS user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_key      TEXT NOT NULL,          -- "2025수능"
  section       TEXT NOT NULL,          -- "reading" | "literature" | "all"
  mode          TEXT NOT NULL DEFAULT 'study', -- "study" | "exam"
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  score         INT,                    -- 맞은 문항 수
  total         INT,                    -- 전체 문항 수
  time_spent    INT                     -- 소요 시간 (초)
);

-- ── 2. 선지별 응답 기록 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
  year_key      TEXT NOT NULL,          -- "2025수능"
  set_id        TEXT NOT NULL,          -- "r2025a"
  question_id   INT NOT NULL,           -- 1
  choice_num    INT NOT NULL,           -- 학생이 고른 선지 번호
  is_correct    BOOLEAN NOT NULL,       -- 정오
  pat           TEXT,                   -- 틀렸을 때 오답 패턴 (R1~R4, L1~L5, "0"=수동검토)
  time_spent    INT,                    -- 해당 문항 소요 시간 (초)
  reviewed_at   TIMESTAMPTZ,           -- 재출제 후 다시 풀면 업데이트
  next_review   TIMESTAMPTZ,           -- 다음 재출제 예정일 (스페이스드 리피티션)
  review_count  INT NOT NULL DEFAULT 0, -- 재출제 횟수
  answered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. 패턴별 누적 통계 (집계 캐시) ─────────────────────────
CREATE TABLE IF NOT EXISTS user_stats (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_answered INT NOT NULL DEFAULT 0,
  total_correct  INT NOT NULL DEFAULT 0,
  streak_days   INT NOT NULL DEFAULT 0,  -- 연속 학습일
  last_studied  DATE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. 구독 상태 ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan            TEXT NOT NULL DEFAULT 'free', -- "free" | "pro"
  status          TEXT NOT NULL DEFAULT 'active', -- "active" | "cancelled" | "expired"
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  toss_order_id   TEXT,                 -- 토스페이먼츠 주문 ID
  toss_payment_key TEXT,                -- 토스페이먼츠 결제 키
  UNIQUE(user_id)
);

-- ── 5. 인덱스 ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_answers_user     ON user_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_review   ON user_answers(user_id, next_review) WHERE next_review IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_answers_set      ON user_answers(user_id, set_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON user_sessions(user_id);

-- ── 6. RLS 활성화 ─────────────────────────────────────────
ALTER TABLE user_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_answers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;

-- ── 7. RLS 정책 — 본인 데이터만 접근 ────────────────────────
CREATE POLICY "본인 세션만" ON user_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "본인 응답만" ON user_answers
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "본인 통계만" ON user_stats
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "본인 구독만" ON subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- ── 8. user_stats 자동 생성 트리거 ──────────────────────────
CREATE OR REPLACE FUNCTION create_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats(user_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_stats();

-- ── 9. user_stats upsert RPC ────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_user_stats(
  p_user_id UUID,
  p_correct  BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_stats(user_id, total_answered, total_correct, streak_days, last_studied, updated_at)
  VALUES (
    p_user_id, 1,
    CASE WHEN p_correct THEN 1 ELSE 0 END,
    1, CURRENT_DATE, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_answered = user_stats.total_answered + 1,
    total_correct  = user_stats.total_correct + CASE WHEN p_correct THEN 1 ELSE 0 END,
    streak_days = CASE
      WHEN user_stats.last_studied = CURRENT_DATE     THEN user_stats.streak_days
      WHEN user_stats.last_studied = CURRENT_DATE - 1 THEN user_stats.streak_days + 1
      ELSE 1
    END,
    last_studied = CURRENT_DATE,
    updated_at   = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 10. 무료/유료 접근 제어 함수 ──────────────────────────────
-- 무료: 최근 2개 시험 (2026수능, 2025수능)
-- 유료: 전체
CREATE OR REPLACE FUNCTION is_pro(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = uid
      AND plan = 'pro'
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$ LANGUAGE sql SECURITY DEFINER;
