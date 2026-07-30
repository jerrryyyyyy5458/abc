/* Category shop browse: sidebar + filtered product grid. Data via getCategoryCatalog(). */

import { formatPrice, debounce } from "./utils.js";
import { getCategoryCatalog, listBrowsableCategories } from "./category-catalog-data.js";

const SIDEBAR_ICONS = {
  droplet: '<path d="M12 3s6 6.2 6 10a6 6 0 1 1-12 0c0-3.8 6-10 6-10Z"/>',
  bottle: '<path d="M9 3h6v3H9z"/><path d="M8 6h8v14a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V6Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  drop: '<path d="M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9Z"/>',
  spray: '<path d="M8 9h5v11H8z"/><path d="M10 5V3m2 2V2m2 3V4"/><path d="M13 9h3l1 3"/>',
  foam: '<circle cx="9" cy="8" r="2"/><circle cx="14" cy="7" r="1.5"/><path d="M7 12h10v7a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-7Z"/>',
  lips: '<path d="M4 12c2-3 5-4 8-4s6 1 8 4c-2 3-5 4-8 4s-6-1-8-4Z"/><path d="M4 12h16"/>',
  mask: '<path d="M5 10h14v4a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5v-4Z"/><path d="M9 10V8a3 3 0 0 1 6 0v2"/>',
  cross: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  oil: '<path d="M10 3h4l1 4H9l1-4Z"/><path d="M8 7h8v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7Z"/>',
  shampoo: '<path d="M10 2h4v3h-4z"/><path d="M8 5h8l1 3v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8l1-3Z"/>',
  conditioner: '<path d="M9 3h6v2H9z"/><path d="M8 5h8v14a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V5Z"/><path d="M10 10h4"/>',
  shine: '<path d="M12 3v4M12 17v4M4 12h4M16 12h4"/><circle cx="12" cy="12" r="3"/>',
  bath: '<path d="M5 12h14v4a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-4Z"/><path d="M7 12V8a2 2 0 0 1 2-2h0"/>',
  soap: '<rect x="6" y="9" width="12" height="9" rx="2"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
  hand: '<path d="M8 11V7a1 1 0 0 1 2 0v4"/><path d="M10 10V5a1 1 0 0 1 2 0v5"/><path d="M12 10V6a1 1 0 0 1 2 0v4"/><path d="M14 11V8a1 1 0 0 1 2 0v7a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4v-4"/>',
  lotion: '<path d="M10 2h4v4h-4z"/><path d="M8 6h8v14H8z"/>',
  tooth: '<path d="M8 4h3v7l-1 8H8V4Zm5 0h3v15h-2l-1-8V4Z"/>',
  palette: '<circle cx="12" cy="12" r="8"/><circle cx="9" cy="10" r="1.2"/><circle cx="14" cy="9" r="1.2"/><circle cx="15" cy="13" r="1.2"/><circle cx="10" cy="14" r="1.2"/>',
  foundation: '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M8 9h8"/>',
  concealer: '<path d="M9 3h6l1 5H8L9 3Z"/><path d="M8 8h8v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8Z"/>',
  powder: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  lipstick: '<path d="M10 3h3l1 5h-5l1-5Z"/><path d="M9 8h5v11a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V8Z"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  liner: '<path d="M4 16 16 4l3 3L7 19H4v-3Z"/>',
  mascara: '<path d="M10 3h4v6h-4z"/><path d="M9 9h6v11H9z"/>',
  nail: '<path d="M9 3h6v10l-1 7H10l-1-7V3Z"/>',
  perfume: '<path d="M10 2h4v3h-4z"/><path d="M8 5h8l1 3v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8l1-3Z"/>',
  beard: '<path d="M7 10c0 5 2.5 8 5 8s5-3 5-8"/><path d="M7 10V8a5 5 0 0 1 10 0v2"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 17h2"/>',
  laptop: '<path d="M4 6h16v10H4z"/><path d="M2 16h20v2H2z"/>',
  tablet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 17h2"/>',
  watch: '<circle cx="12" cy="12" r="6"/><path d="M12 9v3l2 1M9 4h6M9 20h6"/>',
  earbuds: '<path d="M7 10a3 3 0 0 1 6 0v2H7v-2Z"/><path d="M13 12v4a2 2 0 0 0 2 2h0"/><path d="M17 10a3 3 0 0 0-6 0"/><path d="M17 10v6"/>',
  headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1v-5H4Zm16 0h-1v5h1a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2Z"/>',
  speaker: '<rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="12" r="3"/>',
  charger: '<path d="M11 2v6M13 2v6M8 8h8v6a4 4 0 0 1-8 0V8Z"/><path d="M12 18v4"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M19 10h2v4h-2"/><path d="M6 10h6v4H6z"/>',
  cable: '<path d="M4 8h6v2H4zM14 14h6v2h-6z"/><path d="M10 9h2a2 2 0 0 1 2 2v2"/>',
  keyboard: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 11h.01M11 11h.01M15 11h.01M7 14h10"/>',
  mouse: '<rect x="8" y="3" width="8" height="18" rx="4"/><path d="M12 3v5"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  game: '<path d="M6 10h12v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-6Z"/><path d="M9 13h2m-1-1v2M15 13h.01M17 13h.01"/>',
  camera: '<path d="M4 8h4l2-2h4l2 2h4v10H4V8Z"/><circle cx="12" cy="13" r="3"/>',
  printer: '<path d="M7 8V4h10v4"/><path d="M6 8h12v7H6z"/><path d="M8 15v4h8v-4"/>',
  storage: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8h6M9 12h6"/>',
  router: '<rect x="4" y="10" width="16" height="8" rx="2"/><path d="M8 10V7m4 3V5m4 5V7"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/>',
  tv: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8"/>',
  plug: '<path d="M9 3v6M15 3v6M7 9h10v4a5 5 0 0 1-10 0V9Z"/><path d="M12 18v3"/>',
  shirt: '<path d="M8 7 6 4H3l3 6v10h12V10l3-6h-3l-2 3"/><path d="M8 7c1.2 1.3 2.5 2 4 2s2.8-.7 4-2"/>',
  dress: '<path d="M9 4h6l1 4H8l1-4Z"/><path d="M8 8h8l2 12H6L8 8Z"/>',
  kids: '<circle cx="12" cy="7" r="3"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>',
  pants: '<path d="M8 3h8l-1 18H9L8 3Z"/><path d="M12 3v18"/>',
  shorts: '<path d="M7 8h10l1 6H6L7 8Z"/><path d="M9 14v3M15 14v3"/>',
  jacket: '<path d="M8 6 6 4H3l3 5v11h12V9l3-5h-3l-2 2"/><path d="M12 9v11"/>',
  hoodie: '<path d="M9 7a3 3 0 0 1 6 0v2H9V7Z"/><path d="M7 9h10v11H7z"/>',
  suit: '<path d="M8 5h8v3H8z"/><path d="M6 8h12v12H6z"/><path d="M12 8v12"/>',
  shoe: '<path d="M4 14h11l5 2v2H4v-4Z"/><path d="M4 14c0-2 2-4 5-4h3"/>',
  bag: '<path d="M6 8h12v12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  glasses: '<circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/><path d="M10 12h4"/>',
  sparkle: '<path d="M12 3v4M12 17v4M4 12h4M16 12h4"/><circle cx="12" cy="12" r="2"/>',
  sofa: '<path d="M4 12h16v5H4z"/><path d="M6 12V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/><path d="M6 17v2M18 17v2"/>',
  bed: '<path d="M3 12h18v5H3z"/><path d="M5 12V8a2 2 0 0 1 2-2h6v6"/><path d="M5 17v2M19 17v2"/>',
  utensils: '<path d="M8 3v8M6 3v5a2 2 0 0 0 4 0V3"/><path d="M8 11v10M16 3v7a2 2 0 0 0 2 2h0V3"/>',
  pan: '<path d="M4 12h12a4 4 0 0 0 0-8H4"/><path d="M16 8h4"/>',
  box: '<path d="M4 8h16v12H4z"/><path d="M4 8l8-4 8 4M12 4v16"/>',
  vase: '<path d="M9 3h6l1 4H8L9 3Z"/><path d="M8 7h8l1 13H7L8 7Z"/>',
  lamp: '<path d="M9 21h6"/><path d="M12 3v6"/><path d="M8 9h8l1 4H7l1-4Z"/>',
  blanket: '<path d="M4 7h16v12H4z"/><path d="M4 11h16"/>',
  cushion: '<rect x="5" y="6" width="14" height="12" rx="3"/>',
  curtain: '<path d="M5 3v18M19 3v18"/><path d="M5 5c3 2 5 2 7 0s4-2 7 0"/>',
  broom: '<path d="M12 3v10"/><path d="M8 13h8l1 7H7l1-7Z"/>',
  tool: '<path d="M14 4a4 4 0 0 1 0 8l-6 6-2-2 6-6a4 4 0 0 1 2-6Z"/>',
  plant: '<path d="M12 12c-4-4-4-8 0-8s4 4 0 8Z"/><path d="M12 12c4-4 4-8 0-8"/><path d="M12 12v9"/>',
  paw: '<circle cx="8" cy="9" r="1.5"/><circle cx="16" cy="9" r="1.5"/><circle cx="6" cy="13" r="1.5"/><circle cx="18" cy="13" r="1.5"/><path d="M9 17c1.5 2 4.5 2 6 0"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  fridge: '<rect x="7" y="3" width="10" height="18" rx="1"/><path d="M7 10h10M10 6v2"/>',
  washer: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M9 6h6"/>',
  ac: '<rect x="3" y="7" width="18" height="8" rx="2"/><path d="M7 15v2M12 15v3M17 15v2"/>',
  microwave: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M15 10h3M15 13h3"/>',
  vacuum: '<path d="M8 4h6v6H8z"/><path d="M6 10h10v4l-2 6H8l-2-6v-4Z"/>',
  heater: '<rect x="7" y="4" width="10" height="16" rx="2"/><path d="M10 8h4M10 12h4M10 16h4"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 4c2 3 2 5 0 8M12 20c-2-3-2-5 0-8M4 12c3-2 5-2 8 0M20 12c-3 2-5 2-8 0"/>',
  wind: '<path d="M4 9h11a2 2 0 1 0-2-2"/><path d="M4 13h14a2 2 0 1 1-2 2"/><path d="M4 17h8a2 2 0 1 0-2-2"/>',
  iron: '<path d="M5 15h14l-1 4H6l-1-4Z"/><path d="M7 15V9a4 4 0 0 1 4-4h2"/>',
  mixer: '<path d="M10 3h4v5h-4z"/><path d="M8 8h8v4l-2 9H10l-2-9V8Z"/>',
  chimney: '<path d="M6 10h12v10H6z"/><path d="M8 10V7l4-3 4 3v3"/>',
  dishwasher: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14M9 12h6"/>',
  dumbbell: '<path d="M6 9v6M8 8v8M16 8v8M18 9v6M8 12h8"/>',
  cricket: '<path d="M6 20 16 4"/><path d="M14 6l4 4"/><circle cx="7" cy="18" r="2"/>',
  racket: '<ellipse cx="12" cy="8" rx="5" ry="6"/><path d="M12 14v7"/>',
  football: '<circle cx="12" cy="12" r="9"/><path d="M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9Z"/>',
  bike: '<circle cx="6" cy="16" r="3"/><circle cx="18" cy="16" r="3"/><path d="M6 16h4l2-6h4l2 6"/>',
  basketball: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3.5 9.5h17M3.5 14.5h17"/>',
  swim: '<path d="M3 15c2 1 3 1 5 0s3-1 5 0 3 1 5 0 3-1 5 0"/><path d="M8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M10 9l3 3"/>',
  yoga: '<circle cx="12" cy="5" r="2"/><path d="M12 7v5M9 20l3-8 3 8M7 12h10"/>',
  glove: '<path d="M8 8V5a1 1 0 0 1 2 0v3"/><path d="M10 7V4a1 1 0 0 1 2 0v3"/><path d="M12 7V5a1 1 0 0 1 2 0v4"/><path d="M7 9h10v8a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V9Z"/>',
  tent: '<path d="M3 20 12 5l9 15H3Z"/><path d="M12 5v15"/>',
  book: '<path d="M12 6.5C10 4.8 7.5 4 5 4v14c2.5 0 5 .8 7 2.5 2-1.7 4.5-2.5 7-2.5V4c-2.5 0-5 .8-7 2.5Z"/><path d="M12 6.5v14"/>',
  chart: '<path d="M4 19h16"/><path d="M7 16V9M12 16V5M17 16v-5"/>',
  atom: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)"/>',
  grad: '<path d="M3 10l9-5 9 5-9 5-9-5Z"/><path d="M21 10v4"/><path d="M6 12v4c2 2 4 3 6 3s4-1 6-3v-4"/>',
  comic: '<path d="M5 5h14v10H9l-4 4V5Z"/>',
  user: '<circle cx="12" cy="8" r="3"/><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/>',
  scroll: '<path d="M6 5h10a2 2 0 0 1 2 2v12H8a2 2 0 0 0-2 2V5Z"/><path d="M6 5a2 2 0 0 0-2 2v12"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10Z"/>',
  pen: '<path d="M4 20h4L18 10l-4-4L4 16v4Z"/><path d="M12 8l4 4"/>',
};

