# Good Hands Homes — landing page

A single static landing page aimed at property managers we're trying to sign.
No build step, no dependencies.

## Run it

**Easiest:** just open `index.html` in a browser.

**Or serve it** (nicer for live-reload while editing):

```bash
cd landing
python3 -m http.server 5173
# → http://localhost:5173
```

## Files

- `index.html` — markup & copy
- `styles.css` — all styling (palette + type vars at the top)
- `script.js` — scroll reveals, count-up stats, nav state, CTA stub

## Design notes

- Palette / fonts live as CSS variables at the top of `styles.css` (`:root`).
- Fonts: **Fraunces** (display serif) + **Hanken Grotesk** (body), via Google Fonts.
- Sections: Hero → marquee → What we do → How it works → Results → CTA → Footer.
- The CTA form submits to **Web3Forms** (free). To turn it on:
  1. Go to https://web3forms.com, enter the email where you want leads delivered, and copy the **access key** they email you.
  2. In `index.html`, replace `YOUR_WEB3FORMS_ACCESS_KEY` (in the `#join-form`) with that key.
  3. That's it — submissions arrive in your inbox. Honeypot spam protection is built in.
