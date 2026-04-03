/*
  # Add subcategories and new categories

  ## Changes

  ### New Categories Added
  - Mobilité (vélos, trottinettes, voitures, utilitaires)
  - High-Tech & Gaming (consoles, PC, photo, son)
  - Musique (instruments, sono, matériel scène)
  - Cuisine & Réception (vaisselle, cuisine pro, barbecue)
  - Camping & Plein air (tentes, sacs de couchage, randonnée)
  - Matériel Pro (BTP, agricole, médical)

  ### New Table: subcategories
  - id, category_id (FK), name, value (unique per category), order
  - Populated with subcategories for ALL categories
  - RLS enabled, public read access
*/

-- Create subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name         text NOT NULL,
  value        text NOT NULL,
  "order"      integer NOT NULL DEFAULT 0,
  UNIQUE(category_id, value)
);

ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read subcategories"
  ON subcategories FOR SELECT
  TO public
  USING (true);

-- Add new categories
INSERT INTO categories (name, value, "order") VALUES
  ('Mobilité',              'mobilite',    9),
  ('High-Tech & Gaming',    'hightech',    10),
  ('Musique',               'musique',     11),
  ('Cuisine & Réception',   'cuisine',     12),
  ('Camping & Plein air',   'camping',     13),
  ('Matériel Pro',          'pro',         14)
ON CONFLICT (value) DO UPDATE SET
  name = EXCLUDED.name,
  "order" = EXCLUDED."order";

-- Helper: insert subcategories for a given category value
-- We use a DO block per category to avoid ambiguous column references

