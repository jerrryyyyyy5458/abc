/* CompareX passwordless email authentication */

import {
  api,
  getAuthToken,
  setAuthToken,
  clearAuthToken
} from "./api.js?v=auth3";


const AUTH_USER_KEY = "comparex-user";


/* ---------------------------------------------------------
   USER STORAGE
--------------------------------------------------------- */

function saveUser(user) {
  if (!user) return;

  localStorage.setItem(
    AUTH_USER_KEY,
    JSON.stringify(user)
  );
}


function loadUser() {
  try {
    return JSON.parse(
      localStorage.getItem(AUTH_USER_KEY) || "null"
    );
  } catch {
    return null;
  }
}


function clearUser() {
  localStorage.removeItem(AUTH_USER_KEY);
}


/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || "").trim()
  );
}


function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char])
  );
}


/* ---------------------------------------------------------
   LOGIN MODAL
--------------------------------------------------------- */

const MODAL_HTML = `
<div
  class="modal-backdrop"
  data-login-modal
  aria-hidden="true"
>

  <section
    class="auth-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="auth-title"
  >

    <button
      class="auth-modal-close"
      type="button"
      aria-label="Close"
      data-login-close
    >
      ×
    </button>


    <!-- ================================================
         STEP 1 — EMAIL
    ================================================= -->

    <div
      class="auth-panel is-active"
      data-auth-panel="email"
    >

      <div class="auth-brand">
        <span class="brand-mark">×</span>
        Compare<span style="color:var(--accent)">X</span>
      </div>


      <h2 id="auth-title">
        Sign in to CompareX
      </h2>


      <p class="auth-lead">
        Enter your email address and we'll send you a
        one-time verification code.
      </p>


      <label class="auth-field">

        <span>Email address</span>

        <input
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          data-auth-email
        >

      </label>


      <button
        class="button button-primary auth-submit"
        type="button"
        data-auth-send
        disabled
      >
        <span data-send-text>Send OTP</span>
        <span>→</span>
      </button>


      <p
        class="auth-message"
        data-auth-message
      ></p>

    </div>


    <!-- ================================================
         STEP 2 — OTP
    ================================================= -->

    <div
      class="auth-panel"
      data-auth-panel="otp"
    >

      <button
        class="auth-back"
        type="button"
        data-auth-back="email"
      >
        ← Change email
      </button>


      <h2>
        Check your email
      </h2>


      <p class="auth-lead">
        We sent a 6-digit verification code to
        <strong data-auth-masked></strong>
      </p>


      <div
        class="auth-otp-boxes"
        data-auth-otp-boxes
      >

        <input
          type="text"
          inputmode="numeric"
          maxlength="1"
          aria-label="Digit 1"
          autocomplete="one-time-code"
        >

        <input
          type="text"
          inputmode="numeric"
          maxlength="1"
          aria-label="Digit 2"
        >

        <input
          type="text"
          inputmode="numeric"
          maxlength="1"
          aria-label="Digit 3"
        >

        <input
          type="text"
          inputmode="numeric"
          maxlength="1"
          aria-label="Digit 4"
        >

        <input
          type="text"
          inputmode="numeric"
          maxlength="1"
          aria-label="Digit 5"
        >

        <input
          type="text"
          inputmode="numeric"
          maxlength="1"
          aria-label="Digit 6"
        >

      </div>


      <div class="auth-otp-meta">

        <span data-auth-timer>
          Code expires in 5:00
        </span>

        <button
          class="auth-resend"
          type="button"
          data-auth-resend
          disabled
        >
          Resend OTP
        </button>

      </div>


      <button
        class="button button-primary auth-submit"
        type="button"
        data-auth-verify
      >
        Verify OTP
        <span>→</span>
      </button>


      <p
        class="auth-message"
        data-auth-otp-message
      ></p>

    </div>


    <!-- ================================================
         STEP 3 — NAME
    ================================================= -->

    <div
      class="auth-panel"
      data-auth-panel="name"
    >

      <div class="auth-success-mark">
        ✓
      </div>


      <h2>
        Almost done
      </h2>


      <p class="auth-lead">
        Your email has been verified.
        What should we call you?
      </p>


      <label class="auth-field">

        <span>Your name</span>

        <input
          type="text"
          autocomplete="name"
          placeholder="Enter your name"
          maxlength="80"
          data-auth-name
        >

      </label>


      <button
        class="button button-primary auth-submit"
        type="button"
        data-auth-save-name
        disabled
      >
        Complete Login
        <span>→</span>
      </button>


      <p
        class="auth-message"
        data-auth-name-message
      ></p>

    </div>


    <!-- ================================================
         STEP 4 — SUCCESS
    ================================================= -->

    <div
      class="auth-panel auth-success"
      data-auth-panel="success"
    >

      <div class="auth-success-mark">
        ✓
      </div>


      <h2>
        You're in!
      </h2>


      <p
        class="auth-lead"
        data-auth-success-copy
      >
        Welcome to CompareX.
      </p>

    </div>

  </section>

</div>
`;


