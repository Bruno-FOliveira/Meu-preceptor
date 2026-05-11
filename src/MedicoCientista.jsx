// ============================================================
// MÉDICO CIENTISTA — Análise Crítica de Artigos
// Estilo The Bottom Line (thebottomline.org.uk)
// 3 artigos por dia, análise completa com IA
// ============================================================

import { useState, useRef } from "react";

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

async function callGemini({ prompt, systemPrompt, pdfBase64, maxTokens = 4000 }) {
  const key = getKey();
  if (!key) throw new Error("Configure sua chave Gemini em ⚙️ Configurações");
  const parts = [];
  if (pdfBase64) parts.push({ inline_data: { mime_type: "application/pdf", data: pdfBase64 } });
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
  throw new Error("Nenhum modelo disponível.");
}

// ============================================================
// PUBMED API
// ============================================================
async function searchPubMed(query, maxResults = 5) {
  try {
    const search = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json`
    );
    const sData = await search.json();
    const ids = sData.esearchresult?.idlist || [];
    if (!ids.length) return [];
    const summary = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`
    );
    const sumData = await summary.json();
    return ids.map(id => {
      const a = sumData.result?.[id];
      return a ? {
        pmid: id,
        title: a.title,
        authors: a.authors?.map(x => x.name).slice(0, 3).join(", ") + (a.authors?.length > 3 ? " et al." : ""),
        journal: a.fulljournalname,
        year: a.pubdate?.split(" ")[0],
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      } : null;
    }).filter(Boolean);
  } catch { return []; }
}

// ============================================================
// SYSTEM PROMPT — Bottom Line style
// ============================================================
const SCIENTIST_SYS = `Você é um especialista em Medicina Baseada em Evidências com experiência em análise crítica de artigos científicos, no estilo do The Bottom Line (thebottomline.org.uk).

Sua análise deve ser:
- Rigorosa e imparcial — aponte pontos fortes E fracos honestamente
- Didática — explique o significado clínico dos resultados estatísticos
- Prática — sempre conecte ao impacto na prática clínica real
- Estruturada — siga sempre o template fornecido
- Em português brasileiro

Conceitos que deve dominar:
- Tipos de estudo (RCT, coorte, caso-controle, meta-análise)
- Vieses (seleção, aferição, confundimento, desfecho)
- Estatística (IC 95%, valor-p, NNT, NNH, RR, OR, HR, ARR, RRR)
- Validade interna e externa
- CONSORT, STROBE, PRISMA
- GRADE para qualidade da evidência`;

// ============================================================
// LOCAL DB
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
  gold: "#f6ad55", teal: "#4fd1c5", tealDim: "rgba(79,209,197,0.12)",
  text: "#e8f4fd", textMuted: "#718096", textDim: "#2d3748",
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
    teal: { background: C.tealDim, color: C.teal, border: `1px solid ${C.teal}33` },
    purple: { background: C.purpleDim, color: C.purple, border: `1px solid ${C.purple}33` },
    gold: { background: "rgba(246,173,85,0.15)", color: C.gold, border: `1px solid ${C.gold}33` },
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

function TA({ value, onChange, placeholder, rows = 4, style }) {
  return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box", resize: "vertical", ...style }} />;
}

function Badge({ color = C.accent, children, style }) {
  return <span style={{ background: `${color}1a`, border: `1px solid ${color}33`, borderRadius: 6, padding: "2px 8px", fontSize: 11, color, fontWeight: 700, ...style }}>{children}</span>;
}

// Nível de evidência visual
function EvidenceLevel({ level }) {
  const levels = {
    "IA": { color: C.green, desc: "Meta-análise de ECRs", stars: 5 },
    "IB": { color: C.green, desc: "ECR bem desenhado", stars: 4 },
    "IIA": { color: C.teal, desc: "Estudo coorte", stars: 3 },
    "IIB": { color: C.yellow, desc: "Caso-controle", stars: 2 },
    "III": { color: C.textMuted, desc: "Consenso/Opinião", stars: 1 },
  };
  const l = levels[level] || levels["IIA"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: `${l.color}11`, border: `1px solid ${l.color}33`, borderRadius: 10 }}>
      <div style={{ fontSize: 20 }}>{"⭐".repeat(l.stars)}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: l.color }}>Nível {level}</div>
        <div style={{ fontSize: 11, color: C.textMuted }}>{l.desc}</div>
      </div>
    </div>
  );
}

