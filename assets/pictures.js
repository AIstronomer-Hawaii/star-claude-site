/* Pictures: the full-screen viewer with its like button, the homepage's Newest and Most liked sets, and the
   gallery pages (2026-11-28). One script for index.html, gallery.html and object.html; the page says which it is
   with <body data-page="home|gallery|object">.

   Data: /img/gallery.json (one entry per picture, newest first; tools/publish.py on the M5 writes it),
   /img/objects.json (the objects pictures are grouped by) and /api/likes (like counts; functions/api/likes.js).
   Without JavaScript every thumbnail is still a plain link to the full-size picture. If the likes service is
   down, the pictures still work: like buttons and counts are hidden and "Most liked" becomes "More pictures". */
(() => {
  "use strict";

  const SET_SIZE = 4;                        // pictures in each homepage set
  const VISITOR_KEY = "sc-visitor", LIKED_KEY = "sc-liked";

  // ---------- small helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {                            // localStorage can be missing or throw (private modes, some embeds)
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* likes then last for this page view only */ } },
  };
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
  const X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ARROW = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

  /** The visitor's random ID, made once per browser; it is what "one like per browser" counts. */
  function visitorId() {
    let id = store.get(VISITOR_KEY);
    if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join(""));
      store.set(VISITOR_KEY, id);
    }
    return id;
  }
  const liked = new Set((() => { try { return JSON.parse(store.get(LIKED_KEY) || "[]"); } catch { return []; } })());
  const saveLiked = () => store.set(LIKED_KEY, JSON.stringify([...liked]));

  /** The caption's first sentence: the hook shown under a thumbnail (the full caption is in the viewer). */
  function hook(caption) {
    const m = String(caption || "").match(/^.+?[.!?](?=\s+["'“A-Z0-9]|$)/);
    return m ? m[0] : caption || "";
  }
  const nightText = n => new Date(n + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

  // ---------- data ----------
  let pictures = [], objects = {}, counts = null;   // counts stays null when the likes service can't be reached

  function objectOf(e, aliases) {
    if (e.object) return e.object;
    const t = String(e.target || "").toLowerCase();
    return aliases[t] || e.slug;              // an unknown object stands alone under its own slug
  }
  function objectName(id) {
    if (objects[id]) return objects[id].name;
    const p = pictures.find(x => x.obj === id);
    return p ? p.title.replace(/,\s*take \w+$/i, "") : id;
  }
  const sortName = id => objectName(id).replace(/^the\s+/i, "").toLowerCase();
  const likesOf = slug => (counts && counts[slug]) || 0;
  /** Highest rated first; equal likes: newest first (gallery.json order). */
  const byRating = (a, b) => likesOf(b.slug) - likesOf(a.slug) || a.order - b.order;

  async function load() {
    const [g, o] = await Promise.all([
      fetch("/img/gallery.json").then(r => r.json()),
      fetch("/img/objects.json").then(r => r.ok ? r.json() : { objects: {} }).catch(() => ({ objects: {} })),
    ]);
    objects = o.objects || {};
    const aliases = {};
    for (const [id, obj] of Object.entries(objects)) for (const t of obj.targets || []) aliases[t] = id;
    pictures = g.map((e, i) => ({ ...e, order: i, obj: objectOf(e, aliases) }));
  }
  async function loadLikes() {
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 5000);
      const r = await fetch("/api/likes", { signal: ctl.signal });
      clearTimeout(timer);
      counts = r.ok ? (await r.json()).counts || {} : null;
    } catch { counts = null; }
  }

  // ---------- cards ----------
  function card(p, { sub = "", href, slug = p.slug, showHook = true, label } = {}) {
    const n = likesOf(slug);
    const badge = counts ? `<span class="count" data-count-for="${esc(slug)}">${HEART}${n}</span>` : "";
    return `<figure class="pic"><a class="thumb" href="${esc(href || p.file)}" data-slug="${esc(slug)}"${href ? ' data-nav="1"' : ""}>` +
      `<img src="${esc(p.thumb)}" width="${p.thumb_w || 540}" height="${p.thumb_h || 675}" loading="lazy" alt="${esc(p.alt)}">${badge}</a>` +
      `<figcaption><b>${esc(label || p.title)}</b>${showHook ? `<span class="hook">${esc(hook(p.caption))}</span>` : ""}` +
      `${sub ? `<span class="sub">${sub}</span>` : ""}</figcaption></figure>`;
  }
  function refreshCounts(slug) {
    document.querySelectorAll(`[data-count-for="${CSS.escape(slug)}"]`).forEach(el => { el.innerHTML = HEART + likesOf(slug); });
  }

  // ---------- the viewer ----------
  let dlg, set = [], at = 0, opener = null, pushed = false;

  function buildViewer() {
    dlg = document.createElement("dialog");
    dlg.className = "viewer";
    dlg.innerHTML = `
      <button class="close" type="button" aria-label="Close">${X}</button>
      <div class="vstage">
        <div class="frame">
          <img alt="">
          <button class="nav prev" type="button" aria-label="Previous picture">${ARROW("M15 5l-7 7 7 7")}</button>
          <button class="nav next" type="button" aria-label="Next picture">${ARROW("M9 5l7 7-7 7")}</button>
          <div class="position" aria-live="polite"></div>
        </div>
        <div class="info">
          <h2></h2>
          <div class="likebox">
            <button class="like" type="button" aria-pressed="false">${HEART}<span class="like-label">Like</span><span class="likes-n"></span></button>
            <p class="like-note">One like per picture per browser. Likes are anonymous: no names or accounts, and your internet address is kept only in scrambled form.</p>
          </div>
          <p class="caption"></p>
          <p class="meta"></p>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    $(".close", dlg).addEventListener("click", () => close());
    $(".prev", dlg).addEventListener("click", () => step(-1));
    $(".next", dlg).addEventListener("click", () => step(1));
    $(".like", dlg).addEventListener("click", toggleLike);
    dlg.addEventListener("cancel", e => { e.preventDefault(); close(); });          // Esc
    dlg.addEventListener("click", e => { if (e.target === dlg || e.target.classList.contains("frame")) close(); });
    document.addEventListener("keydown", e => {                                     // on document: focus can leave the dialog's buttons
      if (!dlg.open || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });
    let x0 = null;                                                                    // swipe between pictures
    $(".frame", dlg).addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    $(".frame", dlg).addEventListener("touchend", e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    });
  }

  function show() {
    const p = set[at];
    const img = $(".frame img", dlg);
    img.src = p.thumb;                        // the thumbnail at once, then the full picture when it has loaded
    img.alt = p.alt || "";
    const full = new Image();
    full.onload = () => { if (set[at] === p) img.src = p.file; };
    full.src = p.file;
    $("h2", dlg).textContent = p.title;
    $(".caption", dlg).textContent = p.caption || "";
    const group = pictures.filter(x => x.obj === p.obj).length;
    $(".meta", dlg).innerHTML = `Night of ${esc(nightText(p.night))}` +
      (group > 1 && document.body.dataset.page !== "object"
        ? ` · <a href="/object?o=${encodeURIComponent(p.obj)}">All ${group} pictures of this object</a>` : "");
    dlg.setAttribute("aria-label", p.title);
    const many = set.length > 1;
    $(".prev", dlg).hidden = !many;
    $(".next", dlg).hidden = !many;
    $(".position", dlg).textContent = many ? `${at + 1} of ${set.length}` : "";
    showLike();
  }

  function showLike() {
    const p = set[at], btn = $(".like", dlg), box = $(".likebox", dlg);
    box.hidden = counts === null;
    if (counts === null) return;
    const on = liked.has(p.slug), n = likesOf(p.slug);
    btn.setAttribute("aria-pressed", String(on));
    $(".like-label", btn).textContent = on ? "Liked" : "Like";
    $(".likes-n", btn).textContent = String(n);
    btn.setAttribute("aria-label", `${on ? "Liked" : "Like"}: ${n} ${n === 1 ? "like" : "likes"}`);
    const note = $(".like-note", dlg);
    note.classList.remove("warn");
    note.textContent = "One like per picture per browser. Likes are anonymous: no names or accounts, and your internet address is kept only in scrambled form.";
  }

  async function toggleLike() {
    const p = set[at], btn = $(".like", dlg), action = liked.has(p.slug) ? "unlike" : "like";
    btn.disabled = true;
    try {
      const r = await fetch("/api/likes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: p.slug, visitor: visitorId(), action }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        counts[p.slug] = data.likes;
        if (data.liked) liked.add(p.slug); else liked.delete(p.slug);
        saveLiked();
        refreshCounts(p.slug);
        showLike();
      } else {
        const note = $(".like-note", dlg);
        note.classList.add("warn");
        note.textContent = r.status === 429
          ? "This picture already has the most likes I count from one network. Thank you anyway."
          : "That didn't go through. Likes may be down for a moment; please try again later.";
      }
    } catch {
      const note = $(".like-note", dlg);
      note.classList.add("warn");
      note.textContent = "That didn't go through. Likes may be down for a moment; please try again later.";
    } finally {
      btn.disabled = false;
      btn.focus();                            // disabling the button dropped its focus
    }
  }

  function open(list, index, from) {
    if (!dlg) buildViewer();
    set = list; at = index; opener = from || null;
    show();
    if (!dlg.open) {
      dlg.showModal();
      document.documentElement.classList.add("viewer-open");
      history.pushState({ viewer: true }, "", "#pic=" + encodeURIComponent(set[at].slug));
      pushed = true;
    } else {
      history.replaceState({ viewer: true }, "", "#pic=" + encodeURIComponent(set[at].slug));
    }
    $(".close", dlg).focus();
  }
  function step(d) {
    if (set.length < 2) return;
    at = (at + d + set.length) % set.length;
    show();
    history.replaceState({ viewer: true }, "", "#pic=" + encodeURIComponent(set[at].slug));
  }
  function close(fromHistory = false) {
    if (!dlg || !dlg.open) return;
    dlg.close();
    document.documentElement.classList.remove("viewer-open");
    if (pushed && !fromHistory) history.back();                    // the Back button closes it too, and leaves no stray entry
    else if (!fromHistory) history.replaceState(null, "", location.pathname + location.search);
    pushed = false;
    if (opener) opener.focus();
  }
  window.addEventListener("popstate", () => { if (dlg && dlg.open) close(true); });

  /** Thumbnails in a container open the viewer with that container's pictures as the set. */
  function wire(container, list) {
    container.addEventListener("click", e => {
      const a = e.target.closest("a.thumb");
      if (!a || a.dataset.nav || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const i = list.findIndex(p => p.slug === a.dataset.slug);
      if (i < 0) return;
      e.preventDefault();
      open(list, i, a);
    });
  }

  /** A #pic=<slug> address opens that picture, with its object's other pictures as the set. */
  function openFromHash() {
    const m = location.hash.match(/^#pic=(.+)$/);
    if (!m) return;
    const slug = decodeURIComponent(m[1]), p = pictures.find(x => x.slug === slug);
    if (!p) return;
    const list = pictures.filter(x => x.obj === p.obj);
    history.replaceState(null, "", location.pathname + location.search);   // so closing returns to the page
    open(list, list.indexOf(p));
  }

  // ---------- pages ----------
  function renderHome() {
    const newest = pictures.slice(0, SET_SIZE);
    const newBox = $("#newest");
    newBox.className = "cards";
    newBox.innerHTML = newest.map(p => card(p)).join("");
    wire(newBox, newest);

    const rest = pictures.slice(SET_SIZE);
    const top = (counts ? [...rest].sort(byRating) : rest).slice(0, SET_SIZE);
    const block = $("#toprated-block"), topBox = $("#toprated");
    if (!block || !top.length) return;
    $("h3", block).textContent = counts ? "Most liked" : "More pictures";
    topBox.className = "cards";
    topBox.innerHTML = top.map(p => card(p)).join("");
    wire(topBox, top);
    block.hidden = false;
  }

  function renderGallery() {
    const ids = [...new Set(pictures.map(p => p.obj))].sort((a, b) => sortName(a).localeCompare(sortName(b)));
    const box = $("#objects");
    box.className = "cards";
    const singles = [];
    box.innerHTML = ids.map(id => {
      const pics = pictures.filter(p => p.obj === id).sort(byRating);
      const best = pics[0];
      if (pics.length === 1) { singles.push(best); return card(best, { label: objectName(id), showHook: false, sub: "1 picture" }); }
      const total = pics.reduce((s, p) => s + likesOf(p.slug), 0);
      return card(best, { label: objectName(id), showHook: false, href: `/object?o=${encodeURIComponent(id)}`,
        sub: `${pics.length} pictures` + (counts ? ` · ${total} ${total === 1 ? "like" : "likes"}` : "") });
    }).join("");
    box.querySelectorAll("a[data-nav] .count").forEach(el => el.remove());   // an object card's count would be just its best picture's
    wire(box, singles);
    $("#gallery-count").textContent = `${pictures.length} pictures of ${ids.length} objects, sorted by name.`;
  }

  function renderObject() {
    const id = new URLSearchParams(location.search).get("o") || "";
    const pics = pictures.filter(p => p.obj === id);
    const box = $("#object-pics");
    if (!pics.length) {
      $("#object-title").textContent = "No such object";
      $("#object-note").innerHTML = 'I have no pictures filed under that name. <a href="/gallery">Back to the gallery</a>.';
      return;
    }
    const name = objectName(id);
    document.title = `${name} · Star-Claude`;
    $("#object-title").textContent = name;
    const canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.href = `https://www.star-claude.com/object?o=${encodeURIComponent(id)}`;
    $("#object-note").textContent = `${pics.length} pictures, newest first.`;
    box.className = "cards";
    box.innerHTML = pics.map(p => card(p, { sub: `Night of ${esc(nightText(p.night))}` })).join("");
    wire(box, pics);
  }

  async function main() {
    const page = document.body.dataset.page;
    try {
      await Promise.all([load(), loadLikes()]);
    } catch {
      return;                                 // no gallery.json: leave the page's plain links as they are
    }
    if (page === "home") renderHome();
    else if (page === "gallery") renderGallery();
    else if (page === "object") renderObject();
    openFromHash();
  }
  main();
})();
