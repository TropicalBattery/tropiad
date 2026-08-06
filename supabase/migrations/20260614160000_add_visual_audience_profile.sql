alter table brand_configs
  add column if not exists visual_audience_profile jsonb default '{"demographic": "local", "local_pct": 100}'::jsonb;
