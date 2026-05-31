let currentChampionshipId = null;
let availableChampionships = [];

const PAGE_SIZE = 5;
let playersData = [];
let playersCurrentPage = 1;
let statsData = [];
let statsCurrentPage = 1;
let activeMatchesTab = 'scheduled';

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


function totalPages(items, pageSize = PAGE_SIZE) {
  return Math.max(1, Math.ceil((Array.isArray(items) ? items.length : 0) / pageSize));
}

function pageSlice(items, page, pageSize = PAGE_SIZE) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function renderPagination(containerId, currentPage, pages, onClickName, totalItems) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!totalItems || totalItems <= PAGE_SIZE) {
    container.innerHTML = '';
    return;
  }

  const pageButtons = Array.from({ length: pages }, (_, i) => {
    const page = i + 1;
    return `<button type="button" class="pagination-page ${page === currentPage ? 'active' : ''}" onclick="${onClickName}(${page})" aria-label="Ir a página ${page}" ${page === currentPage ? 'aria-current="page"' : ''}>${page}</button>`;
  }).join('');

  container.innerHTML = `
    <button type="button" class="pagination-button" onclick="${onClickName}(${Math.max(1, currentPage - 1)})" ${currentPage === 1 ? 'disabled' : ''}>‹ Anterior</button>
    <div class="pagination-pages">${pageButtons}</div>
    <button type="button" class="pagination-button" onclick="${onClickName}(${Math.min(pages, currentPage + 1)})" ${currentPage === pages ? 'disabled' : ''}>Siguiente ›</button>
    <span class="pagination-summary">${totalItems} registros</span>
  `;
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

  // Evita registrar eventos duplicados si el script se recarga.
  if (!menuButton || menuButton.dataset.menuReady === 'true') return;
  menuButton.dataset.menuReady = 'true';

  const setMenuState = (isOpen) => {
    body.classList.toggle('menu-open', isOpen);
    body.classList.toggle('side-menu-open', isOpen);
    menuButton.setAttribute('aria-expanded', String(isOpen));
    overlay?.setAttribute('aria-hidden', String(!isOpen));
  };

  const openMenu = () => setMenuState(true);
  const closeMenu = () => setMenuState(false);
  const toggleMenu = () => setMenuState(!body.classList.contains('menu-open'));

  menuButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleMenu();
  });

  closeButton?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
  });

  overlay?.addEventListener('click', (event) => {
    event.preventDefault();
    closeMenu();
  });

  nav?.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;

    event.preventDefault();
    event.stopPropagation();

    const targetId = link.getAttribute('href');
    closeMenu();

    // Espera a que el menú libere el scroll y luego navega a la sección.
    window.setTimeout(() => navigateToSection(targetId), 160);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      closeMatchDetail();
    }
  });

  // Al rotar o cambiar tamaño en celular/tablet, cierra el menú para que no quede parcial.
  let resizeTimer;
  const closeAfterLayoutChange = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(closeMenu, 140);
  };

  window.addEventListener('orientationchange', closeAfterLayoutChange);
  window.addEventListener('resize', closeAfterLayoutChange);
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
    const playerStats = (Array.isArray(match.player_stats) ? match.player_stats : []).slice().sort((a, b) => {
      const pointsDiff = Number(b.points || 0) - Number(a.points || 0);
      if (pointsDiff) return pointsDiff;
      const tripleDiff = Number(b.points_triple || 0) - Number(a.points_triple || 0);
      if (tripleDiff) return tripleDiff;
      const foulsDiff = Number(b.fouls || 0) - Number(a.fouls || 0);
      if (foulsDiff) return foulsDiff;
      const aPlayer = `${a.players?.first_name || ''} ${a.players?.last_name || ''}`.trim().toLowerCase();
      const bPlayer = `${b.players?.first_name || ''} ${b.players?.last_name || ''}`.trim().toLowerCase();
      return aPlayer.localeCompare(bPlayer, 'es');
    });

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
          <td>${row.fouls ?? 0}</td>
          <td>${row.points_triple ?? 0}</td>
          <td>${row.rebounds ?? 0}</td>
          <td>${row.assists ?? 0}</td>
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
          <thead><tr><th>Jugador</th><th>Equipo</th><th>PTS</th><th>FALTAS</th><th>PTS (3)</th><th>REB</th><th>AST</th></tr></thead>
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
    playersData = await api(`/api/players?championship_id=${getChampionshipId()}`);
    playersCurrentPage = 1;
    renderPlayersPage();
  } catch (error) { showError('playersTable', error); }
}

