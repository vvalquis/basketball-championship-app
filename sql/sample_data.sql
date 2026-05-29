-- Datos de prueba. Ejecutar después de schema_supabase.sql.

INSERT INTO championships (name, season, category, start_date, status)
VALUES ('Campeonato Basketball 2026', '2026', 'Libre', '2026-06-01', 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO teams (championship_id, name, coach_name)
VALUES
(1, 'Tigres', 'Carlos Ramírez'),
(1, 'Leones', 'Miguel Torres'),
(1, 'Cóndores', 'Luis García'),
(1, 'Halcones', 'Pedro Sánchez')
ON CONFLICT DO NOTHING;

INSERT INTO players (team_id, first_name, last_name, jersey_number, position)
VALUES
(1, 'Luis', 'Pérez', 7, 'Base'),
(1, 'Carlos', 'Ramírez', 10, 'Escolta'),
(2, 'Miguel', 'Torres', 9, 'Alero'),
(2, 'Jorge', 'Flores', 12, 'Pívot'),
(3, 'Andrés', 'García', 5, 'Base'),
(3, 'Pedro', 'Castro', 11, 'Ala-Pívot'),
(4, 'Diego', 'Sánchez', 8, 'Escolta'),
(4, 'Raúl', 'Mendoza', 15, 'Pívot')
ON CONFLICT DO NOTHING;

INSERT INTO matches (championship_id, home_team_id, away_team_id, match_date, match_time, venue, status, home_score, away_score, winner_team_id)
VALUES
(1, 1, 2, '2026-06-10', '19:00', 'Coliseo Municipal', 'FINISHED', 68, 62, 1),
(1, 3, 4, '2026-06-11', '20:00', 'Cancha Principal', 'SCHEDULED', 0, 0, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO match_periods (match_id, period_number, home_score, away_score)
VALUES
(1, 1, 18, 15),
(1, 2, 16, 14),
(1, 3, 20, 17),
(1, 4, 14, 16)
ON CONFLICT DO NOTHING;

INSERT INTO player_match_stats (match_id, player_id, team_id, points, rebounds, assists, steals, blocks, fouls, turnovers, minutes_played)
VALUES
(1, 1, 1, 22, 5, 6, 2, 0, 3, 2, 32),
(1, 2, 1, 18, 4, 3, 1, 1, 2, 1, 29),
(1, 3, 2, 20, 6, 2, 1, 0, 4, 3, 31),
(1, 4, 2, 16, 9, 1, 0, 2, 3, 2, 30)
ON CONFLICT DO NOTHING;
