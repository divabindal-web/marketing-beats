-- Performance Data schema — SEO / ORM / Paid metrics
-- Run in the Supabase SQL editor after schema.sql.
-- Backs the /performance-data/* dashboards once live uploads are wired.
-- Wide month columns from the tracker sheet are stored UNPIVOTED (one row per month).

-- Generic month-over-month metric series (SEO, Social, and summary metrics)
CREATE TABLE IF NOT EXISTS perf_metric_series (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,          -- 'seo' | 'social' | ...
  entity TEXT NOT NULL,          -- 'SQY - SEO', 'INCO - IN', 'UM', ...
  metric TEXT NOT NULL,          -- 'clicks', 'orgLeadVol', 'orgShare', ...
  month DATE NOT NULL,           -- first of month, e.g. 2026-04-01
  value NUMERIC,
  baseline NUMERIC,
  target NUMERIC,
  is_pct BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  source_file TEXT,
  UNIQUE (domain, entity, metric, month)
);

-- ORM review records (per platform / location, month over month)
CREATE TABLE IF NOT EXISTS perf_orm_review (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vertical TEXT,                 -- 'Square Yards India', 'INCO', 'UM', ...
  platform TEXT NOT NULL,        -- 'Glassdoor', 'GMB - Vijayawada', ...
  link TEXT,
  month DATE NOT NULL,
  reviews INTEGER,
  rating NUMERIC,
  target NUMERIC,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  source_file TEXT,
  UNIQUE (platform, month)
);

-- Paid campaign performance (per team / POC, monthly)
CREATE TABLE IF NOT EXISTS perf_paid_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team TEXT NOT NULL,            -- 'INCO-GCC', 'INCO-IN', 'IPM', ...
  poc TEXT,
  month DATE NOT NULL,
  budget NUMERIC,
  spend NUMERIC,
  revenue NUMERIC,
  roas NUMERIC,
  total_leads INTEGER,
  qualified INTEGER,
  meetings INTEGER,
  wins INTEGER,
  cpl NUMERIC,
  cpc NUMERIC,
  revenue_share NUMERIC,
  notes TEXT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  source_file TEXT,
  UNIQUE (team, month)
);

-- RLS (mirrors the existing schema.sql conventions)
ALTER TABLE perf_metric_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_orm_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_paid_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read metric series" ON perf_metric_series FOR SELECT TO authenticated USING (true);
CREATE POLICY "write metric series" ON perf_metric_series FOR ALL TO authenticated USING (true);
CREATE POLICY "read orm" ON perf_orm_review FOR SELECT TO authenticated USING (true);
CREATE POLICY "write orm" ON perf_orm_review FOR ALL TO authenticated USING (true);
CREATE POLICY "read paid" ON perf_paid_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "write paid" ON perf_paid_performance FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_metric_series_lookup ON perf_metric_series(domain, entity, metric, month);
CREATE INDEX IF NOT EXISTS idx_orm_lookup ON perf_orm_review(platform, month);
CREATE INDEX IF NOT EXISTS idx_paid_lookup ON perf_paid_performance(team, month);
