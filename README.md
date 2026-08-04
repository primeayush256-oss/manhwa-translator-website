# Manhwa Translator AI — Marketing Website

A static marketing site for the "Manhwa Translator AI" Chrome extension. Plain HTML, CSS, and vanilla JavaScript — no build step, no framework, no dependencies to install.

## Structure

```
website/
├── index.html          Home page (hero, how it works, features, screenshots, pricing, FAQ)
├── privacy.html         Privacy Policy
├── terms.html            Terms & Conditions
├── contact.html          Contact page (opens Gmail compose in a new tab, no backend required)
├── style.css              All styles (design tokens at the top as CSS variables; logo is embedded here as a base64 data URI — see note below)
├── script.js              All interactivity (nav, reveal animations, tabs, FAQ, contact form)
├── assets/images/
│   ├── logo.png           Source logo file (256×256) — kept for reference/reuse, not linked directly by any page
│   ├── favicon-32.png     Source favicon file — kept for reference/reuse, not linked directly
│   ├── favicon-192.png    Source apple-touch-icon file — kept for reference/reuse, not linked directly
│   └── og-image.png       Social share preview image (1200×630), linked directly via Open Graph meta tags
└── README.md
```

**About the logo:** the navbar/footer logo and all favicon links are embedded directly as base64 data URIs (in `.brand-logo` in `style.css`, and in the `<link rel="icon">` tags in each page's `<head>`) rather than linked as external files. This was a deliberate fix — some hosting setups broke the external image path and showed a broken-image icon. Embedding the image data removes that failure mode entirely. The plain PNG files in `assets/images/` are kept as source copies (useful if you ever need a real image file — e.g. for a Chrome Web Store listing) but nothing on the live pages depends on them.

If you ever want to swap the logo for a new version: re-export it as a PNG, base64-encode it (`base64 -i newlogo.png`), and replace the data URI string in `.brand-logo` in `style.css` and in the three `<link>` tags per page.

## Before you publish

A few placeholders you'll want to swap for your real details:

- **Domain** — `https://manhwatranslator.ai/` is used in canonical URLs and Open Graph tags in the `<head>` of every page. Replace with your actual domain.
- **GitHub link** — the footer and contact page link to `https://github.com` as a placeholder. Point it at your real repository, or remove the links if you don't want a public repo linked.
- **Support email** — `primeayush256@gmail.com` is used throughout (footer, FAQ, Privacy, Terms, Contact). Make sure this inbox exists and is monitored before launch.
- **Legal pages** — the Privacy Policy and Terms & Conditions are written to match what's described in the product brief (Google Sign-In, Gemini API, Razorpay/UPI billing, Supabase backend). Have them reviewed by a lawyer familiar with Indian data protection and consumer law before relying on them for Razorpay verification or launch — this copy is a solid starting point, not legal advice.
- **Chrome Web Store link** — every "Add to Chrome" button currently points to `#`. Once your extension is published, update these `href`s to your Chrome Web Store listing URL (search the files for `href="#"` next to "Add to Chrome").

## Local preview

No build tools needed. From this folder, run any static file server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploying to Cloudflare Pages

**Option A — Git integration (recommended)**
1. Push this `website/` folder to a GitHub or GitLab repository.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repository. Framework preset: **None**. Build command: leave blank. Build output directory: `/` (or `website` if this folder isn't the repo root).
4. Deploy. Cloudflare will redeploy automatically on every push.

**Option B — Direct upload**
1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Upload assets**.
2. Drag the contents of this `website/` folder in (not the folder itself — its contents, so `index.html` sits at the root of the upload).
3. Deploy.

No environment variables, redirects, or server-side functions are required — this is a fully static site.

## Performance & accessibility notes

- Fonts (Plus Jakarta Sans, Inter, JetBrains Mono) load from Google Fonts via `@import` in `style.css`, with `preconnect` hints in each page's `<head>`.
- All animation respects `prefers-reduced-motion`.
- Interactive controls (nav toggle, FAQ accordion, screenshot tabs) are keyboard-operable and use `aria-expanded` / `aria-selected` where relevant.
- The contact form has no backend — on submit it opens **Gmail compose in a new browser tab** (`https://mail.google.com/mail/?view=cm&fs=1...`) with the recipient, subject, and message pre-filled from the form fields. It never uses `mailto:` and never launches a desktop mail client. Every other email mention on the site (Privacy, Terms, Contact info card) links the same way. If you'd rather collect submissions server-side, swap the handler in `script.js` (`#contactForm` submit listener) for a call to your form endpoint of choice.
