# Cambio: menú lateral compacto con Mantenimiento visible

Esta versión cambia el estilo del menú lateral para que, luego del login, el bloque **Mantenimiento** se vea debajo de **Jugadores** en forma vertical y compacta.

## Cambios incluidos

- Menú lateral con scroll vertical real y sin scroll horizontal.
- Opciones principales más compactas.
- Bloque **Mantenimiento** visible solo con sesión iniciada.
- Mantenimiento aparece debajo de **Jugadores**.
- Subopciones:
  - Mant. Torneo
  - Mant. Equipos
  - Mant. Jugadores
  - Mant. Partidos
  - Mant. Tiempos
  - Mant. Estadísticas
- Las ventanas CRUD existentes se mantienen.

## Archivos modificados

- `app/static/index.html`
- `app/static/app.js`
- `app/static/styles.css`

## Publicación

```bash
cd D:\basketball_championship_app
git add app/static/index.html app/static/app.js app/static/styles.css README_CAMBIO_MENU_MANTENIMIENTO.md
git commit -m "Rediseñar menu lateral y mostrar mantenimiento"
git push
```

Luego esperar el deploy de Render o ejecutar **Manual Deploy > Deploy latest commit**.
