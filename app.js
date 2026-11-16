// MFR MARKET — aplicação com controle por perfil, comparação, relatórios e avisos
const SUPABASE_URL = "https://cuvyknvnkjcqnzpcorap.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nGJ-UEn8kzof785jGuKFCA_N3g1RZux";
const ADMIN_EMAIL = "xavofelipe@gmail.com";
const $ = id => document.getElementById(id);
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let currentUser=null, currentRole=null, isAdmin=false, products=[], prices=[], accessUsers=[], supplierProfiles=[], buyerRequests=[], requestOffers=[];
const money=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=s=>{const v=String(s??"0").trim().replace(/\./g,"").replace(",",".");const n=Number(v);return Number.isFinite(n)?n:0};
function message(id,text,kind=""){const el=$(id);if(el){el.textContent=text;el.className="notice "+kind}}
function show(view){["loginView","pendingView","appView"].forEach(id=>$(id).classList.toggle("hidden",id!==view))}
function allowedTabs(){
  const buyer=currentRole==="comprador", supplier=currentRole==="fornecedor";
  $("supplierProfileTab").classList.toggle("hidden",!supplier);
  $("requestsTab").classList.toggle("hidden",isAdmin);
  $("requestCreateForm").classList.toggle("hidden",!buyer);
  $("supplierCategoryBox").classList.toggle("hidden",!supplier);
  $("productsTab").classList.toggle("hidden",!isAdmin);
  $("homeAddProduct").classList.toggle("hidden",!isAdmin);
  $("homeAddQuote").classList.toggle("hidden",buyer);
  $("pricesTab").textContent=buyer?"Consultar preços":"Cotações";
  $("quoteListTitle").textContent=buyer?"Comparação de cotações (menor total primeiro)":supplier?"Minhas cotações":"Todas as cotações";
  $("priceForm").classList.toggle("hidden",buyer);
  $("exportCsv").classList.toggle("hidden",buyer);
  $("reportsTab").classList.toggle("hidden",supplier);
  $("adminTab").classList.toggle("hidden",!isAdmin);
  $("adminOverview").classList.toggle("hidden",!isAdmin);
  $("notificationsPanel").classList.toggle("hidden",false);
  $("homeTitle").textContent=isAdmin?"Painel administrativo MFR":buyer?"Painel do comprador":"Painel do fornecedor";
  $("bestPricesTitle").textContent=buyer?"Melhores ofertas por produto":supplier?"Resumo das suas cotações":"Resumo de melhores preços";
}
function tab(name){
  if(name==="admin"&&!isAdmin)return;
  if(name==="products"&&!isAdmin)return;
  if(name==="reports"&&currentRole==="fornecedor")return;
  if(name==="supplierProfile"&&currentRole!=="fornecedor")return;
  if(name==="requests"&&isAdmin)return;
  document.querySelectorAll(".view").forEach(x=>x.classList.toggle("hidden",x.id!==name));
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
  if(name==="admin"&&isAdmin)loadAccessList();
  if(name==="reports")renderReports();
  if(name==="supplierProfile")loadSupplierProfile();
  if(name==="requests")renderBuyerRequests();
}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>tab(b.dataset.tab)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>tab(b.dataset.go)));
async function loadData(){
  const [pRes,qRes,sRes]=await Promise.all([
    supabaseClient.from("products").select("id,name,sku,category,created_at").order("name"),
    supabaseClient.from("prices").select("id,product_id,store,price,shipping,url,notes,created_at,created_by,expires_at").order("created_at",{ascending:false}),
    supabaseClient.from("supplier_profiles").select("user_id,whatsapp,categories")
  ]);
  if(pRes.error)throw pRes.error;if(qRes.error)throw qRes.error;if(sRes.error)throw sRes.error;
  products=pRes.data||[];prices=qRes.data||[];supplierProfiles=sRes.data||[];
  const [rRes,oRes]=await Promise.all([
    supabaseClient.from("buyer_requests").select("*").order("created_at",{ascending:false}),
    supabaseClient.from("supplier_request_offers").select("*").order("created_at",{ascending:false})
  ]);
  if(rRes.error)throw rRes.error;if(oRes.error)throw oRes.error;
  buyerRequests=rRes.data||[];requestOffers=oRes.data||[];
  if(isAdmin){
    const {data,error}=await supabaseClient.from("mfr_access").select("email,name,approved,role,created_at");
    if(error)console.warn("Métricas de usuários indisponíveis:",error.message);
    accessUsers=data||[];
  }
  render();
}
function total(q){return Number(q.price||0)+Number(q.shipping||0)}
function render(){
  $("countProducts").textContent=products.length;
  $("countPrices").textContent=prices.length;
  $("priceProduct").innerHTML=products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("");
  $("productForm").classList.toggle("hidden",!isAdmin);
  const productTerm=($("productSearch")?.value||"").toLocaleLowerCase("pt-BR");
  const category=$("productCategoryFilter")?.value||"";
  const shownProducts=products.filter(p=>(!category||p.category===category)&&(!productTerm||p.name.toLocaleLowerCase("pt-BR").includes(productTerm)));
  $("productList").innerHTML=shownProducts.length?shownProducts.map(p=>'<div class="item"><div><b>'+esc(p.name)+'</b><small>'+esc(p.category||"Sem categoria")+(p.sku?" • "+esc(p.sku):"")+'</small></div></div>').join(""):'<div class="empty">Nenhum produto encontrado.</div>';
  const term=($("quoteSearch")?.value||"").toLocaleLowerCase("pt-BR");
  const shownQuotes=prices.filter(q=>{const p=products.find(x=>x.id===q.product_id);return !term||((p?.name||"").toLocaleLowerCase("pt-BR").includes(term))||q.store.toLocaleLowerCase("pt-BR").includes(term)}).sort((a,b)=>total(a)-total(b));
  $("priceList").innerHTML=shownQuotes.length?shownQuotes.map(q=>{
    const p=products.find(x=>x.id===q.product_id),expiry=q.expires_at?new Date(q.expires_at).toLocaleDateString("pt-BR"):"—";
    const own=isAdmin||q.created_by===currentUser?.id;
    const contact=supplierProfiles.find(x=>x.user_id===q.created_by)?.whatsapp||"";
    const whatsappDigits=contact.replace(/[^0-9]/g,"");
    const messageText="Olá! Tenho interesse na cotação do produto "+(p?.name||"Produto")+". Vi sua oferta na loja "+q.store+". Preço: "+money(q.price)+". Frete: "+money(q.shipping)+". Total: "+money(total(q))+". Podemos negociar?";
    const whatsappAction=buyerMode()?(whatsappDigits?'<a class="whatsapp-link" href="https://wa.me/55'+whatsappDigits+'?text='+encodeURIComponent(messageText)+'" target="_blank" rel="noopener noreferrer">CHAT COM O VENDEDOR • WHATSAPP</a><small class="muted">WhatsApp: +55'+whatsappDigits+'</small>':'<small class="muted">Vendedor ainda não cadastrou o WhatsApp comercial.</small>'):"";
    return '<div class="item"><div><b>'+esc(p?.name||"Produto")+'</b><small>'+esc(q.store)+' • '+new Date(q.created_at).toLocaleString("pt-BR")+'</small><small>Produto: '+money(q.price)+' • Frete: '+money(q.shipping)+' • Validade: '+expiry+'</small>'+(q.url?'<small><a href="'+esc(q.url)+'" target="_blank" rel="noopener noreferrer">Abrir anúncio</a></small>':"")+(q.notes?'<small>'+esc(q.notes)+'</small>':"")+whatsappAction+(own&&!buyerMode()?'<button data-del-price="'+esc(q.id)+'">Excluir cotação</button>':"")+'</div><div class="price">'+money(total(q))+'<small>total com frete</small></div></div>';
  }).join(""):'<div class="empty">Nenhuma cotação encontrada.</div>';
  const grouped=products.map(p=>({p,qs:prices.filter(q=>q.product_id===p.id)})).filter(x=>x.qs.length);
  $("bestPrices").innerHTML=grouped.length?grouped.map(x=>{const best=[...x.qs].sort((a,b)=>total(a)-total(b))[0];return '<div class="item"><div><b>'+esc(x.p.name)+'</b><small>Melhor oferta: '+esc(best.store)+'</small></div><div class="price">'+money(total(best))+'</div></div>'}).join(""):'<div class="empty">Ainda não há cotações para comparar.</div>';
  if(isAdmin){const active=accessUsers.filter(u=>u.approved);$("metricUsers").textContent=active.length;$("metricBuyers").textContent=active.filter(u=>u.role==="comprador").length;$("metricSuppliers").textContent=active.filter(u=>u.role==="fornecedor").length;$("metricQuotes").textContent=prices.length}
  renderNotifications();renderReports();
  document.querySelectorAll("[data-del-price]").forEach(b=>b.onclick=async()=>{if(!confirm("Excluir somente esta cotação? Os cadastros de produtos serão mantidos."))return;const {error}=await supabaseClient.from("prices").delete().eq("id",b.dataset.delPrice);if(error)return alert("Erro: "+error.message);await loadData()});
}
function buyerMode(){return currentRole==="comprador"&&!isAdmin}
function renderNotifications(){
  const now=Date.now(),items=[];
  if(currentRole==="comprador"){
    prices.slice(0,5).forEach(q=>{const p=products.find(x=>x.id===q.product_id);items.push({title:"Cotação disponível: "+(p?.name||"Produto"),detail:"Fornecedor: "+q.store+" · Total com frete: "+money(total(q)),date:new Date(q.created_at).getTime()})});
  }else{
    prices.filter(q=>q.created_by===currentUser?.id&&q.expires_at&&new Date(q.expires_at).getTime()-now<48*3600000).forEach(q=>{const p=products.find(x=>x.id===q.product_id);items.push({title:"Cotação próxima do vencimento: "+(p?.name||"Produto"),detail:"Validade: "+new Date(q.expires_at).toLocaleString("pt-BR"),date:new Date(q.expires_at).getTime()})});
    if(!items.length)items.push({title:"Tudo em dia",detail:"Você receberá avisos aqui quando suas cotações estiverem próximas do vencimento.",date:now});
  }
  if(isAdmin){items.unshift({title:"Resumo administrativo atualizado",detail:accessUsers.length+" contas cadastradas · "+prices.length+" cotações visíveis.",date:now})}
  $("notificationsList").innerHTML=items.length?items.sort((a,b)=>b.date-a.date).map(x=>'<div class="notification"><b>'+esc(x.title)+'</b><small>'+esc(x.detail)+'</small></div>').join(""):'<div class="empty">Nenhum aviso no momento.</div>';
}
function renderReports(){
  if(!$("savingsReport"))return;
  const rows=products.map(p=>{const qs=prices.filter(q=>q.product_id===p.id);if(qs.length<2)return null;const vals=qs.map(total),low=Math.min(...vals),high=Math.max(...vals);return {name:p.name,count:qs.length,low,high,potential:high-low}}).filter(Boolean).sort((a,b)=>b.potential-a.potential);
  $("potentialSavings").textContent=money(rows.reduce((s,x)=>s+x.potential,0));
  $("comparedProducts").textContent=rows.length;
  $("savingsReport").innerHTML=rows.length?rows.map(x=>'<div class="item"><div><b>'+esc(x.name)+'</b><small>'+x.count+' ofertas comparadas · menor '+money(x.low)+' · maior '+money(x.high)+'</small></div><div class="price">'+money(x.potential)+'<small>diferença potencial</small></div></div>').join(""):'<div class="empty">São necessárias pelo menos duas cotações por produto para gerar a comparação.</div>';
}
$("productSearch").addEventListener("input",render);
$("productCategoryFilter").addEventListener("change",render);
$("quoteSearch").addEventListener("input",render);
$("productForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!isAdmin)return alert("Somente o administrador cadastra produtos.");
  const row={name:$("pName").value.trim(),sku:$("pSku").value.trim()||null,category:$("pCategory").value,created_by:currentUser.id};
  const {error}=await supabaseClient.from("products").insert(row);if(error)return alert("Erro ao cadastrar produto: "+error.message);
  e.target.reset();await loadData();alert("Produto cadastrado. O cadastro será mantido mesmo quando as cotações vencerem.");
});
$("priceForm").addEventListener("submit",async e=>{
  e.preventDefault();if(buyerMode())return alert("Compradores não cadastram cotações.");if(!products.length)return alert("Ainda não existem produtos cadastrados.");
  const days=Number($("quoteValidity").value);if(![2,4,7].includes(days))return alert("Validade inválida.");
  const expiresAt=new Date(Date.now()+days*86400000).toISOString();
  const row={product_id:$("priceProduct").value,store:$("store").value.trim(),price:num($("price").value),shipping:num($("shipping").value),url:$("url").value.trim()||null,notes:$("notes").value.trim()||null,created_by:currentUser.id,expires_at:expiresAt};
  const {error}=await supabaseClient.from("prices").insert(row);if(error)return alert("Erro ao registrar cotação: "+error.message);
  e.target.reset();$("quoteValidity").value="7";await loadData();alert("Cotação registrada com validade de "+days+" dias.");
});
$("exportCsv").addEventListener("click",()=>{
  const rows=[["Produto","Fornecedor","Preço","Frete","Total","Validade","Link","Observações"],...prices.map(q=>[products.find(p=>p.id===q.product_id)?.name||"",q.store,q.price,q.shipping,total(q),q.expires_at||"",q.url||"",q.notes||""])];
  const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(";")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="mfr-market-cotacoes.csv";a.click();URL.revokeObjectURL(a.href);
});

