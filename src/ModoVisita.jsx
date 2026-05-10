// ============================================================
// MODO VISITA — Preceptor Médico
// Visualização ultra-rápida na beira do leito
// Vitais, labs, ATB, medicamentos, pendências — tudo em 1 tela
// Swipe entre pacientes da mesma área
// ============================================================

import { useState, useRef, useEffect, useCallback } from "react";

const C = {
  bg: "#060c18", surface: "#0b1628", surface2: "#0f1f38",
  border: "rgba(99,179,237,0.1)", accent: "#63b3ed", accentDim: "rgba(99,179,237,0.12)",
  green: "#68d391", greenDim: "rgba(104,211,145,0.12)",
  red: "#fc8181", redDim: "rgba(252,129,129,0.12)",
  yellow: "#f6e05e", yellowDim: "rgba(246,224,94,0.12)",
  purple: "#b794f4", purpleDim: "rgba(183,148,244,0.12)",
  gold: "#f6ad55", teal: "#4fd1c5",
  text: "#e8f4fd", textMuted: "#718096", textDim: "#2d3748",
};

const STATUS = {
  stable: { icon: "🟢", label: "Estável", color: C.green },
  attention: { icon: "🟡", label: "Atenção", color: C.yellow },
  critical: { icon: "🔴", label: "Crítico", color: C.red },
  intercurrence: { icon: "⚡", label: "Intercorrência", color: C.accent },
  resolved: { icon: "✅", label: "Resolvido", color: C.green },
  discharge: { icon: "🏠", label: "Alta possível", color: C.green },
  covering: { icon: "🔄", label: "Cobertura", color: C.textMuted },
};
const GENDER = { M: "👨", F: "👩", O: "🧑" };

function Badge({ color = C.accent, children, style }) {
  return <span style={{ background: `${color}1a`, border: `1px solid ${color}33`, borderRadius: 6, padding: "2px 8px", fontSize: 11, color, fontWeight: 700, ...style }}>{children}</span>;
}

