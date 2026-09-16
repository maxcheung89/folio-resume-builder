import test from 'node:test';
import assert from 'node:assert/strict';
import { appearance, normalizeOrder, moveSection, starterSummaries } from '../preferences.js';
import { SECTION_ORDER, parseProfile, defaultSelection, resumeMarkdown } from '../profile.js';
test('legacy versions receive appearance defaults without losing their layout', () => {
  const result = appearance({ template: 'classic' });
  assert.equal(result.template, 'classic'); assert.equal(result.fontSize, '11');
  assert.deepEqual(result.sectionOrder, SECTION_ORDER);
  assert.equal(appearance({ fontSize: '999', theme: 'invalid' }).theme, 'forest');
});
test('section order repairs duplicates and missing sections and respects boundaries', () => {
  const order = normalizeOrder(['experience', 'experience', 'invalid']);
  assert.equal(order[0], 'experience'); assert.equal(order.length, SECTION_ORDER.length);
  assert.deepEqual(moveSection(order, 'experience', -1), order);
  assert.equal(moveSection(order, 'experience', 1)[1], 'experience');
});
test('Markdown export follows the chosen order including summary and skills', () => {
  const p = parseProfile('# Person\n## Summary\nHello\n## Skills\n- Python\n## Experience\n### Engineer\n- Built tools.');
  const md = resumeMarkdown(p, defaultSelection(p), '', 'Hello', ['experience', 'skills', 'summary']);
  assert.ok(md.indexOf('## Experience') < md.indexOf('## Skills'));
  assert.ok(md.indexOf('## Skills') < md.indexOf('## Summary'));
});
test('starter summaries use only the current imported profile', () => {
  assert.deepEqual(starterSummaries({ name: 'Example Person', summary: ['First paragraph', 'Second paragraph'] }), [
    { id: 'master', name: 'Original master summary', text: 'First paragraph\n\nSecond paragraph' }
  ]);
  assert.equal(starterSummaries({ name: 'Another Person', summary: [] })[0].text, '');
});
test('alignment is independent of layout and legacy classic stays centered', () => {
  assert.equal(appearance({ template: 'classic' }).alignment, 'center');
  for (const template of ['modern', 'classic', 'executive', 'compact']) {
    assert.equal(appearance({ template, alignment: 'left' }).alignment, 'left');
    assert.equal(appearance({ template, alignment: 'center' }).alignment, 'center');
  }
});

