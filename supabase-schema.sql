-- DMMA Poster Generator Database Schema
-- Run this in your Supabase SQL Editor

-- Templates table
CREATE TABLE poster_gen__templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  preview_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backgrounds table
CREATE TABLE poster_gen__backgrounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chats table (Telegram chat groups)
CREATE TABLE poster_gen__chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT UNIQUE NOT NULL,
  chat_name TEXT,
  approval_code TEXT UNIQUE NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  assigned_template_id UUID REFERENCES poster_gen__templates(id) ON DELETE SET NULL,
  assigned_background_id UUID REFERENCES poster_gen__backgrounds(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Generated posters cache table
CREATE TABLE poster_gen__cached_posters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL REFERENCES poster_gen__chats(chat_id) ON DELETE CASCADE,
  poster_date DATE NOT NULL,
  storage_path TEXT NOT NULL,
  template_id UUID REFERENCES poster_gen__templates(id) ON DELETE CASCADE,
  background_id UUID REFERENCES poster_gen__backgrounds(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chat_id, poster_date)
);

-- Create indexes for faster lookups
CREATE INDEX idx_chats_chat_id ON poster_gen__chats(chat_id);
CREATE INDEX idx_chats_approval_code ON poster_gen__chats(approval_code);
CREATE INDEX idx_cached_posters_chat_date ON poster_gen__cached_posters(chat_id, poster_date);

-- Enable Row Level Security (RLS)
ALTER TABLE poster_gen__templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE poster_gen__backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE poster_gen__chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE poster_gen__cached_posters ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - you can restrict later)
CREATE POLICY "Allow all operations on templates" ON poster_gen__templates FOR ALL USING (true);
CREATE POLICY "Allow all operations on backgrounds" ON poster_gen__backgrounds FOR ALL USING (true);
CREATE POLICY "Allow all operations on chats" ON poster_gen__chats FOR ALL USING (true);
CREATE POLICY "Allow all operations on cached posters" ON poster_gen__cached_posters FOR ALL USING (true);

-- Function to generate approval code
CREATE OR REPLACE FUNCTION generate_approval_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude similar looking chars
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate approval code
CREATE OR REPLACE FUNCTION set_approval_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.approval_code IS NULL OR NEW.approval_code = '' THEN
    NEW.approval_code := generate_approval_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_approval_code
BEFORE INSERT ON poster_gen__chats
FOR EACH ROW
EXECUTE FUNCTION set_approval_code();
