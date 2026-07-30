/* Search form behavior, hero mode tabs, rotating placeholders, category wheel. */
import { debounce } from "./utils.js";
import { SEARCH_MARKETPLACES, TRUSTED_STORES } from "./marketplace-data.js?v=trusted2";

const URL_PLACEHOLDERS = [
  "Paste Amazon Product URL...",
  "Paste Flipkart Product URL...",
  "Paste Nykaa Product URL...",
  "Paste Myntra Product URL...",
  "Paste AJIO Product URL...",
  "Paste Meesho Product URL...",
];

const QUERY_PLACEHOLDERS = [
  'Search "iPhone 16 Pro"',
  'Search "Minimalist Sunscreen"',
  'Search "Nike Air Max"',
  'Search "Atomic Habits"',
  'Search "Boat Airdopes"',
];

export function initializeSearch() {
  const form = document.querySelector("[data-search-form]");
  const input = document.querySelector("[data-search-input]");
  const placeholder = document.querySelector("[data-dynamic-placeholder]");
  const icon = document.querySelector("[data-search-icon]");
  const compareBox = document.querySelector("[data-hero-compare]");
  const tabs = document.querySelectorAll("[data-search-mode]");
  let mode = "url";
  let placeholderIndex = 0;
  let placeholderTimer = null;

  const placeholdersForMode = () => (mode === "url" ? URL_PLACEHOLDERS : QUERY_PLACEHOLDERS);

  const setPlaceholderText = (text, animate = false) => {
    if (!placeholder) return;
    if (!animate) {
      placeholder.textContent = text;
      return;
    }
    placeholder.classList.add("is-swap-out");
    window.setTimeout(() => {
      placeholder.textContent = text;
      placeholder.classList.remove("is-swap-out");
      placeholder.classList.add("is-swap-in");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => placeholder.classList.remove("is-swap-in"));
      });
    }, 180);
  };

  const stopPlaceholderCycle = () => {
    window.clearInterval(placeholderTimer);
    placeholderTimer = null;
  };

  const startPlaceholderCycle = () => {
    stopPlaceholderCycle();
    if (input?.value) return;
    placeholderTimer = window.setInterval(() => {
      if (input?.value) return;
      const list = placeholdersForMode();
      placeholderIndex = (placeholderIndex + 1) % list.length;
      setPlaceholderText(list[placeholderIndex], true);
    }, 2800);
  };

  const syncModeUi = () => {
    tabs.forEach((tab) => {
      const active = tab.dataset.searchMode === mode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (icon) icon.textContent = mode === "url" ? "🔗" : "🔍";
    placeholderIndex = 0;
    setPlaceholderText(placeholdersForMode()[0], false);
    startPlaceholderCycle();
  };

  const syncPlaceholder = () => {
    const hasValue = Boolean(input?.value);
    placeholder?.classList.toggle("is-hidden", hasValue);
    input?.closest(".search-input")?.classList.toggle("has-value", hasValue);
    if (hasValue) stopPlaceholderCycle();
    else startPlaceholderCycle();
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      mode = tab.dataset.searchMode || "url";
      syncModeUi();
      syncPlaceholder();
      input?.focus();
    });
  });

  if (compareBox) syncModeUi();
  else if (placeholder && !placeholder.textContent.trim()) {
    // Fallback for pages without the new hero tabs
    setPlaceholderText("Paste a product link or search…");
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = input?.value.trim();
    if (query) window.location.href = `pages/search/?query=${encodeURIComponent(query)}`;
  });

  document.querySelector("[data-clear-search]")?.addEventListener("click", () => {
    if (input) input.value = "";
    syncPlaceholder();
    input?.focus();
  });

  document.querySelectorAll("[data-search-suggestion]").forEach((button) => button.addEventListener("click", () => {
    if (!input) return;
    input.value = button.textContent;
    form?.requestSubmit();
  }));

  input?.addEventListener("input", syncPlaceholder);
  syncPlaceholder();

  input?.addEventListener("input", debounce(() => {
    const searches = JSON.parse(localStorage.getItem("comparex-recent-searches") || "[]");
    const query = input.value.trim();
    if (query.length > 2 && !searches.includes(query)) {
      localStorage.setItem("comparex-recent-searches", JSON.stringify([query, ...searches].slice(0, 5)));
    }
  }, 500));

  hydrateHeroStoreChips();
}

function hydrateHeroStoreChips() {
  const lookup = new Map(TRUSTED_STORES.map((store) => [store.name, store]));
  document.querySelectorAll("[data-hero-store]").forEach((chip) => {
    const store = lookup.get(chip.dataset.heroStore);
    if (!store) return;
    chip.innerHTML = `<img src="${store.logo}" alt="${store.name}" width="24" height="24">`;
    chip.title = store.name;
  });
}

export function initializeCategoryWheel() {
  const track = document.querySelector("[data-wheel-track]");
  if (!track) return;
  const scrollByCard = (direction) => track.scrollBy({ left: direction * 220, behavior: "smooth" });
  document.querySelector("[data-wheel-prev]")?.addEventListener("click", () => scrollByCard(-1));
  document.querySelector("[data-wheel-next]")?.addEventListener("click", () => scrollByCard(1));

  let startX = 0;
  let scrollStart = 0;
  let dragged = false;
  track.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    scrollStart = track.scrollLeft;
    dragged = false;
    track.dataset.wheelSuppressClick = "0";
    track.setPointerCapture(event.pointerId);
    track.classList.add("is-dragging");
  });
  track.addEventListener("pointermove", (event) => {
    if (!track.classList.contains("is-dragging")) return;
    const delta = event.clientX - startX;
    if (Math.abs(delta) > 8) dragged = true;
    track.scrollLeft = scrollStart - delta;
  });
  ["pointerup", "pointercancel"].forEach((eventName) => {
    track.addEventListener(eventName, () => {
      track.classList.remove("is-dragging");
      if (dragged) {
        track.dataset.wheelSuppressClick = "1";
        window.setTimeout(() => {
          track.dataset.wheelSuppressClick = "0";
        }, 0);
      }
    });
  });
  track.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      track.scrollLeft += event.deltaY;
    }
  }, { passive: false });
}
