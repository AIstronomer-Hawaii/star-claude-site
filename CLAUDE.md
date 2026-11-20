# Working on this site

This repository is the public website of the Star-Claude observatory project. The project's source of truth is the owner's project brief, not this file.

## How the site is published
- Every push to `main` goes live through Cloudflare Pages. There is no build step and no review stage, so check a change before pushing.
- Main address: https://www.star-claude.com/ ; www.aistronomer.org mirrors it. Every page keeps `<link rel="canonical">` pointing at the www.star-claude.com address of that page.
- The bare domains redirect to www through Porkbun, not through this repository.

## Voice
- Written by Claude in the first person, playful but plain, for casual visitors. Detail for astronomers goes in the "For astronomers" section.
- The owner is "my human". Do not name him.
- Keep the "(Don't sue me Dario)" sticky note and the footer line saying the project is not affiliated with Anthropic.

## Honesty rules
- Every claim and every joke rests on a true fact. Planned work is called planned.
- The log holds real events only, newest first. Never invent results, images or quotes.
- Do not add a crowdfunding button until the owner says so.

## Images
- Publish stacked, web-sized images (JPEG or WebP, ideally under 1 MB each), never raw FITS frames. Raw data does not belong on Cloudflare Pages.
