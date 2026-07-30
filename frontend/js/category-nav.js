/* Category strip: active state, sliding underline, placeholder panels. */

import { applyPendingSubcategory } from "./category-browse.js";

const STORAGE_KEY = "comparex-active-category";
const PENDING_SUB_KEY = "comparex-pending-subcategory";
const DEFAULT_CATEGORY = "electronics";
const VALID_CATEGORIES = new Set([
  "electronics",
  "beauty",
  "fashion",
  "home",
  "appliances",
  "sports",
  "books",
  "more",
]);

/** @type {((category: string | null, opts?: { syncHash?: boolean, forceScroll?: boolean }) => void) | null} */
let setActiveRef = null;

function resolveCategory(candidate) {
  const value = String(candidate || "").toLowerCase().replace(/^#/, "");
  return VALID_CATEGORIES.has(value) ? value : null;
}

export function queueCategorySubcategory(category, subcategory) {
  const slug = resolveCategory(category);
  if (slug && subcategory) {
    sessionStorage.setItem(PENDING_SUB_KEY, JSON.stringify({ category: slug, subcategory: String(subcategory) }));
    return;
  }
  sessionStorage.removeItem(PENDING_SUB_KEY);
}

/** Same path as the top category strip — used by “Pick your next obsession” chips. */
export function navigateToCategory(category, { subcategory = null } = {}) {
  const slug = resolveCategory(category) || DEFAULT_CATEGORY;
  queueCategorySubcategory(slug, subcategory);
  if (setActiveRef) {
    setActiveRef(slug, { forceScroll: true });
  } else {
    sessionStorage.setItem(STORAGE_KEY, slug);
    const url = new URL(window.location.href);
    history.replaceState(null, "", `${url.pathname}${url.search}#${slug}`);
  }
  requestAnimationFrame(() => applyPendingSubcategory(slug));
}

function wireCategoryLaunchers() {
  document.querySelectorAll("[data-category-launch]").forEach((chip) => {
    chip.addEventListener("click", (event) => {
      if (chip.closest(".wheel-track")?.dataset.wheelSuppressClick === "1") {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      navigateToCategory(chip.dataset.categoryLaunch, {
        subcategory: chip.dataset.subcategoryLaunch || null,
      });
    });
    chip.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      navigateToCategory(chip.dataset.categoryLaunch, {
        subcategory: chip.dataset.subcategoryLaunch || null,
      });
    });
  });
}

function moveIndicator(track, indicator, item) {
  if (!track || !indicator) return;
  if (!item) {
    indicator.classList.remove("is-ready");
    indicator.style.width = "0px";
    return;
  }
  const trackRect = track.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const left = itemRect.left - trackRect.left + track.scrollLeft;
  const underlineWidth = Math.min(itemRect.width * 0.55, 56);
  const underlineLeft = left + (itemRect.width - underlineWidth) / 2;
  indicator.style.width = `${underlineWidth}px`;
  indicator.style.left = `${underlineLeft}px`;
  indicator.classList.add("is-ready");
}

function ensureItemVisible(track, item) {
  if (!track || !item) return;
  const trackRect = track.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  if (itemRect.left < trackRect.left) {
    track.scrollBy({ left: itemRect.left - trackRect.left - 16, behavior: "smooth" });
  } else if (itemRect.right > trackRect.right) {
    track.scrollBy({ left: itemRect.right - trackRect.right + 16, behavior: "smooth" });
  }
}

function readInitialCategory(hasDiscoverView) {
  const fromHash = resolveCategory(window.location.hash);
  if (fromHash) return fromHash;
  // Home defaults to Discover; only hash (or in-page clicks) switches categories.
  if (hasDiscoverView) return null;
  const fromStorage = resolveCategory(sessionStorage.getItem(STORAGE_KEY));
  if (fromStorage) return fromStorage;
  return DEFAULT_CATEGORY;
}

export function initializeCategoryNav() {
  const root = document.querySelector("[data-category-nav]");
  if (!root) return;

  const track = root.querySelector("[data-category-track]");
  const indicator = root.querySelector("[data-category-indicator]");
  const items = [...root.querySelectorAll("[data-category]")];
  const panels = [...document.querySelectorAll("[data-category-panel]")];
  const discoverView = document.querySelector("[data-discover-view]");
  const categoryStage = document.querySelector("[data-category-stage]");
  if (!track || !items.length) return;

  let active = readInitialCategory(Boolean(discoverView));

  const setActive = (category, { syncHash = true, forceScroll = false } = {}) => {
    const next = category === null ? null : (resolveCategory(category) || DEFAULT_CATEGORY);
    const changed = next !== active;
    active = next;

    if (next) sessionStorage.setItem(STORAGE_KEY, next);
    else sessionStorage.removeItem(STORAGE_KEY);

    items.forEach((item) => {
      const isActive = item.dataset.category === next;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", String(isActive));
      item.setAttribute("tabindex", isActive || next === null ? "0" : "-1");
    });

    panels.forEach((panel) => {
      panel.classList.toggle("is-active", Boolean(next) && panel.dataset.categoryPanel === next);
    });

    if (discoverView && categoryStage) {
      const showingCategory = Boolean(next);
      discoverView.hidden = showingCategory;
      categoryStage.hidden = !showingCategory;
      if (showingCategory && (changed || forceScroll)) window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const activeItem = items.find((item) => item.dataset.category === next);
    ensureItemVisible(track, activeItem);
    requestAnimationFrame(() => moveIndicator(track, indicator, activeItem));

    if (syncHash) {
      const url = new URL(window.location.href);
      const nextUrl = next
        ? `${url.pathname}${url.search}#${next}`
        : `${url.pathname}${url.search}`;
      history.replaceState(null, "", nextUrl);
    }
  };

  setActiveRef = setActive;

  items.forEach((item) => {
    item.addEventListener("click", () => {
      sessionStorage.removeItem(PENDING_SUB_KEY);
      setActive(item.dataset.category);
    });
    item.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = items.indexOf(item);
      let nextIndex = index;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = items.length - 1;
      items[nextIndex]?.focus();
      sessionStorage.removeItem(PENDING_SUB_KEY);
      setActive(items[nextIndex].dataset.category);
    });
  });

  document.querySelectorAll(".desktop-nav a").forEach((link) => {
    if (link.textContent.trim() !== "Discover") return;
    link.addEventListener("click", (event) => {
      if (!discoverView || !categoryStage || !active) return;
      event.preventDefault();
      setActive(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  window.addEventListener("hashchange", () => {
    const fromHash = resolveCategory(window.location.hash);
    if (fromHash !== active) setActive(fromHash, { syncHash: false });
  });

  window.addEventListener("resize", () => {
    const activeItem = items.find((item) => item.dataset.category === active);
    moveIndicator(track, indicator, activeItem);
  }, { passive: true });

  track.addEventListener("scroll", () => {
    const activeItem = items.find((item) => item.dataset.category === active);
    moveIndicator(track, indicator, activeItem);
  }, { passive: true });

  setActive(active, { syncHash: Boolean(active) && !window.location.hash });
  wireCategoryLaunchers();
  if (active) requestAnimationFrame(() => applyPendingSubcategory(active));
}
