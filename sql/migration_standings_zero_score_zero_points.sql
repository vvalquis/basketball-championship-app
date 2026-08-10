-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Ajusta la tabla de posiciones para que un equipo que termine un partido
-- de fase REGULAR con 0 puntos obtenga 0 puntos de campeonato.
-- Regla: ganador = 2 pts; perdedor = 1 pt; equipo con marcador 0 = 0 pts.

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
