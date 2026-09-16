import test from 'node:test';
import assert from 'node:assert/strict';
import { PdfPreview } from '../pdf-preview.js';

function setup(t) {
  const element = () => ({ children: [], classList: { add() {}, remove() {} }, setAttribute() {}, append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; }, addEventListener() {}, getContext() { return {}; }, click() {} });
  const previous = globalThis.document;
  globalThis.document = { createElement: element, createDocumentFragment: element };
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const loadPdf = async () => ({ destroy: async () => {}, promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getViewport: ({scale}) => ({width:600*scale,height:800*scale}), render: () => ({promise:Promise.resolve()}), getTextContent: async () => ({items:[{str:'Visible PDF content'}]}), cleanup() {} }) }) });
  return new PdfPreview({container:element(),status:element(),downloadButton:element(),loadPdf});
}
const response = blob => ({ok:true,blob:async()=>blob});
test('download uses the identical Blob used to render, without another request', async t => {
  const preview = setup(t), blob = new Blob(['exact pdf bytes'], {type:'application/pdf'});
  const fetch = t.mock.method(globalThis, 'fetch', async () => response(blob));
  let downloaded;
  t.mock.method(URL,'createObjectURL', value => { downloaded=value; return 'blob:test'; });
  preview.update({title:'A'}); clearTimeout(preview.timer);
  assert.equal(preview.downloadButton.disabled,true); assert.equal(preview.download('test.pdf'),false);
  await preview.render({title:'A'},preview.revision);
  assert.equal(preview.downloadButton.disabled,false);
  assert.equal(preview.download('test.pdf'),true); assert.equal(downloaded,blob);
  assert.equal(fetch.mock.callCount(),1);
});
test('an older response cannot replace the newest preview or download', async t => {
  const preview = setup(t), oldBlob=new Blob(['old'],{type:'application/pdf'}), newBlob=new Blob(['new'],{type:'application/pdf'});
  let release;
  t.mock.method(globalThis,'fetch', async (_, options) => JSON.parse(options.body).title === 'old' ? new Promise(resolve=>{release=resolve;}) : response(newBlob));
  preview.update({title:'old'}); clearTimeout(preview.timer); const oldRequest=preview.render({title:'old'},preview.revision);
  preview.update({title:'new'}); clearTimeout(preview.timer); await preview.render({title:'new'},preview.revision);
  release(response(oldBlob)); await oldRequest;
  assert.equal(preview.blob,newBlob); assert.equal(preview.downloadButton.disabled,false);
});
test('failed updates disable stale downloads and clear the old pages', async t => {
  const preview=setup(t); preview.blob=new Blob(['old']);
  t.mock.method(globalThis,'fetch',async()=>{throw new Error('Server unavailable');});
  preview.update({title:'new'}); clearTimeout(preview.timer); await preview.render({title:'new'},preview.revision);
  assert.equal(preview.blob,null); assert.equal(preview.download('stale.pdf'),false);
  assert.equal(preview.downloadButton.disabled,true); assert.equal(preview.status.textContent,'Server unavailable');
});
