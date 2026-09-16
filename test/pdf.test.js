import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import { createResumePdf, validatePdfInput } from '../pdf-export.mjs';
import { parseProfile, defaultSelection } from '../profile.js';

const markdown = '# Test Person\n## Basic Info\n- Email: test@example.com\n## Summary\nReliable engineer.\n## Experience\n### Engineer\n2020 - Present\n- Configured reliable networks. <!-- tags: network -->';
const profile = parseProfile(markdown);
const input = { markdown, selected: [...defaultSelection(profile)], summary: 'Reliable engineer.', title: 'Network Engineer', paper: 'letter', font: 'arial' };
test('PDF uses requested page size and embeds real font programs', async () => {
  const bytes = await createResumePdf(input); const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1); assert.equal(pdf.getPage(0).getWidth(), 612);
  const fonts = pdf.getPage(0).node.Resources().lookup(PDFName.of('Font'));
  const font = fonts.lookup(fonts.keys()[0]);
  const descendant = font.lookup(PDFName.of('DescendantFonts')).lookup(0);
  assert.ok(descendant.lookup(PDFName.of('FontDescriptor')).has(PDFName.of('FontFile2')));
});
test('all selectable font families export successfully', async () => {
  for (const font of ['calibri', 'georgia', 'times']) {
    const pdf = await PDFDocument.load(await createResumePdf({ ...input, font, paper: 'a4', alignment: 'center', template: 'executive' }));
    assert.equal(pdf.getPage(0).getWidth(), 595.28);
  }
});
test('long content flows across pages', async () => {
  const pdf = await PDFDocument.load(await createResumePdf({ ...input, summary: 'A lengthy professional introduction. '.repeat(500) }));
  assert.ok(pdf.getPageCount() > 1);
});
test('rejects malformed export requests', () => {
  assert.throws(() => validatePdfInput({}));
  assert.throws(() => validatePdfInput({ ...input, selected: [42] }));
});
