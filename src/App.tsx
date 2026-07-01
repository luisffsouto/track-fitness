// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
// ─── ✏️  SUAS CREDENCIAIS — edite estas 3 linhas ──────────────────────────────
const SUPABASE_URL = "https://xeaggeivjogusnnzfhdw.supabase.co";    // ex: https://xyzxyz.supabase.co
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlYWdnZWl2am9ndXNubnpmaGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NjY1NzEsImV4cCI6MjA5ODQ0MjU3MX0.kj1ALfByedN0PakrZa9gpnjAKbgsi9_YyylAc8exy0Y";  // anon public key
const SYNC_ID      = "meu-tracker-2026";      // qualquer nome que quiser
// ──────────────────────────────────────────────────────────────────────────────


// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const CATEGORIES = [
  { id: "alimentacao", emoji: "🥩", label: "Alimentação", color: "#059669" },
  { id: "exercicio",   emoji: "💪", label: "Exercício",   color: "#2563eb" },
  { id: "neat",        emoji: "👟", label: "NEAT",        color: "#d97706" },
  { id: "sono",        emoji: "😴", label: "Sono",        color: "#7c3aed" },
  { id: "estresse",    emoji: "🧘", label: "Estresse",    color: "#db2777" },
];

const HABITS = [
  { id: "protein",     cat: "alimentacao", label: "Proteína atingida (~140g)" },
  { id: "water",       cat: "alimentacao", label: "Água ≥ 2,5 L" },
  { id: "fiber",       cat: "alimentacao", label: "Fibras e vegetais" },
  { id: "fruit",    cat: "alimentacao", label: "Frutas ≥3 por dia" },
  { id: "no_skip",     cat: "alimentacao", label: "Evitei Doce + Bom-senso" },
  { id: "strength",    cat: "exercicio",   label: "Treino de força" },
  { id: "cardio",      cat: "exercicio",   label: "Aeróbico / Corrida" },
  { id: "steps",       cat: "neat",        label: "Meta de passos (8–10k)" },
  { id: "breaks",      cat: "neat",        label: "Pausas a cada 45 min" },
  { id: "standing",    cat: "neat",        label: "Ficou em pé / caminhou" },
  { id: "sleep7",      cat: "sono",        label: "Dormiu 7–9 h" },
  { id: "sleeptime",   cat: "sono",        label: "Horário de dormir consistente" },
  { id: "stress_mgmt", cat: "estresse",    label: "Técnica de manejo de estresse" },
  { id: "no_caffeine", cat: "estresse",    label: "Cafeína cortada antes das 15h" },
];

const METRICS = [
  { id: "weight", label: "⚖️  Peso",    unit: "kg",   placeholder: "ex: 109,2" },
  { id: "waist",  label: "📐 Cintura", unit: "cm",   placeholder: "ex: 103" },
  { id: "energy", label: "⚡ Energia", unit: "/10",  placeholder: "1 – 10" },
  { id: "mood",   label: "😊 Humor",   unit: "/10",  placeholder: "1 – 10" },
];

const WEEKS = [1, 2, 3, 4];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyWeek = () => ({
  days: Object.fromEntries(
    DAYS.map(d => [d, Object.fromEntries(HABITS.map(h => [h.id, false]))])
  ),
  metrics: Object.fromEntries(METRICS.map(m => [m.id, ""])),
  obs: Object.fromEntries(CATEGORIES.map(c => [c.id, ""])),
});

const emptyData = () => Object.fromEntries(WEEKS.map(w => [w, emptyWeek()]));

const pct = (c, t) => t === 0 ? 0 : Math.round((c / t) * 100);

const weekAdherence = (wd) => {
  const total = DAYS.length * HABITS.length;
  const checked = DAYS.reduce((a, d) => a + HABITS.filter(h => wd.days[d][h.id]).length, 0);
  return pct(checked, total);
};

const catAdherence = (wd, catId) => {
  const habits = HABITS.filter(h => h.cat === catId);
  const total = DAYS.length * habits.length;
  const checked = DAYS.reduce((a, d) => a + habits.filter(h => wd.days[d][h.id]).length, 0);
  return pct(checked, total);
};

