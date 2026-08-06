create table if not exists rejection_feedback (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  gate text not null,
  reasons text[] not null default '{}',
  free_text text,
  concept_snapshot text,
  caption_snapshot text,
  created_at timestamptz default now()
);

create index if not exists idx_rejection_feedback_company
  on rejection_feedback(company_id);

create index if not exists idx_rejection_feedback_created
  on rejection_feedback(created_at);
