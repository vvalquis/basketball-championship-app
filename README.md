# Basketball Championship App - Supabase

Aplicación web responsive para campeonato de basketball usando:

- Python 3.14 compatible
- Librerías estándar de Python
- Supabase PostgreSQL como base de datos persistente
- HTML, CSS y JavaScript
- Backend con APIs REST simples

## 1. Crear base de datos en Supabase

1. Ingresa a https://supabase.com
2. Crea un nuevo proyecto.
3. Abre SQL Editor.
4. Ejecuta `sql/schema_supabase.sql`.
5. Opcional: ejecuta `sql/sample_data.sql` para cargar datos de prueba.

## 2. Obtener variables de Supabase

En Supabase:

1. Project Settings.
2. API.
3. Copia:
   - Project URL
   - service_role key

Nunca publiques la service_role key en frontend ni en GitHub.

## 3. Ejecutar localmente

Crea un archivo `.env` en la raíz del proyecto:

```env
SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
PORT=8000
```

Ejecuta:

```bash
python run.py
```

Abre:

```text
http://127.0.0.1:8000
```

APIs:

```text
http://127.0.0.1:8000/api/docs
```

## 4. Publicar en Render

1. Sube el proyecto a GitHub.
2. Entra a Render.
3. New Web Service.
4. Conecta tu repositorio.
5. Configura:
   - Runtime: Python
   - Build Command: echo Sin dependencias externas
   - Start Command: python run.py
6. En Environment Variables agrega:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
7. Deploy.

Render asigna el puerto mediante la variable `PORT`. La aplicación ya está preparada para leerla automáticamente.

## 5. Endpoints principales

```text
GET /api/health
GET /api/docs
GET /api/summary?championship_id=1
GET /api/championships
GET /api/teams?championship_id=1
POST /api/teams
GET /api/teams/{id}
GET /api/players?championship_id=1
POST /api/players
GET /api/matches?championship_id=1
POST /api/matches
GET /api/matches/{id}
PUT /api/matches/{id}/result
GET /api/standings?championship_id=1
GET /api/stats/players
```

## 6. Ejemplo registrar equipo

```json
{
  "championship_id": 1,
  "name": "Lima Basket",
  "coach_name": "Juan Pérez",
  "logo_url": ""
}
```

## 7. Ejemplo actualizar resultado

```json
{
  "home_score": 72,
  "away_score": 65,
  "period_scores": [
    {"period": 1, "home": 18, "away": 14},
    {"period": 2, "home": 20, "away": 16},
    {"period": 3, "home": 15, "away": 18},
    {"period": 4, "home": 19, "away": 17}
  ]
}
```
