async function loadDocument(data) {
  const { getDocument, GlobalWorkerOptions } = await import('./vendor/pdf.min.mjs');
  GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs';
  return getDocument({ data, disableFontFace: true, useSystemFonts: false, isEvalSupported: false });
}

// A completed preview and its download share one Blob. No second export request.
export class PdfPreview {
  constructor({ container, status, downloadButton, loadPdf = loadDocument }) {
    this.container = container; this.status = status; this.downloadButton = downloadButton;
    this.loadPdf = loadPdf;
    this.revision = 0; this.blob = null; this.key = null;
  }
  update(snapshot) {
    const key = JSON.stringify(snapshot);
    if (key === this.key) return;
    this.key = key;
    const revision = ++this.revision;
    clearTimeout(this.timer); this.controller?.abort();
    this.blob = null; this.downloadButton.disabled = true;
    this.status.textContent = 'Updating PDF preview…';
    this.container.setAttribute('aria-busy', 'true');
    this.container.classList.add('pdf-updating');
    this.timer = setTimeout(() => this.render(snapshot, revision), 400);
  }
  async render(snapshot, revision) {
    const controller = new AbortController(); this.controller = controller;
    let documentTask;
    try {
      const response = await fetch('/api/export-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot), signal: controller.signal });
      if (!response.ok) {
        let message = 'PDF preview unavailable. Check that the Folio server is running.';
        try { message = (await response.json()).error || message; } catch {}
        throw new Error(message);
      }
      const blob = await response.blob();
      if (!blob.type.includes('application/pdf')) throw new Error('The server did not return a PDF. Restart Folio and retry.');
      if (revision !== this.revision) return;
      // Give PDF.js its own byte buffer; retain the original Blob for download.
      documentTask = await this.loadPdf(new Uint8Array(await blob.arrayBuffer()));
      const pdf = await documentTask.promise;
      const fragment = document.createDocumentFragment();
      for (let number = 1; number <= pdf.numPages; number++) {
        if (revision !== this.revision) return;
        const page = await pdf.getPage(number);
        const unscaled = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 1500 / unscaled.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        canvas.setAttribute('aria-hidden', 'true');
        const figure = document.createElement('figure'); figure.className = 'pdf-page';
        figure.append(canvas);
        const caption = document.createElement('figcaption'); caption.textContent = `Page ${number} of ${pdf.numPages}`;
        figure.append(caption);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const text = await page.getTextContent();
        const accessibleText = document.createElement('div'); accessibleText.className = 'sr-only pdf-page-text';
        accessibleText.textContent = text.items.map(item => item.str || '').join(' '); figure.append(accessibleText);
        fragment.append(figure); page.cleanup();
      }
      if (revision !== this.revision) return;
      this.container.replaceChildren(fragment);
      this.blob = blob;
      this.status.textContent = `${pdf.numPages} ${pdf.numPages === 1 ? 'page' : 'pages'} · Preview matches download`;
      this.downloadButton.disabled = false;
    } catch (error) {
      if (revision !== this.revision || error.name === 'AbortError') return;
      this.container.replaceChildren();
      this.status.textContent = error.message;
      const retry = document.createElement('button'); retry.className = 'button secondary'; retry.textContent = 'Retry PDF preview';
      retry.addEventListener('click', () => { this.key = null; this.update(snapshot); });
      this.container.append(retry);
    } finally {
      await documentTask?.destroy();
      if (revision === this.revision) { this.container.setAttribute('aria-busy', 'false'); this.container.classList.remove('pdf-updating'); }
    }
  }
  download(filename) {
    if (!this.blob) return false;
    const url = URL.createObjectURL(this.blob), link = document.createElement('a');
    link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
  }
}
