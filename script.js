const treeLeaves = [...document.querySelectorAll(".tree-leaf")];
const panels = [...document.querySelectorAll(".panel")];
const landing = document.getElementById("landing");
const homeTrigger = document.getElementById("home-trigger");
const fluidMenu = document.getElementById("fluid-menu");
const fluidMenuToggle = document.getElementById("fluid-menu-toggle");
const projectShuffleButton = document.getElementById("portfolio-shuffle");
const tabAliases = {
  projects: "portfolio",
};
let projects = [];
const borderTraceConfig = {
  duration: 2625,
  cornerSlowdown: 0.5,
  cornerSlowdownRange: 24,
};
let borderTraceAngle = Math.random() * 360;
let borderTraceFrame = null;
let borderTraceLastTime = 0;
let borderTraceActiveCard = null;

function updateUrlWithoutScroll(tabName = "") {
  const { pathname, search } = window.location;
  const nextUrl = tabName ? `${pathname}${search}#${tabName}` : `${pathname}${search}`;
  history.replaceState(null, "", nextUrl);
}

function activateTab(tabName = "") {
  const normalizedTab = tabAliases[tabName] || tabName;
  const isKnownTab = panels.some((panel) => panel.id === normalizedTab);
  const isLanding = !isKnownTab;

  treeLeaves.forEach((leaf) => {
    const isActive = isKnownTab && leaf.dataset.tab === normalizedTab;
    leaf.classList.toggle("active", isActive);
    leaf.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    panel.classList.toggle("active", isKnownTab && panel.id === normalizedTab);
  });

  landing.classList.toggle("active", isLanding);
  document.body.classList.toggle("landing-mode", isLanding);

  if (isKnownTab) {
    updateUrlWithoutScroll(normalizedTab);
    return;
  }

  updateUrlWithoutScroll();
}

treeLeaves.forEach((leaf) => {
  leaf.addEventListener("click", () => {
    const nextTab = leaf.dataset.tab;
    activateTab(nextTab);
  });
});

if (homeTrigger) {
  homeTrigger.addEventListener("click", () => {
    activateTab("");
  });
}

if (fluidMenu && fluidMenuToggle) {
  fluidMenuToggle.addEventListener("click", () => {
    const isExpanded = fluidMenu.dataset.expanded === "true";
    fluidMenu.dataset.expanded = String(!isExpanded);
    fluidMenuToggle.setAttribute("aria-expanded", String(!isExpanded));
  });
}

function renderProjects(listId, items) {
  const list = document.getElementById(listId);
  if (!list) return;

  if (!items.length) {
    list.innerHTML = `
      <article class="card">
        <h3>No projects yet</h3>
        <p class="meta">Add entries to data/projects.json to populate this section.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = items
    .map((project) => {
      const link = sanitizeUrl(project.link);
      const linkMarkup =
        link === "#"
          ? ""
          : `<a class="project-link" href="${link}" target="_blank" rel="noopener noreferrer">visit</a>`;

      return `
      <article class="card project-card">
        <div class="project-card-content">
          <h3>${escapeHtml(project.title || "Untitled Project")}</h3>
          <p class="meta">${escapeHtml(project.description || "")}</p>
          <p class="project-tech">${escapeHtml(project.tech || "")}</p>
          ${linkMarkup}
        </div>
      </article>
    `;
    })
    .join("");

  initProjectBorderTrace(list);
}

function initProjectBorderTrace(root = document) {
  const cards = [...root.querySelectorAll(".project-card")];

  cards.forEach((card) => {
    if (card.dataset.traceBound === "true") return;
    card.dataset.traceBound = "true";
    card.style.setProperty("--trace-angle", `${borderTraceAngle}deg`);

    card.addEventListener("pointerenter", () => {
      borderTraceActiveCard = card;
      card.style.setProperty("--trace-angle", `${borderTraceAngle}deg`);
      startProjectBorderTrace();
    });

    card.addEventListener("pointerleave", () => {
      stopProjectBorderTrace();
      borderTraceActiveCard = null;
    });

    card.addEventListener("pointercancel", () => {
      stopProjectBorderTrace();
      borderTraceActiveCard = null;
    });
  });
}

function initNavBorderTrace() {
  const buttons = [...document.querySelectorAll(".fluid-menu-button")];

  buttons.forEach((button) => {
    if (button.dataset.traceBound === "true") return;
    button.dataset.traceBound = "true";
    button.style.setProperty("--trace-angle", `${borderTraceAngle}deg`);

    button.addEventListener("pointerenter", () => {
      borderTraceActiveCard = button;
      button.style.setProperty("--trace-angle", `${borderTraceAngle}deg`);
      startProjectBorderTrace();
    });

    button.addEventListener("pointerleave", () => {
      stopProjectBorderTrace();
      borderTraceActiveCard = null;
    });

    button.addEventListener("pointercancel", () => {
      stopProjectBorderTrace();
      borderTraceActiveCard = null;
    });
  });
}

function startProjectBorderTrace() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (borderTraceFrame !== null) return;

  borderTraceLastTime = performance.now();
  borderTraceFrame = requestAnimationFrame(updateProjectBorderTrace);
}

function updateProjectBorderTrace(time) {
  if (!borderTraceActiveCard) {
    borderTraceFrame = null;
    return;
  }

  const elapsed = time - borderTraceLastTime;
  borderTraceLastTime = time;
  const speedMultiplier = getBorderTraceSpeedMultiplier(borderTraceAngle);
  borderTraceAngle =
    (borderTraceAngle + (elapsed / borderTraceConfig.duration) * 360 * speedMultiplier) % 360;
  borderTraceActiveCard.style.setProperty("--trace-angle", `${borderTraceAngle}deg`);
  borderTraceFrame = requestAnimationFrame(updateProjectBorderTrace);
}

function stopProjectBorderTrace() {
  if (borderTraceFrame === null) return;

  cancelAnimationFrame(borderTraceFrame);
  borderTraceFrame = null;
}

function getBorderTraceSpeedMultiplier(angle) {
  const corners = [45, 135, 225, 315];
  const nearestCornerDistance = Math.min(
    ...corners.map((corner) => {
      const distance = Math.abs((((angle - corner + 180) % 360) + 360) % 360 - 180);
      return distance;
    })
  );
  const cornerAmount = 1 - Math.min(nearestCornerDistance / borderTraceConfig.cornerSlowdownRange, 1);
  const easedCornerAmount = cornerAmount * cornerAmount * (3 - 2 * cornerAmount);

  return 1 - (1 - borderTraceConfig.cornerSlowdown) * easedCornerAmount;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function sanitizeUrl(value) {
  const url = String(value || "").trim();
  if (/^https?:\/\//i.test(url)) return url;
  return "#";
}

function shuffleItems(items) {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function formatBioHtml(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return '<p class="meta">Add text to data/bio.txt.</p>';
  }
  const blocks = trimmed.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

async function loadBio() {
  const el = document.getElementById("about-bio");
  if (!el) return;

  try {
    const response = await fetch("data/bio.txt", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load data/bio.txt (${response.status})`);
    }
    const text = await response.text();
    el.innerHTML = formatBioHtml(text);
  } catch (error) {
    el.innerHTML = `<p class="meta">${escapeHtml(error.message)}</p>`;
  }
}

