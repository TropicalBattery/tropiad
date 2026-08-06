-- Link approved overstock recommendations to queued selections and generated posts.
-- All columns are additive and nullable so existing queueOverstockSelection,
-- runOverstockAnalysis, and generateConcepts INSERTs remain unaffected.

-- 1) manual_queue row -> overstock_score recommendation that spawned it
alter table ads.overstock_selections
  add column if not exists source_recommendation_id uuid
    references ads.overstock_selections(id) on delete set null;

comment on column ads.overstock_selections.source_recommendation_id is
  'Self-FK: when set on a manual_queue row, points at the overstock_score recommendation that was approved to create this queue. Null for plain manual queues.';

-- 2) AI strategy snapshot copied onto the queue at approve time (ideation self-contained)
alter table ads.overstock_selections
  add column if not exists campaign_strategy jsonb;

comment on column ads.overstock_selections.campaign_strategy is
  'Optional copy of ai_review strategy (campaign_angle, target_audience, customer_problem, narrative) for queued rows driven by an approved recommendation. Null for plain manual queues.';

-- 3) post -> recommendation for traceability / future ROI
alter table ads.posts
  add column if not exists overstock_recommendation_id uuid
    references ads.overstock_selections(id) on delete set null;

comment on column ads.posts.overstock_recommendation_id is
  'When set, this post was generated from an approved overstock recommendation. Null for regular (non-overstock) posts.';
