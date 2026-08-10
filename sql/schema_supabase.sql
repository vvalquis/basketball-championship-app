-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS championships (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    season VARCHAR(50),
    category VARCHAR(100),
    start_date DATE,
    end_date DATE,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    championship_id INTEGER NOT NULL,
    name VARCHAR(150) NOT NULL,
    coach_name VARCHAR(150),
    logo_url TEXT,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_teams_championship FOREIGN KEY (championship_id) REFERENCES championships(id) ON DELETE CASCADE,
    CONSTRAINT uq_team_name_championship UNIQUE (championship_id, name)
);

CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    jersey_number INTEGER NOT NULL,
    position VARCHAR(50),
    birth_date DATE,
    height_cm INTEGER,
    weight_kg INTEGER,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_players_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT uq_player_number_team UNIQUE (team_id, jersey_number)
);

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    championship_id INTEGER NOT NULL,
    home_team_id INTEGER NOT NULL,
    away_team_id INTEGER NOT NULL,
    phase VARCHAR(20) NOT NULL DEFAULT 'REGULAR',
    match_date DATE NOT NULL,
    match_time TIME,
    venue VARCHAR(150),
    status VARCHAR(30) DEFAULT 'SCHEDULED',
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    winner_team_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_matches_championship FOREIGN KEY (championship_id) REFERENCES championships(id) ON DELETE CASCADE,
    CONSTRAINT fk_matches_home_team FOREIGN KEY (home_team_id) REFERENCES teams(id),
    CONSTRAINT fk_matches_away_team FOREIGN KEY (away_team_id) REFERENCES teams(id),
    CONSTRAINT fk_matches_winner_team FOREIGN KEY (winner_team_id) REFERENCES teams(id),
    CONSTRAINT chk_different_teams CHECK (home_team_id <> away_team_id),
    CONSTRAINT chk_match_phase CHECK (phase IN ('REGULAR', 'SEMIFINAL', 'FINAL', 'THIRD_PLACE')),
    CONSTRAINT chk_scores_positive CHECK (home_score >= 0 AND away_score >= 0)
);

CREATE TABLE IF NOT EXISTS match_periods (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL,
    period_number INTEGER NOT NULL,
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_match_periods_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT uq_match_period UNIQUE (match_id, period_number),
    CONSTRAINT chk_period_scores_positive CHECK (home_score >= 0 AND away_score >= 0)
);

CREATE TABLE IF NOT EXISTS player_match_stats (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    points INTEGER DEFAULT 0,
    points_triple INTEGER DEFAULT 0,
    rebounds INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    steals INTEGER DEFAULT 0,
    blocks INTEGER DEFAULT 0,
    fouls INTEGER DEFAULT 0,
    turnovers INTEGER DEFAULT 0,
    minutes_played INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stats_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT fk_stats_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT fk_stats_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT uq_player_match_stats UNIQUE (match_id, player_id),
    CONSTRAINT chk_stats_positive CHECK (
        points >= 0 AND rebounds >= 0 AND assists >= 0 AND steals >= 0 AND
        blocks >= 0 AND fouls >= 0 AND turnovers >= 0 AND minutes_played >= 0
    )
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'ADMIN',
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS idx_teams_championship ON teams(championship_id);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_matches_championship ON matches(championship_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_stats_match ON player_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_stats_player ON player_match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_stats_team ON player_match_stats(team_id);
