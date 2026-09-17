import fontkit from '@pdf-lib/fontkit';

export function decodeCustomFont(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 2800000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw new Error('Invalid custom font data. Choose a static TTF or OTF file up to 2 MB.');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > 2 * 1024 * 1024 || bytes.length < 12 ||
      !(bytes.readUInt32BE(0) === 0x00010000 || bytes.subarray(0, 4).toString() === 'OTTO'))
    throw new Error('Use a static TTF or OTF font, not a collection, web font, or other file.');
  try {
    const font = fontkit.create(bytes);
    if (Object.keys(font.variationAxes || {}).length) throw new Error('variable');
    if (!font.characterSet?.length) throw new Error('empty');
  } catch (error) {
    throw new Error(error.message === 'variable' ? 'Variable fonts are not supported. Download a static regular/bold font pair.' : 'This font is damaged or unsupported. Choose another static TTF or OTF file.');
  }
  return bytes;
}
