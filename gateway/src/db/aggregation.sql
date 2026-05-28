INSERT INTO token_hourly_stats (hour, provider, model,
  prompt_tokens, completion_tokens, total_tokens,
  cache_read_tokens, cache_creation_tokens,
  input_cost, output_cost, total_cost,
  request_count, avg_latency_ms, avg_first_token_ms)
SELECT
  date_trunc('hour', created_at) AS hour,
  provider, model,
  SUM(prompt_tokens), SUM(completion_tokens), SUM(total_tokens),
  SUM(cache_read_tokens), SUM(cache_creation_tokens),
  SUM(input_cost), SUM(output_cost), SUM(total_cost),
  COUNT(*), AVG(latency_ms)::int, AVG(first_token_ms)::int
FROM usage_logs
WHERE created_at >= date_trunc('hour', NOW() - INTERVAL '2 hours')
  AND created_at < date_trunc('hour', NOW())
GROUP BY hour, provider, model
ON CONFLICT (hour, provider, model) DO UPDATE SET
  prompt_tokens = EXCLUDED.prompt_tokens,
  completion_tokens = EXCLUDED.completion_tokens,
  total_tokens = EXCLUDED.total_tokens,
  cache_read_tokens = EXCLUDED.cache_read_tokens,
  cache_creation_tokens = EXCLUDED.cache_creation_tokens,
  input_cost = EXCLUDED.input_cost,
  output_cost = EXCLUDED.output_cost,
  total_cost = EXCLUDED.total_cost,
  request_count = EXCLUDED.request_count,
  avg_latency_ms = EXCLUDED.avg_latency_ms,
  avg_first_token_ms = EXCLUDED.avg_first_token_ms,
  updated_at = NOW();
