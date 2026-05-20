(function site() {
  const decryptCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-/<>{}[]";
  const decryptDurationMs = 800;
  let activeDecrypt = null;
  let bootId = 0;

  function randomChar() {
    return decryptCharset[Math.floor(Math.random() * decryptCharset.length)];
  }

  function randomCharDifferentFrom(target) {
    if (!target || /\s/.test(target)) return target;

    let next = randomChar();
    while (next === target) next = randomChar();
    return next;
  }

  function collectTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;

        const parent = node.parentElement;
        const parentTag = parent && parent.tagName;
        if (parentTag === "SCRIPT" || parentTag === "STYLE") return NodeFilter.FILTER_REJECT;
        if (parent?.closest("[data-no-decrypt]")) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let current;
    while ((current = walker.nextNode())) nodes.push(current);
    return nodes;
  }

  function runGlobalDecrypt(root) {
    if (activeDecrypt) activeDecrypt.finish();

    const state = [];
    const queue = [];
    const nodes = collectTextNodes(root);

    nodes.forEach((node) => {
      const original = node.textContent || "";
      const chars = [...original];

      chars.forEach((char, charIndex) => {
        if (/\s/.test(char)) return;

        chars[charIndex] = randomCharDifferentFrom(char);
        queue.push({ stateIndex: state.length, charIndex });
      });

      node.textContent = chars.join("");
      state.push({ node, original: [...original], chars });
    });

    if (!queue.length) return;

    let rafId = 0;
    let finishTimer = 0;
    let finished = false;
    const startTime = window.performance.now();

    function writeState() {
      state.forEach((item) => {
        item.node.textContent = item.chars.join("");
      });
    }

    function cleanup() {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (finishTimer) window.clearTimeout(finishTimer);
      rafId = 0;
      finishTimer = 0;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", finish);
    }

    function finish() {
      if (finished) return;
      finished = true;
      cleanup();

      queue.forEach((entry) => {
        const item = state[entry.stateIndex];
        item.chars[entry.charIndex] = item.original[entry.charIndex];
      });
      writeState();

      if (activeDecrypt?.finish === finish) activeDecrypt = null;
    }

    function tick(now) {
      if (finished) return;

      try {
        const progress = Math.min(1, (now - startTime) / decryptDurationMs);
        const revealedCount = progress >= 1 ? queue.length : Math.floor(progress * queue.length);

        queue.forEach((entry, index) => {
          const item = state[entry.stateIndex];
          item.chars[entry.charIndex] =
            index < revealedCount
              ? item.original[entry.charIndex]
              : randomCharDifferentFrom(item.original[entry.charIndex]);
        });
        writeState();

        if (revealedCount >= queue.length) {
          finish();
          return;
        }

        rafId = window.requestAnimationFrame(tick);
      } catch (_error) {
        finish();
      }
    }

    function onVisibilityChange() {
      if (finished || document.visibilityState !== "visible" || rafId) return;
      rafId = window.requestAnimationFrame(tick);
    }

    activeDecrypt = { finish };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", finish);

    finishTimer = window.setTimeout(finish, decryptDurationMs + 1000);
    rafId = window.requestAnimationFrame(tick);
  }

  function shuffle(items) {
    const clone = [...items];
    for (let i = clone.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char];
    });
  }

  async function renderContentPage() {
    const root = document.getElementById("content-root");
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");

    try {
      if (view === "about") {
        const response = await fetch("data/bio.txt", { cache: "no-store" });
        if (!response.ok) throw new Error("load error");
        const text = await response.text();
        root.innerHTML = `<pre>${escapeHtml(text.trim())}</pre>`;
      } else if (view === "accounts") {
        const response = await fetch("data/accounts.json", { cache: "no-store" });
        if (!response.ok) throw new Error("load error");
        const raw = await response.json();
        const accounts = raw && typeof raw.accounts === "object" ? raw.accounts : raw;
        const lines = Object.entries(accounts || {}).map(([k, v]) => `${k}: ${v}`);
        root.innerHTML = `<pre>${escapeHtml(lines.join("\n"))}</pre>`;
      } else if (view === "programming") {
        const response = await fetch("data/projects.json", { cache: "no-store" });
        if (!response.ok) throw new Error("load error");
        const raw = await response.json();
        const items = Array.isArray(raw?.projects) ? shuffle(raw.projects) : [];
        const rows = items
          .map((item) => {
            const title = escapeHtml(item.title || "untitled");
            const tech = escapeHtml(item.tech || "");
            const link = String(item.link || "").trim();
            const safeLink = /^https?:\/\//i.test(link) ? link : "#";
            return `<li><a href="${safeLink}">${title}</a>${tech ? ` <span class="project-tech">- ${tech}</span>` : ""}</li>`;
          })
          .join("");
        root.innerHTML = `<ul class="programming-list">${rows}</ul>`;
      } else {
        root.innerHTML = `<pre>not found</pre>`;
      }
    } catch (_error) {
      root.innerHTML = `<pre>Load Error</pre>`;
    }

    const titleMap = {
      about: "About",
      programming: "Programming",
      accounts: "Accounts",
    };
    const viewTitle = titleMap[view] || "Content";
    document.title = `${viewTitle} - Mario Alemany`;
  }

  async function renderAsciiName() {
    const asciiEl = document.getElementById("ascii-name");
    if (!asciiEl) return;

    async function fetchManifestBannerFiles() {
      const manifestResponse = await fetch("data/ascii/manifest.json", { cache: "no-store" });
      if (!manifestResponse.ok) return null;
      const manifest = await manifestResponse.json();
      const files =
        manifest && typeof manifest.bannerFiles === "object" && Array.isArray(manifest.bannerFiles)
          ? manifest.bannerFiles
          : null;
      if (!files?.length) return null;
      return files.map((entry) => String(entry).trim()).filter(Boolean);
    }

    function isSafeAsciiRelativePath(relativePath) {
      const trimmed = String(relativePath).trim();
      if (!trimmed || trimmed.includes("..") || trimmed.startsWith("/")) return false;

      const parts = trimmed.split("/").filter(Boolean);
      if (parts.length !== 2) return false;
      if (parts[0] !== "ascii") return false;

      return /^[a-zA-Z0-9._-]+$/.test(parts[1]);
    }

    async function fetchBanner(relativePath) {
      if (!isSafeAsciiRelativePath(relativePath)) throw new Error("bad path");

      const response = await fetch(`data/${relativePath}`, { cache: "no-store" });
      if (!response.ok) throw new Error("load error");
      return response.text();
    }

    try {
      const defaultBanners = Array.from({ length: 18 }, (_, i) => `ascii/name${i}.txt`);
      const bannerFiles = (await fetchManifestBannerFiles()) || defaultBanners;

      const uniqueBannerFiles = [...new Set(bannerFiles)];
      const safeBannerFiles = uniqueBannerFiles.filter((entry) => isSafeAsciiRelativePath(entry));
      if (!safeBannerFiles.length) throw new Error("missing manifest");

      const fileName = safeBannerFiles[Math.floor(Math.random() * safeBannerFiles.length)];
      const text = await fetchBanner(fileName);
      asciiEl.textContent = text.trimEnd();
    } catch (_error) {
      asciiEl.textContent = "MARIO ALEMANY";
    }
  }

  async function boot() {
    const currentBoot = ++bootId;

    await renderContentPage();
    await renderAsciiName();
    if (currentBoot !== bootId) return;

    runGlobalDecrypt(document.body);
  }

  window.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) boot();
  });
})();
