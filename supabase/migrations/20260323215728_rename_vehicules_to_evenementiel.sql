/*
  # Rename category "Véhicules" to "Événementiel"

  1. Modified Tables
    - `categories`
      - Updates the row where value = 'vehicules':
        - `name`: "Véhicules" → "Événementiel"
        - `description`: updated to describe event-related rentals
        - `value`: "vehicules" → "evenementiel"

  2. Notes
    - The `value` field is used as a slug/key in the frontend code
    - Any listings linked via category_id are unaffected (foreign key stays the same)
*/

UPDATE categories
SET
  name = 'Événementiel',
  description = 'Matériel de fête, décoration, sono, tentes',
  value = 'evenementiel'
WHERE value = 'vehicules';
