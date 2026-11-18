(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const state = { token: localStorage.getItem("padaria_token") || "", api: "https://backpadaria.vercel.app/" || "http://localhost:3000", user: null, products: [], movements: [], low: [], zero: [], view: "dashboard" };
  const units = ["kg", "litros", "unidades"];
  const icons = { trigo:"🌾", fermento:"🧫", óleo:"🫒", oleo:"🫒", manteiga:"🧈", leite:"🥛", ovo:"🥚", sal:"🧂", açúcar:"🍚", acucar:"🍚" };
  const apiUrl = path => `${state.api.replace(/\/+$/, "")}${path}`;
  const headers = () => ({ "Content-Type":"application/json", ...(state.token ? { Authorization:`Bearer ${state.token}` } : {}) });
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = (n, unit = "") => `${Number(n || 0).toLocaleString("pt-BR",{maximumFractionDigits:3})}${unit ? " "+unit : ""}`;
  const dateFmt = value => value ? new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}) : "—";
  const iconFor = name => icons[String(name || "").toLowerCase()] || "📦";
  function toast(message) { const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),3000); }
  async function request(path, options={}) {
    let response;
    try { response = await fetch(apiUrl(path), { ...options, headers:{...headers(), ...(options.headers||{})} }); }
    catch { throw new Error("Não foi possível conectar à API. Confira a URL e o CORS."); }
    const body = await response.json().catch(()=>({success:false,message:"Resposta inválida do servidor."}));
    if (!response.ok || body.success === false) {
      if (response.status === 401 && !path.includes("/auth/login")) logout(false);
      throw new Error(body.message || body.error || `Erro HTTP ${response.status}`);
    }
    return body;
  }
  function showLogin() { $("#login-screen").classList.remove("hidden"); $("#app-shell").classList.add("hidden"); }
  function showApp() { $("#login-screen").classList.add("hidden"); $("#app-shell").classList.remove("hidden"); $("#user-email").textContent=state.user?.email || "Administrador"; }
  async function login(email, senha) {
    const result = await request("/api/auth/login", {method:"POST",body:JSON.stringify({email,senha})});
    state.token=result.data.token; state.user=result.data.usuario;
    localStorage.setItem("padaria_token",state.token); showApp(); await refreshAll(); toast("Bem-vindo ao sistema!");
  }
  async function logout(callApi=true) {
    if(callApi && state.token) { try { await request("/api/auth/logout",{method:"POST"}); } catch {} }
    state.token=""; state.user=null; localStorage.removeItem("padaria_token"); showLogin();
  }
  async function checkSession() {
    if(!state.token) return showLogin();
    try { const r=await request("/api/auth/me"); state.user=r.data.usuario; showApp(); await refreshAll(); }
    catch { showLogin(); }
  }
  function navigate(view) {
    state.view=view;
    $$(".view").forEach(el=>el.classList.toggle("hidden",el.id!==`view-${view}`));
    $$(".nav-link").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
    const labels={dashboard:"Visão geral",products:"Produtos",movements:"Movimentações",alerts:"Alertas de estoque"};
    $("#breadcrumb-current").textContent=labels[view] || "Visão geral";
    $("#sidebar").classList.remove("open");
    if(view==="products") loadProducts();
    if(view==="movements") loadMovements();
    if(view==="alerts") loadAlerts();
  }
  async function refreshAll() { await Promise.allSettled([loadDashboard(),loadProducts(),loadMovements(),loadAlerts()]); }
  async function loadDashboard() {
    const r=await request("/api/dashboard"); const d=r.data||{};
    $("#stat-products").textContent=fmt(d.total_produtos);
    $("#stat-quantity").textContent=fmt(d.total_itens_estoque);
    $("#stat-low").textContent=fmt(d.produtos_estoque_baixo);
    $("#stat-zero").textContent=fmt(d.produtos_sem_estoque);
    renderRecent(d.ultimas_movimentacoes||[]);
    const [lowR]=await Promise.all([request("/api/estoque/baixo")]);
    state.low=lowR.data||[]; $("#alert-count").textContent=state.low.length;
    $("#dashboard-alerts").innerHTML=state.low.length ? state.low.slice(0,5).map(p=>`<div class="alert-item"><div><strong>${escapeHtml(p.nome)}</strong><small>Mínimo: ${fmt(p.estoque_minimo,p.unidade)}</small></div><span class="alert-qty">${fmt(p.quantidade,p.unidade)}</span></div>`).join("") : '<div class="empty-state">Tudo certo! Nenhum produto abaixo do mínimo.</div>';
  }
  function renderRecent(rows) {
    $("#recent-movements").innerHTML=rows.length ? `<table class="data-table"><thead><tr><th>PRODUTO</th><th>TIPO</th><th>QUANTIDADE</th><th>DATA</th></tr></thead><tbody>${rows.map(m=>`<tr><td><div class="product-cell"><span class="product-thumb">${iconFor(m.produtos?.nome)}</span><div><strong>${escapeHtml(m.produtos?.nome||"Produto")}</strong><small>${escapeHtml(m.produtos?.unidade||"")}</small></div></div></td><td><span class="pill ${m.tipo==="entrada"?"in":"out"}">${m.tipo==="entrada"?"Entrada":"Saída"}</span></td><td>${fmt(m.quantidade,m.produtos?.unidade)}</td><td>${dateFmt(m.criado_em)}</td></tr>`).join("")}</tbody></table>` : '<div class="empty-state">Nenhuma movimentação registrada.</div>';
  }
  async function loadProducts() {
    const r=await request("/api/produtos?page=1&limit=100"); state.products=r.data||[];
    $("#products-count").textContent=`${r.pagination?.total ?? state.products.length} produtos`;
    renderProducts();
  }
  function renderProducts() {
    const term=($("#product-search")?.value||"").toLowerCase();
    const rows=state.products.filter(p=>p.nome.toLowerCase().includes(term)||String(p.categoria||"").toLowerCase().includes(term));
    $("#products-table").innerHTML=rows.length?`<table class="data-table"><thead><tr><th>PRODUTO</th><th>QUANTIDADE</th><th>ESTOQUE MÍNIMO</th><th>STATUS</th><th>AÇÕES</th></tr></thead><tbody>${rows.map(p=>`<tr><td><div class="product-cell"><span class="product-thumb">${iconFor(p.nome)}</span><div><strong>${escapeHtml(p.nome)}</strong><small>${escapeHtml(p.categoria||"Insumos")}</small></div></div></td><td>${fmt(p.quantidade,p.unidade)}</td><td>${fmt(p.estoque_minimo,p.unidade)}</td><td>${statusPill(p)}</td><td><div class="row-actions"><button class="mini-btn" data-edit-product="${p.id}">Editar</button><button class="mini-btn" data-entry-product="${p.id}">＋ Entrada</button></div></td></tr>`).join("")}</tbody></table>`:'<div class="empty-state">Nenhum produto encontrado.</div>';
  }
  function statusPill(p) { if(Number(p.quantidade)===0)return '<span class="pill zero">Sem estoque</span>'; if(Number(p.estoque_minimo)>0&&Number(p.quantidade)<=Number(p.estoque_minimo))return '<span class="pill low">Estoque baixo</span>'; return '<span class="pill ok">Disponível</span>'; }
  async function loadMovements() {
    const params=new URLSearchParams({page:"1",limit:"100"});
    if($("#movement-type").value)params.set("tipo",$("#movement-type").value);
    if($("#movement-start").value)params.set("inicio",new Date($("#movement-start").value+"T00:00:00").toISOString());
    if($("#movement-end").value)params.set("fim",new Date($("#movement-end").value+"T23:59:59").toISOString());
    const r=await request(`/api/estoque/historico?${params}`); state.movements=r.data||[];
    $("#movements-table").innerHTML=state.movements.length?`<table class="data-table"><thead><tr><th>DATA</th><th>PRODUTO</th><th>TIPO</th><th>QUANTIDADE</th><th>DETALHES</th></tr></thead><tbody>${state.movements.map(m=>`<tr><td>${dateFmt(m.criado_em)}</td><td><div class="product-cell"><span class="product-thumb">${iconFor(m.produtos?.nome)}</span><strong>${escapeHtml(m.produtos?.nome||"Produto")}</strong></div></td><td><span class="pill ${m.tipo==="entrada"?"in":"out"}">${m.tipo==="entrada"?"Entrada":"Saída"}</span></td><td>${fmt(m.quantidade,m.produtos?.unidade)}</td><td>${escapeHtml(m.fornecedor||m.motivo||m.observacao||"—")}</td></tr>`).join("")}</tbody></table>`:'<div class="empty-state">Nenhuma movimentação encontrada.</div>';
  }
  async function loadAlerts() {
    const [lowR,zeroR]=await Promise.all([request("/api/estoque/baixo"),request("/api/estoque/zerado")]);
    state.low=lowR.data||[]; state.zero=zeroR.data||[];
    $("#alerts-low-total").textContent=state.low.length; $("#alerts-zero-total").textContent=state.zero.length;
    const ids=new Set([...state.low,...state.zero].map(p=>p.id));
    const rows=[...ids].map(id=>[...state.low,...state.zero].find(p=>p.id===id)).filter(Boolean);
    $("#alerts-table").innerHTML=rows.length?`<table class="data-table"><thead><tr><th>PRODUTO</th><th>SALDO ATUAL</th><th>ESTOQUE MÍNIMO</th><th>SITUAÇÃO</th><th>AÇÃO</th></tr></thead><tbody>${rows.map(p=>`<tr><td><div class="product-cell"><span class="product-thumb">${iconFor(p.nome)}</span><strong>${escapeHtml(p.nome)}</strong></div></td><td>${fmt(p.quantidade,p.unidade)}</td><td>${fmt(p.estoque_minimo,p.unidade)}</td><td>${statusPill(p)}</td><td><button class="mini-btn" data-entry-product="${p.id}">Registrar entrada</button></td></tr>`).join("")}</tbody></table>`:'<div class="empty-state">Nenhum alerta de estoque. Tudo em ordem!</div>';
  }
  function openModal(title, eyebrow, fields, onSave) {
    $("#modal-title").textContent=title; $("#modal-eyebrow").textContent=eyebrow; $("#modal-fields").innerHTML=fields; $("#modal-error").textContent="";
    $("#modal").showModal();
    $("#modal-form").onsubmit=async e=>{e.preventDefault(); const submit=$("#modal-submit");submit.disabled=true;submit.textContent="Salvando...";try{await onSave(new FormData($("#modal-form")));$("#modal").close();await refreshAll();toast("Operação realizada com sucesso.");}catch(err){$("#modal-error").textContent=err.message;}finally{submit.disabled=false;submit.textContent="Salvar";}};
  }
  const field=(label,name,value="",type="text",required=true,full=false)=>`<label class="${full?"full":""}">${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required?"required":""} ${type==="number"?'min="0" step="0.001"':""}></label>`;
  function productModal(product=null) {
    const edit=!!product;
    const fields=`${field("Nome do produto","nome",product?.nome||"", "text",true,true)}${field("Categoria","categoria",product?.categoria||"Insumos")}${field("Quantidade inicial","quantidade",product?.quantidade??0,"number",!edit)}<label>Unidade<select name="unidade" required>${units.map(u=>`<option ${product?.unidade===u?"selected":""}>${u}</option>`).join("")}</select></label>${field("Estoque mínimo","estoque_minimo",product?.estoque_minimo??0,"number")}`;
    openModal(edit?"Editar produto":"Novo produto","CADASTRO DE PRODUTO",fields,async fd=>{
      const payload={nome:fd.get("nome"),categoria:fd.get("categoria"),unidade:fd.get("unidade"),estoque_minimo:Number(fd.get("estoque_minimo"))};
      if(!edit)payload.quantidade=Number(fd.get("quantidade"));
      await request(edit?`/api/produtos/${product.id}`:"/api/produtos",{method:edit?"PUT":"POST",body:JSON.stringify(payload)});
    });
  }
  function movementModal(type, productId=null) {
    const entry=type==="entrada";
    const options=state.products.map(p=>`<option value="${p.id}" ${p.id===productId?"selected":""}>${escapeHtml(p.nome)} — ${fmt(p.quantidade,p.unidade)}</option>`).join("");
    const details=entry?field("Fornecedor (opcional)","fornecedor","", "text",false,true):field("Motivo da saída","motivo","","text",true,true);
    const fields=`<label class="full">Produto<select name="produto_id" required>${options}</select></label>${field("Quantidade","quantidade","","number",true,true)}${details}${field("Observação (opcional)","observacao","","text",false,true)}`;
    openModal(entry?"Registrar entrada":"Registrar saída",entry?"REPOSIÇÃO DE ESTOQUE":"BAIXA DE ESTOQUE",fields,async fd=>{
      const payload={produto_id:fd.get("produto_id"),quantidade:Number(fd.get("quantidade")),observacao:fd.get("observacao")||null};
      if(entry)payload.fornecedor=fd.get("fornecedor")||null;else payload.motivo=fd.get("motivo");
      await request(`/api/estoque/${entry?"entrada":"saida"}`,{method:"POST",body:JSON.stringify(payload)});
    });
  }
  document.addEventListener("click",e=>{
    const nav=e.target.closest("[data-view]");if(nav){navigate(nav.dataset.view);return;}
    const action=e.target.closest("[data-action]")?.dataset.action;
    if(action==="new-product")productModal();
    if(action==="new-entry"||action==="new-exit"){if(!state.products.length){toast("Cadastre um produto primeiro.");return;}movementModal(action==="new-entry"?"entrada":"saida");}
    const edit=e.target.closest("[data-edit-product]");if(edit){const p=state.products.find(x=>x.id===edit.dataset.editProduct);if(p)productModal(p);}
    const entry=e.target.closest("[data-entry-product]");if(entry)movementModal("entrada",entry.dataset.entryProduct);
  });
  $("#login-form").addEventListener("submit",async e=>{e.preventDefault();$("#login-error").textContent="";const btn=e.submitter;btn.disabled=true;btn.textContent="Entrando...";try{await login($("#login-email").value.trim(),$("#login-password").value);}catch(err){$("#login-error").textContent=err.message;}finally{btn.disabled=false;btn.innerHTML='Entrar no sistema <span>→</span>';}}); 
  $("#logout-btn").addEventListener("click",()=>logout(true));
  $("#product-search").addEventListener("input",renderProducts);
  $("#filter-movements").addEventListener("click",()=>loadMovements().catch(e=>toast(e.message)));
  $("#menu-toggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#modal-close").addEventListener("click",()=>$("#modal").close());$("#modal-cancel").addEventListener("click",()=>$("#modal").close());
  $("#today-label").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
  checkSession().catch(()=>showLogin());
})();
