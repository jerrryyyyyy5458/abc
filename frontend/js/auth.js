/* OTP authentication UI, session restore and logout. */
import { api, getAuthToken, setAuthToken, clearAuthToken } from "./api.js?v=auth1";

const AUTH_USER_KEY = "comparex-user";

function saveUser(user) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "null");
  } catch {
    return null;
  }
}

function clearUser() {
  localStorage.removeItem(AUTH_USER_KEY);
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidPhone(value) {
  const digits = digitsOnly(value);
  return digits.length === 10 || (digits.length >= 11 && digits.length <= 15);
}

function formatPhoneDestination(value) {
  const digits = digitsOnly(value);
  if (digits.length === 10) return `+91${digits}`;
  if (value.trim().startsWith("+")) return `+${digitsOnly(value)}`;
  return `+${digits}`;
}

const MODAL_HTML = `
<div class="modal-backdrop" data-login-modal aria-hidden="true">
  <section class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
    <button class="auth-modal-close" type="button" aria-label="Close" data-login-close>×</button>

    <div class="auth-panel is-active" data-auth-panel="method">
      <div class="auth-brand"><span class="brand-mark">×</span>Compare<span style="color:var(--accent)">X</span></div>
      <h2 id="auth-title">Sign in to CompareX</h2>
      <p class="auth-lead">Save wishlists, track prices and compare across stores — with a one-time password.</p>
      <div class="auth-method-list">
        <button class="auth-method" type="button" data-auth-choose="phone">
          <span class="auth-method-icon" aria-hidden="true">📱</span>
          <span><strong>Continue with Mobile Number</strong><span>Get an OTP on WhatsApp-ready SMS</span></span>
        </button>
        <button class="auth-method" type="button" data-auth-choose="email">
          <span class="auth-method-icon" aria-hidden="true">✉️</span>
          <span><strong>Continue with Email</strong><span>Get a one-time code in your inbox</span></span>
        </button>
      </div>
    </div>

    <div class="auth-panel" data-auth-panel="destination">
      <button class="auth-back" type="button" data-auth-back="method">← Back</button>
      <h2 data-auth-destination-title>Enter mobile number</h2>
      <p class="auth-lead" data-auth-destination-lead>We’ll send a 6-digit OTP to verify it’s you.</p>
      <label class="auth-field">
        <span data-auth-destination-label>Mobile number</span>
        <div class="auth-field-row" data-auth-phone-row>
          <span class="auth-prefix">+91</span>
          <input type="tel" inputmode="numeric" autocomplete="tel" placeholder="9876543210" maxlength="15" data-auth-phone>
        </div>
        <input type="email" autocomplete="email" placeholder="you@email.com" data-auth-email hidden>
      </label>
      <button class="button button-primary auth-submit" type="button" data-auth-send disabled>Continue <span>→</span></button>
      <p class="auth-message" data-auth-message></p>
    </div>

    <div class="auth-panel" data-auth-panel="otp">
      <button class="auth-back" type="button" data-auth-back="destination">← Back</button>
      <h2>Enter OTP</h2>
      <p class="auth-lead">Sent to <strong data-auth-masked></strong></p>
      <div class="auth-otp-boxes" data-auth-otp-boxes>
        <input type="text" inputmode="numeric" maxlength="1" aria-label="Digit 1" autocomplete="one-time-code">
        <input type="text" inputmode="numeric" maxlength="1" aria-label="Digit 2">
        <input type="text" inputmode="numeric" maxlength="1" aria-label="Digit 3">
        <input type="text" inputmode="numeric" maxlength="1" aria-label="Digit 4">
        <input type="text" inputmode="numeric" maxlength="1" aria-label="Digit 5">
        <input type="text" inputmode="numeric" maxlength="1" aria-label="Digit 6">
      </div>
      <div class="auth-otp-meta">
        <span data-auth-timer>Resend in 0:30</span>
        <button class="auth-resend" type="button" data-auth-resend disabled>Resend OTP</button>
      </div>
      <button class="button button-primary auth-submit" type="button" data-auth-verify>Verify OTP <span>→</span></button>
      <p class="auth-message" data-auth-otp-message></p>
    </div>

    <div class="auth-panel auth-success" data-auth-panel="success">
      <div class="auth-success-mark" aria-hidden="true">✓</div>
      <h2>You’re in</h2>
      <p class="auth-lead" data-auth-success-copy>Welcome to CompareX.</p>
    </div>
  </section>
</div>`;

export function initializeAuth() {
  ensureStylesheet();
  ensureModal();
  const modal = document.querySelector("[data-login-modal]");
  if (!modal) return;

  const state = {
    channel: "phone",
    destination: "",
    masked: "",
    resendIn: 30,
    timerId: null,
    secondsLeft: 0,
  };

  const panel = (name) => modal.querySelector(`[data-auth-panel="${name}"]`);
  const showPanel = (name) => {
    modal.querySelectorAll("[data-auth-panel]").forEach((el) => el.classList.toggle("is-active", el.dataset.authPanel === name));
  };
  const setMessage = (selector, text, type = "") => {
    const el = modal.querySelector(selector);
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-error", type === "error");
    el.classList.toggle("is-success", type === "success");
  };

  const phoneInput = modal.querySelector("[data-auth-phone]");
  const emailInput = modal.querySelector("[data-auth-email]");
  const phoneRow = modal.querySelector("[data-auth-phone-row]");
  const sendBtn = modal.querySelector("[data-auth-send]");
  const otpInputs = [...modal.querySelectorAll("[data-auth-otp-boxes] input")];

  const syncDestinationValidity = () => {
    const valid = state.channel === "phone"
      ? isValidPhone(phoneInput?.value)
      : isValidEmail(emailInput?.value);
    if (sendBtn) sendBtn.disabled = !valid;
  };

  const configureDestination = (channel) => {
    state.channel = channel;
    const isPhone = channel === "phone";
    modal.querySelector("[data-auth-destination-title]").textContent = isPhone ? "Enter mobile number" : "Enter email address";
    modal.querySelector("[data-auth-destination-lead]").textContent = isPhone
      ? "We’ll send a 6-digit OTP to verify it’s you."
      : "We’ll email a 6-digit OTP to verify it’s you.";
    modal.querySelector("[data-auth-destination-label]").textContent = isPhone ? "Mobile number" : "Email";
    phoneRow.hidden = !isPhone;
    phoneInput.hidden = !isPhone;
    emailInput.hidden = isPhone;
    setMessage("[data-auth-message]", "");
    syncDestinationValidity();
    showPanel("destination");
    (isPhone ? phoneInput : emailInput)?.focus();
  };

  const readOtp = () => otpInputs.map((input) => input.value).join("");

  const clearOtp = () => {
    otpInputs.forEach((input) => { input.value = ""; });
    otpInputs[0]?.focus();
  };

  const stopTimer = () => {
    window.clearInterval(state.timerId);
    state.timerId = null;
  };

  const startTimer = (seconds) => {
    stopTimer();
    state.secondsLeft = seconds;
    const timerEl = modal.querySelector("[data-auth-timer]");
    const resendBtn = modal.querySelector("[data-auth-resend]");
    const tick = () => {
      const mins = Math.floor(state.secondsLeft / 60);
      const secs = String(state.secondsLeft % 60).padStart(2, "0");
      if (timerEl) timerEl.textContent = state.secondsLeft > 0 ? `Resend in ${mins}:${secs}` : "Didn’t get it?";
      if (resendBtn) resendBtn.disabled = state.secondsLeft > 0;
      if (state.secondsLeft <= 0) {
        stopTimer();
        return;
      }
      state.secondsLeft -= 1;
    };
    tick();
    state.timerId = window.setInterval(tick, 1000);
  };

  const sendOtp = async ({ resend = false } = {}) => {
    const destination = state.channel === "phone"
      ? formatPhoneDestination(phoneInput.value)
      : emailInput.value.trim().toLowerCase();
    state.destination = destination;
    setMessage(resend ? "[data-auth-otp-message]" : "[data-auth-message]", resend ? "Sending again…" : "Sending OTP…");
    if (sendBtn) sendBtn.disabled = true;
    try {
      const result = await api.sendOtp({ channel: state.channel, destination });
      state.masked = result.masked_destination;
      state.resendIn = result.resend_in || 30;
      modal.querySelector("[data-auth-masked]").textContent = state.masked;
      clearOtp();
      showPanel("otp");
      startTimer(state.resendIn);
      setMessage("[data-auth-otp-message]", result.message || "OTP sent.", "success");
      setMessage("[data-auth-message]", "");
    } catch (error) {
      setMessage(resend ? "[data-auth-otp-message]" : "[data-auth-message]", error.message, "error");
      syncDestinationValidity();
    }
  };

  const verifyOtp = async () => {
    const otp = readOtp();
    if (otp.length !== 6) {
      setMessage("[data-auth-otp-message]", "Enter the complete 6-digit OTP.", "error");
      return;
    }
    setMessage("[data-auth-otp-message]", "Verifying…");
    try {
      const result = await api.verifyOtp({
        channel: state.channel,
        destination: state.destination,
        otp,
      });
      setAuthToken(result.access_token);
      saveUser(result.user);
      stopTimer();
      modal.querySelector("[data-auth-success-copy]").textContent = result.message || "Welcome to CompareX.";
      showPanel("success");
      updateAuthChrome(result.user);
      window.setTimeout(() => closeModal(), 1400);
    } catch (error) {
      setMessage("[data-auth-otp-message]", error.message, "error");
      clearOtp();
    }
  };

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    modal.inert = true;
    document.body.style.overflow = "";
    stopTimer();
  };

  const openModal = () => {
    showPanel("method");
    setMessage("[data-auth-message]", "");
    setMessage("[data-auth-otp-message]", "");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    modal.inert = false;
    document.body.style.overflow = "hidden";
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  document.querySelectorAll("[data-login-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      if (loadUser() && getAuthToken()) {
        const accountHref = trigger.dataset.accountHref || resolveAccountHref();
        if (trigger.tagName === "BUTTON" || trigger.getAttribute("href") === "#" || !trigger.getAttribute("href")) {
          event.preventDefault();
          window.location.href = accountHref;
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openModal();
    }, true);
  });

  modal.addEventListener("comparex:open-auth", () => openModal());

  modal.querySelector("[data-login-close]")?.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  modal.querySelectorAll("[data-auth-choose]").forEach((btn) => {
    btn.addEventListener("click", () => configureDestination(btn.dataset.authChoose));
  });
  modal.querySelectorAll("[data-auth-back]").forEach((btn) => {
    btn.addEventListener("click", () => showPanel(btn.dataset.authBack));
  });

  phoneInput?.addEventListener("input", () => {
    phoneInput.value = digitsOnly(phoneInput.value).slice(0, 15);
    syncDestinationValidity();
  });
  emailInput?.addEventListener("input", syncDestinationValidity);
  sendBtn?.addEventListener("click", () => sendOtp());
  modal.querySelector("[data-auth-resend]")?.addEventListener("click", () => sendOtp({ resend: true }));
  modal.querySelector("[data-auth-verify]")?.addEventListener("click", verifyOtp);

  otpInputs.forEach((input, index) => {
    input.addEventListener("input", (event) => {
      const value = digitsOnly(event.target.value).slice(-1);
      event.target.value = value;
      if (value && index < otpInputs.length - 1) otpInputs[index + 1].focus();
      if (readOtp().length === 6) verifyOtp();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !event.target.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
    input.addEventListener("paste", (event) => {
      event.preventDefault();
      const pasted = digitsOnly(event.clipboardData.getData("text")).slice(0, 6);
      pasted.split("").forEach((digit, i) => {
        if (otpInputs[i]) otpInputs[i].value = digit;
      });
      if (pasted.length === 6) verifyOtp();
      else otpInputs[Math.min(pasted.length, 5)]?.focus();
    });
  });

  document.querySelector("[data-auth-logout]")?.addEventListener("click", () => {
    logout();
  });

  restoreSession().then((user) => updateAuthChrome(user));
}

function ensureStylesheet() {
  if (document.querySelector('link[href*="auth.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  const base = document.querySelector('link[href*="global.css"]')?.href || "";
  link.href = base.includes("/pages/")
    ? "../../css/auth.css?v=auth1"
    : base.includes("css/")
      ? "css/auth.css?v=auth1"
      : "/css/auth.css?v=auth1";
  // Resolve relative to current page more reliably
  const path = window.location.pathname;
  if (path.includes("/pages/")) link.href = "../../css/auth.css?v=auth1";
  else link.href = "css/auth.css?v=auth1";
  document.head.appendChild(link);
}

function ensureModal() {
  const existing = document.querySelector("[data-login-modal]");
  if (existing?.querySelector("[data-auth-panel]")) return;
  existing?.remove();
  document.body.insertAdjacentHTML("beforeend", MODAL_HTML);
  const modal = document.querySelector("[data-login-modal]");
  if (modal) modal.inert = true;
}

async function restoreSession() {
  const token = getAuthToken();
  if (!token) {
    clearUser();
    return null;
  }
  try {
    const result = await api.me();
    saveUser(result.user);
    return result.user;
  } catch {
    clearAuthToken();
    clearUser();
    return null;
  }
}

export function logout() {
  clearAuthToken();
  clearUser();
  updateAuthChrome(null);
  api.logout().catch(() => {});
}

function updateAuthChrome(user) {
  document.querySelectorAll("[data-login-trigger]").forEach((trigger) => {
    if (trigger.matches(".account-trigger, .drawer-login, button")) {
      if (user) {
        const label = user.name || user.phone || user.email || "Account";
        trigger.classList.add("is-user");
        trigger.innerHTML = `${escapeHtml(String(label).slice(0, 18))} <span aria-hidden="true">↗</span>`;
        if (trigger.tagName === "BUTTON") {
          trigger.dataset.accountHref = trigger.dataset.accountHref || resolveAccountHref();
        }
      } else if (trigger.classList.contains("account-trigger")) {
        trigger.classList.remove("is-user");
        trigger.innerHTML = `Log in <span aria-hidden="true">↗</span>`;
      } else if (trigger.classList.contains("drawer-login")) {
        trigger.innerHTML = `Log in <span>→</span>`;
      }
    }
  });

  let logoutBtn = document.querySelector("[data-auth-logout]");
  const actions = document.querySelector(".nav-actions");
  if (user && actions && !logoutBtn) {
    logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "auth-logout-btn";
    logoutBtn.dataset.authLogout = "";
    logoutBtn.textContent = "Log out";
    logoutBtn.addEventListener("click", () => logout());
    actions.appendChild(logoutBtn);
  } else if (!user && logoutBtn) {
    logoutBtn.remove();
  }
}

function resolveAccountHref() {
  return window.location.pathname.includes("/pages/") ? "../account/" : "pages/account/";
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

export { loadUser, restoreSession };