function Btn({ onClick, disabled, variant = "primary", children, style, size = "md", full }) {
  const v = {
    primary: { background: `linear-gradient(135deg,${C.accent},#4299e1)`, color: "#fff", border: "none" },
    ghost: { background: C.accentDim, color: C.accent, border: `1px solid ${C.border}` },
    danger: { background: C.redDim, color: C.red, border: `1px solid ${C.red}33` },
    success: { background: C.greenDim, color: C.green, border: `1px solid ${C.green}33` },
    warning: { background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}33` },
  };
  const s = { sm: { padding: "5px 12px", fontSize: 12 }, md: { padding: "9px 20px", fontSize: 13 }, lg: { padding: "12px 24px", fontSize: 14 } };
  return <button onClick={onClick} disabled={disabled} style={{ borderRadius: 10, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, transition: "all 0.2s", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, width: full ? "100%" : undefined, justifyContent: full ? "center" : undefined, ...v[variant], ...s[size], ...style }}>{children}</button>;
}

function Input({ value, onChange, onKeyDown, placeholder, type = "text", style }) {
  return <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box", ...style }} />;
}

// Calcula dias de internamento
function diasInternamento(admissionDate) {
  if (!admissionDate) return null;
  const diff = Date.now() - new Date(admissionDate);
  return Math.floor(diff / 86400000);
}

// Tendência de lab
function Trend({ value, ref: refVal, unit, label, alert }) {
  const num = parseFloat(value);
  const refNum = parseFloat(refVal);
  const isHigh = !isNaN(num) && !isNaN(refNum) && num > refNum;
  const isLow = !isNaN(num) && !isNaN(refNum) && num < refNum;
  const color = alert === "high" ? C.red : alert === "low" ? C.accent : isHigh ? C.red : isLow ? C.accent : C.green;
  return (
    <div style={{ background: value ? `${color}11` : C.surface2, border: `1px solid ${value ? color + "33" : C.border}`, borderRadius: 10, padding: "8px 10px", textAlign: "center", minWidth: 72 }}>
      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: value ? color : C.textDim }}>
        {value || "—"}
        {value && isHigh && <span style={{ fontSize: 10 }}> ↑</span>}
        {value && isLow && <span style={{ fontSize: 10 }}> ↓</span>}
      </div>
      {unit && <div style={{ fontSize: 9, color: C.textMuted }}>{unit}</div>}
    </div>
  );
}

// ============================================================
// PAINEL DE VITAIS — edição rápida
// ============================================================
function VitaisPanel({ patient, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const v = patient.vitals || {};
  const [form, setForm] = useState(v);
  const s = (k, val) => setForm(f => ({ ...f, [k]: val }));

  const save = () => {
    onUpdate({ ...patient, vitals: form, vitalsDate: new Date().toISOString() });
    setEditing(false);
  };

  const VITALS_CONFIG = [
    { key: "pas", label: "PAS", unit: "mmHg", alert: v.pas > 160 ? "high" : v.pas < 90 ? "low" : null },
    { key: "pad", label: "PAD", unit: "mmHg", alert: v.pad > 100 ? "high" : v.pad < 60 ? "low" : null },
    { key: "fc", label: "FC", unit: "bpm", alert: v.fc > 100 ? "high" : v.fc < 60 ? "low" : null },
    { key: "fr", label: "FR", unit: "irpm", alert: v.fr > 20 ? "high" : null },
    { key: "spo2", label: "SpO2", unit: "%", alert: v.spo2 < 94 ? "low" : null },
    { key: "temp", label: "T°C", unit: "°C", alert: v.temp > 37.8 ? "high" : v.temp < 36 ? "low" : null },
  ];

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, letterSpacing: 1 }}>💉 VITAIS HOJE</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {patient.vitalsDate && <span style={{ fontSize: 10, color: C.textDim }}>{new Date(patient.vitalsDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={() => { setForm(v); setEditing(!editing); }} style={{ background: editing ? C.greenDim : C.accentDim, border: `1px solid ${editing ? C.green : C.border}`, borderRadius: 6, color: editing ? C.green : C.accent, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
            {editing ? "💾 Salvar" : "✏️"}
          </button>
          {editing && <button onClick={save} style={{ background: C.greenDim, border: `1px solid ${C.green}33`, borderRadius: 6, color: C.green, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>OK</button>}
        </div>
      </div>
      {editing ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {VITALS_CONFIG.map(vc => (
            <div key={vc.key}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>{vc.label} ({vc.unit})</div>
              <Input value={form[vc.key] || ""} onChange={e => s(vc.key, e.target.value)} placeholder="—" type="number" style={{ fontSize: 14, padding: "7px 10px", textAlign: "center" }} />
            </div>
          ))}
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>Diurese (mL/24h)</div>
            <Input value={form.diurese || ""} onChange={e => s("diurese", e.target.value)} placeholder="—" type="number" style={{ fontSize: 14, padding: "7px 10px" }} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>Observação</div>
            <Input value={form.obs || ""} onChange={e => s("obs", e.target.value)} placeholder="Ex: em O2 2L/min, IOT, NPP..." style={{ fontSize: 12 }} />
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {VITALS_CONFIG.map(vc => <Trend key={vc.key} value={v[vc.key]} label={vc.label} unit={vc.unit} alert={vc.alert} />)}
            {v.diurese && <Trend value={v.diurese} label="Diurese" unit="mL" />}
          </div>
          {v.obs && <div style={{ fontSize: 12, color: C.yellow, marginTop: 6 }}>⚠️ {v.obs}</div>}
          {!Object.keys(v).length && <div style={{ color: C.textDim, fontSize: 12, textAlign: "center", padding: "8px 0" }}>Toque em ✏️ para adicionar vitais de hoje</div>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PAINEL DE LABS
// ============================================================
function LabsPanel({ patient, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const labs = patient.labs || {};
  const [form, setForm] = useState(labs);
  const s = (k, val) => setForm(f => ({ ...f, [k]: val }));

  const save = () => {
    onUpdate({ ...patient, labs: form, labsDate: new Date().toISOString() });
    setEditing(false);
  };

  const LABS_CONFIG = [
    { key: "hb", label: "Hb", unit: "g/dL", low: 12, high: 17 },
    { key: "ht", label: "Ht", unit: "%", low: 36, high: 50 },
    { key: "leuco", label: "Leuco", unit: "k/µL", low: 4, high: 10 },
    { key: "plaq", label: "Plaq", unit: "k/µL", low: 150, high: 400 },
    { key: "cr", label: "Cr", unit: "mg/dL", low: 0.6, high: 1.2 },
    { key: "ur", label: "Ur", unit: "mg/dL", low: 15, high: 40 },
    { key: "na", label: "Na", unit: "mEq/L", low: 136, high: 145 },
    { key: "k", label: "K", unit: "mEq/L", low: 3.5, high: 5.0 },
    { key: "cl", label: "Cl", unit: "mEq/L", low: 98, high: 107 },
    { key: "glicemia", label: "Glic", unit: "mg/dL", low: 70, high: 140 },
    { key: "pcr", label: "PCR", unit: "mg/L", low: 0, high: 5 },
    { key: "ast", label: "AST", unit: "U/L", low: 0, high: 40 },
    { key: "alt", label: "ALT", unit: "U/L", low: 0, high: 40 },
    { key: "ldh", label: "LDH", unit: "U/L", low: 0, high: 250 },
    { key: "lactato", label: "Lact", unit: "mmol/L", low: 0, high: 2 },
    { key: "tni", label: "TnI", unit: "ng/L", low: 0, high: 14 },
    { key: "bnp", label: "BNP", unit: "pg/mL", low: 0, high: 100 },
    { key: "inr", label: "INR", unit: "", low: 0.8, high: 1.2 },
    { key: "fibri", label: "Fibri", unit: "mg/dL", low: 200, high: 400 },
    { key: "ddimer", label: "D-dim", unit: "ng/mL", low: 0, high: 500 },
    { key: "gasph", label: "pH", unit: "", low: 7.35, high: 7.45 },
    { key: "pco2", label: "pCO2", unit: "mmHg", low: 35, high: 45 },
    { key: "hco3", label: "HCO3", unit: "mEq/L", low: 22, high: 26 },
  ];

  // Apenas labs com valores
  const filledLabs = LABS_CONFIG.filter(l => labs[l.key]);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: C.purple, fontWeight: 700, letterSpacing: 1 }}>🧪 LABORATÓRIO</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {patient.labsDate && <span style={{ fontSize: 10, color: C.textDim }}>{new Date(patient.labsDate).toLocaleDateString("pt-BR")}</span>}
          <button onClick={() => { setForm(labs); setEditing(!editing); }} style={{ background: editing ? C.greenDim : C.accentDim, border: `1px solid ${editing ? C.green : C.border}`, borderRadius: 6, color: editing ? C.green : C.accent, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
            {editing ? "💾" : "✏️"}
          </button>
          {editing && <button onClick={save} style={{ background: C.greenDim, border: `1px solid ${C.green}33`, borderRadius: 6, color: C.green, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>OK</button>}
        </div>
      </div>

      {editing ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {LABS_CONFIG.map(l => (
            <div key={l.key}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{l.label} {l.unit && <span style={{ color: C.textDim }}>({l.unit})</span>}</div>
              <Input value={form[l.key] || ""} onChange={e => s(l.key, e.target.value)} placeholder="—" style={{ fontSize: 13, padding: "6px 8px", textAlign: "center" }} />
            </div>
          ))}
        </div>
      ) : filledLabs.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {filledLabs.map(l => {
            const val = parseFloat(labs[l.key]);
            const isHigh = val > l.high;
            const isLow = val < l.low;
            const color = isHigh ? C.red : isLow ? C.accent : C.green;
            return (
              <div key={l.key} style={{ background: `${color}11`, border: `1px solid ${color}33`, borderRadius: 8, padding: "5px 10px", textAlign: "center", minWidth: 60 }}>
                <div style={{ fontSize: 9, color: C.textMuted }}>{l.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color }}>
                  {labs[l.key]}{isHigh ? "↑" : isLow ? "↓" : ""}
                </div>
                {l.unit && <div style={{ fontSize: 8, color: C.textDim }}>{l.unit}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: C.textDim, fontSize: 12, textAlign: "center", padding: "8px 0" }}>Toque em ✏️ para inserir resultados de laboratório</div>
      )}
    </div>
  );
}

// ============================================================
// PAINEL DE MEDICAMENTOS
// ============================================================
function MedsPanel({ patient, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [newMed, setNewMed] = useState({ name: "", dose: "", route: "", schedule: "", isAtb: false, atbDay: "", startDate: "" });
  const meds = patient.medications || [];

  const addMed = () => {
    if (!newMed.name.trim()) return;
    const updated = { ...patient, medications: [...meds, { ...newMed, id: Date.now().toString() }] };
    onUpdate(updated);
    setNewMed({ name: "", dose: "", route: "", schedule: "", isAtb: false, atbDay: "", startDate: "" });
  };

  const removeMed = (id) => {
    onUpdate({ ...patient, medications: meds.filter(m => m.id !== id) });
  };

  const atbs = meds.filter(m => m.isAtb);
  const others = meds.filter(m => !m.isAtb);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: C.yellow, fontWeight: 700, letterSpacing: 1 }}>💊 MEDICAMENTOS</div>
        <button onClick={() => setEditing(!editing)} style={{ background: editing ? C.greenDim : C.accentDim, border: `1px solid ${editing ? C.green : C.border}`, borderRadius: 6, color: editing ? C.green : C.accent, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
          {editing ? "✓ Feito" : "+ Add"}
        </button>
      </div>

      {/* ATBs em destaque */}
      {atbs.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {atbs.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.yellowDim, border: `1px solid ${C.yellow}33`, borderRadius: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>🦠</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: C.yellow, fontSize: 13 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{m.dose} {m.route && `· ${m.route}`} {m.schedule && `· ${m.schedule}`}</div>
              </div>
              <Badge color={C.yellow}>D{m.atbDay || "?"}</Badge>
              {editing && <button onClick={() => removeMed(m.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16 }}>✕</button>}
            </div>
          ))}
        </div>
      )}

      {/* Outros medicamentos */}
      {others.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {others.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8 }}>
              <span style={{ fontSize: 14 }}>💊</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: C.text, fontSize: 12 }}>{m.name}</span>
                <span style={{ color: C.textMuted, fontSize: 11 }}> {m.dose} {m.route && `· ${m.route}`} {m.schedule && `· ${m.schedule}`}</span>
              </div>
              {editing && <button onClick={() => removeMed(m.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>✕</button>}
            </div>
          ))}
        </div>
      )}

      {meds.length === 0 && !editing && (
        <div style={{ color: C.textDim, fontSize: 12, textAlign: "center", padding: "8px 0" }}>Nenhum medicamento cadastrado</div>
      )}

      {/* Formulário de adição */}
      {editing && (
        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
            <Input value={newMed.name} onChange={e => setNewMed(m => ({ ...m, name: e.target.value }))} placeholder="Medicamento *" />
            <Input value={newMed.dose} onChange={e => setNewMed(m => ({ ...m, dose: e.target.value }))} placeholder="Dose (ex: 500mg)" />
            <Input value={newMed.route} onChange={e => setNewMed(m => ({ ...m, route: e.target.value }))} placeholder="Via (EV, VO...)" />
            <Input value={newMed.schedule} onChange={e => setNewMed(m => ({ ...m, schedule: e.target.value }))} placeholder="Horário (8/8h, 6h...)" />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
            <input type="checkbox" checked={newMed.isAtb} onChange={e => setNewMed(m => ({ ...m, isAtb: e.target.checked }))} style={{ accentColor: C.yellow }} />
            🦠 É antibiótico
          </label>
          {newMed.isAtb && (
            <Input value={newMed.atbDay} onChange={e => setNewMed(m => ({ ...m, atbDay: e.target.value }))} placeholder="Dia de ATB (ex: 7)" type="number" style={{ marginBottom: 6 }} />
          )}
          <Btn onClick={addMed} disabled={!newMed.name.trim()} size="sm" full>+ Adicionar</Btn>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CARD COMPLETO DE VISITA — uma única tela
// ============================================================
function VisitCard({ patient, onUpdate, onEdit, onBack, onNext, onPrev, totalPatients, currentIndex }) {
  const st = STATUS[patient.status] || STATUS.stable;
  const dias = diasInternamento(patient.admissionDate);
  const pending = patient.pending || [];

  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      {/* Header do paciente */}
      <div style={{ background: `linear-gradient(135deg,${C.surface},${C.surface2})`, border: `1px solid ${st.color}44`, borderRadius: 16, padding: 14, marginBottom: 10, borderLeft: `4px solid ${st.color}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ fontSize: 32, lineHeight: 1 }}>{GENDER[patient.gender] || "🧑"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, color: C.text, fontSize: 17, lineHeight: 1.2 }}>{patient.name}</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>
              {patient.age && `${patient.age}a`}
              {patient.bed && ` · Leito ${patient.bed}`}
              {patient.location && ` · ${patient.location}`}
              {dias !== null && ` · D${dias} internamento`}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <Badge color={st.color}>{st.icon} {st.label}</Badge>
              {patient.onAntibiotic && <Badge color={C.yellow}>🦠 ATB</Badge>}
              {patient.covering && <Badge color={C.textMuted}>🔄 Cobertura</Badge>}
            </div>
            {patient.summary && <div style={{ fontSize: 12, color: C.text, marginTop: 6, opacity: 0.8, lineHeight: 1.5 }}>{patient.summary}</div>}
          </div>
          <button onClick={onEdit} style={{ background: C.accentDim, border: `1px solid ${C.border}`, borderRadius: 8, color: C.accent, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✏️</button>
        </div>
      </div>

      {/* Comorbidades */}
      {patient.comorbidities && (
        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>🏥 COMORBIDADES</div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{patient.comorbidities}</div>
        </div>
      )}

      {/* Vitais */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
        <VitaisPanel patient={patient} onUpdate={onUpdate} />
      </div>

      {/* Labs */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
        <LabsPanel patient={patient} onUpdate={onUpdate} />
      </div>

      {/* Medicamentos */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
        <MedsPanel patient={patient} onUpdate={onUpdate} />
      </div>

      {/* Pendências */}
      {pending.length > 0 && (
        <div style={{ background: C.yellowDim, border: `1px solid ${C.yellow}33`, borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: C.yellow, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>⏳ PENDÊNCIAS ({pending.length})</div>
          {pending.map((p, i) => (
            <div key={i} style={{ fontSize: 13, color: C.text, padding: "4px 0", borderBottom: i < pending.length - 1 ? `1px solid ${C.yellow}22` : "none" }}>
              • {p}
            </div>
          ))}
        </div>
      )}

      {/* Impressão clínica */}
      {patient.clinicalImpression && (
        <div style={{ background: C.accentDim, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>🧠 IMPRESSÃO CLÍNICA</div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{patient.clinicalImpression}</div>
        </div>
      )}

      {/* Evolução de hoje */}
      {patient.todayEvolution && (
        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>📋 EVOLUÇÃO DE HOJE</div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{patient.todayEvolution}</div>
        </div>
      )}

      {/* História */}
      {patient.history && (
        <details style={{ marginBottom: 10 }}>
          <summary style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontSize: 12, color: C.textMuted, fontWeight: 700, listStyle: "none", display: "flex", justifyContent: "space-between" }}>
            <span>📖 HISTÓRIA DA DOENÇA</span><span>▼</span>
          </summary>
          <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "10px 14px", fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {patient.history}
          </div>
        </details>
      )}

      {/* Evolução hospitalar */}
      {patient.hospitalCourse && (
        <details style={{ marginBottom: 10 }}>
          <summary style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontSize: 12, color: C.textMuted, fontWeight: 700, listStyle: "none", display: "flex", justifyContent: "space-between" }}>
            <span>🏥 EVOLUÇÃO HOSPITALAR</span><span>▼</span>
          </summary>
          <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "10px 14px", fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {patient.hospitalCourse}
          </div>
        </details>
      )}

      {/* Navegação entre pacientes */}
      {totalPatients > 1 && (
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Btn onClick={onPrev} variant="ghost" style={{ flex: 1 }} disabled={currentIndex === 0}>← Anterior</Btn>
          <div style={{ display: "flex", alignItems: "center", fontSize: 12, color: C.textMuted, fontWeight: 700 }}>{currentIndex + 1}/{totalPatients}</div>
          <Btn onClick={onNext} variant="ghost" style={{ flex: 1 }} disabled={currentIndex === totalPatients - 1}>Próximo →</Btn>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MODO VISITA PRINCIPAL
// ============================================================
export default function ModoVisita({ patients, area, onUpdatePatient, onBack, onEditPatient }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list"); // list | visit
  const containerRef = useRef(null);

  // Swipe horizontal
  const touchStartX = useRef(null);

  const handleTouchStart = e => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = e => {
    if (!touchStartX.current) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      if (diff > 0 && currentIndex < filteredPatients.length - 1) setCurrentIndex(i => i + 1);
      else if (diff < 0 && currentIndex > 0) setCurrentIndex(i => i - 1);
    }
    touchStartX.current = null;
  };

  const filteredPatients = patients.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) ||
    (p.bed || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.summary || "").toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    const order = { critical: 0, attention: 1, intercurrence: 2, stable: 3, discharge: 4 };
    return (order[a.status] || 3) - (order[b.status] || 3);
  });

  const currentPatient = filteredPatients[currentIndex];

  // Lista rápida
  const renderList = () => (
    <div>
      {/* Barra de busca */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Nome, leito, diagnóstico..."
          style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit" }}
          autoFocus
        />
      </div>

      {/* Cards compactos de pacientes */}
      {filteredPatients.map((p, i) => {
        const st = STATUS[p.status] || STATUS.stable;
        const dias = diasInternamento(p.admissionDate);
        const atbs = (p.medications || []).filter(m => m.isAtb);
        const hasAlerts = Object.entries(p.labs || {}).some(([k, v]) => {
          const labsRef = { cr: [0.6, 1.2], k: [3.5, 5.0], na: [136, 145], lactato: [0, 2] };
          if (labsRef[k]) { const n = parseFloat(v); return n > labsRef[k][1] || n < labsRef[k][0]; }
          return false;
        });
        return (
          <div
            key={p.id}
            onClick={() => { setCurrentIndex(i); setViewMode("visit"); }}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.surface, border: `1px solid ${st.color}33`, borderLeft: `4px solid ${st.color}`, borderRadius: 12, marginBottom: 8, cursor: "pointer", transition: "all 0.15s" }}
          >
            <div style={{ fontSize: 26 }}>{GENDER[p.gender] || "🧑"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                {p.age && `${p.age}a`}{p.bed && ` · Leito ${p.bed}`}{dias !== null && ` · D${dias}`}
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                <Badge color={st.color} style={{ fontSize: 10 }}>{st.icon} {st.label}</Badge>
                {atbs.map(a => <Badge key={a.id} color={C.yellow} style={{ fontSize: 10 }}>🦠 D{a.atbDay || "?"}</Badge>)}
                {hasAlerts && <Badge color={C.red} style={{ fontSize: 10 }}>🔴 Lab ↑↓</Badge>}
                {(p.pending || []).length > 0 && <Badge color={C.yellow} style={{ fontSize: 10 }}>⏳ {p.pending.length}</Badge>}
              </div>
            </div>
            <div style={{ color: C.textMuted, fontSize: 22 }}>›</div>
          </div>
        );
      })}

      {filteredPatients.length === 0 && (
        <div style={{ textAlign: "center", color: C.textMuted, padding: 40, fontSize: 14 }}>
          Nenhum paciente encontrado
        </div>
      )}
    </div>
  );

  // Modo visita com swipe
  const renderVisit = () => (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ userSelect: "none" }}
    >
      {/* Mini lista para navegação rápida */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
        {filteredPatients.map((p, i) => {
          const st = STATUS[p.status] || STATUS.stable;
          return (
            <button
              key={p.id}
              onClick={() => setCurrentIndex(i)}
              style={{
                flexShrink: 0, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                border: `2px solid ${i === currentIndex ? st.color : C.border}`,
                background: i === currentIndex ? `${st.color}22` : "transparent",
                color: i === currentIndex ? st.color : C.textMuted,
                fontSize: 12, fontWeight: 700, fontFamily: "inherit",
              }}
            >
              {st.icon} {p.name.split(" ")[0]}{p.bed ? ` (${p.bed})` : ""}
            </button>
          );
        })}
      </div>

      {currentPatient && (
        <VisitCard
          patient={currentPatient}
          onUpdate={onUpdatePatient}
          onEdit={() => onEditPatient(currentPatient)}
          onBack={() => setViewMode("list")}
          onNext={() => setCurrentIndex(i => Math.min(i + 1, filteredPatients.length - 1))}
          onPrev={() => setCurrentIndex(i => Math.max(i - 1, 0))}
          totalPatients={filteredPatients.length}
          currentIndex={currentIndex}
        />
      )}

      <div style={{ textAlign: "center", fontSize: 11, color: C.textDim, marginTop: 8 }}>← deslize para navegar entre pacientes →</div>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}details>summary{outline:none}details[open]>summary span:last-child{transform:rotate(180deg);display:inline-block}`}</style>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ background: C.accentDim, border: `1px solid ${C.border}`, borderRadius: 8, color: C.accent, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← {area?.name || "Áreas"}</button>
        <div style={{ flex: 1, fontWeight: 800, color: C.text, fontSize: 15 }}>{area?.icon} {area?.name}</div>
        <Badge color={C.textMuted}>{filteredPatients.length} pacientes</Badge>

        {/* Toggle lista/visita */}
        <div style={{ display: "flex", background: C.surface2, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <button onClick={() => setViewMode("list")} style={{ padding: "6px 12px", background: viewMode === "list" ? C.accentDim : "transparent", border: "none", color: viewMode === "list" ? C.accent : C.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>📋 Lista</button>
          <button onClick={() => setViewMode("visit")} style={{ padding: "6px 12px", background: viewMode === "visit" ? C.accentDim : "transparent", border: "none", color: viewMode === "visit" ? C.accent : C.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🏃 Visita</button>
        </div>
      </div>

      {viewMode === "list" ? renderList() : renderVisit()}
    </div>
  );
}
