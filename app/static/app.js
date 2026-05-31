let currentChampionshipId = null;
let availableChampionships = [];

function getChampionshipId() {
  return Number(currentChampionshipId || 1);
}

function setChampionshipId(value) {
  currentChampionshipId = Number(value || 1);
}

function selectedChampionshipLabel() {
  const item = availableChampionships.find(champ => Number(champ.id) === Number(currentChampionshipId));
  return item ? `${item.name}${item.season ? ' · ' + item.season : ''}` : `Torneo ${currentChampionshipId || ''}`;
}

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

function expandSectionIfNeeded(section) {
  if (!section || !section.classList.contains('section-collapsible')) return;
  if (!section.classList.contains('section-collapsed')) return;
  section.classList.remove('section-collapsed');
  const button = section.querySelector('.section-toggle');
  const icon = button?.querySelector('.toggle-icon');
  button?.setAttribute('aria-expanded', 'true');
  button?.setAttribute('aria-label', 'Contraer sección');
  button?.setAttribute('title', 'Contraer sección');
  if (icon) icon.textContent = '⌃';
}

function navigateToSection(targetId) {
  const id = String(targetId || '').replace('#', '');
  const target = document.getElementById(id);
  if (!target) return false;

  expandSectionIfNeeded(target);

  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 88);
  window.scrollTo({ top, behavior: 'smooth' });

  if (history.replaceState) history.replaceState(null, '', `#${id}`);
  else window.location.hash = id;

  document.querySelectorAll('.main-nav a[href^="#"]').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
  });
  return true;
}

function setupResponsiveMenu() {
  const body = document.body;
  const menuButton = document.getElementById('mobileMenuBtn');
  const closeButton = document.getElementById('closeMenuBtn');
  const overlay = document.getElementById('menuOverlay');
  const nav = document.getElementById('mainNav');

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

  menuButton?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (body.classList.contains('menu-open')) closeMenu();
    else openMenu();
  });

  closeButton?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
  });

  overlay?.addEventListener('click', closeMenu);

  nav?.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    const targetId = link.getAttribute('href');
    closeMenu();
    window.setTimeout(() => navigateToSection(targetId), 90);
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

