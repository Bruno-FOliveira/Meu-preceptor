import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import {
  auth,
  onAuthChange,
  getOrCreateUser,
  loginWithGoogle,
  logout,
  ADMIN_EMAIL,
} from "./firebase.js";

// ── DESIGN ────────────────────────────────────────────────
const C = {
  bg: "#060c18", surface: "#0b1628",
  border: "rgba(99,179,237,0.1)", accent: "#63b3ed",
  accentDim: "rgba(99,179,237,0.12)", green: "#68d391",
  red: "#fc8181", redDim: "rgba(252,129,129,0.12)",
  gold: "#f6ad55", text: "#e8f4fd", textMuted: "#718096",
};

function Spinner() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20 }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: `linear-gradient(135deg,${C.accent},#4299e1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🩺</div>
      <div style={{ width: 24, height: 24, border: `3px solid ${C.accent}33`, borderTop: `3px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function LoginScreen({ loading, onLogin, error }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Georgia',serif" }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: "100%", maxWidth: 400, animation: "fadeIn 0.5s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg,${C.accent},#4299e1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 20px", boxShadow: `0 0 30px ${C.accent}33` }}>🩺</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: C.text }}>PRECEPTOR MÉDICO</div>
          <div style={{ fontSize: 12, color: C.accent, letterSpacing: 3, marginTop: 6 }}>CLÍNICA MÉDICA • RESIDÊNCIA</div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28 }}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 16, marginBottom: 6, textAlign: "center" }}>Acesso exclusivo</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, textAlign: "center", lineHeight: 1.6 }}>
            Entre com sua conta Google.<br />
            Novos usuários precisam de aprovação do administrador.
          </div>

          <button
            onClick={onLogin}
            disabled={loading}
            style={{
              width: "100%", padding: 16, borderRadius: 12,
              border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.06)",
              color: C.text, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
              fontFamily: "inherit", transition: "all 0.2s",
            }}
          >
            {loading
              ? <><div style={{ width: 18, height: 18, border: `2px solid ${C.accent}33`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Entrando...</>
              : <><span style={{ fontSize: 20, fontWeight: 900, color: C.accent }}>G</span> Entrar com Google</>
            }
          </button>

          {error && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: C.redDim, border: `1px solid ${C.red}44`, borderRadius: 10, fontSize: 13, color: C.red, textAlign: "center" }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: C.textMuted }}>
          🔒 Dados protegidos · LGPD · Uso educacional interno
        </div>
      </div>
    </div>
  );
}

function PendingScreen({ user, onLogout }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Georgia',serif" }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32, maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Aguardando aprovação</div>
        <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 24 }}>
          Sua conta <strong style={{ color: C.accent }}>{user.email}</strong> foi criada e está aguardando aprovação do administrador (Bruno).
          <br /><br />
          Você receberá acesso em breve.
        </div>
        <button onClick={onLogout} style={{ background: C.accentDim, border: `1px solid ${C.border}`, borderRadius: 10, color: C.accent, padding: "10px 24px", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}>
          Sair
        </button>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────
function Root() {
  const [authState, setAuthState] = useState("loading"); // loading | unauthenticated | pending | active
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const unsub = onAuthChange(async (fbUser) => {
      if (!fbUser) {
        setAuthState("unauthenticated");
        setFirebaseUser(null);
        setUserProfile(null);
        return;
      }
      setFirebaseUser(fbUser);
      try {
        const profile = await getOrCreateUser(fbUser);
        setUserProfile(profile);
        setAuthState(profile.status === "active" ? "active" : "pending");
      } catch (e) {
        console.error("Profile error:", e);
        setAuthState("unauthenticated");
      }
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError("");
    try {
      await loginWithGoogle();
      // onAuthChange vai cuidar do resto
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        setLoginError(e.message);
      }
    }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    setAuthState("unauthenticated");
  };

  if (authState === "loading") return <Spinner />;
  if (authState === "unauthenticated") return <LoginScreen loading={loginLoading} onLogin={handleLogin} error={loginError} />;
  if (authState === "pending") return <PendingScreen user={firebaseUser} onLogout={handleLogout} />;

  // Passa o usuário e perfil para o App
  return (
    <App
      firebaseUser={firebaseUser}
      userProfile={userProfile}
      onLogout={handleLogout}
    />
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
