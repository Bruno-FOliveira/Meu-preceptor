import { useState, useRef, useEffect } from "react";

const getKey = () => localStorage.getItem("geminiKey") || "";

// Modelos em ordem de preferência — tenta até achar um que funcione
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-preview-04-17",
  "gemini-1.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-pro",
];

let workingModel = localStorage.getItem("geminiModel") || null;

async function tryModel(model, key, body) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGemini({ prompt, systemPrompt, imageBase64, imageType, audioBase64, maxTokens = 3000 }) {
  const key = getKey();
  if (!key) throw new Error("Configure sua chave Gemini em ⚙️ Configurações");
  const parts = [];
  if (imageBase64) parts.push({ inline_data: { mime_type: imageType || "image/jpeg", data: imageBase64 } });
  if (audioBase64) parts.push({ inline_data: { mime_type: "audio/webm", data: audioBase64 } });
  parts.push({ text: prompt });
  const body = {
    contents: [{ role: "user", parts }],
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
  };
  // Se já tem modelo funcionando, usa direto
  if (workingModel) {
    try { return await tryModel(workingModel, key, body); } catch { workingModel = null; localStorage.removeItem("geminiModel"); }
  }
  // Testa modelos em ordem até achar um que funcione
  for (const model of MODELS) {
    try {
      const result = await tryModel(model, key, body);
      workingModel = model;
      localStorage.setItem("geminiModel", model);
      console.log("Usando modelo:", model);
      return result;
    } catch (e) {
      if (e.message.includes("API key") || e.message.includes("quota")) throw e;
      continue; // tenta próximo modelo
    }
  }
  throw new Error("Nenhum modelo Gemini disponível para esta chave. Verifique sua chave em aistudio.google.com");
}

const SYS = `Você é o PRECEPTOR — médico clínico com 30 anos de experiência. Residente de Clínica Médica brasileiro.
REGRAS: evidências científicas com fonte (Autor, Revista, Ano); nível evidência (IA/IB/IIA/IIB/III); posologia COMPLETA (dose, via, diluição, tempo infusão, ajuste renal/hepático, contraindicações, interações); scores automáticos (qSOFA, NEWS2, CURB-65, HEART, Wells); alertas 🚨; português brasileiro.`;

const C = {
  bg:"#060c18",surface:"#0b1628",surface2:"#0f1f38",
  border:"rgba(99,179,237,0.1)",accent:"#63b3ed",accentDim:"rgba(99,179,237,0.12)",
  green:"#68d391",greenDim:"rgba(104,211,145,0.12)",red:"#fc8181",redDim:"rgba(252,129,129,0.12)",
  yellow:"#f6e05e",yellowDim:"rgba(246,224,94,0.12)",gold:"#f6ad55",
  text:"#e8f4fd",textMuted:"#718096",textDim:"#2d3748",
};

const glow = (c=C.accent) => `0 0 20px ${c}22`;

