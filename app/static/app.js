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

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showError(containerId, error) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
}

function teamLogo(team) {
  const name = escapeHtml(team?.name || 'Equipo');
  return `<div class="team-logo">${team?.logo_url ? `<img src="${escapeHtml(team.logo_url)}" alt="Logo ${name}" loading="lazy" />` : '🏀'}</div>`;
}

function setupResponsiveMenu() {
  const body = document.body;
  const menuButton = document.getElementById('mobileMenuBtn');
  const closeButton = document.getElementById('closeMenuBtn');
  const overlay = document.getElementById('menuOverlay');
  const nav = document.getElementById('mainNav');
  const links = nav ? nav.querySelectorAll('a[href^="#"]') : [];

  const openMenu = () => {
    body.classList.add('menu-open');
    menuButton?.setAttribute('aria-expanded', 'true');
    overlay?.setAttribute('aria-hidden', 'false');
  };

  const closeMenu = () => {
    body.classList.remove('menu-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    overlay?.setAttribute('aria-hidden', 'true');
  };

  menuButton?.addEventListener('click', openMenu);
  closeButton?.addEventListener('click', closeMenu);
  overlay?.addEventListener('click', closeMenu);

  links.forEach(link => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href');
      const target = targetId ? document.querySelector(targetId) : null;
      if (!target) return;
      event.preventDefault();
      closeMenu();
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', targetId);
      }, 120);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      closeMatchDetail();
    }
  });
}

function setupSectionToggles() {
  document.querySelectorAll('.section-collapsible').forEach((section) => {
    const button = section.querySelector('.section-toggle');
    const content = section.querySelector('.section-content');
    if (!button || !content) return;

    const icon = button.querySelector('.toggle-icon') || button;
    button.addEventListener('click', () => {
      const collapsed = section.classList.toggle('section-collapsed');
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-label', collapsed ? 'Expandir sección' : 'Contraer sección');
      button.setAttribute('title', collapsed ? 'Expandir sección' : 'Contraer sección');
      icon.textContent = collapsed ? '⌄' : '⌃';
    });
  });
}

function closeMatchDetail() {
  const modal = document.getElementById('matchDetailModal');
  if (!modal) return;
  modal.classList.remove('modal-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-is-open');
}

function periodLabel(number) {
  const n = Number(number);
  if (n === 1) return '1.er tiempo / cuarto';
  if (n === 2) return '2.º tiempo / cuarto';
  if (n === 3) return '3.er tiempo / cuarto';
  if (n === 4) return '4.º tiempo / cuarto';
  return `Tiempo extra ${escapeHtml(number)}`;
}