function normalizeWhatsapp(value){
  let digits=String(value||"").replace(/[^0-9]/g,"");
  if(digits.startsWith("55")&&digits.length>11)digits=digits.slice(2);
  return digits;
}
async function loadSupplierProfile(){
  if(currentRole!=="fornecedor")return;
  const own=supplierProfiles.find(x=>x.user_id===currentUser?.id);
  $("supplierWhatsapp").value=own?.whatsapp||"";
  const chosen=own?.categories||[];document.querySelectorAll("[name=supplierCategories]").forEach(c=>c.checked=chosen.includes(c.value));
  message("supplierProfileMessage",own?"WhatsApp cadastrado. Você pode atualizá-lo.":"Cadastre seu WhatsApp comercial para receber negociações.");
}
$("supplierProfileForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(currentRole!=="fornecedor")return message("supplierProfileMessage","Somente fornecedores podem alterar este perfil.","error");
  const whatsapp=normalizeWhatsapp($("supplierWhatsapp").value);
  if(!/^[0-9]{10,11}$/.test(whatsapp))return message("supplierProfileMessage","Informe um número válido com DDD (10 ou 11 dígitos).","error");
  const categories=[...document.querySelectorAll("[name=supplierCategories]:checked")].map(c=>c.value);
  if(!categories.length)return message("supplierProfileMessage","Selecione ao menos uma categoria de atuação.","error");
  const {error}=await supabaseClient.from("supplier_profiles").upsert({user_id:currentUser.id,whatsapp,categories,updated_at:new Date().toISOString()},{onConflict:"user_id"});
  if(error)return message("supplierProfileMessage","Não foi possível salvar: "+error.message,"error");
  message("supplierProfileMessage","WhatsApp salvo com sucesso! Compradores autorizados já poderão negociar com você.","success");
  await loadData();
});
async function loadAccessList(){
  if(!isAdmin)return;
  const {data,error}=await supabaseClient.from("mfr_access").select("email,name,approved,role,created_at").order("created_at");
  if(error){$("accessList").textContent="Erro ao carregar usuários: "+error.message;return}
  accessUsers=data||[];
  $("accessList").innerHTML=accessUsers.map(u=>{const principal=u.email.toLowerCase()===ADMIN_EMAIL;return '<div class="item access-item"><div><b>'+esc(u.name||"Nome não informado")+'</b><small>'+esc(u.email)+'</small><small>Perfil: '+esc(u.role)+' · '+(u.approved?"Aprovado":"Bloqueado")+'</small></div>'+(principal?"<strong>Administrador principal</strong>":'<button data-toggle-access="'+esc(u.email)+'" data-approved="'+u.approved+'">'+(u.approved?"Bloquear":"Liberar")+'</button>')+'</div>'}).join("")||'<div class="empty">Nenhum usuário cadastrado.</div>';
  document.querySelectorAll("[data-toggle-access]").forEach(b=>b.onclick=async()=>{const {error}=await supabaseClient.from("mfr_access").update({approved:b.dataset.approved!=="true"}).eq("email",b.dataset.toggleAccess);if(error)return alert("Erro: "+error.message);await loadAccessList();await loadData()});
}
$("accessForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!isAdmin)return message("createUserMessage","Somente o administrador pode criar usuários.","error");
  const name=$("accessName").value.trim(),email=$("accessEmail").value.trim().toLowerCase(),password=$("accessPassword").value,role=$("accessRole").value;
  if(!name||!email||password.length<8||!["comprador","fornecedor"].includes(role))return message("createUserMessage","Confira os campos e use uma senha de pelo menos 8 caracteres.","error");
  const button=e.target.querySelector('button[type="submit"]');button.disabled=true;button.textContent="CRIANDO...";
  try{const {data,error}=await supabaseClient.functions.invoke("mfr-create-user",{body:{name,email,password,role}});if(error)throw error;if(data?.error)throw new Error(data.error);e.target.reset();message("createUserMessage","Usuário criado com sucesso!","success");await loadAccessList();await loadData()}catch(err){message("createUserMessage","Não foi possível criar o usuário: "+(err.message||"Erro desconhecido."),"error")}finally{button.disabled=false;button.textContent="CRIAR USUÁRIO"}
});