function Sp({size=14}){return <div style={{width:size,height:size,border:`2px solid ${C.accent}33`,borderTop:`2px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block",flexShrink:0}}/>}

function Btn({onClick,disabled,variant="primary",children,style,size="md",full}){
  const v={primary:{background:`linear-gradient(135deg,${C.accent},#4299e1)`,color:"#fff",border:"none"},ghost:{background:C.accentDim,color:C.accent,border:`1px solid ${C.border}`},danger:{background:C.redDim,color:C.red,border:`1px solid ${C.red}33`},success:{background:C.greenDim,color:C.green,border:`1px solid ${C.green}33`},warning:{background:C.yellowDim,color:C.yellow,border:`1px solid ${C.yellow}33`}};
  const s={sm:{padding:"5px 12px",fontSize:12},md:{padding:"9px 20px",fontSize:13},lg:{padding:"13px 28px",fontSize:15}};
  return <button onClick={onClick} disabled={disabled} style={{borderRadius:10,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1,transition:"all 0.2s",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:7,width:full?"100%":undefined,justifyContent:full?"center":undefined,...v[variant],...s[size],...style}}>{children}</button>;
}

function Card({children,style,onClick}){return <div onClick={onClick} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:18,transition:"all 0.2s",cursor:onClick?"pointer":"default",...style}}>{children}</div>}

function Input({value,onChange,onKeyDown,placeholder,type="text",style}){return <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:10,color:C.text,padding:"10px 14px",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box",...style}}/>}

function TA({value,onChange,placeholder,rows=4,style}){return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:10,color:C.text,padding:"10px 14px",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box",resize:"vertical",...style}}/>}

function Badge({color=C.accent,children,style}){return <span style={{background:`${color}1a`,border:`1px solid ${color}33`,borderRadius:6,padding:"2px 8px",fontSize:11,color,fontWeight:700,...style}}>{children}</span>}

function SetupScreen({onDone}){
  const [key,setKey]=useState("");const [testing,setTesting]=useState(false);const [error,setError]=useState("");
  const test=async()=>{
    if(!key.trim()){setError("Cole sua chave Gemini");return;}
    setTesting(true);setError("");
    try{
      workingModel = null;
      localStorage.removeItem("geminiModel");
      localStorage.setItem("geminiKey", key.trim());
      await callGemini({prompt:"Responda só: OK"});
      onDone();
    }catch(e){setError("Chave inválida: "+e.message);localStorage.removeItem("geminiKey");}
    setTesting(false);
  };
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Georgia',serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{width:"100%",maxWidth:420,animation:"fadeIn 0.5s ease"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#4299e1)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 16px",boxShadow:glow()}}>🩺</div>
          <div style={{fontSize:26,fontWeight:900,color:C.text}}>PRECEPTOR MÉDICO</div>
          <div style={{fontSize:12,color:C.accent,letterSpacing:3,marginTop:6}}>CONFIGURAÇÃO INICIAL</div>
        </div>
        <Card>
          <div style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:6}}>🔑 Chave API Gemini</div>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:16,lineHeight:1.7}}>
            1. Acesse <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{color:C.accent}}>aistudio.google.com/app/apikey</a><br/>
            2. Clique em <strong style={{color:C.text}}>"Create API Key"</strong><br/>
            3. Copie e cole aqui
          </div>
          <Input value={key} onChange={e=>setKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&test()} placeholder="AIza..." type="password" style={{marginBottom:12}}/>
          {error&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>⚠️ {error}</div>}
          <Btn onClick={test} disabled={testing||!key.trim()} full size="lg">{testing?<><Sp/>Testando...</>:"✅ Confirmar e Entrar"}</Btn>
        </Card>
        <div style={{textAlign:"center",marginTop:16,fontSize:11,color:C.textMuted}}>Chave salva só no seu navegador.</div>
      </div>
    </div>
  );
}

