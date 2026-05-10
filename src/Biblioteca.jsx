// ============================================================
// MÓDULO BIBLIOTECA MÉDICA — Preceptor Médico
// Fase 1: Upload direto de PDF para consulta via Gemini
// Fase 2: RAG com Pinecone (configure as chaves abaixo)
// ============================================================

import { useState, useRef, useEffect } from "react";

// ============================================================
// ⚙️ CONFIGURAÇÃO — preencha quando tiver as chaves
// ============================================================
const PINECONE_API_KEY = localStorage.getItem("pineconeKey") || "";
const PINECONE_HOST = localStorage.getItem("pineconeHost") || ""; // ex: https://preceptor-medico-xxxx.svc.pinecone.io

// ============================================================
// GEMINI
// ============================================================
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

async function callGemini({ prompt, systemPrompt, pdfBase64, imageBase64, imageType, maxTokens = 3000 }) {
  const key = getKey();
  if (!key) throw new Error("Configure sua chave Gemini em ⚙️ Configurações");
  const parts = [];
  if (pdfBase64) parts.push({ inline_data: { mime_type: "application/pdf", data: pdfBase64 } });
  if (imageBase64) parts.push({ inline_data: { mime_type: imageType || "image/jpeg", data: imageBase64 } });
  parts.push({ text: prompt });
  const body = {
    contents: [{ role: "user", parts }],
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
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
  throw new Error("Nenhum modelo disponível. Verifique sua chave Gemini.");
}

// Gera embedding via Gemini para RAG
async function getEmbedding(text) {
  const key = getKey();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "models/text-embedding-004", content: { parts: [{ text }] } }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.embedding?.values || [];
}

