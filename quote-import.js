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

  // Gera e baixa um modelo Excel profissional diretamente na plataforma.
  $("quoteImportDownloadTemplate")?.addEventListener("click",async()=>{
    const btn=$("quoteImportDownloadTemplate");
    if(!window.ExcelJS){setMsg("Não foi possível carregar o gerador Excel. Atualize a página e tente novamente.","error");return;}
    btn.disabled=true;btn.textContent="PREPARANDO MODELO...";
    try{
      const wb=new ExcelJS.Workbook();
      wb.creator="MFR Market";wb.subject="Modelo oficial para importação de cotações";wb.title="Modelo de Cotações MFR Market";
      const ws=wb.addWorksheet("Cotações",{views:[{state:"frozen",ySplit:6,showGridLines:false}]});
      ws.columns=[{key:"product",width:38},{key:"price",width:20},{key:"shipping",width:16},{key:"quantity",width:19},{key:"notes",width:42}];
      ws.mergeCells("A1:E1");ws.getCell("A1").value="MFR MARKET  |  MODELO OFICIAL DE COTAÇÕES";
      ws.getCell("A1").font={name:"Aptos Display",size:17,bold:true,color:{argb:"FFFFFFFF"}};
      ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF17171C"}};
      ws.getCell("A1").alignment={vertical:"middle"};ws.getRow(1).height=38;
      ws.mergeCells("A2:E2");ws.getCell("A2").value="Preencha uma linha por produto. Os campos com * são obrigatórios.";
      ws.getCell("A2").font={name:"Aptos",size:10,italic:true,color:{argb:"FFD7D7DE"}};
      ws.getCell("A2").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF17171C"}};
      ws.getCell("A2").alignment={vertical:"middle"};ws.getRow(2).height=24;
      ws.mergeCells("A4:E4");ws.getCell("A4").value="DADOS DA COTAÇÃO";
      ws.getCell("A4").font={bold:true,color:{argb:"FFFFFFFF"},size:10};
      ws.getCell("A4").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFB50924"}};
      ws.getCell("A4").alignment={vertical:"middle"};ws.getRow(4).height=23;
      const headers=["Produto *","Preço unitário (R$) *","Frete (R$)","Quantidade","Observações"];
      ws.addRow([]);const hr=ws.getRow(6);
      headers.forEach((v,i)=>{const c=hr.getCell(i+1);c.value=v;c.font={bold:true,color:{argb:"FFFFFFFF"},size:10};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFB50924"}};c.alignment={horizontal:"center",vertical:"middle",wrapText:true};c.border={bottom:{style:"medium",color:{argb:"FF17171C"}}};});
      hr.height=32;
      for(let r=7;r<=36;r++){const row=ws.getRow(r);row.height=24;for(let c=1;c<=5;c++){const cell=row.getCell(c);cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:r%2?"FFFFFFFF":"FFF4F5F7"}};cell.font={name:"Aptos",size:10,color:{argb:"FF17171C"}};cell.alignment={vertical:"middle",wrapText:c===1||c>=4};cell.border={bottom:{style:"hair",color:{argb:"FFD9DCE2"}}};}row.getCell(2).numFmt='"R$" #,##0.00';row.getCell(3).numFmt='"R$" #,##0.00';}
      ws.autoFilter="A6:E36";
      ws.dataValidations.add("B7:B36",{type:"decimal",operator:"greaterThan",formulae:[0],allowBlank:true,showErrorMessage:true,errorTitle:"Preço inválido",error:"Informe um preço maior que zero."});
      ws.dataValidations.add("C7:C36",{type:"decimal",operator:"greaterThanOrEqual",formulae:[0],allowBlank:true,showErrorMessage:true,errorTitle:"Frete inválido",error:"O frete deve ser zero ou maior."});
      ["Use o nome do produto conforme aparece no catálogo do MFR Market.","Obrigatório. Informe somente o valor numérico, por exemplo 125,90.","Opcional. Se não houver frete, informe 0 ou deixe em branco.","Opcional. Exemplo: 20 caixas ou 150 kg.","Opcional. Informe marca, prazo e condições comerciais."].forEach((v,i)=>ws.getCell(6,i+1).note=v);
      ws.mergeCells("A38:E38");ws.getCell("A38").value="IMPORTANTE: não altere os títulos da linha 6. Confira os nomes dos produtos no catálogo antes de importar.";
      ws.getCell("A38").font={bold:true,size:9,color:{argb:"FFB50924"}};ws.getCell("A38").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFFCE8EC"}};ws.getCell("A38").alignment={wrapText:true,vertical:"middle"};ws.getRow(38).height=30;
      const guide=wb.addWorksheet("Leia-me",{views:[{showGridLines:false}]});guide.columns=[{width:5},{width:28},{width:88}];
      guide.mergeCells("B2:C2");guide.getCell("B2").value="COMO PREENCHER E IMPORTAR";guide.getCell("B2").font={size:17,bold:true,color:{argb:"FFFFFFFF"}};guide.getCell("B2").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF17171C"}};guide.getRow(2).height=38;
      guide.mergeCells("B3:C3");guide.getCell("B3").value="MFR MARKET  •  GUIA RÁPIDO DO FORNECEDOR";guide.getCell("B3").font={bold:true,color:{argb:"FFB50924"},size:10};
      const items=[["01  Produto","Digite o nome conforme aparece no catálogo. Se houver diferença, associe o item manualmente na conferência."],["02  Preço unitário","Obrigatório. Informe apenas o número, por exemplo 125,90. Não digite R$. Deve ser maior que zero."],["03  Frete","Opcional. Informe o valor em reais. Se não houver cobrança, deixe em branco ou informe 0."],["04  Quantidade","Opcional. Inclua a unidade quando necessário: 20 caixas, 150 kg ou 5 unidades."],["05  Observações","Opcional. Informe marca, prazo de entrega, validade comercial ou condições de pagamento."]];
      items.forEach((it,i)=>{const r=5+i;guide.getCell(r,2).value=it[0];guide.getCell(r,2).font={bold:true,color:{argb:"FFFFFFFF"}};guide.getCell(r,2).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFB50924"}};guide.getCell(r,3).value=it[1];guide.getCell(r,3).font={size:10,color:{argb:"FF17171C"}};guide.getCell(r,3).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF4F5F7"}};guide.getCell(r,2).alignment=guide.getCell(r,3).alignment={vertical:"middle",wrapText:true};guide.getRow(r).height=46;});
      guide.mergeCells("B12:C12");guide.getCell("B12").value="PASSO A PASSO";guide.getCell("B12").font={bold:true,color:{argb:"FFFFFFFF"}};guide.getCell("B12").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF17171C"}};
      ["1. Preencha uma linha para cada produto na aba Cotações.","2. Não altere os títulos da linha 6.","3. Salve o arquivo no formato Excel (.xlsx).","4. No MFR Market, acesse Importar planilha e selecione o arquivo.","5. Informe o nome da loja, confira os produtos e converta as linhas selecionadas."].forEach((v,i)=>{const r=13+i;guide.mergeCells(r,2,r,3);guide.getCell(r,2).value=v;guide.getCell(r,2).font={size:10,color:{argb:"FF17171C"}};guide.getCell(r,2).fill={type:"pattern",pattern:"solid",fgColor:{argb:i%2?"FFF4F5F7":"FFFFFFFF"}};guide.getCell(r,2).alignment={vertical:"middle"};guide.getRow(r).height=27;});
      guide.mergeCells("B19:C19");guide.getCell("B19").value="As cotações importadas recebem validade padrão de 7 dias. A quantidade será registrada nas observações.";
      guide.getCell("B19").font={italic:true,size:9,color:{argb:"FFB50924"}};guide.getCell("B19").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFFCE8EC"}};guide.getCell("B19").alignment={wrapText:true,vertical:"middle"};guide.getRow(19).height=32;
      const buffer=await wb.xlsx.writeBuffer();const blob=new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
      const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="Modelo_Profissional_Cotacoes_MFR_Market.xlsx";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
      setMsg("Modelo profissional Excel baixado. Preencha a aba Cotações e importe o arquivo aqui.","success");
    }catch(err){setMsg("Não foi possível gerar o modelo Excel: "+err.message,"error");}
    finally{btn.disabled=false;btn.textContent="BAIXAR PLANILHA MODELO (EXCEL PROFISSIONAL)";}
  });

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