DO $$
DECLARE cat_id uuid;
BEGIN
  -- Électronique
  SELECT id INTO cat_id FROM categories WHERE value = 'electronique';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Téléphones & Tablettes', 'telephones',  1),
    (cat_id, 'TV & Home cinéma',        'tv',          2),
    (cat_id, 'Ordinateurs',             'ordinateurs', 3),
    (cat_id, 'Appareils photo',         'photo',       4),
    (cat_id, 'Drones',                  'drones',      5),
    (cat_id, 'Consoles de jeu',         'consoles',    6),
    (cat_id, 'Accessoires',             'accessoires', 7),
    (cat_id, 'Autre électronique',      'autre',       8)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- Bricolage
  SELECT id INTO cat_id FROM categories WHERE value = 'bricolage';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Perceuses & Visseuses',    'perceuses',    1),
    (cat_id, 'Scies & Ponceuses',        'scies',        2),
    (cat_id, 'Nettoyage haute pression', 'nettoyage',    3),
    (cat_id, 'Échelles & Échafaudages',  'echelles',     4),
    (cat_id, 'Matériel de peinture',     'peinture',     5),
    (cat_id, 'Générateurs',              'generateurs',  6),
    (cat_id, 'Outillage à main',         'outillage',    7),
    (cat_id, 'Autre bricolage',          'autre',        8)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- Sport & Loisirs
  SELECT id INTO cat_id FROM categories WHERE value = 'sport';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Ski & Snowboard',          'ski',         1),
    (cat_id, 'Surf & Sports nautiques',  'surf',        2),
    (cat_id, 'Vélos & VTT',              'velos',       3),
    (cat_id, 'Fitness & Musculation',    'fitness',     4),
    (cat_id, 'Golf',                     'golf',        5),
    (cat_id, 'Tennis & Raquettes',       'tennis',      6),
    (cat_id, 'Camping & Randonnée',      'camping',     7),
    (cat_id, 'Sports collectifs',        'collectifs',  8),
    (cat_id, 'Autre sport',              'autre',       9)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- Maison & Jardin
  SELECT id INTO cat_id FROM categories WHERE value = 'maison';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Meubles & Décoration',     'meubles',         1),
    (cat_id, 'Électroménager',           'electromenager',  2),
    (cat_id, 'Outillage jardin',         'jardin',          3),
    (cat_id, 'Tondeuses',                'tondeuses',       4),
    (cat_id, 'Tronçonneuses',            'tronconneuses',   5),
    (cat_id, 'Nettoyage',                'nettoyage',       6),
    (cat_id, 'Éclairage',                'eclairage',       7),
    (cat_id, 'Autre maison',             'autre',           8)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- Événementiel
  SELECT id INTO cat_id FROM categories WHERE value = 'evenementiel';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Sono & Éclairage',         'sono',      1),
    (cat_id, 'Tentes & Chapiteaux',      'tentes',    2),
    (cat_id, 'Tables & Chaises',         'mobilier',  3),
    (cat_id, 'Vaisselle & Couverts',     'vaisselle', 4),
    (cat_id, 'Machines à boissons',      'boissons',  5),
    (cat_id, 'Photomaton & Animation',   'animation', 6),
    (cat_id, 'Autre événementiel',       'autre',     7)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- Vêtements
  SELECT id INTO cat_id FROM categories WHERE value = 'vetements';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Costumes & Déguisements',  'costumes',   1),
    (cat_id, 'Tenues de soirée',         'soiree',     2),
    (cat_id, 'Tenues de mariée',         'mariage',    3),
    (cat_id, 'Sportswear',               'sportswear', 4),
    (cat_id, 'Accessoires mode',         'accessoires',5),
    (cat_id, 'Autre vêtements',          'autre',      6)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- Enfants
  SELECT id INTO cat_id FROM categories WHERE value = 'enfants';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Poussettes & Couffins',    'poussettes',    1),
    (cat_id, 'Jeux & Jouets',            'jouets',        2),
    (cat_id, 'Vélos enfants',            'velos',         3),
    (cat_id, 'Matériel de puériculture', 'puericulture',  4),
    (cat_id, 'Déguisements enfants',     'deguisements',  5),
    (cat_id, 'Matériel de fête',         'fete',          6),
    (cat_id, 'Autre enfants',            'autre',         7)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- Autre
  SELECT id INTO cat_id FROM categories WHERE value = 'autre';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Livres & Jeux de société', 'livres',     1),
    (cat_id, 'Art & Créativité',         'art',        2),
    (cat_id, 'Animaux',                  'animaux',    3),
    (cat_id, 'Collection',               'collection', 4),
    (cat_id, 'Divers',                   'divers',     5)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- Mobilité
  SELECT id INTO cat_id FROM categories WHERE value = 'mobilite';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Vélos électriques',        'velos_electriques', 1),
    (cat_id, 'Vélos classiques',         'velos',             2),
    (cat_id, 'Trottinettes électriques', 'trottinettes',      3),
    (cat_id, 'Scooters',                 'scooters',          4),
    (cat_id, 'Voitures',                 'voitures',          5),
    (cat_id, 'Utilitaires & Vans',       'utilitaires',       6),
    (cat_id, 'Remorques',                'remorques',         7),
    (cat_id, 'Autre mobilité',           'autre',             8)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- High-Tech & Gaming
  SELECT id INTO cat_id FROM categories WHERE value = 'hightech';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Consoles & Jeux vidéo',    'consoles',    1),
    (cat_id, 'PC & Laptops gaming',      'pc_gaming',   2),
    (cat_id, 'Réalité virtuelle (VR)',   'vr',          3),
    (cat_id, 'Photo & Vidéo pro',        'photo_pro',   4),
    (cat_id, 'Équipement son',           'son',         5),
    (cat_id, 'Projecteurs',              'projecteurs', 6),
    (cat_id, 'Autre high-tech',          'autre',       7)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- Musique
  SELECT id INTO cat_id FROM categories WHERE value = 'musique';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Guitares & Basses',        'guitares',  1),
    (cat_id, 'Pianos & Claviers',        'pianos',    2),
    (cat_id, 'Batterie & Percussions',   'batterie',  3),
    (cat_id, 'Cuivres & Vents',          'cuivres',   4),
    (cat_id, 'Sono & PA',                'sono',      5),
    (cat_id, 'Tables de mixage',         'mixage',    6),
    (cat_id, 'Micros & Accessoires',     'micros',    7),
    (cat_id, 'Autre musique',            'autre',     8)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- Cuisine & Réception
  SELECT id INTO cat_id FROM categories WHERE value = 'cuisine';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Barbecues & Plancha',      'barbecue',    1),
    (cat_id, 'Vaisselle & Verrerie',     'vaisselle',   2),
    (cat_id, 'Cuisine professionnelle',  'cuisine_pro', 3),
    (cat_id, 'Fontaines & Distributeurs','fontaines',   4),
    (cat_id, 'Machines à café',          'cafe',        5),
    (cat_id, 'Réfrigérateurs mobiles',   'frigo',       6),
    (cat_id, 'Autre cuisine',            'autre',       7)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- Camping & Plein air
  SELECT id INTO cat_id FROM categories WHERE value = 'camping';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'Tentes',                   'tentes',        1),
    (cat_id, 'Sacs de couchage',         'sacs_couchage', 2),
    (cat_id, 'Équipement randonnée',     'randonnee',     3),
    (cat_id, 'Kayaks & Canoës',          'kayak',         4),
    (cat_id, 'Planches & SUP',           'sup',           5),
    (cat_id, 'Camping-car & Van',        'campingcar',    6),
    (cat_id, 'Autre plein air',          'autre',         7)
  ON CONFLICT (category_id, value) DO NOTHING;

  -- Matériel Pro
  SELECT id INTO cat_id FROM categories WHERE value = 'pro';
  INSERT INTO subcategories (category_id, name, value, "order") VALUES
    (cat_id, 'BTP & Construction',       'btp',         1),
    (cat_id, 'Matériel agricole',        'agricole',    2),
    (cat_id, 'Médical & Santé',          'medical',     3),
    (cat_id, 'Industrie',                'industrie',   4),
    (cat_id, 'Bureautique',              'bureautique', 5),
    (cat_id, 'Autre pro',                'autre',       6)
  ON CONFLICT (category_id, value) DO NOTHING;
END $$;

-- Add subcategory_id column to listings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'subcategory_id'
  ) THEN
    ALTER TABLE listings ADD COLUMN subcategory_id uuid REFERENCES subcategories(id);
    ALTER TABLE listings ADD COLUMN subcategory_name text;
  END IF;
END $$;
