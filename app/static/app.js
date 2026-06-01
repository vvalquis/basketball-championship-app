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


function resetDetailModalScroll() {
  const panel = document.querySelector('#matchDetailModal .modal-panel');
  if (panel) panel.scrollTop = 0;
}

async function openTeamPlayers(teamId) {
  const modal = document.getElementById('matchDetailModal');
  const content = document.getElementById('matchDetailContent');
  if (!modal || !content) return;

  modal.classList.add('modal-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-is-open');
  resetDetailModalScroll();
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
  resetDetailModalScroll();
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
      <div class="card leader-card">
        <h3>Líder</h3>
        <div class="leader-team-block">
          ${summary.leader ? teamLogo({ name: summary.leader.team_name, logo_url: summary.leader.logo_url }) : '<div class="team-logo">🏀</div>'}
          <p class="leader-team-name">${escapeHtml(summary.leader?.team_name || 'Sin líder')}</p>
        </div>
      </div>
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


/* =========================================================
   Autenticación simple contra tabla users
   ========================================================= */
let currentUser = null;
const AUTH_STORAGE_KEY = 'fenix_admin_user';

function saveSession(user) {
  currentUser = user || null;
  if (currentUser) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
  else localStorage.removeItem(AUTH_STORAGE_KEY);
  renderAuthState();
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    currentUser = raw ? JSON.parse(raw) : null;
  } catch (_) {
    currentUser = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  renderAuthState();
}

function isLoggedIn() {
  return Boolean(currentUser && currentUser.name);
}


function ensureMaintenanceMenuGroup() {
  // Ya no se usa un grupo contenedor "Mantenimiento".
  // Las opciones administrativas se muestran como opciones directas del menú lateral.
  return document.getElementById('mainNav');
}

function setMaintenanceMenuVisible(visible) {
  const nav = document.getElementById('mainNav');
  if (!nav) return;

  // Sin login: Inicio, Equipos, Partidos, Posiciones, Estadísticas, Jugadores.
  // Con login: Inicio, Mant. Torneo, Mant. Equipos, Mant. Jugadores, Mant. Partidos, Mant. Tiempos, Mant. Estadísticas.
  nav.querySelectorAll('.public-only').forEach((el) => {
    el.classList.toggle('hidden', visible);
    el.setAttribute('aria-hidden', visible ? 'true' : 'false');
  });

  nav.querySelectorAll('.admin-menu-link').forEach((el) => {
    el.classList.toggle('hidden', !visible);
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
  });
}

function renderAuthState() {
  const loggedIn = isLoggedIn();
  document.body.classList.toggle('admin-logged', loggedIn);
  document.body.classList.toggle('is-authenticated', loggedIn);
  document.body.classList.toggle('logged-in', loggedIn);
  document.querySelectorAll('.auth-only').forEach((el) => {
    if (el.classList.contains('admin-menu-link')) return;
    el.classList.toggle('hidden', !loggedIn);
  });
  setMaintenanceMenuVisible(loggedIn);

  const loginBtn = document.getElementById('loginBtn');
  const userBox = document.getElementById('loggedUserBox');
  const userName = document.getElementById('loggedUserName');

  if (loginBtn) loginBtn.classList.toggle('hidden', loggedIn);
  if (userBox) userBox.classList.toggle('hidden', !loggedIn);
  if (userName) userName.textContent = loggedIn ? `👤 ${currentUser.name}` : '';

  if (loggedIn) {
    loadMaintenanceData().catch((error) => console.error('No se pudo cargar mantenimiento:', error));
  }
}

function openLoginModal() {
  const modal = document.getElementById('loginModal');
  const error = document.getElementById('loginError');
  if (!modal) return;
  if (error) error.textContent = '';
  modal.classList.add('modal-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-is-open');
  setTimeout(() => document.getElementById('loginName')?.focus(), 80);
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (!modal) return;
  modal.classList.remove('modal-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-is-open');
}

function setupLogin() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const form = document.getElementById('loginForm');

  loginBtn?.addEventListener('click', openLoginModal);
  logoutBtn?.addEventListener('click', () => {
    saveSession(null);
    document.querySelectorAll('.maintenance-section').forEach((section) => section.classList.add('hidden'));
  });

  document.querySelectorAll('[data-close-login]').forEach((el) => el.addEventListener('click', closeLoginModal));

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.getElementById('loginError');
    if (error) error.textContent = '';

    const name = document.getElementById('loginName')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value || '';

    if (!name || !password) {
      if (error) error.textContent = 'Ingresa nombre y contraseña.';
      return;
    }

    try {
      const result = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ name, password }),
      });
      saveSession(result.user);
      closeLoginModal();
      form.reset();
    } catch (err) {
      if (error) error.textContent = err.message || 'No se pudo iniciar sesión.';
    }
  });
}

