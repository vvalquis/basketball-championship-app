# Sección Semifinal y Final

## Archivos modificados

- `app/static/index.html`: menú y nueva sección pública.
- `app/static/app.js`: carga de semifinales, final, proyección por tabla y mantenimiento de la fase del partido.
- `app/static/styles.css`: diseño responsive de las llaves.
- `app/server.py`: permite guardar el campo `phase` en el mantenimiento de partidos.
- `sql/schema_supabase.sql`: incorpora el campo `phase` para instalaciones nuevas.
- `sql/migration_add_match_phase.sql`: migración para la base de datos existente.

## Paso obligatorio en Supabase

Ejecutar una sola vez el contenido de `sql/migration_add_match_phase.sql` en el SQL Editor.

## Uso

En **Mant. Partidos**, seleccionar la fase:

- `REGULAR`: fase regular.
- `SEMIFINAL`: partido de semifinal.
- `FINAL`: partido final.

Cuando no existen partidos marcados como `SEMIFINAL`, la pantalla proyecta las llaves con los cuatro primeros de la tabla: 1.º vs 4.º y 2.º vs 3.º.

Cuando ambas semifinales terminan, la final puede mostrar automáticamente a los ganadores. Al registrar un partido con fase `FINAL`, ese partido pasa a ser la fuente principal de la sección final.


## Partido por el 3.er y 4.º lugar
Para registrar este enfrentamiento, crea un partido con la fase `THIRD_PLACE`.

La sección de fases finales permanece oculta, incluido su enlace en el menú, mientras no exista al menos un partido de fase `SEMIFINAL`, `FINAL` o `THIRD_PLACE` con ambos equipos registrados.

Ejecuta también `sql/migration_add_third_place_phase.sql` en Supabase antes de guardar partidos con esta nueva fase.
