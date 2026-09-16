import { PdfPreview } from './pdf-preview.js';
import { appearance, normalizeOrder, moveSection, starterSummaries } from './preferences.js';
import { parseProfile, defaultSelection, matchJob, SECTION_ORDER, ENTRY_SECTIONS, LABELS, resumeMarkdown, profileTags, selectByTags, selectedContact } from './profile.js';

const $ = s => document.querySelector(s);
const pdfPreview = new PdfPreview({ container: $('#pdf-pages'), status: $('#pdf-preview-status'), downloadButton: $('#export-pdf') });
const STORAGE_KEY = 'folio-workspace-v1';
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state, profile, selected, toastTimer, draftTimer;
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.remove('hidden'); toastTimer = setTimeout(() => $('#toast').classList.add('hidden'), 4500); }
function persist() {
  state.selected = [...selected];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); $('#save-status').textContent = 'Saved on this device'; }
  catch { $('#save-status').textContent = 'Not saved — browser storage unavailable'; toast('Browser storage is full or unavailable. Download your Markdown to keep a copy.'); }
}
function currentSnapshot() { return { markdown: state.markdown, selected: [...selected], title: state.title, summary: state.summary, job: state.job, paper: state.paper, ...appearance(state) }; }
function switchView(view) {
  for (const name of ['builder', 'source', 'versions']) $(`#${name}-view`).classList.toggle('hidden', name !== view);
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('#breadcrumb').textContent = { builder: 'Resume builder', source: 'Master profile', versions: 'Saved resumes' }[view];
  if (view === 'versions') renderVersions();
}
function syncFields() {
  $('#job-title').value = state.title; $('#job-description').value = state.job;
  $('#markdown-editor').value = state.draft ?? state.markdown;
  $('#source-state').textContent = state.draft !== undefined && state.draft !== state.markdown ? 'Unapplied edits saved' : 'No unapplied edits';
  $('#paper-size').value = state.paper;
  for (const [id, key] of designFields) $(`#${id}`).value = state[key];
  syncAlignment();
  $('#summary-editor').value = state.summary; $('#include-summary').checked = selected.has('summary');
  renderSummaryLibrary(); renderOrder();
  $('#profile-badge').textContent = state.isSample ? 'Sample loaded' : 'Profile loaded';
  $('#version-count').textContent = state.versions.length;
  $('#parse-warnings').textContent = profile.warnings.join(' ');
  renderTags(); renderSelections(); renderResume();
}
function renderTags() {
  const tags = profileTags(profile);
  $('#tag-options').innerHTML = tags.length ? tags.map(t => `<label class="skill-chip"><input type="checkbox" name="job-tag" value="${escape(t.name)}">${escape(t.name)} <small>${t.count}</small></label>`).join('') : '<p class="field-hint">No tags yet. Add &lt;!-- tags: network, cyber --&gt; at the end of a bullet in your master Markdown.</p>';
  $('#apply-tags').disabled = !tags.length;
  $('#tag-result').textContent = '';
}
function renderSelections() {
  const opened = new Set([...document.querySelectorAll('.selection-section[open]')].map(e => e.dataset.section));
  const first = !$('#selection-sections').children.length;
  const personal = [{ flag: 'omit-name', label: 'Name', value: profile.name }, ...profile.contact.map((c, i) => ({ flag: `omit-contact-${i}`, label: c.label || 'Contact', value: c.value }))];
  $('#selection-sections').innerHTML = `<details class="selection-section" data-section="personal" ${first || opened.has('personal') ? 'open' : ''}><summary>Personal information <span class="section-num">${personal.filter(f => !selected.has(f.flag)).length} / ${personal.length}</span></summary><div class="section-body">${personal.map(f => `<label class="entry-select"><input type="checkbox" data-omit="${f.flag}" ${!selected.has(f.flag) ? 'checked' : ''}><span>${escape(f.label)}<span class="entry-meta">${escape(f.value)}</span></span></label>`).join('')}</div></details>` + state.sectionOrder.filter(key => key !== 'summary').map(section => {
    const count = section === 'summary' ? Number(selected.has('summary')) : profile[section].filter(e => selected.has(e.id)).length;
    const total = section === 'summary' ? 1 : profile[section].length;
    let body = '';
    if (section === 'summary') body = `<label class="entry-select"><input type="checkbox" data-id="summary" ${selected.has('summary') ? 'checked' : ''}>Include summary</label><label class="sr-only" for="summary-editor">Resume summary</label><textarea id="summary-editor" class="summary-text" rows="4" placeholder="Write a short introduction for this role…">${escape(state.summary)}</textarea>`;
    else {
      body = total ? `<div class="selection-tools"><button class="text-button" data-select-all="${section}">Select all</button><button class="text-button" data-clear="${section}">Clear</button></div>` : '<p class="field-hint">Add this section in your master profile.</p>';
      if (section === 'skills') body += `<div class="skill-chips">${profile.skills.map(s => `<label class="skill-chip"><input type="checkbox" data-id="${s.id}" ${selected.has(s.id) ? 'checked' : ''}>${escape(s.name)}</label>`).join('')}</div>`;
      else body += profile[section].map(e => `<div class="entry"><label class="entry-select"><input type="checkbox" data-id="${e.id}" ${selected.has(e.id) ? 'checked' : ''}><span>${escape(e.title)}<span class="entry-meta">${escape(e.meta.join(' · '))}</span></span></label>${e.bullets.map(b => `<label class="bullet-select"><input type="checkbox" data-id="${b.id}" ${selected.has(b.id) ? 'checked' : ''} ${!selected.has(e.id) ? 'disabled' : ''}><span>${escape(b.text)}${b.tags.length ? `<span class="bullet-tags">${b.tags.map(t => `<span>#${escape(t)}</span>`).join(' ')}</span>` : ''}</span></label>`).join('')}</div>`).join('');
    }
    return `<details class="selection-section" data-section="${section}" ${opened.has(section) || first && section === 'experience' ? 'open' : ''}><summary>${LABELS[section]} <span class="section-num">${count} / ${total}</span></summary><div class="section-body">${body}</div></details>`;
  }).join('');
}
function renderResume() {
  const skills = profile.skills.filter(s => selected.has(s.id));
  const entryCount = ENTRY_SECTIONS.reduce((count, key) => count + profile[key].filter(e => selected.has(e.id)).length, 0);
  $('#selected-count').textContent = `${entryCount + skills.length} selected`;
  $('#style-label').textContent = `${state.template[0].toUpperCase() + state.template.slice(1)} · ${state.fontSize} pt`;
  const text = resumeMarkdown(profile, selected, state.title, state.summary, state.sectionOrder);
  $('#word-count').textContent = `${text.trim().split(/\s+/).filter(Boolean).length} words`;
  pdfPreview.update(currentSnapshot());
}
function applyMarkdown(markdown) {
  const parsed = parseProfile(markdown);
  if (!markdown.trim()) { toast('Your profile is empty. Add your name and a section before applying.'); return false; }
  if (!parsed.name) { toast('Add a name first: use “# Your Name” at the top of the file.'); return false; }
  if (profile.name !== parsed.name) { state.title = ''; state.job = ''; }
  profile = parsed; state.markdown = markdown; delete state.draft;
  selected = defaultSelection(profile); state.summary = profile.summary.join('\n\n'); state.isSample = false;
  $('#match-result').textContent = ''; persist(); syncFields();
  toast(profile.warnings.length ? `Profile applied. ${profile.warnings.join(' ')}` : 'Profile applied. Your resume is ready to tailor.'); return true;
}
function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function filename(name) { return (name || 'resume').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '').slice(0, 100) || 'resume'; }
function renderVersions() {
  $('#version-count').textContent = state.versions.length;
  $('#versions-list').innerHTML = state.versions.length ? state.versions.map(v => `<article class="card version-card"><span class="pill">SAVED RESUME</span><h2>${escape(v.name)}</h2><p>${escape(v.title || 'General resume')}</p><p>${escape(new Date(v.created).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))}</p><div class="version-actions"><button class="button primary" data-load="${escape(v.id)}">Open version</button><button class="text-button" data-delete="${escape(v.id)}">Delete</button></div></article>`).join('') : '<div class="card empty-state"><h2>Room for your next opportunity.</h2><p>Tailor a resume, then choose “Save version” to keep it here.</p><button id="empty-builder" class="button primary">Build a resume →</button></div>';
}
function validSnapshot(value) { return value && typeof value.markdown === 'string' && Array.isArray(value.selected) && value.selected.every(s => typeof s === 'string') && ['title', 'summary', 'job'].every(k => typeof value[k] === 'string') && ['a4', 'letter'].includes(value.paper) && ['modern', 'classic', 'executive', 'compact'].includes(value.template); }

async function init() {
  let saved = null;
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { saved = JSON.parse(raw); if (!validSnapshot(saved) || !Array.isArray(saved.versions) || !saved.versions.every(v => validSnapshot(v) && typeof v.id === 'string' && typeof v.name === 'string')) throw new Error('Invalid saved workspace'); } }
  catch { saved = null; toast('The saved workspace could not be read. Loading the example profile.'); }
  if (saved) state = saved;
  else {
    const response = await fetch('/sample.md'); if (!response.ok) throw new Error('Could not load the example profile.');
    const markdown = await response.text(); const parsed = parseProfile(markdown);
    state = { markdown, selected: [...defaultSelection(parsed)], title: 'Senior Software Engineer', summary: parsed.summary.join('\n\n'), job: '', paper: 'a4', template: 'modern', versions: [], isSample: true };
  }
  Object.assign(state, appearance(state));
  state.summaryTemplates = Array.isArray(state.summaryTemplates) ? state.summaryTemplates.filter(t => typeof t.id === 'string' && typeof t.name === 'string' && typeof t.text === 'string' && typeof t.owner === 'string') : [];
  profile = parseProfile(state.markdown); selected = new Set(state.selected); syncFields();
  bindEditor();
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  $('#guide-button').addEventListener('click', () => switchView('source'));
  for (const id of ['import-button', 'source-import']) $(`#${id}`).addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) { toast('Please use a Markdown file smaller than 2 MB.'); return; }
      const text = await file.text();
      // Import into the editor first, so existing selections survive until Apply.
      state.draft = text; $('#markdown-editor').value = text; $('#source-state').textContent = 'Imported — review and apply'; persist(); switchView('source'); toast('File imported. Review the Markdown, then apply your profile.');
    } catch { toast('The file could not be read. Try another Markdown file.'); }
    finally { e.target.value = ''; }
  });
  $('#markdown-editor').addEventListener('input', e => { state.draft = e.target.value; $('#source-state').textContent = 'Unapplied edits'; clearTimeout(draftTimer); draftTimer = setTimeout(() => { draftTimer = null; persist(); }, 300); });
  $('#apply-source').addEventListener('click', () => applyMarkdown($('#markdown-editor').value));
  $('#download-source').addEventListener('click', () => download($('#markdown-editor').value, `${filename(profile.name)}-master.md`));
  $('#job-title').addEventListener('input', e => { state.title = e.target.value; renderResume(); persist(); });
  $('#job-description').addEventListener('input', e => { state.job = e.target.value; $('#match-result').textContent = ''; persist(); });
  $('#apply-tags').addEventListener('click', () => {
    const tags = [...document.querySelectorAll('input[name="job-tag"]:checked')].map(e => e.value);
    if (!tags.length) { $('#tag-result').textContent = 'Choose at least one tag. Your selections are unchanged.'; return; }
    const result = selectByTags(profile, selected, tags, $('#tag-mode').value);
    if (!result.count) { $('#tag-result').textContent = 'No bullets match this combination. Your selections are unchanged.'; return; }
    selected = result.selection;
    $('#tag-result').textContent = `${result.count} matching bullets selected across experience, projects, and education. Review skills, summary, and credentials for this role.`;
    $('#match-result').textContent = '';
    renderSelections(); renderResume(); persist();
  });
  $('#selection-sections').addEventListener('change', e => {
    if (e.target.dataset.omit) {
      const flag = e.target.dataset.omit;
      if (e.target.checked) selected.delete(flag); else selected.add(flag);
      renderSelections(); renderResume(); persist();
      document.querySelector(`[data-omit="${flag}"]`)?.focus({ preventScroll: true }); return;
    }
    if (!e.target.dataset.id) return;
    const id = e.target.dataset.id; if (e.target.checked) selected.add(id); else selected.delete(id);
    renderSelections(); renderResume(); persist();
    const replacement = [...document.querySelectorAll('[data-id]')].find(el => el.dataset.id === id); replacement?.focus({ preventScroll: true });
  });
  $('#selection-sections').addEventListener('input', e => { if (e.target.id === 'summary-editor') { state.summary = e.target.value; renderResume(); persist(); } });
  $('#selection-sections').addEventListener('click', e => {
    const button = e.target.closest('button'); if (!button) return;
    const section = button.dataset.selectAll || button.dataset.clear; if (!section) return;
    for (const entry of profile[section]) for (const id of [entry.id, ...(entry.bullets || []).map(b => b.id)]) button.dataset.selectAll ? selected.add(id) : selected.delete(id);
    renderSelections(); renderResume(); persist();
  });
  $('#suggest-button').addEventListener('click', () => {
    if (!state.job.trim()) { toast('Paste a job description first.'); $('#job-description').focus(); return; }
    const { matches, ranked } = matchJob(profile, state.job);
    if (!matches.length) { $('#match-result').textContent = 'No exact skill matches found. Your selections are unchanged. Try adding relevant skills to your master profile, or select content yourself.'; return; }
    for (const s of profile.skills) selected.delete(s.id);
    for (const s of matches) selected.add(s.id);
    // Preserve work history when no achievement text matches the recognized skills.
    if (ranked.length) {
      for (const section of ['experience', 'projects']) for (const e of profile[section]) { selected.delete(e.id); for (const b of e.bullets) selected.delete(b.id); }
      for (const b of ranked) { selected.add(b.id); selected.add(b.entryId); }
    }
    $('#match-result').textContent = `${matches.length} matching skills selected${ranked.length ? ` with ${ranked.length} relevant achievements` : '; experience and projects kept as selected'}. Review every section before exporting.`;
    renderSelections(); renderResume(); persist();
  });
  for (const [id, key] of [['paper-size', 'paper'], ...designFields]) $(`#${id}`).addEventListener('change', e => { state[key] = e.target.value; renderResume(); persist(); });
  $('#export-pdf').addEventListener('click', () => {
    const name = `${filename((selected.has('omit-name') ? 'Resume' : profile.name) + '-' + state.title)}.pdf`;
    if (pdfPreview.download(name)) toast('Downloaded the exact PDF shown in the preview.');
  });
  $('#export-markdown').addEventListener('click', () => download(resumeMarkdown(profile, selected, state.title, state.summary, state.sectionOrder), `${filename(profile.name + '-' + state.title)}.md`));
  $('#save-version').addEventListener('click', () => { $('#version-name').value = state.title || 'My resume'; $('#save-dialog').showModal(); $('#version-name').focus(); });
  $('#cancel-save').addEventListener('click', () => $('#save-dialog').close());
  $('#version-form').addEventListener('submit', e => {
    e.preventDefault(); const name = $('#version-name').value.trim(); if (!name) { $('#version-name').focus(); return; }
    state.versions.unshift({ ...currentSnapshot(), name, id: crypto.randomUUID(), created: Date.now() }); persist(); renderVersions(); $('#save-dialog').close(); toast('Resume version saved on this device.');
  });
  $('#versions-list').addEventListener('click', e => {
    const button = e.target.closest('button'); if (!button) return;
    if (button.id === 'empty-builder') { switchView('builder'); return; }
    if (button.dataset.load) {
      const v = state.versions.find(v => v.id === button.dataset.load); if (!v) return;
      // Keep the outgoing draft as a recovery version before switching profiles.
      const recovery = { ...currentSnapshot(), name: `Auto-backup — ${state.title || 'Untitled resume'}`, id: crypto.randomUUID(), created: Date.now() };
      if (state.draft !== undefined) recovery.draft = state.draft;
      state.versions.unshift(recovery);
      for (const key of ['markdown', 'title', 'summary', 'job', 'paper']) state[key] = v[key];
      Object.assign(state, appearance(v));
      if (typeof v.draft === 'string') state.draft = v.draft; else delete state.draft;
      state.isSample = false; profile = parseProfile(state.markdown); selected = new Set(v.selected); $('#match-result').textContent = ''; syncFields(); persist(); switchView('builder'); toast('Version opened. Your previous work is saved as an auto-backup.');
    }
    if (button.dataset.delete) {
      const id = button.dataset.delete; state.versions = state.versions.filter(v => v.id !== id); persist(); renderVersions(); toast('Saved version deleted. The current resume is unchanged.');
    }
  });
  window.addEventListener('beforeunload', () => { if (draftTimer) { clearTimeout(draftTimer); persist(); } });
  window.addEventListener('storage', e => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try { const incoming = JSON.parse(e.newValue); if (!validSnapshot(incoming) || !Array.isArray(incoming.versions)) return;
      if (draftTimer) { toast('Another tab changed this workspace. Finish your current edit before switching tabs.'); return; }
      state = { ...incoming, ...appearance(incoming), summaryTemplates: incoming.summaryTemplates || [] }; profile = parseProfile(state.markdown); selected = new Set(state.selected); syncFields();
    } catch { /* Ignore incomplete or invalid storage updates. */ }
  });
}


