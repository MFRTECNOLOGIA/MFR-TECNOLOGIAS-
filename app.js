// MFR MARKET — aplicação com controle por perfil, comparação, relatórios e avisos
const SUPABASE_URL = "https://cuvyknvnkjcqnzpcorap.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nGJ-UEn8kzof785jGuKFCA_N3g1RZux";
const ADMIN_EMAIL = "xavofelipe@gmail.com";
const $ = id => document.getElementById(id);
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let currentUser=null, currentRole=null, isAdmin=false, products=[], prices=[], accessUsers=[], supplierProfiles=[], buyerRequests=[], requestOffers=[], serviceCategories=[], serviceProviders=[], serviceProviderCategories=[], serviceRequests=[], serviceReviews=[], dbNotifications=[], notificationChannel=null;
const money=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=s=>{const v=String(s??"0").trim().replace(/\./g,"").replace(",",".");const n=Number(v);return Number.isFinite(n)?n:0};

/* Contadores públicos: visitantes únicos do dia e visitantes ativos nos últimos 5 minutos. */
function getMfrVisitorId(){
  const key="mfr_market_visitor_id";
  let id=localStorage.getItem(key);
  if(!id){
    id=crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{
      const r=Math.random()*16|0;return(c==="x"?r:(r&3|8)).toString(16);
    });
    localStorage.setItem(key,id);
  }
  return id;
}
function paintVisitorStats(today,online){
  const t=Number(today||0),o=Number(online||0);
  ["visitorToday","visitorTodayLogin"].forEach(id=>{const el=$(id);if(el)el.textContent=t.toLocaleString("pt-BR")});
  ["visitorOnline","visitorOnlineLogin"].forEach(id=>{const el=$(id);if(el)el.textContent=o.toLocaleString("pt-BR")});
}
async function updateMfrVisitorStats(){
  try{
    const {data,error}=await supabaseClient.rpc("mfr_record_site_visit",{p_visitor_id:getMfrVisitorId()});
    if(error)throw error;
    const stats=Array.isArray(data)?data[0]:data;
    if(stats)paintVisitorStats(stats.visitors_today,stats.people_online);
  }catch(err){
    console.warn("Contadores públicos indisponíveis:",err.message);
    ["visitorToday","visitorTodayLogin","visitorOnline","visitorOnlineLogin"].forEach(id=>{const el=$(id);if(el)el.textContent="—"});
  }
}
updateMfrVisitorStats();
setInterval(updateMfrVisitorStats,60000);