function iconSvg(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${SIDEBAR_ICONS[name] || SIDEBAR_ICONS.drop}</svg>`;
}

function compareHref(product, searchBase) {
  return `${searchBase}?query=${encodeURIComponent(product.title)}`;
}

function readWishlist() {
  try { return new Set(JSON.parse(localStorage.getItem("comparex-wishlist") || "[]")); }
  catch { return new Set(); }
}

function writeWishlist(set) {
  localStorage.setItem("comparex-wishlist", JSON.stringify([...set]));
  document.querySelectorAll("[data-wishlist-count]").forEach((el) => {
    el.textContent = String(set.size);
  });
}

function sortProducts(products, mode) {
  const list = [...products];
  if (mode === "low") list.sort((a, b) => a.price - b.price);
  else if (mode === "high") list.sort((a, b) => b.price - a.price);
  else if (mode === "rating") list.sort((a, b) => b.rating - a.rating);
  else list.sort((a, b) => Number(Boolean(b.badge)) - Number(Boolean(a.badge)) || b.rating - a.rating);
  return list;
}

function renderCard(product, searchBase) {
  const wishlist = readWishlist();
  const saved = wishlist.has(product.id);
  const badge = product.badge
    ? `<span class="shop-card-badge ${product.badge === "bestseller" ? "is-bestseller" : "is-offer"}">${product.badge === "bestseller" ? "Bestseller" : product.badge}</span>`
    : "";
  const mrp = product.mrp && product.mrp > product.price
    ? `<del>${formatPrice(product.mrp)}</del>`
    : "";
  const href = compareHref(product, searchBase);

  return `
    <article class="shop-card" data-product-id="${product.id}">
      <button class="shop-card-wish${saved ? " is-saved" : ""}" type="button" aria-label="Toggle wishlist" data-wish-id="${product.id}">${saved ? "♥" : "♡"}</button>
      <a class="shop-card-link" href="${href}">
        <div class="shop-card-media">
          ${badge}
          <img src="${product.image}" alt="" loading="lazy" width="200" height="200" onerror="this.style.opacity='0'">
        </div>
        <div class="shop-card-body">
          <p class="shop-card-rating"><span>★</span> ${product.rating.toFixed(1)} (${product.reviews})</p>
          <h3 class="shop-card-title">${product.title}</h3>
          <p class="shop-card-brand">${product.brand}</p>
          <div class="shop-card-price"><strong>${formatPrice(product.price)}</strong>${mrp}</div>
          <p class="shop-card-stores">From ${product.stores} stores</p>
        </div>
      </a>
      <a class="shop-card-compare" href="${href}">Compare Prices</a>
    </article>`;
}

const PAGE_SIZE = 10;

function mountShop(root, catalog, paths) {
  if (!root || !catalog) return;

  const state = {
    subcategory: catalog.subcategories[0]?.id || null,
    sort: "popular",
    query: "",
    page: 1,
  };

  const homeHref = paths.home;
  const searchBase = paths.search;

  root.innerHTML = `
    <div class="category-shop" data-shop-slug="${catalog.slug}">
      <header class="category-shop-header">
        <div>
          <p class="category-shop-crumbs"><a href="${homeHref}">Home</a> › <span>${catalog.title}</span></p>
          <div class="category-shop-title-row">
            <h1>${catalog.title}</h1>
            <span class="category-shop-emblem" aria-hidden="true">${catalog.accentIcon}</span>
          </div>
          <p class="category-shop-subtitle">${catalog.subtitle}</p>
        </div>
        <div class="category-shop-toolbar">
          <label class="category-shop-search">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input type="search" placeholder="Search in ${catalog.title}" data-shop-search aria-label="Search in ${catalog.title}">
          </label>
          <select class="category-shop-select" data-shop-sort aria-label="Sort products">
            <option value="popular">Sort by: Popularity</option>
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
          <button class="category-shop-filter-btn" type="button" data-shop-filter>
            <svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
            Filters
          </button>
        </div>
      </header>

      <aside class="category-shop-sidebar" aria-label="${catalog.title} categories">
        <div class="category-shop-sidebar-head">Categories</div>
        <div class="category-shop-sidebar-list" data-shop-sidebar>
          ${catalog.subcategories.map((item, index) => `
            <button class="category-shop-side-item${index === 0 ? " is-active" : ""}" type="button" data-subcategory="${item.id}">
              ${iconSvg(item.icon)}
              <span>${item.name}</span>
            </button>`).join("")}
        </div>
        <div class="category-shop-sidebar-foot">
          <button class="category-shop-view-all" type="button" data-view-all-subs>
            <span>View all categories</span>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </aside>

      <div class="category-shop-main">
        <p class="category-shop-showing">Showing <strong data-shop-showing>${catalog.subcategories[0]?.name || ""}</strong></p>
        <div class="category-shop-grid" data-shop-grid></div>
        <nav class="category-shop-pagination" data-shop-pagination aria-label="Product pages"></nav>
      </div>
    </div>`;

  const grid = root.querySelector("[data-shop-grid]");
  const showing = root.querySelector("[data-shop-showing]");
  const searchInput = root.querySelector("[data-shop-search]");
  const pagination = root.querySelector("[data-shop-pagination]");

  const filtered = () => {
    const q = state.query.trim().toLowerCase();
    return sortProducts(
      catalog.products.filter((item) => {
        if (state.subcategory && state.subcategory !== "all" && item.subcategory !== state.subcategory) return false;
        if (!q) return true;
        return `${item.title} ${item.brand}`.toLowerCase().includes(q);
      }),
      state.sort,
    );
  };

  const renderPagination = (totalPages) => {
    if (!pagination) return;
    if (totalPages <= 1) {
      pagination.innerHTML = "";
      return;
    }
    const buttons = [];
    buttons.push(`<button type="button" data-page-prev aria-label="Previous page" ${state.page <= 1 ? "disabled" : ""}>‹</button>`);
    for (let page = 1; page <= totalPages; page += 1) {
      if (totalPages > 7 && page > 3 && page < totalPages - 1 && Math.abs(page - state.page) > 1) {
        if (buttons[buttons.length - 1] !== '<span class="category-shop-page-gap">…</span>') {
          buttons.push('<span class="category-shop-page-gap">…</span>');
        }
        continue;
      }
      buttons.push(`<button type="button" data-page="${page}" class="${page === state.page ? "is-active" : ""}">${page}</button>`);
    }
    buttons.push(`<button type="button" data-page-next aria-label="Next page" ${state.page >= totalPages ? "disabled" : ""}>›</button>`);
    pagination.innerHTML = buttons.join("");
  };

  const paint = () => {
    const products = filtered();
    const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    const pageItems = products.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    const activeSub = catalog.subcategories.find((item) => item.id === state.subcategory);
    if (showing) showing.textContent = activeSub?.name || catalog.title;
    grid.classList.remove("is-animating");
    void grid.offsetWidth;
    grid.classList.add("is-animating");
    grid.innerHTML = pageItems.length
      ? pageItems.map((item) => renderCard(item, searchBase)).join("")
      : `<div class="category-shop-empty" style="grid-column:1/-1"><strong>No products found</strong><p>Try another category or clear your search.</p></div>`;
    renderPagination(totalPages);

    grid.querySelectorAll("[data-wish-id]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = button.dataset.wishId;
        const set = readWishlist();
        if (set.has(id)) set.delete(id);
        else set.add(id);
        writeWishlist(set);
        button.classList.toggle("is-saved", set.has(id));
        button.textContent = set.has(id) ? "♥" : "♡";
      });
    });
  };

  root.querySelector("[data-shop-sidebar]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-subcategory]");
    if (!button) return;
    state.subcategory = button.dataset.subcategory;
    state.page = 1;
    root.querySelectorAll("[data-subcategory]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    paint();
  });

  root.querySelector("[data-shop-sort]")?.addEventListener("change", (event) => {
    state.sort = event.target.value;
    state.page = 1;
    paint();
  });

  root.querySelector("[data-shop-filter]")?.addEventListener("click", () => {
    searchInput?.focus();
  });

  root.querySelector("[data-view-all-subs]")?.addEventListener("click", () => {
    root.querySelector("[data-shop-sidebar]")?.scrollTo({ top: 0, behavior: "smooth" });
  });

  pagination?.addEventListener("click", (event) => {
    const totalPages = Math.max(1, Math.ceil(filtered().length / PAGE_SIZE));
    if (event.target.closest("[data-page-prev]")) {
      state.page = Math.max(1, state.page - 1);
      paint();
      return;
    }
    if (event.target.closest("[data-page-next]")) {
      state.page = Math.min(totalPages, state.page + 1);
      paint();
      return;
    }
    const pageButton = event.target.closest("[data-page]");
    if (!pageButton) return;
    state.page = Number(pageButton.dataset.page);
    paint();
  });

  searchInput?.addEventListener("input", debounce((event) => {
    state.query = event.target.value;
    state.page = 1;
    paint();
  }, 180));

  root.__categoryShopFilter = (query) => {
    state.query = query;
    state.page = 1;
    if (searchInput) searchInput.value = query;
    paint();
  };

  root.__setSubcategory = (id) => {
    if (!catalog.subcategories.some((item) => item.id === id)) return false;
    state.subcategory = id;
    state.page = 1;
    root.querySelectorAll("[data-subcategory]").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.subcategory === id);
    });
    paint();
    return true;
  };

  paint();
}

const PENDING_SUB_KEY = "comparex-pending-subcategory";

export function applyPendingSubcategory(slug) {
  const root = document.querySelector(`[data-category-browse="${slug}"]`);
  if (!root?.__setSubcategory) return false;
  let pending = null;
  try {
    const raw = sessionStorage.getItem(PENDING_SUB_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.category === slug) pending = data.subcategory;
    }
  } catch {
    pending = null;
  }
  sessionStorage.removeItem(PENDING_SUB_KEY);
  if (!pending) return false;
  return root.__setSubcategory(pending);
}

function pathPrefixFromLocation() {
  const path = window.location.pathname.replace(/\\/g, "/");
  if (path.includes("/pages/categories")) {
    return { home: "../../", search: "../search/" };
  }
  return { home: "./", search: "pages/search/" };
}

function activeBrowsableSlug() {
  const activePanel = document.querySelector(".category-panel.is-active[data-category-panel]");
  const slug = activePanel?.dataset.categoryPanel;
  return listBrowsableCategories().includes(slug) ? slug : null;
}

function interceptGlobalSearch() {
  document.addEventListener("submit", (event) => {
    const form = event.target.closest?.("[data-search-form]");
    if (!form) return;
    const slug = activeBrowsableSlug();
    if (!slug) return;
    const mount = document.querySelector(`[data-category-browse="${slug}"]`);
    if (!mount?.__categoryShopFilter) return;
    event.preventDefault();
    event.stopPropagation();
    const query = form.querySelector("[data-search-input]")?.value.trim() || "";
    mount.__categoryShopFilter(query);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, true);
}

export function initializeCategoryBrowse() {
  const paths = pathPrefixFromLocation();
  document.querySelectorAll("[data-category-browse]").forEach((root) => {
    const slug = root.dataset.categoryBrowse;
    const catalog = getCategoryCatalog(slug);
    if (!catalog) return;
    mountShop(root, catalog, paths);
  });
  interceptGlobalSearch();
}

export function refreshCategoryBrowse(slug) {
  const root = document.querySelector(`[data-category-browse="${slug}"]`);
  const catalog = getCategoryCatalog(slug);
  if (!root || !catalog) return;
  mountShop(root, catalog, pathPrefixFromLocation());
}
