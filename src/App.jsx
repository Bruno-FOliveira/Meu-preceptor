import { useState, useRef, useEffect } from "react";
import BibliotecaModule from "./Biblioteca";
import MedicoCientistaModule from "./MedicoCientista";
import ModoVisita from "./ModoVisita";
import PatientChat from "./PatientChat";

const MODELS = ["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.5-flash-preview-04-17","gemini-1.5-flash","gemini-2.0-flash-lite"];
let workingModel = localStorage.getItem("geminiModel") || null;
const getKey = () => {
  // Tenta localStorage primeiro, depois sessionStorage como fallback
  return localStorage.getItem("geminiKey") || sessionStorage.getItem("geminiKey") || "";
};
// Salva chave em ambos para persistir entre browser e PWA
const saveKey = (key) => {
  localStorage.setItem("geminiKey", key);
  sessionStorage.setItem("geminiKey", key);
  // Salva também em cookie para máxima persistência
  document.cookie = `geminiKey=${key};max-age=31536000;path=/;SameSite=Strict`;
};
// Recupera de cookie se localStorage estiver vazio
(() => {
  if (!localStorage.getItem("geminiKey")) {
    const cookie = document.cookie.split(";").find(c => c.trim().startsWith("geminiKey="));
    if (cookie) { const key = cookie.split("=")[1]; if (key) { localStorage.setItem("geminiKey", key); sessionStorage.setItem("geminiKey", key); } }
  }
})();

async function tryModel(model, key, body) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGemini({ prompt, systemPrompt, imageBase64, imageType, audioBase64, maxTokens=3000 }) {
  const key = getKey();
  if (!key) throw new Error("Configure sua chave Gemini em ⚙️ Configurações");
  const parts = [];
  if (imageBase64) parts.push({ inline_data:{ mime_type: imageType||"image/jpeg", data: imageBase64 } });
  if (audioBase64) parts.push({ inline_data:{ mime_type:"audio/webm", data: audioBase64 } });
  parts.push({ text: prompt });
  const body = { contents:[{ role:"user", parts }],
    systemInstruction: systemPrompt ? { parts:[{ text: systemPrompt }] } : undefined,
    generationConfig:{ maxOutputTokens: maxTokens, temperature: 0.3 } };
  if (workingModel) {
    try { return await tryModel(workingModel, key, body); }
    catch { workingModel = null; localStorage.removeItem("geminiModel"); }
  }
  for (const model of MODELS) {
    try { const r = await tryModel(model, key, body); workingModel = model; localStorage.setItem("geminiModel", model); return r; }
    catch(e) { if (e.message.includes("API key")||e.message.includes("quota")) throw e; }
  }
  throw new Error("Nenhum modelo Gemini disponível. Verifique sua chave em aistudio.google.com → Default Gemini Project");
}

const SYS = `Você é o PRECEPTOR — médico clínico com 30 anos de experiência em Clínica Médica e Urgência/Emergência. Preceptor virtual de residente brasileiro.
REGRAS ABSOLUTAS:
1. Evidências científicas com fonte (Autor, Revista, Ano, PMID/DOI) e nível (IA/IB/IIA/IIB/III)
2. Posologia COMPLETA: nome genérico+comercial, dose, via, diluição (solução+volume+tempo infusão), frequência, ajuste renal/hepático, contraindicações, interações
3. Alertas 🚨: sepse oculta, deterioração iminente, diagnóstico sobreposto, erros de prescrição
4. Scores automáticos: qSOFA, NEWS2, CURB-65, HEART, Wells quando aplicável
5. "Puxa orelha" direto ao identificar condutas inadequadas
6. Português brasileiro. Base: USP Clínica Médica, Abramed, guidelines internacionais.`;

const DB = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)||"null"); } catch { return null; } },
  set: (k,v) => localStorage.setItem(k, JSON.stringify(v)),
};

const C = {
  bg:"#060c18",surface:"#0b1628",surface2:"#0f1f38",
  border:"rgba(99,179,237,0.1)",accent:"#63b3ed",accentDim:"rgba(99,179,237,0.12)",
  green:"#68d391",greenDim:"rgba(104,211,145,0.12)",red:"#fc8181",redDim:"rgba(252,129,129,0.12)",
  yellow:"#f6e05e",yellowDim:"rgba(246,224,94,0.12)",purple:"#b794f4",purpleDim:"rgba(183,148,244,0.12)",
  gold:"#f6ad55",goldDim:"rgba(246,173,85,0.12)",text:"#e8f4fd",textMuted:"#718096",textDim:"#2d3748",
};
const glow = (c=C.accent) => `0 0 20px ${c}22`;

function Sp({size=14}){return <div style={{width:size,height:size,border:`2px solid ${C.accent}33`,borderTop:`2px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block",flexShrink:0}}/>}

function Btn({onClick,disabled,variant="primary",children,style,size="md",full}){
  const v={
    primary:{background:`linear-gradient(135deg,${C.accent},#4299e1)`,color:"#fff",border:"none",boxShadow:glow()},
    ghost:{background:C.accentDim,color:C.accent,border:`1px solid ${C.border}`},
    danger:{background:C.redDim,color:C.red,border:`1px solid ${C.red}33`},
    success:{background:C.greenDim,color:C.green,border:`1px solid ${C.green}33`},
    warning:{background:C.yellowDim,color:C.yellow,border:`1px solid ${C.yellow}33`},
    gold:{background:C.goldDim,color:C.gold,border:`1px solid ${C.gold}33`}
  };
  const s={sm:{padding:"5px 12px",fontSize:12},md:{padding:"9px 20px",fontSize:13},lg:{padding:"13px 28px",fontSize:15}};
  return <button onClick={onClick} disabled={disabled} style={{borderRadius:10,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1,transition:"all 0.2s",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:7,width:full?"100%":undefined,justifyContent:full?"center":undefined,...v[variant],...s[size],...style}}>{children}</button>;
}

function Card({children,style,onClick}){return <div onClick={onClick} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:16,transition:"all 0.2s",cursor:onClick?"pointer":"default",...style}}>{children}</div>}
function Input({value,onChange,onKeyDown,placeholder,type="text",style}){return <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:10,color:C.text,padding:"10px 14px",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box",...style}}/>}
function TA({value,onChange,placeholder,rows=4,style}){return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:10,color:C.text,padding:"10px 14px",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box",resize:"vertical",...style}}/>}
function Badge({color=C.accent,children,style}){return <span style={{background:`${color}1a`,border:`1px solid ${color}33`,borderRadius:6,padding:"2px 8px",fontSize:11,color,fontWeight:700,...style}}>{children}</span>}
function Title({icon,title,subtitle}){return <div style={{marginBottom:18}}><div style={{fontSize:18,fontWeight:800,color:C.text,display:"flex",alignItems:"center",gap:8}}><span>{icon}</span>{title}</div>{subtitle&&<div style={{fontSize:12,color:C.textMuted,marginTop:4}}>{subtitle}</div>}</div>}

const STATUS={
  stable:{icon:"🟢",label:"Estável",color:C.green},
  attention:{icon:"🟡",label:"Atenção",color:C.yellow},
  critical:{icon:"🔴",label:"Crítico",color:C.red},
  intercurrence:{icon:"⚡",label:"Intercorrência",color:C.accent},
  resolved:{icon:"✅",label:"Resolvido",color:C.green},
  discharge:{icon:"🏠",label:"Alta possível",color:C.green},
  covering:{icon:"🔄",label:"Cobertura",color:C.textMuted}
};
const GENDER={M:"👨",F:"👩",O:"🧑"};

// ── SETUP ──────────────────────────────────────────────────
function SetupScreen({onDone}){
  const [key,setKey]=useState("");const [testing,setTesting]=useState(false);const [error,setError]=useState("");
  const test=async()=>{
    if(!key.trim()){setError("Cole sua chave Gemini");return;}
    setTesting(true);setError("");
    try{
      workingModel=null;localStorage.removeItem("geminiModel");saveKey(key.trim());
      await callGemini({prompt:"Responda só: OK",maxTokens:10});
      onDone();
    }catch(e){setError(e.message);localStorage.removeItem("geminiKey");}
    setTesting(false);
  };
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Georgia',serif"}}>
      <div style={{width:"100%",maxWidth:420,animation:"fadeIn 0.5s ease"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#4299e1)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 16px",boxShadow:glow()}}>🩺</div>
          <div style={{fontSize:26,fontWeight:900,color:C.text}}>PRECEPTOR MÉDICO</div>
          <div style={{fontSize:12,color:C.accent,letterSpacing:3,marginTop:6}}>RESIDÊNCIA EM CLÍNICA MÉDICA</div>
        </div>
        <Card>
          <div style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:6}}>🔑 Chave API Gemini</div>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:16,lineHeight:1.7}}>
            1. Acesse <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{color:C.accent}}>aistudio.google.com/app/apikey</a><br/>
            2. Clique <strong style={{color:C.text}}>"Create API Key"</strong> → selecione <strong style={{color:C.text}}>"Default Gemini Project"</strong><br/>
            3. Copie e cole aqui
          </div>
          <Input value={key} onChange={e=>setKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&test()} placeholder="AIza..." type="password" style={{marginBottom:12}}/>
          {error&&<div style={{color:C.red,fontSize:12,marginBottom:10,lineHeight:1.5}}>⚠️ {error}</div>}
          <Btn onClick={test} disabled={testing||!key.trim()} full size="lg">{testing?<><Sp/>Testando modelos...</>:"✅ Entrar"}</Btn>
        </Card>
        <div style={{textAlign:"center",marginTop:14,fontSize:11,color:C.textMuted}}>Chave salva só no seu navegador.</div>
      </div>
    </div>
  );
}

// ── PATIENT CARD ────────────────────────────────────────────
function PatientCard({patient,onClick,onDelete,compact}){
  const st=STATUS[patient.status]||STATUS.stable;
  const pending=(patient.pending||[]).length;
  return(
    <Card onClick={onClick} style={{marginBottom:10,cursor:"pointer",borderLeft:`3px solid ${st.color}`}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
        <div style={{fontSize:24,lineHeight:1}}>{GENDER[patient.gender]||"🧑"}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <span style={{fontWeight:700,color:C.text,fontSize:14}}>{patient.name}</span>
            <Badge color={st.color}>{st.icon} {st.label}</Badge>
            {patient.onAntibiotic&&<Badge color={C.yellow}>💊 ATB</Badge>}
            {patient.covering&&<Badge color={C.textMuted}>🔄</Badge>}
          </div>
          <div style={{fontSize:12,color:C.textMuted,marginTop:3}}>{patient.age&&`${patient.age}a`}{patient.bed&&` • Leito ${patient.bed}`}{patient.location&&` • ${patient.location}`}</div>
          {patient.summary&&<div style={{fontSize:12,color:C.textDim,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{patient.summary}</div>}
          {!compact&&pending>0&&<div style={{marginTop:5}}><Badge color={C.yellow}>⏳ {pending} pendência{pending>1?"s":""}</Badge></div>}
        </div>
        {onDelete&&<button onClick={e=>{e.stopPropagation();onDelete();}} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:16,padding:4}}>✕</button>}
      </div>
    </Card>
  );
}

// ── NEW PATIENT FORM ────────────────────────────────────────
function NewPatientForm({onSave,onCancel}){
  const [f,setF]=useState({name:"",age:"",gender:"M",bed:"",location:"",status:"stable",summary:"",comorbidities:"",admissionDate:new Date().toISOString().split("T")[0],onAntibiotic:false,covering:false,pending:[]});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  return(
    <Card style={{marginBottom:14,border:`1px solid ${C.accent}44`}}>
      <div style={{fontWeight:700,color:C.text,marginBottom:12}}>Novo Paciente</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <Input value={f.name} onChange={e=>s("name",e.target.value)} placeholder="Nome"/>
        <Input value={f.age} onChange={e=>s("age",e.target.value)} placeholder="Idade" type="number"/>
        <Input value={f.bed} onChange={e=>s("bed",e.target.value)} placeholder="Leito"/>
        <Input value={f.location} onChange={e=>s("location",e.target.value)} placeholder="Local (UTI, Enf. A...)"/>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
        {["M","F","O"].map(g=><button key={g} onClick={()=>s("gender",g)} style={{background:f.gender===g?C.accentDim:"transparent",border:`1px solid ${f.gender===g?C.accent:C.border}`,borderRadius:8,color:f.gender===g?C.accent:C.textMuted,padding:"5px 12px",cursor:"pointer",fontSize:13}}>{GENDER[g]} {g==="M"?"Masc":g==="F"?"Fem":"Outro"}</button>)}
      </div>
      <select value={f.status} onChange={e=>s("status",e.target.value)} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"8px 12px",fontSize:13,marginBottom:8,width:"100%"}}>
        {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
      </select>
      <TA value={f.summary} onChange={e=>s("summary",e.target.value)} placeholder="Resumo clínico / diagnóstico principal..." rows={2} style={{marginBottom:8}}/>
      <Input value={f.comorbidities||""} onChange={e=>s("comorbidities",e.target.value)} placeholder="Comorbidades (ex: DM2, HAS, IRC, FA crônica...)" style={{marginBottom:8}}/>
      <div style={{display:"flex",gap:12,marginBottom:10}}>
        <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:C.textMuted}}><input type="checkbox" checked={f.onAntibiotic} onChange={e=>s("onAntibiotic",e.target.checked)} style={{accentColor:C.accent}}/> 💊 Em ATB</label>
        <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:C.textMuted}}><input type="checkbox" checked={f.covering} onChange={e=>s("covering",e.target.checked)} style={{accentColor:C.accent}}/> 🔄 Cobertura</label>
      </div>
      <div style={{display:"flex",gap:8}}><Btn onClick={()=>{if(f.name)onSave(f);}} size="sm">Adicionar</Btn><Btn onClick={onCancel} variant="ghost" size="sm">Cancelar</Btn></div>
    </Card>
  );
}