/* ---------------------------------------------------------
   INITIALIZE AUTH
--------------------------------------------------------- */

export function initializeAuth() {

  ensureStylesheet();
  ensureModal();

  const modal = document.querySelector(
    "[data-login-modal]"
  );

  if (!modal) return;


  const state = {
    email: "",
    maskedEmail: "",
    expiresSeconds: 300,
    resendSeconds: 30,
    timerId: null,
    accessToken: "",
    user: null
  };


  /* -------------------------------------------------------
     PANEL SWITCHING
  ------------------------------------------------------- */

  const showPanel = (name) => {

    modal
      .querySelectorAll("[data-auth-panel]")
      .forEach((panel) => {

        panel.classList.toggle(
          "is-active",
          panel.dataset.authPanel === name
        );

      });

  };


  /* -------------------------------------------------------
     MESSAGES
  ------------------------------------------------------- */

  const setMessage = (
    selector,
    message,
    type = ""
  ) => {

    const element =
      modal.querySelector(selector);

    if (!element) return;

    element.textContent =
      message || "";

    element.classList.toggle(
      "is-error",
      type === "error"
    );

    element.classList.toggle(
      "is-success",
      type === "success"
    );

  };


  /* -------------------------------------------------------
     ELEMENTS
  ------------------------------------------------------- */

  const emailInput =
    modal.querySelector("[data-auth-email]");

  const sendButton =
    modal.querySelector("[data-auth-send]");

  const nameInput =
    modal.querySelector("[data-auth-name]");

  const saveNameButton =
    modal.querySelector("[data-auth-save-name]");

  const otpInputs = [
    ...modal.querySelectorAll(
      "[data-auth-otp-boxes] input"
    )
  ];


  /* -------------------------------------------------------
     EMAIL VALIDATION
  ------------------------------------------------------- */

  const validateEmail = () => {

    const valid =
      isValidEmail(
        emailInput?.value
      );

    if (sendButton) {
      sendButton.disabled = !valid;
    }

    return valid;

  };


  emailInput?.addEventListener(
    "input",
    validateEmail
  );

  emailInput?.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" && validateEmail()) {
        event.preventDefault();
        sendOtp();
      }
    }
  );


  /* -------------------------------------------------------
     TIMER
  ------------------------------------------------------- */

  const stopTimer = () => {

    if (state.timerId) {

      window.clearInterval(
        state.timerId
      );

      state.timerId = null;

    }

  };


  const startTimer = (expiresIn = 300, resendIn = 30) => {

    stopTimer();

    state.expiresSeconds =
      Math.max(
        0,
        Number(expiresIn) || 300
      );

    state.resendSeconds =
      Math.max(
        0,
        Number(resendIn) || 30
      );

    const timer =
      modal.querySelector(
        "[data-auth-timer]"
      );

    const resend =
      modal.querySelector(
        "[data-auth-resend]"
      );


    const tick = () => {

      const minutes =
        Math.floor(
          state.expiresSeconds / 60
        );

      const remainingSeconds =
        String(
          state.expiresSeconds % 60
        ).padStart(2, "0");


      if (timer) {

        timer.textContent =
          state.expiresSeconds > 0
            ? `Code expires in ${minutes}:${remainingSeconds}`
            : "Code expired";

      }


      if (resend) {

        if (state.resendSeconds > 0) {
          resend.disabled = true;
          resend.textContent = `Resend OTP (${state.resendSeconds}s)`;
        } else {
          resend.disabled = false;
          resend.textContent = "Resend OTP";
        }

      }


      if (state.expiresSeconds <= 0 && state.resendSeconds <= 0) {

        stopTimer();

        return;

      }


      if (state.expiresSeconds > 0) {
        state.expiresSeconds--;
      }

      if (state.resendSeconds > 0) {
        state.resendSeconds--;
      }

    };


    tick();

    state.timerId =
      window.setInterval(
        tick,
        1000
      );

  };


  /* -------------------------------------------------------
     MASK EMAIL
  ------------------------------------------------------- */

  const maskEmail = (email) => {

    const [name, domain] =
      email.split("@");

    if (!name || !domain) {
      return email;
    }

    const visible =
      name.length <= 2
        ? name[0]
        : name.slice(0, 2);

    return `${visible}***@${domain}`;

  };


  /* -------------------------------------------------------
     CLEAR OTP
  ------------------------------------------------------- */

  const clearOtp = () => {

    otpInputs.forEach(
      (input) => {
        input.value = "";
      }
    );

    otpInputs[0]?.focus();

  };


  const readOtp = () => {

    return otpInputs
      .map(
        (input) =>
          input.value
      )
      .join("");

  };


  /* -------------------------------------------------------
     SEND OTP
  ------------------------------------------------------- */

  const sendOtp = async ({
    resend = false
  } = {}) => {

    const email =
      emailInput.value
        .trim()
        .toLowerCase();


    if (!isValidEmail(email)) {

      setMessage(
        "[data-auth-message]",
        "Please enter a valid email address.",
        "error"
      );

      return;

    }


    state.email = email;


    const sendText =
      modal.querySelector(
        "[data-send-text]"
      );


    if (sendButton) {
      sendButton.disabled = true;
    }


    if (sendText) {
      sendText.textContent =
        "Sending...";
    }


    setMessage(
      "[data-auth-message]",
      resend
        ? "Sending a new OTP..."
        : "Sending your verification code..."
    );


    try {

      const result =
        await api.sendOtp({
          channel: "email",
          destination: email
        });


      state.maskedEmail =
        result.masked_destination ||
        maskEmail(email);


      const maskedElement =
        modal.querySelector(
          "[data-auth-masked]"
        );

      if (maskedElement) {
        maskedElement.textContent =
          state.maskedEmail;
      }


      clearOtp();

      showPanel("otp");


      startTimer(
        Number(
          result.expires_in || 300
        ),
        Number(
          result.resend_in || 30
        )
      );


      setMessage(
        "[data-auth-otp-message]",
        result.message || "OTP sent successfully. Please check your email.",
        "success"
      );

    } catch (error) {

      setMessage(
        "[data-auth-message]",
        error.message ||
          "Unable to send the verification code.",
        "error"
      );

    } finally {

      if (sendText) {
        sendText.textContent =
          "Send OTP";
      }

      validateEmail();

    }

  };


  /* -------------------------------------------------------
     VERIFY OTP
  ------------------------------------------------------- */

  const verifyOtp = async () => {

    const otp = readOtp();


    if (otp.length !== 6) {

      setMessage(
        "[data-auth-otp-message]",
        "Please enter the complete 6-digit code.",
        "error"
      );

      return;

    }


    const verifyButton =
      modal.querySelector(
        "[data-auth-verify]"
      );


    if (verifyButton) {
      verifyButton.disabled = true;
    }


    setMessage(
      "[data-auth-otp-message]",
      "Verifying your code..."
    );


    try {

      const result =
        await api.verifyOtp({

          channel: "email",

          destination: state.email,

          otp

        });


      state.accessToken =
        result.access_token || "";

      state.user =
        result.user || null;


      /*
       * If the backend says the user already
       * has a name, finish login immediately.
       *
       * If needs_name is true, show the name screen.
       */

      if (!result.needs_name) {

        finishLogin(
          state.user,
          state.accessToken
        );

        return;

      }


      stopTimer();

      showPanel("name");

      nameInput?.focus();


    } catch (error) {

      setMessage(
        "[data-auth-otp-message]",
        error.message ||
          "The code is incorrect or expired.",
        "error"
      );

      clearOtp();

    } finally {

      if (verifyButton) {
        verifyButton.disabled = false;
      }

    }

  };


  /* -------------------------------------------------------
     NAME VALIDATION
  ------------------------------------------------------- */

  const validateName = () => {

    const name =
      nameInput?.value
        .trim() || "";


    const valid =
      name.length >= 2 &&
      name.length <= 80;


    if (saveNameButton) {
      saveNameButton.disabled =
        !valid;
    }


    return valid;

  };


  nameInput?.addEventListener(
    "input",
    validateName
  );

  nameInput?.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" && validateName()) {
        event.preventDefault();
        saveName();
      }
    }
  );


  /* -------------------------------------------------------
     SAVE NAME
  ------------------------------------------------------- */

  const saveName = async () => {

    const name =
      nameInput.value.trim();


    if (!validateName()) {

      setMessage(
        "[data-auth-name-message]",
        "Please enter your name.",
        "error"
      );

      return;

    }


    saveNameButton.disabled = true;


    setMessage(
      "[data-auth-name-message]",
      "Saving your name..."
    );


    try {

      /*
       * The OTP verification already returned
       * an access token.
       *
       * We temporarily store it so the
       * authenticated PATCH /profile request
       * can save the user's name.
       */

      setAuthToken(
        state.accessToken
      );


      const result =
        await api.updateProfile({
          name
        });


      const user =
        result.user || {
          ...(state.user || {}),
          name
        };


      state.user = user;


      finishLogin(
        user,
        state.accessToken
      );


    } catch (error) {

      setMessage(
        "[data-auth-name-message]",
        error.message ||
          "We couldn't save your name.",
        "error"
      );

      saveNameButton.disabled =
        false;

    }

  };


  /* -------------------------------------------------------
     FINISH LOGIN
  ------------------------------------------------------- */

  const finishLogin = (
    user,
    token
  ) => {

    if (token) {
      setAuthToken(token);
    }


    saveUser(user);


    const successCopy =
      modal.querySelector(
        "[data-auth-success-copy]"
      );


    if (successCopy) {

      successCopy.textContent =
        `Welcome to CompareX, ${
          user?.name || "there"
        }!`;

    }


    showPanel("success");


    updateAuthChrome(user);


    window.dispatchEvent(
      new CustomEvent("comparex:auth-change", {
        detail: user
      })
    );


    window.setTimeout(
      () => closeModal(),
      1400
    );

  };


  /* -------------------------------------------------------
     OPEN / CLOSE
  ------------------------------------------------------- */

  const closeModal = () => {

    modal.classList.remove(
      "is-open"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    modal.inert = true;

    document.body.style.overflow = "";

    stopTimer();

  };


  const openModal = () => {

    showPanel("email");


    setMessage(
      "[data-auth-message]",
      ""
    );

    setMessage(
      "[data-auth-otp-message]",
      ""
    );

    setMessage(
      "[data-auth-name-message]",
      ""
    );


    if (emailInput) {
      emailInput.value = "";
    }


    if (nameInput) {
      nameInput.value = "";
    }


    clearOtp();

    validateEmail();


    modal.classList.add(
      "is-open"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    modal.inert = false;

    document.body.style.overflow =
      "hidden";


    window.setTimeout(
      () => emailInput?.focus(),
      50
    );

  };


  /* -------------------------------------------------------
     LOGIN BUTTON
  ------------------------------------------------------- */

  document
    .querySelectorAll(
      "[data-login-trigger]"
    )
    .forEach((trigger) => {

      trigger.addEventListener(
        "click",
        (event) => {

          /*
           * Prevent the navbar/account handler
           * from navigating away from the page.
           */

          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();


          if (
            loadUser() &&
            getAuthToken()
          ) {

            const accountHref =
              trigger.dataset.accountHref ||
              resolveAccountHref();


            window.location.href =
              accountHref;

            return;

          }


          openModal();

        },
        true
      );

    });


  /* -------------------------------------------------------
     CLOSE
  ------------------------------------------------------- */

  modal
    .querySelector(
      "[data-login-close]"
    )
    ?.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();

        closeModal();

      }
    );


  modal.addEventListener(
    "click",
    (event) => {

      if (
        event.target === modal
      ) {

        closeModal();

      }

    }
  );


  /* -------------------------------------------------------
     BACK BUTTONS
  ------------------------------------------------------- */

  modal
    .querySelectorAll(
      "[data-auth-back]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        (event) => {

          event.preventDefault();
          event.stopPropagation();

          const target =
            button.dataset.authBack;


          showPanel(target);


          if (
            target === "email"
          ) {

            validateEmail();

            emailInput?.focus();

          }

        }
      );

    });


  /* -------------------------------------------------------
     SEND
  ------------------------------------------------------- */

  sendButton?.addEventListener(
    "click",
    async (event) => {

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      await sendOtp();

    }
  );


  /* -------------------------------------------------------
     RESEND
  ------------------------------------------------------- */

  modal
    .querySelector(
      "[data-auth-resend]"
    )
    ?.addEventListener(
      "click",
      async (event) => {

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        await sendOtp({
          resend: true
        });

      }
    );


  /* -------------------------------------------------------
     VERIFY
  ------------------------------------------------------- */

  modal
    .querySelector(
      "[data-auth-verify]"
    )
    ?.addEventListener(
      "click",
      async (event) => {

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        await verifyOtp();

      }
    );


  /* -------------------------------------------------------
     SAVE NAME BUTTON
  ------------------------------------------------------- */

  saveNameButton?.addEventListener(
    "click",
    async (event) => {

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      await saveName();

    }
  );


  /* -------------------------------------------------------
     OTP INPUTS
  ------------------------------------------------------- */

  otpInputs.forEach(
    (input, index) => {

      input.addEventListener(
        "input",
        (event) => {

          const value =
            String(
              event.target.value
            )
              .replace(/\D/g, "")
              .slice(-1);


          event.target.value =
            value;


          if (
            value &&
            index <
              otpInputs.length - 1
          ) {

            otpInputs[
              index + 1
            ].focus();

          }


          if (
            readOtp().length === 6
          ) {

            verifyOtp();

          }

        }
      );


      input.addEventListener(
        "keydown",
        (event) => {

          if (
            event.key === "Backspace" &&
            !event.target.value &&
            index > 0
          ) {

            otpInputs[
              index - 1
            ].focus();

          }

        }
      );


      input.addEventListener(
        "paste",
        (event) => {

          event.preventDefault();


          const pasted =
            event.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, 6);


          pasted
            .split("")
            .forEach(
              (digit, i) => {

                if (
                  otpInputs[i]
                ) {

                  otpInputs[i].value =
                    digit;

                }

              }
            );


          if (
            pasted.length === 6
          ) {

            verifyOtp();

          } else {

            otpInputs[
              Math.min(
                pasted.length,
                5
              )
            ]?.focus();

          }

        }
      );

    }
  );


  /* -------------------------------------------------------
     LOGOUT
  ------------------------------------------------------- */

  document
    .querySelectorAll(
      "[data-auth-logout]"
    )
    .forEach((btn) => {
      btn.addEventListener(
        "click",
        logout
      );
    });


  /* -------------------------------------------------------
     RESTORE SESSION
  ------------------------------------------------------- */

  const cachedUser = loadUser();

  if (cachedUser && getAuthToken()) {
    updateAuthChrome(cachedUser);
  }

  restoreSession()
    .then((user) => {
      updateAuthChrome(user);
    });

}


