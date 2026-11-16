
// ==========================================
// MFR MARKET - INTEGRACAO SUPABASE
// ==========================================

const SUPABASE_URL = "https://cuvyknvnkjcqnzpcorap.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nGJ-UEn8kzof785jGuKFCA_N3g1RZux";

const ADMIN_EMAIL = "xavofelipe@gmail.com";

const $ = id => document.getElementById(id);

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let currentUser = null;
let currentRole = null;
let isAdmin = false;
let products = [];
let prices = [];

const money = n => Number(n || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

const num = s => Number(
  String(s || "0").trim().replace(/\./g, "").replace(",", ".")
) || 0;

function message(id, text, kind = "") {
  const el = $(id);
  if (!el) return;

  el.textContent = text;
  el.className = `notice ${kind}`;
}

function show(view) {
  ["loginView", "pendingView", "appView"].forEach(id => {
    $(id).classList.toggle("hidden", id !== view);
  });
}

function tab(name) {
  if (name === "admin" && !isAdmin) return;

  document.querySelectorAll(".view").forEach(x => {
    x.classList.toggle("hidden", x.id !== name);
  });

  document.querySelectorAll(".tab").forEach(x => {
    x.classList.toggle("active", x.dataset.tab === name);
  });

  if (name === "admin" && isAdmin) {
    loadAccessList();
  }
}

document.querySelectorAll("[data-tab]").forEach(b => {
  b.addEventListener("click", () => tab(b.dataset.tab));
});

document.querySelectorAll("[data-go]").forEach(b => {
  b.addEventListener("click", () => tab(b.dataset.go));
});

// ==========================================
// PRODUTOS E COTACOES
// ==========================================

async function loadData() {
  const [pRes, qRes] = await Promise.all([
    supabaseClient
      .from("products")
      .select("*")
      .order("created_at", { ascending: false }),

    supabaseClient
      .from("prices")
      .select("*")
      .order("created_at", { ascending: false })
  ]);

  if (pRes.error) throw pRes.error;
  if (qRes.error) throw qRes.error;

  products = (pRes.data || []).map(p => ({ ...p }));

  prices = (qRes.data || []).map(q => ({
    ...q,
    productId: q.product_id,
    created: new Date(q.created_at).getTime()
  }));

  render();
}

function render() {
  $("countProducts").textContent = products.length;
  $("countPrices").textContent = prices.length;

  $("priceProduct").innerHTML = products.map(p =>
    `<option value="${p.id}">${esc(p.name)}</option>`
  ).join("");

  $("productList").innerHTML = products.length
    ? products.map(p => `
      <div class="item">
        <div>
          <b>${esc(p.name)}</b>
          <small>
            ${esc(p.category || "Sem categoria")}
            ${p.sku ? " • " + esc(p.sku) : ""}
          </small>
          <button data-del-product="${p.id}">Excluir</button>
        </div>
      </div>
    `).join("")
    : '<div class="empty">Nenhum produto cadastrado.</div>';

  $("priceList").innerHTML = prices.length
    ? prices.map(q => {
      const p = products.find(x => x.id === q.productId);

      return `
        <div class="item">
          <div>
            <b>${esc(p?.name || "Produto removido")}</b>
            <small>
              ${esc(q.store)} •
              ${new Date(q.created).toLocaleString("pt-BR")}
            </small>

            ${q.url
              ? `<small><a href="${esc(q.url)}" target="_blank" rel="noopener">Abrir anúncio</a></small>`
              : ""}

            ${q.notes ? `<small>${esc(q.notes)}</small>` : ""}

            <button data-del-price="${q.id}">
              Excluir cotação
            </button>
          </div>

          <div class="price">
            ${money(Number(q.price) + Number(q.shipping))}
            <small>total c/ frete</small>
          </div>
        </div>
      `;
    }).join("")
    : '<div class="empty">Nenhuma cotação registrada.</div>';

  const best = products
    .map(p => ({
      p,
      qs: prices.filter(q => q.productId === p.id)
    }))
    .filter(x => x.qs.length)
    .map(x => ({
      ...x,
      best: x.qs.reduce((a, b) =>
        Number(a.price) + Number(a.shipping) <=
        Number(b.price) + Number(b.shipping) ? a : b
      )
    }));

  $("bestPrices").innerHTML = best.length
    ? best.map(x => `
      <div class="item">
        <div>
          <b>${esc(x.p.name)}</b>
          <small>Melhor oferta: ${esc(x.best.store)}</small>
        </div>
        <div class="price">
          ${money(Number(x.best.price) + Number(x.best.shipping))}
        </div>
      </div>
    `).join("")
    : "Cadastre produtos e registre preços para ver a comparação.";

  document.querySelectorAll("[data-del-product]").forEach(b => {
    b.onclick = async () => {
      if (!confirm("Excluir produto e cotações relacionadas?")) return;

      const { error } = await supabaseClient
        .from("products")
        .delete()
        .eq("id", b.dataset.delProduct);

      if (error) {
        return alert("Erro: " + error.message);
      }

      await loadData();
    };
  });

  document.querySelectorAll("[data-del-price]").forEach(b => {
    b.onclick = async () => {
      if (!confirm("Excluir esta cotação?")) return;

      const { error } = await supabaseClient
        .from("prices")
        .delete()
        .eq("id", b.dataset.delPrice);

      if (error) {
        return alert("Erro: " + error.message);
      }

      await loadData();
    };
  });
}

// ==========================================
// CADASTRAR PRODUTO
// ==========================================

$("productForm").addEventListener("submit", async e => {
  e.preventDefault();

  const row = {
    name: $("pName").value.trim(),
    sku: $("pSku").value.trim(),
    category: $("pCategory").value.trim(),
    created_by: currentUser.id
  };

  const { error } = await supabaseClient
    .from("products")
    .insert(row);

  if (error) {
    return alert("Erro ao cadastrar produto: " + error.message);
  }

  e.target.reset();

  await loadData();

  alert("Produto cadastrado na nuvem!");
});

// ==========================================
// CADASTRAR COTACAO
// ==========================================

$("priceForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!products.length) {
    return alert("Cadastre um produto primeiro.");
  }

  const row = {
    product_id: $("priceProduct").value,
    store: $("store").value.trim(),
    price: num($("price").value),
    shipping: num($("shipping").value),
    url: $("url").value.trim() || null,
    notes: $("notes").value.trim() || null,
    created_by: currentUser.id
  };

  const { error } = await supabaseClient
    .from("prices")
    .insert(row);

  if (error) {
    return alert("Erro ao registrar cotação: " + error.message);
  }

  e.target.reset();

  await loadData();

  alert("Cotação registrada na nuvem!");
});