function ChatModule(){
  const [msgs,setMsgs]=useState(()=>{try{return JSON.parse(localStorage.getItem("chatHistory")||"null")||[{role:"assistant",content:"👋 Olá, Bruno! Sou seu Preceptor Virtual.\n\nComo posso ajudar?\n• 💊 Posologias completas com diluição\n• 🔍 Diagnósticos diferenciais\n• 📋 Análise de prescrições e ECGs\n• 🚨 Alertas de risco e scores clínicos\n\nEnter para enviar • Shift+Enter para nova linha"}]}catch{return [{role:"assistant",content:"Olá! Como posso ajudar?"}]}});
  const [input,setInput]=useState("");const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const [file,setFile]=useState(null);const [preview,setPreview]=useState(null);
  const fileRef=useRef(null);const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[msgs,loading]);
  const handleFile=f=>{if(!f)return;setFile(f);if(f.type.startsWith("image/")){const r=new FileReader();r.onload=e=>setPreview(e.target.result);r.readAsDataURL(f);}};
  const send=async()=>{
    if((!input.trim()&&!file)||loading)return;setError("");
    let ib=null,it=null,ab=null;
    if(file){const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file)});if(file.type.startsWith("image/")){ib=b64;it=file.type;}else if(file.type.startsWith("audio/")){ab=b64;}}
    const um={role:"user",content:input.trim()||`[Arquivo: ${file?.name}]`,preview};
    const nm=[...msgs,um];setMsgs(nm);localStorage.setItem("chatHistory",JSON.stringify(nm.slice(-50)));
    setInput("");setFile(null);setPreview(null);setLoading(true);
    try{
      const hist=nm.slice(-8).map(m=>`${m.role==="user"?"Residente":"Preceptor"}: ${m.content}`).join("\n\n");
      const reply=await callGemini({prompt:hist,systemPrompt:SYS,imageBase64:ib,imageType:it,audioBase64:ab});
      const upd=[...nm,{role:"assistant",content:reply}];setMsgs(upd);localStorage.setItem("chatHistory",JSON.stringify(upd.slice(-50)));
    }catch(e){setError(e.message);}
    setLoading(false);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)"}}>
      <div style={{flex:1,overflowY:"auto",paddingBottom:8}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:14,animation:"fadeIn 0.3s ease"}}>
            {m.role==="assistant"&&<div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#4299e1)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,marginRight:8,flexShrink:0,marginTop:2}}>🩺</div>}
            <div style={{maxWidth:"82%"}}>
              {m.preview&&<img src={m.preview} alt="" style={{maxWidth:180,borderRadius:10,marginBottom:6,display:"block"}}/>}
              <div style={{background:m.role==="user"?"linear-gradient(135deg,#1a3a5c,#0d2d4a)":C.surface,border:`1px solid ${m.role==="user"?C.accent+"33":C.border}`,borderRadius:m.role==="user"?"18px 18px 4px 18px":"4px 18px 18px 18px",padding:"10px 14px",fontSize:13,lineHeight:1.8,color:C.text,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{m.content}</div>
            </div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0 8px 40px"}}><Sp/><span style={{fontSize:12,color:C.accent}}>Preceptor analisando...</span></div>}
        <div ref={endRef}/>
      </div>
      {error&&<div style={{color:C.red,fontSize:12,padding:"6px 10px",background:C.redDim,borderRadius:8,marginBottom:8}}>⚠️ {error}</div>}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
        {preview&&<img src={preview} alt="" style={{height:56,borderRadius:8,marginBottom:8}}/>}
        {file&&!preview&&<div style={{fontSize:11,color:C.accent,marginBottom:8}}>📎 {file.name}</div>}
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <input ref={fileRef} type="file" accept="image/*,audio/*,.pdf" style={{display:"none"}} onChange={e=>handleFile(e.target.files?.[0])}/>
          <button onClick={()=>fileRef.current?.click()} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:10,color:C.accent,padding:"10px 12px",cursor:"pointer",fontSize:16,flexShrink:0}}>📎</button>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Dúvida clínica, posologia, diagnóstico... (Enter para enviar)" rows={2} style={{flex:1,resize:"none",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:10,color:C.text,padding:"10px 14px",fontSize:13,fontFamily:"inherit"}}/>
          <button onClick={send} disabled={loading||(!input.trim()&&!file)} style={{background:`linear-gradient(135deg,${C.accent},#4299e1)`,border:"none",borderRadius:10,color:"#fff",padding:"10px 14px",cursor:"pointer",fontSize:18,flexShrink:0,opacity:loading?0.4:1}}>➤</button>
        </div>
      </div>
    </div>
  );
}

