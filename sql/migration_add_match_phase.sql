-- Ejecutar una sola vez en el SQL Editor de Supabase para habilitar las fases finales.
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS phase VARCHAR(20) NOT NULL DEFAULT 'REGULAR';

ALTER TABLE matches
DROP CONSTRAINT IF EXISTS chk_match_phase;

ALTER TABLE matches
ADD CONSTRAINT chk_match_phase
CHECK (phase IN ('REGULAR', 'SEMIFINAL', 'FINAL', 'THIRD_PLACE'));

CREATE INDEX IF NOT EXISTS idx_matches_championship_phase
ON matches (championship_id, phase);

-- La tabla de posiciones solo contabiliza partidos finalizados de fase regular.
DROP VIEW IF EXISTS standings_view;
CREATE VIEW standings_view AS
SELECT
    t.id AS team_id,
    t.championship_id,
    t.name AS team_name,
    COUNT(m.id) AS played,
    COALESCE(SUM(CASE WHEN m.winner_team_id = t.id THEN 1 ELSE 0 END), 0) AS wins,
    COALESCE(SUM(CASE WHEN m.status = 'FINISHED' AND m.winner_team_id <> t.id THEN 1 ELSE 0 END), 0) AS losses,
    COALESCE(SUM(CASE WHEN m.home_team_id = t.id THEN m.home_score WHEN m.away_team_id = t.id THEN m.away_score ELSE 0 END), 0) AS points_for,
    COALESCE(SUM(CASE WHEN m.home_team_id = t.id THEN m.away_score WHEN m.away_team_id = t.id THEN m.home_score ELSE 0 END), 0) AS points_against,
    COALESCE(SUM(CASE WHEN m.home_team_id = t.id THEN m.home_score - m.away_score WHEN m.away_team_id = t.id THEN m.away_score - m.home_score ELSE 0 END), 0) AS point_difference,
    COALESCE(SUM(CASE
        WHEN m.id IS NULL THEN 0
        WHEN (m.home_team_id = t.id AND COALESCE(m.home_score, 0) = 0)
          OR (m.away_team_id = t.id AND COALESCE(m.away_score, 0) = 0) THEN 0
        WHEN m.winner_team_id = t.id THEN 2
        WHEN m.status = 'FINISHED' THEN 1
        ELSE 0
    END), 0) AS championship_points
FROM teams t
LEFT JOIN matches m ON m.status = 'FINISHED'
    AND COALESCE(m.phase, 'REGULAR') = 'REGULAR'
    AND (m.home_team_id = t.id OR m.away_team_id = t.id)
GROUP BY t.id, t.championship_id, t.name;
