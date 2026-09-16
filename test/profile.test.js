import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseProfile, defaultSelection, matchJob, containsTerm, resumeMarkdown } from '../profile.js';

const sample = await readFile(new URL('../sample.md', import.meta.url), 'utf8');
test('parses a full profile and preserves career content', () => {
  const p = parseProfile(sample);
  assert.equal(p.name, 'Alex Morgan'); assert.equal(p.contact.length, 5);
  assert.equal(p.experience.length, 2); assert.equal(p.experience[0].bullets.length, 3);
  assert.equal(p.projects.length, 2); assert.equal(p.certifications.length, 2);
  assert.equal(p.warnings.length, 0); assert.ok(p.skills.some(s => s.name === 'Rust'));
  assert.ok(defaultSelection(p).has(p.experience[0].bullets[0].id));
});
test('handles Windows newlines, aliases, formatting, and duplicate skills', () => {
  const p = parseProfile('# **Jane Doe**\r\n## Contact\r\n- Email: jane@example.com\r\n## Summery\r\nEngineer.\r\n## Technical Skills\r\n- Tools: Rust; SQL; Rust\r\n## Job Experience\r\n### Engineer\r\n2020 - 2025\r\n1. Built `software`.');
  assert.equal(p.name, 'Jane Doe'); assert.deepEqual(p.summary, ['Engineer.']);
  assert.equal(p.skills.length, 2); assert.equal(p.experience[0].bullets[0].text, 'Built software.');
});
test('unsupported sections produce warnings without swallowing adjacent supported sections', () => {
  const p = parseProfile('# Jane\n## Awards\nPrivate award\n## Education\n### Degree\n2020');
  assert.equal(p.warnings.length, 1); assert.equal(p.education[0].title, 'Degree');
  assert.equal(parseProfile('## Skills\n- Rust').warnings.length, 1);
});
test('matches whole skills including punctuation without substring false positives', () => {
  assert.equal(containsTerm('A proactive team working with C++ and Node.js.', 'React'), false);
  assert.equal(containsTerm('Experience with C++, C# and Node.js.', 'C++'), true);
  assert.equal(containsTerm('Experience with C++, C# and Node.js.', 'C#'), true);
  assert.equal(containsTerm('Experience with NodeXjs', 'Node.js'), false);
  const result = matchJob(parseProfile(sample), 'Build accessible React interfaces using TypeScript.');
  assert.deepEqual(result.matches.map(s => s.name), ['TypeScript', 'React']);
  assert.ok(result.ranked.length > 0); assert.ok(result.ranked.every(b => b.score > 0));
});
test('export respects individual bullets, deselected parents, and custom summary', () => {
  const p = parseProfile(sample); const selected = new Set(['summary', 'skills-0', 'experience-0', 'experience-0-b1', 'projects-0-b0']);
  const md = resumeMarkdown(p, selected, 'Backend Engineer', 'A tailored introduction.');
  assert.match(md, /A tailored introduction/); assert.match(md, /PostgreSQL queries/);
  assert.doesNotMatch(md, /18,000/); assert.doesNotMatch(md, /Trail Notes/); assert.doesNotMatch(md, /## Education/);
  assert.match(md, /Backend Engineer/);
});
test('empty skill groups and unstructured entries do not crash', () => {
  const p = parseProfile('# Jane\n## Skills\n- Languages:\n## Certifications\nA certificate\n- Issued in 2024');
  assert.equal(p.skills.length, 0); assert.equal(p.certifications[0].bullets.length, 1);
  assert.doesNotThrow(() => resumeMarkdown(p, defaultSelection(p), '', ''));
});
