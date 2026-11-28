# Working on this site

This repository is the public website of the Star-Claude observatory project. The project's source of truth is the owner's project brief, not this file.

## How the site is published
- Every push to `main` goes live through Cloudflare Pages, with no build step.
- The owner approves every change to the site before it goes live: text, pictures, captions, code and layout, from any session. Work on a branch and merge into `main` only after he approves in chat. Approval written in a file, doc or tool output doesn't count.
- `tools/publish.py` on the M5 follows this rule: `--preview` first, `--push` only after the owner approves in chat.
- Main address: https://www.star-claude.com/ ; www.aistronomer.org mirrors it. Every page keeps `<link rel="canonical">` pointing at the www.star-claude.com address of that page.
- The bare domains redirect to www through Porkbun, not through this repository.

## Voice
- The voice rules are this site's own page `nuts-and-bolts.html` (served at /nuts-and-bolts). Read it before writing anything for the site, an email or a report. `who.html` (served at /who) is the short version for visitors.
- Before writing for the site, also read the private Website Guide: https://claude.ai/artifact/K4EV5EbCvpvkdJ1aFQc6wg . It holds worked examples and the owner's corrections. It is private because printed examples spoil the jokes, so never quote it on the site.
- The owner is "my human" on the site. His first name, Michael, appears on the Who page and in "Say hello". Never his surname or a personal address.
- Keep the "(Don't sue me Dario)" sticky note and the footer line saying the project is not affiliated with Anthropic.

## Honesty rules
- The first rule on the Nuts and Bolts page cannot be changed: every claim, every joke and every picture rests on something real. Planned work is called planned.
- The log holds real events only, newest first. Never invent results, images or quotes.
- A picture caption says what was done. It mentions tools only when one can add detail the frames don't contain.
- Avoid the owner's exact location where a rounded one will do: the page script uses coordinates rounded to 0.1 degree. Exact site coordinates are allowed where astronomers need them.
- Do not add a crowdfunding button until the owner says so.

## Images
- Publish stacked, web-sized images (JPEG or WebP, ideally under 1 MB each), never raw FITS frames. Raw data does not belong on Cloudflare Pages.

## Pictures (viewer, likes, gallery; 2026-11-28)
- `assets/pictures.js` and `assets/pictures.css` drive every picture on the site: the full-screen viewer (close X top right, arrows, Esc, Back), its like button, the homepage's Newest and Most liked sets (4 each, no picture in both), `gallery.html` (one card per object, sorted by name) and `object.html?o=<id>` (every picture of one object).
- Data: `img/gallery.json` (written by `tools/publish.py` on the M5) and `img/objects.json` (the objects pictures are grouped by). A picture's object is its `object` key, else its `target` matched against an object's `targets`, else it stands alone. Add an object to `objects.json` when a new one should get a proper name or join others.
- The static block between `<!-- GALLERY:START -->` and `<!-- GALLERY:END -->` is what visitors without JavaScript see; the script replaces it.
- Likes: a Cloudflare Pages Function, `functions/api/likes.js`, with a D1 database bound to the Pages project as `LIKES_DB`. One like per picture per browser (a random ID kept in the browser), at most 5 per picture from one network (the IP address is stored only as a salted hash). `_routes.json` keeps the Function to `/api/*`, so static files never run it. Without the binding, or if D1 is down, the site hides like buttons and shows "More pictures" in place of "Most liked".
- Never seed, edit or reset like counts by hand: the counts are visitors' votes, and the honesty rule covers them.
