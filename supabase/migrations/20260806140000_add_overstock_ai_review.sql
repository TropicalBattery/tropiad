-- Additive AI review payload for scored overstock recommendations.
-- Holds interpretive enrichment (narrative, campaign_angle, target_audience,
-- customer_problem, advertisable, optional notes) produced by Claude after
-- deterministic scoring. Does not alter opportunity_score, rank, or selection
-- order. Nullable so manual_queue INSERTs and existing analysis INSERTs are
-- unaffected.

alter table ads.overstock_selections
  add column if not exists ai_review jsonb;

comment on column ads.overstock_selections.ai_review is
  'AI interpretive review enriching a deterministic overstock recommendation (narrative, campaign angle, audience, customer problem). Null for manual_queue rows and pre-review score rows. Never used to re-rank.';
