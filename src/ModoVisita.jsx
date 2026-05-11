// ============================================================
// MODO VISITA — Preceptor Médico
// • Múltiplas abas de pacientes abertas simultaneamente
// • Laboratório comparativo (linhas=labs, colunas=datas)
// • Prescrição histórica dia a dia
// • Contador de dias de medicamento (D0/D1)
// • Cache offline em tempo real
// • Arquivar/excluir paciente
// • Modo Plantão — espaço rápido 12-24h
// ============================================================

import { useState, useRef, useEffect, useCallback } from "react";
import PatientChat from "./PatientChat";

const C = {
  bg:"#060c18",surface:"#0b1628",surface2:"#0f1f38",
  border:"rgba(99,179,237,0.1)",accent:"#63b3ed",accentDim:"rgba(99,179,237,0.12)",
  green:"#68d391",greenDim:"rgba(104,211,145,0.12)",
  red:"#fc8181",redDim:"rgba(252,129,129,0.12)",
  yellow:"#f6e05e",yellowDim:"rgba(246,224,94,0.12)",
  purple:"#b794f4",purpleDim:"rgba(183,148,244,0.12)",
  gold:"#f6ad55",goldDim:"rgba(246,173,85,0.12)",teal:"#4fd1c5",
  text:"#e8f4fd",textMuted:"#718096",textDim:"#2d3748",
};

const STATUS = {
  stable:{icon:"🟢",label:"Estável",color:C.green},
  attention:{icon:"🟡",label:"Atenção",color:C.yellow},
  critical:{icon:"🔴",label:"Crítico",color:C.red},
  intercurrence:{icon:"⚡",label:"Intercorrência",color:C.accent},
  resolved:{icon:"✅",label:"Resolvido",color:C.green},
  discharge:{icon:"🏠",label:"Alta possível",color:C.green},
  covering:{icon:"🔄",label:"Cobertura",color:C.textMuted},
};
const GENDER={M:"👨",F:"👩",O:"🧑"};

const LABS_CONFIG=[
  {key:"hb",label:"Hb",unit:"g/dL",low:12,high:17},
  {key:"ht",label:"Ht",unit:"%",low:36,high:50},
  {key:"leuco",label:"Leuco",unit:"k/µL",low:4,high:10},
  {key:"plaq",label:"Plaq",unit:"k/µL",low:150,high:400},
  {key:"cr",label:"Creatinina",unit:"mg/dL",low:0.6,high:1.2},
  {key:"ur",label:"Ureia",unit:"mg/dL",low:15,high:40},
  {key:"na",label:"Sódio",unit:"mEq/L",low:136,high:145},
  {key:"k",label:"Potássio",unit:"mEq/L",low:3.5,high:5.0},
  {key:"cl",label:"Cloro",unit:"mEq/L",low:98,high:107},
  {key:"glicemia",label:"Glicemia",unit:"mg/dL",low:70,high:140},
  {key:"pcr",label:"PCR",unit:"mg/L",low:0,high:5},
  {key:"ast",label:"AST",unit:"U/L",low:0,high:40},
  {key:"alt",label:"ALT",unit:"U/L",low:0,high:40},
  {key:"ldh",label:"LDH",unit:"U/L",low:0,high:250},
  {key:"lactato",label:"Lactato",unit:"mmol/L",low:0,high:2},
  {key:"tni",label:"TnI",unit:"ng/L",low:0,high:14},
  {key:"bnp",label:"BNP",unit:"pg/mL",low:0,high:100},
  {key:"inr",label:"INR",unit:"",low:0.8,high:1.2},
  {key:"fibri",label:"Fibrinogênio",unit:"mg/dL",low:200,high:400},
  {key:"ddimer",label:"D-dímero",unit:"ng/mL",low:0,high:500},
  {key:"gasph",label:"pH",unit:"",low:7.35,high:7.45},
  {key:"pco2",label:"pCO2",unit:"mmHg",low:35,high:45},
  {key:"hco3",label:"HCO3",unit:"mEq/L",low:22,high:26},
];

const diasInternamento=d=>d?Math.floor((Date.now()-new Date(d))/86400000):null;
const today=()=>new Date().toLocaleDateString("pt-BR");
const todayISO=()=>new Date().toISOString().split("T")[0];
const Cache={
  save:(k,v)=>{try{localStorage.setItem(`mv_${k}`,JSON.stringify({v,ts:Date.now()}))}catch{}},
  load:(k)=>{try{const d=localStorage.getItem(`mv_${k}`);return d?JSON.parse(d).v:null}catch{return null}},
};

