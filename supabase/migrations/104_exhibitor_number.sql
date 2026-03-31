-- 104: Add exhibitor_number to users for live show tag numbering
-- Format: regional exhibitor number (e.g. "042")
-- Horse tags use XXX-YYY where XXX = exhibitor_number, YYY = horse sequence

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS exhibitor_number TEXT;

-- Allow users to update their own exhibitor number
-- (existing RLS policies already cover user self-update)
