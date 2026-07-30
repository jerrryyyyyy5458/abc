/* Uncached REST and live-search stream client. */
const API_BASE_URL = window.COMPAREX_API_URL || "http://127.0.0.1:5000";
const TOKEN_KEY = "comparex-token";

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const { headers = {}, auth = false, ...fetchOptions } = options;
  const finalHeaders = { "Content-Type": "application/json", ...headers };
  if (auth) {
    const token = getAuthToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    headers: finalHeaders,
    ...fetchOptions,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "We couldn't complete that request.");
  return payload;
}

function searchParams(query, stores = []) {
  const params = new URLSearchParams({ query });
  stores.forEach((store) => params.append("store", store));
  return params;
}

export const api = {
  search: (query, stores = []) => request(`/search?${searchParams(query, stores)}`),
  searchStream(query, stores, onEvent, onError) {
    const source = new EventSource(`${API_BASE_URL}/search/stream?${searchParams(query, stores)}`);
    source.onmessage = ({ data }) => {
      try { onEvent(JSON.parse(data), source); }
      catch (error) { onError?.(error, source); }
    };
    source.onerror = (error) => onError?.(error, source);
    return source;
  },
  stores: () => request("/stores"),
  login: (credentials) => request("/login", { method: "POST", body: JSON.stringify(credentials) }),
  register: (details) => request("/register", { method: "POST", body: JSON.stringify(details) }),
  sendOtp: (payload) => request("/auth/otp/send", { method: "POST", body: JSON.stringify(payload) }),
  verifyOtp: (payload) => request("/auth/otp/verify", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/auth/me", { auth: true }),
  logout: () => request("/auth/logout", { method: "POST", auth: true }),
  profile: () => request("/profile", { auth: true }),
  saveWishlist: (productId) => request("/wishlist", { method: "POST", body: JSON.stringify({ product_id: productId }), auth: true }),
  removeWishlist: (productId) => request(`/wishlist/${productId}`, { method: "DELETE", auth: true }),
};
