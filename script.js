(function site() {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-/<>{}[]";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** Wall-clock duration from fully scrambled to fully revealed (same on every page). */
  const decryptDurationMs = 650;

  function randomChar() {
    return charset[Math.floor(Math.random() * charset.length)];
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
        const parentTag = node.parentElement && node.parentElement.tagName;
        if (parentTag === "SCRIPT" || parentTag === "STYLE") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let current;
    while ((current = walker.nextNode())) nodes.push(current);
    return nodes;
  }

  function runGlobalDecrypt(root) {
    if (reducedMotion) return;

    const nodes = collectTextNodes(root);
    const state = [];
    const queue = [];

    nodes.forEach((node) => {
      const original = node.textContent || "";
      const encrypted = [...original];

      for (let i = 0; i < encrypted.length; i += 1) {
        if (!/\s/.test(encrypted[i])) {
          encrypted[i] = randomCharDifferentFrom(original[i]);
          queue.push({ stateIndex: state.length, charIndex: i });
        }
      }

      node.textContent = encrypted.join("");
      state.push({ node, original, encrypted });
    });

    if (!queue.length) return;

    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / decryptDurationMs);
      const nextRevealed = t >= 1 ? queue.length : Math.floor(t * queue.length);

      for (let i = 0; i < nextRevealed; i += 1) {
        const q = queue[i];
        const s = state[q.stateIndex];
        s.encrypted[q.charIndex] = s.original[q.charIndex];
      }

      for (let i = nextRevealed; i < queue.length; i += 1) {
        const q = queue[i];
        const s = state[q.stateIndex];
        s.encrypted[q.charIndex] = randomCharDifferentFrom(s.original[q.charIndex]);
      }

      state.forEach((s) => {
        s.node.textContent = s.encrypted.join("");
      });

      if (nextRevealed < queue.length) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
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
            return `<li><a href="${safeLink}">${title}</a>${tech ? ` - ${tech}` : ""}</li>`;
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

  window.addEventListener("DOMContentLoaded", async () => {
    await renderContentPage();
    await renderAsciiName();
    runGlobalDecrypt(document.body);
  });
})();
