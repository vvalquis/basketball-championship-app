import json
import os
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional


def _load_env_file() -> None:
    """Carga variables desde .env si existe. No requiere python-dotenv."""
    env_path = os.path.join(os.getcwd(), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file()


class SupabaseError(Exception):
    pass


class SupabaseClient:
    def __init__(self) -> None:
        self.base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.api_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.base_url or not self.api_key:
            raise SupabaseError(
                "Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. "
                "Configúralas en .env o en las variables de entorno de Render."
            )
        self.rest_url = f"{self.base_url}/rest/v1"

    def _headers(self, prefer: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def request(
        self,
        method: str,
        path: str,
        query: Optional[Dict[str, str]] = None,
        body: Optional[Any] = None,
        prefer: Optional[str] = None,
    ) -> Any:
        query_string = ""
        if query:
            query_string = "?" + urllib.parse.urlencode(query, safe=",.():*\"")
        url = f"{self.rest_url}/{path.lstrip('/')}{query_string}"
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            url=url,
            data=data,
            headers=self._headers(prefer=prefer),
            method=method.upper(),
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                raw = response.read().decode("utf-8")
                if not raw:
                    return None
                return json.loads(raw)
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8")
            raise SupabaseError(f"Supabase HTTP {error.code}: {detail}") from error
        except urllib.error.URLError as error:
            raise SupabaseError(f"No se pudo conectar a Supabase: {error.reason}") from error

    def select(self, table: str, query: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
        result = self.request("GET", table, query=query or {})
        return result or []

    def insert(self, table: str, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        return self.request("POST", table, body=payload, prefer="return=representation") or []

    def update(self, table: str, payload: Dict[str, Any], query: Dict[str, str]) -> List[Dict[str, Any]]:
        return self.request("PATCH", table, query=query, body=payload, prefer="return=representation") or []

    def delete(self, table: str, query: Dict[str, str]) -> Any:
        return self.request("DELETE", table, query=query, prefer="return=representation")
