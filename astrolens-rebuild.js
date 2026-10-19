/* AstroLens rebuilt UI interactions. Scientific logic remains in the established analysis modules. */
(() => {
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const sidebar = $("#sidebar");
  const menu = $("#mobileMenu");
  if (menu && sidebar) {
    menu.addEventListener("click", () => {
      const open = sidebar.classList.toggle("open");
      menu.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      menu.textContent = open ? "×" : "☰";
    });
    $$(".sidebar .nav-link").forEach(link => link.addEventListener("click", () => {
      sidebar.classList.remove("open");
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Open navigation");
      menu.textContent = "☰";
    }));
    document.addEventListener("click", event => {
      if (window.matchMedia("(max-width: 720px)").matches &&
          sidebar.classList.contains("open") &&
          !sidebar.contains(event.target) && !menu.contains(event.target)) {
        sidebar.classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
        menu.textContent = "☰";
      }
    });
  }
  const navLinks = $$(".sidebar .nav-link, .bottom-dock a");
  const destinations = navLinks.map(link => link.getAttribute("href")).filter(href => href && href.startsWith("#"));
  const sections = [...new Set(destinations)].map(id => $(id)).filter(Boolean);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
      if (!visible) return;
      const hash = "#" + visible.target.id;
      navLinks.forEach(link => link.classList.toggle("active", link.getAttribute("href") === hash));
    }, {rootMargin:"-18% 0px -62% 0px",threshold:[0,.15,.35,.6]});
    sections.forEach(section => observer.observe(section));
  }
  const explore = $("#exploreBtn");
  if (explore) explore.addEventListener("click", () => $("#explorer")?.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}));
  const search = $("#searchInput");
  if (search) {
    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); search.focus();
      }
      if (event.key === "Escape" && document.activeElement === search) search.blur();
    });
    search.addEventListener("input", () => {
      const value = search.value.trim().toLowerCase();
      $$(".module-card").forEach(card => {
        card.hidden = !!value && !card.textContent.toLowerCase().includes(value);
      });
    });
  }
  // Mark missing remote artwork gracefully while keeping the card's visual treatment intact.
  $$(".module-card, .sidebar-image, .hero-art").forEach(el => {
    const raw = getComputedStyle(el).backgroundImage;
    const match = raw.match(/url\(["']?(.*?)["']?\)/);
    if (!match) return;
    const img = new Image();
    img.onerror = () => { el.classList.add("artwork-fallback"); };
    img.src = match[1];
  });
})();