const designFields = [['template', 'template'], ['resume-font', 'font'], ['font-size', 'fontSize'], ['color-theme', 'theme'], ['line-spacing', 'spacing']];
function syncAlignment() {
  document.querySelectorAll('[data-alignment]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.alignment === state.alignment)));
}
function summaryLibrary() {
  const owner = profile.name.toLowerCase();
  const deleted = (state.deletedSummaryTemplates || []).filter(t => t.owner === owner).map(t => t.id);
  return [...starterSummaries(profile), ...state.summaryTemplates.filter(t => t.owner === owner)].filter(t => t.id === 'master' || !deleted.includes(t.id));
}
function renderSummaryLibrary() {
  const previous = $('#summary-template').value;
  $('#summary-template').innerHTML = summaryLibrary().map(t => `<option value="${escape(t.id)}">${escape(t.name)}</option>`).join('');
  if (summaryLibrary().some(t => t.id === previous)) $('#summary-template').value = previous;
  previewSummary();
}
function previewSummary() {
  $('#summary-template-preview').textContent = summaryLibrary().find(t => t.id === $('#summary-template').value)?.text || 'No summary in the master profile yet.';
  $('#delete-summary').disabled = $('#summary-template').value === 'master';
  $('#delete-summary').title = $('#summary-template').value === 'master' ? 'The original summary belongs to your master profile.' : 'Remove this template from the library';
  $('#restore-summary').hidden = !(state.deletedSummaryTemplates || []).some(t => t.owner === profile.name.toLowerCase());
}
function renderOrder() {
  $('#section-order').innerHTML = state.sectionOrder.map((key, index) => `<div class="order-row"><span>${LABELS[key]}</span><div><button type="button" data-move="${key}" data-direction="-1" aria-label="Move ${LABELS[key]} up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="${key}" data-direction="1" aria-label="Move ${LABELS[key]} down" ${index === state.sectionOrder.length - 1 ? 'disabled' : ''}>↓</button></div></div>`).join('');
}
function activatePanel(name) {
  document.querySelectorAll('[data-panel]').forEach(button => {
    const active = button.dataset.panel === name;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    $(`#panel-${button.dataset.panel}`).classList.toggle('hidden', !active);
  });
}
function bindEditor() {
  document.querySelectorAll('[data-alignment]').forEach(button => button.addEventListener('click', () => {
    state.alignment = button.dataset.alignment; syncAlignment(); renderResume(); persist();
  }));
  document.querySelectorAll('[data-panel]').forEach(button => {
    button.addEventListener('click', () => activatePanel(button.dataset.panel));
    button.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault(); const tabs = [...document.querySelectorAll('[data-panel]')], i = tabs.indexOf(button);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      activatePanel(tabs[next].dataset.panel); tabs[next].focus();
    });
  });
  $('#summary-template').addEventListener('change', previewSummary);
  $('#delete-summary').addEventListener('click', () => {
    const id = $('#summary-template').value;
    if (id === 'master' || !summaryLibrary().some(t => t.id === id)) return;
    state.deletedSummaryTemplates = [...(state.deletedSummaryTemplates || []), { id, owner: profile.name.toLowerCase() }];
    persist(); renderSummaryLibrary(); toast('Template deleted. Your active summary is unchanged. You can restore it below.');
  });
  $('#restore-summary').addEventListener('click', () => {
    const deleted = state.deletedSummaryTemplates || [], owner = profile.name.toLowerCase();
    const index = deleted.findLastIndex(t => t.owner === owner); if (index < 0) return;
    const [restored] = deleted.splice(index, 1); persist(); renderSummaryLibrary(); $('#summary-template').value = restored.id; previewSummary(); toast('Template restored.');
  });
  $('#use-summary').addEventListener('click', () => {
    const template = summaryLibrary().find(t => t.id === $('#summary-template').value); if (!template) return;
    state.summary = template.text; selected.add('summary'); $('#include-summary').checked = true; $('#summary-editor').value = state.summary; renderResume(); persist(); toast('Summary applied. You can edit it below.');
  });
  $('#summary-editor').addEventListener('input', e => { state.summary = e.target.value; renderResume(); persist(); });
  $('#include-summary').addEventListener('change', e => { if (e.target.checked) selected.add('summary'); else selected.delete('summary'); renderResume(); persist(); });
  $('#save-summary').addEventListener('click', () => {
    const name = $('#summary-name').value.trim();
    if (!name || !state.summary.trim()) { toast('Add a name and summary text before saving.'); return; }
    const record = { id: crypto.randomUUID(), name, text: state.summary, owner: profile.name.toLowerCase() };
    state.summaryTemplates.push(record); persist(); renderSummaryLibrary(); $('#summary-template').value = record.id; previewSummary(); $('#summary-name').value = ''; toast('Summary template saved for this profile.');
  });
  $('#section-order').addEventListener('click', e => {
    const button = e.target.closest('[data-move]'); if (!button) return;
    const key = button.dataset.move, direction = Number(button.dataset.direction);
    state.sectionOrder = moveSection(state.sectionOrder, key, direction); renderOrder(); renderSelections(); renderResume(); persist();
    const replacement = document.querySelector(`[data-move="${key}"][data-direction="${direction}"]`); if (!replacement.disabled) replacement.focus();
  });
  $('#reset-order').addEventListener('click', () => { state.sectionOrder = normalizeOrder([]); renderOrder(); renderSelections(); renderResume(); persist(); });
}

init().catch(error => { console.error(error); $('#save-status').textContent = 'App could not load'; toast('Could not start Folio. Make sure the local server is running, then refresh.'); });