// ── AREAS MODULE ────────────────────────────────────────────
// ── BARRA IA PARA ÁREAS ───────────────────────────────────
function AreaAIBar({areaId, patients, onSavePts, onAddPatient, onUpdatePatient}){
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [status,setStatus]=useState("");
  const ref=useRef(null);

  const process=async()=>{
    if(!input.trim()||loading)return;
    setLoading(true);setStatus("Processando...");
    const areaPts=patients.filter(p=>p.areaId===areaId);
    const list=areaPts.map(p=>`ID:${p.id} | Nome:${p.name} | Leito:${p.bed||"?"} | Status:${p.status}`).join("\n")||"(área vazia)";
    try{
      const key=getKey();const model=localStorage.getItem("geminiModel")||"gemini-2.5-flash";
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contents:[{role:"user",parts:[{text:`Você gerencia pacientes de uma enfermaria/área hospitalar.

PACIENTES DESTA ÁREA:
${list}

COMANDO: "${input}"

Responda APENAS com JSON válido:
{
  "patients_to_create": [{
    "name":"nome","age":"idade ou null","gender":"M|F|O","bed":"leito ou null",
    "status":"stable|attention|critical|intercurrence|discharge|covering",
    "summary":"diagnóstico ou null","comorbidities":"comorbidades ou null",
    "medications":[{"name":"","dose":"","route":"","schedule":"","isAtb":false,"atbDay":""}],
    "pending":[],"vitals":{},"history":"história ou null","admissionDate":"YYYY-MM-DD ou null"
  }],
  "patients_to_update": [{
    "id":"ID","changes":{
      "status":"ou null","summary":"ou null","clinicalImpression":"ou null",
      "pending_add":[],"medications_add":[],"vitals":{},"todayEvolution":"ou null",
      "onAntibiotic":null,"antibioticDetail":"ou null"
    }
  }],
  "patients_to_remove": [],
  "message": "confirmação em 1 frase"
}

EXEMPLOS:
- "criar João 67a leito 12 ICC HAS DM2" → create
- "João PA 130x80 FC 88 Cr 2.1" → update vitals
- "Maria piora crítico, pedir UTI" → update status + pending
- "Pedro alta" → remove ou update discharge
- "Furosemida 40mg EV agora para o João" → update medications_add
- "adicionar pendência eco no João" → update pending_add
Inclua APENAS campos mencionados (null para o resto).`}]}],generationConfig:{maxOutputTokens:2000,temperature:0.1}})
      });
      const d=await res.json();
      if(d.error)throw new Error(d.error.message);
      const text=d.candidates?.[0]?.content?.parts?.[0]?.text||"{}";
      const result=JSON.parse(text.replace(/```json|```/g,"").trim());

      let allPts=[...patients];
      let created=[];

      // Criar
      if(result.patients_to_create?.length){
        result.patients_to_create.forEach(p=>{
          const np={...p,id:Date.now().toString()+Math.random().toString(36).slice(2),areaId,createdAt:new Date().toISOString(),medications:p.medications||[],pending:p.pending||[],labs:{},vitals:p.vitals||{}};
          allPts.push(np);created.push(np);
        });
        created.forEach(np=>{if(onAddPatient)onAddPatient(np);});
      }

      // Atualizar
      if(result.patients_to_update?.length){
        result.patients_to_update.forEach(upd=>{
          const idx=allPts.findIndex(p=>p.id===upd.id);if(idx<0)return;
          const p=allPts[idx];const ch=upd.changes||{};let u={...p};
          if(ch.status)u.status=ch.status;
          if(ch.summary)u.summary=ch.summary;
          if(ch.clinicalImpression)u.clinicalImpression=ch.clinicalImpression;
          if(ch.todayEvolution){const d=new Date().toLocaleDateString("pt-BR");u.todayEvolution=u.todayEvolution?`${u.todayEvolution}\n\n[${d}] ${ch.todayEvolution}`:`[${d}] ${ch.todayEvolution}`;}
          if(ch.vitals&&Object.keys(ch.vitals).length){u.vitals={...(u.vitals||{}),...Object.fromEntries(Object.entries(ch.vitals).filter(([,v])=>v))};u.vitalsDate=new Date().toISOString();}
          if(ch.pending_add?.length)u.pending=[...(u.pending||[]),...ch.pending_add];
          if(ch.medications_add?.length)u.medications=[...(u.medications||[]),...ch.medications_add.map(m=>({...m,id:Date.now().toString()+Math.random()}))];
          if(ch.onAntibiotic!==null&&ch.onAntibiotic!==undefined)u.onAntibiotic=ch.onAntibiotic;
          if(ch.antibioticDetail)u.antibioticDetail=ch.antibioticDetail;
          allPts[idx]=u;
          if(onUpdatePatient)onUpdatePatient(u);
        });
      }

      // Remover
      if(result.patients_to_remove?.length){
        allPts=allPts.filter(p=>!result.patients_to_remove.includes(p.id));
      }

      onSavePts(allPts);
      setStatus("✅ "+(result.message||"Feito!"));
      setInput("");
    }catch(e){setStatus("⚠️ "+e.message);}
    setLoading(false);
    setTimeout(()=>setStatus(""),5000);
  };

  return(
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
        <div style={{flex:1}}>
          <textarea
            ref={ref}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();process();}}}
            placeholder="🤖 Fale com a IA — Enter para enviar&#10;Ex: criar João 67a leito 12, ICC, HAS DM2&#10;Ex: João PA 130x80 FC 88, Furosemida 40mg EV&#10;Ex: Maria piora crítico — pedir UTI" 
            rows={3}
            style={{width:"100%",background:"rgba(99,179,237,0.05)",border:`2px solid ${C.accent}33`,borderRadius:12,color:C.text,padding:"10px 12px",fontSize:12,fontFamily:"inherit",resize:"none",boxSizing:"border-box",lineHeight:1.5}}
          />
        </div>
        <button onClick={process} disabled={loading||!input.trim()} style={{background:loading?"transparent":`linear-gradient(135deg,${C.accent},#4299e1)`,border:`2px solid ${C.accent}`,borderRadius:12,color:loading?C.accent:"#fff",padding:"10px 14px",cursor:"pointer",fontSize:20,flexShrink:0,opacity:!input.trim()?0.4:1,height:74,alignSelf:"flex-end"}}>
          {loading?<div style={{width:18,height:18,border:`2px solid ${C.accent}33`,borderTop:`2px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>:"➤"}
        </button>
      </div>
      {status&&<div style={{fontSize:12,color:status.startsWith("✅")?C.green:status.startsWith("⚠️")?C.red:C.accent,marginTop:5,padding:"4px 10px",background:status.startsWith("✅")?C.greenDim:status.startsWith("⚠️")?C.redDim:C.accentDim,borderRadius:7}}>{status}</div>}
    </div>
  );
}

function AreasModule({uid, firebaseAreas, firebasePatients, onUpdatePatient, onAddPatient, onRemovePatient, onAddArea, onRemoveArea}){
  // Usa dados Firebase se disponíveis, senão localStorage
  const [areas,setAreas]=useState(()=>firebaseAreas||DB.get("areas")||[{id:"enfermaria",name:"Enfermaria",icon:"🏥",color:C.accent,permanent:true,createdAt:new Date().toISOString()}]);
  const [patients,setPatients]=useState(()=>firebasePatients||DB.get("patients")||[]);
  const [selectedArea,setSelectedArea]=useState(null);
  const [selectedPatient,setSelectedPatient]=useState(null);
  const [modoVisita,setModoVisita]=useState(false);
  const [showNewArea,setShowNewArea]=useState(false);
  const [showNewPatient,setShowNewPatient]=useState(false);
  const [newAreaName,setNewAreaName]=useState("");
  const [newAreaIcon,setNewAreaIcon]=useState("🏥");
  const [search,setSearch]=useState("");

  // Atualiza quando Firebase sync chega
  useEffect(()=>{ if(firebaseAreas?.length) setAreas(firebaseAreas); },[firebaseAreas]);
  useEffect(()=>{ if(firebasePatients) setPatients(firebasePatients); },[firebasePatients]);

  const saveAreas=a=>{setAreas(a);DB.set("areas",a);};
  const savePts=p=>{setPatients(p);DB.set("patients",p);};
  const updatePatient=p=>{
    savePts(patients.map(x=>x.id===p.id?p:x));
    if(onUpdatePatient) onUpdatePatient(p);
  };
  const areaPts=id=>patients.filter(p=>p.areaId===id&&(!search||p.name?.toLowerCase().includes(search.toLowerCase())||(p.summary||"").toLowerCase().includes(search.toLowerCase())||(p.bed||"").toLowerCase().includes(search.toLowerCase())));
  const ICONS=["🏥","🚨","⚡","🏨","🔬","💊","🫀","🫁","🧠","🦴","🩺","👁️"];

  if(modoVisita&&selectedArea){
    const area=areas.find(a=>a.id===selectedArea);
    return <ModoVisita patients={areaPts(selectedArea)} area={area} onUpdatePatient={updatePatient} onBack={()=>setModoVisita(false)} onEditPatient={p=>{setSelectedPatient(p);setModoVisita(false);}}/>;
  }

  if(selectedPatient) return <PatientDetail patient={selectedPatient} onBack={()=>setSelectedPatient(null)} onUpdate={p=>{savePts(patients.map(x=>x.id===p.id?p:x));setSelectedPatient(p);}}/>;

  if(selectedArea){
    const area=areas.find(a=>a.id===selectedArea);
    const pts=areaPts(selectedArea);
    return(
      <div style={{animation:"fadeIn 0.3s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <button onClick={()=>setSelectedArea(null)} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:8,color:C.accent,padding:"6px 12px",cursor:"pointer",fontSize:13}}>← Áreas</button>
          <div style={{fontSize:18,fontWeight:800,color:C.text}}>{area?.icon} {area?.name}</div>
          <Badge color={C.textMuted}>{pts.length} pacientes</Badge>
          {pts.length>0&&<button onClick={()=>setModoVisita(true)} style={{background:`linear-gradient(135deg,${C.accent},#4299e1)`,border:"none",borderRadius:10,color:"#fff",padding:"7px 14px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",marginLeft:"auto"}}>🏃 Modo Visita</button>}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar por nome, leito, diagnóstico..." style={{flex:1}}/>
          <Btn onClick={()=>setShowNewPatient(true)} size="sm">+ Paciente</Btn>
        </div>
        {/* BARRA IA para área */}
        <AreaAIBar areaId={selectedArea} patients={patients} onSavePts={p=>{savePts(p);}} onAddPatient={onAddPatient} onUpdatePatient={onUpdatePatient}/>
        {showNewPatient&&<NewPatientForm onSave={p=>{const np={...p,id:Date.now().toString(),areaId:selectedArea,createdAt:new Date().toISOString()};savePts([...patients,np]);if(onAddPatient)onAddPatient(np);setShowNewPatient(false);}} onCancel={()=>setShowNewPatient(false)}/>}
        {pts.length===0?<Card style={{textAlign:"center",color:C.textMuted,padding:40}}>Nenhum paciente.<br/><span style={{fontSize:12}}>Clique em "+ Paciente" para adicionar.</span></Card>
          :pts.map(p=><PatientCard key={p.id} patient={p} onClick={()=>setSelectedPatient(p)} onDelete={()=>{savePts(patients.filter(x=>x.id!==p.id));if(onRemovePatient)onRemovePatient(p.id);}}/>)}
      </div>
    );
  }

  return(
    <div style={{animation:"fadeIn 0.3s ease"}}>
      <Title icon="🗺️" title="Minhas Áreas" subtitle="Gerencie pacientes por contexto — Enfermaria, PS, Resposta Rápida"/>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar paciente em todas as áreas..." style={{flex:1,minWidth:160}}/>
        <Btn onClick={()=>setShowNewArea(true)} size="sm">+ Nova Área</Btn>
      </div>
      {showNewArea&&(
        <Card style={{marginBottom:12,border:`1px solid ${C.accent}44`}}>
          <div style={{fontWeight:700,color:C.text,marginBottom:10}}>Nova Área</div>
          <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
            {ICONS.map(ic=><button key={ic} onClick={()=>setNewAreaIcon(ic)} style={{fontSize:18,background:newAreaIcon===ic?C.accentDim:"transparent",border:`1px solid ${newAreaIcon===ic?C.accent:C.border}`,borderRadius:8,padding:"4px 8px",cursor:"pointer"}}>{ic}</button>)}
          </div>
          <Input value={newAreaName} onChange={e=>setNewAreaName(e.target.value)} placeholder="Nome (ex: Pronto Socorro, Resposta Rápida...)" style={{marginBottom:10}}/>
          <div style={{display:"flex",gap:8}}><Btn onClick={()=>{if(newAreaName.trim()){saveAreas([...areas,{id:Date.now().toString(),name:newAreaName,icon:newAreaIcon,color:C.green,createdAt:new Date().toISOString()}]);setShowNewArea(false);setNewAreaName("");}}} size="sm">Criar</Btn><Btn onClick={()=>setShowNewArea(false)} variant="ghost" size="sm">Cancelar</Btn></div>
        </Card>
      )}
      {search?(
        <div>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:10}}>Resultados para "{search}":</div>
          {patients.filter(p=>p.name?.toLowerCase().includes(search.toLowerCase())||(p.summary||"").toLowerCase().includes(search.toLowerCase())).map(p=><PatientCard key={p.id} patient={p} onClick={()=>setSelectedPatient(p)} compact/>)}
        </div>
      ):(
        <div style={{display:"grid",gap:10}}>
          {areas.map(area=>{
            const count=patients.filter(p=>p.areaId===area.id).length;
            const critical=patients.filter(p=>p.areaId===area.id&&p.status==="critical").length;
            return(
              <Card key={area.id} style={{borderLeft:`3px solid ${area.color||C.accent}`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",flex:1}} onClick={()=>setSelectedArea(area.id)}>
                    <span style={{fontSize:26}}>{area.icon}</span>
                    <div>
                      <div style={{fontWeight:700,color:C.text,fontSize:14}}>{area.name}</div>
                      <div style={{fontSize:12,color:C.textMuted}}>{count} paciente{count!==1?"s":""}
                        {critical>0&&<span style={{color:C.red,marginLeft:8}}>⚠️ {critical} crítico{critical>1?"s":""}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {patients.filter(p=>p.areaId===area.id).length>0&&<button onClick={e=>{e.stopPropagation();setSelectedArea(area.id);setModoVisita(true);}} style={{background:`linear-gradient(135deg,${C.accent},#4299e1)`,border:"none",borderRadius:8,color:"#fff",padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>🏃 Visita</button>}
                    {!area.permanent&&<button onClick={e=>{e.stopPropagation();if(window.confirm("Excluir área?"))saveAreas(areas.filter(a=>a.id!==area.id));}} style={{background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,color:C.red,padding:"3px 8px",cursor:"pointer",fontSize:11}}>Excluir</button>}
                    <span style={{color:C.textMuted,fontSize:18,cursor:"pointer"}} onClick={()=>setSelectedArea(area.id)}>›</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── PATIENT DETAIL ──────────────────────────────────────────
function PatientDetail({patient,onBack,onUpdate}){
  const [tab,setTab]=useState("caso");
  const [form,setForm]=useState(patient);
  const [editMode,setEditMode]=useState(false);
  const [aiAnalysis,setAiAnalysis]=useState("");
  const [analyzing,setAnalyzing]=useState(false);
  const [newPending,setNewPending]=useState("");
  const s=(k,v)=>setForm(f=>({...f,[k]:v}));

  const analyzeAI=async()=>{
    setAnalyzing(true);setAiAnalysis("");
    try{
      const txt=`PACIENTE: ${form.name}, ${form.age}a\nSTATUS: ${STATUS[form.status]?.label}\nRESUMO: ${form.summary||"—"}\nHISTÓRIA: ${form.history||"—"}\nATB: ${form.onAntibiotic?"Sim — "+(form.antibioticDetail||"não especificado"):"Não"}\nEVOLUÇÃO HOJE: ${form.todayEvolution||"—"}\nPENDÊNCIAS: ${(form.pending||[]).join("; ")||"nenhuma"}\nIMPRESSÃO: ${form.clinicalImpression||"—"}`;
      const r=await callGemini({prompt:`Analise este caso como preceptor:\n${txt}\n\n1.🧠 Análise crítica da conduta\n2.🚨 Alertas de risco (qSOFA, NEWS2 se aplicável)\n3.⚠️ Diagnósticos não considerados\n4.💊 Ajustes de prescrição necessários\n5.⏳ Pendências críticas que não podem esperar\n6.📚 Referência aplicável`,systemPrompt:SYS});
      setAiAnalysis(r);
    }catch(e){setAiAnalysis("⚠️ "+e.message);}
    setAnalyzing(false);
  };

  const addPending=()=>{
    if(!newPending.trim())return;
    const p=[...(form.pending||[]),newPending.trim()];
    const u={...form,pending:p};setForm(u);onUpdate(u);setNewPending("");
  };
  const removePending=i=>{
    const p=[...(form.pending||[])];p.splice(i,1);
    const u={...form,pending:p};setForm(u);onUpdate(u);
  };

  const TABS=[{id:"caso",label:"📋 Caso"},{id:"evolucao",label:"📝 Evolução"},{id:"pendencias",label:`⏳${(form.pending||[]).length?` (${form.pending.length})`:""} Pendências`},{id:"passagem",label:"🗣️ Passagem"},{id:"chat",label:"💬 Chat"},{id:"ia",label:"🤖 IA"}];

  return(
    <div style={{animation:"fadeIn 0.3s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:8,color:C.accent,padding:"6px 12px",cursor:"pointer",fontSize:13}}>← Voltar</button>
        <span style={{fontWeight:800,color:C.text,fontSize:15}}>{GENDER[form.gender]||"🧑"} {form.name}</span>
        {form.age&&<span style={{color:C.textMuted,fontSize:13}}>{form.age}a</span>}
        {form.bed&&<span style={{color:C.textMuted,fontSize:13}}>• Leito {form.bed}</span>}
        <Badge color={STATUS[form.status]?.color}>{STATUS[form.status]?.icon} {STATUS[form.status]?.label}</Badge>
        <Btn onClick={()=>{if(editMode)onUpdate(form);setEditMode(!editMode);}} variant={editMode?"success":"ghost"} size="sm">{editMode?"💾 Salvar":"✏️ Editar"}</Btn>
      </div>
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`,marginBottom:14,overflowX:"auto"}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"9px 12px",background:"transparent",border:"none",borderBottom:tab===t.id?`2px solid ${C.accent}`:"2px solid transparent",color:tab===t.id?C.accent:C.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>{t.label}</button>)}
      </div>

      {tab==="caso"&&(
        <div style={{display:"grid",gap:10}}>
          {editMode?(
            <>
              <TA value={form.summary||""} onChange={e=>s("summary",e.target.value)} placeholder="Resumo clínico" rows={2}/>
              <TA value={form.history||""} onChange={e=>s("history",e.target.value)} placeholder="História da doença até internamento..." rows={5}/>
              <Input value={form.admissionDate||""} onChange={e=>s("admissionDate",e.target.value)} type="date"/>
              <TA value={form.hospitalCourse||""} onChange={e=>s("hospitalCourse",e.target.value)} placeholder="Evolução durante internamento: complicações, exames, UTI, diagnósticos..." rows={4}/>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:C.textMuted}}><input type="checkbox" checked={form.onAntibiotic||false} onChange={e=>s("onAntibiotic",e.target.checked)} style={{accentColor:C.accent}}/> 💊 Em antibiótico</label>
              {form.onAntibiotic&&<TA value={form.antibioticDetail||""} onChange={e=>s("antibioticDetail",e.target.value)} placeholder="ATBs em uso/prévios, motivo, qual ATB, dias de uso..." rows={2}/>}
              <select value={form.status||"stable"} onChange={e=>s("status",e.target.value)} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"8px 12px",fontSize:13}}>
                {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </>
          ):(
            <>
              <Card><div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>RESUMO</div><div style={{fontSize:13,color:C.text}}>{form.summary||"—"}</div></Card>
              <Card><div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>HISTÓRIA DA DOENÇA</div><div style={{fontSize:13,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{form.history||"—"}</div></Card>
              {form.admissionDate&&<Card><div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>DATA DO INTERNAMENTO</div><div style={{fontSize:13,color:C.text}}>{new Date(form.admissionDate).toLocaleDateString("pt-BR")}</div></Card>}
              <Card><div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>EVOLUÇÃO DURANTE INTERNAMENTO</div><div style={{fontSize:13,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{form.hospitalCourse||"—"}</div></Card>
              {form.onAntibiotic&&<Card style={{borderLeft:`3px solid ${C.yellow}`}}><div style={{fontSize:11,color:C.yellow,marginBottom:4}}>💊 ANTIBIÓTICOS</div><div style={{fontSize:13,color:C.text,whiteSpace:"pre-wrap"}}>{form.antibioticDetail||"—"}</div></Card>}
            </>
          )}
        </div>
      )}

      {tab==="evolucao"&&(
        <div style={{display:"grid",gap:10}}>
          <Card>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:8}}>EVOLUÇÃO DE HOJE — {new Date().toLocaleDateString("pt-BR")}</div>
            <TA value={form.todayEvolution||""} onChange={e=>{s("todayEvolution",e.target.value);onUpdate({...form,todayEvolution:e.target.value});}} placeholder="Interrogatório sistemático, queixas, exame físico, labs alterados, imagens..." rows={8}/>
          </Card>
          <Card>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:8}}>IMPRESSÃO CLÍNICA</div>
            <TA value={form.clinicalImpression||""} onChange={e=>{s("clinicalImpression",e.target.value);onUpdate({...form,clinicalImpression:e.target.value});}} placeholder="Impressão clínica completa..." rows={4}/>
          </Card>
        </div>
      )}

      {tab==="pendencias"&&(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <Input value={newPending} onChange={e=>setNewPending(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPending()} placeholder="Nova pendência (Enter para adicionar)..." style={{flex:1}}/>
            <Btn onClick={addPending} size="sm">+</Btn>
          </div>
          {(form.pending||[]).length===0?<Card style={{textAlign:"center",color:C.textMuted,padding:30}}>Nenhuma pendência ✅</Card>
            :(form.pending||[]).map((p,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",marginBottom:8}}>
                <span style={{fontSize:13,color:C.yellow}}>⏳</span>
                <span style={{flex:1,fontSize:13,color:C.text}}>{p}</span>
                <button onClick={()=>removePending(i)} style={{background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,padding:"3px 8px",cursor:"pointer",fontSize:11}}>✓ Feito</button>
              </div>
            ))}
        </div>
      )}

      {tab==="passagem"&&<PassagemCaso patient={form}/>}

      {tab==="chat"&&<PatientChat patient={form} onUpdate={p=>{setForm(p);onUpdate(p);}} onClose={()=>setTab("caso")}/>}

      {tab==="ia"&&(
        <div>
          <Btn onClick={analyzeAI} disabled={analyzing} style={{marginBottom:14,width:"100%"}}>{analyzing?<><Sp/>Analisando caso...</>:"🤖 Analisar Caso com Preceptor IA"}</Btn>
          {aiAnalysis&&<Card style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.8,color:C.text}}>{aiAnalysis}</Card>}
        </div>
      )}
    </div>
  );
}

// ── PASSAGEM DE CASO ────────────────────────────────────────
function PassagemCaso({patient}){
  const [view,setView]=useState("menu");
  const [generated,setGenerated]=useState("");
  const [edited,setEdited]=useState("");
  const [editing,setEditing]=useState(false);
  const [loading,setLoading]=useState(false);
  const [freeText,setFreeText]=useState("");
  const [history,setHistory]=useState(()=>{const a=DB.get("passagens")||{};return a[patient.id]||[];});
  const [recording,setRecording]=useState(false);
  const [recTime,setRecTime]=useState(0);
  const [audioURL,setAudioURL]=useState(null);
  const [audioBlob,setAudioBlob]=useState(null);
  const mrRef=useRef(null);const timerRef=useRef(null);

  const saveHistory=content=>{
    const entry={id:Date.now().toString(),date:new Date().toISOString(),content};
    const all=DB.get("passagens")||{};
    all[patient.id]=[entry,...(all[patient.id]||[])].slice(0,20);
    DB.set("passagens",all);setHistory(all[patient.id]);
  };

  const buildPrompt=(extra="")=>`Gere passagem de caso COMPLETA e FORMAL para visita médica:\n\nPACIENTE: ${patient.name}, ${patient.age}a, ${patient.gender==="M"?"masculino":"feminino"}\nLEITO: ${patient.bed||"—"} | LOCAL: ${patient.location||"—"}\nRESUMO: ${patient.summary||"—"}\nHISTÓRIA: ${patient.history||"—"}\nINTERNAMENTO: ${patient.admissionDate||"—"}\nEVOLUÇÃO HOSPITALAR: ${patient.hospitalCourse||"—"}\nATB: ${patient.onAntibiotic?patient.antibioticDetail||"sim":"não"}\nEVOLUÇÃO HOJE: ${patient.todayEvolution||"—"}\nPENDÊNCIAS: ${(patient.pending||[]).join("; ")||"nenhuma"}\nIMPRESSÃO: ${patient.clinicalImpression||"—"}\n${extra?`\nINFO ADICIONAL: ${extra}`:""}\n\n## 👤 IDENTIFICAÇÃO\n## 📖 HISTÓRIA DA DOENÇA ATÉ O INTERNAMENTO\n## 📅 DATA DO INTERNAMENTO\n## 🏥 HISTÓRIA DURANTE O INTERNAMENTO\n## 💊 ANTIBIÓTICOS\n## 📋 EVOLUÇÃO DE HOJE — ${new Date().toLocaleDateString("pt-BR")}\n## ⏳ PENDÊNCIAS\n## 🧠 IMPRESSÃO CLÍNICA COMPLETA`;

  const generate=async(extra="",ab=null)=>{
    setLoading(true);
    try{
      const r=await callGemini({prompt:buildPrompt(extra),systemPrompt:SYS,audioBase64:ab,maxTokens:3000});
      setGenerated(r);setEdited(r);saveHistory(r);setView("result");
    }catch(e){alert("⚠️ "+e.message);}
    setLoading(false);
  };

  const exportPDF=c=>{
    const w=window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Passagem de Caso</title><style>body{font-family:'Times New Roman',serif;font-size:12pt;padding:2cm;line-height:1.6}h2{color:#1a3a5c;border-left:3px solid #1a3a5c;padding-left:8px;font-size:13pt}.content{white-space:pre-wrap}</style></head><body><h1 style="font-size:16pt;color:#1a3a5c;border-bottom:2px solid #1a3a5c;padding-bottom:8px">PASSAGEM DE CASO MÉDICO</h1><p><b>Data:</b> ${new Date().toLocaleDateString("pt-BR")} | <b>Paciente:</b> ${patient.name}, ${patient.age}a${patient.bed?` | Leito ${patient.bed}`:""}</p><div class="content">${c.replace(/## (.*)/g,'<h2>$1</h2>')}</div></body></html>`);
    w.document.close();setTimeout(()=>w.print(),500);
  };

  const startRec=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const chunks=[];
      const mr=new MediaRecorder(stream,{mimeType:"audio/webm"});
      mr.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
      mr.onstop=()=>{const blob=new Blob(chunks,{type:"audio/webm"});setAudioBlob(blob);setAudioURL(URL.createObjectURL(blob));stream.getTracks().forEach(t=>t.stop());};
      mr.start(100);mrRef.current=mr;setRecording(true);setRecTime(0);
      timerRef.current=setInterval(()=>setRecTime(t=>t+1),1000);
    }catch(e){alert("Microfone não disponível: "+e.message);}
  };
  const stopRec=()=>{mrRef.current?.stop();clearInterval(timerRef.current);setRecording(false);};
  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  if(view==="result"){
    const c=editing?edited:generated;
    return(
      <div>
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <button onClick={()=>{setView("menu");setEditing(false);}} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:8,color:C.accent,padding:"6px 12px",cursor:"pointer",fontSize:13}}>← Voltar</button>
          <Btn onClick={()=>setEditing(!editing)} variant={editing?"success":"ghost"} size="sm">{editing?"💾 Salvar":"✏️ Editar"}</Btn>
          <Btn onClick={()=>navigator.clipboard.writeText(c)} variant="ghost" size="sm">📋 Copiar</Btn>
          <Btn onClick={()=>exportPDF(c)} variant="warning" size="sm">📄 PDF</Btn>
        </div>
        {editing?<TA value={edited} onChange={e=>setEdited(e.target.value)} rows={28} style={{marginBottom:10}}/>
          :<Card style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.9,color:C.text}}>
            {c.split("\n").map((l,i)=>{
              if(l.startsWith("## "))return<div key={i} style={{fontWeight:900,color:C.accent,fontSize:14,marginTop:20,marginBottom:6,borderLeft:`3px solid ${C.accent}`,paddingLeft:10}}>{l.replace("## ","")}</div>;
              return<div key={i}>{l||"\u00A0"}</div>;
            })}
          </Card>}
      </div>
    );
  }

  if(view==="history"){
    return(
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <button onClick={()=>setView("menu")} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:8,color:C.accent,padding:"6px 12px",cursor:"pointer",fontSize:13}}>← Voltar</button>
          <div style={{fontWeight:700,color:C.text}}>📂 Histórico de Passagens</div>
        </div>
        {history.length===0?<Card style={{textAlign:"center",color:C.textMuted,padding:30}}>Nenhuma passagem salva ainda.</Card>
          :history.map(h=>(
            <Card key={h.id} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{fontSize:13,color:C.text}}>{new Date(h.date).toLocaleDateString("pt-BR")} às {new Date(h.date).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
                <div style={{display:"flex",gap:6}}>
                  <Btn onClick={()=>{setGenerated(h.content);setEdited(h.content);setView("result");}} variant="ghost" size="sm">Ver</Btn>
                  <Btn onClick={()=>navigator.clipboard.writeText(h.content)} variant="ghost" size="sm">📋</Btn>
                  <Btn onClick={()=>exportPDF(h.content)} variant="warning" size="sm">📄</Btn>
                </div>
              </div>
            </Card>
          ))}
      </div>
    );
  }

  return(
    <div>
      {loading&&<div style={{textAlign:"center",padding:30}}><Sp size={28}/><div style={{marginTop:10,fontSize:13,color:C.accent}}>Gerando passagem de caso...</div></div>}
      {!loading&&(
        <div style={{display:"grid",gap:10}}>
          <Card onClick={()=>generate()} style={{cursor:"pointer",border:`1px solid ${C.accent}33`}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}><div style={{fontSize:26}}>🗂️</div><div><div style={{fontWeight:700,color:C.text}}>Gerar dos dados do prontuário</div><div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Usa tudo que você preencheu nas abas Caso e Evolução</div></div><span style={{marginLeft:"auto",color:C.textDim,fontSize:18}}>›</span></div>
          </Card>
          <Card onClick={()=>setView("audio")} style={{cursor:"pointer",border:`1px solid ${C.green}33`}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}><div style={{fontSize:26}}>🎙️</div><div><div style={{fontWeight:700,color:C.text}}>Gravar em áudio</div><div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Fale o caso andando — o app transcreve e estrutura</div></div><span style={{marginLeft:"auto",color:C.textDim,fontSize:18}}>›</span></div>
          </Card>
          <Card onClick={()=>setView("text")} style={{cursor:"pointer",border:`1px solid ${C.yellow}33`}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}><div style={{fontSize:26}}>✏️</div><div><div style={{fontWeight:700,color:C.text}}>Digitar livremente</div><div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Descreva com suas palavras — o app formata</div></div><span style={{marginLeft:"auto",color:C.textDim,fontSize:18}}>›</span></div>
          </Card>
          {history.length>0&&<Card onClick={()=>setView("history")} style={{cursor:"pointer",border:`1px solid ${C.textDim}33`}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}><div style={{fontSize:26}}>📂</div><div><div style={{fontWeight:700,color:C.text}}>Histórico</div><div style={{fontSize:12,color:C.textMuted,marginTop:2}}>{history.length} passagem{history.length>1?"s":""} salva{history.length>1?"s":""}</div></div><span style={{marginLeft:"auto",color:C.textDim,fontSize:18}}>›</span></div>
          </Card>}
        </div>
      )}
      {view==="text"&&!loading&&(
        <div style={{marginTop:12}}>
          <TA value={freeText} onChange={e=>setFreeText(e.target.value)} placeholder="Descreva o caso com suas palavras..." rows={7} style={{marginBottom:10}}/>
          <div style={{display:"flex",gap:8}}><Btn onClick={()=>generate(freeText)} disabled={!freeText.trim()||loading} full>Gerar Passagem</Btn><Btn onClick={()=>setView("menu")} variant="ghost" size="sm">Cancelar</Btn></div>
        </div>
      )}
      {view==="audio"&&!loading&&(
        <div style={{marginTop:12}}>
          <Card style={{textAlign:"center",marginBottom:12}}>
            {!audioURL?(
              <>
                {recording&&<div style={{fontSize:22,fontWeight:800,color:C.red,marginBottom:8}}>🔴 {fmt(recTime)}</div>}
                {!recording?<Btn onClick={startRec} full size="lg">🎙️ Iniciar Gravação</Btn>:<Btn onClick={stopRec} variant="danger" full>⏹️ Parar — {fmt(recTime)}</Btn>}
              </>
            ):(
              <>
                <audio controls src={audioURL} style={{width:"100%",marginBottom:10}}/>
                <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                  <Btn onClick={()=>{setAudioBlob(null);setAudioURL(null);setRecTime(0);}} variant="ghost" size="sm">🔄 Regravar</Btn>
                  <Btn onClick={async()=>{if(!audioBlob)return;const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(audioBlob)});generate("",b64);}} disabled={loading} full>🗣️ Gerar Passagem</Btn>
                </div>
              </>
            )}
          </Card>
          <Btn onClick={()=>setView("menu")} variant="ghost" size="sm">← Voltar</Btn>
        </div>
      )}
    </div>
  );
}

// ── PRESCRIPTIONS ───────────────────────────────────────────
function PrescriptionsModule(){
  const [prescriptions,setPrescriptions]=useState(()=>DB.get("prescriptions")||[]);
  const [lists,setLists]=useState(()=>DB.get("prescLists")||[{id:"all",name:"Todas",icon:"📋"}]);
  const [selectedList,setSelectedList]=useState("all");
  const [checked,setChecked]=useState([]);
  const [showAdd,setShowAdd]=useState(false);
  const [showNewList,setShowNewList]=useState(false);
  const [newListName,setNewListName]=useState("");
  const [search,setSearch]=useState("");
  const [aiResult,setAiResult]=useState({});
  const [analyzing,setAnalyzing]=useState({});
  const [form,setForm]=useState({drug:"",dose:"",route:"",frequency:"",dilution:"",context:"",notes:"",listId:"all"});

  const save=p=>{setPrescriptions(p);DB.set("prescriptions",p);};
  const saveLists=l=>{setLists(l);DB.set("prescLists",l);};
  const filtered=prescriptions.filter(p=>(selectedList==="all"||p.listId===selectedList)&&(!search||p.drug?.toLowerCase().includes(search.toLowerCase())||(p.context||"").toLowerCase().includes(search.toLowerCase())));

  const analyze=async p=>{
    setAnalyzing(x=>({...x,[p.id]:true}));
    try{const r=await callGemini({prompt:`Analise esta prescrição:\nMedicamento: ${p.drug}\nDose: ${p.dose}\nVia: ${p.route}\nFrequência: ${p.frequency}\nDiluição: ${p.dilution}\nContexto: ${p.context}\n\nVerifique dose, diluição, frequência. Corrija se necessário com posologia completa. Alerte sobre contraindicações e interações relevantes.`,systemPrompt:SYS});setAiResult(x=>({...x,[p.id]:r}));}
    catch(e){setAiResult(x=>({...x,[p.id]:"⚠️ "+e.message}));}
    setAnalyzing(x=>({...x,[p.id]:false}));
  };

  const exportRec=()=>{
    const sel=prescriptions.filter(p=>checked.includes(p.id));if(!sel.length)return;
    const txt=`RECEITUÁRIO MÉDICO\nData: ${new Date().toLocaleDateString("pt-BR")}\n\n${sel.map((p,i)=>`${i+1}. ${p.drug}\n   Dose: ${p.dose||"—"} | Via: ${p.route||"—"} | Freq: ${p.frequency||"—"}\n   ${p.dilution?"Diluição: "+p.dilution:""}`).join("\n\n")}`;
    navigator.clipboard.writeText(txt);alert("✅ Receituário copiado para área de transferência!");
  };

  return(
    <div>
      <Title icon="💉" title="Biblioteca de Prescrições" subtitle="Suas prescrições organizadas com validação IA"/>
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar medicamento, contexto..." style={{flex:1,minWidth:130}}/>
        <Btn onClick={()=>setShowAdd(true)} size="sm">+ Prescrição</Btn>
        <Btn onClick={()=>setShowNewList(true)} variant="ghost" size="sm">+ Lista</Btn>
        {checked.length>0&&<Btn onClick={exportRec} variant="success" size="sm">📄 Receituário ({checked.length})</Btn>}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:4}}>
        {lists.map(l=><button key={l.id} onClick={()=>setSelectedList(l.id)} style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${selectedList===l.id?C.accent:C.border}`,background:selectedList===l.id?C.accentDim:"transparent",color:selectedList===l.id?C.accent:C.textMuted,cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>{l.icon||"📋"} {l.name}</button>)}
      </div>
      {showNewList&&(
        <Card style={{marginBottom:10,border:`1px solid ${C.accent}44`}}>
          <Input value={newListName} onChange={e=>setNewListName(e.target.value)} placeholder="Nome da lista (ex: Vasopressores, Sepse...)" style={{marginBottom:8}}/>
          <div style={{display:"flex",gap:8}}><Btn size="sm" onClick={()=>{if(newListName.trim()){saveLists([...lists,{id:Date.now().toString(),name:newListName.trim(),icon:"📁"}]);setNewListName("");setShowNewList(false);}}}>Criar</Btn><Btn size="sm" variant="ghost" onClick={()=>setShowNewList(false)}>Cancelar</Btn></div>
        </Card>
      )}
      {showAdd&&(
        <Card style={{marginBottom:12,border:`1px solid ${C.accent}44`}}>
          <div style={{fontWeight:700,color:C.text,marginBottom:10}}>Nova Prescrição</div>
          <div style={{display:"grid",gap:8}}>
            <Input value={form.drug} onChange={e=>setForm(f=>({...f,drug:e.target.value}))} placeholder="Medicamento (genérico + comercial)"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Input value={form.dose} onChange={e=>setForm(f=>({...f,dose:e.target.value}))} placeholder="Dose (ex: 500mg)"/>
              <Input value={form.route} onChange={e=>setForm(f=>({...f,route:e.target.value}))} placeholder="Via (EV, VO, IM...)"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Input value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))} placeholder="Frequência (8/8h...)"/>
              <Input value={form.dilution} onChange={e=>setForm(f=>({...f,dilution:e.target.value}))} placeholder="Diluição (SF 100mL...)"/>
            </div>
            <Input value={form.context} onChange={e=>setForm(f=>({...f,context:e.target.value}))} placeholder="Contexto clínico (ex: Sepse, TEP, HAS...)"/>
            <TA value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Observações, contraindicações..." rows={2}/>
            <select value={form.listId} onChange={e=>setForm(f=>({...f,listId:e.target.value}))} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"8px 12px",fontSize:13}}>
              {lists.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <div style={{display:"flex",gap:8}}><Btn onClick={()=>{if(form.drug.trim()){save([...prescriptions,{...form,id:Date.now().toString(),createdAt:new Date().toISOString()}]);setShowAdd(false);setForm({drug:"",dose:"",route:"",frequency:"",dilution:"",context:"",notes:"",listId:"all"});}}} size="sm">Salvar</Btn><Btn onClick={()=>setShowAdd(false)} variant="ghost" size="sm">Cancelar</Btn></div>
          </div>
        </Card>
      )}
      {filtered.length===0?<Card style={{textAlign:"center",color:C.textMuted,padding:40}}>Nenhuma prescrição encontrada.</Card>
        :filtered.map(p=>(
          <Card key={p.id} style={{marginBottom:10}}>
            <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <input type="checkbox" checked={checked.includes(p.id)} onChange={()=>setChecked(x=>x.includes(p.id)?x.filter(i=>i!==p.id):[...x,p.id])} style={{marginTop:4,accentColor:C.accent,width:16,height:16,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:C.text,fontSize:14}}>💊 {p.drug}</div>
                <div style={{fontSize:12,color:C.textMuted,marginTop:3}}>{[p.dose,p.route,p.frequency].filter(Boolean).join(" • ")}</div>
                {p.dilution&&<div style={{fontSize:12,color:C.accent,marginTop:2}}>🧪 {p.dilution}</div>}
                {p.context&&<Badge color={C.textMuted} style={{marginTop:5}}>{p.context}</Badge>}
                {p.notes&&<div style={{fontSize:11,color:C.textDim,marginTop:4}}>{p.notes}</div>}
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  <Btn onClick={()=>analyze(p)} disabled={analyzing[p.id]} variant="ghost" size="sm">{analyzing[p.id]?<Sp size={11}/>:"🤖 Validar IA"}</Btn>
                  <Btn onClick={()=>save(prescriptions.filter(x=>x.id!==p.id))} variant="danger" size="sm">🗑️</Btn>
                </div>
                {aiResult[p.id]&&<Card style={{marginTop:8,background:C.surface2,fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{aiResult[p.id]}</Card>}
              </div>
            </div>
          </Card>
        ))}
    </div>
  );
}

// ── REPORTS ─────────────────────────────────────────────────
function ReportsModule(){
  const TEMPLATES=[
    {id:"exam",icon:"🔬",name:"Solicitação de Exame/Laudo"},
    {id:"inter",icon:"⚡",name:"Evolução de Intercorrência"},
    {id:"transfer",icon:"🚑",name:"Nota de Transferência"},
    {id:"discharge",icon:"🏠",name:"Resumo de Alta"},
    {id:"referral",icon:"📨",name:"Solicitação de Parecer"},
    {id:"memo",icon:"📄",name:"Memorando/Comunicado"},
  ];
  const PROMPTS={exam:"Gere solicitação médica formal para:",inter:"Gere nota de evolução de intercorrência em SOAP:",transfer:"Gere nota de transferência médica completa:",discharge:"Gere resumo de alta hospitalar completo:",referral:"Gere solicitação de parecer especializado formal:",memo:"Gere memorando médico formal:"};
  const [sel,setSel]=useState(null);const [input,setInput]=useState("");const [result,setResult]=useState("");const [loading,setLoading]=useState(false);

  const generate=async()=>{
    if(!input.trim()||!sel||loading)return;setLoading(true);setResult("");
    try{const r=await callGemini({prompt:`${PROMPTS[sel]}\n\n${input}\n\nDocumento completo, formal, português brasileiro. Data: ${new Date().toLocaleDateString("pt-BR")}.`,systemPrompt:SYS});setResult(r);}
    catch(e){setResult("⚠️ "+e.message);}
    setLoading(false);
  };

  return(
    <div>
      <Title icon="📄" title="Relatórios Rápidos" subtitle="Gere documentos médicos em segundos"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {TEMPLATES.map(t=><Card key={t.id} onClick={()=>{setSel(t.id);setResult("");}} style={{cursor:"pointer",border:`1px solid ${sel===t.id?C.accent:C.border}`,background:sel===t.id?C.accentDim:C.surface,padding:12}}>
          <div style={{fontSize:20,marginBottom:4}}>{t.icon}</div>
          <div style={{fontSize:12,fontWeight:600,color:C.text}}>{t.name}</div>
        </Card>)}
      </div>
      {sel&&(
        <>
          <TA value={input} onChange={e=>setInput(e.target.value)} placeholder="Descreva os dados: paciente, diagnóstico, exame, justificativa clínica..." rows={5} style={{marginBottom:10}}/>
          <Btn onClick={generate} disabled={loading||!input.trim()} full style={{marginBottom:12}}>{loading?<><Sp/>Gerando...</>:"📝 Gerar Documento"}</Btn>
        </>
      )}
      {result&&(
        <>
          <div style={{display:"flex",gap:8,marginBottom:8}}><Btn onClick={()=>navigator.clipboard.writeText(result)} variant="ghost" size="sm">📋 Copiar</Btn></div>
          <Card style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.8,color:C.text}}>{result}</Card>
        </>
      )}
    </div>
  );
}

// ── CHAT ────────────────────────────────────────────────────
function ChatModule({allPatients=[], onUpdatePatient}){
  const [msgs,setMsgs]=useState(()=>{try{return JSON.parse(localStorage.getItem("chatHistory")||"null")||[{role:"assistant",content:"👋 Olá, Bruno! Sou seu Preceptor.\n\nPosso ajudar com:\n• 💊 Posologias e condutas clínicas\n• 🔍 Diagnósticos diferenciais\n• 📋 Análise de prescrições e exames\n• ✏️ Editar qualquer paciente — só descreva\n• 📸 Envie foto de ECG, RX, exame, prescrição\n• 📋 Cole texto do prontuário — extraio os dados\n\nExemplos:\n→ \"Juliano PA 130x80 FC 88 Cr 2.1\"\n→ \"Adicionar pendência: aguardar eco no João\"\n→ \"Altiplase para Maria, mudar status para crítico\"\n\nEnter para enviar • Shift+Enter nova linha"}]}catch{return [{role:"assistant",content:"Olá! Como posso ajudar?"}]}});
  const [input,setInput]=useState("");const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const [files,setFiles]=useState([]);const [previews,setPreviews]=useState([]);
  const [pendingAction,setPendingAction]=useState(null);
  const fileRef=useRef(null);const cameraRef=useRef(null);const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[msgs,loading]);

  const saveHistory=(m)=>{setMsgs(m);localStorage.setItem("chatHistory",JSON.stringify(m.slice(-50)));};
  const handleFiles=(newFiles)=>{
    if(!newFiles?.length)return;
    const imgs=Array.from(newFiles).filter(f=>f.type.startsWith("image/")||f.type.startsWith("audio/")||f.type==="application/pdf");
    if(!imgs.length)return;
    setFiles(prev=>{const names=prev.map(f=>f.name);return[...prev,...imgs.filter(f=>!names.includes(f.name))];});
    imgs.forEach(f=>{if(f.type.startsWith("image/")){const r=new FileReader();r.onload=e=>setPreviews(prev=>[...prev,e.target.result]);r.readAsDataURL(f);}else setPreviews(prev=>[...prev,null]);});
  };

  // Sistema de prompt para edição de pacientes
  const buildSystemPrompt=()=>{
    const ptList=allPatients.map(p=>`ID:${p.id} | Nome:${p.name} | Leito:${p.bed||"?"} | Status:${p.status}`).join("\n");
    return `${SYS}

PACIENTES CADASTRADOS (${allPatients.length} total):
${ptList||"Nenhum paciente cadastrado"}

CAPACIDADE ESPECIAL — EDIÇÃO DE PACIENTES:
Quando o usuário mencionar dados clínicos de um paciente (vitais, labs, medicamentos, evolução, pendências, status), você deve:
1. Identificar qual paciente pelo nome ou leito
2. Extrair os dados mencionados
3. Responder normalmente E incluir ao final um bloco JSON especial:

Se identificar dados para atualizar, adicione no final da resposta:
<<<PATIENT_UPDATE>>>
{
  "patientId": "ID_DO_PACIENTE",
  "patientName": "NOME",
  "changes": {
    "vitals": {"pas":"valor","pad":"valor","fc":"valor","fr":"valor","spo2":"valor","temp":"valor","diurese":"valor"},
    "labs": {"cr":"valor","k":"valor","na":"valor","hb":"valor","leuco":"valor","plaq":"valor","glicemia":"valor","pcr":"valor","lactato":"valor","tni":"valor"},
    "todayEvolution": "texto da evolução se mencionado",
    "clinicalImpression": "impressão clínica se mencionada",
    "status": "stable|attention|critical|intercurrence|discharge se mencionado",
    "pending_add": ["nova pendência 1", "nova pendência 2"],
    "pending_remove": ["pendência a remover"],
    "medications_add": [{"name":"nome","dose":"dose","route":"via","schedule":"horário","isAtb":false,"atbDay":""}],
    "onAntibiotic": true
  },
  "summary": "Resumo em 1 linha do que foi atualizado"
}
<<<END_UPDATE>>>

REGRAS:
- Inclua APENAS os campos que foram EXPLICITAMENTE mencionados (null para os outros)
- Se não tiver certeza de qual paciente, pergunte
- Se não houver dados para atualizar, não inclua o bloco JSON
- Responda em português brasileiro`;
  };

  const applyPatientUpdate=(update)=>{
    if(!update?.patientId||!update?.changes) return false;
    const patient=allPatients.find(p=>p.id===update.patientId);
    if(!patient) return false;

    let updated={...patient};
    const ch=update.changes;

    // Vitais
    if(ch.vitals){
      const newV={...(updated.vitals||{})};
      Object.entries(ch.vitals).forEach(([k,v])=>{if(v!==null&&v!==undefined&&v!=="")newV[k]=v;});
      if(Object.keys(newV).length){updated.vitals=newV;updated.vitalsDate=new Date().toISOString();}
    }
    // Labs
    if(ch.labs){
      const newL={...(updated.labs||{})};
      Object.entries(ch.labs).forEach(([k,v])=>{if(v!==null&&v!==undefined&&v!=="")newL[k]=v;});
      if(Object.keys(newL).length){updated.labs=newL;updated.labsDate=new Date().toISOString();}
    }
    // Evolução
    if(ch.todayEvolution){
      const d=new Date().toLocaleDateString("pt-BR");
      updated.todayEvolution=updated.todayEvolution?`${updated.todayEvolution}\n\n[${d}] ${ch.todayEvolution}`:`[${d}] ${ch.todayEvolution}`;
    }
    // Impressão
    if(ch.clinicalImpression) updated.clinicalImpression=ch.clinicalImpression;
    // Status
    if(ch.status) updated.status=ch.status;
    // Pendências
    if(ch.pending_add?.length) updated.pending=[...(updated.pending||[]),...ch.pending_add];
    if(ch.pending_remove?.length) updated.pending=(updated.pending||[]).filter(p=>!ch.pending_remove.includes(p));
    // Meds
    if(ch.medications_add?.length){
      const existingNames=(updated.medications||[]).map(m=>m.name?.toLowerCase());
      const newMeds=ch.medications_add.filter(m=>m.name&&!existingNames.includes(m.name.toLowerCase())).map(m=>({...m,id:Date.now().toString()+Math.random()}));
      if(newMeds.length) updated.medications=[...(updated.medications||[]),...newMeds];
    }
    if(ch.onAntibiotic!==undefined) updated.onAntibiotic=ch.onAntibiotic;

    if(onUpdatePatient) onUpdatePatient(updated);
    // Também atualiza localStorage
    const pts=JSON.parse(localStorage.getItem("fb_patients")||"[]");
    const idx=pts.findIndex(p=>p.id===updated.id);
    if(idx>=0){pts[idx]=updated;localStorage.setItem("fb_patients",JSON.stringify(pts));}

    return true;
  };

  const send=async()=>{
    if((!input.trim()&&files.length===0)||loading)return;setError("");
    // Prepara preview para a mensagem
    const msgPreviews=previews.filter(Boolean).slice(0,3);
    const um={role:"user",content:input.trim()||(files.length>0?`[${files.length} imagem${files.length>1?"ns":""}]`:""),previews:msgPreviews};
    const nm=[...msgs,um];saveHistory(nm);
    setInput("");const sentFiles=[...files];const sentPreviews=[...previews];setFiles([]);setPreviews([]);setLoading(true);
    try{
      // Processa todas as imagens e monta prompt
      let combinedPrompt=nm.slice(-8).map(m=>`${m.role==="user"?"Residente":"Preceptor"}: ${m.content}`).join("\n\n");
      let ib=null,it=null;
      // Usa primeira imagem no Gemini (limitação da API: 1 imagem por call)
      // Para múltiplas, faz chamadas sequenciais e combina
      if(sentFiles.length>0&&sentFiles[0].type.startsWith("image/")){
        ib=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(sentFiles[0])});
        it=sentFiles[0].type;
      }
      let extraContext="";
      // Processa imagens extras sequencialmente
      for(let i=1;i<sentFiles.length;i++){
        if(!sentFiles[i].type.startsWith("image/"))continue;
        try{
          const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(sentFiles[i])});
          const extra=await callGemini({prompt:`Extraia todos os dados médicos desta imagem ${i+1} (prescrição, lab, exame, vitais). Retorne apenas os dados encontrados.`,imageBase64:b64,imageType:sentFiles[i].type,maxTokens:1000});
          extraContext+=`

[Imagem ${i+1}]: ${extra}`;
        }catch{}
      }
      const finalPrompt=extraContext?`${combinedPrompt}\n\nDados extraídos de imagens adicionais:${extraContext}`:combinedPrompt;
      const r=await callGemini({prompt:finalPrompt,systemPrompt:buildSystemPrompt(),imageBase64:ib,imageType:it});

      // Verifica se há ação de edição no response
      const updateMatch=r.match(/<<<PATIENT_UPDATE>>>([\s\S]*?)<<<END_UPDATE>>>/);
      let displayText=r.replace(/<<<PATIENT_UPDATE>>>[\s\S]*?<<<END_UPDATE>>>/g,"").trim();
      let actionCard=null;

      if(updateMatch){
        try{
          const updateData=JSON.parse(updateMatch[1].trim());
          const pt=allPatients.find(p=>p.id===updateData.patientId);
          if(pt){
            actionCard={...updateData,patientName:pt.name};
            setPendingAction(actionCard);
          }
        }catch(e){console.warn("Update parse failed:",e);}
      }

      const am={role:"assistant",content:displayText,action:actionCard};
      const upd=[...nm,am];saveHistory(upd);
    }catch(e){setError(e.message);}
    setLoading(false);
  };

  const confirmAction=()=>{
    if(!pendingAction) return;
    const ok=applyPatientUpdate(pendingAction);
    const confirmMsg={role:"system_confirm",content:ok?`✅ Prontuário de ${pendingAction.patientName} atualizado: ${pendingAction.summary||"dados aplicados"}`:"⚠️ Não foi possível atualizar — paciente não encontrado"};
    saveHistory([...msgs,confirmMsg]);
    setPendingAction(null);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 128px)"}}>
      <div style={{flex:1,overflowY:"auto",paddingBottom:8}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{animation:"fadeIn 0.3s ease",marginBottom:12}}>
            {m.role==="system_confirm"?(
              <div style={{background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:10,padding:"8px 12px",fontSize:12,color:C.green}}>{m.content}</div>
            ):(
              <div style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:8}}>
                {m.role==="assistant"&&<div style={{width:30,height:30,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#4299e1)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,marginRight:8,flexShrink:0,marginTop:2}}>🩺</div>}
                <div style={{maxWidth:"82%"}}>
                  {m.previews?.map((p,pi)=>p&&<img key={pi} src={p} alt="" style={{maxWidth:160,borderRadius:8,marginBottom:4,display:"block"}}/>)}
                  <div style={{background:m.role==="user"?"linear-gradient(135deg,#1a3a5c,#0d2d4a)":C.surface,border:`1px solid ${m.role==="user"?C.accent+"33":C.border}`,borderRadius:m.role==="user"?"18px 18px 4px 18px":"4px 18px 18px 18px",padding:"10px 14px",fontSize:13,lineHeight:1.8,color:C.text,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{m.content}</div>
                </div>
              </div>
            )}
          </div>
        ))}
        {loading&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0 8px 38px"}}><Sp/><span style={{fontSize:12,color:C.accent}}>Preceptor analisando...</span></div>}
        <div ref={endRef}/>
      </div>

      {/* Card de confirmação de edição */}
      {pendingAction&&(
        <div style={{margin:"0 0 10px",background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:14,padding:14}}>
          <div style={{fontSize:12,color:C.accent,fontWeight:700,marginBottom:6}}>✏️ Atualizar prontuário de {pendingAction.patientName}?</div>
          <div style={{fontSize:12,color:C.text,marginBottom:10,lineHeight:1.6}}>{pendingAction.summary}</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={confirmAction} style={{flex:1,background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:8,color:C.green,padding:"8px",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit"}}>✅ Aplicar</button>
            <button onClick={()=>setPendingAction(null)} style={{background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:8,color:C.red,padding:"8px 12px",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>✕</button>
          </div>
        </div>
      )}

      {error&&<div style={{color:C.red,fontSize:12,padding:"6px 10px",background:C.redDim,borderRadius:8,marginBottom:8}}>⚠️ {error}</div>}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
        {/* Preview de múltiplas fotos */}
        {previews.length>0&&(
          <div style={{marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:11,color:C.textMuted,fontWeight:700}}>📸 {previews.length} imagem{previews.length>1?"ns":""} anexada{previews.length>1?"s":""}</span>
              <button onClick={()=>{setFiles([]);setPreviews([]);}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:11,fontWeight:700}}>Limpar</button>
            </div>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
              {previews.map((p,i)=>(
                <div key={i} style={{position:"relative",flexShrink:0}}>
                  {p?<img src={p} alt="" style={{height:64,width:64,borderRadius:8,objectFit:"cover",border:`2px solid ${C.accent}33`}}/>
                    :<div style={{height:64,width:64,background:C.accentDim,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📄</div>}
                  <div style={{position:"absolute",bottom:2,left:2,background:"rgba(0,0,0,0.6)",borderRadius:3,padding:"1px 4px",fontSize:9,color:"#fff"}}>{i+1}</div>
                  <button onClick={()=>{setFiles(f=>f.filter((_,j)=>j!==i));setPreviews(p=>p.filter((_,j)=>j!==i));}} style={{position:"absolute",top:-4,right:-4,background:C.red,border:"none",borderRadius:"50%",color:"#fff",width:18,height:18,cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                </div>
              ))}
              <div onClick={()=>fileRef.current?.click()} style={{height:64,width:64,background:C.surface2,border:`2px dashed ${C.border}`,borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,gap:2}}>
                <span style={{fontSize:18,color:C.textMuted}}>+</span>
                <span style={{fontSize:9,color:C.textMuted}}>mais</span>
              </div>
            </div>
          </div>
        )}
        {/* Inputs */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>handleFiles(e.target.files)}/>
        <input ref={fileRef} type="file" accept="image/*,audio/*,.pdf" multiple style={{display:"none"}} onChange={e=>handleFiles(e.target.files)}/>
        {/* Botões de anexo */}
        {files.length===0&&(
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            <button onClick={()=>cameraRef.current?.click()} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:8,color:C.accent,padding:"6px 10px",cursor:"pointer",fontSize:12,fontWeight:700}}>📸 Câmera</button>
            <button onClick={()=>fileRef.current?.click()} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:8,color:C.accent,padding:"6px 10px",cursor:"pointer",fontSize:12,fontWeight:700}}>🖼️ Galeria</button>
          </div>
        )}
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Dúvida clínica, vitais, prescrição... (Enter envia)" rows={2} style={{flex:1,resize:"none",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:10,color:C.text,padding:"10px 14px",fontSize:13,fontFamily:"inherit"}}/>
          <button onClick={send} disabled={loading||(files.length===0&&!input.trim())} style={{background:`linear-gradient(135deg,${C.accent},#4299e1)`,border:"none",borderRadius:10,color:"#fff",padding:"10px 14px",cursor:"pointer",fontSize:18,flexShrink:0,opacity:loading?0.4:1}}>➤</button>
        </div>
      </div>
    </div>
  );
}

function DailyModule(){
  const [content,setContent]=useState("");const [loading,setLoading]=useState(false);const [mode,setMode]=useState("10");const [error,setError]=useState("");
  const today=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});
  const MODES=[{id:"2",label:"⚡ 2 min",desc:"Flash — conceito chave"},{id:"5",label:"📋 5 min",desc:"Resumo completo"},{id:"10",label:"🩺 10 min",desc:"Com caso clínico"},{id:"20",label:"📚 20 min",desc:"Estudo profundo"}];
  const PROMPTS={"2":"Gere 5 doenças FLASH (150 palavras cada):\n## ⚡ DOENÇA [N]: [NOME]\n**Suspeitar:** 1 frase\n**Diagnóstico:** critério+exame\n**Tratamento:** dose principal\n**Pearl:** 1 dica crítica","5":"Gere 5 doenças resumo (300 palavras cada):\n## 📋 DOENÇA [N]: [NOME]\n### Quadro clínico\n### Diagnóstico\n### Tratamento (posologia completa)\n### Alta vs Internação","10":"Gere 5 doenças com caso clínico:\n## 🩺 DOENÇA [N]: [NOME]\n### Como suspeitar / Quadro clínico\n### Diagnóstico (critérios, exames, valores de corte)\n### Diagnósticos diferenciais (3)\n### Tratamento COMPLETO (posologia+diluição para cada medicamento)\n### Alta vs Internação (critérios objetivos)\n### Perguntas críticas na beira do leito\n### Caso clínico (1 caso realista gerado por IA)","20":"Gere 5 doenças estudo completo:\n## 📚 DOENÇA [N]: [NOME]\n### Fisiopatologia\n### Quadro clínico (típico e atípico)\n### Diagnóstico (critérios, scores, valores de corte)\n### Diagnósticos diferenciais (5 com como diferenciar)\n### Tratamento COMPLETO (cada medicamento: dose, via, diluição, tempo infusão, ajuste renal/hepático, contraindicações, interações)\n### Alta vs Internação (enfermaria/semi-intensiva/UTI)\n### 10+ Perguntas críticas na beira do leito\n### 3 Casos clínicos (típico, atípico, diferencial desafiador)\n### Referências e nível de evidência"};
  const load=async()=>{
    setLoading(true);setContent("");setError("");
    try{const r=await callGemini({prompt:`Hoje é ${today}.\n${PROMPTS[mode]}\n\n5 doenças variadas: cardiovascular, pulmonar, infecciosa, metabólica, neurológica/emergência. Base: USP Clínica Médica, Abramed, guidelines internacionais (Surviving Sepsis, AHA, ESC, IDSA).`,systemPrompt:SYS,maxTokens:mode==="20"?6000:mode==="10"?4000:2000});setContent(r);}
    catch(e){setError(e.message);}
    setLoading(false);
  };
  const fmt=l=>{if(l.startsWith("## "))return{fontWeight:900,color:C.accent,fontSize:15,marginTop:24,marginBottom:6,borderLeft:`3px solid ${C.accent}`,paddingLeft:10};if(l.startsWith("### "))return{fontWeight:700,color:C.yellow,fontSize:13,marginTop:12,marginBottom:4};return{}};
  return(
    <div>
      <Title icon="📚" title="Doenças do Dia" subtitle={today}/>
      <Card style={{marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>Quanto tempo você tem agora?</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          {MODES.map(m=><button key={m.id} onClick={()=>setMode(m.id)} style={{background:mode===m.id?C.accentDim:"transparent",border:`1px solid ${mode===m.id?C.accent:C.border}`,borderRadius:10,color:mode===m.id?C.accent:C.textMuted,padding:"10px 12px",cursor:"pointer",textAlign:"left"}}><div style={{fontSize:13,fontWeight:700}}>{m.label}</div><div style={{fontSize:11,marginTop:2}}>{m.desc}</div></button>)}
        </div>
        <Btn onClick={load} disabled={loading} full>{loading?<><Sp/>Gerando doenças de hoje...</>:"🎯 Estudar Agora"}</Btn>
        {error&&<div style={{color:C.red,fontSize:12,marginTop:10}}>⚠️ {error}</div>}
      </Card>
      {content&&<Card style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.9,color:C.text}}>
        {content.split("\n").map((l,i)=><div key={i} style={fmt(l)}>{l.replace(/^##+ /,"")||"\u00A0"}</div>)}
      </Card>}
    </div>
  );
}

// ── DRUG ────────────────────────────────────────────────────
function DrugModule(){
  const [q,setQ]=useState("");const [result,setResult]=useState("");const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const QUICK=["Norepinefrina","Dobutamina","Vasopressina","Meropeném","Pip-Tazo","Vancomicina","Furosemida EV","Heparina","Alteplase","Midazolam","Propofol","Fentanil","Insulina EV","Amiodarona","Adenosina","Morfina","Dexametasona","Metilprednisolona"];
  const search=async()=>{
    if(!q.trim()||loading)return;setLoading(true);setResult("");setError("");
    try{const r=await callGemini({prompt:`Detalhe COMPLETAMENTE o medicamento: ${q}\n\n1. Nome genérico + comerciais no Brasil\n2. Mecanismo de ação\n3. Indicações clínicas (todas)\n4. POSOLOGIA COMPLETA (cada indicação separada com dose específica)\n5. Apresentações disponíveis no Brasil\n6. DILUIÇÃO: qual solução (SF 0,9%/SG 5%/RL), volume (mL), concentração máxima, tempo de infusão (min/h)\n7. Reconstituição se pó liofilizado\n8. Ajuste renal: TFG <60, <30, <15, diálise\n9. Ajuste hepático: Child A/B/C\n10. Contraindicações absolutas e relativas\n11. Interações clinicamente relevantes (top 5)\n12. Efeitos adversos importantes\n13. Monitoramento necessário\n14. Pearls clínicos\n15. Nível de evidência + referência`,systemPrompt:SYS,maxTokens:3000});setResult(r);}
    catch(e){setError(e.message);}
    setLoading(false);
  };
  const fmt=l=>{if(l.startsWith("## "))return{fontWeight:900,color:C.accent,fontSize:14,marginTop:16,marginBottom:4};if(l.startsWith("### "))return{fontWeight:700,color:C.yellow,fontSize:13,marginTop:10};return{}};
  return(
    <div>
      <Title icon="💊" title="Consulta de Medicamento" subtitle="Posologia completa com diluição, ajuste renal e evidências"/>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <Input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="Nome do medicamento..." style={{flex:1}}/>
        <Btn onClick={search} disabled={loading||!q.trim()}>{loading?<Sp/>:"🔍"}</Btn>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
        {QUICK.map(d=><button key={d} onClick={()=>setQ(d)} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:8,color:C.accent,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>{d}</button>)}
      </div>
      {error&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>⚠️ {error}</div>}
      {result&&<Card style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.8,color:C.text}}>
        {result.split("\n").map((l,i)=><div key={i} style={fmt(l)}>{l.replace(/^##+ /,"")||"\u00A0"}</div>)}
      </Card>}
    </div>
  );
}

// ── UPLOAD ──────────────────────────────────────────────────
function UploadModule(){
  const [file,setFile]=useState(null);const [prev,setPrev]=useState(null);const [text,setText]=useState("");const [result,setResult]=useState("");const [loading,setLoading]=useState(false);const [error,setError]=useState("");const [showSave,setShowSave]=useState(false);
  const ref=useRef(null);
  const hf=f=>{if(!f)return;setFile(f);if(f.type.startsWith("image/")){const r=new FileReader();r.onload=e=>setPrev(e.target.result);r.readAsDataURL(f);}else setPrev(null);};
  const analyze=async()=>{
    if((!text.trim()&&!file)||loading)return;setLoading(true);setResult("");setError("");setShowSave(false);
    let ib=null,it=null;
    if(file?.type.startsWith("image/")){ib=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file)});it=file.type;}
    try{
      const r=await callGemini({prompt:`Analise esta prescrição/evolução médica como preceptor experiente:\n\n${text}\n\n1. 📋 RESUMO do que foi prescrito/documentado\n2. ✅ PONTOS POSITIVOS da conduta\n3. ⚠️ PROBLEMAS E ERROS (dose, diluição, omissões, inconsistências)\n4. 💊 MEDICAMENTOS — corrija com posologia COMPLETA se necessário\n5. 🔍 DIAGNÓSTICOS NÃO CONSIDERADOS que deveriam ser avaliados\n6. 🧠 PERGUNTAS CRÍTICAS que o médico deveria se fazer\n7. 📝 CONDUTA OTIMIZADA SUGERIDA\n8. 📚 REFERÊNCIA APLICÁVEL (guideline, nível de evidência)`,systemPrompt:SYS,imageBase64:ib,imageType:it});
      setResult(r);setShowSave(true);
    }catch(e){setError(e.message);}
    setLoading(false);
  };
  const saveToPrescriptions=()=>{
    const prescriptions=DB.get("prescriptions")||[];
    const newPresc={id:Date.now().toString(),drug:text.split("\n")[0]?.slice(0,60)||"Prescrição analisada",context:"Extraída de análise",notes:text.slice(0,300),listId:"all",createdAt:new Date().toISOString()};
    DB.set("prescriptions",[...prescriptions,newPresc]);
    setShowSave(false);alert("✅ Salvo na biblioteca de prescrições!");
  };
  return(
    <div>
      <Title icon="📋" title="Análise de Prescrição" subtitle="Foto ou texto — o preceptor revisa e critica a conduta"/>
      <div onClick={()=>ref.current?.click()} style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:20,textAlign:"center",cursor:"pointer",marginBottom:10,background:file?C.accentDim:"transparent"}}>
        <input ref={ref} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>hf(e.target.files?.[0])}/>
        {prev?<img src={prev} alt="" style={{maxHeight:140,borderRadius:8}}/>:<div style={{color:C.textMuted,fontSize:13}}>📎 {file?file.name:"Toque para anexar imagem de prescrição ou PDF"}</div>}
      </div>
      <TA value={text} onChange={e=>setText(e.target.value)} placeholder="Ou cole/descreva a prescrição, evolução ou situação clínica..." rows={5} style={{marginBottom:10}}/>
      {error&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>⚠️ {error}</div>}
      <Btn onClick={analyze} disabled={loading||(!text.trim()&&!file)} full style={{marginBottom:12}}>{loading?<><Sp/>Analisando...</>:"🔍 Analisar com Preceptor"}</Btn>
      {showSave&&<Card style={{marginBottom:10,border:`1px solid ${C.green}44`,background:C.greenDim}}><div style={{fontSize:13,color:C.green,marginBottom:8}}>💡 Deseja salvar na biblioteca de prescrições?</div><div style={{display:"flex",gap:8}}><Btn onClick={saveToPrescriptions} variant="success" size="sm">✅ Salvar</Btn><Btn onClick={()=>setShowSave(false)} variant="ghost" size="sm">Não</Btn></div></Card>}
      {result&&<Card style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.8,color:C.text}}>{result}</Card>}
    </div>
  );
}

// ── SETTINGS ────────────────────────────────────────────────
function SettingsModule({onReset, onLogout, userProfile, firebaseUser}){
  const [key,setKey]=useState(localStorage.getItem("geminiKey")||"");const [saved,setSaved]=useState(false);const [testing,setTesting]=useState(false);const [msg,setMsg]=useState("");
  const save=()=>{saveKey(key);setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const test=async()=>{
    setTesting(true);setMsg("");
    try{workingModel=null;localStorage.removeItem("geminiModel");localStorage.setItem("geminiKey",key);await callGemini({prompt:"OK",maxTokens:10});setMsg(`✅ Funcionando! Modelo: ${workingModel}`);}
    catch(e){setMsg("❌ "+e.message);}
    setTesting(false);
  };
  const isAdmin = userProfile?.role === "admin";
  return(
    <div>
      <Title icon="⚙️" title="Configurações"/>
      <Card style={{marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {firebaseUser?.photoURL&&<img src={firebaseUser.photoURL} style={{width:48,height:48,borderRadius:"50%",border:`2px solid ${isAdmin?C.gold:C.accent}`}} alt=""/>}
          <div>
            <div style={{fontWeight:700,color:C.text,fontSize:15}}>{userProfile?.alias||"Usuário"}</div>
            <div style={{fontSize:12,color:C.textMuted}}>{firebaseUser?.email}</div>
            <Badge color={isAdmin?C.gold:C.accent} style={{marginTop:4}}>{isAdmin?"👑 Administrador":"👤 Membro"}</Badge>
          </div>
        </div>
        {workingModel&&<div style={{marginTop:10,fontSize:11,color:C.textMuted}}>Modelo IA: <span style={{color:C.green}}>{workingModel}</span></div>}
      </Card>
      <Card style={{marginBottom:10}}>
        <div style={{fontWeight:700,color:C.text,marginBottom:4}}>🔑 Chave API Gemini</div>
        <div style={{fontSize:12,color:C.textMuted,marginBottom:10,lineHeight:1.6}}>Obtenha em <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{color:C.accent}}>aistudio.google.com</a> → "Default Gemini Project"</div>
        <Input value={key} onChange={e=>setKey(e.target.value)} placeholder="AIza..." type="password" style={{marginBottom:10}}/>
        <div style={{display:"flex",gap:8}}><Btn onClick={save} variant="success" size="sm">{saved?"✅ Salvo!":"💾 Salvar"}</Btn><Btn onClick={test} disabled={testing||!key} variant="ghost" size="sm">{testing?<Sp size={12}/>:"🧪 Testar"}</Btn></div>
        {msg&&<div style={{fontSize:12,marginTop:8,color:msg.includes("✅")?C.green:C.red,lineHeight:1.5}}>{msg}</div>}
      </Card>
      <Card style={{marginBottom:10}}>
        <div style={{fontWeight:700,color:C.red,marginBottom:6}}>🚪 Sair da conta</div>
        <div style={{fontSize:12,color:C.textMuted,marginBottom:8}}>Desconectar do Google e sair do app.</div>
        <Btn onClick={onLogout} variant="danger" size="sm">🚪 Sair</Btn>
      </Card>
      <Card>
        <div style={{fontWeight:700,color:C.red,marginBottom:6}}>⚠️ Limpar dados locais</div>
        <div style={{fontSize:12,color:C.textMuted,marginBottom:8}}>Apaga cache local. Dados na nuvem (Firebase) permanecem.</div>
        <Btn onClick={()=>{if(window.confirm("Limpar dados locais?")){{localStorage.clear();onReset();}}}} variant="danger" size="sm">🗑️ Limpar cache</Btn>
      </Card>
    </div>
  );
}

// ── MAIN APP ────────────────────────────────────────────────
// ── PLANTÃO TAB ───────────────────────────────────────────
function PlantaoTab(){
  const CACHE="plantao_v2";
  const load=()=>{try{return JSON.parse(localStorage.getItem(CACHE)||"null")||[];}catch{return[];}};
  const [patients,setPatients]=useState(load);
  const [selectedId,setSelectedId]=useState(null);
  const [view,setView]=useState("list");
  const [showNew,setShowNew]=useState(false);
  const [newPending,setNewPending]=useState("");
  const [form,setForm]=useState({name:"",age:"",gender:"M",bed:"",status:"stable",summary:"",comorbidities:""});
  const [aiInput,setAiInput]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [aiStatus,setAiStatus]=useState("");
  const aiRef=useRef(null);
  const s=(k,v)=>setForm(f=>({...f,[k]:v}));

  // IA processa texto livre e age sobre os pacientes
  const processAI=async()=>{
    if(!aiInput.trim()||aiLoading)return;
    setAiLoading(true);setAiStatus("Processando...");
    const patientList=patients.map(p=>`ID:${p.id} | Nome:${p.name} | Leito:${p.bed||"?"} | Status:${p.status}`).join("\n")||"(nenhum paciente ainda)";
    try{
      const key=getKey();const model=localStorage.getItem("geminiModel")||"gemini-2.5-flash";
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contents:[{role:"user",parts:[{text:`Você é um assistente médico que gerencia uma lista de pacientes no plantão.

PACIENTES ATUAIS:
${patientList}

COMANDO DO MÉDICO: "${aiInput}"

Analise o comando e responda APENAS com JSON válido (sem markdown):
{
  "action": "create|update|remove|info",
  "patients_to_create": [
    {
      "name": "nome completo",
      "age": "idade ou null",
      "gender": "M|F|O",
      "bed": "leito ou null",
      "status": "stable|attention|critical|intercurrence|discharge|covering",
      "summary": "diagnóstico/motivo ou null",
      "comorbidities": "comorbidades ou null",
      "medications": [{"name":"med","dose":"dose","schedule":"horário","isAtb":false,"atbDay":""}],
      "pending": ["pendência 1"],
      "vitals": {"pas":"","pad":"","fc":"","fr":"","spo2":"","temp":""}
    }
  ],
  "patients_to_update": [
    {
      "id": "ID_DO_PACIENTE",
      "changes": {
        "status": "novo status ou null",
        "summary": "novo resumo ou null",
        "pending_add": ["nova pendência"],
        "medications_add": [{"name":"","dose":"","schedule":"","isAtb":false}],
        "vitals": {"pas":"","fc":""},
        "clinicalImpression": "impressão ou null"
      }
    }
  ],
  "patients_to_remove": ["ID1","ID2"],
  "message": "confirmação em 1 frase do que foi feito"
}

REGRAS:
- "criar paciente João, 67 anos, leito 12, ICC" → create
- "João piora, crítico" → update (encontre João pelo nome)
- "adicionar pendência eco no Pedro" → update pending_add
- "remover Maria" ou "dar alta Maria" → remove
- "João PA 130x80 FC 88" → update vitals
- Inclua APENAS os campos mencionados (null para o resto)
- Se não souber qual paciente, use o mais parecido pelo nome`}]}],generationConfig:{maxOutputTokens:2000,temperature:0.1}})
      });
      const d=await res.json();
      if(d.error)throw new Error(d.error.message);
      const text=d.candidates?.[0]?.content?.parts?.[0]?.text||"{}";
      const clean=text.replace(/```json|```/g,"").trim();
      const result=JSON.parse(clean);

      let newList=[...patients];
      let msg=result.message||"Feito!";

      // Criar pacientes
      if(result.patients_to_create?.length){
        result.patients_to_create.forEach(p=>{
          const np={...p,id:Date.now().toString()+Math.random(),createdAt:new Date().toISOString(),medications:p.medications||[],pending:p.pending||[],labs:{},vitals:p.vitals||{}};
          newList.push(np);
          setSelectedId(np.id);
          setView("patient");
        });
      }

      // Atualizar pacientes
      if(result.patients_to_update?.length){
        result.patients_to_update.forEach(upd=>{
          const idx=newList.findIndex(p=>p.id===upd.id);
          if(idx<0)return;
          const p=newList[idx];const ch=upd.changes||{};
          let updated={...p};
          if(ch.status)updated.status=ch.status;
          if(ch.summary)updated.summary=ch.summary;
          if(ch.clinicalImpression)updated.clinicalImpression=ch.clinicalImpression;
          if(ch.vitals){updated.vitals={...(updated.vitals||{}),...Object.fromEntries(Object.entries(ch.vitals).filter(([,v])=>v))};}
          if(ch.pending_add?.length)updated.pending=[...(updated.pending||[]),...ch.pending_add];
          if(ch.medications_add?.length)updated.medications=[...(updated.medications||[]),...ch.medications_add.map(m=>({...m,id:Date.now().toString()+Math.random()}))];
          newList[idx]=updated;
          setSelectedId(updated.id);setView("patient");
        });
      }

      // Remover pacientes
      if(result.patients_to_remove?.length){
        newList=newList.filter(p=>!result.patients_to_remove.includes(p.id));
        if(result.patients_to_remove.includes(selectedId)){setSelectedId(newList[0]?.id||null);if(!newList.length)setView("list");}
      }

      save(newList);
      setAiStatus("✅ "+msg);
      setAiInput("");
    }catch(e){setAiStatus("⚠️ "+e.message);}
    setAiLoading(false);
    setTimeout(()=>setAiStatus(""),4000);
  };

  const save=p=>{setPatients(p);localStorage.setItem(CACHE,JSON.stringify(p));};
  const add=()=>{
    if(!form.name.trim())return;
    const np={...form,id:Date.now().toString(),medications:[],pending:[],labs:{},vitals:{},createdAt:new Date().toISOString()};
    const updated=[...patients,np];save(updated);
    setForm({name:"",age:"",gender:"M",bed:"",status:"stable",summary:"",comorbidities:""});
    setShowNew(false);setSelectedId(np.id);setView("patient");
  };
  const update=p=>{save(patients.map(x=>x.id===p.id?p:x));};
  const remove=id=>{
    const updated=patients.filter(x=>x.id!==id);save(updated);
    if(selectedId===id){setSelectedId(updated[0]?.id||null);if(!updated.length)setView("list");}
  };
  const current=patients.find(p=>p.id===selectedId);
  const st=s2=>({stable:{icon:"🟢",color:"#68d391"},attention:{icon:"🟡",color:"#f6e05e"},critical:{icon:"🔴",color:"#fc8181"},intercurrence:{icon:"⚡",color:"#63b3ed"},discharge:{icon:"🏠",color:"#68d391"},covering:{icon:"🔄",color:"#718096"}})[s2]||{icon:"🟢",color:"#68d391"};

  // Vista rápida do paciente no plantão
  const PatientView=({p})=>{
    const [editVitals,setEditVitals]=useState(false);
    const [vitForm,setVitForm]=useState(p.vitals||{});
    const [addMed,setAddMed]=useState(false);
    const [medForm,setMedForm]=useState({name:"",dose:"",schedule:"",isAtb:false});
    const status=st(p.status);

    return(
      <div>
        {/* Header */}
        <div style={{background:`${status.color}11`,border:`1px solid ${status.color}33`,borderRadius:12,padding:12,marginBottom:10,borderLeft:`4px solid ${status.color}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:24}}>{{M:"👨",F:"👩",O:"🧑"}[p.gender]||"🧑"}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:900,color:C.text,fontSize:16}}>{p.name}</div>
              <div style={{fontSize:12,color:C.textMuted}}>{p.age&&`${p.age}a`}{p.bed&&` · L${p.bed}`}</div>
              {p.comorbidities&&<div style={{fontSize:11,color:C.textMuted,marginTop:2}}>🏥 {p.comorbidities}</div>}
            </div>
            <select value={p.status} onChange={e=>update({...p,status:e.target.value})} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"5px 8px",fontSize:12,cursor:"pointer"}}>
              {["stable","attention","critical","intercurrence","discharge","covering"].map(k=><option key={k} value={k}>{st(k).icon} {k}</option>)}
            </select>
          </div>
          {p.summary&&<div style={{fontSize:12,color:C.text,marginTop:6,opacity:0.8}}>{p.summary}</div>}
        </div>

        {/* Vitais rápidos */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:10,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:11,color:C.teal,fontWeight:700}}>💉 VITAIS</span>
            <div style={{display:"flex",gap:5}}>
              {editVitals&&<button onClick={()=>{update({...p,vitals:vitForm,vitalsDate:new Date().toISOString()});setEditVitals(false);}} style={{background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:6,color:C.green,padding:"2px 8px",cursor:"pointer",fontSize:11,fontWeight:700}}>Salvar</button>}
              <button onClick={()=>{setVitForm(p.vitals||{});setEditVitals(!editVitals);}} style={{background:editVitals?C.redDim:C.accentDim,border:`1px solid ${editVitals?C.red:C.border}`,borderRadius:6,color:editVitals?C.red:C.accent,padding:"2px 8px",cursor:"pointer",fontSize:11,fontWeight:700}}>{editVitals?"✕":"✏️"}</button>
            </div>
          </div>
          {editVitals?(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
              {[{k:"pas",l:"PAS"},{k:"pad",l:"PAD"},{k:"fc",l:"FC"},{k:"fr",l:"FR"},{k:"spo2",l:"SpO2"},{k:"temp",l:"T°C"}].map(({k,l})=>
                <div key={k}><div style={{fontSize:9,color:C.textMuted}}>{l}</div><input type="number" value={vitForm[k]||""} onChange={e=>setVitForm(f=>({...f,[k]:e.target.value}))} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"5px 7px",fontSize:13,textAlign:"center",boxSizing:"border-box"}}/></div>
              )}
              <div style={{gridColumn:"1/-1"}}><div style={{fontSize:9,color:C.textMuted}}>Diurese (mL)</div><input type="number" value={vitForm.diurese||""} onChange={e=>setVitForm(f=>({...f,diurese:e.target.value}))} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"5px 7px",fontSize:13,boxSizing:"border-box"}}/></div>
            </div>
          ):(
            Object.keys(p.vitals||{}).length===0
              ?<div style={{color:C.textDim,fontSize:12,textAlign:"center",padding:"5px 0"}}>Toque ✏️ para adicionar</div>
              :<div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {[{k:"pas",l:"PA"},{k:"fc",l:"FC"},{k:"fr",l:"FR"},{k:"spo2",l:"SpO2"},{k:"temp",l:"T°"},{k:"diurese",l:"Diu"}].filter(({k})=>p.vitals?.[k]).map(({k,l})=>
                  <div key={k} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:7,padding:"3px 8px",textAlign:"center"}}><div style={{fontSize:9,color:C.textMuted}}>{l}</div><div style={{fontSize:12,fontWeight:700,color:C.text}}>{p.vitals[k]}</div></div>
                )}
              </div>
          )}
        </div>

        {/* Pendências rápidas */}
        <div style={{background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:12,padding:10,marginBottom:8}}>
          <div style={{fontSize:11,color:C.yellow,fontWeight:700,marginBottom:6}}>⏳ PENDÊNCIAS ({(p.pending||[]).length})</div>
          {(p.pending||[]).map((pend,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{flex:1,fontSize:12,color:C.text}}>• {pend}</span>
              <button onClick={()=>{const pp=[...(p.pending||[])];pp.splice(i,1);update({...p,pending:pp});}} style={{background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:5,color:C.green,padding:"1px 6px",cursor:"pointer",fontSize:11}}>✓</button>
            </div>
          ))}
          <div style={{display:"flex",gap:5,marginTop:6}}>
            <input value={newPending} onChange={e=>setNewPending(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newPending.trim()){update({...p,pending:[...(p.pending||[]),newPending.trim()]});setNewPending("");}}} placeholder="+ Pendência rápida (Enter)..." style={{flex:1,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.yellow}33`,borderRadius:7,color:C.text,padding:"6px 10px",fontSize:12,fontFamily:"inherit"}}/>
          </div>
          {/* Atalhos */}
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
            {["Checar hemograma","Aguardar parecer","Verificar diurese","Solicitar ECG","Confirmar vaga","Checar RX"].map(t=>(
              <button key={t} onClick={()=>update({...p,pending:[...(p.pending||[]),t]})} style={{background:"rgba(246,224,94,0.1)",border:`1px solid ${C.yellow}22`,borderRadius:6,color:C.yellow,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:600}}>+ {t}</button>
            ))}
          </div>
        </div>

        {/* Medicamentos */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:10,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:11,color:C.yellow,fontWeight:700}}>💊 MEDICAMENTOS</span>
            <button onClick={()=>setAddMed(!addMed)} style={{background:addMed?C.redDim:C.accentDim,border:`1px solid ${addMed?C.red:C.border}`,borderRadius:6,color:addMed?C.red:C.accent,padding:"2px 8px",cursor:"pointer",fontSize:11,fontWeight:700}}>{addMed?"✕":"+ Add"}</button>
          </div>
          {(p.medications||[]).map(m=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",background:m.isAtb?C.yellowDim:C.surface2,border:`1px solid ${m.isAtb?C.yellow+"33":C.border}`,borderRadius:8,marginBottom:4}}>
              <span style={{fontSize:13}}>{m.isAtb?"🦠":"💊"}</span>
              <div style={{flex:1,minWidth:0,fontSize:12}}><span style={{fontWeight:600,color:m.isAtb?C.yellow:C.text}}>{m.name}</span><span style={{color:C.textMuted}}> {m.dose}{m.schedule&&` · ${m.schedule}`}</span>{m.isAtb&&m.atbDay&&<span style={{color:C.yellow}}> D{m.atbDay}</span>}</div>
              <button onClick={()=>update({...p,medications:(p.medications||[]).filter(x=>x.id!==m.id)})} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:12}}>✕</button>
            </div>
          ))}
          {(p.medications||[]).length===0&&!addMed&&<div style={{color:C.textDim,fontSize:12,textAlign:"center",padding:"4px 0"}}>Nenhum medicamento</div>}
          {addMed&&(
            <div style={{background:C.surface2,borderRadius:9,padding:9,marginTop:6}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:5}}>
                <input value={medForm.name} onChange={e=>setMedForm(f=>({...f,name:e.target.value}))} placeholder="Medicamento *" style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"6px 9px",fontSize:12,fontFamily:"inherit"}}/>
                <input value={medForm.dose} onChange={e=>setMedForm(f=>({...f,dose:e.target.value}))} placeholder="Dose" style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"6px 9px",fontSize:12,fontFamily:"inherit"}}/>
                <input value={medForm.schedule} onChange={e=>setMedForm(f=>({...f,schedule:e.target.value}))} placeholder="Horário (8/8h...)" style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"6px 9px",fontSize:12,fontFamily:"inherit"}}/>
                <input value={medForm.atbDay||""} onChange={e=>setMedForm(f=>({...f,atbDay:e.target.value}))} placeholder="D. ATB (se ATB)" style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"6px 9px",fontSize:12,fontFamily:"inherit"}}/>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:C.textMuted,marginBottom:6}}><input type="checkbox" checked={medForm.isAtb} onChange={e=>setMedForm(f=>({...f,isAtb:e.target.checked}))} style={{accentColor:C.yellow}}/> 🦠 ATB</label>
              <button onClick={()=>{if(!medForm.name.trim())return;update({...p,medications:[...(p.medications||[]),{...medForm,id:Date.now().toString()}]});setMedForm({name:"",dose:"",schedule:"",isAtb:false,atbDay:""});setAddMed(false);}} style={{width:"100%",background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:8,color:C.accent,padding:"7px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>+ Adicionar</button>
            </div>
          )}
        </div>

        {/* Ações */}
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <button onClick={()=>remove(p.id)} style={{flex:1,background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:9,color:C.red,padding:"9px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>🗑️ Remover</button>
        </div>
      </div>
    );
  };

  return(
    <div style={{animation:"fadeIn 0.3s ease"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <div style={{fontWeight:900,color:C.gold,fontSize:18}}>⚡ Plantão</div>
        <Badge color={C.gold}>{patients.length}p</Badge>
        <div style={{flex:1}}/>
        {patients.length>0&&<Btn onClick={()=>{if(window.confirm("Limpar plantão?"))save([]);setSelectedId(null);setView("list");}} variant="danger" size="sm">🗑️</Btn>}
      </div>

      {/* BARRA DE TEXTO LIVRE COM IA */}
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <div style={{flex:1}}>
            <textarea
              ref={aiRef}
              value={aiInput}
              onChange={e=>setAiInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();processAI();}}}
              placeholder="Digite livremente — a IA entende tudo. Ex: criar João 67a leito 12 ICC HAS DM2 / João PA 130x80 FC 88 / Pedro crítico pedir UTI / dar alta Maria" 
              rows={3}
              style={{width:"100%",background:`rgba(246,173,85,0.06)`,border:`2px solid ${C.gold}44`,borderRadius:12,color:C.text,padding:"12px 14px",fontSize:13,fontFamily:"inherit",resize:"none",boxSizing:"border-box",lineHeight:1.5}}
            />
          </div>
          <button
            onClick={processAI}
            disabled={aiLoading||!aiInput.trim()}
            style={{background:aiLoading?"transparent":`linear-gradient(135deg,${C.gold},#e67e22)`,border:`2px solid ${C.gold}`,borderRadius:12,color:aiLoading?C.gold:"#fff",padding:"12px 16px",cursor:"pointer",fontSize:20,flexShrink:0,opacity:!aiInput.trim()?0.4:1,transition:"all 0.2s",height:74,alignSelf:"flex-end"}}
          >{aiLoading?<div style={{width:20,height:20,border:`2px solid ${C.gold}33`,borderTop:`2px solid ${C.gold}`,borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>:"➤"}</button>
        </div>
        {aiStatus&&(
          <div style={{fontSize:12,color:aiStatus.startsWith("✅")?C.green:aiStatus.startsWith("⚠️")?C.red:C.gold,marginTop:6,padding:"5px 10px",background:aiStatus.startsWith("✅")?C.greenDim:aiStatus.startsWith("⚠️")?C.redDim:C.goldDim,borderRadius:8}}>
            {aiStatus}
          </div>
        )}
        <div style={{fontSize:10,color:C.textDim,marginTop:5,textAlign:"center"}}>Enter para enviar · Shift+Enter nova linha · A IA cria, atualiza e remove pacientes automaticamente</div>
      </div>

      {/* Novo paciente (formulário manual — alternativa) */}
      {showNew&&(
        <Card style={{marginBottom:12,border:`1px solid ${C.gold}44`}}>
          <div style={{fontWeight:700,color:C.gold,marginBottom:10}}>Novo Paciente — Plantão</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
            <Input value={form.name} onChange={e=>s("name",e.target.value)} placeholder="Nome *"/>
            <Input value={form.age} onChange={e=>s("age",e.target.value)} placeholder="Idade" type="number"/>
            <Input value={form.bed} onChange={e=>s("bed",e.target.value)} placeholder="Leito"/>
            <select value={form.status} onChange={e=>s("status",e.target.value)} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"8px 10px",fontSize:13}}>
              {[["stable","🟢 Estável"],["attention","🟡 Atenção"],["critical","🔴 Crítico"],["intercurrence","⚡ Intercorrência"],["discharge","🏠 Alta possível"]].map(([k,l])=><option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <Input value={form.comorbidities} onChange={e=>s("comorbidities",e.target.value)} placeholder="Comorbidades" style={{marginBottom:6}}/>
          <Input value={form.summary} onChange={e=>s("summary",e.target.value)} placeholder="Diagnóstico / motivo" style={{marginBottom:8}}/>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={add} variant="gold" size="sm">⚡ Adicionar</Btn>
            <Btn onClick={()=>setShowNew(false)} variant="ghost" size="sm">Cancelar</Btn>
          </div>
        </Card>
      )}

      {/* Barra de pacientes — sempre visível */}
      {patients.length>0&&(
        <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:10,paddingBottom:4}}>
          {patients.map(p=>{
            const status=st(p.status);
            return(
              <button key={p.id} onClick={()=>{setSelectedId(p.id);setView("patient");}} style={{flexShrink:0,padding:"6px 14px",borderRadius:20,cursor:"pointer",border:`2px solid ${selectedId===p.id&&view==="patient"?status.color:C.border}`,background:selectedId===p.id&&view==="patient"?`${status.color}22`:"transparent",color:selectedId===p.id&&view==="patient"?status.color:C.textMuted,fontSize:13,fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>
                {status.icon} {p.name.split(" ")[0]}{p.bed&&` · L${p.bed}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Vista do paciente selecionado */}
      {view==="patient"&&current&&<PatientView p={current}/>}

      {/* Lista vazia */}
      {patients.length===0&&!showNew&&(
        <div style={{textAlign:"center",color:C.textMuted,padding:"40px 0"}}>
          <div style={{fontSize:48,marginBottom:12}}>⚡</div>
          <div style={{fontSize:15,color:C.text,marginBottom:8}}>Plantão vazio</div>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:20}}>Adicione os pacientes que você vai acompanhar no plantão</div>
          <Btn onClick={()=>setShowNew(true)} variant="gold">+ Adicionar primeiro paciente</Btn>
        </div>
      )}
    </div>
  );
}

const TABS=[
  {id:"areas",icon:"🗺️",label:"Áreas"},
  {id:"plantao",icon:"⚡",label:"Plantão"},
  {id:"chat",icon:"💬",label:"Preceptor"},
  {id:"daily",icon:"📚",label:"Estudo"},
  {id:"drug",icon:"💊",label:"Medicamento"},
  {id:"prescriptions",icon:"💉",label:"Prescrições"},
  {id:"upload",icon:"📋",label:"Análise"},
  {id:"reports",icon:"📄",label:"Relatórios"},
  {id:"biblioteca",icon:"📖",label:"Biblioteca"},
  {id:"cientista",icon:"🧬",label:"Cientista"},
  {id:"settings",icon:"⚙️",label:"Config"},
];

export default function App({ firebaseUser, userProfile, onLogout, firebaseAreas, firebasePatients, syncStatus, onUpdatePatient, onAddPatient, onRemovePatient, onUpdateAreas, onAddArea, onRemoveArea, onReloadData }){
  const [ready,setReady]=useState(!!getKey());
  const [tab,setTab]=useState("chat");
  const isAdmin = userProfile?.role === "admin";
  const alias = userProfile?.alias || firebaseUser?.displayName || "Médico";
  if(!ready)return <SetupScreen onDone={()=>setReady(true)}/>;
  return(
    <div style={{fontFamily:"'Georgia',serif",background:C.bg,minHeight:"100vh",color:C.text,display:"flex",flexDirection:"column",maxWidth:800,margin:"0 auto"}}>
      <style>{`*{box-sizing:border-box}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.surface2};border-radius:2px}input:focus,textarea:focus,select:focus{outline:none;border-color:${C.accent}!important}button:active{opacity:.85}a{color:${C.accent}}`}</style>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:100}}>
        <div style={{width:34,height:34,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#4299e1)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,boxShadow:glow()}}>🩺</div>
        <div style={{flex:1}}><div style={{fontWeight:900,fontSize:13,color:C.text,letterSpacing:0.5}}>PRECEPTOR MÉDICO</div><div style={{fontSize:9,color:C.accent,letterSpacing:1.5}}>CLÍNICA MÉDICA • EVIDÊNCIAS</div></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {syncStatus&&<span style={{fontSize:10,color:syncStatus.includes("✅")?C.green:C.yellow}}>{syncStatus}</span>}
          {firebaseUser?.photoURL&&<img src={firebaseUser.photoURL} style={{width:28,height:28,borderRadius:"50%",border:`2px solid ${isAdmin?C.gold:C.accent}`}} alt=""/>}
          <Badge color={isAdmin?C.gold:C.accent}>{isAdmin?"👑":""} {alias.split(" ")[0]}</Badge>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:14,paddingBottom:82,animation:"fadeIn 0.3s ease"}}>
        {tab==="areas"&&<AreasModule uid={firebaseUser?.uid} firebaseAreas={firebaseAreas} firebasePatients={firebasePatients} onUpdatePatient={onUpdatePatient} onAddPatient={onAddPatient} onRemovePatient={onRemovePatient} onAddArea={onAddArea} onRemoveArea={onRemoveArea}/>}
        {tab==="plantao"&&<PlantaoTab/>}
        {tab==="chat"&&<ChatModule allPatients={firebasePatients||DB.get("patients")||[]} onUpdatePatient={p=>{if(onUpdatePatient)onUpdatePatient(p);}}/>}
        {tab==="daily"&&<DailyModule/>}
        {tab==="drug"&&<DrugModule/>}
        {tab==="prescriptions"&&<PrescriptionsModule uid={firebaseUser?.uid}/>}
        {tab==="upload"&&<UploadModule/>}
        {tab==="reports"&&<ReportsModule/>}
        {tab==="biblioteca"&&<BibliotecaModule uid={firebaseUser?.uid}/>}
        {tab==="cientista"&&<MedicoCientistaModule uid={firebaseUser?.uid}/>}
        {tab==="settings"&&<SettingsModule onReset={()=>setReady(false)} onLogout={onLogout} userProfile={userProfile} firebaseUser={firebaseUser}/>}
      </div>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:800,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",overflowX:"auto",zIndex:100}}>
        {TABS.map(t=>{
          const isPlantao=t.id==="plantao";
          const isActive=tab===t.id;
          return <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:"0 0 auto",minWidth:58,padding:"8px 4px 6px",background:isActive?(isPlantao?"rgba(246,173,85,0.15)":C.accentDim):"transparent",border:"none",borderTop:isActive?`2px solid ${isPlantao?C.gold:C.accent}`:"2px solid transparent",color:isActive?(isPlantao?C.gold:C.accent):isPlantao?"rgba(246,173,85,0.5)":C.textMuted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><span style={{fontSize:isPlantao?18:16}}>{t.icon}</span><span style={{fontSize:8,fontWeight:700,letterSpacing:0.3}}>{t.label}</span></button>;
        })}
      </div>
    </div>
  );
}