function renderBuyerRequests(){
  const isBuyer=currentRole==="comprador";
  const visible=buyerRequests.filter(r=>!isBuyer||r.buyer_id===currentUser?.id);
  $("requestList").innerHTML=visible.length?visible.map(r=>{
    const offers=requestOffers.filter(o=>o.request_id===r.id);
    const offerHtml=isBuyer?offers.map(o=>'<div class="notification"><b>Proposta: '+money(o.price)+' + frete '+money(o.shipping)+'</b><small>Entrega: '+esc(o.delivery_estimate||"A combinar")+' · '+esc(o.notes||"")+'</small></div>').join(""):'';
    const action=!isBuyer?'<form class="offer-form panel" data-offer="'+esc(r.id)+'"><label>Preço (R$)</label><input name="offerPrice" required inputmode="decimal" placeholder="0,00"><label>Frete (R$)</label><input name="offerShipping" inputmode="decimal" value="0"><label>Prazo de entrega</label><input name="offerDelivery" placeholder="Ex.: 2 dias"><label>Observações</label><textarea name="offerNotes"></textarea><button type="submit">ENVIAR PROPOSTA</button></form>':'';
    return '<article class="panel request-card"><div><b>'+esc(r.product_name)+'</b><small>'+esc(r.category)+' · Quantidade: '+esc(r.quantity)+' · Entrega: '+esc(r.delivery_location)+'</small><p>'+esc(r.specifications||"")+'</p><small>Necessário até: '+(r.needed_by?new Date(r.needed_by+"T12:00:00").toLocaleDateString("pt-BR"):"A combinar")+' · Solicitação válida até '+new Date(r.expires_at).toLocaleDateString("pt-BR")+'</small><p>'+esc(r.notes||"")+'</p></div>'+offerHtml+action+'</article>';
  }).join(""):'<div class="empty">Nenhuma solicitação disponível nesta categoria no momento.</div>';
  document.querySelectorAll("[data-offer]").forEach(form=>form.onsubmit=async e=>{
    e.preventDefault();const f=e.currentTarget,fd=new FormData(f);
    const row={request_id:f.dataset.offer,supplier_id:currentUser.id,price:num(fd.get("offerPrice")),shipping:num(fd.get("offerShipping")),delivery_estimate:String(fd.get("offerDelivery")||""),notes:String(fd.get("offerNotes")||"")};
    const {error}=await supabaseClient.from("supplier_request_offers").upsert(row,{onConflict:"request_id,supplier_id"});
    if(error)return alert("Não foi possível enviar a proposta: "+error.message);
    await loadData();renderBuyerRequests();alert("Proposta enviada ao comprador!");
  });
}
$("requestCreateForm").addEventListener("submit",async e=>{
  e.preventDefault();if(currentRole!=="comprador")return;
  const row={buyer_id:currentUser.id,product_name:$("requestProduct").value.trim(),category:$("requestCategory").value,quantity:$("requestQuantity").value.trim(),specifications:$("requestSpecs").value.trim()||null,delivery_location:$("requestLocation").value.trim(),needed_by:$("requestDate").value||null,notes:$("requestNotes").value.trim()||null};
  const {error}=await supabaseClient.from("buyer_requests").insert(row);
  if(error)return alert("Não foi possível publicar: "+error.message);
  e.target.reset();await loadData();renderBuyerRequests();alert("Solicitação publicada! Fornecedores da categoria selecionada poderão enviar propostas.");
});

