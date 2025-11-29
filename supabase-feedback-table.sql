-- Feedback table for user feedback submissions

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  feedback TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can insert their own feedback
CREATE POLICY "Users can insert own feedback" ON feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can view their own feedback (optional, for future use)
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT
  USING (auth.uid() = user_id);

