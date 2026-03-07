-- ============================================================
-- SEED DATA: Reference Molds & Artist Resins
-- Run this in the Supabase SQL Editor AFTER the initial schema
-- ============================================================

-- ===== Reference Molds (Breyer & Peter Stone) =====
INSERT INTO reference_molds (manufacturer, mold_name, scale, release_year_start) VALUES
  -- Breyer Traditional (1:9 scale)
  ('Breyer', 'Adios', 'Traditional (1:9)', 1969),
  ('Breyer', 'Big Ben', 'Traditional (1:9)', 1995),
  ('Breyer', 'Black Beauty', 'Traditional (1:9)', 1979),
  ('Breyer', 'Cantering Welsh Pony', 'Traditional (1:9)', 1971),
  ('Breyer', 'Cigar', 'Traditional (1:9)', 1997),
  ('Breyer', 'Classic Arabian Stallion', 'Traditional (1:9)', 1973),
  ('Breyer', 'Clydesdale Mare', 'Traditional (1:9)', 1969),
  ('Breyer', 'Clydesdale Stallion', 'Traditional (1:9)', 1969),
  ('Breyer', 'Fighting Stallion', 'Traditional (1:9)', 1961),
  ('Breyer', 'Five-Gaiter', 'Traditional (1:9)', 1963),
  ('Breyer', 'Fury Prancer', 'Traditional (1:9)', 1956),
  ('Breyer', 'Grazing Mare', 'Traditional (1:9)', 1964),
  ('Breyer', 'Halla', 'Traditional (1:9)', 1977),
  ('Breyer', 'Hanoverian', 'Traditional (1:9)', 1980),
  ('Breyer', 'Indian Pony', 'Traditional (1:9)', 1970),
  ('Breyer', 'John Henry', 'Traditional (1:9)', 1988),
  ('Breyer', 'Keen', 'Traditional (1:9)', 2000),
  ('Breyer', 'Lady Phase', 'Traditional (1:9)', 1976),
  ('Breyer', 'Legionario', 'Traditional (1:9)', 1978),
  ('Breyer', 'Lonesome Glory', 'Traditional (1:9)', 1995),
  ('Breyer', 'Man O War', 'Traditional (1:9)', 1967),
  ('Breyer', 'Midnight Sun', 'Traditional (1:9)', 1988),
  ('Breyer', 'Morganglanz', 'Traditional (1:9)', 1980),
  ('Breyer', 'Mustang', 'Traditional (1:9)', 1961),
  ('Breyer', 'Proud Arabian Stallion', 'Traditional (1:9)', 1972),
  ('Breyer', 'Proud Arabian Mare', 'Traditional (1:9)', 1972),
  ('Breyer', 'Rearing Stallion', 'Traditional (1:9)', 1965),
  ('Breyer', 'Roemer', 'Traditional (1:9)', 1999),
  ('Breyer', 'Roy the Belgian', 'Traditional (1:9)', 1989),
  ('Breyer', 'Ruffian', 'Traditional (1:9)', 1977),
  ('Breyer', 'Running Mare', 'Traditional (1:9)', 1963),
  ('Breyer', 'Running Stallion', 'Traditional (1:9)', 1963),
  ('Breyer', 'San Domingo', 'Traditional (1:9)', 1978),
  ('Breyer', 'Secretariat', 'Traditional (1:9)', 1987),
  ('Breyer', 'Sham', 'Traditional (1:9)', 1984),
  ('Breyer', 'Silver', 'Traditional (1:9)', 2001),
  ('Breyer', 'Stock Horse Stallion', 'Traditional (1:9)', 1981),
  ('Breyer', 'Stock Horse Mare', 'Traditional (1:9)', 1982),
  ('Breyer', 'Strapless', 'Traditional (1:9)', 2004),
  ('Breyer', 'Trakehner', 'Traditional (1:9)', 1979),
  ('Breyer', 'Western Horse', 'Traditional (1:9)', 1950),

  -- Breyer Classic (1:12 scale)
  ('Breyer', 'Andalusian Stallion', 'Classic (1:12)', 1979),
  ('Breyer', 'Arabian Stallion (Classic)', 'Classic (1:12)', 1973),
  ('Breyer', 'Kelso', 'Classic (1:12)', 1975),
  ('Breyer', 'Lipizzan Stallion', 'Classic (1:12)', 1975),
  ('Breyer', 'Mesteno', 'Classic (1:12)', 1992),
  ('Breyer', 'Might Tango', 'Classic (1:12)', 1998),
  ('Breyer', 'Rearing Stallion (Classic)', 'Classic (1:12)', 1965),
  ('Breyer', 'Silky Sullivan', 'Classic (1:12)', 1975),
  ('Breyer', 'Swaps', 'Classic (1:12)', 1975),

  -- Breyer Stablemate (1:32 scale)
  ('Breyer', 'Citation (G1)', 'Stablemate (1:32)', 1975),
  ('Breyer', 'Draft Horse (G1)', 'Stablemate (1:32)', 1975),
  ('Breyer', 'Morgan Stallion (G1)', 'Stablemate (1:32)', 1975),
  ('Breyer', 'Native Dancer (G1)', 'Stablemate (1:32)', 1975),
  ('Breyer', 'Quarter Horse Stallion (G1)', 'Stablemate (1:32)', 1975),
  ('Breyer', 'Seabiscuit (G1)', 'Stablemate (1:32)', 1975),
  ('Breyer', 'Silky Sullivan (G1)', 'Stablemate (1:32)', 1975),
  ('Breyer', 'Swaps (G1)', 'Stablemate (1:32)', 1975),
  ('Breyer', 'Thoroughbred Standing (G1)', 'Stablemate (1:32)', 1975),
  ('Breyer', 'Arabian Stallion (G2)', 'Stablemate (1:32)', 1998),
  ('Breyer', 'Draft (G2)', 'Stablemate (1:32)', 1998),
  ('Breyer', 'Thoroughbred (G2)', 'Stablemate (1:32)', 1998),
  ('Breyer', 'Warmblood (G2)', 'Stablemate (1:32)', 1998),
  ('Breyer', 'Stock Horse (G3)', 'Stablemate (1:32)', 2006),
  ('Breyer', 'Arabian (G3)', 'Stablemate (1:32)', 2006),

  -- Peter Stone
  ('Peter Stone', 'Chips', 'Traditional (1:9)', 1993),
  ('Peter Stone', 'Ideal Stock Horse', 'Traditional (1:9)', 1998),
  ('Peter Stone', 'Pebbles', 'Pebbles (1:18)', 2000),
  ('Peter Stone', 'Pebbles Arabian', 'Pebbles (1:18)', 2002),
  ('Peter Stone', 'Thoroughbred', 'Traditional (1:9)', 1995),
  ('Peter Stone', 'Trotting Drafter', 'Traditional (1:9)', 2001);


