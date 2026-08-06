alter table brand_configs
  add column if not exists notification_emails text[] default '{}';