function DailyModule(){
  const [content,setContent]=useState("");const [loading,setLoading]=useState(false);const [mode,setMode]=useState("10");const [error,setError]=useState("");
  const today=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});
  const MODES=[{id:"2",label:"⚡ 2 min",desc:"Flash"},{id:"5",label:"📋 5 min",desc:"Resumo"},{id:"10",label:"🩺 10 min",desc:"Com caso"},{id:"20",label:"📚 20 min",desc:"Completo"}];
  const PROMPTS={"2":"Gere 5 doenças FLASH (150 palavras cada):\n## ⚡ DOENÇA [N]: [NOME]\n**Suspeitar:** 1 frase\n**Diagnóstico:** critério+exame\n**Tratamento:** dose principal\n**Pearl:** 1 dica","5":"Gere 5 doenças resumo (350 palavras cada):\n## 📋 DOENÇA [N]: [NOME]\n### Quadro clínico\n### Diagnóstico\n### Tratamento (posologia completa)\n### Alta vs Internação","10":"Gere 5 doenças com caso clínico:\n## 🩺 DOENÇA [N]: [NOME]\n### Como suspeitar\n### Diagnóstico (critérios, exames, valores)\n### Diferenciais (3)\n### Tratamento COMPLETO (posologia+diluição)\n### Alta vs Internação\n### Perguntas críticas\n### Caso clínico","20":"Gere 5 doenças estudo completo:\n## 📚 DOENÇA [N]: [NOME]\n### Fisiopatologia\n### Quadro clínico (típico e atípico)\n### Diagnóstico (critérios, scores, valores)\n### Diferenciais (5)\n### Tratamento COMPLETO (dose, via, diluição, tempo, ajuste renal, contraindicações, interações)\n### Alta vs Internação (enfermaria/UTI)\n### 10 Perguntas críticas\n### 3 Casos clínicos\n### Referências"};
  const load=async()=>{
    setLoading(true);setContent("");setError("");
    try{const r=await callGemini({prompt:`Hoje é ${today}.\n${PROMPTS[mode]}\n\n5 doenças variadas: cardiovascular, pulmonar, infecciosa, metabólica, neurológica. Base: USP Clínica Médica, Abramed, guidelines internacionais.`,systemPrompt:SYS,maxTokens:mode==="20"?6000:mode==="10"?4000:2000});setContent(r);}
    catch(e){setError(e.message);}
    setLoading(false);
  };
  const fmt=line=>{if(line.startsWith("## "))return{fontWeight:900,color:C.accent,fontSize:15,marginTop:24,marginBottom:6,borderLeft:`3px solid ${C.accent}`,paddingLeft:10};if(line.startsWith("### "))return{fontWeight:700,color:C.yellow,fontSize:13,marginTop:12,marginBottom:4};return{};};
  return(
    <div>
      <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:2}}>📚 Doenças do Dia</div>
      <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>{today}</div>
      <Card style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>Quanto tempo você tem?</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {MODES.map(m=><button key={m.id} onClick={()=>setMode(m.id)} style={{background:mode===m.id?C.accentDim:"transparent",border:`1px solid ${mode===m.id?C.accent:C.border}`,borderRadius:10,color:mode===m.id?C.accent:C.textMuted,padding:"10px 12px",cursor:"pointer",textAlign:"left"}}><div style={{fontSize:13,fontWeight:700}}>{m.label}</div><div style={{fontSize:11,marginTop:2}}>{m.desc}</div></button>)}
        </div>
        <Btn onClick={load} disabled={loading} full>{loading?<><Sp/>Gerando...</>:"🎯 Estudar Agora"}</Btn>
        {error&&<div style={{color:C.red,fontSize:12,marginTop:10}}>⚠️ {error}</div>}
      </Card>
      {content&&<Card style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.9,color:C.text}}>{content.split("\n").map((l,i)=><div key={i} style={fmt(l)}>{l.replace(/^##+ /,"")||"\u00A0"}</div>)}</Card>}
    </div>
  );
}

function DrugModule(){
  const [q,setQ]=useState("");const [result,setResult]=useState("");const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const QUICK=["Norepinefrina","Dobutamina","Vasopressina","Meropeném","Pip-Tazo","Vancomicina","Furosemida EV","Heparina","Alteplase","Midazolam","Propofol","Fentanil","Insulina EV","Amiodarona","Morfina","Dexametasona"];
  const search=async()=>{
    if(!q.trim()||loading)return;setLoading(true);setResult("");setError("");
    try{const r=await callGemini({prompt:`Detalhe COMPLETAMENTE: ${q}\n1.Nome genérico+comercial Brasil\n2.Mecanismo\n3.Indicações\n4.POSOLOGIA COMPLETA (cada indicação)\n5.Apresentações Brasil\n6.DILUIÇÃO: solução, volume, conc.máx, tempo infusão\n7.Reconstituição se necessário\n8.Ajuste renal (TFG<60,<30,<15,diálise)\n9.Ajuste hepático\n10.Contraindicações\n11.Interações (top5)\n12.Efeitos adversos\n13.Monitoramento\n14.Pearls\n15.Nível evidência+referência`,systemPrompt:SYS,maxTokens:3000});setResult(r);}
    catch(e){setError(e.message);}
    setLoading(false);
  };
  const fmt=l=>{if(l.startsWith("## "))return{fontWeight:900,color:C.accent,fontSize:14,marginTop:16,marginBottom:4};if(l.startsWith("### "))return{fontWeight:700,color:C.yellow,fontSize:13,marginTop:10};return{}};
  return(
    <div>
      <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:4}}>💊 Consulta de Medicamento</div>
      <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>Posologia completa com diluição, ajuste renal e evidências</div>
      <div style={{display:"flex",gap:8,marginBottom:12}}><Input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="Nome do medicamento..." style={{flex:1}}/><Btn onClick={search} disabled={loading||!q.trim()}>{loading?<Sp/>:"🔍"}</Btn></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20}}>{QUICK.map(d=><button key={d} onClick={()=>setQ(d)} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:8,color:C.accent,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>{d}</button>)}</div>
      {error&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>⚠️ {error}</div>}
      {result&&<Card style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.8,color:C.text}}>{result.split("\n").map((l,i)=><div key={i} style={fmt(l)}>{l.replace(/^##+ /,"")||"\u00A0"}</div>)}</Card>}
    </div>
  );
}

function UploadModule(){
  const [file,setFile]=useState(null);const [prev,setPrev]=useState(null);const [text,setText]=useState("");const [result,setResult]=useState("");const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const ref=useRef(null);
  const hf=f=>{if(!f)return;setFile(f);if(f.type.startsWith("image/")){const r=new FileReader();r.onload=e=>setPrev(e.target.result);r.readAsDataURL(f);}};
  const analyze=async()=>{
    if((!text.trim()&&!file)||loading)return;setLoading(true);setResult("");setError("");
    let ib=null,it=null;
    if(file?.type.startsWith("image/")){ib=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file)});it=file.type;}
    try{const r=await callGemini({prompt:`Analise esta prescrição/evolução:\n${text}\n\n1.📋 RESUMO\n2.✅ PONTOS POSITIVOS\n3.⚠️ PROBLEMAS E ERROS\n4.💊 MEDICAMENTOS (corrija com posologia completa)\n5.🔍 DIAGNÓSTICOS NÃO CONSIDERADOS\n6.🧠 PERGUNTAS CRÍTICAS\n7.📝 CONDUTA OTIMIZADA\n8.📚 REFERÊNCIA`,systemPrompt:SYS,imageBase64:ib,imageType:it});setResult(r);}
    catch(e){setError(e.message);}
    setLoading(false);
  };
  return(
    <div>
      <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:4}}>📋 Análise de Prescrição</div>
      <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>Foto ou texto — o preceptor revisa e critica a conduta</div>
      <div onClick={()=>ref.current?.click()} style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:20,textAlign:"center",cursor:"pointer",marginBottom:12,background:file?C.accentDim:"transparent"}}>
        <input ref={ref} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>hf(e.target.files?.[0])}/>
        {prev?<img src={prev} alt="" style={{maxHeight:140,borderRadius:8}}/>:<div style={{color:C.textMuted,fontSize:13}}>📎 {file?file.name:"Toque para anexar imagem ou PDF"}</div>}
      </div>
      <TA value={text} onChange={e=>setText(e.target.value)} placeholder="Ou cole/descreva a prescrição, evolução ou situação clínica..." rows={5} style={{marginBottom:12}}/>
      {error&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>⚠️ {error}</div>}
      <Btn onClick={analyze} disabled={loading||(!text.trim()&&!file)} full style={{marginBottom:16}}>{loading?<><Sp/>Analisando...</>:"🔍 Analisar com Preceptor"}</Btn>
      {result&&<Card style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.8,color:C.text}}>{result}</Card>}
    </div>
  );
}