async function openMatchDetail(matchId) {
  const modal = document.getElementById('matchDetailModal');
  const content = document.getElementById('matchDetailContent');
  if (!modal || !content) return;

  modal.classList.add('modal-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-is-open');
  content.innerHTML = '<div class="loading-detail">Cargando detalle del partido...</div>';

  try {
    const match = await api(`/api/matches/${matchId}`);
    const homeName = escapeHtml(match.home_team?.name || 'Local');
    const awayName = escapeHtml(match.away_team?.name || 'Visitante');
    const periods = Array.isArray(match.periods) ? match.periods : [];
    const playerStats = Array.isArray(match.player_stats) ? match.player_stats : [];

    const periodsHtml = periods.length ? periods.map(period => `
      <tr>
        <td>${periodLabel(period.period_number)}</td>
        <td>${period.home_score ?? 0}</td>
        <td>${period.away_score ?? 0}</td>
      </tr>
    `).join('') : '<tr><td colspan="3">Aún no hay resultados por tiempo registrados.</td></tr>';

    const statsHtml = playerStats.length ? playerStats.map(row => {
      const player = row.players || {};
      const team = row.teams || {};
      return `
        <tr>
          <td>#${escapeHtml(player.jersey_number || '-')} ${escapeHtml(player.first_name || '')} ${escapeHtml(player.last_name || '')}</td>
          <td>${escapeHtml(team.name || '-')}</td>
          <td>${row.points ?? 0}</td>
          <td>${row.rebounds ?? 0}</td>
          <td>${row.assists ?? 0}</td>
          <td>${row.fouls ?? 0}</td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="6">Aún no hay estadísticas individuales registradas.</td></tr>';

    content.innerHTML = `
      <div class="modal-header-block">
        <span class="badge">${escapeHtml(match.status || '')}</span>
        <h2 id="matchDetailTitle">${homeName} vs ${awayName}</h2>
        <p>${escapeHtml(match.match_date || '')} ${escapeHtml(match.match_time || '')} · ${escapeHtml(match.venue || '')}</p>
      </div>

      <div class="detail-scoreboard">
        <div><strong>${homeName}</strong><span>${match.home_score ?? 0}</span></div>
        <div class="detail-vs">VS</div>
        <div><strong>${awayName}</strong><span>${match.away_score ?? 0}</span></div>
      </div>

      <h3>Resultados por tiempo</h3>
      <div class="table-wrap detail-table-wrap">
        <table>
          <thead><tr><th>Tiempo</th><th>${homeName}</th><th>${awayName}</th></tr></thead>
          <tbody>${periodsHtml}</tbody>
        </table>
      </div>

      <h3>Estadísticas de jugadores</h3>
      <div class="table-wrap detail-table-wrap">
        <table>
          <thead><tr><th>Jugador</th><th>Equipo</th><th>PTS</th><th>REB</th><th>AST</th><th>FALTAS</th></tr></thead>
          <tbody>${statsHtml}</tbody>
        </table>
      </div>
    `;
  } catch (error) {
    content.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

function setupMatchDetailModal() {
  document.querySelectorAll('[data-close-match-detail]').forEach((el) => {
    el.addEventListener('click', closeMatchDetail);
  });
}

async function loadSummary() {
  try {
    const summary = await api(`/api/summary?championship_id=${CHAMPIONSHIP_ID}`);
    document.getElementById('summaryCards').innerHTML = `
      <div class="card"><h3>Equipos</h3><div class="metric">${summary.teams}</div><p>Franquicias participantes</p></div>
      <div class="card"><h3>Jugadores</h3><div class="metric">${summary.players}</div><p>Planteles registrados</p></div>
      <div class="card"><h3>Partidos</h3><div class="metric">${summary.matches}</div><p>${summary.finished_matches} finalizados</p></div>
      <div class="card"><h3>Líder</h3><div class="metric">${escapeHtml(summary.leader?.team_name || '-')}</div><p>${summary.leader?.championship_points || 0} puntos</p></div>
    `;
  } catch (error) { showError('summaryCards', error); }
}

async function loadTeams() {
  try {
    const teams = await api(`/api/teams?championship_id=${CHAMPIONSHIP_ID}`);
    document.getElementById('teamsContainer').innerHTML = teams.map(team => `
      <article class="card team-card">
        ${teamLogo(team)}
        <h3>${escapeHtml(team.name)}</h3>
        <p>Head coach: ${escapeHtml(team.coach_name || 'No registrado')}</p>
        <span class="badge">${escapeHtml(team.status || 'ACTIVE')}</span>
      </article>
    `).join('') || '<p>No hay equipos registrados.</p>';

    const teamSelect = document.getElementById('teamSelect');
    if (teamSelect) {
      const options = teams.map(team => `<option value="${team.id}">${escapeHtml(team.name)}</option>`).join('');
      teamSelect.innerHTML = options;
    }
  } catch (error) { showError('teamsContainer', error); }
}

async function loadPlayers() {
  try {
    const players = await api(`/api/players?championship_id=${CHAMPIONSHIP_ID}`);
    document.getElementById('playersTable').innerHTML = players.map(p => `
      <tr>
        <td><strong>#${p.jersey_number}</strong></td>
        <td>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</td>
        <td>${escapeHtml(p.teams?.name || '-')}</td>
        <td>${escapeHtml(p.position || '-')}</td>
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
          <div class="team">${escapeHtml(m.home_team?.name || 'Local')}</div>
          <p>${escapeHtml(m.match_date || '')} ${escapeHtml(m.match_time || '')}<br>${escapeHtml(m.venue || '')}</p>
        </div>
        <div>
          <div class="score">${m.home_score} - ${m.away_score}</div>
          <span class="badge">${escapeHtml(m.status)}</span>
        </div>
        <div>
          <div class="team">${escapeHtml(m.away_team?.name || 'Visitante')}</div>
          <p><button class="detail-link-button" type="button" onclick="openMatchDetail(${m.id})">Ver detalle</button></p>
        </div>
      </article>
    `).join('') || '<p>No hay partidos registrados.</p>';
  } catch (error) { showError('matchesContainer', error); }
}

async function loadStandings() {
  try {
    const standings = await api(`/api/standings?championship_id=${CHAMPIONSHIP_ID}`);
    document.getElementById('standingsTable').innerHTML = standings.map((s, index) => `
      <tr>
        <td><strong>${index + 1}. ${escapeHtml(s.team_name)}</strong></td>
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
        <td><strong>#${s.jersey_number || '-'} ${escapeHtml(s.player_name)}</strong></td>
        <td>${escapeHtml(s.team_name || '-')}</td>
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

const teamForm = document.getElementById('teamForm');
if (teamForm) {
  teamForm.addEventListener('submit', async (event) => {
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
}

const playerForm = document.getElementById('playerForm');
if (playerForm) {
  playerForm.addEventListener('submit', async (event) => {
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
}

setupResponsiveMenu();
setupSectionToggles();
setupMatchDetailModal();
loadAll();
