-- Migration: Add phone and email fields to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;