function message(id,text,kind=""){const el=$(id);if(el){el.textContent=text;el.className="notice "+kind}}
function show(view){["loginView","pendingView","appView"].forEach(id=>$(id).classList.toggle("hidden",id!==view))}
function allowedTabs(){
  const buyer=currentRole==="comprador", supplier=currentRole==="fornecedor", provider=currentRole==="prestador";
  $("supplierProfileTab").classList.toggle("hidden",!(supplier||isAdmin));
  $("requestsTab").classList.toggle("hidden",isAdmin);
  $("requestCreateForm").classList.toggle("hidden",!buyer);
  $("supplierCategoryBox").classList.toggle("hidden",!(supplier||isAdmin));
  $("servicesTab").classList.toggle("hidden",!(buyer||supplier||provider||isAdmin));
  $("pricesTab").classList.toggle("hidden",provider);
  $("productsTab").classList.toggle("hidden",!(supplier||isAdmin));
  $("homeAddProduct").classList.toggle("hidden",!(supplier||isAdmin));
  $("homeAddQuote").classList.toggle("hidden",buyer||provider);
  $("pricesTab").textContent=buyer?"Consultar preços":"Cotações";
  $("quoteListTitle").textContent=buyer?"Comparação de cotações (menor total primeiro)":supplier?"Minhas cotações":"Todas as cotações";
  $("priceForm").classList.toggle("hidden",buyer||provider);
  $("exportCsv").classList.toggle("hidden",buyer||provider);
  $("reportsTab").classList.toggle("hidden",supplier||provider);
  $("adminTab").classList.toggle("hidden",!isAdmin);
  $("adminOverview").classList.toggle("hidden",!isAdmin);
  $("notificationsPanel").classList.toggle("hidden",false);
  $("homeTitle").textContent=isAdmin?"Painel administrativo MFR":buyer?"Painel do comprador":provider?"Painel do prestador":"Painel do fornecedor";
  $("bestPricesTitle").textContent=buyer?"Melhores ofertas por produto":supplier?"Resumo das suas cotações":"Resumo de melhores preços";
}
function tab(name){
  if(name==="admin"&&!isAdmin)return;
  if(name==="products"&&currentRole!=="fornecedor"&&!isAdmin)return;
  if(name==="reports"&&["fornecedor","prestador"].includes(currentRole))return;
  if(name==="prices"&&currentRole==="prestador")return;
  if(name==="supplierProfile"&&currentRole!=="fornecedor"&&!isAdmin)return;
  if(name==="requests"&&isAdmin)return;
  if(name==="services"&&!["comprador","fornecedor","prestador"].includes(currentRole)&&!isAdmin)return;
  document.querySelectorAll(".view").forEach(x=>x.classList.toggle("hidden",x.id!==name));
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
  if(name==="admin"&&isAdmin)loadAccessList();
  if(name==="reports")renderReports();
  if(name==="supplierProfile")loadSupplierProfile();
  if(name==="requests")renderBuyerRequests();
  if(name==="services")loadServices();
}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>tab(b.dataset.tab)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>tab(b.dataset.go)));
async function loadData(){
  const [pRes,qRes,sRes]=await Promise.all([
    supabaseClient.from("products").select("id,name,sku,category,image_urls,created_at").order("name"),
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
function productThumb(p){
  const url=Array.isArray(p?.image_urls)?p.image_urls[0]:"";
  return url ? '<img class="product-thumb" src="'+esc(url)+'" alt="Foto de '+esc(p?.name||"produto")+'" loading="lazy">' : '<div class="product-thumb product-placeholder">SEM FOTO</div>';
}
function productGallery(p){
  const urls=Array.isArray(p?.image_urls)?p.image_urls:[];
  return urls.length?'<div class="product-gallery">'+urls.map((url,i)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer" aria-label="Abrir foto '+(i+1)+' de '+esc(p?.name||"produto")+'"><img src="'+esc(url)+'" alt="'+esc(p?.name||"Produto")+' - foto '+(i+1)+'" loading="lazy"></a>').join("")+'</div>':'<div class="product-thumb product-placeholder">SEM FOTO</div>';
}
function render(){
  $("countProducts").textContent=products.length;
  $("countPrices").textContent=prices.length;
  $("priceProduct").innerHTML=products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("");
  $("productForm").classList.toggle("hidden",!(currentRole==="fornecedor"||isAdmin));
  const productTerm=($("productSearch")?.value||"").toLocaleLowerCase("pt-BR");
  const category=$("productCategoryFilter")?.value||"";
  const shownProducts=products.filter(p=>(!category||p.category===category)&&(!productTerm||p.name.toLocaleLowerCase("pt-BR").includes(productTerm)));
  $("productList").innerHTML=shownProducts.length?shownProducts.map(p=>'<div class="item product-item">'+productGallery(p)+'<div class="product-item-info"><b>'+esc(p.name)+'</b><small>'+esc(p.category||"Sem categoria")+(p.sku?" • "+esc(p.sku):"")+'</small><small>'+(Array.isArray(p.image_urls)?p.image_urls.length:0)+' foto(s)</small></div></div>').join(""):'<div class="empty">Nenhum produto encontrado.</div>';
  const term=($("quoteSearch")?.value||"").toLocaleLowerCase("pt-BR");
  const quoteCategory=$("quoteCategoryFilter")?.value||"";
  const shownQuotes=prices.filter(q=>{const p=products.find(x=>x.id===q.product_id);const matchesCategory=!quoteCategory||p?.category===quoteCategory;const matchesTerm=!term||((p?.name||"").toLocaleLowerCase("pt-BR").includes(term))||q.store.toLocaleLowerCase("pt-BR").includes(term);return matchesCategory&&matchesTerm}).sort((a,b)=>total(a)-total(b));
  $("priceList").innerHTML=shownQuotes.length?shownQuotes.map(q=>{
    const p=products.find(x=>x.id===q.product_id),expiry=q.expires_at?new Date(q.expires_at).toLocaleDateString("pt-BR"):"—";
    const own=isAdmin||q.created_by===currentUser?.id;
    const contact=supplierProfiles.find(x=>x.user_id===q.created_by)?.whatsapp||"";
    const whatsappDigits=contact.replace(/[^0-9]/g,"");
    const messageText="Olá! Tenho interesse na cotação do produto "+(p?.name||"Produto")+". Vi sua oferta na loja "+q.store+". Preço: "+money(q.price)+". Frete: "+money(q.shipping)+". Total: "+money(total(q))+". Podemos negociar?";
    const whatsappAction=(whatsappDigits?'<a class="whatsapp-link" href="https://wa.me/55'+whatsappDigits+'?text='+encodeURIComponent(messageText)+'" target="_blank" rel="noopener noreferrer">CHAT COM O VENDEDOR • WHATSAPP</a><small class="muted">WhatsApp: +55'+whatsappDigits+'</small>':'<small class="muted">Vendedor ainda não cadastrou o WhatsApp comercial.</small>');
    return '<div class="item quote-item">'+productThumb(p)+'<div class="quote-item-info"><b>'+esc(p?.name||"Produto")+'</b><small>'+esc(q.store)+' • '+new Date(q.created_at).toLocaleString("pt-BR")+'</small><small>Produto: '+money(q.price)+' • Frete: '+money(q.shipping)+' • Validade: '+expiry+'</small>'+(q.url?'<small><a href="'+esc(q.url)+'" target="_blank" rel="noopener noreferrer">Abrir anúncio</a></small>':"")+(q.notes?'<small>'+esc(q.notes)+'</small>':"")+whatsappAction+(own&&!buyerMode()?'<button data-del-price="'+esc(q.id)+'">Excluir cotação</button>':"")+'</div><div class="price">'+money(total(q))+'<small>total com frete</small></div></div>';
  }).join(""):'<div class="empty">Nenhuma cotação encontrada.</div>';
  const grouped=products.map(p=>({p,qs:prices.filter(q=>q.product_id===p.id)})).filter(x=>x.qs.length);
  $("bestPrices").innerHTML=grouped.length?grouped.map(x=>{const best=[...x.qs].sort((a,b)=>total(a)-total(b))[0];return '<div class="item best-price-item">'+productThumb(x.p)+'<div class="best-price-info"><b>'+esc(x.p.name)+'</b><small>Melhor oferta: '+esc(best.store)+'</small></div><div class="price">'+money(total(best))+'</div></div>'}).join(""):'<div class="empty">Ainda não há cotações para comparar.</div>';
  if(isAdmin){const active=accessUsers.filter(u=>u.approved);$("metricUsers").textContent=active.length;$("metricBuyers").textContent=active.filter(u=>u.role==="comprador").length;$("metricSuppliers").textContent=active.filter(u=>u.role==="fornecedor").length;$("metricQuotes").textContent=prices.length}
  renderNotifications();renderReports();
  document.querySelectorAll("[data-del-price]").forEach(b=>b.onclick=async()=>{if(!confirm("Excluir somente esta cotação? Os cadastros de produtos serão mantidos."))return;const {error}=await supabaseClient.from("prices").delete().eq("id",b.dataset.delPrice);if(error)return alert("Erro: "+error.message);await loadData()});
}
function buyerMode(){return currentRole==="comprador"&&!isAdmin}
async function loadDatabaseNotifications(){
  if(!currentUser)return;
  const {data,error}=await supabaseClient.from("mfr_notifications").select("id,kind,title,body,target_tab,related_id,created_at,read_at").order("created_at",{ascending:false}).limit(30);
  if(error){console.warn("Central de notificações:",error.message);return;}
  dbNotifications=data||[];
  renderNotifications();
}
function startNotificationRealtime(){
  if(!currentUser)return;
  if(notificationChannel)supabaseClient.removeChannel(notificationChannel);
  notificationChannel=supabaseClient.channel("mfr-notifications-"+currentUser.id)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"mfr_notifications",filter:"recipient_id=eq."+currentUser.id},payload=>{
      dbNotifications=[payload.new,...dbNotifications].slice(0,30);
      renderNotifications();
      if("Notification" in window&&Notification.permission==="granted"&&document.visibilityState==="visible"){
        try{new Notification(payload.new.title,{body:payload.new.body,icon:"./icon.svg"});}catch(_){}
      }
    }).subscribe();
  loadDatabaseNotifications();
}
async function markMfrNotificationRead(id,target){
  const {error}=await supabaseClient.from("mfr_notifications").update({read_at:new Date().toISOString()}).eq("id",id);
  if(error)return alert("Não foi possível marcar como lida: "+error.message);
  dbNotifications=dbNotifications.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n);
  renderNotifications();
  if(target==="requests")tab("requests");
  else if(target==="services")tab("services");
}
function renderNotifications(){
  const now=Date.now(),items=[];
  dbNotifications.forEach(n=>items.push({id:n.id,title:n.title,detail:n.body,date:new Date(n.created_at).getTime(),read:!!n.read_at,target:n.target_tab}));
  if(currentRole==="comprador"){
    prices.slice(0,5).forEach(q=>{const p=products.find(x=>x.id===q.product_id);items.push({title:"Cotação disponível: "+(p?.name||"Produto"),detail:"Fornecedor: "+q.store+" · Total com frete: "+money(total(q)),date:new Date(q.created_at).getTime(),read:true})});
  }else{
    prices.filter(q=>q.created_by===currentUser?.id&&q.expires_at&&new Date(q.expires_at).getTime()-now<48*3600000).forEach(q=>{const p=products.find(x=>x.id===q.product_id);items.push({title:"Cotação próxima do vencimento: "+(p?.name||"Produto"),detail:"Validade: "+new Date(q.expires_at).toLocaleString("pt-BR"),date:new Date(q.expires_at).getTime(),read:true})});
  }
  if(isAdmin){items.unshift({title:"Resumo administrativo atualizado",detail:accessUsers.length+" contas cadastradas · "+prices.length+" cotações visíveis.",date:now,read:true})}
  const sorted=items.sort((a,b)=>b.date-a.date);
  $("notificationsList").innerHTML=sorted.length?sorted.map(x=>x.id?'<button type="button" class="notification mfr-notification '+(x.read?'is-read':'is-unread')+'" data-mfr-notification="'+esc(x.id)+'" data-target-tab="'+esc(x.target||"home")+'"><b>'+esc(x.title)+'</b><small>'+esc(x.detail)+'</small><small>'+(x.read?"Visualizada":"Nova · toque para abrir")+'</small></button>':'<div class="notification"><b>'+esc(x.title)+'</b><small>'+esc(x.detail)+'</small></div>').join(""):'<div class="empty">Nenhum aviso no momento.</div>';
  document.querySelectorAll("[data-mfr-notification]").forEach(b=>b.onclick=()=>markMfrNotificationRead(b.dataset.mfrNotification,b.dataset.targetTab));
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
$("quoteCategoryFilter")?.addEventListener("change",render);
$("productForm").addEventListener("submit",async e=>{
  e.preventDefault();if(currentRole!=="fornecedor"&&!isAdmin)return alert("Somente fornecedores autorizados e o administrador cadastram produtos.");
  const files=[...($("pImages").files||[])];
  if(files.length>6)return message("productImageMessage","Escolha no máximo 6 fotos.","error");
  const allowed=["image/jpeg","image/png","image/webp"];
  for(const file of files){
    if(!allowed.includes(file.type))return message("productImageMessage","Use somente imagens JPG, PNG ou WEBP.","error");
    if(file.size>5*1024*1024)return message("productImageMessage","Cada foto deve ter no máximo 5 MB.","error");
  }
  const productId=crypto.randomUUID(),paths=[],urls=[];
  const button=e.target.querySelector('button[type="submit"]');button.disabled=true;button.textContent="SALVANDO PRODUTO...";
  message("productImageMessage",files.length?"Enviando fotos para o servidor...":"Salvando produto...");
  try{
    for(const file of files){
      const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";
      const path=currentUser.id+"/"+productId+"/"+crypto.randomUUID()+"."+ext;
      const {error:uploadError}=await supabaseClient.storage.from("product-images").upload(path,file,{cacheControl:"31536000",contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      paths.push(path);
      const {data}=supabaseClient.storage.from("product-images").getPublicUrl(path);urls.push(data.publicUrl);
    }
    const row={id:productId,name:$("pName").value.trim(),sku:$("pSku").value.trim()||null,category:$("pCategory").value,created_by:currentUser.id,image_urls:urls};
    const {error}=await supabaseClient.from("products").insert(row);if(error)throw error;
    e.target.reset();message("productImageMessage",urls.length+" foto(s) vinculada(s) ao produto.","success");
    await loadData();alert("Produto cadastrado com sucesso e fotos salvas no servidor.");
  }catch(err){
    if(paths.length)await supabaseClient.storage.from("product-images").remove(paths);
    message("productImageMessage","Não foi possível salvar o produto: "+(err.message||"Erro desconhecido."),"error");
  }finally{button.disabled=false;button.textContent="Salvar produto"}
});
$("priceForm").addEventListener("submit",async e=>{
  e.preventDefault();if(buyerMode())return alert("Compradores não cadastram cotações.");if(!products.length)return alert("Ainda não existem produtos cadastrados.");const ownProfile=supplierProfiles.find(x=>x.user_id===currentUser?.id);if(!ownProfile?.whatsapp)return alert("Antes de publicar uma cotação, cadastre seu WhatsApp em Meu perfil. Ele aparecerá no anúncio para o comprador entrar em contato.");
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
  if(currentRole!=="fornecedor"&&!isAdmin)return;
  // Garante que as categorias sejam exibidas também no perfil do administrador.
  $("supplierCategoryBox").classList.remove("hidden");
  $("supplierCategoryBox").style.display="block";
  const own=supplierProfiles.find(x=>x.user_id===currentUser?.id);
  $("supplierWhatsapp").value=own?.whatsapp||"";
  const chosen=own?.categories||[];document.querySelectorAll("[name=supplierCategories]").forEach(c=>c.checked=chosen.includes(c.value));
  message("supplierProfileMessage",own?"WhatsApp cadastrado. Você pode atualizá-lo.":"Cadastre seu WhatsApp comercial para receber negociações.");
}
$("supplierProfileForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(currentRole!=="fornecedor"&&!isAdmin)return message("supplierProfileMessage","Somente fornecedores e administradores podem alterar este perfil.","error");
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


/* MFR Serviços + MFR Avalia */
function serviceAverage(reviews){
  const visible=(reviews||[]).filter(r=>r.is_visible!==false);
  if(!visible.length)return 0;
  const sum=visible.reduce((acc,r)=>acc+Number(r.quality_rating||0)+Number(r.punctuality_rating||0)+Number(r.service_rating||0)+Number(r.cost_benefit_rating||0),0);
  return sum/(visible.length*4);
}
function serviceRatingStars(value){
  const rounded=Math.round(Number(value||0));
  return "★".repeat(rounded)+"☆".repeat(5-rounded);
}
async function loadServices(){
  if(!currentUser||!["comprador","fornecedor","prestador","admin"].includes(currentRole))return;
  const [catRes,providerRes,providerCatRes,requestRes,reviewRes]=await Promise.all([
    supabaseClient.from("service_categories").select("id,name,slug").eq("is_active",true).order("sort_order"),
    supabaseClient.from("service_providers").select("id,business_name,contact_name,description,whatsapp,email,city,state,service_area,is_verified,is_active").eq("is_active",true).order("business_name"),
    supabaseClient.from("service_provider_categories").select("provider_id,category_id"),
    supabaseClient.from("service_requests").select("id,requester_id,requester_whatsapp,provider_id,category_id,title,description,service_city,service_state,status,requested_at,completed_at").order("requested_at",{ascending:false}),
    supabaseClient.from("service_reviews").select("id,request_id,provider_id,reviewer_id,quality_rating,punctuality_rating,service_rating,cost_benefit_rating,comment,is_visible,created_at")
  ]);
  const failed=[catRes,providerRes,providerCatRes,requestRes,reviewRes].find(x=>x.error);
  if(failed){$("serviceProviderList").innerHTML='<div class="empty">Não foi possível carregar os serviços: '+esc(failed.error.message)+'</div>';return}
  serviceCategories=catRes.data||[];
  serviceProviders=providerRes.data||[];
  serviceProviderCategories=providerCatRes.data||[];
  serviceRequests=requestRes.data||[];
  serviceReviews=reviewRes.data||[];
  const categoryFilter=$("serviceCategoryFilter"),providerCategorySelect=$("serviceProviderCategories");
  const currentFilter=categoryFilter.value;
  categoryFilter.innerHTML='<option value="">Todas as categorias</option>'+serviceCategories.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join("");
  if(serviceCategories.some(c=>c.id===currentFilter))categoryFilter.value=currentFilter;
  providerCategorySelect.innerHTML=serviceCategories.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join("");
  $("serviceProviderFormWrap").classList.toggle("hidden",!isAdmin);
  renderServiceProviders();
  renderServiceRequests();
}
function renderServiceProviders(){
  const categoryId=$("serviceCategoryFilter").value;
  const term=$("serviceSearch").value.trim().toLocaleLowerCase("pt-BR");
  const sort=$("serviceSort").value;
  let rows=serviceProviders.map(p=>{
    const categoryIds=serviceProviderCategories.filter(x=>x.provider_id===p.id).map(x=>x.category_id);
    const categories=serviceCategories.filter(c=>categoryIds.includes(c.id));
    const reviews=serviceReviews.filter(r=>r.provider_id===p.id&&r.is_visible!==false);
    return {...p,categories,reviews,average:serviceAverage(reviews)};
  }).filter(p=>(!categoryId||p.categories.some(c=>c.id===categoryId))&&(!term||[p.business_name,p.contact_name,p.description,p.city,p.service_area,...p.categories.map(c=>c.name)].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(term)));
  if(sort==="name")rows.sort((a,b)=>a.business_name.localeCompare(b.business_name,"pt-BR"));
  else if(sort==="reviews")rows.sort((a,b)=>b.reviews.length-a.reviews.length||b.average-a.average);
  else rows.sort((a,b)=>b.average-a.average||b.reviews.length-a.reviews.length||a.business_name.localeCompare(b.business_name,"pt-BR"));
  $("serviceProviderList").innerHTML=rows.length?rows.map(p=>{
    const digits=String(p.whatsapp||"").replace(/[^0-9]/g,"");
    const wa=digits?'<a class="whatsapp-link" href="https://wa.me/55'+esc(digits)+'?text='+encodeURIComponent("Olá! Encontrei seu contato no MFR Market e gostaria de informações sobre seus serviços.")+'" target="_blank" rel="noopener noreferrer">CONTATAR PELO WHATSAPP</a>':"";
    const rating=p.reviews.length?'<strong class="service-rating">'+serviceRatingStars(p.average)+' '+p.average.toFixed(1).replace(".",",")+'/5</strong><small>'+p.reviews.length+' avaliação(ões) verificadas por solicitação</small>':'<strong class="service-rating service-no-rating">Ainda sem avaliações</strong><small>Este prestador está começando na rede MFR.</small>';
    const cats=p.categories.map(c=>'<span class="service-chip">'+esc(c.name)+'</span>').join("");
    const verify=p.is_verified?'<span class="service-verified">✓ Prestador verificado pela MFR</span>':'<span class="service-unverified">Cadastro publicado na rede MFR</span>';
    const requestCategory=(categoryId&&p.categories.some(c=>c.id===categoryId))?categoryId:(p.categories[0]?.id||"");
    const requestButton=currentRole==="comprador"?'<button type="button" data-service-request="'+esc(p.id)+'" data-category-id="'+esc(requestCategory)+'">SOLICITAR SERVIÇO</button>':"";
    return '<article class="panel service-provider-card"><div class="service-card-top"><div><h3>'+esc(p.business_name)+'</h3><small>'+esc(p.city)+'/'+esc(p.state)+(p.service_area?' · Atende: '+esc(p.service_area):"") +'</small></div>'+verify+'</div><div class="service-chips">'+cats+'</div><p>'+esc(p.description||"Entre em contato para consultar especialidades, disponibilidade e orçamento.")+'</p><div class="service-rating-block">'+rating+'</div><div class="service-card-actions">'+wa+requestButton+'</div></article>';
  }).join(""):'<div class="empty">Nenhum prestador encontrado para este filtro. Tente outra categoria ou volte mais tarde.</div>';
  document.querySelectorAll("[data-service-request]").forEach(b=>b.onclick=()=>{
    $("serviceRequestProviderId").value=b.dataset.serviceRequest;
    $("serviceRequestCategoryId").value=b.dataset.categoryId;
    $("serviceRequestFormWrap").classList.remove("hidden");
    $("serviceRequestTitle").focus();
    $("serviceRequestFormWrap").scrollIntoView({behavior:"smooth",block:"start"});
  });
}
function renderServiceRequests(){
  const matchedServiceProvider=r=>serviceProviders.find(p=>{
    if((p.email||"").toLowerCase()!==(currentUser?.email||"").toLowerCase()||!p.is_active||String(p.state||"").toUpperCase()!==String(r.service_state||"").toUpperCase())return false;
    const cats=serviceProviderCategories.filter(x=>x.provider_id===p.id).map(x=>x.category_id);
    const norm=v=>String(v||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").trim().toLowerCase();
    const city=norm(r.service_city), providerCity=norm(p.city), area=norm(p.service_area);
    return cats.includes(r.category_id)&&(providerCity===city||city.includes(providerCity.split("/")[0])||area.includes(city));
  });
  const providerCanSeeRequest=r=>["fornecedor","prestador"].includes(currentRole)&&r.status==="pending"&&!!matchedServiceProvider(r);
  const providerOwnsRequest=r=>["fornecedor","prestador"].includes(currentRole)&&r.status==="in_progress"&&matchedServiceProvider(r)?.id===r.provider_id;
  const mine=serviceRequests.filter(r=>isAdmin||r.requester_id===currentUser?.id||providerCanSeeRequest(r)||providerOwnsRequest(r));
  const html=mine.map(r=>{
    const provider=serviceProviders.find(p=>p.id===r.provider_id);
    const category=serviceCategories.find(c=>c.id===r.category_id);
    const review=serviceReviews.find(x=>x.request_id===r.id);
    const statusLabel={pending:"Aguardando contato",in_progress:"Em andamento",completed:"Concluído",cancelled:"Cancelado"}[r.status]||r.status;
    let actions="";
    if(isAdmin){
      if(r.status==="pending")actions+='<button data-service-status="in_progress" data-service-id="'+esc(r.id)+'">MARCAR EM ANDAMENTO</button>';
      if(r.status==="in_progress")actions+='<button data-service-status="completed" data-service-id="'+esc(r.id)+'">CONFIRMAR CONCLUSÃO</button><button class="secondary-button" data-service-status="cancelled" data-service-id="'+esc(r.id)+'">CANCELAR</button>';
    }else if(["fornecedor","prestador"].includes(currentRole)&&providerCanSeeRequest(r)){
      actions+='<button data-service-status="in_progress" data-service-id="'+esc(r.id)+'">ACEITAR OPORTUNIDADE</button>';
    }else if(r.requester_id===currentUser?.id&&r.status==="in_progress"){
      actions+='<button data-service-status="completed" data-service-id="'+esc(r.id)+'">CONFIRMAR CONCLUSÃO</button><button class="secondary-button" data-service-status="cancelled" data-service-id="'+esc(r.id)+'">CANCELAR SOLICITAÇÃO</button>';
    }
    let reviewHtml="";
    if(r.status==="completed"&&!review&&!isAdmin&&r.requester_id===currentUser?.id){
      reviewHtml='<form class="service-review-form" data-service-review="'+esc(r.id)+'" data-provider="'+esc(r.provider_id)+'"><h4>Avalie este serviço</h4><div class="service-rating-grid"><label>Qualidade<select name="quality_rating" required><option value="">Nota</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Pontualidade<select name="punctuality_rating" required><option value="">Nota</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Atendimento<select name="service_rating" required><option value="">Nota</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Custo-benefício<select name="cost_benefit_rating" required><option value="">Nota</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label></div><label>Comentário (opcional)</label><textarea name="comment" maxlength="1500" placeholder="Conte como foi sua experiência."></textarea><button type="submit">ENVIAR AVALIAÇÃO</button></form>';
    }else if(review)reviewHtml='<p class="service-review-sent">✓ Avaliação enviada. Obrigado por ajudar outras empresas a escolherem melhor.</p>';
    const contactDigits=String(r.requester_whatsapp||"").replace(/[^0-9]/g,"");
    const contactPhone=contactDigits.startsWith("55")?contactDigits:"55"+contactDigits;
    const contactLink=(providerCanSeeRequest(r)||providerOwnsRequest(r))&&contactDigits?'<a class="whatsapp-link" href="https://wa.me/'+esc(contactPhone)+'?text='+encodeURIComponent("Olá! Vi sua solicitação no MFR Market e posso conversar sobre o serviço.")+'" target="_blank" rel="noopener noreferrer">CONTATAR SOLICITANTE PELO WHATSAPP</a>':"";
    const noContact=(providerCanSeeRequest(r)||providerOwnsRequest(r))&&!contactDigits?'<small>O solicitante não informou WhatsApp.</small>':"";
    return '<article class="panel service-request-card"><div><b>'+esc(r.title)+'</b><small>'+esc(provider?.business_name||"Solicitação aberta")+' · '+esc(category?.name||"Serviço")+' · '+esc(r.service_city)+'/'+esc(r.service_state)+'</small><span class="service-status">'+statusLabel+'</span><small>Solicitado em '+new Date(r.requested_at).toLocaleDateString("pt-BR")+'</small><p>'+esc(r.description||"")+'</p>'+contactLink+noContact+'</div><div class="service-request-actions">'+actions+'</div>'+reviewHtml+'</article>';
  }).join("");
  $("serviceRequestList").innerHTML=html||'<div class="empty">Você ainda não fez solicitações de serviços.</div>';
  document.querySelectorAll("[data-service-status]").forEach(b=>b.onclick=async()=>{
    const next=b.dataset.serviceStatus;
    const update={status:next,updated_at:new Date().toISOString()};
    if(next==="completed")update.completed_at=new Date().toISOString();
    if(next==="in_progress"&&["fornecedor","prestador"].includes(currentRole)){const request=serviceRequests.find(r=>r.id===b.dataset.serviceId);const matched=matchedServiceProvider(request||{});if(matched)update.provider_id=matched.id;}
    const {error}=await supabaseClient.from("service_requests").update(update).eq("id",b.dataset.serviceId);
    if(error)return alert("Não foi possível atualizar a solicitação: "+error.message);
    await loadServices();
  });
  document.querySelectorAll("[data-service-review]").forEach(form=>form.onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(form);
    const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent="ENVIANDO AVALIAÇÃO...";
    const {error}=await supabaseClient.rpc("mfr_submit_service_review",{
      p_request_id:form.dataset.serviceReview,
      p_quality_rating:Number(fd.get("quality_rating")),
      p_punctuality_rating:Number(fd.get("punctuality_rating")),
      p_service_rating:Number(fd.get("service_rating")),
      p_cost_benefit_rating:Number(fd.get("cost_benefit_rating")),
      p_comment:String(fd.get("comment")||"").trim()||null
    });
    if(error){button.disabled=false;button.textContent="ENVIAR AVALIAÇÃO";return message("serviceRequestMessage","Não foi possível enviar a avaliação: "+error.message,"error");}
    message("serviceRequestMessage","Avaliação registrada com sucesso! Obrigado por fortalecer a confiança na rede MFR.","success");
    await loadServices();
  });
}
$("serviceCategoryFilter").addEventListener("change",renderServiceProviders);
$("serviceSearch").addEventListener("input",renderServiceProviders);
$("serviceSort").addEventListener("change",renderServiceProviders);
$("serviceProviderForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!isAdmin)return;
  const categories=[...$("serviceProviderCategories").selectedOptions].map(o=>o.value);
  if(!categories.length)return message("serviceProviderMessage","Selecione ao menos uma categoria.","error");
  const whatsapp=String($("serviceWhatsapp").value||"").replace(/[^0-9]/g,"");
  if(!/^[0-9]{10,13}$/.test(whatsapp))return message("serviceProviderMessage","Informe um WhatsApp válido com DDD e código do país opcional.","error");
  const row={business_name:$("serviceBusinessName").value.trim(),contact_name:$("serviceContactName").value.trim()||null,whatsapp,email:$("serviceEmail").value.trim().toLowerCase()||null,city:$("serviceCity").value.trim(),state:$("serviceState").value.trim().toUpperCase(),service_area:$("serviceArea").value.trim()||null,description:$("serviceDescription").value.trim()||null,is_verified:$("serviceVerified").checked,created_by:currentUser.id};
  const {data,error}=await supabaseClient.from("service_providers").insert(row).select("id").single();
  if(error)return message("serviceProviderMessage","Erro ao cadastrar prestador: "+error.message,"error");
  const {error:categoryError}=await supabaseClient.from("service_provider_categories").insert(categories.map(category_id=>({provider_id:data.id,category_id})));
  if(categoryError)return message("serviceProviderMessage","Prestador cadastrado, mas houve erro ao vincular categorias: "+categoryError.message,"error");
  e.target.reset();$("serviceState").value="SC";message("serviceProviderMessage","Prestador cadastrado com sucesso!","success");await loadServices();
});
$("serviceRequestForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const requesterPhone=$("serviceRequestWhatsapp").value.replace(/[^0-9]/g,"");
  if(!/^[0-9]{10,13}$/.test(requesterPhone))return message("serviceRequestMessage","Informe um WhatsApp válido com DDD.","error");
  const row={requester_id:currentUser.id,requester_whatsapp:requesterPhone,provider_id:$("serviceRequestProviderId").value,category_id:$("serviceRequestCategoryId").value,title:$("serviceRequestTitle").value.trim(),description:$("serviceRequestDescription").value.trim()||null,service_city:$("serviceRequestCity").value.trim(),service_state:$("serviceRequestState").value.trim().toUpperCase()};
  const {error}=await supabaseClient.from("service_requests").insert(row);
  if(error)return message("serviceRequestMessage","Não foi possível enviar: "+error.message,"error");
  e.target.reset();$("serviceRequestState").value="SC";$("serviceRequestFormWrap").classList.add("hidden");message("serviceRequestMessage","Solicitação enviada!","success");await loadServices();alert("Solicitação enviada ao prestador. Acompanhe o andamento nesta área.");
});
$("cancelServiceRequest").addEventListener("click",()=>$("serviceRequestFormWrap").classList.add("hidden"));

async function checkSession(session){
  currentUser=session?.user||null;
  if(!currentUser){currentRole=null;isAdmin=false;show("loginView");return}
  $("signedEmail").textContent=currentUser.email||"";
  const {data:access,error}=await supabaseClient.from("mfr_access").select("approved,role,email,name").eq("email",(currentUser.email||"").toLowerCase()).maybeSingle();
  if(error||!access?.approved||!["admin","comprador","fornecedor","prestador"].includes(access.role)){
    currentRole=null;isAdmin=false;show("pendingView");message("pendingMessage",error?"Não foi possível verificar a autorização: "+error.message:"Seu acesso não está autorizado ou foi bloqueado.","error");return;
  }
  currentRole=access.role;isAdmin=currentRole==="admin"&&currentUser.email.toLowerCase()===ADMIN_EMAIL;
  if(currentRole==="admin"&&!isAdmin){show("pendingView");message("pendingMessage","Conta administrativa sem autorização principal.","error");return}
  allowedTabs();show("appView");tab("home");startNotificationRealtime();
  try{await loadData();$("net").textContent="● Online";await loadDatabaseNotifications()}catch(err){$("net").textContent="● Erro de conexão";alert("Erro ao carregar dados: "+err.message)}
}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();const email=$("loginEmail").value.trim().toLowerCase(),password=$("loginPassword").value;message("authMessage","Verificando acesso...");const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)return message("authMessage","E-mail ou senha incorretos: "+error.message,"error");await checkSession(data.session)});
async function signOut(){if(notificationChannel){await supabaseClient.removeChannel(notificationChannel);notificationChannel=null}dbNotifications=[];await supabaseClient.auth.signOut();currentUser=null;currentRole=null;isAdmin=false;show("loginView")}
$("signOut").addEventListener("click",signOut);$("pendingSignOut").addEventListener("click",signOut);
$("net").textContent=navigator.onLine?"● Conectado":"● Offline";
window.addEventListener("online",()=>$("net").textContent="● Conectado");
window.addEventListener("offline",()=>$("net").textContent="● Offline");
(async()=>{const {data:{session},error}=await supabaseClient.auth.getSession();if(error)console.error(error);await checkSession(session);supabaseClient.auth.onAuthStateChange((_event,s)=>setTimeout(()=>checkSession(s),0))})();
