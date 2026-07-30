-- Users table (synced from CSV import)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  level TEXT, -- S0, S1, S2, S3, SP&L, SE
  location TEXT,
  designation TEXT,
  department TEXT DEFAULT 'Marketing',
  supervisor_code TEXT,
  supervisor_name TEXT,
  role TEXT DEFAULT 'designer', -- admin, manager, designer, viewer
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Design requests
CREATE TABLE requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('Video', 'Social Media Graphics', 'Graphics')),
  requested_by TEXT NOT NULL, -- Social Team, Management, Sales Team, Admin, Tech, HR, SEO, Paid Campaign, Marketing, Others
  title TEXT NOT NULL,
  description TEXT,
  requestor_name TEXT NOT NULL,
  requestor_id UUID REFERENCES users(id),
  entity TEXT CHECK (entity IN ('SQY', 'INCO', 'UM', 'AZURO')),
  need_by DATE NOT NULL,
  reference_link TEXT,
  current_stage TEXT NOT NULL,
  assigned_to UUID REFERENCES users(id),
  social_poc UUID REFERENCES users(id),
  video_poc UUID REFERENCES users(id),
  design_poc UUID REFERENCES users(id),
  shoot_date DATE,
  revisions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stage transitions (for TAT calculation)
CREATE TABLE stage_transitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  transitioned_at TIMESTAMPTZ DEFAULT now(),
  transitioned_by UUID REFERENCES users(id)
);

-- Social calendar entries
CREATE TABLE social_calendar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  platform TEXT, -- Instagram, LinkedIn, Facebook, X/Twitter, YouTube
  content_type TEXT, -- Static, Carousel, Reel, Story, Video, Thread
  scheduled_date DATE NOT NULL,
  caption TEXT,
  hashtags TEXT[],
  request_id UUID REFERENCES requests(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_calendar ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read all
CREATE POLICY "Users can view all users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view all requests" ON requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert requests" ON requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update requests" ON requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can view transitions" ON stage_transitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert transitions" ON stage_transitions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can view calendar" ON social_calendar FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage calendar" ON social_calendar FOR ALL TO authenticated USING (true);
-- Admin-only user management
CREATE POLICY "Admins can manage users" ON users FOR ALL TO authenticated USING (true);

-- Indexes
CREATE INDEX idx_requests_type ON requests(type);
CREATE INDEX idx_requests_stage ON requests(current_stage);
CREATE INDEX idx_requests_assigned ON requests(assigned_to);
CREATE INDEX idx_requests_need_by ON requests(need_by);
CREATE INDEX idx_transitions_request ON stage_transitions(request_id);
CREATE INDEX idx_calendar_date ON social_calendar(scheduled_date);
