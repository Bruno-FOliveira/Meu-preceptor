// ============================================================
// CHAT DO PACIENTE — Preceptor Médico
// IA extrai automaticamente: vitais, labs, medicamentos,
// evolução, pendências de texto livre ou fotos
// ============================================================

import { useState, useRef, useEffect } from "react";

const MODELS = ["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.5-flash-preview-04-17","gemini-1.5-flash"];
let workingModel = localStorage.getItem("geminiModel") || null;
const getKey = () => localStorage.getItem("geminiKey") || "";

async function tryModel(model, key, body) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGemini({ prompt, systemPrompt, imageBase64, imageType, maxTokens = 3000 }) {
  const key = getKey();
  if (!key) throw new Error("Configure sua chave Gemini em ⚙️ Configurações");
  const parts = [];
  if (imageBase64) parts.push({ inline_data: { mime_type: imageType || "image/jpeg", data: imageBase64 } });
  parts.push({ text: prompt });
  const body = {
    contents: [{ role: "user", parts }],
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1 },
  };
  if (workingModel) {
    try { return await tryModel(workingModel, key, body); }
    catch { workingModel = null; localStorage.removeItem("geminiModel"); }
  }
  for (const model of MODELS) {
    try {
      const r = await tryModel(model, key, body);
      workingModel = model; localStorage.setItem("geminiModel", model); return r;
    } catch(e) { if (e.message.includes("API key") || e.message.includes("quota")) throw e; }
  }
  throw new Error("Nenhum modelo disponível.");
}

// ============================================================
// DESIGN
// ============================================================
const C = {
  bg: "#060c18", surface: "#0b1628", surface2: "#0f1f38",
  border: "rgba(99,179,237,0.1)", accent: "#63b3ed", accentDim: "rgba(99,179,237,0.12)",
  green: "#68d391", greenDim: "rgba(104,211,145,0.12)",
  red: "#fc8181", redDim: "rgba(252,129,129,0.12)",
  yellow: "#f6e05e", yellowDim: "rgba(246,224,94,0.12)",
  text: "#e8f4fd", textMuted: "#718096", textDim: "#2d3748",
};

