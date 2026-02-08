-- Remove duplicate leads, keeping only the oldest one per contact_id
DELETE FROM leads
WHERE id NOT IN (
  SELECT DISTINCT ON (contact_id) id
  FROM leads
  ORDER BY contact_id, created_at ASC
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX idx_leads_unique_contact ON leads (contact_id);