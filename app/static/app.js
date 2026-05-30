const CHAMPIONSHIP_ID = 1;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error consultando API');
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
  return `<div class="team-logo" aria-label="Logo ${name}">${team?.logo_url ? `<img src="${escapeHtml(team.logo_url)}" alt="${name}">` : '🏀'}</div>`;
}

function openMenu() {
  document.body.classList.add('menu-open');
  document.getElementById('menuToggle')?.setAttribute('aria-expanded', 'true');
  document.getElementById('menuOverlay')?.setAttribute('aria-hidden', 'false');
}

function closeMenu() {
  document.body.classList.remove('menu-open');
  document.getElementById('menuToggle')?.setAttribute('aria-expanded', 'false');
  document.getElementById('menuOverlay')?.setAttribute('aria-hidden', 'true');
}

function expandSection(section) {
  if (!section || !section.classList.contains('section-collapsed')) return;
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
  if (!target) return;

  expandSection(target);
  closeMenu();

  window.setTimeout(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
    document.querySelectorAll('.main-nav a').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
    });
  }, 150);
}

function setupMenu() {
  document.getElementById('menuToggle')?.addEventListener('click', (event) => {
    event.preventDefault();
    document.body.classList.contains('menu-open') ? closeMenu() : openMenu();
  });

  document.getElementById('closeMenu')?.addEventListener('click', (event) => {
    event.preventDefault();
    closeMenu();
  });

  document.getElementById('menuOverlay')?.addEventListener('click', closeMenu);

  document.querySelectorAll('.main-nav a[href^="#"]').forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = link.getAttribute('href');
      navigateToSection(targetId);
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
  document.querySelectorAll('.section-collapsible').forEach(section => {
    const button = section.querySelector('.section-toggle');
    const icon = button?.querySelector('.toggle-icon');
    if (!button || !icon) return;

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
  content.innerHTML = '<p>Cargando detalle del partido...</p>';

  try {
    const match = await api(`/api/matches/${matchId}`);
    const homeName = escapeHtml(match.home_team?.name || 'Local');
    const awayName = escapeHtml(match.away_team?.name || 'Visitante');
    const periods = Array.isArray(match.periods) ? match.periods : [];
    const playerStats = Array.isArray(match.player_stats) ? match.player_stats : [];

    const periodsHtml = periods.length
      ? `<div class="period-grid">${periods.map(period => `<div class="period-row"><strong>${periodLabel(period.period_number)}</strong><span>${period.home_score ?? 0}</span><span>${period.away_score ?? 0}</span></div>`).join('')}</div>`
      : '<p>Aún no hay resultados por tiempo registrados.</p>';

    const statsHtml = playerStats.length
      ? `<div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Equipo</th><th>PTS</th><th>REB</th><th>AST</th><th>FALTAS</th></tr></thead><tbody>${playerStats.map(row => {
          const player = row.players || {};
          const team = row.teams || {};
          return `<tr><td>#${escapeHtml(player.jersey_number || '-')} ${escapeHtml(player.first_name || '')} ${escapeHtml(player.last_name || '')}</td><td>${escapeHtml(team.name || '-')}</td><td>${row.points ?? 0}</td><td>${row.rebounds ?? 0}</td><td>${row.assists ?? 0}</td><td>${row.fouls ?? 0}</td></tr>`;
        }).join('')}</tbody></table></div>`
      : '<p>Aún no hay estadísticas individuales registradas.</p>';

    content.innerHTML = `
      <span class="badge">${escapeHtml(match.status || '')}</span>
      <h2>${homeName} vs ${awayName}</h2>
      <p>${escapeHtml(match.match_date || '')} ${escapeHtml(match.match_time || '')} · ${escapeHtml(match.venue || '')}</p>
      <div class="modal-scoreboard">
        <div class="score-box">${homeName}<strong>${match.home_score ?? 0}</strong></div>
        <div class="score">VS</div>
        <div class="score-box">${awayName}<strong>${match.away_score ?? 0}</strong></div>
      </div>
      <h3>Resultados por tiempo</h3>
      ${periodsHtml}
      <h3>Estadísticas de jugadores</h3>
      ${statsHtml}
    `;
  } catch (error) {
    content.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

function setupMatchDetailModal() {
  document.querySelectorAll('[data-close-match-detail]').forEach(el => el.addEventListener('click', closeMatchDetail));
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
      <article class="card team-card">${teamLogo(team)}<h3>${escapeHtml(team.name)}</h3><p>Head coach: ${escapeHtml(team.coach_name || 'No registrado')}</p><span class="badge">${escapeHtml(team.status || 'ACTIVE')}</span></article>
    `).join('') || '<p>No hay equipos registrados.</p>';
  } catch (error) { showError('teamsContainer', error); }
}

async function loadPlayers() {
  try {
    const players = await api(`/api/players?championship_id=${CHAMPIONSHIP_ID}`);
    document.getElementById('playersTable').innerHTML = players.map(p => `<tr><td>#${p.jersey_number}</td><td>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</td><td>${escapeHtml(p.teams?.name || '-')}</td><td>${escapeHtml(p.position || '-')}</td></tr>`).join('') || '<tr><td colspan="4">No hay jugadores registrados.</td></tr>';
  } catch (error) { showError('playersTable', error); }
}

async function loadMatches() {
  try {
    const matches = await api(`/api/matches?championship_id=${CHAMPIONSHIP_ID}`);
    document.getElementById('matchesContainer').innerHTML = matches.map(m => `
      <article class="match-card">
        <div><div class="team">${escapeHtml(m.home_team?.name || 'Local')}</div><p>${escapeHtml(m.match_date || '')} ${escapeHtml(m.match_time || '')}<br>${escapeHtml(m.venue || '')}</p></div>
        <div><div class="score">${m.home_score ?? 0} - ${m.away_score ?? 0}</div><span class="badge">${escapeHtml(m.status || '')}</span></div>
        <div><div class="team">${escapeHtml(m.away_team?.name || 'Visitante')}</div><button class="detail-btn" type="button" onclick="openMatchDetail(${Number(m.id)})">Ver detalle</button></div>
      </article>
    `).join('') || '<p>No hay partidos registrados.</p>';
  } catch (error) { showError('matchesContainer', error); }
}

async function loadStandings() {
  try {
    const standings = await api(`/api/standings?championship_id=${CHAMPIONSHIP_ID}`);
    document.getElementById('standingsTable').innerHTML = standings.map((s, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(s.team_name)}</td><td>${s.played}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.points_for}</td><td>${s.points_against}</td><td>${s.point_difference}</td><td><strong>${s.championship_points}</strong></td></tr>`).join('') || '<tr><td colspan="9">No hay tabla disponible.</td></tr>';
  } catch (error) { showError('standingsTable', error); }
}

async function loadStats() {
  try {
    const stats = await api('/api/stats/players');
    document.getElementById('statsTable').innerHTML = stats.map(s => `<tr><td>#${s.jersey_number || '-'} ${escapeHtml(s.player_name)}</td><td>${escapeHtml(s.team_name || '-')}</td><td>${s.points}</td><td>${s.rebounds}</td><td>${s.assists}</td><td>${s.steals}</td><td>${s.blocks}</td><td>${s.fouls}</td></tr>`).join('') || '<tr><td colspan="8">No hay estadísticas registradas.</td></tr>';
  } catch (error) { showError('statsTable', error); }
}

async function loadAll() {
  await Promise.all([loadSummary(), loadTeams(), loadPlayers(), loadMatches(), loadStandings(), loadStats()]);
}

setupMenu();
setupSectionToggles();
setupMatchDetailModal();
loadAll();