async function checkSession(session){
  currentUser=session?.user||null;
  if(!currentUser){currentRole=null;isAdmin=false;show("loginView");return}
  $("signedEmail").textContent=currentUser.email||"";
  const {data:access,error}=await supabaseClient.from("mfr_access").select("approved,role,email,name").eq("email",(currentUser.email||"").toLowerCase()).maybeSingle();
  if(error||!access?.approved||!["admin","comprador","fornecedor"].includes(access.role)){
    currentRole=null;isAdmin=false;show("pendingView");message("pendingMessage",error?"Não foi possível verificar a autorização: "+error.message:"Seu acesso não está autorizado ou foi bloqueado.","error");return;
  }
  currentRole=access.role;isAdmin=currentRole==="admin"&&currentUser.email.toLowerCase()===ADMIN_EMAIL;
  if(currentRole==="admin"&&!isAdmin){show("pendingView");message("pendingMessage","Conta administrativa sem autorização principal.","error");return}
  allowedTabs();show("appView");tab("home");
  try{await loadData();$("net").textContent="● Online"}catch(err){$("net").textContent="● Erro de conexão";alert("Erro ao carregar dados: "+err.message)}
}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();const email=$("loginEmail").value.trim().toLowerCase(),password=$("loginPassword").value;message("authMessage","Verificando acesso...");const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)return message("authMessage","E-mail ou senha incorretos: "+error.message,"error");await checkSession(data.session)});
async function signOut(){await supabaseClient.auth.signOut();currentUser=null;currentRole=null;isAdmin=false;show("loginView")}
$("signOut").addEventListener("click",signOut);$("pendingSignOut").addEventListener("click",signOut);
$("net").textContent=navigator.onLine?"● Conectado":"● Offline";
window.addEventListener("online",()=>$("net").textContent="● Conectado");
window.addEventListener("offline",()=>$("net").textContent="● Offline");
(async()=>{const {data:{session},error}=await supabaseClient.auth.getSession();if(error)console.error(error);await checkSession(session);supabaseClient.auth.onAuthStateChange((_event,s)=>setTimeout(()=>checkSession(s),0))})();
