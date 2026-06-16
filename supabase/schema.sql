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
  attempt_count INT NOT NULL DEFAULT 1,
  choice_text   TEXT,
  correct_choice_num  INT,
  correct_choice_text TEXT,
  question_type TEXT,
  answered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_answers ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 1;
ALTER TABLE user_answers ADD COLUMN IF NOT EXISTS choice_text TEXT;
ALTER TABLE user_answers ADD COLUMN IF NOT EXISTS correct_choice_num INT;
ALTER TABLE user_answers ADD COLUMN IF NOT EXISTS correct_choice_text TEXT;
ALTER TABLE user_answers ADD COLUMN IF NOT EXISTS question_type TEXT;

CREATE TABLE IF NOT EXISTS question_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_key  TEXT NOT NULL,
  user_question TEXT NOT NULL,
  ai_answer     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage_monthly (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key   TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',
  limit_count INT NOT NULL DEFAULT 3,
  used_count  INT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month_key)
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key   TEXT NOT NULL,
  task        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pat                TEXT NOT NULL,
  section            TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'approved',
  quality_score      INT NOT NULL DEFAULT 50,
  source_year_key    TEXT,
  source_set_id      TEXT,
  source_question_id INT,
  source_choice_num  INT,
  passage            TEXT NOT NULL,
  sentence           TEXT NOT NULL,
  is_correct         BOOLEAN NOT NULL,
  evidence_sentence  TEXT,
  explanation        TEXT,
  source_label       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_attempts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  training_item_id   UUID REFERENCES training_items(id) ON DELETE SET NULL,
  pat                TEXT NOT NULL,
  selected_answer    TEXT NOT NULL,
  is_correct         BOOLEAN NOT NULL,
  source_year_key    TEXT,
  source_set_id      TEXT,
  source_question_id INT,
  source_choice_num  INT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_unique_question
  ON user_answers(user_id, year_key, set_id, question_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_question_comments_user_question
  ON question_comments(user_id, question_key, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_month
  ON ai_usage_events(user_id, month_key, created_at);
CREATE INDEX IF NOT EXISTS idx_training_items_pat_status
  ON training_items(pat, status, quality_score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_items_source_choice
  ON training_items(source_year_key, source_set_id, source_question_id, source_choice_num, pat)
  WHERE source_year_key IS NOT NULL
    AND source_set_id IS NOT NULL
    AND source_question_id IS NOT NULL
    AND source_choice_num IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_training_attempts_user_pat
  ON training_attempts(user_id, pat, created_at DESC);

-- ── 6. RLS 활성화 ─────────────────────────────────────────
ALTER TABLE user_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_answers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attempts ENABLE ROW LEVEL SECURITY;

-- ── 7. RLS 정책 — 본인 데이터만 접근 ────────────────────────
CREATE POLICY "본인 세션만" ON user_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "본인 응답만" ON user_answers
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "본인 통계만" ON user_stats
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "본인 구독만" ON subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "own question comments" ON question_comments
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own ai usage monthly" ON ai_usage_monthly;
CREATE POLICY "own ai usage monthly" ON ai_usage_monthly
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own ai usage events" ON ai_usage_events;
CREATE POLICY "own ai usage events" ON ai_usage_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "read approved training items" ON training_items;
CREATE POLICY "read approved training items" ON training_items
  FOR SELECT USING (status = 'approved');

DROP POLICY IF EXISTS "own training attempts" ON training_attempts;
CREATE POLICY "own training attempts" ON training_attempts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

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

CREATE OR REPLACE FUNCTION get_ai_monthly_limit(p_plan TEXT)
RETURNS INT AS $$
BEGIN
  RETURN CASE lower(coalesce(p_plan, 'free'))
    WHEN 'basic' THEN 20
    WHEN 'pro' THEN 80
    WHEN 'premium' THEN 200
    ELSE 3
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_ai_plan(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_plan TEXT;
BEGIN
  SELECT plan INTO v_plan
  FROM subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY started_at DESC
  LIMIT 1;

  RETURN coalesce(v_plan, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION consume_ai_quota(p_task TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_month_key TEXT := to_char(timezone('Asia/Seoul', now()), 'YYYY-MM');
  v_plan TEXT;
  v_limit INT;
  v_used INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_plan := get_ai_plan(v_user_id);
  v_limit := get_ai_monthly_limit(v_plan);

  INSERT INTO ai_usage_monthly(user_id, month_key, plan, limit_count, used_count, updated_at)
  VALUES (v_user_id, v_month_key, v_plan, v_limit, 0, now())
  ON CONFLICT (user_id, month_key) DO UPDATE SET
    plan = excluded.plan,
    limit_count = excluded.limit_count,
    updated_at = now()
  RETURNING used_count INTO v_used;

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'plan', v_plan,
      'month', v_month_key,
      'used', v_used,
      'limit', v_limit,
      'remaining', 0
    );
  END IF;

  UPDATE ai_usage_monthly
  SET used_count = used_count + 1,
      updated_at = now()
  WHERE user_id = v_user_id
    AND month_key = v_month_key
  RETURNING used_count INTO v_used;

  INSERT INTO ai_usage_events(user_id, month_key, task)
  VALUES (v_user_id, v_month_key, coalesce(p_task, 'unknown'));

  RETURN jsonb_build_object(
    'allowed', true,
    'plan', v_plan,
    'month', v_month_key,
    'used', v_used,
    'limit', v_limit,
    'remaining', greatest(v_limit - v_used, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION refund_ai_quota()
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_month_key TEXT := to_char(timezone('Asia/Seoul', now()), 'YYYY-MM');
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE ai_usage_monthly
  SET used_count = greatest(used_count - 1, 0),
      updated_at = now()
  WHERE user_id = v_user_id
    AND month_key = v_month_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