// Bottom Line verdict card
function VerdictCard({ verdict, impact }) {
  const colors = {
    positive: { bg: C.greenDim, border: C.green, icon: "✅", label: "POSITIVO" },
    negative: { bg: C.redDim, border: C.red, icon: "❌", label: "NEGATIVO" },
    neutral: { bg: C.yellowDim, border: C.yellow, icon: "⚠️", label: "NEUTRO/INCONCLUSIVO" },
    practice_changing: { bg: C.purpleDim, border: C.purple, icon: "🔄", label: "MUDA A PRÁTICA" },
  };
  const v = colors[impact] || colors.neutral;
  return (
    <div style={{ background: v.bg, border: `2px solid ${v.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 24 }}>{v.icon}</span>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 1, fontWeight: 700 }}>THE BOTTOM LINE</div>
          <Badge color={v.border}>{v.label}</Badge>
        </div>
      </div>
      <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7, fontStyle: "italic" }}>"{verdict}"</div>
    </div>
  );
}

// Seção formatada da análise
function AnalysisSection({ icon, title, content, color = C.accent }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        background: `${color}0d`, border: `1px solid ${color}22`, borderRadius: open ? "12px 12px 0 0" : 12,
        cursor: "pointer", color: C.text, fontFamily: "inherit",
      }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 13, textAlign: "left" }}>{title}</span>
        <span style={{ color: C.textMuted, fontSize: 16 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{
          background: C.surface2, border: `1px solid ${color}22`, borderTop: "none",
          borderRadius: "0 0 12px 12px", padding: "12px 14px",
          fontSize: 13, lineHeight: 1.8, color: C.text, whiteSpace: "pre-wrap",
        }}>
          {content}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ARTICLE ANALYSIS COMPONENT
// ============================================================
function ArticleAnalysis({ article, onBack, onSave }) {
  const sections = article.analysis ? parseAnalysis(article.analysis) : null;

  if (!sections) return (
    <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
      <Sp size={32} />
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ background: C.accentDim, border: `1px solid ${C.border}`, borderRadius: 8, color: C.accent, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← Voltar</button>
        <Btn onClick={() => navigator.clipboard.writeText(article.analysis)} variant="ghost" size="sm">📋 Copiar</Btn>
        <Btn onClick={onSave} variant="success" size="sm">💾 Salvar</Btn>
      </div>

      {/* Header do artigo */}
      <Card style={{ marginBottom: 16, borderLeft: `4px solid ${C.accent}` }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.4 }}>{article.title}</div>
        {article.authors && <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>👥 {article.authors}</div>}
        {article.journal && <div style={{ fontSize: 13, color: C.accent, marginBottom: 4 }}>📰 {article.journal} {article.year && `(${article.year})`}</div>}
        {article.doi && <div style={{ fontSize: 12, color: C.textMuted }}>DOI: {article.doi}</div>}
        {article.pmid && (
          <a href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: C.accent, display: "inline-block", marginTop: 6 }}>
            🔗 Ver no PubMed (PMID: {article.pmid})
          </a>
        )}
      </Card>

      {/* Nível de evidência */}
      {sections.evidenceLevel && (
        <div style={{ marginBottom: 16 }}>
          <EvidenceLevel level={sections.evidenceLevel} />
        </div>
      )}

      {/* Bottom Line Verdict */}
      {sections.verdict && (
        <VerdictCard verdict={sections.verdict} impact={sections.impact || "neutral"} />
      )}

      {/* Seções da análise */}
      {sections.clinicalQuestion && <AnalysisSection icon="❓" title="Pergunta Clínica" content={sections.clinicalQuestion} color={C.accent} />}
      {sections.background && <AnalysisSection icon="📖" title="Contexto / Relevância" content={sections.background} color={C.teal} />}
      {sections.design && <AnalysisSection icon="🔬" title="Desenho do Estudo" content={sections.design} color={C.purple} />}
      {sections.population && <AnalysisSection icon="👥" title="População" content={sections.population} color={C.teal} />}
      {sections.intervention && <AnalysisSection icon="💊" title="Intervenção vs Controle" content={sections.intervention} color={C.green} />}
      {sections.outcomes && <AnalysisSection icon="📊" title="Desfechos e Resultados" content={sections.outcomes} color={C.yellow} />}
      {sections.statistics && <AnalysisSection icon="📈" title="Análise Estatística" content={sections.statistics} color={C.gold} />}
      {sections.strengths && <AnalysisSection icon="✅" title="Pontos Fortes" content={sections.strengths} color={C.green} />}
      {sections.weaknesses && <AnalysisSection icon="⚠️" title="Limitações e Vieses" content={sections.weaknesses} color={C.red} />}
      {sections.clinical && <AnalysisSection icon="🏥" title="Aplicabilidade Clínica" content={sections.clinical} color={C.accent} />}
      {sections.questions && <AnalysisSection icon="🤔" title="Questões que Permanecem" content={sections.questions} color={C.purple} />}

      {/* Raw analysis fallback */}
      {!sections.clinicalQuestion && (
        <Card style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.8, color: C.text }}>
          {article.analysis}
        </Card>
      )}
    </div>
  );
}

// Parse do texto de análise gerado pela IA
function parseAnalysis(text) {
  const get = (key) => {
    const patterns = [
      new RegExp(`##\\s*${key}[:\\s]*([\\s\\S]*?)(?=##|$)`, "i"),
      new RegExp(`\\*\\*${key}\\*\\*[:\\s]*([\\s\\S]*?)(?=\\*\\*|##|$)`, "i"),
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1].trim();
    }
    return null;
  };

  // Detecta impact
  const analysisLower = text.toLowerCase();
  let impact = "neutral";
  if (analysisLower.includes("muda a prática") || analysisLower.includes("practice changing")) impact = "practice_changing";
  else if (analysisLower.includes("positivo") && !analysisLower.includes("não positivo")) impact = "positive";
  else if (analysisLower.includes("negativo") || analysisLower.includes("sem benefício")) impact = "negative";

  return {
    evidenceLevel: get("NÍVEL DE EVIDÊNCIA") || get("NIVEL DE EVIDENCIA"),
    verdict: get("BOTTOM LINE") || get("CONCLUSÃO BOTTOM LINE"),
    impact,
    clinicalQuestion: get("PERGUNTA CLÍNICA") || get("PERGUNTA CLINICA"),
    background: get("CONTEXTO") || get("BACKGROUND"),
    design: get("DESENHO DO ESTUDO") || get("DESIGN"),
    population: get("POPULAÇÃO") || get("POPULACAO"),
    intervention: get("INTERVENÇÃO") || get("INTERVENCAO"),
    outcomes: get("DESFECHOS") || get("RESULTADOS"),
    statistics: get("ANÁLISE ESTATÍSTICA") || get("ESTATISTICA"),
    strengths: get("PONTOS FORTES") || get("FORÇAS"),
    weaknesses: get("LIMITAÇÕES") || get("LIMITACOES") || get("FRAQUEZAS"),
    clinical: get("APLICABILIDADE CLÍNICA") || get("APLICABILIDADE CLINICA"),
    questions: get("QUESTÕES") || get("PERGUNTAS QUE PERMANECEM"),
  };
}

