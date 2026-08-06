alter table posts add column if not exists visual_prompt text;
alter table posts add column if not exists media_provider text;
alter table posts add column if not exists media_generation_attempts integer default 0;
alter table posts add column if not exists video_operation_id text;
