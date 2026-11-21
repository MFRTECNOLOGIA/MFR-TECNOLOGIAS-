/* MFR Market — importação de planilhas para cotações */
(()=>{
  const $=id=>document.getElementById(id);
  let parsedRows=[];
  const norm=s=>String(s??"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().trim();
  const pick=(obj,keys)=>{const k=Object.keys(obj).find(x=>keys.includes(norm(x)));return k?obj[k]:""};
  const setMsg=(t,kind="")=>{const el=$("quoteImportMessage");if(el){el.textContent=t;el.className="notice "+kind}};
  const aliases={product:["produto","item","descricao","descrição","nome do produto","produto/item"],price:["preco","preço","valor","preco unitario","preço unitário","valor unitario","valor unitário"],shipping:["frete","entrega","valor frete"],quantity:["quantidade","qtd","qtde"],notes:["observacao","observação","observacoes","observações","detalhes"]};
  const toNum=v=>{if(typeof v==="number")return v;let s=String(v??"").replace(/R\\$/gi,"").replace(/\\s/g,"");if(s.includes(","))s=s.replace(/\\./g,"").replace(",",".");const n=Number(s);return Number.isFinite(n)?n:NaN};
  const money=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  function productOptions(selected){return '<option value="">Selecione o produto do catálogo</option>'+products.map(p=>'<option value="'+p.id+'" '+(p.id===selected?"selected":"")+'>'+String(p.name).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</option>').join("")}
  function renderPreview(){
    $("quoteImportPreview").innerHTML=parsedRows.length?'<div class="panel"><h3>Conferência antes de importar ('+parsedRows.length+' linhas)</h3><p class="muted">Confira o vínculo de cada linha com um produto já cadastrado no catálogo. Linhas sem produto correspondente precisam ser selecionadas manualmente.</p><div class="quote-import-table-wrap"><table class="quote-import-table"><thead><tr><th>Incluir</th><th>Produto na planilha</th><th>Produto MFR</th><th>Qtd.</th><th>Preço unit.</th><th>Frete</th></tr></thead><tbody>'+parsedRows.map((r,i)=>'<tr><td><input type="checkbox" data-qi-include="'+i+'" checked></td><td>'+r.product.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</td><td><select data-qi-product="'+i+'">'+productOptions(r.productId)+'</select></td><td>'+String(r.quantity||"—")+'</td><td>'+money(r.price)+'</td><td>'+money(r.shipping)+'</td></tr>').join("")+'</tbody></table></div></div>':'';
    $("quoteImportSave").classList.toggle("hidden",!parsedRows.length);
  }
  $("quoteImportRead").addEventListener("click",async()=>{
    if(!["fornecedor","admin"].includes(currentRole))return setMsg("Somente fornecedores autorizados podem importar cotações.","error");
    const f=$("quoteImportFile").files?.[0];if(!f)return setMsg("Selecione uma planilha primeiro.","error");
    if(f.size>10*1024*1024)return setMsg("O arquivo deve ter no máximo 10 MB.","error");
    try{
      const data=await f.arrayBuffer();const wb=XLSX.read(data,{type:"array"});const sheet=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(sheet,{defval:"",raw:false});if(!rows.length)throw new Error("A primeira aba não contém linhas de dados.");
      parsedRows=rows.map(row=>{
        const product=String(pick(row,aliases.product)||"").trim(),price=toNum(pick(row,aliases.price)),shipping=toNum(pick(row,aliases.shipping)||0),quantity=String(pick(row,aliases.quantity)||"").trim(),notes=String(pick(row,aliases.notes)||"").trim();
        const match=products.find(p=>norm(p.name)===norm(product));
        return {product,price,shipping:Number.isFinite(shipping)?shipping:0,quantity,notes,productId:match?.id||"",valid:!!product&&Number.isFinite(price)&&price>0};
      }).filter(r=>r.product);
      if(!parsedRows.length)throw new Error("Não encontrei linhas com a coluna Produto. Verifique o cabeçalho da planilha.");
      renderPreview();
      const invalid=parsedRows.filter(r=>!r.valid).length;
      setMsg(parsedRows.length+" linha(s) lida(s). "+(invalid?invalid+" com preço ausente ou inválido.":"Preços identificados.")+" Revise os vínculos com o catálogo antes de converter.",invalid?"error":"success");
    }catch(err){parsedRows=[];renderPreview();setMsg("Não foi possível ler a planilha: "+err.message,"error")}
  });
  $("quoteImportSave").addEventListener("click",async()=>{
    if(!["fornecedor","admin"].includes(currentRole))return setMsg("Acesso não autorizado.","error");
    const store=$("quoteImportStore").value.trim();if(!store)return setMsg("Informe o nome do fornecedor / loja.","error");
    if(currentRole==="fornecedor"){const profile=supplierProfiles.find(x=>x.user_id===currentUser?.id);if(!profile?.whatsapp)return setMsg("Cadastre seu WhatsApp em Meu perfil antes de publicar cotações.","error")}
    const selected=parsedRows.map((r,i)=>({...r,productId:$("quoteImportPreview").querySelector('[data-qi-product="'+i+'"]')?.value,include:$("quoteImportPreview").querySelector('[data-qi-include="'+i+'"]')?.checked})).filter(r=>r.include);
    if(!selected.length)return setMsg("Marque ao menos uma linha para converter.","error");
    const bad=selected.find(r=>!r.valid||!r.productId);if(bad)return setMsg("Corrija os preços e selecione um produto do catálogo para todas as linhas marcadas.","error");
    const days=7,expires=new Date(Date.now()+days*86400000).toISOString();
    const payload=selected.map(r=>({product_id:r.productId,store,price:r.price,shipping:r.shipping,url:null,notes:[r.quantity?"Quantidade na planilha: "+r.quantity:"",r.notes].filter(Boolean).join(" | ")||"Importado de planilha",created_by:currentUser.id,expires_at:expires}));
    const btn=$("quoteImportSave");btn.disabled=true;btn.textContent="CONVERTENDO...";
    try{const {error}=await supabaseClient.from("prices").insert(payload);if(error)throw error;setMsg(payload.length+" cotação(ões) criada(s) com validade de 7 dias. A planilha foi convertida com sucesso.","success");parsedRows=[];renderPreview();$("quoteImportFile").value="";$("quoteImportStore").value="";await loadData();}catch(err){setMsg("Falha ao salvar as cotações: "+err.message,"error")}finally{btn.disabled=false;btn.textContent="CONVERTER LINHAS SELECIONADAS EM COTAÇÕES"}
  });
  const oldAllowed=allowedTabs;
  allowedTabs=function(){oldAllowed();$("quoteImportTab")?.classList.toggle("hidden",!["fornecedor","admin"].includes(currentRole));};
  const oldTab=tab;
  tab=function(name){if(name==="quoteImport"&&!["fornecedor","admin"].includes(currentRole))return;oldTab(name);};
})();