async function openTeamPlayers(teamId) {
  const modal = document.getElementById('matchDetailModal');
  const content = document.getElementById('matchDetailContent');
  if (!modal || !content) return;

  modal.classList.add('modal-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-is-open');
  content.innerHTML = `
    <div class="modal-header-block">
      <span class="badge">Plantel</span>
      <h2 id="matchDetailTitle">Jugadores del equipo</h2>
      <p>Listado de jugadores registrados para este equipo.</p>
    </div>
    <div class="loading-detail">Cargando jugadores...</div>
  `;

  try {
    const team = await api(`/api/teams/${encodeURIComponent(teamId)}`);
    const players = Array.isArray(team.players) ? team.players : [];
    const safeTeamName = escapeHtml(team.name || 'Equipo');
    const rows = players.length ? players.map(player => `
      <tr>
        <td><strong>#${escapeHtml(player.jersey_number || '-')}</strong></td>
        <td>${escapeHtml(player.first_name || '')} ${escapeHtml(player.last_name || '')}</td>
        <td>${escapeHtml(player.position || '-')}</td>
      </tr>
    `).join('') : '<tr><td colspan="3">Este equipo aún no tiene jugadores registrados.</td></tr>';

    content.innerHTML = `
      <div class="modal-header-block">
        <span class="badge">Plantel</span>
        <h2 id="matchDetailTitle">Jugadores de ${safeTeamName}</h2>
        <p>Listado de jugadores registrados para este equipo.</p>
      </div>
      <div class="table-wrap detail-table-wrap team-players-table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Jugador</th><th>Posición</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (error) {
    content.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
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
          <td>${row.points_triple ?? 0}</td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="7">Aún no hay estadísticas individuales registradas.</td></tr>';

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
          <thead><tr><th>Jugador</th><th>Equipo</th><th>PTS</th><th>REB</th><th>AST</th><th>FALTAS</th><th>PTS (3)</th></tr></thead>
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

async function loadChampionships() {
  const select = document.getElementById('championshipSelect');
  if (!select) return;

  try {
    availableChampionships = await api('/api/championships');

    if (!Array.isArray(availableChampionships) || availableChampionships.length === 0) {
      select.innerHTML = '<option value="1">Torneo principal</option>';
      setChampionshipId(1);
      return;
    }

    // Por defecto siempre se selecciona el primer registro devuelto por la lista.
    // Así evitamos quedar amarrados al id 1 o a una selección anterior del navegador.
    setChampionshipId(availableChampionships[0].id);

    select.innerHTML = availableChampionships.map(champ => {
      const label = `${escapeHtml(champ.name || 'Torneo')} ${champ.season ? '· ' + escapeHtml(champ.season) : ''}`;
      return `<option value="${champ.id}" ${Number(champ.id) === Number(currentChampionshipId) ? 'selected' : ''}>${label}</option>`;
    }).join('');

    select.addEventListener('change', async (event) => {
      setChampionshipId(event.target.value);
      await loadAll();
      navigateToSection('inicio');
    });
  } catch (error) {
    select.innerHTML = `<option value="${getChampionshipId()}">Torneo ${getChampionshipId()}</option>`;
    console.error('No se pudieron cargar los campeonatos:', error);
  }
}

async function loadSummary() {
  try {
    const summary = await api(`/api/summary?championship_id=${getChampionshipId()}`);
    const heroText = document.querySelector('#inicio .hero-title-row p');
    if (heroText) {
      heroText.textContent = `Campeonato seleccionado: ${selectedChampionshipLabel()}. Información actualizada según equipos, jugadores, partidos, posiciones y rankings registrados.`;
    }
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
    const teams = await api(`/api/teams?championship_id=${getChampionshipId()}`);
    document.getElementById('teamsContainer').innerHTML = teams.map(team => `
      <article class="card team-card">
        <div class="team-card-header">
          ${teamLogo(team)}
          <h3>${escapeHtml(team.name)}</h3>
        </div>
        <p class="team-delegate"><strong>Delegado:</strong> ${escapeHtml(team.coach_name || 'No registrado')}</p>
        <div class="team-actions">
          <button class="players-button" type="button" onclick="openTeamPlayers(${team.id})">Jugadores</button>
        </div>
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
    const players = await api(`/api/players?championship_id=${getChampionshipId()}`);
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

function matchTeamRow(team, score, label) {
  const teamName = escapeHtml(team?.name || label || 'Equipo');
  const logoUrl = team?.logo_url ? escapeHtml(team.logo_url) : '';
  const displayScore = Number(score || 0) > 0 ? Number(score || 0) : '-';

  return `
    <div class="match-team-row">
      <div class="match-team-main">
        <div class="match-team-logo">
          ${logoUrl ? `<img src="${logoUrl}" alt="Logo ${teamName}" loading="lazy" />` : '<span>🏀</span>'}
        </div>
        <strong class="match-team-name">${teamName}</strong>
      </div>
      <div class="match-team-score">${displayScore}</div>
    </div>
  `;
}

function matchStatusLabel(status) {
  const value = String(status || '').toUpperCase();
  const labels = {
    FINISHED: 'Finalizado',
    SCHEDULED: 'Programado',
    IN_PROGRESS: 'En juego',
    CANCELLED: 'Cancelado',
    SUSPENDED: 'Suspendido'
  };
  return labels[value] || status || '-';
}

async function loadMatches() {
  try {
    const matches = await api(`/api/matches?championship_id=${getChampionshipId()}`);
    matches.sort((a, b) => `${b.match_date || ''} ${b.match_time || ''}`.localeCompare(`${a.match_date || ''} ${a.match_time || ''}`));
    document.getElementById('matchesContainer').innerHTML = matches.map(m => `
      <article class="match-card match-card-modern">
        <div class="match-teams-panel">
          ${matchTeamRow(m.home_team, m.home_score, 'Local')}
          ${matchTeamRow(m.away_team, m.away_score, 'Visitante')}
        </div>
        <aside class="match-info-panel">
          <span class="match-status-pill">${escapeHtml(matchStatusLabel(m.status))}</span>
          <div class="match-date-block">
            <strong>${escapeHtml(m.match_date || 'Fecha por definir')}</strong>
            <span>${escapeHtml(m.match_time || '')}</span>
          </div>
          <div class="match-venue">📍 ${escapeHtml(m.venue || 'Ubicación por definir')}</div>
          <button class="detail-link-button" type="button" onclick="openMatchDetail(${m.id})">Ver detalle</button>
        </aside>
      </article>
    `).join('') || '<p>No hay partidos registrados.</p>';
  } catch (error) { showError('matchesContainer', error); }
}

async function loadStandings() {
  try {
    const standings = await api(`/api/standings?championship_id=${getChampionshipId()}`);
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
    const stats = await api(`/api/stats/players?championship_id=${getChampionshipId()}`);
    document.getElementById('statsTable').innerHTML = stats.map(s => `
      <tr>
        <td><strong>#${s.jersey_number || '-'} ${escapeHtml(s.player_name)}</strong></td>
        <td>${escapeHtml(s.team_name || '-')}</td>
        <td>${s.points}</td>
        <td>${s.fouls}</td>
        <td>${s.points_triple ?? 0}</td>
        <td>${s.rebounds}</td>
        <td>${s.assists}</td>
        <td>${s.steals}</td>
        <td>${s.blocks}</td>
      </tr>
    `).join('') || '<tr><td colspan="9">No hay estadísticas registradas.</td></tr>';
  } catch (error) { showError('statsTable', error); }
}

async function loadAll() {
  await Promise.all([loadSummary(), loadTeams(), loadPlayers(), loadMatches(), loadStandings(), loadStats()]);
}

document.addEventListener('DOMContentLoaded', async () => {
  setupResponsiveMenu();
  setupSectionToggles();
  setupMatchDetailModal();
  await loadChampionships();
  await loadAll();
});
