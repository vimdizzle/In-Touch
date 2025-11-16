-- Create the messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow anyone to insert messages
CREATE POLICY "Allow public inserts" ON messages
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Create a policy to allow anyone to read messages (optional, for viewing)
CREATE POLICY "Allow public reads" ON messages
  FOR SELECT
  TO public
  USING (true);

