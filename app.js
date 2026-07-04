const AUTH_KEY = "taskflow_auth";
const TASKS_STORAGE_KEY = "taskflow_tasks";
const NOTIFICATIONS_STORAGE_KEY = "taskflow_notifications";
const USERS = {
  admin: {
    email: "admin@taskflow.local",
    password: "123456",
    name: "Ana Admin",
    role: "Admin",
    defaultPath: "/dashboard.html",
  },
  member: {
    email: "member@taskflow.local",
    password: "123456",
    name: "Bruno Member",
    role: "Membro",
    defaultPath: "/tarefas.html",
  },
};

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

function writeAuth(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

function isLoggedIn() {
  return Boolean(readAuth());
}

function isAdmin() {
  return readAuth()?.role === "Admin";
}

function resolveLoginTarget(role) {
  const auth = readAuth();
  if (auth?.role === "Admin") {
    return "/dashboard.html";
  }
  if (auth?.role === "Membro") {
    return "/tarefas.html";
  }
  return role === "admin" ? USERS.admin.defaultPath : USERS.member.defaultPath;
}

function normalizePath(pathname) {
  return pathname.replace(/\/$/, "") || "/";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readStoredList(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function writeStoredList(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

function isForcedLoginView() {
  return new URLSearchParams(window.location.search).get("force") === "1";
}

function transitionTo(url) {
  document.body.classList.add("page-leaving");
  window.setTimeout(() => {
    window.location.href = url;
  }, 180);
}

function injectSessionChip() {
  const topbar = document.querySelector(".topbar");
  if (!topbar || topbar.querySelector("[data-session-chip]")) {
    return;
  }

  const auth = readAuth();
  const chip = document.createElement("div");
  chip.className = "session-chip";
  chip.setAttribute("data-session-chip", "true");

  if (auth) {
    chip.innerHTML = `
      <span class="session-chip__meta">Sessão ativa</span>
      <strong class="session-chip__name">${auth.name}</strong>
      <span class="session-chip__role">${auth.role}</span>
      <a class="button session-chip__button" href="/logout.html">Sair</a>
    `;
  } else {
    chip.innerHTML = `
      <span class="session-chip__meta">Sem sessão</span>
      <strong class="session-chip__name">Faça login</strong>
      <a class="button session-chip__button" href="/login.html?force=1">Entrar</a>
    `;
  }

  topbar.appendChild(chip);
}

function updateNavState() {
  const currentPath = normalizePath(window.location.pathname);
  const auth = readAuth();

  document.querySelectorAll("[data-nav]").forEach((link) => {
    const linkPath = normalizePath(new URL(link.href, window.location.origin).pathname);
    link.classList.toggle("active", linkPath === currentPath);
  });

  if (auth && !isAdmin()) {
    document.querySelectorAll('[href="/equipes.html"]').forEach((link) => {
      link.hidden = true;
    });
  }
}

function redirectIfNeeded() {
  const body = document.body;
  const page = body.dataset.page || "";
  if (page === "login" || page === "logout") {
    return;
  }

  const auth = readAuth();
  if (!auth) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/login.html?next=${next}`);
    return;
  }

  if (body.dataset.adminOnly === "true" && auth.role !== "Admin") {
    window.location.replace("/dashboard.html");
  }
}

function bindNavigationTransitions() {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) {
        return;
      }

      event.preventDefault();
      transitionTo(url.pathname + url.search + url.hash);
    });
  });
}

function tryLogin(form, message, next) {
  if (!form) {
    return;
  }

  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const account = Object.values(USERS).find(
    (entry) => entry.email.toLowerCase() === email && entry.password === password
  );

  if (!account) {
    if (message) message.textContent = "E-mail ou senha inválidos.";
    return;
  }

  writeAuth({
    email: account.email,
    name: account.name,
    role: account.role,
  });

  if (message) {
    message.textContent = `Acesso concedido. Redirecionando para ${account.role === "Admin" ? "o painel admin" : "as tarefas"}...`;
  }

  const target = next ? decodeURIComponent(next) : account.defaultPath;
  window.setTimeout(() => {
    window.location.href = target;
  }, 180);
}

function bindLoginPage() {
  const form = document.querySelector("#login-form");
  const message = document.querySelector("#login-message");
  const next = new URLSearchParams(window.location.search).get("next");
  const submitButton = form?.querySelector("#login-submit");
  const emailInput = document.querySelector("#login-email");
  const passwordInput = document.querySelector("#login-password");

  const submitLogin = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    tryLogin(form, message, next);
  };

  form?.addEventListener("submit", submitLogin);
  submitButton?.addEventListener("click", submitLogin);

  [emailInput, passwordInput].forEach((input) => {
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        submitLogin(event);
      }
    });
  });
}

function bindLogoutPage() {
  const message = document.querySelector("#logout-message");
  const confirmButton = document.querySelector("#confirm-logout");

  if (message) {
    const auth = readAuth();
    if (auth) {
      message.textContent = `Você está saindo como ${auth.name} (${auth.role}).`;
    }
  }

  confirmButton?.addEventListener("click", () => {
    clearAuth();
    window.location.href = "/login.html?force=1";
  });

  window.setTimeout(() => {
    clearAuth();
    if (message) {
      message.textContent = "Sessão encerrada. Voltando para o login...";
    }
    window.setTimeout(() => {
      window.location.href = "/login.html?force=1";
    }, 700);
  }, 500);
}

function showRoleHints() {
  const auth = readAuth();
  document.querySelectorAll("[data-role-note]").forEach((node) => {
    node.textContent = auth?.role === "Admin"
      ? "Você está logado como Admin. Acesso completo ao painel."
      : auth?.role === "Membro"
        ? "Você está logado como Membro. Acesso restrito às telas operacionais."
        : "Faça login para continuar.";
  });
}

function renderTaskList() {
  const list = document.getElementById("task-list");
  if (!list) {
    return;
  }

  const items = readStoredList(TASKS_STORAGE_KEY).slice().reverse();
  list.innerHTML = items.length
    ? items.map((item) => `
        <article class="item-card">
          <div class="item-card__top">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.status || "Pendente")}</span>
          </div>
          <p>${escapeHtml(item.description || "Sem descrição")}</p>
          <div class="item-card__meta">
            <span>Responsável: ${escapeHtml(item.responsible || "Não informado")}</span>
            <span>Prazo: ${escapeHtml(item.dueDate || "—")}</span>
            <span>Por: ${escapeHtml(item.createdBy || "Usuário")}</span>
          </div>
        </article>
      `).join("")
    : '<p class="empty-state">Nenhuma tarefa adicionada ainda.</p>';
}

function bindTaskPage() {
  const form = document.getElementById("task-form");
  const message = document.getElementById("task-message");
  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const auth = readAuth();
    const title = form.title.value.trim();
    const description = form.description.value.trim();
    const responsible = form.responsible.value.trim();
    const dueDate = form.dueDate.value;

    if (!title || !description || !responsible || !dueDate) {
      if (message) {
        message.textContent = "Preencha título, descrição, responsável e prazo para adicionar a tarefa.";
      }
      return;
    }

    const items = readStoredList(TASKS_STORAGE_KEY);
    items.push({
      id: `${Date.now()}`,
      title,
      description,
      responsible,
      dueDate,
      status: "Pendente",
      createdBy: auth?.name || "Usuário",
      role: auth?.role || "Membro",
      createdAt: new Date().toLocaleString("pt-BR"),
    });

    writeStoredList(TASKS_STORAGE_KEY, items);
    form.reset();
    renderTaskList();
    if (message) {
      message.textContent = `Tarefa adicionada com sucesso por ${auth?.name || "usuário"}.`;
    }
  });

  renderTaskList();
}

function renderNotificationList() {
  const list = document.getElementById("notification-list");
  if (!list) {
    return;
  }

  const items = readStoredList(NOTIFICATIONS_STORAGE_KEY).slice().reverse();
  list.innerHTML = items.length
    ? items.map((item) => `
        <article class="item-card">
          <div class="item-card__top">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.priority || "Normal")}</span>
          </div>
          <p>${escapeHtml(item.message || "Sem descrição")}</p>
          <div class="item-card__meta">
            <span>Categoria: ${escapeHtml(item.category || "Sistema")}</span>
            <span>Por: ${escapeHtml(item.createdBy || "Usuário")}</span>
          </div>
        </article>
      `).join("")
    : '<p class="empty-state">Nenhuma notificação adicionada ainda.</p>';
}

function bindNotificationPage() {
  const form = document.getElementById("notification-form");
  const message = document.getElementById("notification-message");
  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const auth = readAuth();
    const title = form.title.value.trim();
    const messageText = form.message.value.trim();
    const category = form.category.value.trim();
    const priority = form.priority.value.trim();

    if (!title || !messageText) {
      if (message) {
        message.textContent = "Preencha título e mensagem para adicionar a notificação.";
      }
      return;
    }

    const items = readStoredList(NOTIFICATIONS_STORAGE_KEY);
    items.push({
      id: `${Date.now()}`,
      title,
      message: messageText,
      category: category || "Sistema",
      priority: priority || "Normal",
      createdBy: auth?.name || "Usuário",
      role: auth?.role || "Membro",
      createdAt: new Date().toLocaleString("pt-BR"),
    });

    writeStoredList(NOTIFICATIONS_STORAGE_KEY, items);
    form.reset();
    renderNotificationList();
    if (message) {
      message.textContent = `Notificação adicionada com sucesso por ${auth?.name || "usuário"}.`;
    }
  });

  renderNotificationList();
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("page-ready");

  const page = document.body.dataset.page || "";
  const forceLogin = isForcedLoginView();

  if (page === "login" && forceLogin) {
    clearAuth();
  }

  injectSessionChip();
  updateNavState();
  bindNavigationTransitions();
  redirectIfNeeded();

  if (page === "login") {
    const auth = readAuth();
    if (auth && !forceLogin) {
      window.location.replace(auth.role === "Admin" ? "/dashboard.html" : "/tarefas.html");
      return;
    }
    bindLoginPage();
  }
  if (page === "logout") {
    bindLogoutPage();
  }

  if (page === "tasks") {
    bindTaskPage();
  }

  if (page === "notifications") {
    bindNotificationPage();
  }

  if (page !== "login" && page !== "logout") {
    showRoleHints();
  }
});