// ─── Supabase client (REST only, no SDK needed) ───────────────────────────────

const makeSupabase = (url, key) => ({
  async load(syncId) {
    const res = await fetch(`${url}/rest/v1/tracker_data?id=eq.${encodeURIComponent(syncId)}&select=data`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    });
    const rows = await res.json();
    return rows?.[0]?.data ?? null;
  },
  async save(syncId, data) {
    await fetch(`${url}/rest/v1/tracker_data`, {
      method: "POST",
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        "Content-Type": "application/json", Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ id: syncId, data, updated_at: new Date().toISOString() }),
    });
  },
});

// ─── ScoreBadge ───────────────────────────────────────────────────────────────

const ScoreBadge = ({ value, size = "sm" }) => {
  const color = value >= 80 ? "#059669" : value >= 60 ? "#d97706" : value >= 40 ? "#2563eb" : "#94a3b8";
  const s = size === "lg" ? { outer: 72, stroke: 6, font: 18 } : { outer: 42, stroke: 5, font: 12 };
  const r = (s.outer - s.stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={s.outer} height={s.outer} style={{ flexShrink: 0 }}>
      <circle cx={s.outer/2} cy={s.outer/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={s.stroke} />
      <circle cx={s.outer/2} cy={s.outer/2} r={r} fill="none" stroke={color} strokeWidth={s.stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${s.outer/2} ${s.outer/2})`} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fontSize={s.font} fontWeight="700" fill={color}>{value}%</text>
    </svg>
  );
};

// ─── Setup screen ─────────────────────────────────────────────────────────────

const SetupScreen = ({ onSave }) => {
  const [url,    setUrl]    = useState("");
  const [key,    setKey]    = useState("");
  const [syncId, setSyncId] = useState("");
  const [error,  setError]  = useState("");
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!url || !key || !syncId) { setError("Preencha todos os campos."); return; }
    setTesting(true); setError("");
    try {
      const db = makeSupabase(url.replace(/\/$/, ""), key);
      await db.save(syncId, emptyData());
      localStorage.setItem("wt-config", JSON.stringify({ url: url.replace(/\/$/, ""), key, syncId }));
      onSave({ url: url.replace(/\/$/, ""), key, syncId });
    } catch (e) {
      setError("Erro de conexão. Verifique a URL e a chave.");
    }
    setTesting(false);
  };

  const field = (label, val, set, placeholder, type = "text") => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569",
        marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{label}</label>
      <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px",
          fontSize: 14, color: "#0f172a", outline: "none", fontFamily: "inherit",
          boxSizing: "border-box", background: "#f8fafc" }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f1f5f9",
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 32, maxWidth: 460,
        width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,.08)" }}>
        
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔗</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
            Configurar Sincronização
          </h2>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
            Cole os dados do seu projeto Supabase para sincronizar entre dispositivos.
          </p>
        </div>

        {field("Project URL", url, setUrl, "https://xyzxyz.supabase.co")}
        {field("Anon Public Key", key, setKey, "eyJhbGci...", "password")}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569",
            marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Código de Sincronização
          </label>
          <input value={syncId} onChange={e => setSyncId(e.target.value)}
            placeholder="ex: paciente-joao-2025 (você escolhe)"
            style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10,
              padding: "10px 14px", fontSize: 14, color: "#0f172a", outline: "none",
              fontFamily: "inherit", boxSizing: "border-box", background: "#f8fafc" }} />
          <p style={{ fontSize: 11, color: "#94a3b8", margin: "6px 0 0" }}>
            Qualquer texto que você quiser. Use o mesmo em todos os dispositivos para sincronizar.
          </p>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
            padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={handleSave} disabled={testing}
          style={{ width: "100%", background: testing ? "#94a3b8" : "#059669",
            color: "#fff", border: "none", borderRadius: 12, padding: "14px",
            fontSize: 15, fontWeight: 700, cursor: testing ? "not-allowed" : "pointer" }}>
          {testing ? "Conectando…" : "Conectar e Começar →"}
        </button>

        <div style={{ marginTop: 20, background: "#f0fdf4", borderRadius: 12,
          padding: "14px 16px", fontSize: 12, color: "#166534", lineHeight: 1.6 }}>
          <strong>Como configurar o Supabase:</strong><br />
          1. Crie conta em supabase.com<br />
          2. Novo projeto → SQL Editor → rode o script fornecido<br />
          3. Project Settings → API → copie URL e anon key
        </div>
      </div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const config = { url: SUPABASE_URL, key: SUPABASE_KEY, syncId: SYNC_ID };
  const handleReset = () => window.location.reload();
  return <WeeklyTracker config={config} onReset={handleReset} />;
}



// ─── Weekly Tracker ───────────────────────────────────────────────────────────

function WeeklyTracker({ config, onReset }) {
  const [tab, setTab]               = useState("week");
  const [activeWeek, setActiveWeek] = useState(1);
  const [data, setData]             = useState(emptyData());
  const [loaded, setLoaded]         = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | saving | saved | error
  const [copied, setCopied]         = useState(false);
  const saveTimer = useRef(null);
  const db = useRef(makeSupabase(config.url, config.key));

  // ── Load from Supabase ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setSyncStatus("saving");
        const remote = await db.current.load(config.syncId);
        if (remote) setData(remote);
        setSyncStatus("saved");
      } catch (_) {
        setSyncStatus("error");
      }
      setLoaded(true);
    })();
  }, []);

  // ── Save to Supabase (debounced 1.5s) ────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    setSyncStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await db.current.save(config.syncId, data);
        setSyncStatus("saved");
      } catch (_) {
        setSyncStatus("error");
      }
    }, 1500);
    return () => clearTimeout(saveTimer.current);
  }, [data, loaded]);

  // ── Updaters ──────────────────────────────────────────────────────────────
  const toggle = (week, day, id) =>
    setData(p => ({ ...p, [week]: { ...p[week], days: { ...p[week].days,
      [day]: { ...p[week].days[day], [id]: !p[week].days[day][id] } } } }));

  const setMetric = (week, id, val) =>
    setData(p => ({ ...p, [week]: { ...p[week],
      metrics: { ...p[week].metrics, [id]: val } } }));

  const setObs = (week, catId, val) =>
    setData(p => ({ ...p, [week]: { ...p[week],
      obs: { ...p[week].obs, [catId]: val } } }));

  // ── Report ────────────────────────────────────────────────────────────────
  const buildReport = () => {
    const date = new Date().toLocaleDateString("pt-BR");
    let r = `📊 RELATÓRIO MENSAL DE ACOMPANHAMENTO\nID: ${config.syncId} | Data: ${date}\n${"═".repeat(48)}\n\n`;
    WEEKS.forEach(w => {
      const wd = data[w];
      r += `📅 SEMANA ${w}  —  Aderência geral: ${weekAdherence(wd)}%\n${"─".repeat(40)}\n`;
      r += `⚖️  Peso: ${wd.metrics.weight || "—"} kg\n`;
      r += `📐 Cintura: ${wd.metrics.waist || "—"} cm\n`;
      r += `⚡ Energia: ${wd.metrics.energy || "—"}/10  |  😊 Humor: ${wd.metrics.mood || "—"}/10\n\n`;
      CATEGORIES.forEach(c => {
        r += `${c.emoji} ${c.label}: ${catAdherence(wd, c.id)}%\n`;
        if (wd.obs[c.id]) r += `   Obs: ${wd.obs[c.id]}\n`;
      });
      r += `\n`;
    });
    return r;
  };

  const copyReport = () => {
    navigator.clipboard.writeText(buildReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Chart data ────────────────────────────────────────────────────────────
  const barData = WEEKS.map(w => ({
    name: `Sem ${w}`,
    Geral: weekAdherence(data[w]),
  }));

  const radarData = CATEGORIES.map(c => ({
    cat: c.label,
    ...Object.fromEntries(WEEKS.map(w => [`Sem ${w}`, catAdherence(data[w], c.id)])),
  }));

  const wd = data[activeWeek];

  const syncLabel = { idle: "", saving: "⏳ Sincronizando…", saved: "✅ Sincronizado", error: "⚠️ Erro ao sincronizar" };
  const syncColor = { idle: "#94a3b8", saving: "#d97706", saved: "#059669", error: "#dc2626" };

  if (!loaded) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", height:"100vh", gap:12, background:"#f1f5f9",
      fontFamily:"system-ui", color:"#64748b" }}>
      <div style={{ fontSize:32 }}>🔄</div>
      <div style={{ fontSize:14 }}>Carregando dados da nuvem…</div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Inter', system-ui, sans-serif", background:"#f1f5f9", minHeight:"100vh", paddingBottom:48 }}>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#0f4c35 0%,#065f46 60%,#047857 100%)",
        padding:"24px 20px 32px", color:"#fff" }}>
        <div style={{ maxWidth:760, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <p style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", opacity:.7, marginBottom:4 }}>
              Protocolo de Emagrecimento
            </p>
            <h1 style={{ fontSize:22, fontWeight:800, margin:0 }}>Acompanhamento Semanal</h1>
            <p style={{ opacity:.6, fontSize:13, margin:"4px 0 0" }}>187 cm · 110 kg atual · meta ~87 kg</p>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color: syncColor[syncStatus], background:"rgba(255,255,255,.15)",
              borderRadius:8, padding:"4px 10px", marginBottom:8 }}>
              {syncLabel[syncStatus] || "☁️ Nuvem ativa"}
            </div>
            <button onClick={onReset}
              style={{ fontSize:10, background:"rgba(255,255,255,.15)", color:"#fff",
                border:"none", borderRadius:6, padding:"4px 8px", cursor:"pointer", opacity:.7 }}>
              ⚙️ Reconfigurar
            </button>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0",
        position:"sticky", top:0, zIndex:10, boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
        <div style={{ maxWidth:760, margin:"0 auto", display:"flex", padding:"0 12px" }}>
          {WEEKS.map(w => (
            <button key={w} onClick={() => { setActiveWeek(w); setTab("week"); }}
              style={{ flex:1, padding:"12px 4px 10px", border:"none", background:"transparent",
                cursor:"pointer", fontSize:13, fontWeight:600,
                color: tab==="week" && activeWeek===w ? "#059669" : "#64748b",
                borderBottom: tab==="week" && activeWeek===w ? "2px solid #059669" : "2px solid transparent" }}>
              Sem {w}
              <div style={{ fontSize:10, color: tab==="week" && activeWeek===w ? "#059669" : "#94a3b8" }}>
                {weekAdherence(data[w])}%
              </div>
            </button>
          ))}
          <button onClick={() => setTab("report")}
            style={{ flex:1.2, padding:"12px 4px 10px", border:"none", background:"transparent",
              cursor:"pointer", fontSize:13, fontWeight:700,
              color: tab==="report" ? "#4f46e5" : "#64748b",
              borderBottom: tab==="report" ? "2px solid #4f46e5" : "2px solid transparent" }}>
            📊 Relatório
          </button>
        </div>
      </div>

      <div style={{ maxWidth:760, margin:"0 auto", padding:"20px 12px 0" }}>

        {/* ══════════ WEEK VIEW ══════════ */}
        {tab === "week" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Overall + cat scores */}
            <div style={{ background:"#fff", borderRadius:16, padding:"20px 24px",
              display:"flex", alignItems:"center", gap:20, boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
              <ScoreBadge value={weekAdherence(wd)} size="lg" />
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>
                  Aderência geral — Semana {activeWeek}
                </div>
                <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>
                  {weekAdherence(wd) >= 80 ? "🔥 Semana excelente!" :
                   weekAdherence(wd) >= 60 ? "💪 Boa semana, continue!" :
                   weekAdherence(wd) >= 40 ? "📈 Metade do caminho!" :
                   "🎯 Cada check já é uma vitória!"}
                </div>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
              {CATEGORIES.map(c => (
                <div key={c.id} style={{ background:"#fff", borderRadius:12, padding:"12px 8px",
                  textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
                  <div style={{ fontSize:18, marginBottom:6 }}>{c.emoji}</div>
                  <ScoreBadge value={catAdherence(wd, c.id)} />
                  <div style={{ fontSize:9, color:"#64748b", marginTop:6, fontWeight:600 }}>
                    {c.label.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            {/* Habit grids */}
            {CATEGORIES.map(cat => {
              const catHabits = HABITS.filter(h => h.cat === cat.id);
              return (
                <div key={cat.id} style={{ background:"#fff", borderRadius:16,
                  overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
                  <div style={{ padding:"14px 20px 10px", borderBottom:"1px solid #f1f5f9",
                    display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ fontWeight:700, fontSize:14, color:"#0f172a" }}>
                      {cat.emoji} {cat.label}
                    </div>
                    <ScoreBadge value={catAdherence(wd, cat.id)} />
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                      <thead>
                        <tr style={{ background:"#f8fafc" }}>
                          <th style={{ textAlign:"left", padding:"8px 16px", color:"#94a3b8",
                            fontWeight:600, borderBottom:"1px solid #f1f5f9" }}>Hábito</th>
                          {DAYS.map(d => (
                            <th key={d} style={{ textAlign:"center", padding:"8px 4px", color:"#94a3b8",
                              fontWeight:600, minWidth:38, borderBottom:"1px solid #f1f5f9" }}>{d}</th>
                          ))}
                          <th style={{ textAlign:"center", padding:"8px 8px", color:"#94a3b8",
                            fontWeight:600, borderBottom:"1px solid #f1f5f9", fontSize:10 }}>SEM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catHabits.map((h, i) => {
                          const total = DAYS.filter(d => wd.days[d][h.id]).length;
                          return (
                            <tr key={h.id} style={{ borderBottom: i < catHabits.length-1 ? "1px solid #f8fafc" : "none" }}>
                              <td style={{ padding:"8px 16px", color:"#475569", maxWidth:180, lineHeight:1.3 }}>
                                {h.label}
                              </td>
                              {DAYS.map(d => (
                                <td key={d} style={{ textAlign:"center", padding:"6px 3px" }}>
                                  <button onClick={() => toggle(activeWeek, d, h.id)}
                                    style={{ width:30, height:30, borderRadius:8, border:"none",
                                      cursor:"pointer", fontSize:14, transition:"all .1s",
                                      background: wd.days[d][h.id] ? cat.color : "#f1f5f9",
                                      color: wd.days[d][h.id] ? "#fff" : "#cbd5e1",
                                      boxShadow: wd.days[d][h.id] ? `0 1px 4px ${cat.color}55` : "none" }}>
                                    {wd.days[d][h.id] ? "✓" : "·"}
                                  </button>
                                </td>
                              ))}
                              <td style={{ textAlign:"center", padding:"6px 8px" }}>
                                <span style={{ fontWeight:700, fontSize:11,
                                  color: total >= 5 ? cat.color : total >= 3 ? "#d97706" : "#94a3b8" }}>
                                  {total}/7
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding:"12px 16px 16px", borderTop:"1px solid #f8fafc" }}>
                    <label style={{ fontSize:11, fontWeight:600, color:"#94a3b8",
                      display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>
                      Observações — {cat.label}
                    </label>
                    <textarea value={wd.obs[cat.id]}
                      onChange={e => setObs(activeWeek, cat.id, e.target.value)}
                      placeholder={`Como foi a semana em ${cat.label.toLowerCase()}?`}
                      rows={2}
                      style={{ width:"100%", border:"1px solid #e2e8f0", borderRadius:10,
                        padding:"10px 12px", fontSize:13, color:"#334155", resize:"vertical",
                        outline:"none", fontFamily:"inherit", background:"#f8fafc",
                        boxSizing:"border-box" }} />
                  </div>
                </div>
              );
            })}

            {/* Metrics */}
            <div style={{ background:"#fff", borderRadius:16, padding:"20px",
              boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
              <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:"#0f172a" }}>
                📏 Métricas da Semana
              </h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {METRICS.map(m => (
                  <div key={m.id}>
                    <label style={{ fontSize:11, fontWeight:600, color:"#64748b",
                      display:"block", marginBottom:6 }}>{m.label}</label>
                    <div style={{ position:"relative" }}>
                      <input type="text" value={wd.metrics[m.id]}
                        onChange={e => setMetric(activeWeek, m.id, e.target.value)}
                        placeholder={m.placeholder}
                        style={{ width:"100%", border:"1px solid #e2e8f0", borderRadius:10,
                          padding:"10px 36px 10px 12px", fontSize:14, color:"#0f172a",
                          outline:"none", fontFamily:"inherit", boxSizing:"border-box",
                          background:"#f8fafc" }} />
                      <span style={{ position:"absolute", right:10, top:"50%",
                        transform:"translateY(-50%)", fontSize:11, color:"#94a3b8", fontWeight:600 }}>
                        {m.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ══════════ REPORT VIEW ══════════ */}
        {tab === "report" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            <div style={{ background:"#fff", borderRadius:16, padding:"20px",
              boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
              <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:"#0f172a" }}>
                📊 Aderência Geral — 4 Semanas
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top:4, right:8, left:-16, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize:12 }} />
                  <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{ fontSize:11 }} />
                  <Tooltip formatter={v=>[`${v}%`, "Aderência"]} />
                  <Bar dataKey="Geral" fill="#059669" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background:"#fff", borderRadius:16, padding:"20px",
              boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
              <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:"#0f172a" }}>
                🕸️ Radar por Categoria
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="cat" tick={{ fontSize:11, fill:"#64748b" }} />
                  <PolarRadiusAxis domain={[0,100]} tick={{ fontSize:9 }} tickCount={3}
                    tickFormatter={v=>`${v}%`} />
                  {WEEKS.map((w,i) => (
                    <Radar key={w} name={`Sem ${w}`} dataKey={`Sem ${w}`}
                      stroke={["#059669","#2563eb","#d97706","#7c3aed"][i]}
                      fill={["#059669","#2563eb","#d97706","#7c3aed"][i]}
                      fillOpacity={0.1} strokeWidth={2} />
                  ))}
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize:12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background:"#fff", borderRadius:16, padding:"20px",
              boxShadow:"0 1px 3px rgba(0,0,0,.06)", overflowX:"auto" }}>
              <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:"#0f172a" }}>
                📏 Evolução de Métricas
              </h3>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:"2px solid #f1f5f9" }}>
                    <th style={{ textAlign:"left", padding:"8px 12px", color:"#94a3b8",
                      fontWeight:600, fontSize:11 }}>MÉTRICA</th>
                    {WEEKS.map(w => (
                      <th key={w} style={{ textAlign:"center", padding:"8px 12px",
                        color:"#94a3b8", fontWeight:600, fontSize:11 }}>SEM {w}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((m,i) => (
                    <tr key={m.id} style={{ borderBottom:"1px solid #f8fafc",
                      background: i%2===0 ? "#fff":"#fafbfc" }}>
                      <td style={{ padding:"10px 12px", color:"#475569" }}>{m.label}</td>
                      {WEEKS.map(w => (
                        <td key={w} style={{ textAlign:"center", padding:"10px 12px",
                          fontWeight:600, color:"#0f172a" }}>
                          {data[w].metrics[m.id] || "—"}{data[w].metrics[m.id] ? ` ${m.unit}` : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ borderTop:"2px solid #f1f5f9", background:"#f0fdf4" }}>
                    <td style={{ padding:"10px 12px", fontWeight:700, color:"#0f172a" }}>✅ Aderência</td>
                    {WEEKS.map(w => (
                      <td key={w} style={{ textAlign:"center", padding:"10px 12px",
                        fontWeight:800, color:"#059669", fontSize:14 }}>
                        {weekAdherence(data[w])}%
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ background:"#fff", borderRadius:16, padding:"20px",
              boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", marginBottom:14 }}>
                <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:"#0f172a" }}>
                  📋 Relatório para Nutricionista
                </h3>
                <button onClick={copyReport}
                  style={{ background: copied ? "#059669" : "#4f46e5", color:"#fff",
                    border:"none", borderRadius:10, padding:"8px 16px",
                    fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  {copied ? "✅ Copiado!" : "📋 Copiar tudo"}
                </button>
              </div>
              <pre style={{ background:"#f8fafc", borderRadius:10, padding:"16px",
                fontSize:12, color:"#334155", fontFamily:"'Courier New', monospace",
                whiteSpace:"pre-wrap", lineHeight:1.7, border:"1px solid #e2e8f0", margin:0 }}>
                {buildReport()}
              </pre>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

