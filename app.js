const grid = document.querySelector('#workGrid');
const statusLine = document.querySelector('#status');
const dialog = document.querySelector('#workDialog');
const dialogMeta = document.querySelector('#dialogMeta');
const dialogContent = document.querySelector('#dialogContent');
const publicationChart = document.querySelector('#publicationChart');
let works = [];
let forthcomingWorks = [];
const pageState = { main: 1, collaborative: 1 };
const pageSizeState = { main: 10, collaborative: 10 };
const sortState = { main: 'curated', collaborative: 'curated', ongoing: 'curated' };
const expandedState = { main: true, collaborative: false, ongoing: false };
let alignmentFrame;
document.querySelector('#year').textContent = new Date().getFullYear();

function clean(value = '') { return value.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim(); }
function field(body, name) { const match = body.match(new RegExp(`\\b${name}\\s*=\\s*[{\"]([\\s\\S]*?)[}\"]\\s*(?:,|$)`, 'i')); return match ? clean(match[1]) : ''; }
function parseBibtex(text) {
  const entries = []; const starts = [...text.matchAll(/@(article|online|inproceedings|patent)\s*\{\s*([^,]+)/gi)];
  starts.forEach((start, index) => { const body = text.slice(start.index, starts[index + 1]?.index || text.length); entries.push({ key: start[2].trim(), entryType: start[1].toLowerCase(), title: field(body, 'title'), authors: field(body, 'author'), venue: field(body, 'journaltitle'), year: field(body, 'year') || field(body, 'date').slice(0, 4), volume: field(body, 'volume'), number: field(body, 'number'), pages: field(body, 'pages'), doi: field(body, 'doi'), keywords: field(body, 'keywords'), sortkey: field(body, 'sortkey') }); });
  return entries.filter(entry => entry.entryType !== 'patent');
}
function parseForthcomingBibtex(text) {
  const source = text.replace(/^%.*$/gm, '');
  const starts = [...source.matchAll(/@([a-z]+)\s*\{\s*([^,]+)/gi)];
  return starts.map((start, index) => {
    const body = source.slice(start.index, starts[index + 1]?.index || source.length);
    return { key: start[2].trim(), title: field(body, 'title'), journal: field(body, 'plannedjournal') || field(body, 'journaltitle'), status: field(body, 'status'), summary: field(body, 'summary') || field(body, 'abstract'), year: field(body, 'year') };
  }).filter(work => work.title);
}
function role(work) { return work.keywords.includes('mainwork') ? 'Lead work' : work.entryType === 'inproceedings' ? 'Conference abstract' : work.entryType === 'online' ? 'Preprint' : 'Collaborative work'; }
function escapeHtml(value) { const element = document.createElement('div'); element.textContent = value; return element.innerHTML; }
function displayName(name) { const cleaned = clean(name); if (/^others$/i.test(cleaned)) return 'et al.'; const parts = cleaned.split(',').map(item => item.trim()); return parts.length > 1 ? [...parts.slice(1), parts[0]].join(' ') : cleaned; }
function formattedAuthors(work) { return work.authors.split(/\s+and\s+/i).map(name => { const displayed = displayName(name); const mark = work.keywords.includes('corresponding') ? '*' : ''; return /^Shengda Zhao$/i.test(displayed) ? `<strong>Shengda Zhao${mark}</strong>` : escapeHtml(displayed); }).join(', '); }
function authorRole(work) {
  const position = work.authors.split(/\s+and\s+/i).map(displayName).findIndex(name => /^Shengda Zhao$/i.test(name)) + 1;
  const labels = ['First author', 'Second author', 'Third author'];
  const suffix = position % 100 >= 11 && position % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[position % 10] || 'th');
  const authorLabel = position ? (labels[position - 1] || `${position}${suffix} author`) : 'Contributor';
  return [authorLabel, work.keywords.includes('corresponding') ? 'Co-corresponding author' : ''].filter(Boolean).join(' · ');
}
function citationLine(work) { const pieces = [work.venue]; if (work.volume) pieces.push(work.volume + (work.number ? `(${work.number})` : '')); if (work.pages) pieces.push(work.pages); return pieces.filter(Boolean).join(', ') || (work.entryType === 'online' ? 'arXiv preprint' : 'Publication details pending'); }
function fixedCitationOrder(a, b) { return (+b.year || 0) - (+a.year || 0) || b.title.charAt(0).localeCompare(a.title.charAt(0)) || b.title.localeCompare(a.title); }
function assignCitationIds() { ['mainwork', 'collaborative'].forEach((group, index) => { works.filter(work => group === 'mainwork' ? work.keywords.includes('mainwork') : !work.keywords.includes('mainwork')).sort(fixedCitationOrder).forEach((work, number) => { work.citationId = `${index === 0 ? 'M' : 'C'}${number + 1}`; work.citationRank = number + 1; }); }); }
function orderedWorks(items = works, group = 'main') { const option = sortState[group] || 'curated'; return [...items].sort((a, b) => { if (option === 'newest') return (+b.year || 0) - (+a.year || 0) || fixedCitationOrder(a, b); if (option === 'oldest') return (+a.year || 0) - (+b.year || 0) || fixedCitationOrder(a, b); return (a.citationRank || 0) - (b.citationRank || 0); }); }
function cardMarkup(work) { return `<button id="work-${escapeHtml(work.key)}" class="card" type="button" data-key="${escapeHtml(work.key)}" aria-label="View details: ${escapeHtml(work.title)}"><span class="card-meta"><span class="card-meta-left"><span class="work-id" aria-label="CV reference ${work.citationId}">${work.citationId}</span><span class="type">${role(work)}</span></span><span class="year">${escapeHtml(work.year)}</span></span><h3>${escapeHtml(work.title)}</h3><p class="venue">${escapeHtml(citationLine(work))}</p><p class="authors">${formattedAuthors(work)}</p><p class="author-role">${authorRole(work)}</p></button>`; }
function pageSizeOptions(group) { const selected = pageSizeState[group]; return [10, 20, 'all'].map(size => `<option value="${size}"${selected === size || selected === Number(size) ? ' selected' : ''}>${size === 'all' ? 'All' : size}</option>`).join(''); }
function sortOptions(group) { const selected = sortState[group]; return [['curated', 'Default'], ['newest', 'Newest first'], ['oldest', 'Oldest first']].map(([value, label]) => `<option value="${value}"${selected === value ? ' selected' : ''}>${label}</option>`).join(''); }
function groupToolbar(group, title, total, expanded, paginated = false) { const pageSize = paginated && expanded && total > 10 ? `<label class="page-size-control">Per page<select data-page-size="${group}" aria-label="Works per page for ${title}">${pageSizeOptions(group)}</select></label>` : ''; return `<div class="group-actions"><label class="group-sort-control">Order<select data-group-sort="${group}" aria-label="Sort ${title}">${sortOptions(group)}</select></label>${pageSize}<button type="button" class="group-toggle" data-toggle-group="${group}" aria-expanded="${expanded}">${expanded ? 'Hide' : `Show ${total} works`}</button></div>`; }
function paginationMarkup(group, total) {
  const size = pageSizeState[group];
  const pages = size === 'all' ? 1 : Math.max(1, Math.ceil(total / size));
  const page = Math.min(pageState[group], pages);
  if (pages === 1) return `<span class="page-summary">Showing ${total} of ${total}</span>`;
  return `<span class="page-summary">Page ${page} of ${pages}</span><div class="page-buttons"><button type="button" class="page-button" data-page-group="${group}" data-page-direction="previous"${page === 1 ? ' disabled' : ''}>Previous</button><button type="button" class="page-button" data-page-group="${group}" data-page-direction="next"${page === pages ? ' disabled' : ''}>Next</button></div>`;
}
function groupMarkup(group, title, description) {
  const expanded = expandedState[group];
  const allItems = orderedWorks(works.filter(work => group === 'main' ? work.keywords.includes('mainwork') : !work.keywords.includes('mainwork')), group);
  const total = allItems.length;
  const size = pageSizeState[group];
  const pages = size === 'all' ? 1 : Math.max(1, Math.ceil(total / size));
  pageState[group] = Math.min(pageState[group], pages);
  const visibleItems = expanded ? (size === 'all' ? allItems : allItems.slice((pageState[group] - 1) * size, pageState[group] * size)) : [];
  const pagination = expanded ? `<div class="pagination" aria-label="${title} pagination">${paginationMarkup(group, total)}</div>` : '';
  return `<section class="work-group work-group-${group}" aria-labelledby="${group}-works-title"><div class="work-group-header"><div><h3 id="${group}-works-title">${title}</h3><p>${description} · ${total} works</p></div>${groupToolbar(group, title, total, expanded, true)}</div>${expanded ? `<div class="work-grid">${visibleItems.map(cardMarkup).join('')}</div>${pagination}` : ''}</section>`;
}
function renderPublicationChart() {
  const yearlyCounts = new Map();
  works.forEach(work => { if (work.year) yearlyCounts.set(work.year, (yearlyCounts.get(work.year) || 0) + 1); });
  const years = [...yearlyCounts.keys()].sort((a, b) => +a - +b);
  const maximum = Math.max(...yearlyCounts.values(), 1);
  const bars = years.map(year => { const count = yearlyCounts.get(year); const height = Math.max(8, Math.round((count / maximum) * 28)); return `<div class="year-bar"><span>${count}</span><i style="--bar-height:${height}px"></i><small>${escapeHtml(year)}</small></div>`; }).join('');
  publicationChart.innerHTML = `<p class="chart-caption">Works / year</p><div class="year-chart" role="img" aria-label="Publication counts by year: ${years.map(year => `${year}: ${yearlyCounts.get(year)}`).join(', ')}">${bars}</div>`;
}
function forthcomingGroupMarkup() {
  if (!forthcomingWorks.length) return '';
  const referenceOrder = [...forthcomingWorks].sort((a, b) => (+b.year || 0) - (+a.year || 0) || b.title.localeCompare(a.title));
  referenceOrder.forEach((work, index) => { work.citationId = `U${index + 1}`; work.citationRank = index + 1; });
  const items = orderedWorks(referenceOrder, 'ongoing');
  const expanded = expandedState.ongoing;
  const total = items.length;
  return `<section class="work-group work-group-ongoing" aria-labelledby="ongoing-works-title"><div class="work-group-header"><div><h3 id="ongoing-works-title">Works in progress</h3><p>Manuscripts under review and ongoing research · ${total} work${total === 1 ? '' : 's'}</p></div>${groupToolbar('ongoing', 'Works in progress', total, expanded)}</div>${expanded ? `<div class="forthcoming-grid">${items.map(work => `<button id="forthcoming-${escapeHtml(work.key)}" class="forthcoming-card" type="button" data-forthcoming-key="${escapeHtml(work.key)}" aria-label="View details: ${escapeHtml(work.title)}"><span class="forthcoming-card-head"><span class="work-id" aria-label="Work in progress reference ${work.citationId}">${work.citationId}</span><span class="forthcoming-status">${escapeHtml(work.status || 'In preparation')}</span></span><h3>${escapeHtml(work.title)}</h3><p class="forthcoming-journal">${escapeHtml(work.journal || 'Planned venue to be confirmed')}</p><p>${escapeHtml(work.summary || 'Research summary to be added.')}</p></button>`).join('')}</div>` : ''}</section>`;
}
function render() {
  const items = works;
  grid.innerHTML = `${groupMarkup('main', 'Lead works', 'First-author and corresponding-author contributions')}${groupMarkup('collaborative', 'Collaborative works', 'Collaborative publications')}${forthcomingGroupMarkup()}`;
  renderPublicationChart();
  decorateForthcomingLinks();
  const firstAuthorWorks = works.filter(work => /^Shengda Zhao$/i.test(displayName(work.authors.split(/\s+and\s+/i)[0]))).length;
  const correspondingWorks = works.filter(work => work.keywords.includes('corresponding')).length;
  const collaborativeWorks = works.filter(work => !work.keywords.includes('mainwork')).length;
  statusLine.textContent = `${items.length} research works · ${firstAuthorWorks} first-author works · ${correspondingWorks} co-corresponding work · ${collaborativeWorks} collaborative works`;
  scheduleCardAlignment();
}
function alignCardRows(gridSelector, cardSelector, rows) {
  document.querySelectorAll(gridSelector).forEach(gridElement => {
    const cards = [...gridElement.querySelectorAll(cardSelector)];
    cards.forEach(card => rows.forEach(([, variable]) => card.style.removeProperty(variable)));
    if (window.matchMedia('(max-width: 720px)').matches) return;
    for (let index = 0; index < cards.length; index += 2) {
      const pair = cards.slice(index, index + 2);
      rows.forEach(([selector, variable]) => {
        const height = Math.max(...pair.map(card => card.querySelector(selector)?.getBoundingClientRect().height || 0));
        pair.forEach(card => card.style.setProperty(variable, `${Math.ceil(height)}px`));
      });
    }
  });
}
function scheduleCardAlignment() {
  cancelAnimationFrame(alignmentFrame);
  alignmentFrame = requestAnimationFrame(() => {
    alignCardRows('.work-grid', '.card', [['h3', '--card-title-height'], ['.venue', '--card-venue-height'], ['.authors', '--card-authors-height']]);
    alignCardRows('.forthcoming-grid', '.forthcoming-card', [['h3', '--forthcoming-title-height'], ['.forthcoming-journal', '--forthcoming-venue-height']]);
  });
}
function openDetail(key) {
  const work = works.find(item => item.key === key); if (!work) return; const note = (window.WORK_NOTES || {})[key] || {}; const doi = work.doi ? `<a class="detail-link" href="https://doi.org/${escapeHtml(work.doi)}" target="_blank" rel="noreferrer">Open publication ↗</a>` : '';
  dialogMeta.innerHTML = `<div class="dialog-header"><span class="work-id" aria-label="CV reference ${work.citationId}">${work.citationId}</span><span class="type dialog-type">${role(work)}</span></div>`;
  dialogContent.innerHTML = `<h3 id="dialogTitle">${escapeHtml(work.title)}</h3><p class="venue">${escapeHtml(citationLine(work))} · ${escapeHtml(work.year)}</p><p class="authors">${formattedAuthors(work)} <span class="author-role-inline">(${authorRole(work)})</span></p><div class="detail-block"><h4>About this work</h4><p>${escapeHtml(note.summary || 'Bibliographic record imported automatically from publications.bib.')}</p></div><div class="detail-block"><h4>My contribution</h4><p>${escapeHtml(note.contribution || 'Add a short contribution statement in data/work-notes.js for this record.')}</p></div>${doi}`;
  dialog.showModal();
}
function openForthcomingDetail(key) {
  const work = forthcomingWorks.find(item => item.key === key); if (!work) return;
  dialogMeta.innerHTML = `<div class="dialog-header"><span class="work-id" aria-label="Work in progress reference ${work.citationId}">${work.citationId}</span><span class="type dialog-type">Work in progress</span></div>`;
  dialogContent.innerHTML = `<h3 id="dialogTitle">${escapeHtml(work.title)}</h3><p class="venue">${escapeHtml(work.journal || 'Planned venue to be confirmed')}</p><p class="authors"><span class="author-role-inline">${escapeHtml(work.status || 'In preparation')}</span></p><div class="detail-block"><h4>About this work</h4><p>${escapeHtml(work.summary || 'Research summary to be added.')}</p></div>`;
  dialog.showModal();
}
function decorateResearchLinks() { document.querySelectorAll('.theme-citations a[href^="#work-"]').forEach(link => { const key = link.getAttribute('href').replace('#work-', ''); const work = works.find(item => item.key === key); if (work) link.textContent = `[${work.citationId}]`; }); }
function decorateForthcomingLinks() { document.querySelectorAll('.theme-citations a[href^="#forthcoming-"]').forEach(link => { const key = link.getAttribute('href').replace('#forthcoming-', ''); const work = forthcomingWorks.find(item => item.key === key); if (work) link.textContent = `[${work.citationId}]`; }); }
fetch('data/publications.bib').then(response => { if (!response.ok) throw new Error('not found'); return response.text(); }).then(text => { works = parseBibtex(text); assignCitationIds(); render(); decorateResearchLinks(); }).catch(() => { statusLine.textContent = 'Publication data could not be loaded. Please confirm data/publications.bib is present.'; grid.innerHTML = '<p class="empty">No BibTeX data available.</p>'; });
fetch('data/forthcoming.bib').then(response => response.ok ? response.text() : '').then(text => { forthcomingWorks = parseForthcomingBibtex(text); render(); }).catch(() => { forthcomingWorks = []; render(); });
document.addEventListener('change', event => { const group = event.target.dataset.pageSize; if (group) { pageSizeState[group] = event.target.value === 'all' ? 'all' : Number(event.target.value); pageState[group] = 1; render(); return; } const sortGroup = event.target.dataset.groupSort; if (sortGroup) { sortState[sortGroup] = event.target.value; pageState[sortGroup] = 1; render(); } });
document.addEventListener('click', event => {
  const toggle = event.target.closest('[data-toggle-group]');
  if (toggle) { const group = toggle.dataset.toggleGroup; expandedState[group] = !expandedState[group]; render(); return; }
  const pageButton = event.target.closest('[data-page-group]');
  if (!pageButton) return;
  const group = pageButton.dataset.pageGroup;
  const direction = pageButton.dataset.pageDirection;
  const total = works.filter(work => group === 'main' ? work.keywords.includes('mainwork') : !work.keywords.includes('mainwork')).length;
  const pages = pageSizeState[group] === 'all' ? 1 : Math.ceil(total / pageSizeState[group]);
  pageState[group] = Math.max(1, Math.min(pages, pageState[group] + (direction === 'next' ? 1 : -1)));
  render();
});
grid.addEventListener('click', event => { const card = event.target.closest('[data-key]'); if (card) { openDetail(card.dataset.key); return; } const forthcomingCard = event.target.closest('[data-forthcoming-key]'); if (forthcomingCard) openForthcomingDetail(forthcomingCard.dataset.forthcomingKey); });
document.addEventListener('click', event => { const link = event.target.closest('.theme-citations a[href^="#work-"], .theme-citations a[href^="#forthcoming-"]'); if (!link) return; const href = link.getAttribute('href'); event.preventDefault(); history.replaceState(null, '', href); if (href.startsWith('#work-')) openDetail(href.replace('#work-', '')); else openForthcomingDetail(href.replace('#forthcoming-', '')); });
document.querySelector('#closeDialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
window.addEventListener('resize', scheduleCardAlignment);