function setupAuthEscapeHandler() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeLoginModal();
  });
}

function emptyRow(colspan, text) {
  return `<tr><td colspan="${colspan}">${escapeHtml(text)}</td></tr>`;
}

async function loadMaintenanceData() {
  if (!isLoggedIn()) return;
  const championshipId = getChampionshipId();
  const [teams, players, matches, periods, stats] = await Promise.all([
    api(`/api/maintenance/teams?championship_id=${championshipId}`),
    api(`/api/maintenance/players?championship_id=${championshipId}`),
    api(`/api/maintenance/matches?championship_id=${championshipId}`),
    api(`/api/maintenance/match_periods?championship_id=${championshipId}`),
    api(`/api/maintenance/player_match_stats?championship_id=${championshipId}`),
  ]);

  const mt = document.getElementById('maintenanceTeamsTable');
  if (mt) mt.innerHTML = teams.map(t => `
    <tr>
      <td>${t.id}</td>
      <td><strong>${escapeHtml(t.name || '-')}</strong></td>
      <td>${escapeHtml(t.coach_name || '-')}</td>
      <td>${t.logo_url ? '<span class="status-ok">Sí</span>' : '-'}</td>
    </tr>
  `).join('') || emptyRow(4, 'No hay equipos registrados.');

  const mp = document.getElementById('maintenancePlayersTable');
  if (mp) mp.innerHTML = players.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.jersey_number ?? '-'}</td>
      <td><strong>${escapeHtml((p.first_name || '') + ' ' + (p.last_name || ''))}</strong></td>
      <td>${escapeHtml(p.teams?.name || '-')}</td>
      <td>${escapeHtml(p.position || '-')}</td>
    </tr>
  `).join('') || emptyRow(5, 'No hay jugadores registrados.');

  const mm = document.getElementById('maintenanceMatchesTable');
  if (mm) mm.innerHTML = matches.map(m => `
    <tr>
      <td>${m.id}</td>
      <td>${escapeHtml(m.home_team?.name || '-')}</td>
      <td>${escapeHtml(m.away_team?.name || '-')}</td>
      <td>${escapeHtml(m.match_date || '-')}</td>
      <td>${escapeHtml(m.match_time || '-')}</td>
      <td>${escapeHtml(matchStatusLabel(m.status))}</td>
      <td>${m.home_score ?? 0} - ${m.away_score ?? 0}</td>
    </tr>
  `).join('') || emptyRow(7, 'No hay partidos registrados.');

  const mper = document.getElementById('maintenancePeriodsTable');
  if (mper) mper.innerHTML = periods.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.match_id}</td>
      <td>${p.period_number}</td>
      <td>${p.home_score ?? 0}</td>
      <td>${p.away_score ?? 0}</td>
    </tr>
  `).join('') || emptyRow(5, 'No hay tiempos registrados.');

  const ms = document.getElementById('maintenanceStatsTable');
  if (ms) ms.innerHTML = stats.map(s => {
    const player = s.players || {};
    const name = `${player.first_name || ''} ${player.last_name || ''}`.trim() || '-';
    return `
      <tr>
        <td>${s.id}</td>
        <td>${s.match_id}</td>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(s.teams?.name || '-')}</td>
        <td>${s.points ?? 0}</td>
        <td>${s.fouls ?? 0}</td>
        <td>${s.points_triple ?? 0}</td>
        <td>${s.rebounds ?? 0}</td>
        <td>${s.assists ?? 0}</td>
      </tr>
    `;
  }).join('') || emptyRow(9, 'No hay estadísticas registradas.');
}