function renderPlayersPage() {
  const table = document.getElementById('playersTable');
  if (!table) return;

  const pages = totalPages(playersData);
  playersCurrentPage = Math.min(Math.max(1, playersCurrentPage), pages);
  const rows = pageSlice(playersData, playersCurrentPage).map(p => `
    <tr>
      <td><strong>#${p.jersey_number}</strong></td>
      <td>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</td>
      <td>${escapeHtml(p.teams?.name || '-')}</td>
      <td>${escapeHtml(p.position || '-')}</td>
    </tr>
  `).join('');

  table.innerHTML = rows || '<tr><td colspan="4">No hay jugadores registrados.</td></tr>';
  renderPagination('playersPagination', playersCurrentPage, pages, 'goToPlayersPage', playersData.length);
}

function goToPlayersPage(page) {
  playersCurrentPage = Number(page || 1);
  renderPlayersPage();
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

function getMatchDateValue(match) {
  return match?.match_date || '1900-01-01';
}

function getMatchTimeValue(match) {
  const time = match?.match_time || '00:00:00';
  return String(time).length === 5 ? `${time}:00` : time;
}

function sortMatchesByDateDescTimeAsc(items) {
  return (Array.isArray(items) ? items : []).slice().sort((a, b) => {
    const dateCompare = getMatchDateValue(b).localeCompare(getMatchDateValue(a));
    if (dateCompare !== 0) return dateCompare;
    return getMatchTimeValue(a).localeCompare(getMatchTimeValue(b));
  });
}

function isFinishedMatch(match) {
  return String(match?.status || '').toUpperCase() === 'FINISHED';
}

function setupMatchTabs() {
  document.querySelectorAll('[data-match-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activeMatchesTab = button.dataset.matchTab || 'scheduled';
      document.querySelectorAll('[data-match-tab]').forEach((tab) => {
        const isActive = tab.dataset.matchTab === activeMatchesTab;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
      });
      loadMatches();
    });
  });
}

async function loadMatches() {
  try {
    const matches = await api(`/api/matches?championship_id=${getChampionshipId()}`);
    const filteredMatches = sortMatchesByDateDescTimeAsc(matches.filter(m => activeMatchesTab === 'finished' ? isFinishedMatch(m) : !isFinishedMatch(m)));
    const emptyMessage = activeMatchesTab === 'finished' ? 'No hay partidos finalizados registrados.' : 'No hay partidos programados registrados.';
    document.getElementById('matchesContainer').innerHTML = filteredMatches.map(m => `
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
    `).join('') || `<p>${emptyMessage}</p>`;
  } catch (error) { showError('matchesContainer', error); }
}

async function loadStandings() {
  try {
    const standings = await api(`/api/standings?championship_id=${getChampionshipId()}`);
    document.getElementById('standingsTable').innerHTML = standings.map((s, index) => `
      <tr>
        <td><strong>${index + 1}. ${escapeHtml(s.team_name)}</strong></td>
        <td><strong>${s.championship_points}</strong></td>
        <td>${s.played}</td>
        <td>${s.wins}</td>
        <td>${s.losses}</td>
        <td>${s.points_for}</td>
        <td>${s.points_against}</td>
        <td>${s.point_difference}</td>
      </tr>
    `).join('') || '<tr><td colspan="8">No hay tabla disponible.</td></tr>';
  } catch (error) { showError('standingsTable', error); }
}

async function loadStats() {
  try {
    statsData = await api(`/api/stats/players?championship_id=${getChampionshipId()}`);
    statsCurrentPage = 1;
    renderStatsPage();
  } catch (error) { showError('statsTable', error); }
}

function renderStatsPage() {
  const table = document.getElementById('statsTable');
  if (!table) return;

  const pages = totalPages(statsData);
  statsCurrentPage = Math.min(Math.max(1, statsCurrentPage), pages);
  const rows = pageSlice(statsData, statsCurrentPage).map(s => `
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
  `).join('');

  table.innerHTML = rows || '<tr><td colspan="9">No hay estadísticas registradas.</td></tr>';
  renderPagination('statsPagination', statsCurrentPage, pages, 'goToStatsPage', statsData.length);
}

function goToStatsPage(page) {
  statsCurrentPage = Number(page || 1);
  renderStatsPage();
}

async function loadAll() {
  await Promise.all([loadSummary(), loadTeams(), loadPlayers(), loadMatches(), loadStandings(), loadStats()]);
}

document.addEventListener('DOMContentLoaded', async () => {
  setupResponsiveMenu();
  setupSectionToggles();
  setupMatchDetailModal();
  setupMatchTabs();
  await loadChampionships();
  await loadAll();
});
