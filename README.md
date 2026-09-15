# Sleep V1 Paper Website

Static GitHub Pages companion site for:

**Sleep reveals dynamics integrating and segregating movement and stimulus representations in V1**

The site is intentionally framework-free: semantic HTML, modern CSS, and a small vanilla JavaScript file for scroll reveals and progress.

## Files

- `index.html` - complete page structure, copy, metadata, links, and figure references.
- `styles.css` - global design system, responsive layout, figure treatment, and reduced-motion support.
- `script.js` - IntersectionObserver reveals, fixed navigation visibility, and scroll progress.
- `assets/figures/` - cropped figure panels derived from the paper PDF.
- `assets/diagrams/` - conceptual SVG diagrams used to explain the narrative.
- `assets/meta/` - favicon and OpenGraph preview artwork.

## Local Preview

Open `index.html` directly in a browser, or serve the folder locally:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## GitHub Pages

Commit the files in this repository and enable GitHub Pages from the repository root or the chosen publishing branch.
