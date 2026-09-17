// Custom fonts stay in this browser's IndexedDB, separate from resume snapshots.
const database = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('folio-fonts', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('fonts', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('Custom font storage is unavailable in this browser.'));
});
async function transaction(mode, action) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fonts', mode), request = action(tx.objectStore('fonts'));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Could not save custom fonts. Browser storage may be full.')); };
  });
}
export const readFonts = () => transaction('readonly', store => store.getAll());
export const saveFont = font => transaction('readwrite', store => store.put(font));
export const deleteFont = id => transaction('readwrite', store => store.delete(id));
export async function fontData(file) {
  if (!file || !/\.(ttf|otf)$/i.test(file.name)) throw new Error('Choose a static .ttf or .otf font file.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Each font file must be 2 MB or smaller.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
