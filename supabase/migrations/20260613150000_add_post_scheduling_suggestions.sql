alter table posts add column if not exists suggested_time_tag text;
alter table posts add column if not exists suggested_scheduled_at timestamptz;