// ==========================================
// EXPORTAR CSV
// ==========================================

$("exportCsv").addEventListener("click", () => {
  const rows = [
    ["Produto", "Loja", "Preço", "Frete", "Total", "Link", "Observações"],

    ...prices.map(q => [
      products.find(p => p.id === q.productId)?.name || "",
      q.store,
      q.price,
      q.shipping,
      Number(q.price) + Number(q.shipping),
      q.url || "",
      q.notes || ""
    ])
  ];

  const csv = rows.map(r =>
    r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(";")
  ).join("\n");

  const a = document.createElement("a");

  a.href = URL.createObjectURL(
    new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8"
    })
  );

  a.download = "mfr-market-cotacoes.csv";
  a.click();

  URL.revokeObjectURL(a.href);
});

// ==========================================
// ADMINISTRACAO DE USUARIOS
// ==========================================

async function loadAccessList() {
  if (!isAdmin) return;

  const { data, error } = await supabaseClient
    .from("mfr_access")
    .select("email,name,approved,role,created_at")
    .order("created_at");

  if (error) {
    $("accessList").textContent =
      "Erro ao carregar usuários: " + error.message;
    return;
  }

  $("accessList").innerHTML = (data || []).map(u => {
    const roleName = {
      admin: "Administrador",
      comprador: "Comprador",
      fornecedor: "Fornecedor",
      user: "Usuário antigo"
    }[u.role] || u.role;

    const principal =
      u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    return `
      <div class="item access-item">
        <div>
          <b>${esc(u.name || "Nome não informado")}</b>
          <small>${esc(u.email)}</small>
          <small>
            Perfil: ${esc(roleName)} •
            ${u.approved ? "Aprovado" : "Bloqueado"}
          </small>
        </div>

        ${principal
          ? "<strong>Administrador principal</strong>"
          : `
            <button
              data-toggle-access="${esc(u.email)}"
              data-approved="${u.approved}">
              ${u.approved ? "Bloquear" : "Liberar"}
            </button>
          `
        }
      </div>
    `;
  }).join("") || '<div class="empty">Nenhum usuário cadastrado.</div>';

  document.querySelectorAll("[data-toggle-access]").forEach(b => {
    b.onclick = async () => {
      if (!isAdmin) return;

      const next = b.dataset.approved !== "true";

      const { error: updateError } = await supabaseClient
        .from("mfr_access")
        .update({ approved: next })
        .eq("email", b.dataset.toggleAccess);

      if (updateError) {
        return alert("Erro ao atualizar usuário: " + updateError.message);
      }

      await loadAccessList();
    };
  });
}

