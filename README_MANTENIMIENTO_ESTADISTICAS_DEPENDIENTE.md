# Cambio en Mant. Estadísticas

El formulario de estadísticas ahora solicita la información en este orden:

1. Partido
2. Equipo
3. Jugador

Reglas aplicadas:

- Al seleccionar el partido, el campo Equipo muestra únicamente el equipo local y el equipo visitante de ese encuentro.
- Al seleccionar el equipo, el campo Jugador muestra únicamente los jugadores que pertenecen a ese equipo.
- Al cambiar el partido, se limpian el equipo y el jugador seleccionados.
- Al cambiar el equipo, se limpia el jugador seleccionado.
- Al editar una estadística existente, se mantienen seleccionados el partido, equipo y jugador correspondientes.

No requiere cambios en Supabase ni ejecución de scripts SQL.