async function loadAll() {
  await Promise.all([loadSummary(), loadTeams(), loadPlayers(), loadMatches(), loadStandings(), loadStats()]);
  if (isLoggedIn()) await loadMaintenanceData();
}

document.addEventListener('DOMContentLoaded', async () => {
  setupResponsiveMenu();
  setupSectionToggles();
  setupMatchDetailModal();
  setupMatchTabs();
  setupLogin();
  ensureMaintenanceMenuGroup();
  setupMaintenanceMenu();
  setupAuthEscapeHandler();
  restoreSession();
  await loadChampionships();
  await loadAll();
});

/* =========================================================
   FIX: mantener cabecera fija y calcular altura real del header
   ========================================================= */
(function setupFixedHeaderOffset() {
  function applyHeaderOffset() {
    const header = document.querySelector('.topbar');
    if (!header) return;
    const height = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--fixed-header-height', `${height}px`);
  }

  window.addEventListener('load', applyHeaderOffset);
  window.addEventListener('resize', applyHeaderOffset);
  window.addEventListener('orientationchange', () => setTimeout(applyHeaderOffset, 250));
  document.addEventListener('DOMContentLoaded', () => setTimeout(applyHeaderOffset, 50));
})();


/* =========================================================
   Mantenimiento CRUD genérico
   ========================================================= */
const MAINTENANCE_TABLES = {
  championships: {
    title: 'Mant. Torneo',
    subtitle: 'Mantenimiento de la tabla championships.',
    endpoint: 'championships',
    columns: ['id', 'name', 'season', 'category', 'start_date', 'end_date', 'status'],
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'season', label: 'Temporada', type: 'text' },
      { name: 'category', label: 'Categoría', type: 'text' },
      { name: 'start_date', label: 'Fecha inicio', type: 'date' },
      { name: 'end_date', label: 'Fecha fin', type: 'date' },
      { name: 'status', label: 'Estado', type: 'select', options: ['ACTIVE', 'INACTIVE'] },
    ],
  },
  teams: {
    title: 'Mant. Equipos',
    subtitle: 'Mantenimiento de la tabla teams.',
    endpoint: 'teams',
    columns: ['id', 'name', 'coach_name', 'logo_url', 'status'],
    fields: [
      { name: 'championship_id', label: 'Torneo', type: 'championship', required: true },
      { name: 'name', label: 'Equipo', type: 'text', required: true },
      { name: 'coach_name', label: 'Delegado', type: 'text' },
      { name: 'logo_url', label: 'Logo URL', type: 'text' },
      { name: 'status', label: 'Estado', type: 'select', options: ['ACTIVE', 'INACTIVE'] },
    ],
  },
  players: {
    title: 'Mant. Jugadores',
    subtitle: 'Mantenimiento de la tabla players.',
    endpoint: 'players',
    columns: ['id', 'jersey_number', 'first_name', 'last_name', 'team_name', 'position', 'status'],
    fields: [
      { name: 'team_id', label: 'Equipo', type: 'team', required: true },
      { name: 'first_name', label: 'Nombres', type: 'text', required: true },
      { name: 'last_name', label: 'Apellidos', type: 'text', required: true },
      { name: 'jersey_number', label: 'Número', type: 'number', required: true },
      { name: 'position', label: 'Posición', type: 'text' },
      { name: 'birth_date', label: 'Fecha nacimiento', type: 'date' },
      { name: 'height_cm', label: 'Altura cm', type: 'number' },
      { name: 'weight_kg', label: 'Peso kg', type: 'number' },
      { name: 'status', label: 'Estado', type: 'select', options: ['ACTIVE', 'INACTIVE'] },
    ],
  },
  matches: {
    title: 'Mant. Partidos',
    subtitle: 'Mantenimiento de la tabla matches.',
    endpoint: 'matches',
    columns: ['id', 'home_team_name', 'away_team_name', 'match_date', 'match_time', 'venue', 'status', 'score'],
    fields: [
      { name: 'championship_id', label: 'Torneo', type: 'championship', required: true },
      { name: 'home_team_id', label: 'Equipo local', type: 'team', required: true },
      { name: 'away_team_id', label: 'Equipo visitante', type: 'team', required: true },
      { name: 'match_date', label: 'Fecha', type: 'date', required: true },
      { name: 'match_time', label: 'Hora', type: 'time' },
      { name: 'venue', label: 'Ubicación', type: 'text' },
      { name: 'status', label: 'Estado', type: 'select', options: ['SCHEDULED', 'FINISHED', 'IN_PROGRESS', 'SUSPENDED', 'CANCELLED'] },
      { name: 'home_score', label: 'Puntos local', type: 'number' },
      { name: 'away_score', label: 'Puntos visitante', type: 'number' },
    ],
  },
  match_periods: {
    title: 'Mant. Tiempos',
    subtitle: 'Mantenimiento de la tabla match_periods.',
    endpoint: 'match_periods',
    columns: ['id', 'match_id', 'period_number', 'home_score', 'away_score'],
    fields: [
      { name: 'match_id', label: 'Partido', type: 'match', required: true },
      { name: 'period_number', label: 'Tiempo / cuarto', type: 'number', required: true },
      { name: 'home_score', label: 'Puntos local', type: 'number' },
      { name: 'away_score', label: 'Puntos visitante', type: 'number' },
    ],
  },
  player_match_stats: {
    title: 'Mant. Estadísticas',
    subtitle: 'Mantenimiento de la tabla player_match_stats.',
    endpoint: 'player_match_stats',
    columns: ['id', 'match_id', 'player_name', 'team_name', 'points', 'fouls', 'points_triple', 'rebounds', 'assists'],
    fields: [
      { name: 'match_id', label: 'Partido', type: 'match', required: true },
      { name: 'player_id', label: 'Jugador', type: 'player', required: true },
      { name: 'team_id', label: 'Equipo', type: 'team', required: true },
      { name: 'points', label: 'PTS', type: 'number' },
      { name: 'fouls', label: 'Faltas', type: 'number' },
      { name: 'points_triple', label: 'PTS (3)', type: 'number' },
      { name: 'rebounds', label: 'REB', type: 'number' },
      { name: 'assists', label: 'AST', type: 'number' },
      { name: 'steals', label: 'ROB', type: 'number' },
      { name: 'blocks', label: 'BLK', type: 'number' },
      { name: 'turnovers', label: 'Pérdidas', type: 'number' },
      { name: 'minutes_played', label: 'Minutos', type: 'number' },
    ],
  },
};

