import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProfile, defaultSelection, profileTags, selectByTags, resumeMarkdown } from '../profile.js';

const source = `# Test Person
<!-- Original application: Old role
This is a master-only note. -->
## Basic Info
- Citizenship: U.S. Citizen
## Experience
### Network Analyst | Employer
Hours/week: 40
- Restored a network after an incident. <!-- tags: Network, CYBER, network -->
- Managed supplies. <!-- tags: logistics -->
- Wrote a runbook.
### Other role
- Maintained records. <!-- tags: logistics -->
## Projects
### Monitoring tool
- Monitored traffic. <!-- tags: network, monitoring -->
## Education
### Degree
GPA: 4.0 / 4.0
- Taught secure coding. <!-- tags: cyber, teaching -->
## Certifications
### Security+
## Certifications in Progress
### CCNA
Exam scheduled: 08/22/2026
`;
test('parses normalized unique tags without leaking notes into resume text', () => {
  const p = parseProfile(source);
  assert.deepEqual(p.experience[0].bullets[0].tags, ['network', 'cyber']);
  assert.equal(p.experience[0].bullets[0].text, 'Restored a network after an incident.');
  assert.deepEqual(p.experience[0].bullets[2].tags, []);
  assert.equal(p.contact.length, 1);
  assert.equal(profileTags(p).find(t => t.name === 'network').count, 2);
  const md = resumeMarkdown(p, defaultSelection(p), '', '');
  assert.doesNotMatch(md, /<!--|tags:|master-only|Old role/);
  assert.match(md, /Hours\/week: 40/);
  assert.match(md, /## Certifications in progress\n### CCNA/);
  assert.equal(p.certifications.length, 1);
});
test('any-tag selection finds relevant bullets across roles and excludes unmatched positions', () => {
  const p = parseProfile(source);
  const result = selectByTags(p, defaultSelection(p), ['network']);
  assert.equal(result.count, 2);
  assert.ok(result.selection.has('experience-0'));
  assert.ok(!result.selection.has('experience-1'));
  assert.ok(!result.selection.has('experience-0-b1'));
  assert.ok(!result.selection.has('experience-0-b2'));
  assert.ok(result.selection.has('projects-0-b0'));
  assert.ok(result.selection.has('education-0'));
  assert.ok(!result.selection.has('education-0-b0'));
  assert.ok(result.selection.has('certifications-0'));
});
test('all-tag selection requires both tags on the same bullet', () => {
  const p = parseProfile(source);
  const all = selectByTags(p, defaultSelection(p), ['network', 'cyber'], 'all');
  assert.equal(all.count, 1);
  const any = selectByTags(p, defaultSelection(p), ['network', 'cyber'], 'any');
  assert.equal(any.count, 3);
  assert.ok(any.selection.has('education-0-b0'));
});
test('empty and unmatched filters preserve existing selections', () => {
  const p = parseProfile(source); const selected = new Set(['summary', 'experience-0', 'experience-0-b2']);
  for (const tags of [[], ['absent'], ['network', 'logistics']]) {
    const result = selectByTags(p, selected, tags, 'all');
    assert.equal(result.count, 0); assert.deepEqual(result.selection, selected);
  }
});
