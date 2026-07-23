-- Ejecutar una sola vez en Supabase SQL Editor.
-- Habilita el partido por el tercer y cuarto lugar.

ALTER TABLE matches
DROP CONSTRAINT IF EXISTS chk_match_phase;

ALTER TABLE matches
ADD CONSTRAINT chk_match_phase
CHECK (phase IN ('REGULAR', 'SEMIFINAL', 'FINAL', 'THIRD_PLACE'));