// ==========================================
// CRIAR COMPRADOR OU FORNECEDOR
// ==========================================

$("accessForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!isAdmin) {
    return message(
      "createUserMessage",
      "Somente o administrador pode criar usuários.",
      "error"
    );
  }

  const name = $("accessName").value.trim();
  const email = $("accessEmail").value.trim().toLowerCase();
  const password = $("accessPassword").value;
  const role = $("accessRole").value;

  if (!name || !email || !password) {
    return message(
      "createUserMessage",
      "Preencha todos os campos.",
      "error"
    );
  }

  if (password.length < 8) {
    return message(
      "createUserMessage",
      "A senha precisa ter pelo menos 8 caracteres.",
      "error"
    );
  }

  if (!["comprador", "fornecedor"].includes(role)) {
    return message(
      "createUserMessage",
      "Perfil inválido.",
      "error"
    );
  }

  const button = e.target.querySelector('button[type="submit"]');

  button.disabled = true;
  button.textContent = "CRIANDO...";

  message("createUserMessage", "Criando usuário...");

  try {
    const { data, error } = await supabaseClient.functions.invoke(
      "mfr-create-user",
      {
        body: {
          name,
          email,
          password,
          role
        }
      }
    );

    if (error) {
      throw error;
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    e.target.reset();

    message(
      "createUserMessage",
      "Usuário criado com sucesso!",
      "success"
    );

    await loadAccessList();

  } catch (err) {
    console.error("Erro ao criar usuário:", err);

    message(
      "createUserMessage",
      "Não foi possível criar o usuário: " +
      (err.message || "Erro desconhecido."),
      "error"
    );

  } finally {
    button.disabled = false;
    button.textContent = "CRIAR USUÁRIO";
  }
});

// ==========================================
// VERIFICAR SESSAO E PERMISSOES
// ==========================================

async function checkSession(session) {
  currentUser = session?.user || null;

  if (!currentUser) {
    isAdmin = false;
    currentRole = null;

    $("adminTab").classList.add("hidden");

    show("loginView");
    return;
  }

  $("signedEmail").textContent = currentUser.email || "";

  const { data: access, error } = await supabaseClient
    .from("mfr_access")
    .select("approved,role,email,name")
    .eq("email", (currentUser.email || "").toLowerCase())
    .maybeSingle();

  if (error) {
    isAdmin = false;

    show("pendingView");

    message(
      "pendingMessage",
      "Não foi possível verificar a autorização: " + error.message,
      "error"
    );

    return;
  }

  const allowedRoles = [
    "admin",
    "user",
    "comprador",
    "fornecedor"
  ];

  if (
    !access ||
    !access.approved ||
    !allowedRoles.includes(access.role)
  ) {
    isAdmin = false;
    currentRole = null;

    $("adminTab").classList.add("hidden");

    show("pendingView");

    message(
      "pendingMessage",
      "Seu acesso ainda não está autorizado ou foi bloqueado."
    );

    return;
  }

  currentRole = access.role;

  isAdmin =
    currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
    access.role === "admin";

  $("adminTab").classList.toggle("hidden", !isAdmin);

  show("appView");

  tab("home");

  try {
    await loadData();

    $("net").textContent = "● Online";

  } catch (err) {
    $("net").textContent = "● Erro de conexão";

    alert(
      "Erro ao carregar dados do MFR Market: " + err.message
    );
  }
}

// ==========================================
// LOGIN COM EMAIL E SENHA
// ==========================================

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const email = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;

  message("authMessage", "Verificando acesso...");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return message(
      "authMessage",
      "E-mail ou senha incorretos: " + error.message,
      "error"
    );
  }

  await checkSession(data.session);
});

// ==========================================
// SAIR DA CONTA
// ==========================================

async function signOut() {
  await supabaseClient.auth.signOut();

  currentUser = null;
  currentRole = null;
  isAdmin = false;

  $("adminTab").classList.add("hidden");

  show("loginView");
}

$("signOut").addEventListener("click", signOut);
$("pendingSignOut").addEventListener("click", signOut);

// ==========================================
// CONEXAO
// ==========================================

$("net").textContent = navigator.onLine
  ? "● Conectado"
  : "● Offline";

window.addEventListener("online", () => {
  $("net").textContent = "● Conectado";
});

window.addEventListener("offline", () => {
  $("net").textContent = "● Offline";
});

// ==========================================
// INICIALIZACAO
// ==========================================

(async function init() {
  const {
    data: { session },
    error
  } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Erro ao recuperar sessão:", error);
  }

  await checkSession(session);

  supabaseClient.auth.onAuthStateChange((_event, sessionNow) => {
    setTimeout(() => checkSession(sessionNow), 0);
  });
})();
