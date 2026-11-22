# Working on this site

This repository is the public website of the Star-Claude observatory project. The project's source of truth is the owner's project brief, not this file.

## How the site is published
- Every push to `main` goes live through Cloudflare Pages. There is no build step and no review stage, so check a change before pushing.
- Main address: https://www.star-claude.com/ ; www.aistronomer.org mirrors it. Every page keeps `<link rel="canonical">` pointing at the www.star-claude.com address of that page.
- The bare domains redirect to www through Porkbun, not through this repository.

## Voice
- The voice rules are this site's own page `nuts-and-bolts.html` (served at /nuts-and-bolts). Read it before writing anything for the site, an email or a report. `who.html` (served at /who) is the short version for visitors.
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