let maintenanceState = {
  table: null,
  recordId: null,
  rows: [],
  teams: [],
  players: [],
  matches: [],
};

function maintenanceLabel(column) {
  const labels = {
    id: 'ID', name: 'Nombre', season: 'Temporada', category: 'Categoría', start_date: 'Inicio', end_date: 'Fin', status: 'Estado',
    coach_name: 'Delegado', logo_url: 'Logo', jersey_number: '#', first_name: 'Nombres', last_name: 'Apellidos', team_name: 'Equipo', position: 'Posición',
    home_team_name: 'Local', away_team_name: 'Visitante', match_date: 'Fecha', match_time: 'Hora', venue: 'Ubicación', score: 'Marcador',
    match_id: 'Partido', period_number: 'Tiempo', home_score: 'Local', away_score: 'Visitante', player_name: 'Jugador', points: 'PTS', fouls: 'Faltas', points_triple: 'PTS (3)', rebounds: 'REB', assists: 'AST'
  };
  return labels[column] || column;
}

function maintenanceDisplayValue(row, column) {
  if (column === 'team_name') return row.team_name || row.teams?.name || '-';
  if (column === 'player_name') return row.player_name || `${row.players?.first_name || ''} ${row.players?.last_name || ''}`.trim() || '-';
  if (column === 'home_team_name') return row.home_team?.name || '-';
  if (column === 'away_team_name') return row.away_team?.name || '-';
  if (column === 'score') return `${row.home_score ?? 0} - ${row.away_score ?? 0}`;
  if (column === 'logo_url' && row.logo_url) return `<span title="${escapeHtml(row.logo_url)}">URL</span>`;
  return row[column] ?? '-';
}

async function loadMaintenanceLookups() {
  const championshipId = getChampionshipId();
  const [teams, players, matches] = await Promise.all([
    api(`/api/maintenance/teams?championship_id=${championshipId}`),
    api(`/api/maintenance/players?championship_id=${championshipId}`),
    api(`/api/maintenance/matches?championship_id=${championshipId}`),
  ]);
  maintenanceState.teams = teams;
  maintenanceState.players = players;
  maintenanceState.matches = matches;
}

