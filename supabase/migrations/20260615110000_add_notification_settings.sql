insert into platform_settings (key, value)
values (
  'notification_settings',
  '{"gate1_email": true, "gate2_email": true, "monthly_report": true, "weekly_summary": false}'
)
on conflict (key) do nothing;