// ============================================================
// DAILY ARTICLES — 3 artigos por dia
// ============================================================
function DailyArticles({ onAnalyze }) {
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState([]);
  const [specialty, setSpecialty] = useState("clínica médica emergência");
  const [error, setError] = useState("");

  const SPECIALTIES = [
    "clínica médica emergência", "cardiologia", "pneumologia",
    "infectologia sepse", "nefrologia UTI", "neurologia AVC",
    "gastroenterologia", "endocrinologia diabetes", "hematologia",
  ];

  const generateDaily = async () => {
    setLoading(true); setError(""); setArticles([]);
    try {
      const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const result = await callGemini({
        prompt: `Hoje é ${today}. Você é um editor científico especialista em medicina baseada em evidências.

Sugira 3 artigos científicos REAIS e IMPORTANTES para um residente de Clínica Médica estudar hoje, focando em: ${specialty}.

Priorize:
- Artigos landmark que mudaram a prática (NEJM, Lancet, JAMA, BMJ, Critical Care Medicine)
- Trials randomizados recentes (últimos 5 anos) OU clássicos fundamentais
- Relevância para a prática clínica diária

Para cada artigo, forneça:
## ARTIGO [N]
**Título completo:** [título exato]
**Autores:** [primeiros autores et al.]
**Revista:** [nome da revista]
**Ano:** [ano de publicação]
**PMID:** [número PMID se souber, ou "verificar PubMed"]
**DOI:** [doi se souber]
**Por que estudar hoje:** [2-3 frases explicando a relevância clínica e o que você vai aprender]
**Tipo de estudo:** [RCT / Meta-análise / Coorte / etc]
**Nível de evidência:** [IA / IB / IIA / IIB / III]
**Desfecho principal:** [1 frase resumindo o resultado principal]
**Impacto prático:** [como mudou ou confirmou a prática clínica]`,
        systemPrompt: SCIENTIST_SYS,
        maxTokens: 2000,
      });

      // Parse dos artigos
      const parsed = parseArticleList(result);
      setArticles(parsed);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 10 }}>🎯 Área de foco de hoje</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {SPECIALTIES.map(s => (
            <button key={s} onClick={() => setSpecialty(s)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${specialty === s ? C.accent : C.border}`,
              background: specialty === s ? C.accentDim : "transparent",
              color: specialty === s ? C.accent : C.textMuted,
            }}>{s}</button>
          ))}
        </div>
        <Btn onClick={generateDaily} disabled={loading} full size="lg">
          {loading ? <><Sp />Selecionando artigos de hoje...</> : "🗞️ Gerar 3 Artigos do Dia"}
        </Btn>
        {error && <div style={{ color: C.red, fontSize: 12, marginTop: 10 }}>⚠️ {error}</div>}
      </Card>

      {articles.map((art, i) => (
        <Card key={i} style={{ marginBottom: 12, borderLeft: `3px solid ${C.accent}` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg,${C.accent},#4299e1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 13, lineHeight: 1.4, marginBottom: 6 }}>{art.title}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{art.authors && `${art.authors} · `}{art.journal && `${art.journal}`}{art.year && ` (${art.year})`}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {art.type && <Badge color={C.purple}>{art.type}</Badge>}
                {art.level && <Badge color={art.level.startsWith("I") ? C.green : C.yellow}>Nível {art.level}</Badge>}
              </div>
              {art.why && (
                <div style={{ fontSize: 12, color: C.text, background: C.accentDim, padding: "8px 10px", borderRadius: 8, marginBottom: 8, lineHeight: 1.6 }}>
                  💡 {art.why}
                </div>
              )}
              {art.impact && (
                <div style={{ fontSize: 12, color: C.green, lineHeight: 1.5 }}>
                  🏥 {art.impact}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <Btn onClick={() => onAnalyze(art)} size="sm">🔬 Analisar artigo</Btn>
                {art.pmid && art.pmid !== "verificar PubMed" && (
                  <a href={`https://pubmed.ncbi.nlm.nih.gov/${art.pmid}/`} target="_blank" rel="noreferrer">
                    <Btn variant="ghost" size="sm">🔗 PubMed</Btn>
                  </a>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function parseArticleList(text) {
  const articles = [];
  const blocks = text.split(/##\s*ARTIGO\s*\d+/i).filter(b => b.trim());
  for (const block of blocks) {
    const get = (key) => {
      const m = block.match(new RegExp(`\\*\\*${key}[:\\s]*\\*\\*[:\\s]*(.+?)(?=\\n|$)`, "i"));
      return m ? m[1].trim() : null;
    };
    articles.push({
      title: get("Título completo") || get("Título") || block.split("\n")[0]?.trim(),
      authors: get("Autores"),
      journal: get("Revista"),
      year: get("Ano"),
      pmid: get("PMID"),
      doi: get("DOI"),
      why: get("Por que estudar hoje"),
      type: get("Tipo de estudo"),
      level: get("Nível de evidência") || get("Nivel de evidencia"),
      mainOutcome: get("Desfecho principal"),
      impact: get("Impacto prático") || get("Impacto pratico"),
    });
  }
  return articles.filter(a => a.title);
}

// ============================================================
// MANUAL INPUT — Cole o texto/abstract do artigo
// ============================================================
function ManualInput({ onAnalyze }) {
  const [mode, setMode] = useState("text"); // text | pdf | pubmed
  const [text, setText] = useState("");
  const [pmid, setPmid] = useState("");
  const [searching, setSearching] = useState(false);
  const [pubmedResults, setPubmedResults] = useState([]);
  const [pdfFile, setPdfFile] = useState(null);
  const [meta, setMeta] = useState({ title: "", authors: "", journal: "", year: "", doi: "", pmid: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const searchPubMedQuery = async () => {
    if (!pmid.trim()) return;
    setSearching(true); setPubmedResults([]);
    try {
      const results = await searchPubMed(pmid, 5);
      setPubmedResults(results);
    } catch(e) { setError(e.message); }
    setSearching(false);
  };

  const handleFileUpload = (file) => {
    if (!file) return;
    setPdfFile(file);
    setMeta(m => ({ ...m, title: file.name.replace(".pdf", "") }));
  };

  const analyze = async (selectedMeta = null) => {
    const articleMeta = selectedMeta || meta;
    setLoading(true); setError("");
    try {
      let pdfBase64 = null;
      if (pdfFile) {
        pdfBase64 = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result.split(",")[1]);
          reader.onerror = rej;
          reader.readAsDataURL(pdfFile);
        });
      }

      const prompt = buildAnalysisPrompt(text, articleMeta, !!pdfBase64);
      const analysis = await callGemini({ prompt, systemPrompt: SCIENTIST_SYS, pdfBase64, maxTokens: 5000 });

      onAnalyze({
        ...articleMeta,
        analysis,
        analyzedAt: new Date().toISOString(),
      });
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const analyzeFromPubMed = async (article) => {
    setMeta({ title: article.title, authors: article.authors, journal: article.journal, year: article.year, pmid: article.pmid, doi: "" });
    setText(`Título: ${article.title}\nAutores: ${article.authors}\nRevista: ${article.journal}\nAno: ${article.year}\nPMID: ${article.pmid}`);
    await analyze({ title: article.title, authors: article.authors, journal: article.journal, year: article.year, pmid: article.pmid, doi: "" });
  };

  return (
    <div>
      {/* Modo de entrada */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { id: "text", icon: "📝", label: "Colar texto/abstract" },
          { id: "pdf", icon: "📄", label: "Upload do PDF" },
          { id: "pubmed", icon: "🔍", label: "Buscar no PubMed" },
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            padding: "10px 6px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${mode === m.id ? C.accent : C.border}`,
            background: mode === m.id ? C.accentDim : "transparent",
            color: mode === m.id ? C.accent : C.textMuted,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          }}>
            <span style={{ fontSize: 20 }}>{m.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center" }}>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Metadados */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, fontWeight: 600 }}>DADOS DO ARTIGO</div>
        <div style={{ display: "grid", gap: 8 }}>
          <Input value={meta.title} onChange={e => setMeta(m => ({ ...m, title: e.target.value }))} placeholder="Título do artigo" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Input value={meta.authors} onChange={e => setMeta(m => ({ ...m, authors: e.target.value }))} placeholder="Autores (ex: Smith J, et al.)" />
            <Input value={meta.journal} onChange={e => setMeta(m => ({ ...m, journal: e.target.value }))} placeholder="Revista (ex: NEJM)" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Input value={meta.year} onChange={e => setMeta(m => ({ ...m, year: e.target.value }))} placeholder="Ano" />
            <Input value={meta.pmid} onChange={e => setMeta(m => ({ ...m, pmid: e.target.value }))} placeholder="PMID" />
            <Input value={meta.doi} onChange={e => setMeta(m => ({ ...m, doi: e.target.value }))} placeholder="DOI" />
          </div>
        </div>
      </Card>

      {/* Modo texto */}
      {mode === "text" && (
        <div style={{ marginBottom: 12 }}>
          <TA
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Cole aqui o abstract, texto completo, ou qualquer informação disponível sobre o artigo...

Quanto mais conteúdo você colar (abstract + métodos + resultados), mais rica será a análise crítica."
            rows={10}
          />
        </div>
      )}

      {/* Modo PDF */}
      {mode === "pdf" && (
        <div
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${pdfFile ? C.green : C.border}`, borderRadius: 12, padding: 28, textAlign: "center", cursor: "pointer", marginBottom: 12, background: pdfFile ? C.greenDim : "transparent" }}
        >
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={e => handleFileUpload(e.target.files?.[0])} />
          {pdfFile ? (
            <div><div style={{ fontSize: 28 }}>✅</div><div style={{ color: C.green, fontWeight: 600, marginTop: 6 }}>{pdfFile.name}</div><div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Clique para trocar</div></div>
          ) : (
            <div><div style={{ fontSize: 36 }}>📄</div><div style={{ color: C.textMuted, marginTop: 8 }}>Clique para fazer upload do PDF</div><div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>O Gemini vai ler o artigo completo</div></div>
          )}
        </div>
      )}

      {/* Modo PubMed */}
      {mode === "pubmed" && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <Input
              value={pmid}
              onChange={e => setPmid(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchPubMedQuery()}
              placeholder="Digite PMID, título ou palavras-chave..."
              style={{ flex: 1 }}
            />
            <Btn onClick={searchPubMedQuery} disabled={searching || !pmid.trim()} size="sm">
              {searching ? <Sp size={12} /> : "🔍"}
            </Btn>
          </div>
          {pubmedResults.map((art, i) => (
            <Card key={i} style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => analyzeFromPubMed(art)}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4, lineHeight: 1.4 }}>{art.title}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{art.authors} · {art.journal} ({art.year})</div>
              <div style={{ fontSize: 11, color: C.accent, marginTop: 4 }}>PMID: {art.pmid} · Clique para analisar</div>
            </Card>
          ))}
        </div>
      )}

      {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 10, padding: "8px 12px", background: C.redDim, borderRadius: 8 }}>⚠️ {error}</div>}

      <Btn
        onClick={() => analyze()}
        disabled={loading || (!text.trim() && !pdfFile && mode !== "pubmed")}
        full size="lg"
        style={{ marginBottom: 8 }}
      >
        {loading ? <><Sp />Analisando artigo...</> : "🔬 Análise Crítica Bottom Line"}
      </Btn>

      {loading && (
        <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center", lineHeight: 1.8, padding: "8px 0" }}>
          Aguarde ~30-60s · O Gemini está lendo e analisando o artigo completo
        </div>
      )}
    </div>
  );
}

function buildAnalysisPrompt(text, meta, hasPDF) {
  return `Faça uma análise crítica COMPLETA deste artigo científico no estilo do The Bottom Line (thebottomline.org.uk), em português brasileiro.

DADOS DO ARTIGO:
Título: ${meta.title || "não informado"}
Autores: ${meta.authors || "não informado"}
Revista: ${meta.journal || "não informada"}
Ano: ${meta.year || "não informado"}
PMID: ${meta.pmid || "não informado"}
${meta.doi ? `DOI: ${meta.doi}` : ""}

${hasPDF ? "O PDF completo do artigo está anexado. Analise o texto completo." : text ? `CONTEÚDO DO ARTIGO:\n${text}` : "Analise com base nos dados disponíveis."}

Use EXATAMENTE esta estrutura (em markdown com ##):

## NÍVEL DE EVIDÊNCIA
[IA / IB / IIA / IIB / III — justifique em 1 linha]

## PERGUNTA CLÍNICA
[A pergunta PICO do estudo: População, Intervenção, Comparação, Outcome]

## CONTEXTO
[Por que este estudo é importante? Qual lacuna do conhecimento preenche? Estudos anteriores relevantes.]

## DESENHO DO ESTUDO
[Tipo de estudo, randomização, cegamento, análise (ITT/PP), poder estatístico, tamanho amostral e justificativa]

## POPULAÇÃO
[Critérios de inclusão/exclusão, número de pacientes, características basais, representatividade, generalizabilidade]

## INTERVENÇÃO
[Intervenção vs controle — detalhes da intervenção em cada grupo]

## DESFECHOS E RESULTADOS
[Desfecho primário com resultado numérico (%, p-valor, IC 95%)
Desfechos secundários principais
Eventos adversos]

## ANÁLISE ESTATÍSTICA
[NNT e NNH se aplicável, ARR/RRR, OR/RR/HR com IC 95%, significância clínica vs estatística]

## PONTOS FORTES
[Liste 3-5 pontos fortes metodológicos reais]

## LIMITAÇÕES E VIESES
[Liste 3-5 limitações reais: viés de seleção, aferição, confundimento, follow-up, generalização]

## APLICABILIDADE CLÍNICA
[Posso aplicar na minha prática? Para quais pacientes? O que muda? O que não muda?]

## QUESTÕES QUE PERMANECEM
[O que ainda não sabemos? Que estudos seriam necessários?]

## BOTTOM LINE
[Conclusão de 2-3 frases objetivas: o que este estudo prova, para quem, e o que fazer na prática. Seja honesto sobre a força da evidência. Este é o veredicto final — seja direto.]

IMPACTO: [escolha EXATAMENTE uma: positivo / negativo / neutro / practice_changing]`;
}

// ============================================================
// SAVED ANALYSES
// ============================================================
function SavedAnalyses({ onOpen }) {
  const [saved, setSaved] = useState(() => DB.get("savedArticles") || []);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const filtered = saved.filter(a =>
    (!search || a.title?.toLowerCase().includes(search.toLowerCase()) || (a.journal || "").toLowerCase().includes(search.toLowerCase())) &&
    (filterType === "all" || a.type === filterType)
  );

  const remove = (id) => {
    const updated = saved.filter(a => a.id !== id);
    setSaved(updated); DB.set("savedArticles", updated);
  };

  if (saved.length === 0) return (
    <Card style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
      <div style={{ color: C.textMuted }}>Nenhum artigo salvo ainda.</div>
      <div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>Analise artigos e salve para criar sua biblioteca científica.</div>
    </Card>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar por título, revista..." style={{ flex: 1 }} />
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>{filtered.length} artigo{filtered.length !== 1 ? "s" : ""} na sua biblioteca</div>
      {filtered.map(art => (
        <Card key={art.id} style={{ marginBottom: 10, borderLeft: `3px solid ${C.accent}` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 13, lineHeight: 1.4, marginBottom: 4 }}>{art.title}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                {art.authors && `${art.authors} · `}{art.journal && art.journal}{art.year && ` (${art.year})`}
              </div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
                Analisado em {new Date(art.analyzedAt).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Btn onClick={() => onOpen(art)} variant="ghost" size="sm">👁️</Btn>
              <Btn onClick={() => remove(art.id)} variant="danger" size="sm">🗑️</Btn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// MAIN MODULE
// ============================================================
export default function MedicoCientistaModule() {
  const [tab, setTab] = useState("daily");
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [savedArticles, setSavedArticles] = useState(() => DB.get("savedArticles") || []);

  const saveArticle = (article) => {
    const toSave = { ...article, id: article.id || Date.now().toString() };
    const updated = [toSave, ...savedArticles.filter(a => a.id !== toSave.id)];
    setSavedArticles(updated);
    DB.set("savedArticles", updated);
    alert("✅ Artigo salvo na sua biblioteca científica!");
  };

  const TABS = [
    { id: "daily", label: "🗞️ Artigos do Dia" },
    { id: "analyze", label: "🔬 Analisar" },
    { id: "saved", label: `📚 Biblioteca (${savedArticles.length})` },
  ];

  if (currentAnalysis) {
    return (
      <div style={{ animation: "fadeIn 0.3s ease" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🔬</span>Análise Crítica
        </div>
        <ArticleAnalysis
          article={currentAnalysis}
          onBack={() => setCurrentAnalysis(null)}
          onSave={() => saveArticle(currentAnalysis)}
        />
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🧬</span>Médico Cientista
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
          Análise crítica de artigos no estilo The Bottom Line · 3 artigos por dia
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 18, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px 12px", background: "transparent", border: "none",
            borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
            color: tab === t.id ? C.accent : C.textMuted, fontSize: 12, fontWeight: 600,
            cursor: "pointer", whiteSpace: "nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Daily Articles */}
      {tab === "daily" && (
        <DailyArticles
          onAnalyze={async (art) => {
            // Gera análise automática do artigo sugerido
            setCurrentAnalysis({ ...art, analysis: null });
            try {
              const prompt = buildAnalysisPrompt(
                `Título: ${art.title}\nAutores: ${art.authors}\nRevista: ${art.journal}\nAno: ${art.year}\nPMID: ${art.pmid}\nDesfecho principal: ${art.mainOutcome}\nImpacto: ${art.impact}`,
                art,
                false
              );
              const analysis = await callGemini({ prompt, systemPrompt: SCIENTIST_SYS, maxTokens: 5000 });
              setCurrentAnalysis({ ...art, analysis, analyzedAt: new Date().toISOString() });
            } catch(e) {
              setCurrentAnalysis({ ...art, analysis: "⚠️ Erro: " + e.message, analyzedAt: new Date().toISOString() });
            }
          }}
        />
      )}

      {/* Manual Analyze */}
      {tab === "analyze" && (
        <ManualInput
          onAnalyze={(art) => {
            setCurrentAnalysis({ ...art, id: Date.now().toString() });
          }}
        />
      )}

      {/* Saved */}
      {tab === "saved" && (
        <SavedAnalyses onOpen={(art) => setCurrentAnalysis(art)} />
      )}
    </div>
  );
}