function Settings({onReset}){
  const [key,setKey]=useState(localStorage.getItem("geminiKey")||"");const [saved,setSaved]=useState(false);const [testing,setTesting]=useState(false);const [msg,setMsg]=useState("");
  const save=()=>{localStorage.setItem("geminiKey",key);setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const test=async()=>{
    setTesting(true);setMsg("");
    try{
      workingModel=null;localStorage.removeItem("geminiModel");
      localStorage.setItem("geminiKey",key);
      const r=await callGemini({prompt:"Responda só: OK ✅",maxTokens:20});
      setMsg("✅ Funcionando! Modelo: "+workingModel);
    }catch(e){setMsg("❌ "+e.message);}
    setTesting(false);
  };
  return(
    <div>
      <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:20}}>⚙️ Configurações</div>
      <Card style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},#e67e22)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>👑</div>
          <div><div style={{fontWeight:700,color:C.text}}>Bruno</div><Badge color={C.gold}>Administrador</Badge></div>
        </div>
      </Card>
      <Card style={{marginBottom:12}}>
        <div style={{fontWeight:700,color:C.text,marginBottom:4}}>🔑 Chave API Gemini</div>
        <div style={{fontSize:12,color:C.textMuted,marginBottom:12}}>Obtenha em <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{color:C.accent}}>aistudio.google.com</a></div>
        <Input value={key} onChange={e=>setKey(e.target.value)} placeholder="AIza..." type="password" style={{marginBottom:10}}/>
        <div style={{display:"flex",gap:8}}><Btn onClick={save} variant="success" size="sm">{saved?"✅ Salvo!":"💾 Salvar"}</Btn><Btn onClick={test} disabled={testing||!key} variant="ghost" size="sm">{testing?<Sp size={12}/>:"🧪 Testar"}</Btn></div>
        {msg&&<div style={{fontSize:12,marginTop:10,color:msg.includes("✅")?C.green:C.red}}>{msg}</div>}
      </Card>
      <Card>
        <div style={{fontWeight:700,color:C.red,marginBottom:8}}>⚠️ Limpar dados</div>
        <Btn onClick={()=>{if(window.confirm("Limpar todos os dados?")){{localStorage.clear();onReset();}}}} variant="danger" size="sm">🗑️ Limpar tudo</Btn>
      </Card>
    </div>
  );
}

