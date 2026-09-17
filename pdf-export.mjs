import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';

import { parseProfile, selectedContact, LABELS } from './profile.js';
import { decodeCustomFont } from './font-validation.mjs';
import { appearance } from './preferences.js';

// Keep the stored keys compatible with saved resumes; display names identify the bundled fonts.
const fontFiles = {
  arial: ['Lato-Regular.ttf', 'Lato-Bold.ttf'],
  calibri: ['Carlito-Regular.ttf', 'Carlito-Bold.ttf'],
  georgia: ['PT_Serif-Web-Regular.ttf', 'PT_Serif-Web-Bold.ttf'],
  times: ['Tinos-Regular.ttf', 'Tinos-Bold.ttf'],
  ptsans: ['PT_Sans-Web-Regular.ttf', 'PT_Sans-Web-Bold.ttf'],
  plexmono: ['IBMPlexMono-Regular.ttf', 'IBMPlexMono-Bold.ttf'],
};
const fontCache = new Map();
async function loadFonts(family) {
  if (!fontCache.has(family)) {
    fontCache.set(family, Promise.all(fontFiles[family].map(file =>
      readFile(new URL(`./vendor/${file}`, import.meta.url))
    )).catch(() => {
      fontCache.delete(family);
      throw new Error('Bundled resume fonts are missing. Extract the complete Folio download, including the vendor folder, and restart the server.');
    }));
  }
  return fontCache.get(family);
}
export function validatePdfInput(input) {
  if (!input || typeof input.markdown !== 'string' || input.markdown.length > 1000000 || !Array.isArray(input.selected) || input.selected.length > 20000 || !input.selected.every(s => typeof s === 'string') || typeof input.summary !== 'string' || input.summary.length > 100000 || typeof input.title !== 'string' || input.title.length > 500) throw new Error('Invalid resume data. Refresh the app and try again.');
}