function maintenanceOptionList(type, currentValue) {
  if (type === 'championship') {
    return availableChampionships.map(champ => `<option value="${champ.id}" ${Number(currentValue || getChampionshipId()) === Number(champ.id) ? 'selected' : ''}>${escapeHtml(champ.name)}${champ.season ? ' · ' + escapeHtml(champ.season) : ''}</option>`).join('');
  }
  if (type === 'team') {
    return maintenanceState.teams.map(team => `<option value="${team.id}" ${Number(currentValue) === Number(team.id) ? 'selected' : ''}>${escapeHtml(team.name)}</option>`).join('');
  }
  if (type === 'player') {
    return maintenanceState.players.map(player => `<option value="${player.id}" ${Number(currentValue) === Number(player.id) ? 'selected' : ''}>#${escapeHtml(player.jersey_number || '-')} ${escapeHtml(player.first_name || '')} ${escapeHtml(player.last_name || '')}</option>`).join('');
  }
  if (type === 'match') {
    return maintenanceState.matches.map(match => `<option value="${match.id}" ${Number(currentValue) === Number(match.id) ? 'selected' : ''}>${escapeHtml(match.match_date || '')} ${escapeHtml(match.match_time || '')} · ${escapeHtml(match.home_team?.name || 'Local')} vs ${escapeHtml(match.away_team?.name || 'Visitante')}</option>`).join('');
  }
  return '';
}

function renderMaintenanceForm(record = {}) {
  const config = MAINTENANCE_TABLES[maintenanceState.table];
  const form = document.getElementById('maintenanceForm');
  if (!form || !config) return;

  const fields = config.fields.map(field => {
    let value = record[field.name];
    if (field.name === 'championship_id' && !value) value = getChampionshipId();
    const required = field.required ? 'required' : '';

    if (['select', 'championship', 'team', 'player', 'match'].includes(field.type)) {
      const options = field.type === 'select'
        ? (field.options || []).map(opt => `<option value="${escapeHtml(opt)}" ${String(value || '') === String(opt) ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')
        : maintenanceOptionList(field.type, value);
      return `<label>${escapeHtml(field.label)}<select name="${escapeHtml(field.name)}" ${required}><option value="">Seleccione...</option>${options}</select></label>`;
    }

    return `<label>${escapeHtml(field.label)}<input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || 'text')}" value="${escapeHtml(value ?? '')}" ${required} /></label>`;
  }).join('');

  form.innerHTML = `
    ${fields}
    <div class="maintenance-form-actions">
      <button class="primary-button" type="submit">${maintenanceState.recordId ? 'Guardar cambios' : 'Insertar registro'}</button>
      <button class="secondary-button" type="button" onclick="clearMaintenanceForm()">Limpiar</button>
    </div>
  `;
}

