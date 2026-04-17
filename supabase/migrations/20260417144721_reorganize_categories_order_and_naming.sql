-- Reorganize home page category order and clarify a few labels.
-- Strategy: most-rented usages first (DIY, mobility, sport, camping),
-- then events & home, then tech, then niche, "Autre" always last.
-- Slug (value) is unchanged so frontend icon/color mappings keep working.

UPDATE public.categories SET name = 'Bricolage & Outils',          "order" = 1  WHERE value = 'bricolage';
UPDATE public.categories SET name = 'Mobilité',                    "order" = 2  WHERE value = 'mobilite';
UPDATE public.categories SET name = 'Sport & Loisirs',             "order" = 3  WHERE value = 'sport';
UPDATE public.categories SET name = 'Camping & Plein air',         "order" = 4  WHERE value = 'camping';
UPDATE public.categories SET name = 'Événementiel',                "order" = 5  WHERE value = 'evenementiel';
UPDATE public.categories SET name = 'Cuisine & Réception',         "order" = 6  WHERE value = 'cuisine';
UPDATE public.categories SET name = 'Maison & Jardin',             "order" = 7  WHERE value = 'maison';
UPDATE public.categories SET name = 'High-Tech & Gaming',          "order" = 8  WHERE value = 'hightech';
UPDATE public.categories SET name = 'Électronique',                "order" = 9  WHERE value = 'electronique';
UPDATE public.categories SET name = 'Musique',                     "order" = 10 WHERE value = 'musique';
UPDATE public.categories SET name = 'Bébé & Enfants',              "order" = 11 WHERE value = 'enfants';
UPDATE public.categories SET name = 'Vêtements & Déguisements',    "order" = 12 WHERE value = 'vetements';
UPDATE public.categories SET name = 'Matériel Pro',                "order" = 13 WHERE value = 'pro';
UPDATE public.categories SET name = 'Autre',                       "order" = 14 WHERE value = 'autre';

-- Tighten a few "Autre <X>" subcategory labels for consistency
UPDATE public.subcategories SET name = 'Autre bébé/enfant'
  WHERE value = 'autre' AND category_id = (SELECT id FROM categories WHERE value = 'enfants');
UPDATE public.subcategories SET name = 'Autre vêtements/costume'
  WHERE value = 'autre' AND category_id = (SELECT id FROM categories WHERE value = 'vetements');
UPDATE public.subcategories SET name = 'Autre bricolage'
  WHERE value = 'autre' AND category_id = (SELECT id FROM categories WHERE value = 'bricolage');