-- ===== Artist Resins =====
INSERT INTO artist_resins (sculptor_alias, resin_name, scale, cast_medium) VALUES
  ('Brigitte Eberl', 'Rose', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Brigitte Eberl', 'Tempest', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Brigitte Eberl', 'Viento', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Brigitte Eberl', 'Lancelot', 'Classic (1:12)', 'Polyurethane Resin'),
  ('Sarah Rose', 'Oliver', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Sarah Rose', 'Puck', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Sarah Rose', 'Finnegan', 'Classic (1:12)', 'Polyurethane Resin'),
  ('Morgen Kilbourn', 'Yasmin', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Morgen Kilbourn', 'Zayin', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Morgen Kilbourn', 'Aisha', 'Classic (1:12)', 'Polyurethane Resin'),
  ('Emilia Kurila', 'Laramie', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Emilia Kurila', 'Bravura', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Josine Vingerling', 'Valentino', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Josine Vingerling', 'Esprit', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Kitty Cantrell', 'Prairie Fire', 'Traditional (1:9)', 'Bronze'),
  ('Kitty Cantrell', 'Wind Dancer', 'Traditional (1:9)', 'Bronze'),
  ('Mindy Berg', 'Jitterbug', 'Classic (1:12)', 'Polyurethane Resin'),
  ('Mindy Berg', 'Swizzle', 'Stablemate (1:32)', 'Polyurethane Resin'),
  ('Carol Williams', 'Mischief', 'Traditional (1:9)', 'Earthenware'),
  ('Carol Williams', 'Trinket', 'Stablemate (1:32)', 'Earthenware'),
  ('Lesli Kathman', 'Khemosabi', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Lesli Kathman', 'Nashwan', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Joan Berkwitz', 'Ramses', 'Traditional (1:9)', 'Polyurethane Resin'),
  ('Joan Berkwitz', 'Donatello', 'Traditional (1:9)', 'Polyurethane Resin');


-- ============================================================
-- ✅ Seed data inserted:
--   72 Reference Molds (Breyer Traditional/Classic/Stablemate + Peter Stone)
--   24 Artist Resins (various sculptors and scales)
-- ============================================================
