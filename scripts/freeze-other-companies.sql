-- Freeze all demo/test tenants; activate Tropical Battery only.
-- Reversible: set status back to 'active' / 'setup' as needed.
-- Run manually against the tropiAd Supabase project.

UPDATE companies
SET status = 'paused'
WHERE slug <> 'tropical-battery';

UPDATE companies
SET status = 'active'
WHERE slug = 'tropical-battery';

-- Verify:
-- SELECT id, name, slug, status FROM companies ORDER BY name;