function Sp({size=14}){return <div style={{width:size,height:size,border:`2px solid ${C.accent}33`,borderTop:`2px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block",flexShrink:0}}/>}
function Btn({onClick,disabled,variant="primary",children,style,size="md",full}){
  const v={primary:{background:`linear-gradient(135deg,${C.accent},#4299e1)`,color:"#fff",border:"none"},ghost:{background:C.accentDim,color:C.accent,border:`1px solid ${C.border}`},danger:{background:C.redDim,color:C.red,border:`1px solid ${C.red}33`},success:{background:C.greenDim,color:C.green,border:`1px solid ${C.green}33`},warning:{background:C.yellowDim,color:C.yellow,border:`1px solid ${C.yellow}33`},gold:{background:C.goldDim,color:C.gold,border:`1px solid ${C.gold}33`}};
  const s={sm:{padding:"4px 10px",fontSize:11},md:{padding:"8px 16px",fontSize:13},lg:{padding:"12px 22px",fontSize:14}};
  return <button onClick={onClick} disabled={disabled} style={{borderRadius:9,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1,transition:"all 0.15s",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6,width:full?"100%":undefined,justifyContent:full?"center":undefined,...v[variant],...s[size],...style}}>{children}</button>;
}
function Card({children,style,onClick}){return <div onClick={onClick} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:14,cursor:onClick?"pointer":"default",...style}}>{children}</div>}
function Input({value,onChange,onKeyDown,placeholder,type="text",style}){return <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:9,color:C.text,padding:"8px 12px",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box",...style}}/>}
function Badge({color=C.accent,children,style}){return <span style={{background:`${color}1a`,border:`1px solid ${color}33`,borderRadius:5,padding:"2px 7px",fontSize:11,color,fontWeight:700,...style}}>{children}</span>}

// ── LAB COMPARISON TABLE ──────────────────────────────────
function LabComparison({patient}){
  const history=patient.labHistory||[];
  const cur=patient.labs||{};
  const curDate=patient.labsDate?new Date(patient.labsDate).toLocaleDateString("pt-BR"):today();
  const allDates=[...new Set([curDate,...history.map(h=>h.date)])].slice(0,8);
  const rows=LABS_CONFIG.filter(l=>cur[l.key]||history.some(h=>h.labs?.[l.key]));
  if(!rows.length)return <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:20}}>Nenhum lab inserido ainda</div>;
  const getVal=(k,d)=>{if(d===curDate)return cur[k];const h=history.find(x=>x.date===d);return h?.labs?.[k];};
  const col=(k,v)=>{if(!v)return C.textMuted;const c=LABS_CONFIG.find(l=>l.key===k);const n=parseFloat(v);return c?(n>c.high?C.red:n<c.low?C.accent:C.green):C.text;};
  return(
    <div style={{overflowX:"auto"}}>
      <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
        <thead><tr>
          <th style={{textAlign:"left",padding:"5px 8px",color:C.textMuted,background:C.surface2,position:"sticky",left:0,minWidth:95,zIndex:1}}>Exame</th>
          <th style={{padding:"5px 4px",color:C.textMuted,background:C.surface2,minWidth:18,fontSize:10}}>Ref</th>
          {allDates.map(d=><th key={d} style={{padding:"5px 8px",color:d===curDate?C.accent:C.textMuted,fontWeight:d===curDate?800:600,background:C.surface2,minWidth:65,textAlign:"center",whiteSpace:"nowrap"}}>{d===curDate?"Hoje":d}</th>)}
        </tr></thead>
        <tbody>{rows.map((l,i)=>(
          <tr key={l.key} style={{background:i%2?C.surface2:C.surface}}>
            <td style={{padding:"4px 8px",color:C.text,fontWeight:600,position:"sticky",left:0,background:i%2?C.surface2:C.surface,zIndex:1}}>{l.label}</td>
            <td style={{padding:"4px 3px",color:C.textDim,fontSize:9,textAlign:"center"}}>{l.unit&&`${l.low}-${l.high}`}</td>
            {allDates.map(d=>{
              const v=getVal(l.key,d);const c=col(l.key,v);const n=parseFloat(v);const cfg=LABS_CONFIG.find(x=>x.key===l.key);
              const a=v&&cfg?(n>cfg.high?"↑":n<cfg.low?"↓":""):"";
              return <td key={d} style={{padding:"4px 8px",textAlign:"center",color:c,fontWeight:v?700:400,background:v&&c!==C.green?`${c}11`:"transparent"}}>{v?`${v}${a}`:"—"}</td>;
            })}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── PRESCRIPTION HISTORY ──────────────────────────────────
function PrescriptionHistory({patient,onUpdate}){
  const meds=patient.medications||[];
  const history=patient.medHistory||[];
  const allDates=[...new Set([today(),...history.map(h=>h.date)])].slice(0,7);
  const allNames=[...new Set([...meds.map(m=>m.name),...history.flatMap(h=>h.meds?.map(m=>m.name)||[])])].filter(Boolean);
  const get=(name,date)=>{
    if(date===today())return meds.find(m=>m.name===name);
    const h=history.find(h=>h.date===date);return h?.meds?.find(m=>m.name===name);
  };
  const snapshot=()=>{
    const snap={date:today(),meds:[...meds],labs:{...patient.labs||{}}};
    onUpdate({...patient,medHistory:[snap,...(history.filter(h=>h.date!==today()))].slice(0,30),labHistory:[{date:today(),labs:{...patient.labs||{}}},...(patient.labHistory||[]).filter(h=>h.date!==today())].slice(0,30)});
  };
  if(!allNames.length)return <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:20}}>Nenhum medicamento registrado</div>;
  return(
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
        <Btn onClick={snapshot} variant="ghost" size="sm">📸 Salvar snapshot de hoje</Btn>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
          <thead><tr>
            <th style={{textAlign:"left",padding:"5px 8px",color:C.textMuted,background:C.surface2,position:"sticky",left:0,minWidth:110,zIndex:1}}>Medicamento</th>
            {allDates.map(d=><th key={d} style={{padding:"5px 8px",color:d===today()?C.accent:C.textMuted,fontWeight:d===today()?800:600,background:C.surface2,minWidth:75,textAlign:"center",whiteSpace:"nowrap"}}>{d===today()?"Hoje":d}</th>)}
          </tr></thead>
          <tbody>{allNames.map((name,i)=>(
            <tr key={name} style={{background:i%2?C.surface2:C.surface}}>
              <td style={{padding:"5px 8px",color:C.text,fontWeight:600,position:"sticky",left:0,background:i%2?C.surface2:C.surface,zIndex:1,fontSize:11}}>{name}</td>
              {allDates.map(d=>{
                const m=get(name,d);
                return <td key={d} style={{padding:"4px 8px",textAlign:"center"}}>
                  {m?<div><div style={{color:m.isAtb?C.yellow:C.green,fontWeight:700,fontSize:11}}>{m.dose||"✓"}</div>{m.schedule&&<div style={{color:C.textMuted,fontSize:10}}>{m.schedule}</div>}{m.isAtb&&<Badge color={C.yellow} style={{fontSize:10}}>D{m.atbDay||"?"}</Badge>}</div>:<span style={{color:C.textDim}}>—</span>}
                </td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── VITALS PANEL ──────────────────────────────────────────
function VitaisPanel({patient,onUpdate}){
  const [editing,setEditing]=useState(false);
  const v=patient.vitals||{};
  const [form,setForm]=useState(v);
  const save=()=>{onUpdate({...patient,vitals:form,vitalsDate:new Date().toISOString()});setEditing(false);};
  const VCFG=[{key:"pas",label:"PAS",unit:"mmHg"},{key:"pad",label:"PAD",unit:"mmHg"},{key:"fc",label:"FC",unit:"bpm"},{key:"fr",label:"FR",unit:"irpm"},{key:"spo2",label:"SpO2",unit:"%"},{key:"temp",label:"T°C",unit:"°C"}];
  const getC=(k,val)=>{const n=parseFloat(val);const a={pas:[90,160],pad:[60,100],fc:[60,100],fr:[0,20],spo2:[94,100],temp:[36,37.8]};const[lo,hi]=a[k]||[0,Infinity];return n>hi?C.red:n<lo?C.accent:C.green;};
  return(
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontSize:11,color:C.teal,fontWeight:700,letterSpacing:1}}>💉 VITAIS HOJE</div>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          {patient.vitalsDate&&<span style={{fontSize:10,color:C.textDim}}>{new Date(patient.vitalsDate).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>}
          {editing&&<button onClick={save} style={{background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:6,color:C.green,padding:"3px 7px",cursor:"pointer",fontSize:11,fontWeight:700}}>Salvar</button>}
          <button onClick={()=>{setForm(v);setEditing(!editing);}} style={{background:editing?C.redDim:C.accentDim,border:`1px solid ${editing?C.red:C.border}`,borderRadius:6,color:editing?C.red:C.accent,padding:"3px 7px",cursor:"pointer",fontSize:11,fontWeight:700}}>{editing?"✕":"✏️"}</button>
        </div>
      </div>
      {editing?(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
          {VCFG.map(vc=><div key={vc.key}><div style={{fontSize:9,color:C.textMuted,marginBottom:2}}>{vc.label}</div><Input value={form[vc.key]||""} onChange={e=>setForm(f=>({...f,[vc.key]:e.target.value}))} type="number" style={{fontSize:14,padding:"5px 7px",textAlign:"center"}}/></div>)}
          <div style={{gridColumn:"1/-1"}}><div style={{fontSize:9,color:C.textMuted,marginBottom:2}}>Diurese (mL)</div><Input value={form.diurese||""} onChange={e=>setForm(f=>({...f,diurese:e.target.value}))} type="number"/></div>
          <div style={{gridColumn:"1/-1"}}><Input value={form.obs||""} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} placeholder="Obs (O2, IOT, VM...)"/></div>
        </div>
      ):(
        Object.keys(v).length===0?<div style={{color:C.textDim,fontSize:12,textAlign:"center",padding:"6px 0"}}>Toque em ✏️ para adicionar vitais</div>:(
          <div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {VCFG.filter(vc=>v[vc.key]).map(vc=>{const c=getC(vc.key,v[vc.key]);const n=parseFloat(v[vc.key]);const a={pas:[90,160],pad:[60,100],fc:[60,100],fr:[0,20],spo2:[94,100],temp:[36,37.8]};const[lo,hi]=a[vc.key]||[0,Infinity];const arrow=n>hi?"↑":n<lo?"↓":"";return(<div key={vc.key} style={{background:`${c}11`,border:`1px solid ${c}33`,borderRadius:7,padding:"4px 8px",textAlign:"center",minWidth:55}}><div style={{fontSize:9,color:C.textMuted}}>{vc.label}</div><div style={{fontSize:13,fontWeight:800,color:c}}>{v[vc.key]}{arrow}</div><div style={{fontSize:8,color:C.textDim}}>{vc.unit}</div></div>);})}
              {v.diurese&&<div style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:7,padding:"4px 8px",textAlign:"center",minWidth:55}}><div style={{fontSize:9,color:C.textMuted}}>Diurese</div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{v.diurese}</div><div style={{fontSize:8,color:C.textDim}}>mL</div></div>}
            </div>
            {v.obs&&<div style={{fontSize:11,color:C.yellow,marginTop:5}}>⚠️ {v.obs}</div>}
          </div>
        )
      )}
    </div>
  );
}

// ── LABS PANEL ────────────────────────────────────────────
function LabsPanel({patient,onUpdate}){
  const [editing,setEditing]=useState(false);
  const labs=patient.labs||{};
  const [form,setForm]=useState(labs);
  const save=()=>{
    const snap={date:today(),labs:{...labs}};
    const labHistory=[snap,...(patient.labHistory||[]).filter(h=>h.date!==today())].slice(0,30);
    onUpdate({...patient,labs:form,labsDate:new Date().toISOString(),labHistory});
    setEditing(false);
  };
  const filled=LABS_CONFIG.filter(l=>labs[l.key]);
  return(
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontSize:11,color:C.purple,fontWeight:700,letterSpacing:1}}>🧪 LABORATÓRIO</div>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          {patient.labsDate&&<span style={{fontSize:10,color:C.textDim}}>{new Date(patient.labsDate).toLocaleDateString("pt-BR")}</span>}
          {editing&&<button onClick={save} style={{background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:6,color:C.green,padding:"3px 7px",cursor:"pointer",fontSize:11,fontWeight:700}}>Salvar</button>}
          <button onClick={()=>{setForm(labs);setEditing(!editing);}} style={{background:editing?C.redDim:C.accentDim,border:`1px solid ${editing?C.red:C.border}`,borderRadius:6,color:editing?C.red:C.accent,padding:"3px 7px",cursor:"pointer",fontSize:11,fontWeight:700}}>{editing?"✕":"✏️"}</button>
        </div>
      </div>
      {editing?(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
          {LABS_CONFIG.map(l=><div key={l.key}><div style={{fontSize:9,color:C.textMuted,marginBottom:2}}>{l.label}{l.unit&&` (${l.unit})`}</div><Input value={form[l.key]||""} onChange={e=>setForm(f=>({...f,[l.key]:e.target.value}))} style={{fontSize:12,padding:"5px 6px",textAlign:"center"}}/></div>)}
        </div>
      ):(
        filled.length===0?<div style={{color:C.textDim,fontSize:12,textAlign:"center",padding:"6px 0"}}>Toque em ✏️ para inserir labs</div>:(
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {filled.map(l=>{const n=parseFloat(labs[l.key]);const isH=n>l.high;const isL=n<l.low;const c=isH?C.red:isL?C.accent:C.green;return(<div key={l.key} style={{background:`${c}11`,border:`1px solid ${c}33`,borderRadius:7,padding:"4px 8px",textAlign:"center",minWidth:54}}><div style={{fontSize:9,color:C.textMuted}}>{l.label}</div><div style={{fontSize:13,fontWeight:800,color:c}}>{labs[l.key]}{isH?"↑":isL?"↓":""}</div>{l.unit&&<div style={{fontSize:8,color:C.textDim}}>{l.unit}</div>}</div>);})}
          </div>
        )
      )}
    </div>
  );
}

// ── MEDS PANEL ────────────────────────────────────────────
function MedsPanel({patient,onUpdate}){
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({name:"",dose:"",route:"",schedule:"",isAtb:false,startDate:todayISO(),dayBase:"D1"});
  const meds=patient.medications||[];
  const calcDay=(start,base)=>{if(!start)return null;const d=Math.floor((Date.now()-new Date(start))/86400000);return base==="D0"?d:d+1;};
  const add=()=>{
    if(!form.name.trim())return;
    const med={...form,id:Date.now().toString(),atbDay:form.isAtb?calcDay(form.startDate,form.dayBase)?.toString():""};
    onUpdate({...patient,medications:[...meds,med]});
    setForm({name:"",dose:"",route:"",schedule:"",isAtb:false,startDate:todayISO(),dayBase:"D1"});setAdding(false);
  };
  const remove=id=>onUpdate({...patient,medications:meds.filter(m=>m.id!==id)});
  const atbs=meds.filter(m=>m.isAtb);const others=meds.filter(m=>!m.isAtb);
  return(
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontSize:11,color:C.yellow,fontWeight:700,letterSpacing:1}}>💊 MEDICAMENTOS</div>
        <button onClick={()=>setAdding(!adding)} style={{background:adding?C.redDim:C.accentDim,border:`1px solid ${adding?C.red:C.border}`,borderRadius:6,color:adding?C.red:C.accent,padding:"3px 8px",cursor:"pointer",fontSize:11,fontWeight:700}}>{adding?"✕":"+ Add"}</button>
      </div>
      {atbs.map(m=>{const day=m.startDate?calcDay(m.startDate,m.dayBase||"D1"):m.atbDay;return(
        <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:9,marginBottom:5}}>
          <span style={{fontSize:14}}>🦠</span>
          <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,color:C.yellow,fontSize:12}}>{m.name}</div><div style={{fontSize:11,color:C.textMuted}}>{m.dose}{m.route&&` · ${m.route}`}{m.schedule&&` · ${m.schedule}`}</div></div>
          <Badge color={C.yellow}>D{day||"?"}</Badge>
          <button onClick={()=>remove(m.id)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:13}}>✕</button>
        </div>
      );})}
      {others.map(m=>(
        <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 9px",background:C.surface2,border:`1px solid ${C.border}`,borderRadius:7,marginBottom:4}}>
          <span style={{fontSize:13}}>💊</span>
          <div style={{flex:1,minWidth:0,fontSize:12}}><span style={{fontWeight:600,color:C.text}}>{m.name}</span><span style={{color:C.textMuted}}> {m.dose}{m.route&&` · ${m.route}`}{m.schedule&&` · ${m.schedule}`}</span></div>
          <button onClick={()=>remove(m.id)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:13}}>✕</button>
        </div>
      ))}
      {meds.length===0&&!adding&&<div style={{color:C.textDim,fontSize:12,textAlign:"center",padding:"5px 0"}}>Nenhum medicamento</div>}
      {adding&&(
        <div style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:10,marginTop:6}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:6}}>
            <Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Medicamento *"/>
            <Input value={form.dose} onChange={e=>setForm(f=>({...f,dose:e.target.value}))} placeholder="Dose"/>
            <Input value={form.route} onChange={e=>setForm(f=>({...f,route:e.target.value}))} placeholder="Via (EV, VO...)"/>
            <Input value={form.schedule} onChange={e=>setForm(f=>({...f,schedule:e.target.value}))} placeholder="Horário (8/8h...)"/>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:C.textMuted,marginBottom:6}}>
            <input type="checkbox" checked={form.isAtb} onChange={e=>setForm(f=>({...f,isAtb:e.target.checked}))} style={{accentColor:C.yellow}}/>
            🦠 ATB / uso prolongado (contagem de dias)
          </label>
          {form.isAtb&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
              <div><div style={{fontSize:10,color:C.textMuted,marginBottom:2}}>Data início</div><Input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))}/></div>
              <div><div style={{fontSize:10,color:C.textMuted,marginBottom:2}}>Base</div>
                <select value={form.dayBase} onChange={e=>setForm(f=>({...f,dayBase:e.target.value}))} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"7px 8px",fontSize:12,width:"100%"}}>
                  <option value="D1">D1 (1º dia = D1)</option>
                  <option value="D0">D0 (1º dia = D0)</option>
                </select>
              </div>
              <div><div style={{fontSize:10,color:C.textMuted,marginBottom:2}}>Dia atual</div><div style={{padding:"8px 10px",background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:8,fontSize:14,fontWeight:800,color:C.yellow,textAlign:"center"}}>D{calcDay(form.startDate,form.dayBase)||"?"}</div></div>
            </div>
          )}
          <Btn onClick={add} disabled={!form.name.trim()} size="sm" full>+ Adicionar</Btn>
        </div>
      )}
    </div>
  );
}

