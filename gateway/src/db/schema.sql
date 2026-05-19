-- ① api_keys — 代理启动时就要用它查上游地址和密钥
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    VARCHAR(32) NOT NULL,
  key_alias   VARCHAR(64) NOT NULL,
  key_value   TEXT NOT NULL,
  base_url    VARCHAR(256),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, key_alias)
);

-- ② model_pricing — recorder 写 usage 时就要用它算成本
CREATE TABLE model_pricing (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          VARCHAR(32) NOT NULL,
  model             VARCHAR(64) NOT NULL,
  input_price       DECIMAL(16,8) NOT NULL,
  output_price      DECIMAL(16,8) NOT NULL,
  cache_read_price  DECIMAL(16,8) DEFAULT 0,
  cache_write_price DECIMAL(16,8) DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, model)
);

-- ③ usage_logs — 核心表，所有数据的终点
CREATE TABLE usage_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        VARCHAR(64) NOT NULL,
  provider          VARCHAR(32) NOT NULL,
  model             VARCHAR(64) NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens         INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens     INTEGER NOT NULL DEFAULT 0,
  cache_creation_5m_tokens  INTEGER NOT NULL DEFAULT 0,
  cache_creation_1h_tokens  INTEGER NOT NULL DEFAULT 0,
  input_cost        DECIMAL(16,8) NOT NULL DEFAULT 0,
  output_cost       DECIMAL(16,8) NOT NULL DEFAULT 0,
  total_cost        DECIMAL(16,8) NOT NULL DEFAULT 0,
  api_key_id        VARCHAR(64),
  endpoint          VARCHAR(64),
  is_streaming      BOOLEAN NOT NULL DEFAULT FALSE,
  status_code       INTEGER,
  latency_ms        INTEGER,
  first_token_ms    INTEGER,
  user_agent        VARCHAR(256),
  usage_captured    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX idx_usage_logs_provider_model_time ON usage_logs(provider, model, created_at);

-- ④ token_hourly_stats — 聚合表，加速仪表板查询
CREATE TABLE token_hourly_stats (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hour                  TIMESTAMPTZ NOT NULL,
  provider              VARCHAR(32) NOT NULL,
  model                 VARCHAR(64) NOT NULL,
  prompt_tokens         BIGINT NOT NULL DEFAULT 0,
  completion_tokens     BIGINT NOT NULL DEFAULT 0,
  total_tokens          BIGINT NOT NULL DEFAULT 0,
  cache_read_tokens     BIGINT NOT NULL DEFAULT 0,
  cache_creation_tokens BIGINT NOT NULL DEFAULT 0,
  input_cost            DECIMAL(16,8) NOT NULL DEFAULT 0,
  output_cost           DECIMAL(16,8) NOT NULL DEFAULT 0,
  total_cost            DECIMAL(16,8) NOT NULL DEFAULT 0,
  request_count         INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms        INTEGER NOT NULL DEFAULT 0,
  avg_first_token_ms    INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hour, provider, model)
);