/* =========================================================
   STYLESHEET
========================================================= */

function ensureStylesheet() {

  if (
    document.querySelector(
      'link[href*="auth.css"]'
    )
  ) {

    return;

  }


  const link =
    document.createElement("link");

  link.rel = "stylesheet";


  const path =
    window.location.pathname;


  link.href =
    path.includes("/pages/")
      ? "../../css/auth.css?v=auth3"
      : "css/auth.css?v=auth3";


  document.head.appendChild(link);

}


/* =========================================================
   MODAL
========================================================= */

function ensureModal() {

  const existing =
    document.querySelector(
      "[data-login-modal]"
    );


  /*
   * If an older modal is already present,
   * remove it so the current modal HTML
   * is always used.
   */

  if (existing) {
    existing.remove();
  }


  document.body.insertAdjacentHTML(
    "beforeend",
    MODAL_HTML
  );


  const modal =
    document.querySelector(
      "[data-login-modal]"
    );


  if (modal) {
    modal.inert = true;
  }

}


/* =========================================================
   RESTORE SESSION
========================================================= */

async function restoreSession() {

  const token =
    getAuthToken();


  if (!token) {

    clearUser();

    return null;

  }


  try {

    const result =
      await api.me();


    saveUser(
      result.user
    );


    return result.user;

  } catch {

    clearAuthToken();
    clearUser();

    return null;

  }

}


