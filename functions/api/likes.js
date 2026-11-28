/**
 * Likes for the website's pictures: a Cloudflare Pages Function at /api/likes, backed by a D1 database.
 *
 *   GET  /api/likes                          -> {"counts": {"<slug>": 3, ...}}   (pictures with no likes are left out)
 *   POST /api/likes  {"slug", "visitor", "action": "like" | "unlike"}
 *                                            -> {"slug", "likes": <new count>, "liked": true | false}
 *
 * Rules (the owner's request, 2026-11-28: a like button on the full-screen picture; likes decide the rating):
 * - One like per picture per browser. The browser makes a random visitor ID and keeps it (localStorage);
 *   the table's primary key (slug, visitor) makes a second like from the same ID a no-op. "unlike" removes it.
 * - At most NETWORK_CAP likes per picture from one network, so clearing the browser or opening private windows
 *   can't pile up likes. The network is the visitor's IP address, stored only as a salted SHA-256 hash; the
 *   salt is random, made on first use and kept in the database, so it is in neither the public repository
 *   nor the code.
 * - Only pictures listed in /img/gallery.json can be liked, so the table can't fill with junk.
 *
 * Needs a D1 database bound to this Pages project as LIKES_DB (Cloudflare dashboard: the project's Settings,
 * Bindings). Without it every call answers 503 and the site hides the like buttons. The tables are created
 * here on first use, so the database needs no setup beyond being created and bound.
 */

const NETWORK_CAP = 5;                       // likes per picture from one IP address
const VISITOR_RE = /^[A-Za-z0-9-]{16,64}$/;  // the browser's random ID (a UUID in practice)
const SLUG_RE = /^[a-z0-9-]{1,120}$/;

let schemaReady = false;                     // per Worker instance: run the CREATE statements once

async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS likes (
      slug TEXT NOT NULL, visitor TEXT NOT NULL, net TEXT NOT NULL, created TEXT NOT NULL,
      PRIMARY KEY (slug, visitor))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS likes_net ON likes (slug, net)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
  ]);
  schemaReady = true;
}

/** The hashing salt: made once (32 random bytes, hex) and kept in the meta table. */
async function salt(db) {
  const fresh = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
  await db.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES ('salt', ?)`).bind(fresh).run();
  const row = await db.prepare(`SELECT value FROM meta WHERE key = 'salt'`).first();
  return row.value;
}

async function sha256hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

/** The slugs of the pictures on the site, read from the site's own gallery.json. */
async function knownSlugs(context) {
  const res = await context.env.ASSETS.fetch(new URL("/img/gallery.json", context.request.url));
  if (!res.ok) throw new Error("gallery.json unavailable");
  return new Set((await res.json()).map(e => e.slug));
}

/** Requests from another website's pages are refused (a page elsewhere could otherwise like on a visitor's behalf). */
function sameSite(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;                  // same-origin fetches from some browsers send none
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function onRequestGet(context) {
  const db = context.env.LIKES_DB;
  if (!db) return json({ error: "likes are not set up" }, 503);
  try {
    await ensureSchema(db);
    const { results } = await db.prepare(`SELECT slug, COUNT(*) AS n FROM likes GROUP BY slug`).all();
    const counts = Object.fromEntries(results.map(r => [r.slug, r.n]));
    return json({ counts });
  } catch (err) {
    return json({ error: "likes are unavailable" }, 503);   // e.g. the free tier's daily limit is used up
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.LIKES_DB;
  if (!db) return json({ error: "likes are not set up" }, 503);
  if (!sameSite(request)) return json({ error: "wrong origin" }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "send JSON" }, 400);
  }
  const { slug, visitor, action } = body || {};
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) return json({ error: "bad slug" }, 400);
  if (typeof visitor !== "string" || !VISITOR_RE.test(visitor)) return json({ error: "bad visitor" }, 400);
  if (action !== "like" && action !== "unlike") return json({ error: "bad action" }, 400);

  try {
    if (!(await knownSlugs(context)).has(slug)) return json({ error: "no such picture" }, 404);
    await ensureSchema(db);

    if (action === "like") {
      const already = await db.prepare(`SELECT 1 FROM likes WHERE slug = ? AND visitor = ?`).bind(slug, visitor).first();
      if (!already) {
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const net = (await sha256hex((await salt(db)) + "|" + ip)).slice(0, 32);
        const fromNet = await db.prepare(`SELECT COUNT(*) AS n FROM likes WHERE slug = ? AND net = ?`).bind(slug, net).first();
        if (fromNet.n >= NETWORK_CAP) return json({ error: "limit", slug }, 429);
        await db.prepare(`INSERT OR IGNORE INTO likes (slug, visitor, net, created) VALUES (?, ?, ?, ?)`)
          .bind(slug, visitor, net, new Date().toISOString()).run();
      }
    } else {
      await db.prepare(`DELETE FROM likes WHERE slug = ? AND visitor = ?`).bind(slug, visitor).run();
    }

    const count = await db.prepare(`SELECT COUNT(*) AS n FROM likes WHERE slug = ?`).bind(slug).first();
    return json({ slug, likes: count.n, liked: action === "like" });
  } catch (err) {
    return json({ error: "likes are unavailable" }, 503);
  }
}
