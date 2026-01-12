-- Add 'approved' to lead_status enum
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'approved';