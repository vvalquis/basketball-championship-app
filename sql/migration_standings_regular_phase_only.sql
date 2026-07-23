-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Reconstruye la tabla de posiciones para contabilizar únicamente
-- partidos FINALIZADOS cuya fase sea REGULAR.

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
    COALESCE(SUM(CASE WHEN m.winner_team_id = t.id THEN 2 WHEN m.status = 'FINISHED' THEN 1 ELSE 0 END), 0) AS championship_points
FROM teams t
LEFT JOIN matches m ON m.status = 'FINISHED'
    AND COALESCE(m.phase, 'REGULAR') = 'REGULAR'
    AND (m.home_team_id = t.id OR m.away_team_id = t.id)
GROUP BY t.id, t.championship_id, t.name;
