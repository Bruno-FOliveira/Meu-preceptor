import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import {
  auth, db, onAuthChange, getOrCreateUser, loginWithGoogle, logout, ADMIN_EMAIL,
  getAreas, saveArea, deleteArea, getPatients, savePatient, deletePatient,
} from "./firebase.js";

const C = { bg:"#060c18",surface:"#0b1628",border:"rgba(99,179,237,0.1)",accent:"#63b3ed",accentDim:"rgba(99,179,237,0.12)",red:"#fc8181",redDim:"rgba(252,129,129,0.12)",text:"#e8f4fd",textMuted:"#718096" };

function Spinner({ message="Carregando..." }) {
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,fontFamily:"'Georgia',serif"}}>
      <div style={{width:60,height:60,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#4299e1)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>🩺</div>
      <div style={{width:28,height:28,border:`3px solid ${C.accent}33`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <div style={{fontSize:13,color:C.textMuted}}>{message}</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function LoginScreen({ loading, onLogin, error }) {
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Georgia',serif"}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:"100%",maxWidth:400,animation:"fadeIn 0.5s ease"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{width:80,height:80,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#4299e1)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 20px",boxShadow:`0 0 30px ${C.accent}33`}}>🩺</div>
          <div style={{fontSize:26,fontWeight:900,color:C.text}}>PRECEPTOR MÉDICO</div>
          <div style={{fontSize:12,color:C.accent,letterSpacing:3,marginTop:6}}>CLÍNICA MÉDICA • RESIDÊNCIA</div>
        </div>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:28}}>
          <div style={{fontWeight:700,color:C.text,fontSize:16,marginBottom:6,textAlign:"center"}}>Entrar com Google</div>
          <div style={{fontSize:13,color:C.textMuted,marginBottom:24,textAlign:"center",lineHeight:1.6}}>
            Dados sincronizados entre web e celular automaticamente.
          </div>
          <button onClick={onLogin} disabled={loading} style={{width:"100%",padding:16,borderRadius:12,border:`1px solid ${C.border}`,background:"rgba(255,255,255,0.06)",color:C.text,fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:14,fontFamily:"inherit"}}>
            {loading
              ? <><div style={{width:18,height:18,border:`2px solid ${C.accent}33`,borderTop:`2px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/> Entrando...</>
              : <><span style={{fontSize:22,fontWeight:900,color:"#4285f4"}}>G</span> Entrar com Google</>
            }
          </button>
          {error&&(
            <div style={{marginTop:14,padding:"10px 14px",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:10,fontSize:12,color:C.red,lineHeight:1.6}}>
              ⚠️ {error}
              {error.includes("unauthorized-domain")&&(
                <div style={{marginTop:8,color:C.textMuted}}>
                  <strong style={{color:C.text}}>Como resolver:</strong><br/>
                  Firebase Console → Authentication → Settings → Authorized domains → Add domain → <strong style={{color:C.accent}}>meu-preceptor-vkoi.vercel.app</strong>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{textAlign:"center",marginTop:20,fontSize:11,color:C.textMuted}}>🔒 Firebase · Dados criptografados</div>
      </div>
    </div>
  );
}

function PendingScreen({ user, onLogout }) {
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Georgia',serif"}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:32,maxWidth:400,textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}}>⏳</div>
        <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:8}}>Aguardando aprovação</div>
        <div style={{fontSize:13,color:C.textMuted,lineHeight:1.7,marginBottom:24}}>
          Conta <strong style={{color:C.accent}}>{user.email}</strong> criada e aguardando aprovação.
        </div>
        <button onClick={onLogout} style={{background:C.accentDim,border:`1px solid ${C.border}`,borderRadius:10,color:C.accent,padding:"10px 24px",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>Sair</button>
      </div>
    </div>
  );
}

// ── FIREBASE DATA SYNC ─────────────────────────────────────
function useFirebaseSync(uid) {
  const [areas, setAreas] = useState(null);
  const [patients, setPatients] = useState(null);
  const [syncing, setSyncing] = useState(true);
  const [syncStatus, setSyncStatus] = useState("Sincronizando...");

  const DEFAULT_AREAS = [{ id:"enfermaria",name:"Enfermaria",icon:"🏥",color:"#63b3ed",permanent:true,createdAt:new Date().toISOString() }];

  const loadFromFirebase = useCallback(async () => {
    if (!uid) return;
    setSyncing(true);
    setSyncStatus("Carregando dados da nuvem...");
    try {
      const [fbAreas, fbPatients] = await Promise.all([
        getAreas(uid),
        getPatients(uid),
      ]);
      const a = fbAreas.length > 0 ? fbAreas : DEFAULT_AREAS;
      const p = fbPatients;
      setAreas(a);
      setPatients(p);
      // Atualiza cache local
      localStorage.setItem("fb_areas", JSON.stringify(a));
      localStorage.setItem("fb_patients", JSON.stringify(p));
      setSyncStatus("✅ Sincronizado");
    } catch (e) {
      console.warn("Firebase load failed, using local cache:", e);
      // Usa cache local se Firebase falhar
      const cachedAreas = JSON.parse(localStorage.getItem("fb_areas") || "null") || DEFAULT_AREAS;
      const cachedPatients = JSON.parse(localStorage.getItem("fb_patients") || "null") || [];
      setAreas(cachedAreas);
      setPatients(cachedPatients);
      setSyncStatus("⚠️ Offline — usando cache");
    }
    setSyncing(false);
  }, [uid]);

  useEffect(() => { loadFromFirebase(); }, [loadFromFirebase]);

  // Sync individual patient
  const syncPatient = useCallback(async (patient) => {
    // Atualiza estado local imediatamente
    setPatients(prev => {
      const exists = prev?.find(p => p.id === patient.id);
      const updated = exists
        ? prev.map(p => p.id === patient.id ? patient : p)
        : [...(prev || []), patient];
      localStorage.setItem("fb_patients", JSON.stringify(updated));
      return updated;
    });
    // Sincroniza Firebase em background
    if (uid) {
      try { await savePatient(uid, patient); }
      catch(e) { console.warn("Patient sync failed:", e); }
    }
  }, [uid]);

  const addNewPatient = useCallback(async (patient) => {
    const withId = { ...patient, id: patient.id || Date.now().toString(), createdAt: new Date().toISOString() };
    setPatients(prev => {
      const updated = [...(prev || []), withId];
      localStorage.setItem("fb_patients", JSON.stringify(updated));
      return updated;
    });
    if (uid) {
      try { await savePatient(uid, withId); }
      catch(e) { console.warn("Patient add failed:", e); }
    }
    return withId;
  }, [uid]);

  const removePatientById = useCallback(async (patientId) => {
    setPatients(prev => {
      const updated = (prev || []).filter(p => p.id !== patientId);
      localStorage.setItem("fb_patients", JSON.stringify(updated));
      return updated;
    });
    if (uid) {
      try { await deletePatient(uid, patientId); }
      catch(e) { console.warn("Patient delete failed:", e); }
    }
  }, [uid]);

  const syncAreas = useCallback(async (newAreas) => {
    setAreas(newAreas);
    localStorage.setItem("fb_areas", JSON.stringify(newAreas));
    if (uid) {
      try { for (const a of newAreas) await saveArea(uid, a); }
      catch(e) { console.warn("Areas sync failed:", e); }
    }
  }, [uid]);

  const addNewArea = useCallback(async (area) => {
    const withId = { ...area, id: area.id || Date.now().toString(), createdAt: new Date().toISOString() };
    setAreas(prev => {
      const updated = [...(prev || []), withId];
      localStorage.setItem("fb_areas", JSON.stringify(updated));
      return updated;
    });
    if (uid) {
      try { await saveArea(uid, withId); }
      catch(e) { console.warn("Area add failed:", e); }
    }
  }, [uid]);

  const removeAreaById = useCallback(async (areaId) => {
    setAreas(prev => {
      const updated = (prev || []).filter(a => a.id !== areaId);
      localStorage.setItem("fb_areas", JSON.stringify(updated));
      return updated;
    });
    if (uid) {
      try { await deleteArea(uid, areaId); }
      catch(e) { console.warn("Area delete failed:", e); }
    }
  }, [uid]);

  return {
    areas: areas || DEFAULT_AREAS,
    patients: patients || [],
    syncing, syncStatus,
    syncPatient, addNewPatient, removePatientById,
    syncAreas, addNewArea, removeAreaById,
    reload: loadFromFirebase,
  };
}

// ── ROOT ──────────────────────────────────────────────────
function Root() {
  const [authState, setAuthState] = useState("loading");
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
        // Sem internet — deixa entrar se for o admin
        if (fbUser.email === ADMIN_EMAIL) {
          setUserProfile({ uid:fbUser.uid, email:fbUser.email, alias:fbUser.displayName||"Bruno", role:"admin", status:"active" });
          setAuthState("active");
        } else {
          setAuthState("unauthenticated");
        }
      }
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError("");
    try {
      await loginWithGoogle();
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        setLoginError(e.message || e.code || "Erro ao fazer login");
      }
    }
    setLoginLoading(false);
  };

  if (authState === "loading") return <Spinner message="Verificando acesso..."/>;
  if (authState === "unauthenticated") return <LoginScreen loading={loginLoading} onLogin={handleLogin} error={loginError}/>;
  if (authState === "pending") return <PendingScreen user={firebaseUser} onLogout={()=>{logout();setAuthState("unauthenticated");}}/>;

  return <AppWithSync firebaseUser={firebaseUser} userProfile={userProfile} onLogout={()=>{logout();setAuthState("unauthenticated");}}/>;
}

function AppWithSync({ firebaseUser, userProfile, onLogout }) {
  const uid = firebaseUser?.uid;
  const sync = useFirebaseSync(uid);

  if (sync.syncing && !sync.areas.length) return <Spinner message={sync.syncStatus}/>;

  return (
    <App
      firebaseUser={firebaseUser}
      userProfile={userProfile}
      onLogout={onLogout}
      firebaseAreas={sync.areas}
      firebasePatients={sync.patients}
      syncStatus={sync.syncStatus}
      onUpdatePatient={sync.syncPatient}
      onAddPatient={sync.addNewPatient}
      onRemovePatient={sync.removePatientById}
      onUpdateAreas={sync.syncAreas}
      onAddArea={sync.addNewArea}
      onRemoveArea={sync.removeAreaById}
      onReloadData={sync.reload}
    />
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><Root /></React.StrictMode>
);
