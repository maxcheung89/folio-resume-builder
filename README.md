# Folio — Markdown resume builder

A private, local resume app. Keep a master Markdown profile, choose the content for a job, and download a typeset PDF with embedded fonts and selectable text.

## Download and run locally

**Requirements:** Node.js 20 or newer and a modern browser. Works on Windows, macOS, and Linux with bundled resume fonts. No API key or cloud account is needed.

1. Select **Code → Download ZIP** on GitHub and extract the ZIP, or clone this repository.
2. Install Node.js from https://nodejs.org and open a terminal in the extracted app folder.
3. Run:

```sh
npm install
npm start
```

4. Open **http://127.0.0.1:4173**. Keep the terminal open while using Folio; press Ctrl+C to stop it.

After the initial install, Windows users can double-click **Start Folio.cmd**. If using pnpm, run `pnpm install --frozen-lockfile` and `pnpm start` instead.

The app listens only on your computer. Set `PORT` to choose another port. Normal use works offline after package installation.

### macOS and Linux

Use the same `npm install` and `npm start` commands above. Version 1.0.1 bundles all resume fonts: no Microsoft Office, system font installation, or `FOLIO_FONT_DIR` setting is needed. Stop the old server before starting the updated copy, then refresh the browser. Keeping the same browser and port preserves your locally saved workspace.

### Troubleshooting

- **node/npm not recognized:** install Node.js, then open a new terminal.
- **Connection refused:** run `npm start` and keep its terminal open.
- **Port already in use:** close your earlier Folio server or choose another `PORT`.
- **Bundled resume fonts are missing:** extract the entire download, including `vendor/`, then restart the server. If you still see the old `FOLIO_FONT_DIR` error, the old server is running; stop it with Ctrl+C and start version 1.0.1.
- **Your work disappeared:** use the same browser and port; workspaces are stored in browser local storage. Export Markdown backups regularly.

## Workflow

The builder is organized into three tabs:

- **Content**: target role, optional job matching, collapsible job tags, and individual section selections.
- **Summary**: preview and apply a category draft, edit the active summary, or save a named reusable template. Templates are stored locally per profile. Every profile starts with its own master summary. Write and save reusable category templates using your own experience. Applying a draft changes only the summary, not selected experience.
- **Design**: four layouts (Modern, Classic, Executive, Compact), six bundled font families, 10/11/12 pt body sizes, four color themes, three spacing settings, and section-order arrows. Direct PDFs embed the bundled Lato, Carlito, PT Serif, Tinos, PT Sans, or IBM Plex Mono fonts on every operating system. Paper size is also set here. The preview renders the actual generated PDF pages using PDF.js; Download PDF saves those same bytes.

Saved resume versions preserve all design settings and section order. Older versions receive defaults for newly added settings. Section order also applies to Markdown exports. The complete master Markdown is not reordered. Summary templates remain available independently of saved resume versions.

On desktop, the controls and paper preview scroll independently, with export controls always visible. Smaller screens use a single column. Tight spacing reduces line, bullet, entry, and section gaps. Alignment is independent of layout and applies to your name, contact details, and section headings; body text remains left aligned. Summary templates, including category drafts, can be deleted and restored with **Restore last deleted template**. Deleting a template leaves your active summary unchanged; the original master summary remains available. Deletions persist per profile across reloads.

In **Content → Personal information**, choose whether to include your name and each contact or eligibility field. These choices affect the preview, PDF, and selected Markdown export, and are retained in saved versions. The master profile keeps all original fields. In **Design**, the Left/Center buttons beside Layout control alignment independently of the selected style.

1. Start with the clearly labeled example, or choose **Import Markdown**. Import opens the editor for review; click **Apply profile** to use it. Applying resets current selections to all content. Save a version first if you want to retain a tailored selection.
2. Enter the target role. Select individual skills, positions, projects, and achievement bullets. Open Summary to edit the introduction for this resume.
3. Optionally paste a job description and click **Select matching content**. Exact, case-insensitive skill matching selects relevant skills and matching achievements. This is a keyword helper, not an AI rewrite or hiring score. Review all sections yourself.
4. Choose a layout, font, size, spacing, alignment, and A4 or US Letter in Design.
5. **Download PDF** creates a file directly, without a print dialog. It embeds fonts, preserves selectable text, uses the selected point size and paper dimensions, wraps content, and adds page numbers for multipage resumes. Hidden personal fields and unselected bullets are excluded. The live preview displays that exact PDF, including fonts, wrapping, margins, and page breaks. After an edit, Download PDF stays disabled until the updated pages finish rendering. Older generation responses are discarded so they cannot replace your latest changes. To print, open the downloaded PDF in a PDF viewer.
6. Save named versions or download the selected resume as Markdown. Opening a saved version automatically backs up the outgoing work.