/* =========================================================
   LOGOUT
========================================================= */

export function logout() {

  clearAuthToken();

  clearUser();

  updateAuthChrome(null);

  window.dispatchEvent(
    new CustomEvent("comparex:auth-change", {
      detail: null
    })
  );

  api.logout()
    .catch(() => {});

}


/* =========================================================
   UPDATE NAVBAR
========================================================= */

function updateAuthChrome(user) {

  document
    .querySelectorAll(
      "[data-login-trigger]"
    )
    .forEach((trigger) => {

      if (
        trigger.matches(
          ".account-trigger, .drawer-login, button"
        )
      ) {

        if (user) {

          const label =
            user.name ||
            user.email ||
            "Account";


          trigger.classList.add(
            "is-user"
          );


          trigger.innerHTML =
            `${escapeHtml(
              String(label)
                .slice(0, 18)
            )} <span aria-hidden="true">↗</span>`;


          if (
            trigger.tagName === "BUTTON"
          ) {

            trigger.dataset.accountHref =
              trigger.dataset.accountHref ||
              resolveAccountHref();

          }


        } else {

          trigger.classList.remove(
            "is-user"
          );


          if (
            trigger.classList.contains(
              "account-trigger"
            )
          ) {

            trigger.innerHTML =
              `Log in <span aria-hidden="true">↗</span>`;

          } else if (
            trigger.classList.contains(
              "drawer-login"
            )
          ) {

            trigger.innerHTML =
              `Log in <span>→</span>`;

          } else {

            trigger.innerHTML =
              "Log in";

          }

        }

      }

    });


  const actions =
    document.querySelector(
      ".nav-actions"
    );

  const navLogoutBtn =
    actions?.querySelector(
      ".auth-logout-btn"
    );


  if (
    user &&
    actions &&
    !navLogoutBtn
  ) {

    const logoutBtn =
      document.createElement(
        "button"
      );


    logoutBtn.type =
      "button";

    logoutBtn.className =
      "auth-logout-btn";

    logoutBtn.dataset.authLogout =
      "";

    logoutBtn.textContent =
      "Log out";


    logoutBtn.addEventListener(
      "click",
      logout
    );


    actions.appendChild(
      logoutBtn
    );

  }


  if (
    !user &&
    navLogoutBtn
  ) {

    navLogoutBtn.remove();

  }

}


/* =========================================================
   ACCOUNT URL
========================================================= */

function resolveAccountHref() {

  return window.location.pathname.includes(
    "/pages/"
  )
    ? "../account/"
    : "pages/account/";

}


/* =========================================================
   EXPORTS
========================================================= */

export {
  loadUser,
  restoreSession
};