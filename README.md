# Academic website

A dependency-free static academic website. The browser reads `data/publications.bib` directly, so publication cards update whenever that file changes.

## Edit content

1. Replace or edit `data/publications.bib` with the CV bibliography. Use `keywords = {mainwork}` for lead works and optional `sortkey = {M01}` / `M02` / … for the curated order.
2. Add a matching entry in `data/work-notes.js` when a work needs a human-written summary and contribution statement. Entries without notes remain visible with a clear placeholder.
3. Open `index.html` using a lightweight local web server. For example, in VS Code, use the Live Server extension; no installation or build is otherwise needed.

## Publish with GitHub Pages

1. Create an empty GitHub repository, then upload this folder's contents to its root.
2. In the repository, open **Settings → Pages**, choose **GitHub Actions** as the source, and push the included workflow.
3. After the Actions run succeeds, the site is available at `https://<GitHub-user>.github.io/<repository-name>/`.

Every future change to the bibliography, work notes, CSS, or page content is published by committing and pushing it to the `main` branch.

## Included files

- `index.html` — page structure and research narrative
- `styles.css` — responsive visual design
- `app.js` — BibTeX loading, card generation, highlighting Shengda Zhao, and sorting
- `data/publications.bib` — publication data source
- `data/work-notes.js` — concise research summaries and contribution statements