// ============================================================
// PINECONE
// ============================================================
async function pineconeUpsert(vectors) {
  const key = PINECONE_API_KEY || localStorage.getItem("pineconeKey");
  const host = PINECONE_HOST || localStorage.getItem("pineconeHost");
  if (!key || !host) throw new Error("Configure as chaves do Pinecone nas configurações da biblioteca");
  const res = await fetch(`${host}/vectors/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Api-Key": key },
    body: JSON.stringify({ vectors, namespace: "biblioteca" }),
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

async function pineconeQuery(embedding, topK = 5) {
  const key = PINECONE_API_KEY || localStorage.getItem("pineconeKey");
  const host = PINECONE_HOST || localStorage.getItem("pineconeHost");
  if (!key || !host) throw new Error("Configure as chaves do Pinecone");
  const res = await fetch(`${host}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Api-Key": key },
    body: JSON.stringify({ vector: embedding, topK, namespace: "biblioteca", includeMetadata: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.matches || [];
}

// ============================================================
// PROCESSAMENTO DE PDF — divide em chunks para RAG
// ============================================================
function splitIntoChunks(text, chunkSize = 400, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 50) chunks.push(chunk);
    if (i + chunkSize >= words.length) break;
  }
  return chunks;
}

// ============================================================
// LOCAL STORAGE
// ============================================================
const DB = {
  get: k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

// ============================================================
// DESIGN
// ============================================================
const C = {
  bg: "#060c18", surface: "#0b1628", surface2: "#0f1f38",
  border: "rgba(99,179,237,0.1)", accent: "#63b3ed", accentDim: "rgba(99,179,237,0.12)",
  green: "#68d391", greenDim: "rgba(104,211,145,0.12)", red: "#fc8181", redDim: "rgba(252,129,129,0.12)",
  yellow: "#f6e05e", yellowDim: "rgba(246,224,94,0.12)", purple: "#b794f4", purpleDim: "rgba(183,148,244,0.12)",
  gold: "#f6ad55", text: "#e8f4fd", textMuted: "#718096", textDim: "#2d3748",
};
const glow = (c = C.accent) => `0 0 20px ${c}22`;

function Sp({ size = 14 }) {
  return <div style={{ width: size, height: size, border: `2px solid ${C.accent}33`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />;
}

function Btn({ onClick, disabled, variant = "primary", children, style, size = "md", full }) {
  const v = {
    primary: { background: `linear-gradient(135deg,${C.accent},#4299e1)`, color: "#fff", border: "none", boxShadow: glow() },
    ghost: { background: C.accentDim, color: C.accent, border: `1px solid ${C.border}` },
    danger: { background: C.redDim, color: C.red, border: `1px solid ${C.red}33` },
    success: { background: C.greenDim, color: C.green, border: `1px solid ${C.green}33` },
    warning: { background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}33` },
    purple: { background: C.purpleDim, color: C.purple, border: `1px solid ${C.purple}33` },
  };
  const s = { sm: { padding: "5px 12px", fontSize: 12 }, md: { padding: "9px 20px", fontSize: 13 }, lg: { padding: "13px 28px", fontSize: 15 } };
  return (
    <button onClick={onClick} disabled={disabled} style={{ borderRadius: 10, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, transition: "all 0.2s", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, width: full ? "100%" : undefined, justifyContent: full ? "center" : undefined, ...v[variant], ...s[size], ...style }}>
      {children}
    </button>
  );
}

function Card({ children, style, onClick }) {
  return <div onClick={onClick} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, cursor: onClick ? "pointer" : "default", transition: "all 0.2s", ...style }}>{children}</div>;
}

function Input({ value, onChange, onKeyDown, placeholder, type = "text", style }) {
  return <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box", ...style }} />;
}

function Badge({ color = C.accent, children, style }) {
  return <span style={{ background: `${color}1a`, border: `1px solid ${color}33`, borderRadius: 6, padding: "2px 8px", fontSize: 11, color, fontWeight: 700, ...style }}>{children}</span>;
}

function ProgressBar({ value, max, label }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
        <span>{label}</span><span>{pct}%</span>
      </div>
      <div style={{ background: C.surface2, borderRadius: 8, height: 8, overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(90deg,${C.accent},#4299e1)`, height: "100%", width: `${pct}%`, transition: "width 0.3s ease", borderRadius: 8 }} />
      </div>
      <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{value} de {max} chunks processados</div>
    </div>
  );
}

// ============================================================
// MAIN LIBRARY COMPONENT
// ============================================================
export default function BibliotecaModule() {
  const [tab, setTab] = useState("consulta");
  const [books, setBooks] = useState(() => DB.get("biblioteca") || []);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Upload states
  const [uploadMode, setUploadMode] = useState("direct"); // direct | rag
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadMeta, setUploadMeta] = useState({ title: "", type: "livro", subject: "" });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, phase: "" });

  // Config states
  const [pineconeKey, setPineconeKey] = useState(localStorage.getItem("pineconeKey") || "");
  const [pineconeHost, setPineconeHost] = useState(localStorage.getItem("pineconeHost") || "");

  const fileRef = useRef(null);

  const saveBooks = b => { setBooks(b); DB.set("biblioteca", b); };

  const BOOK_TYPES = [
    { id: "livro", label: "📗 Livro" },
    { id: "guideline", label: "📋 Guideline" },
    { id: "artigo", label: "📄 Artigo" },
    { id: "protocolo", label: "📌 Protocolo" },
    { id: "outro", label: "📎 Outro" },
  ];

  const TABS = [
    { id: "consulta", label: "🔍 Consultar" },
    { id: "biblioteca", label: `📚 Biblioteca (${books.length})` },
    { id: "upload", label: "➕ Adicionar" },
    { id: "config", label: "⚙️ Config RAG" },
  ];

  // ── CONSULTA ──────────────────────────────────────────────
  const consult = async () => {
    if (!query.trim() || loading) return;
    setLoading(true); setResult(""); setSources([]); setError("");

    const hasPinecone = localStorage.getItem("pineconeKey") && localStorage.getItem("pineconeHost");
    const ragBooks = books.filter(b => b.mode === "rag" && b.indexed);

    try {
      // FASE 2: RAG com Pinecone
      if (hasPinecone && ragBooks.length > 0) {
        setError("🔍 Buscando na biblioteca vetorizada...");
        const embedding = await getEmbedding(query);
        const matches = await pineconeQuery(embedding, 6);
        setSources(matches.map(m => m.metadata));

        const context = matches.map(m =>
          `[${m.metadata?.title || "Fonte"} | Pág. ~${m.metadata?.page || "?"}]\n${m.metadata?.text || ""}`
        ).join("\n\n---\n\n");

        const reply = await callGemini({
          prompt: `Você é o PRECEPTOR médico. Responda baseado EXCLUSIVAMENTE nas fontes abaixo. Cite sempre a fonte e página.\n\nFONTES DA BIBLIOTECA:\n${context}\n\nPERGUNTA DO RESIDENTE: ${query}\n\nResponda em português, seja completo e cite as fontes com página.`,
          maxTokens: 3000,
        });
        setResult(reply);
        setError("");
      }
      // FASE 1: PDF direto em memória
      else {
        const directBooks = books.filter(b => b.mode === "direct" && b.pdfBase64);
        if (directBooks.length === 0) {
          setResult("");
          setError("Nenhuma fonte disponível. Adicione PDFs na aba '➕ Adicionar'.");
          setLoading(false);
          return;
        }
        setError("📖 Consultando PDFs da biblioteca...");

        // Consulta nos livros diretos em paralelo
        const results = await Promise.all(
          directBooks.slice(0, 3).map(async book => {
            try {
              const r = await callGemini({
                prompt: `Pesquise neste documento sobre: "${query}"\n\nSe encontrar informação relevante, cite o capítulo/seção/página. Se não encontrar, diga "Não encontrado neste documento".\n\nResposta objetiva e completa.`,
                pdfBase64: book.pdfBase64,
                maxTokens: 1500,
              });
              return { book: book.title, result: r };
            } catch { return { book: book.title, result: "Erro ao consultar" }; }
          })
        );

        const relevant = results.filter(r => !r.result.includes("Não encontrado"));
        if (relevant.length === 0) {
          setResult("Informação não encontrada nos documentos disponíveis. Tente reformular a pergunta.");
        } else {
          const synthesis = await callGemini({
            prompt: `Você é o PRECEPTOR médico. Sintetize as informações abaixo sobre "${query}" em uma resposta completa, citando as fontes.\n\n${relevant.map(r => `FONTE: ${r.book}\n${r.result}`).join("\n\n---\n\n")}\n\nSíntese completa com citação de fontes:`,
            maxTokens: 3000,
          });
          setResult(synthesis);
          setSources(relevant.map(r => ({ title: r.book })));
        }
        setError("");
      }
    } catch (e) {
      setError("⚠️ " + e.message);
    }
    setLoading(false);
  };

  // ── UPLOAD DIRETO ────────────────────────────────────────
  const uploadDirect = async () => {
    if (!uploadFile || !uploadMeta.title.trim()) return;
    setUploading(true);
    setUploadProgress({ current: 0, total: 1, phase: "Lendo arquivo..." });
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(uploadFile);
      });

      // Testa se o Gemini consegue ler
      setUploadProgress({ current: 0, total: 1, phase: "Verificando documento..." });
      await callGemini({
        prompt: "Qual é o título ou tema principal deste documento? Responda em 1 frase.",
        pdfBase64: base64,
        maxTokens: 100,
      });

      const book = {
        id: Date.now().toString(),
        title: uploadMeta.title,
        type: uploadMeta.type,
        subject: uploadMeta.subject,
        mode: "direct",
        pdfBase64: base64,
        size: uploadFile.size,
        fileName: uploadFile.name,
        addedAt: new Date().toISOString(),
      };

      saveBooks([...books, book]);
      setUploadProgress({ current: 1, total: 1, phase: "Concluído!" });
      setUploadFile(null);
      setUploadMeta({ title: "", type: "livro", subject: "" });
      setTab("biblioteca");
      alert(`✅ "${book.title}" adicionado com sucesso!`);
    } catch (e) {
      setError("⚠️ Erro no upload: " + e.message);
    }
    setUploading(false);
  };

  // ── UPLOAD RAG (Vetorização) ─────────────────────────────
  const uploadRAG = async () => {
    if (!uploadFile || !uploadMeta.title.trim()) return;
    const key = localStorage.getItem("pineconeKey");
    const host = localStorage.getItem("pineconeHost");
    if (!key || !host) {
      setError("Configure as chaves do Pinecone na aba ⚙️ Config RAG");
      return;
    }

    setUploading(true); setError("");
    try {
      // 1. Extrai texto do PDF via Gemini
      setUploadProgress({ current: 0, total: 100, phase: "Extraindo texto do PDF..." });
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(uploadFile);
      });

      const extractedText = await callGemini({
        prompt: "Extraia TODO o texto deste documento de forma fiel, preservando a estrutura. Inclua títulos, subtítulos e conteúdo completo.",
        pdfBase64: base64,
        maxTokens: 8000,
      });

      // 2. Divide em chunks
      setUploadProgress({ current: 10, total: 100, phase: "Dividindo em chunks..." });
      const chunks = splitIntoChunks(extractedText, 400, 50);
      const total = chunks.length;

      // 3. Gera embeddings e indexa no Pinecone em lotes
      setUploadProgress({ current: 10, total: total, phase: "Gerando embeddings..." });
      const batchSize = 5;
      let processed = 0;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const vectors = await Promise.all(
          batch.map(async (chunk, j) => {
            const embedding = await getEmbedding(chunk);
            return {
              id: `${uploadMeta.title.replace(/\s/g, "_")}_${i + j}`,
              values: embedding,
              metadata: {
                title: uploadMeta.title,
                type: uploadMeta.type,
                subject: uploadMeta.subject,
                text: chunk,
                page: Math.floor((i + j) / 3) + 1, // estimativa de página
                chunkIndex: i + j,
              },
            };
          })
        );

        await pineconeUpsert(vectors);
        processed += batch.length;
        setUploadProgress({ current: processed, total, phase: `Indexando chunks (${processed}/${total})...` });

        // Pequena pausa para não sobrecarregar a API
        await new Promise(r => setTimeout(r, 300));
      }

      // 4. Salva referência local (sem o PDF completo para economizar espaço)
      const book = {
        id: Date.now().toString(),
        title: uploadMeta.title,
        type: uploadMeta.type,
        subject: uploadMeta.subject,
        mode: "rag",
        indexed: true,
        chunks: chunks.length,
        fileName: uploadFile.name,
        addedAt: new Date().toISOString(),
      };

      saveBooks([...books, book]);
      setUploadFile(null);
      setUploadMeta({ title: "", type: "livro", subject: "" });
      setTab("biblioteca");
      alert(`✅ "${book.title}" indexado com sucesso!\n${chunks.length} chunks no Pinecone.`);
    } catch (e) {
      setError("⚠️ Erro na indexação: " + e.message);
    }
    setUploading(false);
  };

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📖</span>Biblioteca Médica
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
          Seus livros, guidelines e artigos — consulta com IA baseada em evidências
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 18, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 14px", background: "transparent", border: "none", borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent", color: tab === t.id ? C.accent : C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CONSULTA ── */}
      {tab === "consulta" && (
        <div>
          {/* Status das fontes */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <Badge color={books.filter(b => b.mode === "direct").length > 0 ? C.green : C.textMuted}>
              📄 {books.filter(b => b.mode === "direct").length} PDF direto
            </Badge>
            <Badge color={books.filter(b => b.mode === "rag" && b.indexed).length > 0 ? C.accent : C.textMuted}>
              🧠 {books.filter(b => b.mode === "rag" && b.indexed).length} vetorizados
            </Badge>
            {!localStorage.getItem("pineconeKey") && (
              <Badge color={C.yellow}>⚠️ Pinecone não configurado</Badge>
            )}
          </div>

          {books.length === 0 ? (
            <Card style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
              <div style={{ color: C.textMuted, fontSize: 14, marginBottom: 8 }}>Biblioteca vazia</div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>Adicione seus livros e artigos na aba "➕ Adicionar"</div>
              <Btn onClick={() => setTab("upload")} size="sm">➕ Adicionar primeiro documento</Btn>
            </Card>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && consult()}
                  placeholder="Pesquisar na biblioteca... ex: dose de alteplase no TEP maciço"
                  style={{ flex: 1 }}
                />
                <Btn onClick={consult} disabled={loading || !query.trim()}>
                  {loading ? <Sp /> : "🔍"}
                </Btn>
              </div>

              {/* Sugestões rápidas */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {["Sepse — critérios diagnósticos", "Choque cardiogênico — conduta", "TEP maciço — tratamento", "Pneumonia grave — antibioticoterapia", "HAS crise hipertensiva", "ICC descompensada"].map(s => (
                  <button key={s} onClick={() => setQuery(s)} style={{ background: C.accentDim, border: `1px solid ${C.border}`, borderRadius: 8, color: C.accent, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>{s}</button>
                ))}
              </div>

              {error && !result && (
                <div style={{ color: error.startsWith("🔍") || error.startsWith("📖") ? C.accent : C.red, fontSize: 13, padding: "10px 14px", background: error.startsWith("🔍") || error.startsWith("📖") ? C.accentDim : C.redDim, borderRadius: 10, marginBottom: 12 }}>
                  {error}
                </div>
              )}

              {result && (
                <>
                  {/* Fontes */}
                  {sources.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>📚 FONTES CONSULTADAS:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {sources.map((s, i) => (
                          <Badge key={i} color={C.purple}>
                            {s.title}{s.page ? ` · Pág. ~${s.page}` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <Card style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.8, color: C.text }}>
                    {result.split("\n").map((l, i) => {
                      if (l.startsWith("## ")) return <div key={i} style={{ fontWeight: 900, color: C.accent, fontSize: 14, marginTop: 16, marginBottom: 4, borderLeft: `3px solid ${C.accent}`, paddingLeft: 10 }}>{l.replace("## ", "")}</div>;
                      if (l.startsWith("### ")) return <div key={i} style={{ fontWeight: 700, color: C.yellow, fontSize: 13, marginTop: 10 }}>{l.replace("### ", "")}</div>;
                      return <div key={i}>{l || "\u00A0"}</div>;
                    })}
                  </Card>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <Btn onClick={() => navigator.clipboard.writeText(result)} variant="ghost" size="sm">📋 Copiar</Btn>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── BIBLIOTECA ── */}
      {tab === "biblioteca" && (
        <div>
          {books.length === 0 ? (
            <Card style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
              Nenhum documento adicionado ainda.
            </Card>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {books.map(book => (
                <Card key={book.id} style={{ borderLeft: `3px solid ${book.mode === "rag" ? C.accent : C.green}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ fontSize: 28, flexShrink: 0 }}>
                      {book.type === "livro" ? "📗" : book.type === "guideline" ? "📋" : book.type === "artigo" ? "📄" : book.type === "protocolo" ? "📌" : "📎"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{book.title}</div>
                      {book.subject && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{book.subject}</div>}
                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        <Badge color={book.mode === "rag" ? C.accent : C.green}>
                          {book.mode === "rag" ? "🧠 Vetorizado" : "📄 PDF Direto"}
                        </Badge>
                        {book.chunks && <Badge color={C.textMuted}>{book.chunks} chunks</Badge>}
                        {book.size && <Badge color={C.textMuted}>{(book.size / 1024 / 1024).toFixed(1)} MB</Badge>}
                        <Badge color={C.textMuted}>{new Date(book.addedAt).toLocaleDateString("pt-BR")}</Badge>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Btn onClick={() => { setQuery(`Consultar: ${book.title}`); setTab("consulta"); }} variant="ghost" size="sm">🔍</Btn>
                      <Btn onClick={() => { if (window.confirm(`Remover "${book.title}"?`)) saveBooks(books.filter(b => b.id !== book.id)); }} variant="danger" size="sm">🗑️</Btn>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── UPLOAD ── */}
      {tab === "upload" && (
        <div>
          {/* Modo de upload */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 12 }}>Como deseja adicionar?</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <button onClick={() => setUploadMode("direct")} style={{ background: uploadMode === "direct" ? C.greenDim : "transparent", border: `1px solid ${uploadMode === "direct" ? C.green : C.border}`, borderRadius: 12, color: uploadMode === "direct" ? C.green : C.textMuted, padding: 14, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>📄</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>PDF Direto</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>Consulta imediata. Ideal para artigos e capítulos até ~200 págs.</div>
              </button>
              <button onClick={() => setUploadMode("rag")} style={{ background: uploadMode === "rag" ? C.accentDim : "transparent", border: `1px solid ${uploadMode === "rag" ? C.accent : C.border}`, borderRadius: 12, color: uploadMode === "rag" ? C.accent : C.textMuted, padding: 14, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>🧠</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Vetorizar (RAG)</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>Indexa no Pinecone. Ideal para livros grandes como Abramed e USP.</div>
              </button>
            </div>

            {uploadMode === "rag" && !localStorage.getItem("pineconeKey") && (
              <div style={{ background: C.yellowDim, border: `1px solid ${C.yellow}44`, borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 12, color: C.yellow }}>
                ⚠️ Configure as chaves do Pinecone na aba "⚙️ Config RAG" antes de vetorizar.
                <button onClick={() => setTab("config")} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, marginLeft: 8 }}>Configurar agora →</button>
              </div>
            )}

            {/* Metadados */}
            <div style={{ display: "grid", gap: 10 }}>
              <Input value={uploadMeta.title} onChange={e => setUploadMeta(m => ({ ...m, title: e.target.value }))} placeholder="Título (ex: Abramed — Tratado de Emergência Médica)" />
              <select value={uploadMeta.type} onChange={e => setUploadMeta(m => ({ ...m, type: e.target.value }))} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "10px 14px", fontSize: 13 }}>
                {BOOK_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <Input value={uploadMeta.subject} onChange={e => setUploadMeta(m => ({ ...m, subject: e.target.value }))} placeholder="Especialidade / assunto (ex: Medicina de Emergência, Cardiologia...)" />
            </div>
          </Card>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${uploadFile ? C.green : C.border}`, borderRadius: 14, padding: 28, textAlign: "center", cursor: "pointer", marginBottom: 14, background: uploadFile ? C.greenDim : "transparent", transition: "all 0.2s" }}
          >
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={e => setUploadFile(e.target.files?.[0] || null)} />
            {uploadFile ? (
              <div>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                <div style={{ color: C.green, fontWeight: 600, fontSize: 14 }}>{uploadFile.name}</div>
                <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>{(uploadFile.size / 1024 / 1024).toFixed(1)} MB · Clique para trocar</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📤</div>
                <div style={{ color: C.textMuted, fontSize: 14 }}>Toque para selecionar o PDF</div>
                <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Suporta qualquer PDF — livros, artigos, guidelines</div>
              </div>
            )}
          </div>

          {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 10, padding: "8px 12px", background: C.redDim, borderRadius: 8 }}>⚠️ {error}</div>}

          {uploading && uploadProgress.total > 0 && (
            <ProgressBar value={uploadProgress.current} max={uploadProgress.total} label={uploadProgress.phase} />
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Btn
              onClick={uploadMode === "direct" ? uploadDirect : uploadRAG}
              disabled={uploading || !uploadFile || !uploadMeta.title.trim() || (uploadMode === "rag" && !localStorage.getItem("pineconeKey"))}
              full
              size="lg"
            >
              {uploading ? (
                <><Sp /> {uploadMode === "rag" ? "Vetorizando..." : "Enviando..."}</>
              ) : (
                uploadMode === "direct" ? "📄 Adicionar à Biblioteca" : "🧠 Vetorizar e Indexar"
              )}
            </Btn>
          </div>

          {uploadMode === "rag" && (
            <div style={{ marginTop: 16, padding: 14, background: C.surface2, borderRadius: 12, fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
              <strong style={{ color: C.text }}>ℹ️ Como funciona a vetorização:</strong><br />
              1. O Gemini extrai o texto completo do PDF<br />
              2. O texto é dividido em chunks de ~400 palavras<br />
              3. Cada chunk recebe um embedding (vetor numérico)<br />
              4. Os vetores são salvos no Pinecone com metadados<br />
              5. Nas consultas, o Pinecone busca os chunks mais relevantes em &lt;1s<br /><br />
              <strong style={{ color: C.yellow }}>⏱️ Tempo estimado:</strong> ~1 min por 100 páginas
            </div>
          )}
        </div>
      )}

      {/* ── CONFIG RAG ── */}
      {tab === "config" && (
        <div>
          <Card style={{ marginBottom: 14, border: `1px solid ${C.accent}33` }}>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 15, marginBottom: 4 }}>🧠 Configuração do Pinecone</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16, lineHeight: 1.7 }}>
              O Pinecone é o banco de vetores que permite busca semântica nos seus livros em &lt;1 segundo.
              <br /><br />
              <strong style={{ color: C.text }}>Como criar gratuitamente:</strong><br />
              1. Acesse <a href="https://pinecone.io" target="_blank" rel="noreferrer" style={{ color: C.accent }}>pinecone.io</a> → criar conta grátis<br />
              2. Criar índice: nome <strong style={{ color: C.text }}>preceptor-medico</strong>, dimensão <strong style={{ color: C.text }}>768</strong>, métrica <strong style={{ color: C.text }}>cosine</strong><br />
              3. Copie a <strong style={{ color: C.text }}>API Key</strong> e o <strong style={{ color: C.text }}>Host URL</strong> do índice
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>API Key do Pinecone</div>
                <Input
                  value={pineconeKey}
                  onChange={e => setPineconeKey(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  type="password"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Host URL do índice</div>
                <Input
                  value={pineconeHost}
                  onChange={e => setPineconeHost(e.target.value)}
                  placeholder="https://preceptor-medico-xxxx.svc.pinecone.io"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Btn onClick={() => {
                localStorage.setItem("pineconeKey", pineconeKey);
                localStorage.setItem("pineconeHost", pineconeHost);
                alert("✅ Configurações salvas!");
              }} variant="success" size="sm">💾 Salvar</Btn>
              <Btn onClick={async () => {
                try {
                  const key = pineconeKey || localStorage.getItem("pineconeKey");
                  const host = pineconeHost || localStorage.getItem("pineconeHost");
                  const res = await fetch(`${host}/describe_index_stats`, { headers: { "Api-Key": key } });
                  const data = await res.json();
                  alert(`✅ Pinecone conectado!\nVetores indexados: ${data.totalVectorCount || 0}\nDimensões: ${data.dimension || "—"}`);
                } catch (e) { alert("❌ Erro: " + e.message); }
              }} variant="ghost" size="sm">🧪 Testar conexão</Btn>
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 8 }}>📊 Status da Biblioteca</div>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                { label: "PDFs diretos", value: books.filter(b => b.mode === "direct").length, color: C.green },
                { label: "Documentos vetorizados", value: books.filter(b => b.mode === "rag" && b.indexed).length, color: C.accent },
                { label: "Total de chunks indexados", value: books.filter(b => b.mode === "rag").reduce((acc, b) => acc + (b.chunks || 0), 0), color: C.purple },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.textMuted }}>{s.label}</span>
                  <Badge color={s.color}>{s.value}</Badge>
                </div>
              ))}
            </div>

            {books.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Documentos na biblioteca:</div>
                {books.map(b => (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 14 }}>{b.mode === "rag" ? "🧠" : "📄"}</span>
                    <span style={{ flex: 1, fontSize: 12, color: C.text }}>{b.title}</span>
                    {b.chunks && <Badge color={C.textMuted}>{b.chunks} chunks</Badge>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