export async function createResumePdf(input) {
  validatePdfInput(input);
  const profile = parseProfile(input.markdown), selected = new Set(input.selected), style = appearance(input);
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const buffers = style.font.startsWith('custom-')
    ? [decodeCustomFont(input.customFont?.regular), decodeCustomFont(input.customFont?.bold || input.customFont?.regular)]
    : await loadFonts(style.font);
  // Subsetting Carlito corrupts composite glyphs in fontkit. Full embedding also
  // preserves uploaded fonts faithfully across PDF.js, Preview, and other readers.
  const normal = await doc.embedFont(buffers[0], { subset: false, features: { liga: false, clig: false, dlig: false, calt: false } }), bold = await doc.embedFont(buffers[1], { subset: false, features: { liga: false, clig: false, dlig: false, calt: false } });
  const supported = new Set(normal.getCharacterSet().filter(code => bold.getCharacterSet().includes(code)));
  const clean = value => {
    const text = String(value).replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
    const missing = [...new Set([...text].filter(c => c !== '\n' && !supported.has(c.codePointAt(0))))];
    if (missing.length) throw new Error(`The selected font cannot display: ${missing.slice(0, 8).join(' ')}. Choose a font supporting these characters or edit the text.`);
    return text;
  };
  const [width, height] = input.paper === 'letter' ? [612, 792] : [595.28, 841.89];
  const margin = style.template === 'compact' ? 36 : 42, bottom = 40, contentWidth = width - margin * 2;
  const size = Number(style.fontSize), leading = size * ({ tight: 1.18, balanced: 1.4, airy: 1.6 }[style.spacing]);
  const gap = { tight: 3, balanced: 6, airy: 9 }[style.spacing], sectionGap = { tight: 8, balanced: 13, airy: 18 }[style.spacing];
  const colors = { forest: [0.157, .306, .247], navy: [.141, .247, .404], charcoal: [.204, .204, .204], burgundy: [.443, .235, .282] };
  const ink = rgb(...colors[style.theme]), body = rgb(.16, .18, .17), muted = rgb(.34, .38, .35);
  let page, y;
  function newPage() { page = doc.addPage([width, height]); y = height - margin; }
  newPage();
  function ensure(space) { if (y - space < bottom && y < height - margin) newPage(); }
  function wrap(value, font = normal, fontSize = size, maxWidth = contentWidth) {
    const lines = [];
    for (const paragraph of clean(value).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && font.widthOfTextAtSize(`${line} ${word}`, fontSize) > maxWidth) { lines.push(line); line = ''; }
        if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
          for (const character of word) {
            if (line && font.widthOfTextAtSize(line + character, fontSize) > maxWidth) { lines.push(line); line = ''; }
            line += character;
          }
        } else line += (line ? ' ' : '') + word;
      }
      lines.push(line);
    }
    return lines;
  }
  function paragraph(text, { font = normal, fontSize = size, color = body, indent = 0, centered = false, bullet = false, after = gap, lineHeight = leading } = {}) {
    const lines = wrap(text, font, fontSize, contentWidth - indent);
    for (let i = 0; i < lines.length; i++) {
      ensure(lineHeight);
      const line = lines[i];
      const x = centered ? margin + (contentWidth - font.widthOfTextAtSize(line, fontSize)) / 2 : margin + indent;
      if (bullet && i === 0) page.drawText('•', { x: margin + 2, y: y - fontSize, size: fontSize, font: normal, color });
      if (line) page.drawText(line, { x, y: y - fontSize, size: fontSize, font, color });
      y -= lineHeight;
    }
    y -= after;
  }
  const centered = style.alignment === 'center';
  if (!selected.has('omit-name')) paragraph(profile.name || 'Your Name', { font: bold, fontSize: style.template === 'compact' ? 22 : 26, lineHeight: 30, centered, color: ink, after: 4 });
  if (input.title.trim()) paragraph(input.title, { fontSize: size + 1, lineHeight: leading + 2, color: ink, centered, after: 6 });
  const contact = selectedContact(profile, selected);
  if (contact.length) paragraph(contact.map(c => `${c.label ? c.label + ': ' : ''}${c.value}`).join('  |  '), { fontSize: Math.max(8, size - 2), lineHeight: Math.max(11, leading - 2), color: muted, centered, after: 7 });
  if (style.template === 'executive') { ensure(6); page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 2, color: ink }); y -= 3; }

  function entryIntroHeight(entry) {
    return wrap(entry.title, bold).length * leading + (entry.meta.length ? wrap(entry.meta.join(' | '), normal, size - 1).length * Math.max(size + 1, leading - 1) : 0) + gap * 2 + (entry.bullets.some(b => selected.has(b.id)) ? leading * 2 : 0);
  }
  function heading(label, nextHeight) {
    const headingHeight = size + 10;
    ensure(sectionGap + headingHeight + Math.min(nextHeight, height - margin - bottom - headingHeight - sectionGap));
    y -= sectionGap;
    if (style.template === 'executive') page.drawRectangle({ x: margin, y: y - headingHeight + 3, width: contentWidth, height: headingHeight, color: rgb(.95, .96, .95) });
    paragraph(label.toUpperCase(), { font: bold, fontSize: size, lineHeight: size + 5, color: ink, centered, after: 4 });
    if (style.template !== 'executive') page.drawLine({ start: { x: margin, y: y + 3 }, end: { x: width - margin, y: y + 3 }, thickness: .5, color: rgb(.73, .77, .73) });
  }
  for (const key of style.sectionOrder) {
    if (key === 'summary') {
      if (selected.has('summary') && input.summary.trim()) { heading('Summary', leading * 2); paragraph(input.summary); }
      continue;
    }
    if (key === 'skills') {
      const skills = profile.skills.filter(s => selected.has(s.id));
      if (skills.length) { heading('Skills', leading * 2); paragraph(skills.map(s => s.name).join(' · ')); }
      continue;
    }
    const entries = profile[key].filter(e => selected.has(e.id)); if (!entries.length) continue;
    heading(LABELS[key], entryIntroHeight(entries[0]));
    for (const entry of entries) {
      ensure(Math.min(entryIntroHeight(entry), height - margin - bottom));
      paragraph(entry.title, { font: bold, after: 2 });
      if (entry.meta.length) paragraph(entry.meta.join(' | '), { fontSize: size - 1, lineHeight: Math.max(size + 1, leading - 1), color: muted, after: gap });
      for (const bullet of entry.bullets.filter(b => selected.has(b.id))) {
        const bulletHeight = wrap(bullet.text, normal, size, contentWidth - 12).length * leading;
        if (bulletHeight < height - margin - bottom) ensure(bulletHeight);
        paragraph(bullet.text, { indent: 12, bullet: true, after: style.spacing === 'tight' ? 2 : 4 });
      }
      y -= style.template === 'compact' ? 2 : gap;
    }
  }
  const pages = doc.getPages();
  if (pages.length > 1) pages.forEach((p, i) => p.drawText(`${i + 1} / ${pages.length}`, { x: width - margin - 28, y: 20, font: normal, size: 8, color: muted }));
  doc.setTitle(input.title.trim() || 'Resume'); doc.setCreator('Folio'); doc.setProducer('Folio / pdf-lib');
  return doc.save();
}




