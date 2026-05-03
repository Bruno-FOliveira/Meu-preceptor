// ============================================================
// PRECEPTOR MÉDICO — App Completo com Firebase
// Admin: filipe8395@gmail.com (Bruno)
// ============================================================

import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  onAuthStateChanged, signOut
} from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, getDocs, onSnapshot, serverTimestamp, deleteDoc
} from "firebase/firestore";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "firebase/storage";

// ============================================================
// ⚙️ FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDQcPt-8z026FLUpoWTCrREHZyQ5Yo0fr8",
  authDomain: "meu-preceptor.firebaseapp.com",
  projectId: "meu-preceptor",
  storageBucket: "meu-preceptor.firebasestorage.app",
  messagingSenderId: "409123055999",
  appId: "1:409123055999:web:acbd8a5073793c2aba524a",
  measurementId: "G-XV8CKLH6W5"
};

const ADMIN_EMAIL = "filipe8395@gmail.com";
const ADMIN_GEMINI_KEY = ""; // Admin coloca aqui sua chave Gemini com billing

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ============================================================
// GEMINI API
// ============================================================
async function callGemini({ prompt, systemPrompt, imageBase64, imageType, audioBase64, apiKey, maxTokens = 3000 }) {
  const key = apiKey || ADMIN_GEMINI_KEY || localStorage.getItem("geminiKey") || "";
  if (!key) throw new Error("Configure sua chave Gemini nas configurações");
  const parts = [];
  if (imageBase64) parts.push({ inline_data: { mime_type: imageType || "image/jpeg", data: imageBase64 } });
  if (audioBase64) parts.push({ inline_data: { mime_type: "audio/webm", data: audioBase64 } });
  parts.push({ text: prompt });
  const body = {
    contents: [{ role: "user", parts }],
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  // Track usage in Firestore
  const uid = auth.currentUser?.uid;
  if (uid) {
    const today = new Date().toISOString().split("T")[0];
    const statRef = doc(db, "users", uid, "stats", today);
    const snap = await getDoc(statRef);
    const cur = snap.exists() ? snap.data() : { queries: 0 };
    await setDoc(statRef, { queries: (cur.queries || 0) + 1, lastQuery: serverTimestamp() }, { merge: true });
    await updateDoc(doc(db, "users", uid), { lastSeen: serverTimestamp() });
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

const PRECEPTOR_SYSTEM = `Você é o PRECEPTOR — médico clínico com 30 anos de experiência em Clínica Médica e Urgência/Emergência. É o preceptor virtual de um residente brasileiro.

REGRAS ABSOLUTAS:
1. Sempre baseado em evidências — cite fonte (Autor, Revista, Ano, PMID/DOI)
2. Nível de evidência em cada recomendação (IA, IB, IIA, IIB, III)
3. Posologia COMPLETA: nome genérico+comercial, dose, via, diluição (solução+volume+tempo), frequência, ajuste renal/hepático, contraindicações, interações
4. Alertas de risco: sepse oculta, deterioração iminente, diagnóstico sobreposto
5. Scores automáticos: qSOFA, NEWS2, CURB-65, HEART, Wells quando aplicável
6. "Puxa orelha" direto ao identificar condutas inadequadas — use 🚨
7. Idioma: português brasileiro`;

// ============================================================
// DESIGN SYSTEM
// ============================================================
const C = {
  bg: "#060c18", surface: "#0b1628", surface2: "#0f1f38",
  border: "rgba(99,179,237,0.1)", borderHover: "rgba(99,179,237,0.3)",
  accent: "#63b3ed", accentDim: "rgba(99,179,237,0.12)",
  green: "#68d391", greenDim: "rgba(104,211,145,0.12)",
  red: "#fc8181", redDim: "rgba(252,129,129,0.12)",
  yellow: "#f6e05e", yellowDim: "rgba(246,224,94,0.12)",
  purple: "#b794f4", purpleDim: "rgba(183,148,244,0.12)",
  gold: "#f6ad55", goldDim: "rgba(246,173,85,0.12)",
  text: "#e8f4fd", textMuted: "#718096", textDim: "#2d3748",
};

const glow = (c = C.accent) => `0 0 20px ${c}22, 0 0 40px ${c}11`;

function Spinner({ size = 16, color = C.accent }) {
  return <div style={{ width: size, height: size, border: `2px solid ${color}33`, borderTop: `2px solid ${color}`, borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />;
}

function Btn({ onClick, disabled, variant = "primary", children, style, size = "md", full }) {
  const v = {
    primary: { background: `linear-gradient(135deg, ${C.accent}, #4299e1)`, color: "#fff", border: "none", boxShadow: glow() },
    ghost: { background: C.accentDim, color: C.accent, border: `1px solid ${C.border}` },
    danger: { background: C.redDim, color: C.red, border: `1px solid ${C.red}33` },
    success: { background: C.greenDim, color: C.green, border: `1px solid ${C.green}33` },
    warning: { background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}33` },
    gold: { background: C.goldDim, color: C.gold, border: `1px solid ${C.gold}33` },
    purple: { background: C.purpleDim, color: C.purple, border: `1px solid ${C.purple}33` },
  };
  const s = { sm: { padding: "5px 12px", fontSize: 12 }, md: { padding: "9px 20px", fontSize: 13 }, lg: { padding: "13px 28px", fontSize: 15 } };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      borderRadius: 10, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1, transition: "all 0.2s", fontFamily: "inherit",
      display: "inline-flex", alignItems: "center", gap: 7,
      width: full ? "100%" : undefined, justifyContent: full ? "center" : undefined,
      ...v[variant], ...s[size], ...style,
    }}>{children}</button>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
      padding: 18, transition: "all 0.2s", cursor: onClick ? "pointer" : "default", ...style,
    }}>{children}</div>
  );
}

function Input({ value, onChange, onKeyDown, placeholder, type = "text", style }) {
  return (
    <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder}
      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box", transition: "border-color 0.2s", ...style }} />
  );
}

function Badge({ color = C.accent, children, style }) {
  return <span style={{ background: `${color}1a`, border: `1px solid ${color}33`, borderRadius: 6, padding: "2px 8px", fontSize: 11, color, fontWeight: 700, letterSpacing: 0.4, ...style }}>{children}</span>;
}

// ============================================================
// LOGIN SCREEN
// ============================================================
function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    setLoading(true); setError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const isAdmin = user.email === ADMIN_EMAIL;
        await setDoc(userRef, {
          uid: user.uid, email: user.email,
          alias: user.displayName || user.email.split("@")[0],
          role: isAdmin ? "admin" : "member",
          status: isAdmin ? "active" : "pending",
          canUploadMedia: isAdmin,
          createdAt: serverTimestamp(), lastSeen: serverTimestamp(),
          photoURL: user.photoURL || null,
        });
      } else {
        await updateDoc(userRef, { lastSeen: serverTimestamp() });
      }
      onLogin(user);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Georgia', serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:.4;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}`}</style>
      <div style={{ width: "100%", maxWidth: 420, animation: "fadeIn 0.6s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, #4299e1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 20px", boxShadow: glow() }}>🩺</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: -0.5 }}>PRECEPTOR MÉDICO</div>
          <div style={{ fontSize: 13, color: C.accent, letterSpacing: 3, marginTop: 6, fontWeight: 600 }}>CLÍNICA MÉDICA • RESIDÊNCIA</div>
        </div>

        <Card style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, color: C.text, fontWeight: 600, marginBottom: 8 }}>Acesso exclusivo</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 28, lineHeight: 1.6 }}>
            Entre com sua conta Google para acessar o app. Novos usuários precisam de aprovação do administrador.
          </div>
          <button onClick={login} disabled={loading} style={{
            width: "100%", padding: "14px", borderRadius: 12, border: `1px solid ${C.border}`,
            background: "rgba(255,255,255,0.06)", color: C.text, fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 12, transition: "all 0.2s", fontFamily: "inherit",
          }}>
            {loading ? <Spinner /> : <span style={{ fontSize: 20 }}>G</span>}
            {loading ? "Entrando..." : "Entrar com Google"}
          </button>
          {error && <div style={{ color: C.red, fontSize: 12, marginTop: 14 }}>⚠️ {error}</div>}
        </Card>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: C.textMuted }}>
          🔒 Dados protegidos por LGPD • Uso educacional interno
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PENDING SCREEN
// ============================================================
function PendingScreen({ user }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Georgia', serif" }}>
      <Card style={{ maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Aguardando aprovação</div>
        <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 20 }}>
          Sua conta <strong style={{ color: C.accent }}>{user.email}</strong> foi criada e está aguardando aprovação do administrador.<br /><br />
          Você receberá acesso em breve.
        </div>
        <Btn onClick={() => signOut(auth)} variant="ghost" full>Sair</Btn>
      </Card>
    </div>
  );
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================
function AdminDashboard({ currentUser, userProfile }) {
  const [users, setUsers] = useState([]);
  const [corps, setCorps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("users");
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, blocked: 0 });
  const [newCorpName, setNewCorpName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const us = snap.docs.map(d => d.data());
      setUsers(us);
      setStats({
        total: us.length,
        active: us.filter(u => u.status === "active").length,
        pending: us.filter(u => u.status === "pending").length,
        blocked: us.filter(u => u.status === "blocked").length,
      });
      setLoading(false);
    });
    const unsubCorps = onSnapshot(collection(db, "corporations"), snap => {
      setCorps(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub(); unsubCorps(); };
  }, []);

  const updateUser = async (uid, updates) => {
    await updateDoc(doc(db, "users", uid), updates);
  };

  const createCorp = async () => {
    if (!newCorpName.trim()) return;
    setCreating(true);
    const code = Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    await setDoc(doc(collection(db, "corporations")), {
      name: newCorpName.trim(), inviteCode: code,
      createdBy: currentUser.uid, createdAt: serverTimestamp(),
      members: [{ uid: currentUser.uid, alias: userProfile.alias, role: "admin" }],
    });
    setNewCorpName(""); setCreating(false);
  };

  const deleteCorp = async (id) => {
    if (!window.confirm("Excluir corporação?")) return;
    await deleteDoc(doc(db, "corporations", id));
  };

  const TABS = [{ id: "users", label: "👥 Usuários" }, { id: "corps", label: "🏢 Corporações" }, { id: "api", label: "🔑 API" }];

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* Header admin */}
      <div style={{ background: `linear-gradient(135deg, ${C.goldDim}, ${C.accentDim})`, border: `1px solid ${C.gold}33`, borderRadius: 16, padding: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 28 }}>👑</div>
        <div>
          <div style={{ fontWeight: 800, color: C.gold, fontSize: 15 }}>PAINEL ADMINISTRADOR</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>Controle total do Preceptor Médico</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[
          { label: "Total", value: stats.total, color: C.accent },
          { label: "Ativos", value: stats.active, color: C.green },
          { label: "Pendentes", value: stats.pending, color: C.yellow },
          { label: "Bloqueados", value: stats.blocked, color: C.red },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px 8px", background: "transparent", border: "none",
            borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
            color: tab === t.id ? C.accent : C.textMuted, fontSize: 13, fontWeight: 700,
            cursor: "pointer",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}><Spinner size={32} /></div>
          ) : users.sort((a, b) => {
            const order = { pending: 0, active: 1, blocked: 2 };
            return (order[a.status] || 1) - (order[b.status] || 1);
          }).map(u => (
            <Card key={u.uid} style={{ marginBottom: 10, borderLeft: `3px solid ${u.status === "active" ? C.green : u.status === "pending" ? C.yellow : C.red}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                  {u.photoURL ? <img src={u.photoURL} style={{ width: 40, height: 40, borderRadius: "50%" }} alt="" /> : "👤"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{u.alias}</span>
                    {u.role === "admin" && <Badge color={C.gold}>👑 Admin</Badge>}
                    <Badge color={u.status === "active" ? C.green : u.status === "pending" ? C.yellow : C.red}>
                      {u.status === "active" ? "✅ Ativo" : u.status === "pending" ? "⏳ Pendente" : "🚫 Bloqueado"}
                    </Badge>
                    {u.canUploadMedia && <Badge color={C.purple}>📸 Mídia</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{u.email}</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                    {u.createdAt?.toDate?.()?.toLocaleDateString("pt-BR") || "—"}
                    {u.lastSeen?.toDate?.() && ` • Visto ${new Date(u.lastSeen.toDate()).toLocaleDateString("pt-BR")}`}
                  </div>
                  {u.uid !== currentUser.uid && (
                    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                      {u.status === "pending" && (
                        <Btn onClick={() => updateUser(u.uid, { status: "active" })} variant="success" size="sm">✅ Aprovar</Btn>
                      )}
                      {u.status === "active" && (
                        <Btn onClick={() => updateUser(u.uid, { status: "blocked" })} variant="danger" size="sm">🚫 Bloquear</Btn>
                      )}
                      {u.status === "blocked" && (
                        <Btn onClick={() => updateUser(u.uid, { status: "active" })} variant="success" size="sm">🔓 Reativar</Btn>
                      )}
                      <Btn onClick={() => updateUser(u.uid, { canUploadMedia: !u.canUploadMedia })} variant={u.canUploadMedia ? "warning" : "ghost"} size="sm">
                        {u.canUploadMedia ? "📸 Revogar mídia" : "📸 Dar mídia"}
                      </Btn>
                      {u.role !== "admin" && (
                        <Btn onClick={() => updateUser(u.uid, { role: "admin", canUploadMedia: true })} variant="gold" size="sm">👑 Admin</Btn>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Corps Tab */}
      {tab === "corps" && (
        <div>
          <Card style={{ marginBottom: 16, border: `1px solid ${C.accent}33` }}>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 10 }}>➕ Nova Corporação</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Input value={newCorpName} onChange={e => setNewCorpName(e.target.value)} placeholder="Nome do grupo (ex: Residentes HC 2025)" style={{ flex: 1 }} />
              <Btn onClick={createCorp} disabled={creating || !newCorpName.trim()} size="sm">
                {creating ? <Spinner size={12} /> : "Criar"}
              </Btn>
            </div>
          </Card>
          {corps.length === 0 ? (
            <Card style={{ textAlign: "center", color: C.textMuted, padding: 40 }}>Nenhuma corporação criada ainda.</Card>
          ) : corps.map(c => (
            <Card key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 28 }}>🏢</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: C.text }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{(c.members || []).length} membros</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.accent, letterSpacing: 2, background: C.accentDim, padding: "4px 12px", borderRadius: 8 }}>{c.inviteCode}</div>
                    <Btn onClick={() => navigator.clipboard.writeText(c.inviteCode)} variant="ghost" size="sm">📋</Btn>
                  </div>
                </div>
                <Btn onClick={() => deleteCorp(c.id)} variant="danger" size="sm">🗑️</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* API Tab */}
      {tab === "api" && (
        <div>
          <Card style={{ marginBottom: 12, border: `1px solid ${C.gold}33` }}>
            <div style={{ fontWeight: 700, color: C.gold, marginBottom: 8 }}>👑 Sua chave API (Admin)</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
              Com billing ativo. Usada para suas próprias sessões e fallback quando necessário.
            </div>
            <Input
              value={localStorage.getItem("geminiKey") || ""}
              onChange={e => localStorage.setItem("geminiKey", e.target.value)}
              placeholder="AIza... (sua chave Gemini com billing)"
              type="password"
            />
          </Card>
          <Card>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 8 }}>📊 Consumo por usuário (hoje)</div>
            {users.filter(u => u.status === "active").map(u => (
              <div key={u.uid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.text }}>{u.alias}</span>
                <Badge color={C.accent}>— consultas</Badge>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SETTINGS — chave API do usuário
// ============================================================
function SettingsModule({ userProfile }) {
  const [key, setKey] = useState(localStorage.getItem("geminiKey") || "");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  const save = () => {
    localStorage.setItem("geminiKey", key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const test = async () => {
    setTesting(true); setTestResult("");
    try {
      const reply = await callGemini({ prompt: "Responda apenas: 'Chave funcionando ✅'", apiKey: key, maxTokens: 20 });
      setTestResult(reply);
    } catch (e) {
      setTestResult("❌ Erro: " + e.message);
    }
    setTesting(false);
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 20 }}>⚙️ Configurações</div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
            {userProfile.photoURL ? <img src={userProfile.photoURL} style={{ width: 48, height: 48, borderRadius: "50%" }} alt="" /> : "👤"}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: C.text }}>{userProfile.alias}</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{userProfile.email}</div>
            <Badge color={userProfile.role === "admin" ? C.gold : C.accent}>{userProfile.role === "admin" ? "👑 Administrador" : "👤 Membro"}</Badge>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {userProfile.canUploadMedia && <Badge color={C.purple}>📸 Upload de mídia ativo</Badge>}
          <Badge color={C.green}>✅ {userProfile.status === "active" ? "Conta ativa" : userProfile.status}</Badge>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>🔑 Chave API Gemini</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
          Obtenha gratuitamente em{" "}
          <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: C.accent }}>aistudio.google.com</a>
          {" "}→ "Get API Key". O tier gratuito é mais que suficiente para uso diário.
        </div>
        <Input value={key} onChange={e => setKey(e.target.value)} placeholder="AIza..." type="password" style={{ marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={save} variant="success" size="sm">{saved ? "✅ Salvo!" : "💾 Salvar"}</Btn>
          <Btn onClick={test} disabled={testing || !key} variant="ghost" size="sm">
            {testing ? <Spinner size={12} /> : "🧪 Testar"}
          </Btn>
        </div>
        {testResult && <div style={{ fontSize: 12, marginTop: 10, color: testResult.includes("✅") ? C.green : C.red }}>{testResult}</div>}
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: C.red, marginBottom: 8 }}>Sair</div>
        <Btn onClick={() => signOut(auth)} variant="danger" size="sm">🚪 Desconectar</Btn>
      </Card>
    </div>
  );
}

// ============================================================
// CHAT MODULE
// ============================================================
function ChatModule({ userProfile }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: `👋 Olá, ${userProfile.alias}! Sou seu Preceptor Virtual.\n\nComo posso ajudar agora?\n• Dúvidas clínicas e condutas\n• Posologias completas com diluições\n• Análise de prescrições\n• Diagnósticos diferenciais\n• Interpretação de exames`,
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const endRef = useRef(null);
  const canUploadMedia = userProfile.canUploadMedia;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const handleFile = (file) => {
    if (!file) return;
    if (!canUploadMedia && (file.type.startsWith("image/") || file.type.startsWith("audio/") || file.type.startsWith("video/"))) {
      setError("Upload de mídia disponível apenas para administradores. Descreva o caso em texto.");
      return;
    }
    setMediaFile(file);
    if (file.type.startsWith("image/")) {
      const r = new FileReader(); r.onload = e => setMediaPreview(e.target.result); r.readAsDataURL(file);
    }
  };

  const send = async () => {
    if ((!input.trim() && !mediaFile) || loading) return;
    setError("");
    let imageBase64 = null, imageType = null, audioBase64 = null;
    if (mediaFile) {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(mediaFile); });
      if (mediaFile.type.startsWith("image/")) { imageBase64 = b64; imageType = mediaFile.type; }
      else if (mediaFile.type.startsWith("audio/")) { audioBase64 = b64; }
    }
    const userMsg = { role: "user", content: input.trim() || `[Arquivo: ${mediaFile?.name}]`, mediaPreview };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setMediaFile(null); setMediaPreview(null); setLoading(true);
    try {
      const reply = await callGemini({
        prompt: newMsgs.slice(-6).map(m => `${m.role === "user" ? "Residente" : "Preceptor"}: ${m.content}`).join("\n\n"),
        systemPrompt: PRECEPTOR_SYSTEM,
        imageBase64, imageType, audioBase64,
      });
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e.message);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ " + e.message }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 14, animation: "fadeIn 0.3s ease" }}>
            {msg.role === "assistant" && (
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, #4299e1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginRight: 8, flexShrink: 0, marginTop: 2, boxShadow: glow() }}>🩺</div>
            )}
            <div style={{ maxWidth: "80%" }}>
              {msg.mediaPreview && <img src={msg.mediaPreview} alt="" style={{ maxWidth: 180, borderRadius: 10, marginBottom: 6, display: "block" }} />}
              <div style={{
                background: msg.role === "user" ? `linear-gradient(135deg, #1a3a5c, #0d2d4a)` : C.surface,
                border: `1px solid ${msg.role === "user" ? C.accent + "33" : C.border}`,
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                padding: "10px 14px", fontSize: 13, lineHeight: 1.8, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0 8px 42px" }}><Spinner size={14} /><span style={{ fontSize: 12, color: C.accent }}>Preceptor analisando...</span></div>}
        <div ref={endRef} />
      </div>
      {error && <div style={{ color: C.red, fontSize: 12, padding: "6px 10px", background: C.redDim, borderRadius: 8, marginBottom: 8 }}>⚠️ {error}</div>}
      {!canUploadMedia && (
        <div style={{ fontSize: 11, color: C.textMuted, padding: "6px 10px", background: C.surface2, borderRadius: 8, marginBottom: 8 }}>
          📝 Upload de mídia disponível apenas para administradores. Use texto para descrever casos.
        </div>
      )}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        {mediaPreview && <img src={mediaPreview} alt="" style={{ height: 56, borderRadius: 8, marginBottom: 8 }} />}
        {mediaFile && !mediaPreview && <div style={{ fontSize: 11, color: C.accent, marginBottom: 8 }}>📎 {mediaFile.name}</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          {canUploadMedia && (
            <>
              <input ref={fileRef} type="file" accept="image/*,audio/*,.pdf" style={{ display: "none" }} onChange={e => handleFile(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} style={{ background: C.accentDim, border: `1px solid ${C.border}`, borderRadius: 10, color: C.accent, padding: "10px 12px", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>📎</button>
            </>
          )}
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Dúvida clínica, conduta, medicamento... (Enter para enviar)"
            rows={2} style={{ flex: 1, resize: "none", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 13, fontFamily: "inherit" }} />
          <button onClick={send} disabled={loading || (!input.trim() && !mediaFile)} style={{
            background: `linear-gradient(135deg, ${C.accent}, #4299e1)`, border: "none", borderRadius: 10,
            color: "#fff", padding: "10px 14px", cursor: "pointer", fontSize: 18, flexShrink: 0,
            opacity: loading ? 0.4 : 1,
          }}>➤</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DAILY DISEASES MODULE
// ============================================================
function DailyModule() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeMode, setTimeMode] = useState("10");
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const TIME_MODES = [
    { id: "2", label: "⚡ 2 min", desc: "Flash — 1 conceito por doença" },
    { id: "5", label: "📋 5 min", desc: "Resumo completo condensado" },
    { id: "10", label: "🩺 10 min", desc: "Casos clínicos incluídos" },
    { id: "20", label: "📚 20 min", desc: "Estudo profundo completo" },
  ];

  const buildPrompt = () => {
    const prompts = {
      "2": `Gere 5 doenças de hoje em formato FLASH (máx 200 palavras cada). Para cada uma:
## ⚡ DOENÇA [N]: [NOME]
**Suspeitar quando:** 1 frase
**Diagnóstico:** critério principal + 1 exame chave  
**Tratamento:** 1-2 medicamentos com dose
**Não esqueça:** 1 pearl crítico`,

      "5": `Gere 5 doenças de hoje em formato RESUMO (máx 400 palavras cada). Para cada:
## 📋 DOENÇA [N]: [NOME]
### Quadro clínico (breve)
### Diagnóstico (critérios + exames chave)
### Tratamento (medicamentos com posologia completa)
### Alta vs Internação (critérios objetivos)`,

      "10": `Gere 5 doenças de hoje com casos clínicos. Para cada:
## 🩺 DOENÇA [N]: [NOME]
### Quadro clínico / Como suspeitar
### Diagnóstico (critérios, exames, valores)
### Diagnósticos diferenciais (3 principais)
### Tratamento COMPLETO (posologia com diluição)
### Alta vs Internação (enfermaria/UTI)
### Perguntas críticas na beira do leito
### Caso clínico (1 caso realista)`,

      "20": `Gere 5 doenças de hoje em formato COMPLETO. Para cada:
## 📚 DOENÇA [N]: [NOME]
### Como suspeitar / Quadro clínico (típico e atípico)
### Fisiopatologia (breve)
### Diagnóstico (critérios completos, exames, valores de corte, scores)
### Diagnósticos diferenciais (5 com como diferenciar)
### Tratamento COMPLETO (CADA medicamento: dose, via, diluição completa, frequência, ajuste renal, contraindicações, interações)
### Critérios de alta e manejo ambulatorial
### Critérios de internação (enfermaria vs semi-intensiva vs UTI)
### 10+ Perguntas críticas na beira do leito
### 3 Casos clínicos (típico, atípico, diferencial desafiador)
### Referências (guidelines, nível de evidência)`,
    };
    return `Hoje é ${today}. ${prompts[timeMode]}\n\nEscolha 5 doenças variadas: cardiovascular, pulmonar, infecciosa, metabólica, neurológica/emergência. Baseie-se nos livros USP de Clínica Médica, Abramed e guidelines internacionais.`;
  };

  const load = async () => {
    setLoading(true); setContent("");
    try {
      const reply = await callGemini({ prompt: buildPrompt(), systemPrompt: PRECEPTOR_SYSTEM, maxTokens: timeMode === "20" ? 6000 : timeMode === "10" ? 4000 : 2000 });
      setContent(reply);
    } catch (e) { setContent("⚠️ " + e.message); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>📚 Doenças do Dia</div>
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>{today}</div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Quanto tempo você tem?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {TIME_MODES.map(t => (
            <button key={t.id} onClick={() => setTimeMode(t.id)} style={{
              background: timeMode === t.id ? C.accentDim : "transparent",
              border: `1px solid ${timeMode === t.id ? C.accent : C.border}`,
              borderRadius: 10, color: timeMode === t.id ? C.accent : C.textMuted,
              padding: "10px 12px", cursor: "pointer", textAlign: "left",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</div>
              <div style={{ fontSize: 11, marginTop: 2, opacity: 0.8 }}>{t.desc}</div>
            </button>
          ))}
        </div>
        <Btn onClick={load} disabled={loading} full>
          {loading ? <><Spinner size={14} /> Gerando doenças de hoje...</> : "🎯 Estudar Agora"}
        </Btn>
      </Card>

      {content && (
        <Card style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.9, color: C.text, animation: "fadeIn 0.4s ease" }}>
          {content.split("\n").map((line, i) => {
            if (line.startsWith("## ")) return <div key={i} style={{ fontWeight: 900, color: C.accent, fontSize: 15, marginTop: 28, marginBottom: 8, borderLeft: `3px solid ${C.accent}`, paddingLeft: 12 }}>{line.replace("## ", "")}</div>;
            if (line.startsWith("### ")) return <div key={i} style={{ fontWeight: 700, color: C.text, fontSize: 13, marginTop: 14, marginBottom: 4 }}>{line.replace("### ", "")}</div>;
            if (line.startsWith("**") && line.endsWith("**")) return <div key={i} style={{ fontWeight: 700, color: C.yellow }}>{line.slice(2, -2)}</div>;
            return <div key={i}>{line || "\u00A0"}</div>;
          })}
        </Card>
      )}
    </div>
  );
}

// ============================================================
// DRUG MODULE
// ============================================================
function DrugModule() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const QUICK = ["Norepinefrina", "Dobutamina", "Vasopressina", "Meropeném", "Piperacilina-Tazobactam", "Vancomicina", "Furosemida EV", "Heparina", "Alteplase", "Midazolam", "Propofol", "Fentanil", "Insulina EV", "Amiodarona", "Adenosina", "Morfina", "Metilprednisolona", "Dexametasona"];

  const search = async () => {
    if (!query.trim() || loading) return;
    setLoading(true); setResult("");
    try {
      const reply = await callGemini({
        prompt: `Detalhe COMPLETAMENTE o medicamento: ${query}\n\n1. Nome genérico + comerciais no Brasil\n2. Mecanismo de ação\n3. Indicações (todas)\n4. POSOLOGIA por indicação (cada uma separada)\n5. Apresentações no Brasil\n6. DILUIÇÃO: qual solução, volume, concentração máxima, tempo de infusão\n7. Reconstituição se pó liofilizado\n8. Ajuste renal (TFG <60, <30, <15, diálise)\n9. Ajuste hepático (Child A/B/C)\n10. Contraindicações absolutas e relativas\n11. Interações clinicamente relevantes (top 5)\n12. Efeitos adversos importantes\n13. Monitoramento necessário\n14. Pearls clínicos\n15. Nível de evidência + referência`,
        systemPrompt: PRECEPTOR_SYSTEM,
        maxTokens: 3000,
      });
      setResult(reply);
    } catch (e) { setResult("⚠️ " + e.message); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>💊 Consulta de Medicamento</div>
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Posologia completa com diluição, ajuste renal e evidências</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="Nome do medicamento..." style={{ flex: 1 }} />
        <Btn onClick={search} disabled={loading || !query.trim()}>{loading ? <Spinner size={14} /> : "🔍"}</Btn>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {QUICK.map(d => (
          <button key={d} onClick={() => { setQuery(d); }} style={{ background: C.accentDim, border: `1px solid ${C.border}`, borderRadius: 8, color: C.accent, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>{d}</button>
        ))}
      </div>
      {result && <Card style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.8, color: C.text, animation: "fadeIn 0.4s ease" }}>{result}</Card>}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
const TABS_MEMBER = [
  { id: "chat", icon: "💬", label: "Preceptor" },
  { id: "daily", icon: "📚", label: "Estudo" },
  { id: "drug", icon: "💊", label: "Medicamento" },
  { id: "settings", icon: "⚙️", label: "Config" },
];

const TABS_ADMIN = [
  { id: "chat", icon: "💬", label: "Preceptor" },
  { id: "daily", icon: "📚", label: "Estudo" },
  { id: "drug", icon: "💊", label: "Medicamento" },
  { id: "admin", icon: "👑", label: "Admin" },
  { id: "settings", icon: "⚙️", label: "Config" },
];

export default function App() {
  const [authState, setAuthState] = useState("loading"); // loading | unauthenticated | pending | active
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setAuthState("unauthenticated"); return; }
      setCurrentUser(user);
      // Listen to profile changes
      const unsub2 = onSnapshot(doc(db, "users", user.uid), (snap) => {
        if (snap.exists()) {
          const profile = snap.data();
          setUserProfile(profile);
          setAuthState(profile.status === "active" ? "active" : "pending");
        }
      });
      return unsub2;
    });
    return unsub;
  }, []);

  if (authState === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🩺</div>
          <Spinner size={32} />
        </div>
      </div>
    );
  }

  if (authState === "unauthenticated") return <LoginScreen onLogin={setCurrentUser} />;
  if (authState === "pending") return <PendingScreen user={currentUser} />;

  const isAdmin = userProfile?.role === "admin";
  const TABS = isAdmin ? TABS_ADMIN : TABS_MEMBER;

  const renderTab = () => {
    switch (activeTab) {
      case "chat": return <ChatModule userProfile={userProfile} />;
      case "daily": return <DailyModule />;
      case "drug": return <DrugModule />;
      case "admin": return isAdmin ? <AdminDashboard currentUser={currentUser} userProfile={userProfile} /> : null;
      case "settings": return <SettingsModule userProfile={userProfile} />;
      default: return <ChatModule userProfile={userProfile} />;
    }
  };

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: C.bg, minHeight: "100vh", color: C.text, display: "flex", flexDirection: "column", maxWidth: 800, margin: "0 auto" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:${C.bg}} ::-webkit-scrollbar-thumb{background:${C.surface2};border-radius:2px}
        input:focus,textarea:focus,select:focus{outline:none;border-color:${C.accent}!important}
        button:active{opacity:.85}
      `}</style>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, #4299e1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: glow(), flexShrink: 0 }}>🩺</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: C.text, letterSpacing: 0.5 }}>PRECEPTOR MÉDICO</div>
          <div style={{ fontSize: 10, color: C.accent, letterSpacing: 1.5 }}>CLÍNICA MÉDICA • EVIDÊNCIAS</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAdmin && <Badge color={C.gold}>👑</Badge>}
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
          <span style={{ fontSize: 11, color: C.textMuted }}>{userProfile?.alias?.split(" ")[0]}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, paddingBottom: 80 }}>
        {renderTab()}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 800, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 100 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: "10px 4px 8px", background: activeTab === tab.id ? C.accentDim : "transparent",
            border: "none", borderTop: activeTab === tab.id ? `2px solid ${C.accent}` : "2px solid transparent",
            color: activeTab === tab.id ? C.accent : C.textMuted, cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "all 0.2s",
          }}>
            <span style={{ fontSize: tab.id === "admin" ? 16 : 18 }}>{tab.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3 }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
