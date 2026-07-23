import hashlib
import hmac
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


def verify_password(password: str, stored_value: str) -> bool:
    """Verificación simple sin dependencias externas.

    Para esta versión se soporta:
    - contraseña guardada tal cual en users.password_hash
    - SHA256 hexadecimal de la contraseña

    Para producción se recomienda migrar a bcrypt/argon2.
    """
    password = password or ""
    stored_value = stored_value or ""
    plain_ok = hmac.compare_digest(password, stored_value)
    sha256_ok = hmac.compare_digest(hashlib.sha256(password.encode("utf-8")).hexdigest(), stored_value)
    return plain_ok or sha256_ok


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

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        try:
            return self._handle_delete_api(path)
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


    def _maintenance_allowed(self) -> Dict[str, Dict[str, Any]]:
        return {
            "championships": {"fields": ["name", "season", "category", "start_date", "end_date", "status"]},
            "teams": {"fields": ["championship_id", "name", "coach_name", "logo_url", "status"]},
            "players": {"fields": ["team_id", "first_name", "last_name", "jersey_number", "position", "birth_date", "height_cm", "weight_kg", "status"]},
            "matches": {"fields": ["championship_id", "home_team_id", "away_team_id", "phase", "match_date", "match_time", "venue", "status", "home_score", "away_score", "winner_team_id"]},
            "match_periods": {"fields": ["match_id", "period_number", "home_score", "away_score"]},
            "player_match_stats": {"fields": ["match_id", "player_id", "team_id", "points", "rebounds", "assists", "steals", "blocks", "fouls", "turnovers", "minutes_played", "points_triple"]},
        }

    def _clean_maintenance_payload(self, table: str, body: Dict[str, Any]) -> Dict[str, Any]:
        allowed = self._maintenance_allowed().get(table)
        if not allowed:
            raise ValueError("Tabla de mantenimiento no permitida")
        numeric_fields = {
            "championship_id", "team_id", "home_team_id", "away_team_id", "winner_team_id",
            "jersey_number", "height_cm", "weight_kg", "home_score", "away_score",
            "match_id", "period_number", "player_id", "points", "rebounds", "assists",
            "steals", "blocks", "fouls", "turnovers", "minutes_played", "points_triple",
        }
        payload: Dict[str, Any] = {}
        for field in allowed["fields"]:
            if field not in body:
                continue
            value = body.get(field)
            if value == "":
                value = None
            if value is not None and field in numeric_fields:
                value = int(value)
            payload[field] = value
        return payload

    def _get_maintenance_rows(self, db: SupabaseClient, table: str, championship_id: str) -> Any:
        if table == "championships":
            return db.select("championships", {"select": "*", "order": "id.asc"})

        if table == "teams":
            return db.select("teams", {"select": "*", "championship_id": f"eq.{championship_id}", "order": "name.asc"})

        if table == "players":
            data = db.select("players", {"select": "*,teams(name,championship_id)", "order": "last_name.asc,first_name.asc"})
            rows = [p for p in data if str((p.get("teams") or {}).get("championship_id")) == str(championship_id)]
            for row in rows:
                row["team_name"] = (row.get("teams") or {}).get("name")
            return rows

        if table == "matches":
            data = db.select("matches", {"select": "*", "championship_id": f"eq.{championship_id}", "order": "match_date.desc,match_time.asc"})
            data = sorted(data, key=lambda m: (m.get("match_date") or "1900-01-01", m.get("match_time") or "00:00:00"))
            data = sorted(data, key=lambda m: m.get("match_date") or "1900-01-01", reverse=True)
            team_ids = sorted({str(m.get("home_team_id")) for m in data if m.get("home_team_id")} | {str(m.get("away_team_id")) for m in data if m.get("away_team_id")})
            teams_by_id = {}
            if team_ids:
                teams = db.select("teams", {"select": "id,name,logo_url", "id": f"in.({','.join(team_ids)})"})
                teams_by_id = {str(team.get("id")): team for team in teams}
            for match in data:
                match["home_team"] = teams_by_id.get(str(match.get("home_team_id")), {"name": "Local"})
                match["away_team"] = teams_by_id.get(str(match.get("away_team_id")), {"name": "Visitante"})
            return data

        if table == "match_periods":
            matches = db.select("matches", {"select": "id", "championship_id": f"eq.{championship_id}"})
            match_ids = [str(m.get("id")) for m in matches if m.get("id")]
            if not match_ids:
                return []
            return db.select("match_periods", {"select": "*", "match_id": f"in.({','.join(match_ids)})", "order": "match_id.desc,period_number.asc"})

        if table == "player_match_stats":
            championship_teams = db.select("teams", {"select": "id", "championship_id": f"eq.{championship_id}"})
            allowed_team_ids = [str(team.get("id")) for team in championship_teams if team.get("id")]
            if not allowed_team_ids:
                return []
            data = db.select("player_match_stats", {
                "select": "*,players(first_name,last_name,jersey_number),teams(name)",
                "team_id": f"in.({','.join(allowed_team_ids)})",
                "order": "match_id.desc,points.desc"
            })
            for row in data:
                player = row.get("players") or {}
                team = row.get("teams") or {}
                row["player_name"] = f"{player.get('first_name', '')} {player.get('last_name', '')}".strip()
                row["team_name"] = team.get("name")
            return data

        return []

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
                    "GET /api/stats/players",
                    "POST /api/auth/login",
                    "GET /api/maintenance/{table}",
                    "POST /api/maintenance/{table}",
                    "PUT /api/maintenance/{table}/{id}",
                    "DELETE /api/maintenance/{table}/{id}"
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
            if leader and leader.get("team_id"):
                leader_team = db.select("teams", {"select": "id,name,logo_url", "id": f"eq.{leader.get('team_id')}"})
                if leader_team:
                    leader["logo_url"] = leader_team[0].get("logo_url")
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
            data = db.select("matches", {"select": "*", "championship_id": f"eq.{championship_id}", "order": "match_date.desc,match_time.asc"})
            # Refuerzo del orden en backend: fecha mayor a menor y hora menor a mayor.
            data = sorted(
                data,
                key=lambda m: (m.get("match_date") or "1900-01-01", m.get("match_time") or "00:00:00"),
            )
            data = sorted(data, key=lambda m: m.get("match_date") or "1900-01-01", reverse=True)
            team_ids = sorted({str(m.get("home_team_id")) for m in data if m.get("home_team_id")} | {str(m.get("away_team_id")) for m in data if m.get("away_team_id")})
            teams_by_id = {}
            if team_ids:
                teams = db.select("teams", {"select": "id,name,logo_url", "id": f"in.({','.join(team_ids)})"})
                teams_by_id = {str(team.get("id")): team for team in teams}
            for match in data:
                match["home_team"] = teams_by_id.get(str(match.get("home_team_id")), {"name": "Local"})
                match["away_team"] = teams_by_id.get(str(match.get("away_team_id")), {"name": "Visitante"})
            return self._send_json(data)

        match_detail = re.match(r"^/api/matches/(\d+)$", path)
        if match_detail:
            match_id = match_detail.group(1)
            matches = db.select("matches", {"select": "*", "id": f"eq.{match_id}"})
            if not matches:
                return self._send_error("Partido no encontrado", 404)
            response = matches[0]
            team_ids = [str(tid) for tid in [response.get("home_team_id"), response.get("away_team_id"), response.get("winner_team_id")] if tid]
            teams_by_id = {}
            if team_ids:
                teams = db.select("teams", {"select": "id,name,logo_url", "id": f"in.({','.join(sorted(set(team_ids)))})"})
                teams_by_id = {str(team.get("id")): team for team in teams}
            response["home_team"] = teams_by_id.get(str(response.get("home_team_id")), {"name": "Local"})
            response["away_team"] = teams_by_id.get(str(response.get("away_team_id")), {"name": "Visitante"})
            response["winner_team"] = teams_by_id.get(str(response.get("winner_team_id"))) if response.get("winner_team_id") else None
            periods = db.select("match_periods", {"select": "*", "match_id": f"eq.{match_id}", "order": "period_number.asc"})
            stats = db.select("player_match_stats", {"select": "*,players(first_name,last_name,jersey_number),teams(name)", "match_id": f"eq.{match_id}", "order": "points.desc,points_triple.desc,fouls.desc"})
            response["periods"] = periods
            response["player_stats"] = stats
            return self._send_json(response)

        if path == "/api/standings":
            data = db.select("standings_view", {"select": "*", "championship_id": f"eq.{championship_id}", "order": "championship_points.desc,point_difference.desc,points_for.desc"})
            return self._send_json(data)

        if path == "/api/stats/players":
            championship_teams = db.select("teams", {"select": "id", "championship_id": f"eq.{championship_id}"})
            allowed_team_ids = {str(team.get("id")) for team in championship_teams}

            if not allowed_team_ids:
                return self._send_json([])

            data = db.select("player_match_stats", {
                "select": "team_id,points,points_triple,rebounds,assists,steals,blocks,fouls,players(first_name,last_name,jersey_number),teams(name)",
                "team_id": f"in.({','.join(sorted(allowed_team_ids))})",
                "order": "points.desc"
            })
            aggregated: Dict[str, Dict[str, Any]] = {}
            for row in data:
                if str(row.get("team_id")) not in allowed_team_ids:
                    continue
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
                        "points_triple": 0,
                    }
                for field in ["points", "points_triple", "rebounds", "assists", "steals", "blocks", "fouls"]:
                    aggregated[key][field] += int(row.get(field) or 0)
            ranking = sorted(aggregated.values(), key=lambda item: item["points"], reverse=True)
            return self._send_json(ranking)
        maintenance_match = re.match(r"^/api/maintenance/(championships|teams|players|matches|match_periods|player_match_stats)$", path)
        if maintenance_match:
            table = maintenance_match.group(1)
            championship_id = params.get("championship_id", ["1"])[0]
            return self._send_json(self._get_maintenance_rows(db, table, championship_id))

        return self._send_error("Endpoint no encontrado", 404)

    def _handle_post_api(self, path: str, body: Dict[str, Any]) -> None:
        db = self._client()

        if path == "/api/auth/login":
            name = str(body.get("name", "")).strip()
            password = str(body.get("password", ""))
            if not name or not password:
                return self._send_error("Nombre y contraseña son obligatorios", 400)

            users = db.select("users", {"select": "id,name,email,role,status,password_hash", "name": f"eq.{name}"})
            if not users:
                return self._send_error("Usuario o contraseña incorrectos", 401)

            user = users[0]
            if str(user.get("status", "ACTIVE")).upper() != "ACTIVE":
                return self._send_error("Usuario inactivo", 403)

            if not verify_password(password, str(user.get("password_hash", ""))):
                return self._send_error("Usuario o contraseña incorrectos", 401)

            return self._send_json({
                "user": {
                    "id": user.get("id"),
                    "name": user.get("name"),
                    "email": user.get("email"),
                    "role": user.get("role"),
                }
            })

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


        maintenance_post = re.match(r"^/api/maintenance/(championships|teams|players|matches|match_periods|player_match_stats)$", path)
        if maintenance_post:
            table = maintenance_post.group(1)
            try:
                payload = self._clean_maintenance_payload(table, body)
            except ValueError as exc:
                return self._send_error(str(exc), 400)
            if not payload:
                return self._send_error("No hay datos para insertar", 400)
            return self._send_json(db.insert(table, payload), 201)

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


        maintenance_put = re.match(r"^/api/maintenance/(championships|teams|players|matches|match_periods|player_match_stats)/(\d+)$", path)
        if maintenance_put:
            table = maintenance_put.group(1)
            record_id = maintenance_put.group(2)
            try:
                payload = self._clean_maintenance_payload(table, body)
            except ValueError as exc:
                return self._send_error(str(exc), 400)
            if not payload:
                return self._send_error("No hay datos para actualizar", 400)
            return self._send_json(db.update(table, payload, {"id": f"eq.{record_id}"}))

        return self._send_error("Endpoint no encontrado", 404)


    def _handle_delete_api(self, path: str) -> None:
        db = self._client()
        maintenance_delete = re.match(r"^/api/maintenance/(championships|teams|players|matches|match_periods|player_match_stats)/(\d+)$", path)
        if maintenance_delete:
            table = maintenance_delete.group(1)
            record_id = maintenance_delete.group(2)
            return self._send_json(db.delete(table, {"id": f"eq.{record_id}"}) or {"deleted": True})
        return self._send_error("Endpoint no encontrado", 404)


def run_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    server = ThreadingHTTPServer((host, port), BasketballHandler)
    print(f"Servidor iniciado en http://{host}:{port}")
    print("Usando Supabase. Verifica SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.")
    server.serve_forever()