function renderMaintenanceTable() {
  const config = MAINTENANCE_TABLES[maintenanceState.table];
  const head = document.getElementById('maintenanceTableHead');
  const body = document.getElementById('maintenanceTableBody');
  if (!head || !body || !config) return;

  head.innerHTML = `<tr>${config.columns.map(c => `<th>${escapeHtml(maintenanceLabel(c))}</th>`).join('')}<th>Acciones</th></tr>`;
  body.innerHTML = maintenanceState.rows.map(row => `
    <tr>
      ${config.columns.map(c => `<td>${maintenanceDisplayValue(row, c)}</td>`).join('')}
      <td>
        <button class="edit-button" type="button" onclick="editMaintenanceRecord(${Number(row.id)})">Editar</button>
        <button class="danger-button" type="button" onclick="deleteMaintenanceRecord(${Number(row.id)})">Eliminar</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="${config.columns.length + 1}">No hay registros disponibles.</td></tr>`;
}

async function loadMaintenanceRows() {
  const config = MAINTENANCE_TABLES[maintenanceState.table];
  if (!config) return;
  const championshipId = getChampionshipId();
  maintenanceState.rows = await api(`/api/maintenance/${config.endpoint}?championship_id=${championshipId}`);
  renderMaintenanceTable();
}

async function openMaintenanceModal(table) {
  if (!isLoggedIn()) return openLoginModal();
  const config = MAINTENANCE_TABLES[table];
  if (!config) return;

  maintenanceState.table = table;
  maintenanceState.recordId = null;
  maintenanceState.rows = [];

  document.querySelectorAll('.maintenance-menu-link').forEach(btn => btn.classList.toggle('active', btn.dataset.maintTable === table));
  const modal = document.getElementById('maintenanceModal');
  const title = document.getElementById('maintenanceTitle');
  const subtitle = document.getElementById('maintenanceSubtitle');
  const error = document.getElementById('maintenanceError');
  if (title) title.textContent = config.title;
  if (subtitle) subtitle.textContent = config.subtitle;
  if (error) error.textContent = '';
  modal?.classList.add('modal-open');
  modal?.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-is-open');

  await loadMaintenanceLookups();
  renderMaintenanceForm({ championship_id: getChampionshipId() });
  await loadMaintenanceRows();
}

function closeMaintenanceModal() {
  const modal = document.getElementById('maintenanceModal');
  modal?.classList.remove('modal-open');
  modal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-is-open');
  document.querySelectorAll('.maintenance-menu-link').forEach(btn => btn.classList.remove('active'));
}

function clearMaintenanceForm() {
  maintenanceState.recordId = null;
  renderMaintenanceForm({ championship_id: getChampionshipId() });
}

function editMaintenanceRecord(id) {
  const record = maintenanceState.rows.find(row => Number(row.id) === Number(id));
  if (!record) return;
  maintenanceState.recordId = Number(id);
  renderMaintenanceForm(record);
  document.getElementById('maintenanceForm')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function deleteMaintenanceRecord(id) {
  const config = MAINTENANCE_TABLES[maintenanceState.table];
  if (!config || !confirm('¿Seguro que deseas eliminar este registro?')) return;
  const error = document.getElementById('maintenanceError');
  if (error) error.textContent = '';
  try {
    await api(`/api/maintenance/${config.endpoint}/${id}`, { method: 'DELETE' });
    clearMaintenanceForm();
    await loadMaintenanceRows();
    await loadAll();
  } catch (err) {
    if (error) error.textContent = err.message;
  }
}

function parseMaintenanceValue(field, value) {
  if (value === '') return null;
  if (field.type === 'number' || ['championship_id', 'team_id', 'home_team_id', 'away_team_id', 'winner_team_id', 'match_id', 'player_id', 'period_number'].includes(field.name)) {
    return Number(value);
  }
  return value;
}

function setupMaintenanceMenu() {
  ensureMaintenanceMenuGroup();
  document.querySelectorAll('.maintenance-menu-link').forEach((button) => {
    if (button.dataset.maintenanceBound === '1') return;
    button.dataset.maintenanceBound = '1';
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      document.body.classList.remove('menu-open', 'side-menu-open');
      await openMaintenanceModal(button.dataset.maintTable);
    });
  });

  document.querySelectorAll('[data-close-maintenance]').forEach((el) => el.addEventListener('click', closeMaintenanceModal));
  document.getElementById('maintenanceNewBtn')?.addEventListener('click', clearMaintenanceForm);
  document.getElementById('maintenanceRefreshBtn')?.addEventListener('click', async () => {
    await loadMaintenanceLookups();
    await loadMaintenanceRows();
  });

  document.getElementById('maintenanceForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const config = MAINTENANCE_TABLES[maintenanceState.table];
    if (!config) return;
    const error = document.getElementById('maintenanceError');
    if (error) error.textContent = '';

    const formData = new FormData(event.currentTarget);
    const payload = {};
    config.fields.forEach(field => {
      payload[field.name] = parseMaintenanceValue(field, formData.get(field.name));
    });

    try {
      const method = maintenanceState.recordId ? 'PUT' : 'POST';
      const url = maintenanceState.recordId
        ? `/api/maintenance/${config.endpoint}/${maintenanceState.recordId}`
        : `/api/maintenance/${config.endpoint}`;
      await api(url, { method, body: JSON.stringify(payload) });
      clearMaintenanceForm();
      await loadMaintenanceRows();
      await loadAll();
    } catch (err) {
      if (error) error.textContent = err.message;
    }
  });
}