function Sp({ size = 14 }) {
  return <div style={{ width: size, height: size, border: `2px solid ${C.accent}33`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />;
}

// ============================================================
// EXTRAÇÃO AUTOMÁTICA — parser da IA
// ============================================================
const EXTRACTION_PROMPT = `Você é um sistema de extração de dados médicos. Analise o texto/imagem fornecido e extraia TODOS os dados presentes.

Responda APENAS em JSON válido, sem markdown, sem explicação:

{
  "vitals": {
    "pas": "valor ou null",
    "pad": "valor ou null", 
    "fc": "valor ou null",
    "fr": "valor ou null",
    "spo2": "valor ou null",
    "temp": "valor ou null",
    "diurese": "valor ou null",
    "obs": "observações como O2, IOT, etc ou null"
  },
  "labs": {
    "hb": "valor ou null",
    "ht": "valor ou null",
    "leuco": "valor ou null",
    "plaq": "valor ou null",
    "cr": "valor ou null",
    "ur": "valor ou null",
    "na": "valor ou null",
    "k": "valor ou null",
    "cl": "valor ou null",
    "glicemia": "valor ou null",
    "pcr": "valor ou null",
    "ast": "valor ou null",
    "alt": "valor ou null",
    "ldh": "valor ou null",
    "lactato": "valor ou null",
    "tni": "valor ou null",
    "bnp": "valor ou null",
    "inr": "valor ou null",
    "fibri": "valor ou null",
    "ddimer": "valor ou null",
    "gasph": "valor ou null",
    "pco2": "valor ou null",
    "hco3": "valor ou null"
  },
  "medications": [
    {
      "name": "nome do medicamento",
      "dose": "dose",
      "route": "via",
      "schedule": "frequência/horário",
      "isAtb": true/false,
      "atbDay": "número do dia ou null"
    }
  ],
  "evolution": "texto da evolução do paciente ou null",
  "pending": ["pendência 1", "pendência 2"],
  "impression": "impressão clínica se houver ou null",
  "extractedFrom": "text/prescription/labs/vitals",
  "date": "data se identificada ou null",
  "notes": "outras informações relevantes não categorizadas"
}

IMPORTANTE:
- Se não encontrar um valor, use null
- Para labs: extraia TODOS os valores numéricos que pareçam resultados laboratoriais
- Para medicamentos: extraia TODOS os medicamentos com dose e horário
- Para pendências: identifique tarefas, exames pendentes, retornos agendados
- Se for imagem de prescrição: extraia todos os medicamentos
- Se for imagem de laboratório: extraia todos os valores com suas referências
- Vitais podem estar em formato "PA: 130x80" ou "PAS 130 PAD 80" ou similares`;

async function extractFromContent(text, imageBase64, imageType) {
  const prompt = imageBase64
    ? "Analise esta imagem médica e extraia todos os dados estruturados presentes (vitais, laboratório, prescrição, evolução)."
    : `Extraia todos os dados médicos estruturados do seguinte texto:\n\n${text}`;

  try {
    const reply = await callGemini({
      prompt,
      systemPrompt: EXTRACTION_PROMPT,
      imageBase64,
      imageType,
      maxTokens: 2000,
    });
    const clean = reply.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("Extraction failed:", e);
    return null;
  }
}

// ============================================================
// MERGE — aplica dados extraídos ao paciente
// ============================================================
function mergeExtracted(patient, extracted) {
  if (!extracted) return patient;
  const updated = { ...patient };

  // Vitais — merge apenas valores não-nulos
  if (extracted.vitals) {
    const newVitals = { ...(updated.vitals || {}) };
    Object.entries(extracted.vitals).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") newVitals[k] = v;
    });
    if (Object.keys(newVitals).length > 0) {
      updated.vitals = newVitals;
      updated.vitalsDate = new Date().toISOString();
    }
  }

  // Labs
  if (extracted.labs) {
    const newLabs = { ...(updated.labs || {}) };
    Object.entries(extracted.labs).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") newLabs[k] = v;
    });
    if (Object.keys(newLabs).length > 0) {
      updated.labs = newLabs;
      updated.labsDate = new Date().toISOString();
    }
  }

  // Medicamentos — adiciona novos sem duplicar
  if (extracted.medications && extracted.medications.length > 0) {
    const existing = updated.medications || [];
    const existingNames = existing.map(m => m.name?.toLowerCase());
    const newMeds = extracted.medications.filter(
      m => m.name && !existingNames.includes(m.name.toLowerCase())
    ).map(m => ({ ...m, id: Date.now().toString() + Math.random() }));
    if (newMeds.length > 0) updated.medications = [...existing, ...newMeds];
  }

  // Evolução — appenda com data
  if (extracted.evolution) {
    const dateStr = new Date().toLocaleDateString("pt-BR");
    const prefix = `[${dateStr}] `;
    const current = updated.todayEvolution || "";
    updated.todayEvolution = current
      ? `${current}\n\n${prefix}${extracted.evolution}`
      : `${prefix}${extracted.evolution}`;
  }

  // Pendências — adiciona novas
  if (extracted.pending && extracted.pending.length > 0) {
    const existing = updated.pending || [];
    const newPending = extracted.pending.filter(p => !existing.includes(p));
    updated.pending = [...existing, ...newPending];
  }

  // Impressão clínica
  if (extracted.impression && !updated.clinicalImpression) {
    updated.clinicalImpression = extracted.impression;
  }

  return updated;
}

