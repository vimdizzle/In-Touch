-- Add is_pinned column to contacts table
ALTER TABLE contacts
ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE NOT NULL;

