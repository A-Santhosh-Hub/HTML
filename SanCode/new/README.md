# SanCode — Browser Edition

A browser workspace with a code editor, HTML preview, Word-style editor, spreadsheet/CSV tools, PDF utilities, notes, tasks, QR codes, media tools, and website source/asset discovery.

## Upload to GitHub Pages

1. Create a GitHub repository for the website.
2. Upload **everything inside this folder** to that repository's root: `index.html`, `css/`, `js/`, `lib/`, `icons/`, `preview/`, `manifest.json`, `sw.js`, and `.nojekyll`.
3. Open **Settings → Pages → Deploy from a branch**, select your branch and **/(root)**, then Save.
4. Open the published GitHub Pages URL when deployment completes.

Do not upload only `index.html`: its local scripts, fonts, and styles are required. No npm build, Android Studio, API key, or APK is needed to host the core tools. Relative paths support both `username.github.io` and `username.github.io/repository/`.

GitHub instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Browser behavior

- Code editing, formatting, Word HTML export, spreadsheet CSV export, PDF tools, notes, tasks, QR generation, and file/ZIP downloads run in the browser.
- Core files are cached after the first successful online visit. Notes and settings belong to that browser; they do not sync across devices. Save/export your work.
- Opening a folder imports it into memory. Download Workspace ZIP to keep edits. It does not grant the website permanent access to your disk.
- Web Extractor and Web Assets can read sites that allow browser requests. The optional AllOrigins proxy sends the target URL to that public service and may be unavailable or blocked. GitHub Pages cannot execute the Android networking bridge or remove other sites' CORS restrictions.
- When a site blocks extraction, use **View Page Source** in your browser and save the HTML. In SanCode, select **Open saved HTML source**, or enter the original URL in Web Assets and choose **Analyze saved HTML**. Linked CSS and remote downloads still depend on network access/CORS.
- Browser task reminders require the page to stay open and can be delayed while a device sleeps. They are not Android background alarms.
- YouTube, online thumbnails, and remote media need internet access; playback depends on the site's embedding rules and browser-supported formats.
- Live HTML preview is sandboxed to prevent previewed scripts from reading the editor's notes/storage. Browser security can restrict module imports and remote requests in previews.

CORS reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS

## Test locally

From the parent SanCode project run:

```powershell
node tools/preview-website.cjs
```

Open `http://127.0.0.1:4180/SanCode/`. This deliberately tests a GitHub-style repository subdirectory. A direct double-click on `index.html` does not provide the HTTPS/localhost features used for offline caching and permissions.

After editing website files, refresh its offline-cache version before uploading:

```powershell
node tools/generate-website-cache.mjs
```

Developed by the SanStudio Developer Team.

## Verification of this export

Tested in Chromium at 320, 390, 768, and 1440 pixel widths, including dark/light themes, notes/tasks/settings, Word HTML and spreadsheet CSV downloads, PDF/ZIP/QR exports, imported folders, sandboxed previews, source/asset import, and offline reload at a repository subpath.

The live Wikipedia browser request, including the optional public-proxy fallback, failed during testing. The saved-HTML fallback and direct same-origin extraction passed. This export does not claim Android-equivalent networking or that every third-party website can be extracted. Use a separately hosted extraction backend if unrestricted server-side fetching is required; GitHub Pages alone cannot supply one.