// ============================================================
// PATIENT CHAT COMPONENT
// ============================================================
export default function PatientChat({ patient, onUpdate, onClose }) {
  const DB_KEY = `chat_${patient.id}`;
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DB_KEY) || "null") || []; } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [lastExtracted, setLastExtracted] = useState(null);
  const [showExtracted, setShowExtracted] = useState(false);

  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const saveMessages = (msgs) => {
    setMessages(msgs);
    localStorage.setItem(DB_KEY, JSON.stringify(msgs.slice(-100)));
  };

  const handleFiles = (newFiles) => {
    const imgs = Array.from(newFiles).filter(f => f.type.startsWith("image/") || f.type === "application/pdf");
    if (!imgs.length) return;
    setFiles(prev => [...prev, ...imgs]);
    imgs.forEach(f => {
      if (f.type.startsWith("image/")) {
        const r = new FileReader();
        r.onload = e => setPreviews(prev => [...prev, e.target.result]);
        r.readAsDataURL(f);
      } else {
        setPreviews(prev => [...prev, null]);
      }
    });
  };

  const extractAndApply = async () => {
    if (!input.trim() && files.length === 0) return;
    setExtracting(true);

    let allExtracted = null;

    // Processa cada arquivo
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        const extracted = await extractFromContent("", b64, file.type);
        if (extracted) {
          allExtracted = allExtracted ? mergeExtractedObjects(allExtracted, extracted) : extracted;
        }
      }
    }

    // Processa texto
    if (input.trim()) {
      const extracted = await extractFromContent(input.trim(), null, null);
      if (extracted) {
        allExtracted = allExtracted ? mergeExtractedObjects(allExtracted, extracted) : extracted;
      }
    }

    if (allExtracted) {
      setLastExtracted(allExtracted);
      setShowExtracted(true);
    }

    setExtracting(false);
  };

  const mergeExtractedObjects = (a, b) => {
    const merged = { ...a };
    // Merge vitals
    if (b.vitals) merged.vitals = { ...a.vitals, ...Object.fromEntries(Object.entries(b.vitals).filter(([,v]) => v !== null)) };
    // Merge labs
    if (b.labs) merged.labs = { ...a.labs, ...Object.fromEntries(Object.entries(b.labs).filter(([,v]) => v !== null)) };
    // Merge meds
    if (b.medications?.length) merged.medications = [...(a.medications || []), ...b.medications];
    // Merge pending
    if (b.pending?.length) merged.pending = [...(a.pending || []), ...b.pending];
    // Merge evolution
    if (b.evolution) merged.evolution = b.evolution;
    return merged;
  };

  const applyExtracted = () => {
    if (!lastExtracted) return;
    const updated = mergeExtracted(patient, lastExtracted);
    onUpdate(updated);
    setShowExtracted(false);

    // Adiciona mensagem de confirmação no chat
    const summary = buildExtractedSummary(lastExtracted);
    const systemMsg = {
      role: "system",
      content: `✅ Dados extraídos e aplicados ao paciente:\n${summary}`,
      timestamp: new Date().toISOString(),
    };
    saveMessages([...messages, systemMsg]);
    setInput("");
    setFiles([]);
    setPreviews([]);
    setLastExtracted(null);
  };

  const buildExtractedSummary = (ex) => {
    const lines = [];
    const vitals = Object.entries(ex.vitals || {}).filter(([,v]) => v !== null);
    if (vitals.length) lines.push(`💉 Vitais: ${vitals.map(([k,v]) => `${k.toUpperCase()} ${v}`).join(" · ")}`);
    const labs = Object.entries(ex.labs || {}).filter(([,v]) => v !== null);
    if (labs.length) lines.push(`🧪 Labs: ${labs.map(([k,v]) => `${k} ${v}`).join(" · ")}`);
    if (ex.medications?.length) lines.push(`💊 Medicamentos: ${ex.medications.map(m => m.name).join(", ")}`);
    if (ex.pending?.length) lines.push(`⏳ Pendências: ${ex.pending.join("; ")}`);
    if (ex.evolution) lines.push(`📋 Evolução: ${ex.evolution.slice(0, 80)}...`);
    return lines.join("\n") || "Nenhum dado estruturado identificado";
  };

  const sendChat = async () => {
    if ((!input.trim() && files.length === 0) || loading) return;

    let imageBase64 = null, imageType = null;
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      imageBase64 = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(files[0]);
      });
      imageType = files[0].type;
    }

    const userMsg = {
      role: "user",
      content: input.trim() || "[imagem]",
      previews: previews.slice(0, 3),
      timestamp: new Date().toISOString(),
    };
    const newMsgs = [...messages, userMsg];
    saveMessages(newMsgs);
    setInput(""); setFiles([]); setPreviews([]);
    setLoading(true);

    try {
      const patientContext = `PACIENTE: ${patient.name}, ${patient.age}a, Leito ${patient.bed || "—"}
STATUS: ${patient.status}
RESUMO: ${patient.summary || "—"}
ATB: ${patient.onAntibiotic ? patient.antibioticDetail || "sim" : "não"}
PENDÊNCIAS ATUAIS: ${(patient.pending || []).join("; ") || "nenhuma"}
EVOLUÇÃO HOJE: ${patient.todayEvolution || "—"}`;

      const systemPrompt = `Você é o Preceptor — médico experiente. Está conversando sobre um paciente específico.

${patientContext}

Responda de forma direta e clínica. Pode:
- Analisar dados clínicos apresentados
- Sugerir pendências a adicionar
- Alertar sobre achados preocupantes
- Responder dúvidas sobre condutas
- Interpretar resultados de labs/vitais

Se identificar dados para atualizar o prontuário, mencione explicitamente.
Português brasileiro. Seja conciso — está no plantão.`;

      const reply = await callGemini({
        prompt: newMsgs.slice(-6).map(m => `${m.role === "user" ? "Médico" : "Preceptor"}: ${m.content}`).join("\n\n"),
        systemPrompt,
        imageBase64,
        imageType,
      });

      const assistantMsg = { role: "assistant", content: reply, timestamp: new Date().toISOString() };
      saveMessages([...newMsgs, assistantMsg]);
    } catch (e) {
      saveMessages([...newMsgs, { role: "assistant", content: "⚠️ " + e.message, timestamp: new Date().toISOString() }]);
    }
    setLoading(false);
  };

  const addPendingQuick = (text) => {
    const updated = { ...patient, pending: [...(patient.pending || []), text] };
    onUpdate(updated);
    const msg = { role: "system", content: `⏳ Pendência adicionada: "${text}"`, timestamp: new Date().toISOString() };
    saveMessages([...messages, msg]);
  };

  const QUICK_PENDING = [
    "Checar resultado de hemograma",
    "Aguardar parecer",
    "Revisar medicação",
    "Verificar diurese 24h",
    "Solicitar ECG",
    "Confirmar vaga UTI",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'Georgia',serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 20, padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: C.text, fontSize: 14 }}>💬 {patient.name}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Chat do paciente · Leito {patient.bed || "—"}</div>
        </div>
        <div style={{ fontSize: 10, color: C.textMuted }}>{(patient.pending || []).length} pendências</div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>

        {/* Welcome */}
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: C.textMuted, padding: "20px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🩺</div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>Chat do paciente {patient.name}</div>
            <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.7, marginBottom: 16 }}>
              Envie aqui:<br />
              📝 Evolução em texto<br />
              📸 Foto da prescrição<br />
              🧪 Foto do laboratório<br />
              💉 Vitais do dia
            </div>
          </div>
        )}

        {/* Quick pending */}
        {messages.length === 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, fontWeight: 700 }}>⏳ ADICIONAR PENDÊNCIA RÁPIDA:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {QUICK_PENDING.map(p => (
                <button key={p} onClick={() => addPendingQuick(p)} style={{ background: C.yellowDim, border: `1px solid ${C.yellow}33`, borderRadius: 8, color: C.yellow, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>+ {p}</button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 12, animation: "fadeIn 0.3s ease" }}>
            {msg.role === "system" ? (
              <div style={{ background: C.greenDim, border: `1px solid ${C.green}33`, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: C.green, whiteSpace: "pre-wrap" }}>
                {msg.content}
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
                {msg.role === "assistant" && (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${C.accent},#4299e1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, marginTop: 2 }}>🩺</div>
                )}
                <div style={{ maxWidth: "82%" }}>
                  {msg.previews?.map((p, pi) => p && <img key={pi} src={p} alt="" style={{ maxWidth: 160, borderRadius: 8, marginBottom: 4, display: "block" }} />)}
                  <div style={{ background: msg.role === "user" ? "linear-gradient(135deg,#1a3a5c,#0d2d4a)" : C.surface, border: `1px solid ${msg.role === "user" ? C.accent + "33" : C.border}`, borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px", padding: "9px 13px", fontSize: 13, lineHeight: 1.7, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {msg.content}
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 3, textAlign: msg.role === "user" ? "right" : "left" }}>
                    {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${C.accent},#4299e1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🩺</div>
            <Sp />
            <span style={{ fontSize: 12, color: C.accent }}>Preceptor analisando...</span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Extraction preview */}
      {showExtracted && lastExtracted && (
        <div style={{ margin: "0 14px 10px", background: C.accentDim, border: `1px solid ${C.accent}44`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 13, color: C.accent, fontWeight: 700, marginBottom: 8 }}>🤖 Dados identificados — aplicar ao paciente?</div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7, marginBottom: 10 }}>{buildExtractedSummary(lastExtracted)}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={applyExtracted} style={{ flex: 1, background: C.greenDim, border: `1px solid ${C.green}33`, borderRadius: 8, color: C.green, padding: "8px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>✅ Aplicar ao prontuário</button>
            <button onClick={() => setShowExtracted(false)} style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 8, color: C.red, padding: "8px 12px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>✕</button>
          </div>
        </div>
      )}

      {/* File previews — múltiplas fotos */}
      {previews.length > 0 && (
        <div style={{ padding: "0 14px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>📸 {previews.length} foto{previews.length > 1 ? "s" : ""} selecionada{previews.length > 1 ? "s" : ""}</span>
            <button onClick={() => { setFiles([]); setPreviews([]); }} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Limpar todas</button>
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {previews.map((p, i) => (
              <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                {p
                  ? <img src={p} alt="" style={{ height: 72, width: 72, borderRadius: 8, objectFit: "cover", border: `2px solid ${C.accent}33` }} />
                  : <div style={{ height: 72, width: 72, background: C.accentDim, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📄</div>
                }
                <div style={{ position: "absolute", bottom: 2, left: 2, background: "rgba(0,0,0,0.6)", borderRadius: 4, padding: "1px 4px", fontSize: 9, color: "#fff" }}>{i + 1}</div>
                <button onClick={() => { setFiles(f => f.filter((_,j)=>j!==i)); setPreviews(p => p.filter((_,j)=>j!==i)); }} style={{ position: "absolute", top: -4, right: -4, background: C.red, border: "none", borderRadius: "50%", color: "#fff", width: 20, height: 20, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✕</button>
              </div>
            ))}
            {/* Botão para adicionar mais fotos */}
            <div onClick={() => fileRef.current?.click()} style={{ height: 72, width: 72, background: C.surface2, border: `2px dashed ${C.border}`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, gap: 2 }}>
              <span style={{ fontSize: 20 }}>+</span>
              <span style={{ fontSize: 9, color: C.textMuted }}>mais</span>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, background: C.surface }}>
        {/* Action buttons */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto" }}>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
          <button onClick={() => cameraRef.current?.click()} style={{ background: C.accentDim, border: `1px solid ${C.border}`, borderRadius: 8, color: C.accent, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>📸 Câmera</button>
          <button onClick={() => fileRef.current?.click()} style={{ background: C.accentDim, border: `1px solid ${C.border}`, borderRadius: 8, color: C.accent, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>🖼️ Galeria</button>
          <button
            onClick={extractAndApply}
            disabled={extracting || (!input.trim() && files.length === 0)}
            style={{ background: C.greenDim, border: `1px solid ${C.green}33`, borderRadius: 8, color: C.green, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", opacity: extracting ? 0.5 : 1 }}
          >
            {extracting ? "⏳ Extraindo..." : "🤖 Extrair dados"}
          </button>
          <button
            onClick={() => { const t = prompt("Nova pendência:"); if (t?.trim()) addPendingQuick(t.trim()); }}
            style={{ background: C.yellowDim, border: `1px solid ${C.yellow}33`, borderRadius: 8, color: C.yellow, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
          >⏳ + Pendência</button>
        </div>

        {/* Text input + send */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
            placeholder="Evolução, vitais, dúvida clínica... (Enter envia, Shift+Enter nova linha)"
            rows={2}
            style={{ flex: 1, resize: "none", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "9px 12px", fontSize: 13, fontFamily: "inherit" }}
          />
          <button
            onClick={sendChat}
            disabled={loading || (!input.trim() && files.length === 0)}
            style={{ background: `linear-gradient(135deg,${C.accent},#4299e1)`, border: "none", borderRadius: 10, color: "#fff", padding: "10px 14px", cursor: "pointer", fontSize: 18, flexShrink: 0, opacity: loading ? 0.4 : 1 }}
          >➤</button>
        </div>
      </div>
    </div>
  );
}
