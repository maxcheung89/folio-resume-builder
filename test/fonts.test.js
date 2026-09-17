import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { PDFDocument, PDFName } from 'pdf-lib';
import { createResumePdf } from '../pdf-export.mjs';
import { decodeCustomFont } from '../font-validation.mjs';
import { parseProfile, defaultSelection } from '../profile.js';
import { appearance } from '../preferences.js';

const markdown = '# Font Check\n## Summary\nOffice efficiency, traffic, flight, ABC abc 0123.\n## Experience\n### Engineer\n- Configured reliable systems. <!-- tags: systems -->';
const profile = parseProfile(markdown);
const input = { markdown, summary: profile.summary.join(' '), title: 'Engineer', selected: [...defaultSelection(profile)] };
const customId = 'custom-12345678-1234-1234-1234-123456789abc';
test('Carlito embeds complete original glyph programs to avoid subset corruption', async () => {
  const pdf = await PDFDocument.load(await createResumePdf({ ...input, font: 'calibri' }));
  const fonts = pdf.getPage(0).node.Resources().lookup(PDFName.of('Font'));
  const expected = await Promise.all(['Carlito-Regular.ttf', 'Carlito-Bold.ttf'].map(file => readFile(new URL(`../vendor/${file}`, import.meta.url))));
  assert.ok(fonts.keys().length >= 2);
  for (const key of fonts.keys()) {
    const font = fonts.lookup(key).lookup(PDFName.of('DescendantFonts')).lookup(0);
    const stream = font.lookup(PDFName.of('FontDescriptor')).lookup(PDFName.of('FontFile2'));
    const embedded = inflateSync(stream.contents);
    assert.ok(expected.some(bytes => bytes.equals(embedded)), 'Embedded font bytes must retain the original composite glyphs');
  }
});
test('additional font families render and saved choices survive normalization', async () => {
  for (const font of ['ptsans', 'plexmono']) {
    assert.equal(appearance({ font }).font, font);
    assert.ok((await PDFDocument.load(await createResumePdf({ ...input, font }))).getPageCount());
  }
  assert.equal(appearance({ font: customId }).font, customId);
});
test('custom regular-only font and regular/bold pairs produce PDFs', async () => {
  const regular = (await readFile(new URL('../vendor/Lato-Regular.ttf', import.meta.url))).toString('base64');
  const bold = (await readFile(new URL('../vendor/Lato-Bold.ttf', import.meta.url))).toString('base64');
  for (const customFont of [{ regular }, { regular, bold }]) {
    assert.ok((await PDFDocument.load(await createResumePdf({ ...input, font: customId, customFont }))).getPageCount());
  }
});
test('invalid, oversized, missing, and web font inputs fail clearly', async () => {
  for (const data of [undefined, 'not base64!', 'A'.repeat(2800004), Buffer.from('wOFFthis is not a font').toString('base64')])
    assert.throws(() => decodeCustomFont(data), /font|TTF/);
  await assert.rejects(createResumePdf({ ...input, font: customId }), /font/);
});
test('AI prompt example parses all documented sections and tags', async () => {
  const prompt = await readFile(new URL('../AI-MARKDOWN-PROMPT.md', import.meta.url), 'utf8');
  const example = prompt.slice(prompt.indexOf('# Jordan Example'), prompt.indexOf('FINAL SELF-CHECK'));
  const parsed = parseProfile(example);
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.name, 'Jordan Example');
  for (const key of ['experience', 'projects', 'education', 'certifications', 'certificationsInProgress']) assert.equal(parsed[key].length, 1);
  assert.ok(parsed.experience[0].bullets[0].tags.includes('network'));
});