## Master Markdown format

### Tagged bullets

Append `<!-- tags: network, cyber -->` to a work, project, or education bullet. **Build by job tags** selects matching bullets across entries; choose Any for a union or All for an intersection. Nonmatching work and project entries are omitted, while education credentials remain. Skills and certifications stay manually selectable. No matches leave the current selection intact. Tags and general HTML comments stay in the master file but are excluded from resume exports. `## Certifications in Progress` keeps pending credentials separate from earned certifications.

See [sample.md](sample.md) for a complete fictional example.

- `# Your Name` identifies you.
- `## Basic Info` holds contact lines, optionally written `- Email: value`.
- `## Summary` contains introductory paragraphs.
- `## Skills` accepts comma- or semicolon-separated skills, optionally grouped with `Languages:` or `Tools:`.
- `## Experience`, `## Projects`, `## Education`, and `## Certifications` hold `### Entry title | Organization` entries. Plain lines below an entry are dates or metadata; bullets are separately selectable achievements.
- Common heading variants including Work Experience, Technical Skills, and Certification are accepted. Unknown sections are reported instead of silently incorporated.
- Basic bold, inline code, and Markdown links become plain resume text. Arbitrary HTML is displayed as text and cannot execute. Tables, images, embedded HTML layouts, and arbitrary nested Markdown are not supported.

## Privacy and storage

Profile data, editor drafts, and saved versions live in this browser's local storage at the app's address. For direct PDF export, the browser sends the current resume snapshot to the local Node server on your computer. The server generates the PDF in memory and returns it without saving the resume or logging its contents. Preview refreshes use this same local endpoint. Nothing is sent to an external PDF service. There are no analytics, remote fonts, or AI services. Initial package installation needs internet access; normal operation and PDF generation work offline. Local storage is not encrypted. Clearing browser data removes the workspace, and changing the port or browser uses separate storage. Download Markdown backups for important work; exports do not include all saved versions. Avoid editing the same workspace in multiple tabs concurrently.

## Development

Built with JavaScript, CSS, Node.js, pdf-lib, and fontkit. This keeps setup small and portable. It can later be packaged into a desktop app with Tauri if a native installer is needed.

```sh
node --test
```

PDF font pairs are read relative to the app from `vendor/`, independent of the operating system and working directory. Lato, Carlito, PT Serif, Tinos, PT Sans, and IBM Plex Mono include regular/bold files and SIL Open Font License notices. Existing saved font choices migrate in order: Arial to Lato, Calibri to Carlito, Georgia to PT Serif, and Times New Roman to Tinos. Their typography may differ from version 1.0.0, but the live preview and downloaded PDF always match. `FOLIO_FONT_DIR` is no longer used.

Files: `pdf-export.mjs` typesets and paginates direct PDFs, `profile.js` parses and matches content, `app.js` manages local state and the UI, `style.css` defines the app and print layouts, and `server.mjs` serves an explicit allowlist of static files. Tests cover parsing, heading aliases, keyword boundaries, selections, saved appearance defaults, PDF font embedding, page dimensions, and multipage output.

## Exact PDF preview

`pdf-preview.js` renders the generated document with a locally bundled PDF.js 5.6.205 worker (`vendor/`, Apache 2.0 license included). It retains the original PDF Blob and uses it for downloads without requesting a second export. Edits are debounced for 400 ms; stale responses are discarded, failed previews offer a retry, and downloads are disabled until the current preview is ready. Preview canvases are display-only; the downloaded document retains embedded fonts and selectable text.



## Fonts and AI-assisted Markdown (v1.0.2)

Six bundled fonts are available: Lato, Carlito, PT Serif, Tinos, PT Sans, and IBM Plex Mono. Complete font embedding fixes Carlito composite glyphs that were corrupted by subsetting. PDFs can be larger as a result. Optional ligatures are disabled to keep copied and extracted text accurate.

In **Design → Add your own font**, select a static TTF or OTF regular font and an optional bold font (2 MB maximum each). Folio validates the font against the current resume before saving it. Without a bold file, the regular face is used for headings. Variable fonts, TTC collections, and WOFF web fonts are unsupported. Fonts are stored in this browser's IndexedDB, independently of resume versions, and sent only to the local Folio server. They are not included in Markdown backups or synchronized to other browsers. Saved versions remember their font choice; if a custom font is unavailable, Folio announces a fallback to Lato. Keep your original font files to re-import on another browser. Only use fonts you are licensed to embed.

Use **Master profile → Copy AI Markdown prompt** or [download the prompt](AI-MARKDOWN-PROMPT.md). Paste it into your AI tool with your career notes or resume. The prompt specifies Folio's supported headings, entry metadata, bullet tags, and factuality rules. Review the generated file before importing it. Folio does not send your profile to any AI service.