function renderAccounts(listId, accountsMap) {
  const list = document.getElementById(listId);
  if (!list) return;

  const entries = Object.entries(accountsMap || {});

  if (entries.length === 0) {
    list.innerHTML = `
      <p class="account-line">
        <strong class="account-platform">No accounts yet</strong>
        <span class="account-arrow">-></span>
        <span class="account-username">add entries to data/accounts.json</span>
      </p>
    `;
    return;
  }

  list.innerHTML = entries
    .map(
      ([platform, username]) => `
      <p class="account-line">
        <strong class="account-platform">${escapeHtml(platform)}</strong>
        <span class="account-arrow">-></span>
        <span class="account-username">${escapeHtml(username)}</span>
      </p>
    `
    )
    .join("");
}

async function loadAccounts() {
  try {
    const response = await fetch("data/accounts.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load data/accounts.json (${response.status})`);
    }

    const data = await response.json();
    const accountsMap =
      data && typeof data.accounts === "object" && !Array.isArray(data.accounts)
        ? data.accounts
        : data;

    if (!accountsMap || typeof accountsMap !== "object" || Array.isArray(accountsMap)) {
      throw new Error("data/accounts.json must contain an object map of platform -> username.");
    }

    renderAccounts("accounts-list", accountsMap);
  } catch (error) {
    const list = document.getElementById("accounts-list");
    if (list) {
      list.innerHTML = `
        <p class="account-line">
          <strong class="account-platform">Accounts unavailable</strong>
          <span class="account-arrow">-></span>
          <span class="account-username">${escapeHtml(error.message)}</span>
        </p>
      `;
    }
  }
}

async function loadProjects() {
  try {
    const response = await fetch("data/projects.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load data/projects.json (${response.status})`);
    }

    const data = await response.json();
    const projectList =
      data && Array.isArray(data.projects)
        ? data.projects
        : Array.isArray(data)
          ? data
          : null;

    if (!projectList) {
      throw new Error("data/projects.json must contain an array or a projects array.");
    }

    projects = shuffleItems(projectList);
    renderProjects("portfolio-list", projects);
  } catch (error) {
    const list = document.getElementById("portfolio-list");
    if (list) {
      list.innerHTML = `
        <article class="card">
          <h3>Projects unavailable</h3>
          <p class="meta">${escapeHtml(error.message)}</p>
        </article>
      `;
    }
  }
}

if (projectShuffleButton) {
  projectShuffleButton.addEventListener("click", () => {
    if (!projects.length) return;
    projects = shuffleItems(projects);
    renderProjects("portfolio-list", projects);
  });
}

function initCoverDeck() {
  const deck = document.getElementById("cover-deck");
  if (!deck) return;

  const imgs = [...deck.querySelectorAll("img.stack-photo")];
  const n = imgs.length;
  if (n === 0 || n > 3) return;

  const ids = imgs.map((img) => Number(img.dataset.cover));
  let stackOrder = ids.slice();
  if (n === 3) {
    stackOrder = [2, 1, 0];
  } else if (ids.includes(0) && n === 2) {
    stackOrder = [...ids.filter((id) => id !== 0), 0];
  }

  function applyStack() {
    imgs.forEach((img) => {
      const id = Number(img.dataset.cover);
      const depth = stackOrder.indexOf(id);
      img.classList.remove("depth-0", "depth-1", "depth-2");
      if (depth >= 0 && depth < 3) {
        img.classList.add(`depth-${depth}`);
      }
    });
  }

  function rotateDeck() {
    if (n < 2) return;
    stackOrder = [stackOrder[n - 1], ...stackOrder.slice(0, n - 1)];
    applyStack();
  }

  imgs.forEach((img) => {
    img.draggable = false;
    img.addEventListener("click", rotateDeck);
  });

  applyStack();
}

loadProjects();
loadAccounts();
loadBio();
initCoverDeck();
initNavBorderTrace();

const initialTab = window.location.hash.replace("#", "");
activateTab(initialTab);
