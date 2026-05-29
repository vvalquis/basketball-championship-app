import json
import os
import re
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import parse_qs, urlparse

from app.supabase_client import SupabaseClient, SupabaseError

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}


def json_default(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


class BasketballHandler(BaseHTTPRequestHandler):
    server_version = "BasketballSupabaseHTTP/1.0"

    def _send_json(self, data: Any, status: int = 200) -> None:
        payload = json.dumps(data, ensure_ascii=False, default=json_default).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_error(self, message: str, status: int = 400) -> None:
        self._send_json({"error": message}, status)

    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError("El cuerpo de la petición no es un JSON válido") from exc

    def _client(self) -> SupabaseClient:
        return SupabaseClient()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        params = parse_qs(parsed.query)
        try:
            if path.startswith("/api"):
                return self._handle_get_api(path, params)
            return self._serve_static(path)
        except SupabaseError as exc:
            return self._send_error(str(exc), 502)
        except Exception as exc:
            return self._send_error(f"Error interno: {exc}", 500)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        try:
            body = self._read_json()
            return self._handle_post_api(path, body)
        except ValueError as exc:
            return self._send_error(str(exc), 400)
        except SupabaseError as exc:
            return self._send_error(str(exc), 502)
        except Exception as exc:
            return self._send_error(f"Error interno: {exc}", 500)

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        try:
            body = self._read_json()
            return self._handle_put_api(path, body)
        except ValueError as exc:
            return self._send_error(str(exc), 400)
        except SupabaseError as exc:
            return self._send_error(str(exc), 502)
        except Exception as exc:
            return self._send_error(f"Error interno: {exc}", 500)

    def _serve_static(self, path: str) -> None:
        if path == "/":
            file_path = STATIC_DIR / "index.html"
        else:
            safe = path.lstrip("/")
            file_path = STATIC_DIR / safe
        if not file_path.exists() or not file_path.is_file():
            self.send_error(404, "Archivo no encontrado")
            return
        content = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(file_path.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _handle_get_api(self, path: str, params: Dict[str, Any]) -> None:
        db = self._client()
        championship_id = params.get("championship_id", ["1"])[0]

        if path == "/api/health":
            return self._send_json({"status": "ok", "database": "supabase"})

        if path == "/api/docs":
            return self._send_json({
                "name": "Basketball Championship API",
                "database": "Supabase PostgreSQL via REST API",
                "endpoints": [
                    "GET /api/summary",
                    "GET /api/championships",
                    "GET /api/teams?championship_id=1",
                    "POST /api/teams",
                    "GET /api/teams/{id}",
                    "GET /api/players",
                    "POST /api/players",
                    "GET /api/matches?championship_id=1",
                    "POST /api/matches",
                    "GET /api/matches/{id}",
                    "PUT /api/matches/{id}/result",
                    "GET /api/standings?championship_id=1",
                    "GET /api/stats/players"
                ]
            })

        if path == "/api/championships":
            data = db.select("championships", {"select": "*", "order": "id.asc"})
            return self._send_json(data)

        if path == "/api/summary":
            teams = db.select("teams", {"select": "id", "championship_id": f"eq.{championship_id}"})
            players = db.select("players", {"select": "id,teams!inner(championship_id)", "teams.championship_id": f"eq.{championship_id}"})
            matches = db.select("matches", {"select": "id,status", "championship_id": f"eq.{championship_id}"})
            standings = db.select("standings_view", {"select": "*", "championship_id": f"eq.{championship_id}", "order": "championship_points.desc,point_difference.desc,points_for.desc"})
            finished = len([m for m in matches if m.get("status") == "FINISHED"])
            scheduled = len([m for m in matches if m.get("status") == "SCHEDULED"])
            leader = standings[0] if standings else None
            return self._send_json({
                "teams": len(teams),
                "players": len(players),
                "matches": len(matches),
                "finished_matches": finished,
                "scheduled_matches": scheduled,
                "leader": leader,
            })

        if path == "/api/teams":
            data = db.select("teams", {"select": "*", "championship_id": f"eq.{championship_id}", "order": "name.asc"})
            return self._send_json(data)

        match_team = re.match(r"^/api/teams/(\d+)$", path)
        if match_team:
            team_id = match_team.group(1)
            team = db.select("teams", {"select": "*", "id": f"eq.{team_id}"})
            if not team:
                return self._send_error("Equipo no encontrado", 404)
            players = db.select("players", {"select": "*", "team_id": f"eq.{team_id}", "order": "jersey_number.asc"})
            response = team[0]
            response["players"] = players
            return self._send_json(response)

        if path == "/api/players":
            data = db.select("players", {"select": "*,teams(name,championship_id)", "order": "last_name.asc,first_name.asc"})
            if "team_id" in params:
                team_id = params["team_id"][0]
                data = [p for p in data if str(p.get("team_id")) == str(team_id)]
            if "championship_id" in params:
                data = [p for p in data if str((p.get("teams") or {}).get("championship_id")) == str(championship_id)]
            return self._send_json(data)

        if path == "/api/matches":
            data = db.select("matches", {"select": "*,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)", "championship_id": f"eq.{championship_id}", "order": "match_date.asc,match_time.asc"})
            return self._send_json(data)

        match_detail = re.match(r"^/api/matches/(\d+)$", path)
        if match_detail:
            match_id = match_detail.group(1)
            matches = db.select("matches", {"select": "*,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)", "id": f"eq.{match_id}"})
            if not matches:
                return self._send_error("Partido no encontrado", 404)
            periods = db.select("match_periods", {"select": "*", "match_id": f"eq.{match_id}", "order": "period_number.asc"})
            stats = db.select("player_match_stats", {"select": "*,players(first_name,last_name,jersey_number),teams(name)", "match_id": f"eq.{match_id}", "order": "points.desc"})
            response = matches[0]
            response["periods"] = periods
            response["player_stats"] = stats
            return self._send_json(response)

        if path == "/api/standings":
            data = db.select("standings_view", {"select": "*", "championship_id": f"eq.{championship_id}", "order": "championship_points.desc,point_difference.desc,points_for.desc"})
            return self._send_json(data)

        if path == "/api/stats/players":
            data = db.select("player_match_stats", {"select": "points,rebounds,assists,steals,blocks,fouls,players(first_name,last_name,jersey_number),teams(name)", "order": "points.desc"})
            aggregated: Dict[str, Dict[str, Any]] = {}
            for row in data:
                player = row.get("players") or {}
                team = row.get("teams") or {}
                key = f"{player.get('first_name','')} {player.get('last_name','')}|{team.get('name','')}"
                if key not in aggregated:
                    aggregated[key] = {
                        "player_name": f"{player.get('first_name','')} {player.get('last_name','')}",
                        "jersey_number": player.get("jersey_number"),
                        "team_name": team.get("name"),
                        "points": 0,
                        "rebounds": 0,
                        "assists": 0,
                        "steals": 0,
                        "blocks": 0,
                        "fouls": 0,
                    }
                for field in ["points", "rebounds", "assists", "steals", "blocks", "fouls"]:
                    aggregated[key][field] += int(row.get(field) or 0)
            ranking = sorted(aggregated.values(), key=lambda item: item["points"], reverse=True)
            return self._send_json(ranking)

        return self._send_error("Endpoint no encontrado", 404)

    def _handle_post_api(self, path: str, body: Dict[str, Any]) -> None:
        db = self._client()

        if path == "/api/teams":
            payload = {
                "championship_id": int(body.get("championship_id", 1)),
                "name": body.get("name", "").strip(),
                "coach_name": body.get("coach_name"),
                "logo_url": body.get("logo_url"),
            }
            if not payload["name"]:
                return self._send_error("El nombre del equipo es obligatorio", 400)
            return self._send_json(db.insert("teams", payload), 201)

        if path == "/api/players":
            payload = {
                "team_id": int(body.get("team_id")),
                "first_name": body.get("first_name", "").strip(),
                "last_name": body.get("last_name", "").strip(),
                "jersey_number": int(body.get("jersey_number")),
                "position": body.get("position"),
                "height_cm": body.get("height_cm"),
                "weight_kg": body.get("weight_kg"),
            }
            if not payload["first_name"] or not payload["last_name"]:
                return self._send_error("Nombre y apellido son obligatorios", 400)
            return self._send_json(db.insert("players", payload), 201)

        if path == "/api/matches":
            payload = {
                "championship_id": int(body.get("championship_id", 1)),
                "home_team_id": int(body.get("home_team_id")),
                "away_team_id": int(body.get("away_team_id")),
                "match_date": body.get("match_date"),
                "match_time": body.get("match_time"),
                "venue": body.get("venue"),
                "status": body.get("status", "SCHEDULED"),
            }
            if payload["home_team_id"] == payload["away_team_id"]:
                return self._send_error("El equipo local y visitante deben ser diferentes", 400)
            return self._send_json(db.insert("matches", payload), 201)

        return self._send_error("Endpoint no encontrado", 404)

    def _handle_put_api(self, path: str, body: Dict[str, Any]) -> None:
        db = self._client()
        result_match = re.match(r"^/api/matches/(\d+)/result$", path)
        if result_match:
            match_id = result_match.group(1)
            home_score = int(body.get("home_score", 0))
            away_score = int(body.get("away_score", 0))
            matches = db.select("matches", {"select": "home_team_id,away_team_id", "id": f"eq.{match_id}"})
            if not matches:
                return self._send_error("Partido no encontrado", 404)
            match = matches[0]
            winner_team_id = None
            if home_score > away_score:
                winner_team_id = match["home_team_id"]
            elif away_score > home_score:
                winner_team_id = match["away_team_id"]
            updated = db.update("matches", {
                "home_score": home_score,
                "away_score": away_score,
                "winner_team_id": winner_team_id,
                "status": "FINISHED",
            }, {"id": f"eq.{match_id}"})

            periods = body.get("period_scores", []) or []
            for item in periods:
                period_number = int(item.get("period"))
                existing = db.select("match_periods", {"select": "id", "match_id": f"eq.{match_id}", "period_number": f"eq.{period_number}"})
                payload = {
                    "match_id": int(match_id),
                    "period_number": period_number,
                    "home_score": int(item.get("home", 0)),
                    "away_score": int(item.get("away", 0)),
                }
                if existing:
                    db.update("match_periods", payload, {"id": f"eq.{existing[0]['id']}"})
                else:
                    db.insert("match_periods", payload)
            return self._send_json({"match": updated, "periods_processed": len(periods)})

        return self._send_error("Endpoint no encontrado", 404)


def run_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    server = ThreadingHTTPServer((host, port), BasketballHandler)
    print(f"Servidor iniciado en http://{host}:{port}")
    print("Usando Supabase. Verifica SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.")
    server.serve_forever()
