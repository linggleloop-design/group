const RESOURCE_ROOT = "ourweb/01_Group_Resource";

const state = {
  resources: [],
  filter: "all",
  query: "",
};

const categoryLabels = {
  all: "All",
  papers: "Papers",
  code: "Code",
  literature: "Literature",
  derivations: "Derivations",
  theses: "Theses",
  tools: "Tools",
  rules: "Rules",
};

const categoryOrder = ["papers", "code", "derivations", "literature", "theses", "tools", "rules"];

const typeLabels = {
  ".pdf": "PDF",
  ".zip": "ZIP",
  ".rar": "RAR",
  ".f90": "Fortran",
  ".m": "Matlab",
  ".mlx": "Matlab Live",
  ".docx": "DOCX",
  "": "FILE",
};

function categoryRank(category) {
  const index = categoryOrder.indexOf(category);
  return index === -1 ? 99 : index;
}

function normalizeResources(raw) {
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .filter(Boolean)
    .map((item) => {
      const relative = item.Relative || item.relative || "";
      const extension = (item.Extension || "").toLowerCase();
      return {
        ...item,
        Relative: relative,
        Name: item.Name || relative.split("/").pop(),
        Extension: extension,
        Length: Number(item.Length || 0),
        Directory: item.Directory || relative.split("/").slice(0, -1).join("/"),
        Category: inferCategory(relative, extension),
      };
    });
}

function inferCategory(relative, extension) {
  if (relative.startsWith("1.")) return "papers";
  if (relative.startsWith("2.") || relative.startsWith("3.")) return "code";
  if (relative.startsWith("4.")) return "literature";
  if (relative.startsWith("5.")) return "derivations";
  if (relative.startsWith("6.")) return "tools";
  if (relative.startsWith("7.")) return "theses";
  if (extension === ".docx") return "rules";
  return "all";
}