// ── LAB AREA TABLE ────────────────────────────────────────
function LabAreaTable({patients}){
  const pts=patients.filter(p=>Object.keys(p.labs||{}).length>0);
  if(!pts.length)return <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:20}}>Nenhum lab nos pacientes desta área</div>;
  const keys=[...new Set(pts.flatMap(p=>Object.keys(p.labs||{})))];
  return(
    <div style={{overflowX:"auto"}}>
      <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
        <thead><tr>
          <th style={{textAlign:"left",padding:"5px 8px",color:C.textMuted,background:C.surface2,position:"sticky",left:0,minWidth:85,zIndex:1}}>Exame</th>
          {pts.map(p=><th key={p.id} style={{textAlign:"center",padding:"5px 8px",color:C.accent,fontWeight:700,background:C.surface2,minWidth:80,whiteSpace:"nowrap"}}><div>{p.name.split(" ")[0]}</div><div style={{fontSize:10,color:C.textMuted,fontWeight:400}}>L{p.bed||"?"}</div></th>)}
        </tr></thead>
        <tbody>{keys.map((key,i)=>{
          const cfg=LABS_CONFIG.find(l=>l.key===key);
          return <tr key={key} style={{background:i%2?C.surface2:C.surface}}>
            <td style={{padding:"4px 8px",color:C.text,fontWeight:600,position:"sticky",left:0,background:i%2?C.surface2:C.surface,zIndex:1}}>{cfg?.label||key}</td>
            {pts.map(p=>{const v=p.labs?.[key];const n=parseFloat(v);const c=cfg?(n>cfg.high?C.red:n<cfg.low?C.accent:C.green):C.text;const a=v&&cfg?(n>cfg.high?"↑":n<cfg.low?"↓":""):"";return <td key={p.id} style={{padding:"4px 8px",textAlign:"center",color:v?c:C.textDim,fontWeight:v?700:400,background:v&&c!==C.green?`${c}11`:"transparent"}}>{v?`${v}${a}`:"—"}</td>;})}
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

// ── VISIT CARD ────────────────────────────────────────────
function VisitCard({patient,onUpdate,onNext,onPrev,totalPatients,currentIndex,onArchive,onDelete}){
  const [tab,setTab]=useState("resumo");
  const [showChat,setShowChat]=useState(false);
  const [showReports,setShowReports]=useState(false);
  const [reportResult,setReportResult]=useState("");
  const [reportLoading,setReportLoading]=useState(false);
  const [showActions,setShowActions]=useState(false);
  const [newPending,setNewPending]=useState("");
  const st=STATUS[patient.status]||STATUS.stable;
  const dias=diasInternamento(patient.admissionDate);
  const pending=patient.pending||[];
  const atbs=(patient.medications||[]).filter(m=>m.isAtb);

  const TABS=[{id:"resumo",label:"📋"},{id:"labs",label:"🧪"},{id:"prescricao",label:"💊"},{id:"chat",label:"💬"}];

  if(showChat)return <div style={{height:"calc(100vh - 200px)",display:"flex",flexDirection:"column"}}><PatientChat patient={patient} onUpdate={onUpdate} onClose={()=>setShowChat(false)}/></div>;

  const genReport=async(type)=>{
    setReportLoading(true);setReportResult("");
    const P={exam:"Solicitar exame:",inter:"Nota SOAP intercorrência:",transfer:"Nota de transferência:",discharge:"Resumo de alta:",referral:"Solicitar parecer:"};
    const ctx=`${patient.name}, ${patient.age||"?"}a, L${patient.bed||"—"}, D${dias||"?"}\n${patient.summary||""}\nImpressão: ${patient.clinicalImpression||"—"}\nPendências: ${pending.join("; ")||"nenhuma"}`;
    try{
      const key=localStorage.getItem("geminiKey");const model=localStorage.getItem("geminiModel")||"gemini-2.5-flash";
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:`${P[type]}\n\n${ctx}\n\nDocumento completo, formal, PT-BR, data ${today()}.`}]}],generationConfig:{maxOutputTokens:1200,temperature:0.2}})});
      const d=await res.json();if(d.error)throw new Error(d.error.message);
      setReportResult(d.candidates?.[0]?.content?.parts?.[0]?.text||"");
    }catch(e){setReportResult("⚠️ "+e.message);}
    setReportLoading(false);
  };

  const addPending=()=>{if(!newPending.trim())return;onUpdate({...patient,pending:[...pending,newPending.trim()]});setNewPending("");};
  const removePending=i=>{const p=[...pending];p.splice(i,1);onUpdate({...patient,pending:p});};

  const calcDay=(m)=>m.startDate?Math.floor((Date.now()-new Date(m.startDate))/86400000)+(m.dayBase==="D0"?0:1):m.atbDay;

  return(
    <div style={{animation:"fadeIn 0.2s ease"}}>
      {/* Header */}
      <div style={{background:C.surface2,border:`1px solid ${st.color}44`,borderRadius:14,padding:12,marginBottom:8,borderLeft:`4px solid ${st.color}`}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <div style={{fontSize:26,lineHeight:1}}>{GENDER[patient.gender]||"🧑"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:900,color:C.text,fontSize:16}}>{patient.name}</div>
            <div style={{fontSize:11,color:C.textMuted,marginTop:1}}>{patient.age&&`${patient.age}a`}{patient.bed&&` · L${patient.bed}`}{dias!==null&&` · D${dias}`}</div>
            <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
              <Badge color={st.color}>{st.icon} {st.label}</Badge>
              {atbs.map(m=><Badge key={m.id} color={C.yellow}>🦠 D{calcDay(m)||"?"}</Badge>)}
              {pending.length>0&&<Badge color={C.yellow}>⏳{pending.length}</Badge>}
            </div>
            {patient.comorbidities&&<div style={{fontSize:11,color:C.textMuted,marginTop:4}}>🏥 {patient.comorbidities}</div>}
          </div>
          <div style={{position:"relative",flexShrink:0}}>
            <button onClick={()=>setShowActions(!showActions)} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:8,color:C.accent,padding:"5px 9px",cursor:"pointer",fontSize:16}}>⋮</button>
            {showActions&&(
              <div onClick={()=>setShowActions(false)} style={{position:"absolute",right:0,top:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:6,zIndex:200,minWidth:150,boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
                <button onClick={()=>onArchive(patient)} style={{display:"block",width:"100%",background:"none",border:"none",color:C.yellow,padding:"7px 10px",cursor:"pointer",fontSize:13,textAlign:"left",fontFamily:"inherit"}}>📦 Arquivar</button>
                <button onClick={()=>{if(window.confirm(`Excluir ${patient.name}?`))onDelete(patient.id);}} style={{display:"block",width:"100%",background:"none",border:"none",color:C.red,padding:"7px 10px",cursor:"pointer",fontSize:13,textAlign:"left",fontFamily:"inherit"}}>🗑️ Excluir</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs internas compactas */}
      <div style={{display:"flex",gap:0,marginBottom:10,background:C.surface2,borderRadius:10,padding:3,border:`1px solid ${C.border}`}}>
        {TABS.map(t=><button key={t.id} onClick={()=>{setTab(t.id);if(t.id==="chat")setShowChat(true);}} style={{flex:1,padding:"7px 4px",background:tab===t.id?C.accent:"transparent",border:"none",borderRadius:8,color:tab===t.id?"#fff":C.textMuted,fontSize:14,fontWeight:700,cursor:"pointer"}}>{t.label}</button>)}
      </div>

      {/* RESUMO */}
      {tab==="resumo"&&(
        <div>
          <Card style={{marginBottom:8,padding:10}}><VitaisPanel patient={patient} onUpdate={onUpdate}/></Card>
          <Card style={{marginBottom:8,padding:10}}><LabsPanel patient={patient} onUpdate={onUpdate}/></Card>
          <Card style={{marginBottom:8,padding:10}}><MedsPanel patient={patient} onUpdate={onUpdate}/></Card>
          {/* Pendências */}
          <div style={{background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:10,padding:"8px 12px",marginBottom:8}}>
            <div style={{fontSize:10,color:C.yellow,fontWeight:700,letterSpacing:1,marginBottom:6}}>⏳ PENDÊNCIAS ({pending.length})</div>
            {pending.map((p,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"3px 0",borderBottom:i<pending.length-1?`1px solid ${C.yellow}11`:"none"}}>
                <span style={{flex:1,fontSize:12,color:C.text}}>• {p}</span>
                <button onClick={()=>removePending(i)} style={{background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:5,color:C.green,padding:"1px 6px",cursor:"pointer",fontSize:11}}>✓</button>
              </div>
            ))}
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <input value={newPending} onChange={e=>setNewPending(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPending()} placeholder="+ Nova pendência..." style={{flex:1,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.yellow}33`,borderRadius:7,color:C.text,padding:"6px 10px",fontSize:12,fontFamily:"inherit"}}/>
              <button onClick={addPending} style={{background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:7,color:C.yellow,padding:"6px 10px",cursor:"pointer",fontSize:12,fontWeight:700}}>+</button>
            </div>
          </div>
          {/* Impressão */}
          {patient.clinicalImpression&&<div style={{background:C.accentDim,border:`1px solid ${C.accent}33`,borderRadius:10,padding:"8px 12px",marginBottom:8}}><div style={{fontSize:10,color:C.accent,fontWeight:700,marginBottom:4}}>🧠 IMPRESSÃO</div><div style={{fontSize:12,color:C.text,lineHeight:1.6}}>{patient.clinicalImpression}</div></div>}
          {/* Relatórios */}
          <div style={{marginBottom:8}}>
            <button onClick={()=>setShowReports(!showReports)} style={{width:"100%",background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,color:C.textMuted,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",display:"flex",justifyContent:"space-between"}}>
              <span>📄 Relatórios rápidos</span><span>{showReports?"▲":"▼"}</span>
            </button>
            {showReports&&(
              <div style={{background:C.surface2,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 9px 9px",padding:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:6}}>
                  {[{id:"exam",icon:"🔬",label:"Exame"},{id:"inter",icon:"⚡",label:"Intercorrência"},{id:"transfer",icon:"🚑",label:"Transferência"},{id:"discharge",icon:"🏠",label:"Alta"},{id:"referral",icon:"📨",label:"Parecer"}].map(r=>(
                    <button key={r.id} onClick={()=>genReport(r.id)} disabled={reportLoading} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"6px 5px",cursor:"pointer",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"}}>{r.icon} {r.label}</button>
                  ))}
                </div>
                {reportLoading&&<div style={{color:C.accent,fontSize:12}}><Sp size={12}/> Gerando...</div>}
                {reportResult&&<div><div style={{background:C.surface,borderRadius:8,padding:10,fontSize:12,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap",maxHeight:180,overflowY:"auto",marginBottom:6}}>{reportResult}</div><div style={{display:"flex",gap:5}}><Btn onClick={()=>navigator.clipboard.writeText(reportResult)} variant="ghost" size="sm">📋</Btn><Btn onClick={()=>setReportResult("")} variant="danger" size="sm">✕</Btn></div></div>}
              </div>
            )}
          </div>
          {/* Histórico colapsável */}
          {patient.history&&<details style={{marginBottom:6}}><summary style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"7px 12px",cursor:"pointer",fontSize:12,color:C.textMuted,fontWeight:700,listStyle:"none",display:"flex",justifyContent:"space-between"}}><span>📖 História</span><span>▼</span></summary><div style={{background:C.surface2,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 9px 9px",padding:"10px 12px",fontSize:12,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{patient.history}</div></details>}
          {patient.hospitalCourse&&<details style={{marginBottom:6}}><summary style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"7px 12px",cursor:"pointer",fontSize:12,color:C.textMuted,fontWeight:700,listStyle:"none",display:"flex",justifyContent:"space-between"}}><span>🏥 Evolução hospitalar</span><span>▼</span></summary><div style={{background:C.surface2,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 9px 9px",padding:"10px 12px",fontSize:12,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{patient.hospitalCourse}</div></details>}
        </div>
      )}

      {/* LABS COMPARATIVO */}
      {tab==="labs"&&<Card style={{padding:10}}><div style={{fontSize:11,color:C.purple,fontWeight:700,marginBottom:10}}>🧪 LABS COMPARATIVO</div><LabComparison patient={patient}/></Card>}

      {/* PRESCRIÇÃO HISTÓRICA */}
      {tab==="prescricao"&&<Card style={{padding:10}}><div style={{fontSize:11,color:C.yellow,fontWeight:700,marginBottom:10}}>💊 HISTÓRICO DE PRESCRIÇÕES</div><PrescriptionHistory patient={patient} onUpdate={onUpdate}/></Card>}

      {/* Nav entre pacientes */}
      {totalPatients>1&&(
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <Btn onClick={onPrev} variant="ghost" style={{flex:1}} disabled={currentIndex===0}>← Anterior</Btn>
          <div style={{display:"flex",alignItems:"center",fontSize:12,color:C.textMuted,fontWeight:700,minWidth:36,justifyContent:"center"}}>{currentIndex+1}/{totalPatients}</div>
          <Btn onClick={onNext} variant="ghost" style={{flex:1}} disabled={currentIndex===totalPatients-1}>Próximo →</Btn>
        </div>
      )}
    </div>
  );
}

// ── MODO PLANTÃO ──────────────────────────────────────────
function ModoPlatao({onClose}){
  const [patients,setPatients]=useState(()=>Cache.load("plantao")||[]);
  const [selectedId,setSelectedId]=useState(null);
  const [showNew,setShowNew]=useState(false);
  const [form,setForm]=useState({name:"",age:"",gender:"M",bed:"",status:"stable",summary:"",comorbidities:""});
  const save=p=>{Cache.save("plantao",p);setPatients(p);};
  const add=()=>{
    if(!form.name.trim())return;
    const np={...form,id:Date.now().toString(),areaId:"plantao",createdAt:new Date().toISOString(),medications:[],pending:[],labs:{},vitals:{}};
    const updated=[...patients,np];save(updated);setShowNew(false);setForm({name:"",age:"",gender:"M",bed:"",status:"stable",summary:"",comorbidities:""});setSelectedId(np.id);
  };
  const update=p=>{const u=patients.map(x=>x.id===p.id?p:x);save(u);};
  const remove=id=>{const u=patients.filter(x=>x.id!==id);save(u);if(selectedId===id)setSelectedId(u[0]?.id||null);};
  const current=patients.find(p=>p.id===selectedId);
  const idx=patients.findIndex(p=>p.id===selectedId);

  return(
    <div style={{animation:"fadeIn 0.3s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <button onClick={onClose} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:8,color:C.accent,padding:"6px 11px",cursor:"pointer",fontSize:13}}>← Voltar</button>
        <div style={{fontWeight:900,color:C.gold,fontSize:16,flex:1}}>⚡ Modo Plantão</div>
        <Badge color={C.gold}>{patients.length}p</Badge>
        <Btn onClick={()=>setShowNew(true)} variant="gold" size="sm">+ Paciente</Btn>
        {patients.length>0&&<Btn onClick={()=>{if(window.confirm("Limpar plantão?"))save([]);setSelectedId(null);}} variant="danger" size="sm">🗑️</Btn>}
      </div>
      <div style={{background:C.goldDim,border:`1px solid ${C.gold}33`,borderRadius:10,padding:"8px 12px",marginBottom:12,fontSize:12,color:C.gold}}>
        ⚡ Espaço provisório para plantão 12-24h — salvo localmente no dispositivo
      </div>
      {showNew&&(
        <Card style={{marginBottom:12,border:`1px solid ${C.gold}44`}}>
          <div style={{fontWeight:700,color:C.gold,marginBottom:10}}>Novo Paciente</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
            <Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nome *"/>
            <Input value={form.age} onChange={e=>setForm(f=>({...f,age:e.target.value}))} placeholder="Idade" type="number"/>
            <Input value={form.bed} onChange={e=>setForm(f=>({...f,bed:e.target.value}))} placeholder="Leito"/>
            <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"7px 9px",fontSize:13}}>
              {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          <Input value={form.comorbidities} onChange={e=>setForm(f=>({...f,comorbidities:e.target.value}))} placeholder="Comorbidades" style={{marginBottom:5}}/>
          <Input value={form.summary} onChange={e=>setForm(f=>({...f,summary:e.target.value}))} placeholder="Diagnóstico / motivo" style={{marginBottom:8}}/>
          <div style={{display:"flex",gap:8}}><Btn onClick={add} size="sm" variant="gold">Adicionar</Btn><Btn onClick={()=>setShowNew(false)} variant="ghost" size="sm">Cancelar</Btn></div>
        </Card>
      )}
      {patients.length>0&&(
        <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:10,paddingBottom:4}}>
          {patients.map(p=>{const st=STATUS[p.status]||STATUS.stable;return(
            <button key={p.id} onClick={()=>setSelectedId(p.id)} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,cursor:"pointer",border:`2px solid ${selectedId===p.id?st.color:C.border}`,background:selectedId===p.id?`${st.color}22`:"transparent",color:selectedId===p.id?st.color:C.textMuted,fontSize:12,fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>
              {st.icon} {p.name.split(" ")[0]}{p.bed&&` (${p.bed})`}
            </button>
          );})}
        </div>
      )}
      {current&&<VisitCard patient={current} onUpdate={update} onNext={()=>{if(idx<patients.length-1)setSelectedId(patients[idx+1].id);}} onPrev={()=>{if(idx>0)setSelectedId(patients[idx-1].id);}} totalPatients={patients.length} currentIndex={idx} onArchive={()=>{}} onDelete={remove}/>}
      {patients.length===0&&!showNew&&(
        <div style={{textAlign:"center",color:C.textMuted,padding:40}}>
          <div style={{fontSize:36,marginBottom:12}}>⚡</div>
          <div style={{fontSize:14,marginBottom:16}}>Nenhum paciente no plantão</div>
          <Btn onClick={()=>setShowNew(true)} variant="gold">+ Adicionar paciente</Btn>
        </div>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────
export default function ModoVisita({patients:init,area,onUpdatePatient,onBack,onEditPatient}){
  const [patients,setPatients]=useState(init);
  const [openTabs,setOpenTabs]=useState([]);
  const [activeTab,setActiveTab]=useState(null);
  const [viewMode,setViewMode]=useState("list");
  const [search,setSearch]=useState("");
  const [showArchived,setShowArchived]=useState(false);
  const touchStart=useRef(null);

  useEffect(()=>{setPatients(init);},[init]);

  const syncUpdate=useCallback(p=>{
    setPatients(prev=>prev.map(x=>x.id===p.id?p:x));
    Cache.save(`pt_${p.id}`,p);
    if(onUpdatePatient)onUpdatePatient(p);
  },[onUpdatePatient]);

  const archive=useCallback(p=>{
    syncUpdate({...p,archived:true,archivedAt:new Date().toISOString()});
    setOpenTabs(t=>t.filter(id=>id!==p.id));
    if(activeTab===p.id)setActiveTab(null);
  },[syncUpdate,activeTab]);

  const remove=useCallback(id=>{
    setPatients(prev=>prev.filter(p=>p.id!==id));
    setOpenTabs(t=>t.filter(x=>x!==id));
    if(activeTab===id){setActiveTab(null);setViewMode("list");}
  },[activeTab]);

  const openTab=useCallback(p=>{
    setOpenTabs(tabs=>[...new Set([...tabs,p.id])].slice(-6));
    setActiveTab(p.id);setViewMode("visit");
  },[]);

  const closeTab=useCallback((id,e)=>{
    e?.stopPropagation();
    const remaining=openTabs.filter(t=>t!==id);
    setOpenTabs(remaining);
    if(activeTab===id){setActiveTab(remaining[remaining.length-1]||null);if(!remaining.length)setViewMode("list");}
  },[activeTab,openTabs]);

  const sorted=[...patients.filter(p=>!p.archived)].sort((a,b)=>{const o={critical:0,intercurrence:1,attention:2,stable:3,discharge:4,covering:5};return(o[a.status]||3)-(o[b.status]||3);});
  const filtered=sorted.filter(p=>!search||p.name?.toLowerCase().includes(search.toLowerCase())||(p.bed||"").toLowerCase().includes(search.toLowerCase()));
  const archived=patients.filter(p=>p.archived);
  const activePatient=patients.find(p=>p.id===activeTab);

  const hTS=e=>{touchStart.current=e.touches[0].clientX;};
  const hTE=e=>{
    if(!touchStart.current||viewMode!=="visit"||openTabs.length<2)return;
    const diff=touchStart.current-e.changedTouches[0].clientX;
    if(Math.abs(diff)>60){const i=openTabs.indexOf(activeTab);if(diff>0&&i<openTabs.length-1)setActiveTab(openTabs[i+1]);else if(diff<0&&i>0)setActiveTab(openTabs[i-1]);}
    touchStart.current=null;
  };

  if(viewMode==="plantao")return <ModoPlatao onClose={()=>setViewMode("list")}/>;

  return(
    <div style={{animation:"fadeIn 0.3s ease"}} onTouchStart={hTS} onTouchEnd={hTE}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}details>summary{outline:none;user-select:none}`}</style>

      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:8,color:C.accent,padding:"6px 11px",cursor:"pointer",fontSize:13}}>← {area?.name||"Áreas"}</button>
        <div style={{fontWeight:800,color:C.text,fontSize:14,flex:1}}>{area?.icon} {area?.name}</div>
        <Badge color={C.textMuted}>{filtered.length}p</Badge>
        <Btn onClick={()=>setViewMode("plantao")} variant="gold" size="sm">⚡ Plantão</Btn>
      </div>

      {/* Barra de abas */}
      {openTabs.length>0&&(
        <div style={{display:"flex",gap:0,overflowX:"auto",background:C.surface2,borderRadius:"10px 10px 0 0",border:`1px solid ${C.border}`,borderBottom:"none",marginBottom:0}}>
          <button onClick={()=>{setViewMode("list");}} style={{padding:"6px 10px",background:viewMode==="list"?C.bg:"transparent",border:"none",borderBottom:viewMode==="list"?`2px solid ${C.accent}`:"2px solid transparent",color:viewMode==="list"?C.accent:C.textMuted,cursor:"pointer",fontSize:11,fontWeight:700,flexShrink:0}}>📋</button>
          <button onClick={()=>setViewMode("labs")} style={{padding:"6px 10px",background:viewMode==="labs"?C.bg:"transparent",border:"none",borderBottom:viewMode==="labs"?`2px solid ${C.purple}`:"2px solid transparent",color:viewMode==="labs"?C.purple:C.textMuted,cursor:"pointer",fontSize:11,fontWeight:700,flexShrink:0}}>🧪 Área</button>
          {openTabs.map(id=>{
            const p=patients.find(x=>x.id===id);if(!p)return null;
            const st=STATUS[p.status]||STATUS.stable;const isActive=activeTab===id&&viewMode==="visit";
            return(
              <button key={id} onClick={()=>{setActiveTab(id);setViewMode("visit");}} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 10px",background:isActive?C.bg:"transparent",border:"none",borderBottom:isActive?`2px solid ${st.color}`:"2px solid transparent",color:isActive?st.color:C.textMuted,cursor:"pointer",fontSize:11,fontWeight:700,flexShrink:0,maxWidth:110}}>
                <span>{st.icon}</span>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:60}}>{p.name.split(" ")[0]}</span>
                <span onClick={e=>closeTab(id,e)} style={{fontSize:12,opacity:0.5,marginLeft:1}}>✕</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lista */}
      {(viewMode==="list"||(viewMode==="visit"&&!activePatient))&&(
        <div style={{marginTop:openTabs.length?0:0}}>
          <div style={{display:"flex",gap:8,margin:"10px 0"}}>
            <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Nome, leito..." style={{flex:1}}/>
          </div>
          {filtered.map(p=>{
            const st=STATUS[p.status]||STATUS.stable;const dias=diasInternamento(p.admissionDate);
            const atbs=(p.medications||[]).filter(m=>m.isAtb);const calcDay=m=>m.startDate?Math.floor((Date.now()-new Date(m.startDate))/86400000)+(m.dayBase==="D0"?0:1):m.atbDay;
            return(
              <div key={p.id} onClick={()=>openTab(p)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:openTabs.includes(p.id)?`${st.color}11`:C.surface,border:`1px solid ${openTabs.includes(p.id)?st.color+"44":st.color+"22"}`,borderLeft:`4px solid ${st.color}`,borderRadius:11,marginBottom:7,cursor:"pointer"}}>
                <div style={{fontSize:22}}>{GENDER[p.gender]||"🧑"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,color:C.text,fontSize:14}}>{p.name}</div>
                  <div style={{fontSize:11,color:C.textMuted}}>{p.age&&`${p.age}a`}{p.bed&&` · L${p.bed}`}{dias!==null&&` · D${dias}`}</div>
                  <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                    <Badge color={st.color} style={{fontSize:10}}>{st.icon} {st.label}</Badge>
                    {atbs.map(m=><Badge key={m.id} color={C.yellow} style={{fontSize:10}}>🦠 D{calcDay(m)||"?"}</Badge>)}
                    {(p.pending||[]).length>0&&<Badge color={C.yellow} style={{fontSize:10}}>⏳{p.pending.length}</Badge>}
                    {openTabs.includes(p.id)&&<Badge color={st.color} style={{fontSize:10}}>aberta</Badge>}
                  </div>
                </div>
                <div style={{color:C.textMuted,fontSize:18}}>›</div>
              </div>
            );
          })}
          {archived.length>0&&(
            <div style={{marginTop:8}}>
              <button onClick={()=>setShowArchived(!showArchived)} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,color:C.textMuted,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:600,width:"100%",fontFamily:"inherit"}}>
                📦 {archived.length} arquivado{archived.length>1?"s":""} {showArchived?"▲":"▼"}
              </button>
              {showArchived&&archived.map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,marginTop:5,opacity:0.6}}>
                  <div style={{flex:1,fontSize:13,color:C.textMuted}}>{p.name} · L{p.bed||"?"}</div>
                  <Btn onClick={()=>syncUpdate({...p,archived:false,archivedAt:null})} variant="ghost" size="sm">Reativar</Btn>
                  <Btn onClick={()=>{if(window.confirm("Excluir?"))remove(p.id);}} variant="danger" size="sm">🗑️</Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Labs de toda a área */}
      {viewMode==="labs"&&(
        <Card style={{marginTop:0,padding:12,borderRadius:"0 0 14px 14px",borderTop:"none"}}>
          <div style={{fontSize:11,color:C.purple,fontWeight:700,letterSpacing:1,marginBottom:10}}>🧪 LABORATÓRIO — TODOS OS PACIENTES</div>
          <LabAreaTable patients={filtered}/>
        </Card>
      )}

      {/* Paciente individual */}
      {viewMode==="visit"&&activePatient&&(
        <div style={{marginTop:openTabs.length?0:10}}>
          <VisitCard
            patient={activePatient}
            onUpdate={syncUpdate}
            onNext={()=>{const i=openTabs.indexOf(activeTab);if(i<openTabs.length-1)setActiveTab(openTabs[i+1]);}}
            onPrev={()=>{const i=openTabs.indexOf(activeTab);if(i>0)setActiveTab(openTabs[i-1]);}}
            totalPatients={openTabs.length}
            currentIndex={openTabs.indexOf(activeTab)}
            onArchive={archive}
            onDelete={remove}
          />
          {openTabs.length>1&&<div style={{textAlign:"center",fontSize:10,color:C.textDim,marginTop:6}}>← deslize para mudar de aba →</div>}
        </div>
      )}
    </div>
  );
}
