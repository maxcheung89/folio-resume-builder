// Deliberately parse a small, documented Markdown schema. Never execute source HTML.
export const ENTRY_SECTIONS = ['experience', 'projects', 'education', 'certifications', 'certificationsInProgress'];
export const SECTION_ORDER = ['summary', 'skills', ...ENTRY_SECTIONS];
export const LABELS = { summary: 'Summary', skills: 'Skills', experience: 'Experience', projects: 'Projects', education: 'Education', certifications: 'Certifications', certificationsInProgress: 'Certifications in progress' };
const aliases = {
  'basic info': 'basic', 'basic information': 'basic', 'personal information': 'basic', 'contact': 'basic', 'contact information': 'basic',
  'summary': 'summary', 'summery': 'summary', 'professional summary': 'summary', 'profile': 'summary',
  'skills': 'skills', 'technical skills': 'skills', 'skill set': 'skills',
  'experience': 'experience', 'job experience': 'experience', 'job experince': 'experience', 'work experience': 'experience', 'employment': 'experience',
  'projects': 'projects', 'education': 'education', 'certifications': 'certifications', 'certification': 'certifications', 'certificates': 'certifications',
  'certifications in progress': 'certificationsInProgress', 'certifications & licenses': 'certifications', 'professional experience': 'experience', 'summary of qualifications': 'summary', 'relevant security projects': 'projects',
};
export function normalizeTag(tag) { return tag.trim().toLowerCase().replace(/^#/, '').replace(/[\s_]+/g, '-'); }
function bulletContent(line) {
  const tags = [...line.matchAll(/<!--\s*tags:\s*([\s\S]*?)-->/gi)].flatMap(m => m[1].split(',').map(normalizeTag)).filter(Boolean);
  return { tags: [...new Set(tags)], text: plain(line.replace(/<!--[\s\S]*?-->/g, '').replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '')) };
}
export function plain(text) {
  return text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/\*\*|__|`/g, '').trim();
}
export function parseProfile(markdown) {
  const result = { name: '', contact: [], summary: [], skills: [], experience: [], projects: [], education: [], certifications: [], certificationsInProgress: [], warnings: [] };
  let section = 'basic', current = null;
  // Strip prose comments, including multiline notes, while preserving single-line tag metadata.
  const source = markdown.replace(/<!--[\s\S]*?-->/g, comment => /^<!--\s*tags:[^\r\n]*-->$/i.test(comment) ? comment : '');
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line || /^---+$/.test(line)) continue;
    if (/^#\s+/.test(line)) { result.name = plain(line.replace(/^#\s+/, '')); continue; }
    if (/^##\s+/.test(line)) {
      const title = plain(line.replace(/^##\s+/, ''));
      section = aliases[title.toLowerCase()] || 'unknown'; current = null;
      if (section === 'unknown') result.warnings.push(`“${title}” is not a supported section. See the Markdown guide.`);
      continue;
    }
    if (section === 'unknown') continue;
    const value = plain(line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, ''));
    if (section === 'basic') {
      const field = value.match(/^([^:]+):\s*(.+)$/);
      if (field && /^name$/i.test(field[1])) result.name = field[2];
      else result.contact.push({ label: field ? field[1] : '', value: field ? field[2] : value });
    } else if (section === 'summary') result.summary.push(value);
    else if (section === 'skills') {
      const colon = value.indexOf(':');
      const group = colon < 0 ? 'Skills' : value.slice(0, colon).trim();
      for (const skill of (colon < 0 ? value : value.slice(colon + 1)).split(/[,;]/).map(s => s.trim()).filter(Boolean)) {
        if (!result.skills.some(s => s.name.toLowerCase() === skill.toLowerCase())) result.skills.push({ id: `skills-${result.skills.length}`, name: skill, group });
      }
    } else {
      if (/^###\s+/.test(line)) {
        current = { id: `${section}-${result[section].length}`, title: plain(line.replace(/^###\s+/, '')), meta: [], bullets: [] };
        result[section].push(current);
      } else {
        if (!current) {
          current = { id: `${section}-${result[section].length}`, title: value, meta: [], bullets: [] };
          result[section].push(current); continue;
        }
        if (/^(?:[-*+]\s+|\d+\.\s+)/.test(line)) current.bullets.push({ id: `${current.id}-b${current.bullets.length}`, ...bulletContent(line) });
        else current.meta.push(value);
      }
    }
  }
  if (!result.name) result.warnings.push('Add your name with a top-level heading: # Your Name');
  return result;
}
export function defaultSelection(profile) {
  return new Set(['summary', ...profile.skills.map(s => s.id), ...ENTRY_SECTIONS.flatMap(k => profile[k].flatMap(e => [e.id, ...e.bullets.map(b => b.id)]))]);
}
// Omission flags preserve all personal fields in resumes saved before this control existed.
export function selectedContact(profile, selection) {
  return profile.contact.filter((_, index) => !selection.has(`omit-contact-${index}`));
}
export function profileTags(profile) {
  const counts = new Map();
  for (const key of ['experience', 'projects', 'education']) for (const e of profile[key]) for (const b of e.bullets) for (const tag of b.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
export function selectByTags(profile, selection, tags, mode = 'any') {
  const wanted = [...new Set(tags.map(normalizeTag).filter(Boolean))];
  const next = new Set(selection);
  if (!wanted.length) return { selection: next, count: 0 };
  let count = 0;
  for (const key of ['experience', 'projects', 'education']) for (const e of profile[key]) {
    // Education credentials stay in place while teaching achievements can be tailored.
    if (key !== 'education') next.delete(e.id);
    let hits = 0;
    for (const b of e.bullets) {
      next.delete(b.id);
      const matches = mode === 'all' ? wanted.every(t => b.tags.includes(t)) : wanted.some(t => b.tags.includes(t));
      if (matches) { next.add(b.id); hits++; count++; }
    }
    if (hits) next.add(e.id);
  }
  // A typo or unmatched combination must not erase a tailored resume.
  return { selection: count ? next : new Set(selection), count };
}
export function containsTerm(text, term) {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(text);
}
export function matchJob(profile, job) {
  const matches = profile.skills.filter(s => containsTerm(job, s.name));
  const ranked = ['experience', 'projects'].flatMap(section => profile[section].flatMap(entry => entry.bullets.map(b => ({ ...b, entryId: entry.id, section, score: matches.filter(s => containsTerm(`${entry.title} ${b.text}`, s.name)).length }))));
  return { matches, ranked: ranked.filter(b => b.score > 0).sort((a, b) => b.score - a.score) };
}
export function resumeMarkdown(profile, selection, title, summary, order = SECTION_ORDER) {
  const out = [...(selection.has('omit-name') ? [] : [`# ${profile.name || 'Your Name'}`]), title, '', ...selectedContact(profile, selection).map(c => `${c.label ? c.label + ': ' : ''}${c.value}`), ''];
  const skills = profile.skills.filter(s => selection.has(s.id));
  for (const key of [...new Set([...order, ...SECTION_ORDER])].filter(k => SECTION_ORDER.includes(k))) {
    if (key === 'summary') { if (selection.has('summary') && summary.trim()) out.push('## Summary', summary, ''); continue; }
    if (key === 'skills') { if (skills.length) out.push('## Skills', skills.map(s => s.name).join(', '), ''); continue; }
    const entries = profile[key].filter(e => selection.has(e.id));
    if (!entries.length) continue;
    out.push(`## ${LABELS[key]}`);
    for (const e of entries) out.push(`### ${e.title}`, ...e.meta, ...e.bullets.filter(b => selection.has(b.id)).map(b => `- ${b.text}`), '');
  }
  return out.join('\n');
}
