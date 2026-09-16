import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProfile, defaultSelection, selectedContact, resumeMarkdown, selectByTags } from '../profile.js';

const profile = parseProfile('# Test Person\n## Basic Info\n- Email: test@example.com\n- Address: Private address\n- Citizenship: U.S. Citizen\n## Experience\n### Engineer\n- Configured networks. <!-- tags: network -->');
test('personal fields remain visible in legacy selections', () => {
  assert.equal(selectedContact(profile, new Set(['summary'])).length, 3);
});
test('personal omissions are respected in exports and survive job-tag selection', () => {
  const selected = defaultSelection(profile);
  selected.add('omit-name'); selected.add('omit-contact-1'); selected.add('omit-contact-2');
  const filtered = selectByTags(profile, selected, ['network']).selection;
  const md = resumeMarkdown(profile, filtered, '', '');
  assert.doesNotMatch(md, /Test Person|Private address|U.S. Citizen/);
  assert.match(md, /test@example.com/);
  assert.equal(selectedContact(profile, filtered).length, 1);
});
