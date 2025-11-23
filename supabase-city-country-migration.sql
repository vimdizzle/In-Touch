-- Migration: Add city and country fields to contacts table
-- This migration adds separate city and country fields while keeping location for backward compatibility

-- Add city and country columns
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;

-- Note: The location field is kept for backward compatibility with existing data
-- New entries should use city and country fields
-- Old location data can be migrated manually or left as-is

