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
