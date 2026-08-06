-- Tropical Battery Brand Bible (Visual Identity) → ads.brand_configs
-- Source: TB_Brand_Bible.pdf (logo, colour, typography, imagery, layout, logo placement)
--
-- Run in Supabase SQL editor against the project that uses the `ads` schema
-- (PostgREST default schema for this app). Unqualified brand_configs resolves
-- to public and fails with 42P01.
--
-- Maps bible specs into:
--   1) Existing Settings fields already asked in onboarding/config
--      (primary_color, secondary_color, accent_color, image_style)
--   2) New columns for bible content we do not currently capture
--      (typography, full colour palette, visual guidelines JSON)
--
-- Note: This document is visual-identity only. It does not define tone,
-- target audience, USP, topics, or brand voice — those stay as human-entered
-- config fields.

-- ---------------------------------------------------------------------------
-- New columns for brand-bible depth not covered by the 3-slot colour UI
-- ---------------------------------------------------------------------------
alter table ads.brand_configs
  add column if not exists brand_typography text;

alter table ads.brand_configs
  add column if not exists brand_color_palette jsonb default '{}'::jsonb;

alter table ads.brand_configs
  add column if not exists visual_guidelines jsonb default '{}'::jsonb;

comment on column ads.brand_configs.brand_typography is
  'Primary typeface and fallback guidance from the brand bible.';
comment on column ads.brand_configs.brand_color_palette is
  'Full brand colour system (primary + secondary + print/digital specs).';
comment on column ads.brand_configs.visual_guidelines is
  'Photography, layout, and logo-placement rules for visual generation.';

-- ---------------------------------------------------------------------------
-- Seed Tropical Battery from the Brand Bible
-- company_id pinned in lib/config/single-company.ts
-- ---------------------------------------------------------------------------
update ads.brand_configs
set
  -- Existing Settings → Visual identity colours (HTML from bible colour chart)
  primary_color = '#E32726',   -- Pantone 485 C (primary red)
  secondary_color = '#212222', -- Pantone 419 C (near-black)
  accent_color = '#0047BA',    -- Pantone 2728 C (secondary blue)
  -- Closest existing image_style enum to bible lifestyle photography guidance
  image_style = 'Lifestyle',

  brand_typography =
    'Roboto (Light, Regular, Medium, Bold, Black) for all messaging, headlines, and subheads. '
    || 'Substitute Arial when Roboto is unavailable (e.g. MS Office or editable web text).',

  brand_color_palette = jsonb_build_object(
    'primary', jsonb_build_array(
      jsonb_build_object(
        'name', 'TB Red',
        'hex', '#E32726',
        'rgb', '226,35,26',
        'cmyk', '5,98,100,0',
        'pantone', '485 C',
        'role', 'primary'
      ),
      jsonb_build_object(
        'name', 'TB Black',
        'hex', '#212222',
        'rgb', '33,34,33',
        'cmyk', '72,65,65,72',
        'pantone', '419 C',
        'role', 'primary'
      ),
      jsonb_build_object(
        'name', 'White',
        'hex', '#FFFFFF',
        'rgb', '255,255,255',
        'cmyk', '0,0,0,0',
        'pantone', null,
        'role', 'primary'
      )
    ),
    'secondary', jsonb_build_array(
      jsonb_build_object(
        'name', 'Cool Gray',
        'hex', '#999899',
        'rgb', '153,152,153',
        'cmyk', '42,35,35,1',
        'pantone', 'Cool Gray 7 C',
        'role', 'secondary'
      ),
      jsonb_build_object(
        'name', 'TB Blue',
        'hex', '#0047BA',
        'rgb', '0,71,186',
        'cmyk', '95,78,0,0',
        'pantone', '2728 C',
        'role', 'secondary'
      ),
      jsonb_build_object(
        'name', 'TB Yellow',
        'hex', '#FFF737',
        'rgb', '255,247,55',
        'cmyk', '4,0,85,0',
        'pantone', '803 C',
        'role', 'secondary'
      )
    )
  ),

  visual_guidelines = jsonb_build_object(
    'lifestyle_imagery',
      'Authentic, candid, contemporary photography. Capture real moments of employees on and off site—assisting customers or performing duties—with a genuine, caring, professional presence. Prefer quick professional snapshots of real-life scenarios over staged stock.',
    'lifestyle_imagery_internal',
      'Behind-the-scenes warehouse, HQ, and off-site operations: meetings, desks, equipment use. Emphasize teamwork, dedication, and a professional atmosphere.',
    'product_imagery',
      'Well-lit product shots with an angled view. Company logo and label must be clearly visible. Hero shots emphasize product detail, quality, and brand identity.',
    'layout',
      'Minimal yet impactful. Blend images with graphical shapes. Use primary colours as the foundation; secondary colours sparingly for contrast. Prefer a subtle gradient fading from light gray at the bottom to heavier colours at the top. Clean, modern, strong presence.',
    'logo_usage',
      'Prefer positive full-colour logo. On dark backgrounds use reverse Battery/tagline text. On red backgrounds use reverse white lettering with coloured bolt. Keep clear space equal to the height of the T (and bolt weight) free of text/graphics.',
    'logo_placement',
      'Approved positions: bottom center, top center, bottom right, or bottom left, with proximity margins. Center placement allowed when integrated into headline or referencing the Tropical Battery name. Logo not required when branding is already prominent (branded products, structures, apparel).'
  ),

  updated_at = now()
where company_id = '46b83ebf-dd3e-495a-a0ef-aed3d0155e0c';
