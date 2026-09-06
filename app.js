const grid = document.querySelector('#workGrid');
const statusLine = document.querySelector('#status');
const sortControl = document.querySelector('#sortWorks');
const dialog = document.querySelector('#workDialog');
const dialogContent = document.querySelector('#dialogContent');
let works = [];
document.querySelector('#year').textContent = new Date().getFullYear();

function clean(value = '') { return value.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim(); }
function field(body, name) { const match = body.match(new RegExp(`\\b${name}\\s*=\\s*[{\"]([\\s\\S]*?)[}\"]\\s*(?:,|$)`, 'i')); return match ? clean(match[1]) : ''; }
function parseBibtex(text) {
  const entries = []; const starts = [...text.matchAll(/@(article|online|inproceedings|patent)\s*\{\s*([^,]+)/gi)];
  starts.forEach((start, index) => { const body = text.slice(start.index, starts[index + 1]?.index || text.length); entries.push({ key: start[2].trim(), entryType: start[1].toLowerCase(), title: field(body, 'title'), authors: field(body, 'author'), venue: field(body, 'journaltitle'), year: field(body, 'year') || field(body, 'date').slice(0, 4), volume: field(body, 'volume'), number: field(body, 'number'), pages: field(body, 'pages'), doi: field(body, 'doi'), keywords: field(body, 'keywords'), sortkey: field(body, 'sortkey') }); });
  return entries.filter(entry => entry.entryType !== 'patent');
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
function orderedWorks() { const option = sortControl.value; return [...works].sort((a, b) => { if (option === 'newest') return (+b.year || 0) - (+a.year || 0); if (option === 'oldest') return (+a.year || 0) - (+b.year || 0); if (option === 'role') return +(b.keywords.includes('mainwork')) - +(a.keywords.includes('mainwork')) || (+b.year || 0) - (+a.year || 0); return (a.citationId[0] === b.citationId[0] ? 0 : a.citationId[0] === 'M' ? -1 : 1) || a.citationRank - b.citationRank; }); }
function render() {
  const items = orderedWorks();
  grid.innerHTML = items.map(work => `<button id="work-${escapeHtml(work.key)}" class="card" type="button" data-key="${escapeHtml(work.key)}" aria-label="View details: ${escapeHtml(work.title)}"><span class="card-meta"><span class="card-meta-left"><span class="work-id" aria-label="CV reference ${work.citationId}">${work.citationId}</span><span class="type">${role(work)}</span></span><span class="year">${escapeHtml(work.year)}</span></span><h3>${escapeHtml(work.title)}</h3><p class="venue">${escapeHtml(citationLine(work))}</p><p class="authors">${formattedAuthors(work)}</p><p class="author-role">${authorRole(work)}</p></button>`).join('');
  const firstAuthorWorks = works.filter(work => /^Shengda Zhao$/i.test(displayName(work.authors.split(/\s+and\s+/i)[0]))).length;
  const correspondingWorks = works.filter(work => work.keywords.includes('corresponding')).length;
  const collaborativeWorks = works.filter(work => !work.keywords.includes('mainwork')).length;
  statusLine.textContent = `${items.length} research works · ${firstAuthorWorks} first-author works · ${correspondingWorks} co-corresponding work · ${collaborativeWorks} collaborative works`;
}
function openDetail(key) {
  const work = works.find(item => item.key === key); if (!work) return; const note = (window.WORK_NOTES || {})[key] || {}; const doi = work.doi ? `<a class="detail-link" href="https://doi.org/${escapeHtml(work.doi)}" target="_blank" rel="noreferrer">Open publication ↗</a>` : '';
  dialogContent.innerHTML = `<div class="dialog-header"><span class="work-id" aria-label="CV reference ${work.citationId}">${work.citationId}</span><span class="type dialog-type">${role(work)}</span></div><h3 id="dialogTitle">${escapeHtml(work.title)}</h3><p class="venue">${escapeHtml(citationLine(work))} · ${escapeHtml(work.year)}</p><p class="authors">${formattedAuthors(work)} <span class="author-role-inline">(${authorRole(work)})</span></p><div class="detail-block"><h4>About this work</h4><p>${escapeHtml(note.summary || 'Bibliographic record imported automatically from publications.bib.')}</p></div><div class="detail-block"><h4>My contribution</h4><p>${escapeHtml(note.contribution || 'Add a short contribution statement in data/work-notes.js for this record.')}</p></div>${doi}`;
  dialog.showModal();
}
function decorateResearchLinks() { document.querySelectorAll('.theme-citations a[href^="#work-"]').forEach(link => { const key = link.getAttribute('href').replace('#work-', ''); const work = works.find(item => item.key === key); if (work) link.textContent = `[${work.citationId}]`; }); }
fetch('data/publications.bib').then(response => { if (!response.ok) throw new Error('not found'); return response.text(); }).then(text => { works = parseBibtex(text); assignCitationIds(); render(); decorateResearchLinks(); }).catch(() => { statusLine.textContent = 'Publication data could not be loaded. Please confirm data/publications.bib is present.'; grid.innerHTML = '<p class="empty">No BibTeX data available.</p>'; });
sortControl.addEventListener('change', render);
grid.addEventListener('click', event => { const card = event.target.closest('[data-key]'); if (card) openDetail(card.dataset.key); });
document.addEventListener('click', event => { const link = event.target.closest('.theme-citations a[href^="#work-"]'); if (!link) return; const key = link.getAttribute('href').replace('#work-', ''); event.preventDefault(); history.replaceState(null, '', link.getAttribute('href')); openDetail(key); });
document.querySelector('#closeDialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