function resourceUrl(relative) {
  return `${RESOURCE_ROOT}/${relative
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function formatBytes(bytes) {
  if (!bytes) return "unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function cleanPaperTitle(name) {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/^(20\d{2})([-.]\d{1,2})?[.\-\s]*/i, "")
    .replace(/^(CPB|CPL|PRA|EPJD|OE)[._\-\s]*/i, "")
    .replace(/^[A-Z]{1,3}\s+/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function paperYear(item) {
  const nameMatch = item.Name.match(/^(20\d{2})/);
  if (nameMatch) return Number(nameMatch[1]);
  const pathMatch = item.Relative.match(/\/(20\d{2})(?:\/|$)/);
  return pathMatch ? Number(pathMatch[1]) : 0;
}

function paperMonth(item) {
  const match = item.Name.match(/^20\d{2}[-.](\d{1,2})/);
  if (!match) return 0;
  const month = Number(match[1]);
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : 0;
}

function paperDateLabel(item) {
  const year = paperYear(item);
  const month = paperMonth(item);
  if (!year) return "Publication";
  return month ? `${year}-${String(month).padStart(2, "0")}` : String(year);
}

function paperVenue(item) {
  const name = item.Name.toLowerCase();
  const venues = [
    "JPC Letters",
    "Scientific Reports",
    "Optics Express",
    "Physical Review A",
    "PhysRevA",
    "Symmetry",
    "CPL",
    "CPB",
    "EPJD",
    "PRA",
    "OE",
  ];
  return venues.find((venue) => name.includes(venue.toLowerCase())) || "Group publication";
}

function paperPreviewImage(item, index = 0) {
  const haystack = `${item.Name} ${item.Relative}`.toLowerCase();
  if (haystack.includes("water") || haystack.includes("scientific reports")) return "assets/research/strong-field-dynamics.jpg";
  if (haystack.includes("carrier") || haystack.includes("scattering") || haystack.includes("optics express")) return "assets/research/solid-carriers.jpg";
  if (haystack.includes("vuv") || haystack.includes("jpc")) return "assets/research/hhg-reconstruction.jpg";
  if (haystack.includes("tdse") || haystack.includes("tddft") || haystack.includes("sbe")) return "assets/research/computational-methods.jpg";
  const previews = [
    "assets/research/hhg-reconstruction.jpg",
    "assets/research/strong-field-dynamics.jpg",
    "assets/research/solid-carriers.jpg",
    "assets/research/computational-methods.jpg",
    "assets/research/molecular-spectra.jpg",
  ];
  return previews[index % previews.length];
}

function paperItems() {
  return state.resources
    .filter((item) => item.Category === "papers")
    .sort((a, b) => {
      const year = paperYear(b) - paperYear(a);
      if (year !== 0) return year;
      const month = paperMonth(b) - paperMonth(a);
      if (month !== 0) return month;
      return b.Name.localeCompare(a.Name, "zh-Hans-CN");
    });
}

function categoryCounts(items = state.resources) {
  return items.reduce((acc, item) => {
    acc[item.Category] = (acc[item.Category] || 0) + 1;
    return acc;
  }, {});
}

function setMetric(name, value) {
  const node = document.querySelector(`[data-metric="${name}"]`);
  if (node) node.textContent = value;
}

function renderMetrics() {
  const counts = categoryCounts();
  setMetric("paperCount", counts.papers || 0);
  setMetric("resourceCount", state.resources.length);
  setMetric("codeCount", counts.code || 0);
}

function renderAtlas() {
  const atlas = document.getElementById("resourceAtlas");
  if (!atlas) return;
  const counts = categoryCounts();
  atlas.innerHTML = categoryOrder
    .map((category) => {
      const items = state.resources.filter((item) => item.Category === category);
      const totalSize = items.reduce((sum, item) => sum + item.Length, 0);
      return `
        <button class="resource-type-card" type="button" data-resource-filter="${category}">
          <span>${categoryLabels[category]}</span>
          <strong>${counts[category] || 0}</strong>
          <em>${formatBytes(totalSize)}</em>
        </button>
      `;
    })
    .join("");
}

function renderPapers() {
  const list = document.getElementById("paperList");
  if (!list) return;
  const groups = paperItems().reduce((acc, item) => {
    const year = paperYear(item) || "Other";
    if (!acc.has(year)) acc.set(year, []);
    acc.get(year).push(item);
    return acc;
  }, new Map());

  list.innerHTML = [...groups.entries()]
    .map(([year, papers]) => {
      const rows = papers
        .map(
          (item) => `
            <a class="year-paper" href="${resourceUrl(item.Relative)}" target="_blank" rel="noreferrer">
              <time>${paperDateLabel(item)}</time>
              <strong>${cleanPaperTitle(item.Name)}</strong>
              <span>${paperVenue(item)}</span>
            </a>
          `,
        )
        .join("");
      return `
        <section class="publication-year">
          <h3>${year}</h3>
          <div class="year-paper-list">${rows}</div>
        </section>
      `;
    })
    .join("");
}

function renderNews() {
  const news = paperItems().map((item, index) => ({
    date: paperDateLabel(item),
    title: cleanPaperTitle(item.Name),
    venue: paperVenue(item),
    image: paperPreviewImage(item, index),
    url: resourceUrl(item.Relative),
  }));

  const render = (items) =>
    items
      .map(
        (item) => `
          <a class="news-item" href="${item.url}" target="_blank" rel="noreferrer">
            <img class="news-thumb" src="${item.image}" alt="" loading="lazy" />
            <div>
              <time class="news-date">${item.date}</time>
              <h3>${item.title}</h3>
              <p>${item.venue} · paper published</p>
            </div>
          </a>
        `,
      )
      .join("");

  const homeNews = document.getElementById("homeNews");
  if (homeNews) homeNews.innerHTML = render(news.slice(0, 3));

  const newsList = document.getElementById("newsList");
  if (newsList) newsList.innerHTML = render(news);
}

function initCarousel() {
  const slides = [...document.querySelectorAll(".banner-slide")];
  if (!slides.length) return;

  const dots = [...document.querySelectorAll("[data-slide-to]")];
  const currentNode = document.querySelector("[data-slide-current]");
  const totalNode = document.querySelector("[data-slide-total]");
  const nextButton = document.querySelector("[data-slide-next]");
  const prevButton = document.querySelector("[data-slide-prev]");
  let current = Math.max(0, slides.findIndex((slide) => slide.classList.contains("active")));
  let timer = null;

  if (totalNode) totalNode.textContent = String(slides.length).padStart(2, "0");

  const showSlide = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => slide.classList.toggle("active", slideIndex === current));
    dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === current));
    if (currentNode) currentNode.textContent = String(current + 1).padStart(2, "0");
  };

  const restart = () => {
    if (timer) window.clearInterval(timer);
    timer = window.setInterval(() => showSlide(current + 1), 5200);
  };

  nextButton?.addEventListener("click", () => {
    showSlide(current + 1);
    restart();
  });

  prevButton?.addEventListener("click", () => {
    showSlide(current - 1);
    restart();
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      showSlide(Number(dot.dataset.slideTo || 0));
      restart();
    });
  });

  showSlide(current);
  restart();
}

function matchesFilter(item) {
  const filterOk = state.filter === "all" || item.Category === state.filter;
  if (!filterOk) return false;
  if (!state.query) return true;
  const haystack = `${item.Name} ${item.Relative} ${categoryLabels[item.Category] || ""}`.toLowerCase();
  return haystack.includes(state.query.toLowerCase());
}

function renderResourceSummary(items) {
  const summary = document.getElementById("resourceSummary");
  if (!summary) return;
  const counts = categoryCounts(items);
  const totalSize = items.reduce((sum, item) => sum + item.Length, 0);
  const parts = [
    `<span class="summary-pill">${items.length} files shown</span>`,
    `<span class="summary-pill">${formatBytes(totalSize)} total</span>`,
    ...Object.entries(counts)
      .sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]))
      .map(([key, count]) => `<span class="summary-pill">${categoryLabels[key] || key} ${count}</span>`),
  ];
  summary.innerHTML = parts.join("");
}

function renderResources() {
  const list = document.getElementById("resourceList");
  if (!list) return;
  const items = state.resources
    .filter(matchesFilter)
    .sort((a, b) => {
      const category = categoryRank(a.Category) - categoryRank(b.Category);
      if (category !== 0) return category;
      return a.Relative.localeCompare(b.Relative, "zh-Hans-CN");
    });

  renderResourceSummary(items);

  const visibleItems = items.slice(0, 80);
  if (!visibleItems.length) {
    list.innerHTML = `<p class="empty-state">No matching resources.</p>`;
    return;
  }

  const more = items.length > visibleItems.length ? `<p class="empty-state">${items.length - visibleItems.length} more matching files. Narrow the search term to locate files faster.</p>` : "";
  list.innerHTML =
    visibleItems
      .map((item) => {
        const type = typeLabels[item.Extension] || item.Extension.replace(".", "").toUpperCase() || "FILE";
        return `
          <article class="resource-item">
            <div>
              <h3>${item.Name}</h3>
              <div class="resource-path">${item.Directory || "根目录"}</div>
              <div class="resource-tags">
                <span>${categoryLabels[item.Category] || "资源"}</span>
                <span>${type}</span>
                <span>${formatBytes(item.Length)}</span>
              </div>
            </div>
            <a class="download-link" href="${resourceUrl(item.Relative)}" target="_blank" rel="noreferrer">Open</a>
          </article>
        `;
      })
      .join("") + more;
}

function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll(".filter-chip").forEach((button) => {
    const isActive = button.dataset.filter === filter;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  renderResources();
}

function showView(route) {
  if (route === "people") route = "members";
  const view = document.querySelector(`[data-view="${route}"]`) || document.querySelector('[data-view="home"]');
  const activeRoute = view?.dataset.view || "home";
  document.querySelectorAll(".page-view").forEach((section) => {
    section.classList.toggle("active", section === view);
  });
  document.querySelectorAll("[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === activeRoute);
  });
  if (window.location.hash.replace("#", "") !== activeRoute) {
    history.replaceState(null, "", `#${activeRoute}`);
  }
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function bindControls() {
  document.querySelectorAll("[data-route]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const route = link.dataset.route;
      if (!route) return;
      event.preventDefault();
      showView(route);
    });
  });

  window.addEventListener("hashchange", () => {
    showView(window.location.hash.replace("#", "") || "home");
  });

  const search = document.getElementById("resourceSearch");
  if (search) {
    search.addEventListener("input", (event) => {
      state.query = event.target.value.trim();
      renderResources();
    });
  }

  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => setFilter(button.dataset.filter || "all"));
  });

  const atlas = document.getElementById("resourceAtlas");
  if (atlas) {
    atlas.addEventListener("click", (event) => {
      const button = event.target.closest("[data-resource-filter]");
      if (!button) return;
      setFilter(button.dataset.resourceFilter || "all");
    });
  }

  document.querySelectorAll("[data-filter-jump]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showView("resources");
      const filter = link.dataset.filterJump || "all";
      window.setTimeout(() => setFilter(filter), 120);
    });
  });
}

async function init() {
  initCarousel();
  bindControls();
  showView(window.location.hash.replace("#", "") || "home");
  try {
    const response = await fetch("data/resources.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.resources = normalizeResources(await response.json());
    renderMetrics();
    renderAtlas();
    renderNews();
    renderPapers();
    renderResources();
  } catch (error) {
    const resourceList = document.getElementById("resourceList");
    if (resourceList) {
      resourceList.innerHTML = `<p class="empty-state">Resource index failed to load: ${error.message}</p>`;
    }
  }
}

init();
