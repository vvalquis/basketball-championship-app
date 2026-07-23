-- Ejecutar una sola vez en el SQL Editor de Supabase para habilitar las fases finales.
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS phase VARCHAR(20) NOT NULL DEFAULT 'REGULAR';

ALTER TABLE matches
DROP CONSTRAINT IF EXISTS chk_match_phase;

ALTER TABLE matches
ADD CONSTRAINT chk_match_phase
CHECK (phase IN ('REGULAR', 'SEMIFINAL', 'FINAL'));

CREATE INDEX IF NOT EXISTS idx_matches_championship_phase
ON matches (championship_id, phase);