const TABS=[{id:"chat",icon:"💬",label:"Preceptor"},{id:"daily",icon:"📚",label:"Estudo"},{id:"drug",icon:"💊",label:"Medicamento"},{id:"upload",icon:"📋",label:"Análise"},{id:"settings",icon:"⚙️",label:"Config"}];

export default function App(){
  const [ready,setReady]=useState(!!localStorage.getItem("geminiKey"));
  const [tab,setTab]=useState("chat");
  if(!ready)return <SetupScreen onDone={()=>setReady(true)}/>;
  return(
    <div style={{fontFamily:"'Georgia',serif",background:C.bg,minHeight:"100vh",color:C.text,display:"flex",flexDirection:"column",maxWidth:800,margin:"0 auto"}}>
      <style>{`*{box-sizing:border-box}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.surface2};border-radius:2px}input:focus,textarea:focus{outline:none;border-color:${C.accent}!important}button:active{opacity:.85}a{color:${C.accent}}`}</style>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:100}}>
        <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#4299e1)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>🩺</div>
        <div style={{flex:1}}><div style={{fontWeight:900,fontSize:13,color:C.text,letterSpacing:0.5}}>PRECEPTOR MÉDICO</div><div style={{fontSize:9,color:C.accent,letterSpacing:1.5}}>CLÍNICA MÉDICA • EVIDÊNCIAS</div></div>
        <Badge color={C.gold}>👑 Bruno</Badge>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:16,paddingBottom:80,animation:"fadeIn 0.3s ease"}}>
        {tab==="chat"&&<ChatModule/>}
        {tab==="daily"&&<DailyModule/>}
        {tab==="drug"&&<DrugModule/>}
        {tab==="upload"&&<UploadModule/>}
        {tab==="settings"&&<Settings onReset={()=>setReady(false)}/>}
      </div>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:800,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 4px 8px",background:tab===t.id?C.accentDim:"transparent",border:"none",borderTop:tab===t.id?`2px solid ${C.accent}`:"2px solid transparent",color:tab===t.id?C.accent:C.textMuted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><span style={{fontSize:18}}>{t.icon}</span><span style={{fontSize:9,fontWeight:700}}>{t.label}</span></button>)}
      </div>
    </div>
  );
}
