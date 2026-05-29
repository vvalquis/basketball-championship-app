const CHAMPIONSHIP_ID = 1;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error consultando API');
  }
  return data;
}

function showError(containerId, error) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="error">${error.message}</div>`;
}

async function loadSummary() {
  try {
    const summary = await api(`/api/summary?championship_id=${CHAMPIONSHIP_ID}`);
    document.getElementById('summaryCards').innerHTML = `
      <div class="card"><h3>Equipos</h3><div class="metric">${summary.teams}</div></div>
      <div class="card"><h3>Jugadores</h3><div class="metric">${summary.players}</div></div>
      <div class="card"><h3>Partidos</h3><div class="metric">${summary.matches}</div><p>${summary.finished_matches} finalizados</p></div>
      <div class="card"><h3>Líder</h3><div class="metric">${summary.leader?.team_name || '-'}</div><p>${summary.leader?.championship_points || 0} puntos</p></div>
    `;
  } catch (error) { showError('summaryCards', error); }
}

async function loadTeams() {
  try {
    const teams = await api(`/api/teams?championship_id=${CHAMPIONSHIP_ID}`);
    document.getElementById('teamsContainer').innerHTML = teams.map(team => `
      <article class="card">
        <div class="team-logo">${team.logo_url ? `<img src="${team.logo_url}" alt="${team.name}" />` : '🏀'}</div>
        <h3>${team.name}</h3>
        <p>Entrenador: ${team.coach_name || 'No registrado'}</p>
        <span class="badge">${team.status || 'ACTIVE'}</span>
      </article>
    `).join('') || '<p>No hay equipos registrados.</p>';

    const options = teams.map(team => `<option value="${team.id}">${team.name}</option>`).join('');
    document.getElementById('teamSelect').innerHTML = options;
  } catch (error) { showError('teamsContainer', error); }
}

async function loadPlayers() {
  try {
    const players = await api(`/api/players?championship_id=${CHAMPIONSHIP_ID}`);
    document.getElementById('playersTable').innerHTML = players.map(p => `
      <tr>
        <td>${p.jersey_number}</td>
        <td>${p.first_name} ${p.last_name}</td>
        <td>${p.teams?.name || '-'}</td>
        <td>${p.position || '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">No hay jugadores registrados.</td></tr>';
  } catch (error) { showError('playersTable', error); }
}

async function loadMatches() {
  try {
    const matches = await api(`/api/matches?championship_id=${CHAMPIONSHIP_ID}`);
    document.getElementById('matchesContainer').innerHTML = matches.map(m => `
      <article class="match-card">
        <div>
          <div class="team">${m.home_team?.name || 'Local'}</div>
          <p>${m.match_date || ''} ${m.match_time || ''}<br>${m.venue || ''}</p>
        </div>
        <div>
          <div class="score">${m.home_score} - ${m.away_score}</div>
          <span class="badge">${m.status}</span>
        </div>
        <div>
          <div class="team">${m.away_team?.name || 'Visitante'}</div>
          <p><a href="/api/matches/${m.id}" target="_blank">Ver detalle JSON</a></p>
        </div>
      </article>
    `).join('') || '<p>No hay partidos registrados.</p>';
  } catch (error) { showError('matchesContainer', error); }
}

async function loadStandings() {
  try {
    const standings = await api(`/api/standings?championship_id=${CHAMPIONSHIP_ID}`);
    document.getElementById('standingsTable').innerHTML = standings.map(s => `
      <tr>
        <td>${s.team_name}</td>
        <td>${s.played}</td>
        <td>${s.wins}</td>
        <td>${s.losses}</td>
        <td>${s.points_for}</td>
        <td>${s.points_against}</td>
        <td>${s.point_difference}</td>
        <td><strong>${s.championship_points}</strong></td>
      </tr>
    `).join('') || '<tr><td colspan="8">No hay tabla disponible.</td></tr>';
  } catch (error) { showError('standingsTable', error); }
}

async function loadStats() {
  try {
    const stats = await api('/api/stats/players');
    document.getElementById('statsTable').innerHTML = stats.map(s => `
      <tr>
        <td>#${s.jersey_number || '-'} ${s.player_name}</td>
        <td>${s.team_name || '-'}</td>
        <td>${s.points}</td>
        <td>${s.rebounds}</td>
        <td>${s.assists}</td>
        <td>${s.steals}</td>
        <td>${s.blocks}</td>
        <td>${s.fouls}</td>
      </tr>
    `).join('') || '<tr><td colspan="8">No hay estadísticas registradas.</td></tr>';
  } catch (error) { showError('statsTable', error); }
}

async function loadAll() {
  await Promise.all([loadSummary(), loadTeams(), loadPlayers(), loadMatches(), loadStandings(), loadStats()]);
}

document.getElementById('teamForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = {
    championship_id: CHAMPIONSHIP_ID,
    name: form.get('name'),
    coach_name: form.get('coach_name'),
    logo_url: form.get('logo_url'),
  };
  try {
    await api('/api/teams', { method: 'POST', body: JSON.stringify(payload) });
    event.target.reset();
    await loadAll();
    alert('Equipo registrado correctamente');
  } catch (error) { alert(error.message); }
});

document.getElementById('playerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = {
    team_id: Number(form.get('team_id')),
    first_name: form.get('first_name'),
    last_name: form.get('last_name'),
    jersey_number: Number(form.get('jersey_number')),
    position: form.get('position'),
  };
  try {
    await api('/api/players', { method: 'POST', body: JSON.stringify(payload) });
    event.target.reset();
    await loadAll();
    alert('Jugador registrado correctamente');
  } catch (error) { alert(error.message); }
});

loadAll();
