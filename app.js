const $=id=>document.getElementById(id);
const read=k=>JSON.parse(localStorage.getItem(k)||"[]");
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
let products=read("mfr_products"), prices=read("mfr_prices");
const money=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function tab(name){document.querySelectorAll(".view").forEach(x=>x.classList.toggle("hidden",x.id!==name));document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));render()}
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>tab(b.dataset.tab));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>tab(b.dataset.go));
function render(){
$("countProducts").textContent=products.length;$("countPrices").textContent=prices.length;
$("priceProduct").innerHTML=products.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
$("productList").innerHTML=products.length?products.map(p=>`<div class="item"><div><b>${esc(p.name)}</b><small>${esc(p.category||"Sem categoria")} ${p.sku?"• "+esc(p.sku):""}</small><button data-del-product="${p.id}">Excluir</button></div></div>`).join(""):'<div class="empty">Nenhum produto cadastrado.</div>';
$("priceList").innerHTML=prices.length?[...prices].sort((a,b)=>b.created-a.created).map(q=>{let p=products.find(x=>x.id===q.productId);return `<div class="item"><div><b>${esc(p?.name||"Produto removido")}</b><small>${esc(q.store)} • ${new Date(q.created).toLocaleString("pt-BR")}</small>${q.url?`<small><a href="${esc(q.url)}" target="_blank" rel="noopener">Abrir anúncio</a></small>`:""}${q.notes?`<small>${esc(q.notes)}</small>`:""}<button data-del-price="${q.id}">Excluir cotação</button></div><div class="price">${money(q.price+q.shipping)}<small>total c/ frete</small></div></div>`}).join(""):'<div class="empty">Nenhuma cotação registrada.</div>';
const best=products.map(p=>({p,qs:prices.filter(q=>q.productId===p.id)})).filter(x=>x.qs.length).map(x=>({...x,best:x.qs.reduce((a,b)=>(a.price+a.shipping)<=(b.price+b.shipping)?a:b)}));
$("bestPrices").innerHTML=best.length?best.map(x=>`<div class="item"><div><b>${esc(x.p.name)}</b><small>Melhor oferta: ${esc(x.best.store)}</small></div><div class="price">${money(x.best.price+x.best.shipping)}</div></div>`).join(""):'Cadastre produtos e registre preços para ver a comparação.';
document.querySelectorAll("[data-del-product]").forEach(b=>b.onclick=()=>{if(confirm("Excluir produto e cotações relacionadas?")){products=products.filter(p=>p.id!==b.dataset.delProduct);prices=prices.filter(q=>q.productId!==b.dataset.delProduct);save("mfr_products",products);save("mfr_prices",prices);render()}});
document.querySelectorAll("[data-del-price]").forEach(b=>b.onclick=()=>{prices=prices.filter(q=>q.id!==b.dataset.delPrice);save("mfr_prices",prices);render()});
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("productForm").onsubmit=e=>{e.preventDefault();products.push({id:crypto.randomUUID(),name:$("pName").value.trim(),sku:$("pSku").value.trim(),category:$("pCategory").value.trim()});save("mfr_products",products);e.target.reset();render();alert("Produto cadastrado!")};
const num=s=>Number(String(s||"0").trim().replace(/\./g,"").replace(",", "."))||0;
$("priceForm").onsubmit=e=>{e.preventDefault();if(!products.length){alert("Cadastre um produto primeiro.");return}prices.push({id:crypto.randomUUID(),productId:$("priceProduct").value,store:$("store").value.trim(),price:num($("price").value),shipping:num($("shipping").value),url:$("url").value.trim(),notes:$("notes").value.trim(),created:Date.now()});save("mfr_prices",prices);e.target.reset();render();alert("Cotação registrada!")};
$("exportCsv").onclick=()=>{let rows=[["Produto","Loja","Preço","Frete","Total","Link","Observações"],...prices.map(q=>[products.find(p=>p.id===q.productId)?.name||"",q.store,q.price,q.shipping,q.price+q.shipping,q.url,q.notes])];let csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(";")).join("\n");let a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="mfr-market-cotacoes.csv";a.click();URL.revokeObjectURL(a.href)};
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
$("net").textContent=navigator.onLine?"● Online":"● Offline";window.addEventListener("online",()=>$("net").textContent="● Online");window.addEventListener("offline",()=>$("net").textContent="● Offline");render();