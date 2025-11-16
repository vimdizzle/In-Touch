-- Migration: Add settings fields to users table

-- Add daily_reminder_time column (stores time as TEXT in HH:MM format)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS daily_reminder_time TEXT DEFAULT '09:00';

-- Add default_cadence_days column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS default_cadence_days INTEGER DEFAULT 30;

