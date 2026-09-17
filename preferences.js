import { SECTION_ORDER } from './profile.js';

export function normalizeOrder(order) {
  return [...new Set([...(Array.isArray(order) ? order : []), ...SECTION_ORDER])].filter(key => SECTION_ORDER.includes(key));
}
export function moveSection(order, key, direction) {
  const next = normalizeOrder(order), index = next.indexOf(key), target = index + direction;
  if (index >= 0 && target >= 0 && target < next.length) [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function appearance(value = {}) {
  const option = (key, choices, fallback) => choices.includes(value[key]) ? value[key] : fallback;
  return {
    template: option('template', ['modern', 'classic', 'executive', 'compact'], 'modern'),
    font: /^custom-[a-f0-9-]{36}$/.test(value.font || '') ? value.font : option('font', ['arial', 'calibri', 'georgia', 'times', 'ptsans', 'plexmono'], 'arial'),
    fontSize: option('fontSize', ['10', '11', '12'], '11'),
    theme: option('theme', ['forest', 'navy', 'charcoal', 'burgundy'], 'forest'),
    spacing: option('spacing', ['tight', 'balanced', 'airy'], 'balanced'),
    alignment: option('alignment', ['left', 'center'], value.template === 'classic' ? 'center' : 'left'),
    sectionOrder: normalizeOrder(value.sectionOrder),
  };
}
// Only use the imported profile's own facts; users can save category templates in the UI.
export function starterSummaries(profile) {
  return [{ id: 'master', name: 'Original master summary', text: profile.summary.join('\n\n') }];
}

