const { useState, useEffect, useMemo, useCallback } = React;

const MEMBER_COLORS = ['#2E7D5B', '#B0432E', '#C29B3E', '#3E6EA5', '#8A4FA0', '#5A8F3C', '#A85338', '#4E8A93'];
const colorForName = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return MEMBER_COLORS[h % MEMBER_COLORS.length];
};

// Un color propio por pestaña para que se note claramente en cuál estás parado.
const TAB_COLORS = {
  resumen: '#1E3D32',
  movimientos: '#3E6EA5',
  compromisos: '#8A6B1F',
  ahorro: '#8A4FA0',
  graficas: '#A85338',
};

const INGRESO_CATS = [
  { id: 'servicio', label: 'Ventas', icon: 'ShoppingBag', color: '#2F7D5C' },
  { id: 'nomina', label: 'Sueldo', icon: 'Banknote', color: '#3E8E7E' },
  { id: 'cobranza', label: 'Cobranza', icon: 'Wallet', color: '#5AA98C' },
  { id: 'comision', label: 'Comisiones', icon: 'BarChart3', color: '#79B597' },
  { id: 'otros_ing', label: 'Otros', icon: 'PlusCircle', color: '#8FC1A9' },
];

const GASTO_CATS = [
  { id: 'renta', label: 'Renta', icon: 'Home', color: '#B0432E' },
  { id: 'servicios', label: 'Servicios', icon: 'Zap', color: '#C9A227' },
  { id: 'transporte', label: 'Transporte', icon: 'Motorbike', color: '#8C6239' },
  { id: 'comida', label: 'Comida', icon: 'Utensils', color: '#D17A4A' },
  { id: 'despensa', label: 'Despensa', icon: 'ShoppingBag', color: '#5F8A4C' },
  { id: 'deudas', label: 'Deudas', icon: 'Landmark', color: '#7A4E3A' },
  { id: 'otros_gas', label: 'Otros', icon: 'MoreHorizontal', color: '#9C8672' },
];

// Ya no usamos una lista fija de subcategorías de "Servicios": ahora las
// subcategorías de cualquier categoría de gasto se arman solas a partir de
// los gastos fijos (o deudas) que ya se capturaron en esa categoría. Esta
// lista se conserva nada más para poder seguir mostrando el nombre correcto
// en movimientos viejos que usaban las subcategorías fijas de antes.
const LEGACY_SERVICIO_SUBCATS = [
  { id: 'streaming', label: 'Streaming' },
  { id: 'luz', label: 'Luz' },
  { id: 'agua', label: 'Agua' },
  { id: 'basura', label: 'Basura' },
  { id: 'internet', label: 'Internet' },
  { id: 'otro_servicio', label: 'Otro' },
];

const ALL_CATS = [...INGRESO_CATS, ...GASTO_CATS];
const catById = (id) => ALL_CATS.find((c) => c.id === id) || ALL_CATS[ALL_CATS.length - 1];

// Las categorías cambiaron de nombre/lista en una actualización; esto traduce
// datos guardados con las categorías viejas a las nuevas la primera vez que
// se cargan, para que no se queden huérfanas.
const CATEGORY_MIGRATION = {
  ingreso: { ventas: 'otros_ing', sueldo: 'nomina' },
  gasto: { inventario: 'otros_gas', nomina: 'otros_gas' },
};
const migrateCategory = (type, catId) => (CATEGORY_MIGRATION[type] && CATEGORY_MIGRATION[type][catId]) || catId;

const ROLES = [
  { id: 'mama', label: 'Mamá' },
  { id: 'papa', label: 'Papá' },
  { id: 'hijo', label: 'Hijo(a)' },
];

// Mientras la persona escribe un monto, le agrega comas de miles en vivo
// (ej. 3000 -> 3,000). Guarda el valor ya formateado en el estado y esta
// misma función se usa para mostrarlo, así el cursor no salta raro.
const formatAmountTyping = (raw) => {
  let clean = String(raw ?? '').replace(/[^\d.]/g, '');
  const firstDot = clean.indexOf('.');
  if (firstDot !== -1) clean = clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, '');
  let [intPart, decPart] = clean.split('.');
  intPart = (intPart || '').replace(/^0+(?=\d)/, '');
  if (decPart !== undefined) decPart = decPart.slice(0, 2);
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
};
// Convierte un monto (ya sea "3,000.50" o "3000.5") a número real para sumar/guardar.
const toNumber = (raw) => parseFloat(String(raw ?? '').replace(/,/g, '')) || 0;

const fmt = (n) =>
  (n < 0 ? '-' : '') + Math.abs(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const todayStr = () => new Date().toISOString().slice(0, 10);
const periodKey = (dateStr) => dateStr.slice(0, 7);
const currentPeriodKey = periodKey(todayStr());
const uid = () => Date.now() + Math.random();

const startOfPeriod = (period) => {
  const now = new Date();
  if (period === 'hoy') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'semana') {
    const d = new Date(now);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'mes') return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(0);
};

const PERIOD_LABEL = { hoy: 'hoy', semana: 'esta semana', mes: 'este mes', todo: 'en total' };

// ---------- gráficas propias (sin librerías externas, para que funcionen sin internet) ----------
function polarToXY(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function donutSlicePath(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const so = polarToXY(cx, cy, rOuter, endAngle);
  const eo = polarToXY(cx, cy, rOuter, startAngle);
  const si = polarToXY(cx, cy, rInner, endAngle);
  const ei = polarToXY(cx, cy, rInner, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${so.x} ${so.y} A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${eo.x} ${eo.y} L ${ei.x} ${ei.y} A ${rInner} ${rInner} 0 ${largeArc} 1 ${si.x} ${si.y} Z`;
}
function CategoryDonut({ data, title = 'Gastos' }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  let angle = 0;
  const cx = 90, cy = 92, rOuter = 74, rInner = 44, rLabel = (rOuter + rInner) / 2;
  const gap = data.length > 1 ? 1.4 : 0;
  const segments = data.map((d) => {
    const sweep = (d.value / total) * 360;
    const endAngle = angle + Math.max(0, sweep - gap);
    const midAngle = angle + Math.max(0, sweep - gap) / 2;
    const labelPt = polarToXY(cx, cy, rLabel, midAngle);
    const pct = Math.round((d.value / total) * 100);
    const seg = {
      id: d.id, color: d.color, name: d.name, value: d.value,
      path: donutSlicePath(cx, cy, rOuter, rInner, angle, endAngle),
      pct, labelPt, showLabel: sweep > 18, // no metas un % en rebanadas muy angostas, se ve amontonado
    };
    angle += sweep;
    return seg;
  });
  return (
    <svg viewBox="0 0 180 184" width="100%" height="100%">
      {segments.map((s) => (
        <path key={s.id} d={s.path} fill={s.color}><title>{`${s.name}: ${fmt(s.value)} (${s.pct}%)`}</title></path>
      ))}
      {segments.map((s) => s.showLabel && (
        <text key={`${s.id}-pct`} x={s.labelPt.x} y={s.labelPt.y} textAnchor="middle" dominantBaseline="middle" fontFamily="IBM Plex Sans" fontWeight="700" fontSize="11.5" fill="#FAF9F5" style={{ pointerEvents: 'none' }}>{s.pct}%</text>
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10.5" fill="#6B6A62">{title}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontFamily="IBM Plex Mono" fontWeight="700" fontSize="14" fill="#1C1F1D">{fmt(total)}</text>
    </svg>
  );
}
function MonthlyBarChart({ data }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.ingreso, d.gasto]));
  const W = 320, H = 168, padBottom = 20, padTop = 8, legendY = H + 14;
  const groupW = W / (data.length || 1);
  const barW = Math.min(14, groupW / 3.6);
  return (
    <svg viewBox={`0 0 ${W} ${legendY + 18}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <line x1="0" y1={H - padBottom} x2={W} y2={H - padBottom} stroke="#DCD7C9" strokeWidth="1" />
      {data.map((d, i) => {
        const cx = groupW * i + groupW / 2;
        const hIn = ((H - padBottom - padTop) * d.ingreso) / max;
        const hGa = ((H - padBottom - padTop) * d.gasto) / max;
        return (
          <g key={d.key}>
            <rect x={cx - barW - 2} y={H - padBottom - hIn} width={barW} height={Math.max(0, hIn)} rx="2" fill="#2E7D5B"><title>{`Ingresos ${d.label}: ${fmt(d.ingreso)}`}</title></rect>
            <rect x={cx + 2} y={H - padBottom - hGa} width={barW} height={Math.max(0, hGa)} rx="2" fill="#B0432E"><title>{`Gastos ${d.label}: ${fmt(d.gasto)}`}</title></rect>
            <text x={cx} y={H - 5} textAnchor="middle" fontSize="10" fontFamily="IBM Plex Sans" fill="#6B6A62">{d.label}</text>
          </g>
        );
      })}
      <g transform={`translate(${W / 2 - 68}, ${legendY})`}>
        <rect width="9" height="9" rx="2" fill="#2E7D5B" /><text x="13" y="8.5" fontSize="10" fontFamily="IBM Plex Sans" fill="#6B6A62">Ingresos</text>
        <rect x="82" width="9" height="9" rx="2" fill="#B0432E" /><text x="95" y="8.5" fontSize="10" fontFamily="IBM Plex Sans" fill="#6B6A62">Gastos</text>
      </g>
    </svg>
  );
}

function DebtsBarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 320, rowStep = 34, barH = 8;
  const H = data.length * rowStep;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const top = i * rowStep;
        const w = Math.max(3, (d.value / max) * W);
        return (
          <g key={d.id}>
            <text x={0} y={top + 9} fontSize="10.5" fontFamily="IBM Plex Sans" fontWeight="500" fill="#1C1F1D">{d.name}</text>
            <text x={W} y={top + 9} textAnchor="end" fontSize="10.5" fontFamily="IBM Plex Mono" fontWeight="600" fill="#6B6A62">{fmt(d.value)}</text>
            <rect x="0" y={top + 14} width={W} height={barH} rx="4" fill="#F0EDE4" />
            <rect x="0" y={top + 14} width={w} height={barH} rx="4" fill={d.color}><title>{`${d.name}: ${fmt(d.value)}`}</title></rect>
          </g>
        );
      })}
    </svg>
  );
}

function LibroDiario() {
  const [transactions, setTransactions] = useState([]);
  const [compromisos, setCompromisos] = useState([]);
  const [savings, setSavings] = useState([]);
  const [familia, setFamilia] = useState([]);
  const [familyName, setFamilyName] = useState('');
  const [familyNameInput, setFamilyNameInput] = useState('');
  const [profile, setProfile] = useState(null);
  const [familyCode, setFamilyCode] = useState(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [onboarding, setOnboarding] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const [memberError, setMemberError] = useState('');
  const [filterAutor, setFilterAutor] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('resumen');
  const [period, setPeriod] = useState('mes');
  const [sheet, setSheet] = useState(null); // {type, ...}
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSavingFlag] = useState(false);
  const [filterCat, setFilterCat] = useState('todas');

  const [txForm, setTxForm] = useState({ type: 'gasto', amount: '', category: '', subcategory: '', note: '', date: todayStr(), shared: false, participants: [], fijo: false, fijoTarget: 'new', fijoName: '', fijoNotifyDay: '', fijoAmount: '' });
  const [txError, setTxError] = useState('');

  const [editTxForm, setEditTxForm] = useState({ id: null, type: 'gasto', amount: '', category: '', subcategory: '', note: '', date: todayStr() });
  const [editTxError, setEditTxError] = useState('');

  const [compForm, setCompForm] = useState({ kind: 'deuda', name: '', category: 'deudas', amount: '', notifyDay: '', shared: false, participants: [] });
  const [notifPermission, setNotifPermission] = useState(
    (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'unsupported'
  );
  const [compError, setCompError] = useState('');

  const [editAmountForm, setEditAmountForm] = useState({ amount: '', note: '' });
  const [editAmountError, setEditAmountError] = useState('');

  const [abonoForm, setAbonoForm] = useState({ amount: '', date: todayStr(), note: '' });
  const [abonoError, setAbonoError] = useState('');

  const [savForm, setSavForm] = useState({ name: '', target: '' });
  const [savError, setSavError] = useState('');

  const [moveForm, setMoveForm] = useState({ kind: 'deposito', amount: '', date: todayStr(), note: '' });
  const [moveError, setMoveError] = useState('');

  const [lastSync, setLastSync] = useState(null);

  // Trae lo último guardado por cualquier integrante de la familia (datos compartidos)
  const loadShared = useCallback(async () => {
    try {
      const [t, c, s, f, fn] = await Promise.allSettled([
        window.storage.get('transactions', true),
        window.storage.get('compromisos', true),
        window.storage.get('savings', true),
        window.storage.get('familia', true),
        window.storage.get('familyName', true),
      ]);
      const rawTx = t.status === 'fulfilled' && t.value ? JSON.parse(t.value.value) : [];
      const rawComp = c.status === 'fulfilled' && c.value ? JSON.parse(c.value.value) : [];
      let txChanged = false, compChanged = false;
      const migratedTx = rawTx.map((tx) => {
        const cat = migrateCategory(tx.type, tx.category);
        if (cat !== tx.category) txChanged = true;
        return cat !== tx.category ? { ...tx, category: cat } : tx;
      });
      const migratedComp = rawComp.map((cm) => {
        const cat = migrateCategory(cm.kind === 'ingreso_fijo' ? 'ingreso' : 'gasto', cm.category);
        if (cat !== cm.category) compChanged = true;
        return cat !== cm.category ? { ...cm, category: cat } : cm;
      });
      setTransactions(migratedTx);
      setCompromisos(migratedComp);
      setSavings(s.status === 'fulfilled' && s.value ? JSON.parse(s.value.value) : []);
      setFamilia(f.status === 'fulfilled' && f.value ? JSON.parse(f.value.value) : []);
      setFamilyName(fn.status === 'fulfilled' && fn.value ? JSON.parse(fn.value.value) : '');
      setLastSync(Date.now());
      if (txChanged) window.storage.set('transactions', JSON.stringify(migratedTx), true).catch(() => {});
      if (compChanged) window.storage.set('compromisos', JSON.stringify(migratedComp), true).catch(() => {});
    } catch (e) { /* si falla, se conserva lo que ya había en pantalla */ }
  }, []);

  useEffect(() => {
    (async () => {
      const code = window.libroDiario.getFamilyCode();
      setFamilyCode(code);
      if (code) {
        try {
          await loadShared();
          const p = await window.storage.get('miPerfil', false).catch(() => null);
          const localProfile = p ? JSON.parse(p.value) : null;
          setProfile(localProfile);
          if (!localProfile) setOnboarding(true);
        } catch (e) { setOnboarding(true); }
      } else {
        setOnboarding(true);
      }
      setLoading(false);
    })();
  }, [loadShared]);

  const activateFamilyCode = async (rawCode) => {
    const code = rawCode.trim();
    if (code.length < 6) return setCodeError('Usa un código de al menos 6 caracteres (letras y números).');
    setCodeError('');
    window.libroDiario.setFamilyCode(code);
    setFamilyCode(code);
    setLoading(true);
    try {
      await loadShared();
      const p = await window.storage.get('miPerfil', false).catch(() => null);
      const localProfile = p ? JSON.parse(p.value) : null;
      setProfile(localProfile);
    } catch (e) { /* seguirá en la pantalla de bienvenida */ }
    setLoading(false);
  };

  const generateCode = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes).map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
  };

  // Sincroniza con la familia: cada 20s y cada vez que se reabre la app en el celular
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(loadShared, 20000);
    const onVisible = () => { if (document.visibilityState === 'visible') loadShared(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loading, loadShared]);

  const persist = useCallback(async (patch) => {
    setSavingFlag(true);
    if (patch.transactions) setTransactions(patch.transactions);
    if (patch.compromisos) setCompromisos(patch.compromisos);
    if (patch.savings) setSavings(patch.savings);
    if (patch.familia) setFamilia(patch.familia);
    if (patch.familyName !== undefined) setFamilyName(patch.familyName);
    try {
      const jobs = [];
      if (patch.transactions) jobs.push(window.storage.set('transactions', JSON.stringify(patch.transactions), true));
      if (patch.compromisos) jobs.push(window.storage.set('compromisos', JSON.stringify(patch.compromisos), true));
      if (patch.savings) jobs.push(window.storage.set('savings', JSON.stringify(patch.savings), true));
      if (patch.familia) jobs.push(window.storage.set('familia', JSON.stringify(patch.familia), true));
      if (patch.familyName !== undefined) jobs.push(window.storage.set('familyName', JSON.stringify(patch.familyName), true));
      await Promise.all(jobs);
    } catch (e) { /* local state still holds it for this session */ }
    setSavingFlag(false);
  }, []);

  const chooseProfile = async (name) => {
    const p = { name };
    setProfile(p);
    setOnboarding(false);
    try { await window.storage.set('miPerfil', JSON.stringify(p), false); } catch (e) { /* stays local this session */ }
  };

  const [nicknameEdit, setNicknameEdit] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameError, setNicknameError] = useState('');

  const [familyNameEdit, setFamilyNameEdit] = useState(false);
  const [familyNameEditInput, setFamilyNameEditInput] = useState('');

  const renameFamily = (newName) => {
    persist({ familyName: newName.trim() });
    setFamilyNameEdit(false);
  };

  const renameProfile = async (newName) => {
    const clean = newName.trim();
    if (!clean) return setNicknameError('Escribe un nombre.');
    const oldName = profile?.name;
    if (clean !== oldName && familia.some((m) => m.toLowerCase() === clean.toLowerCase())) {
      return setNicknameError('Ya existe alguien con ese nombre.');
    }
    setNicknameError('');
    const nextFamilia = familia.map((m) => (m === oldName ? clean : m));
    const p = { name: clean };
    setProfile(p);
    setNicknameEdit(false);
    try { await window.storage.set('miPerfil', JSON.stringify(p), false); } catch (e) { /* local nomás */ }
    persist({ familia: nextFamilia });
  };

  const addFamilyMember = (name, andSelect) => {
    const clean = name.trim();
    if (!clean) return setMemberError('Escribe un nombre.');
    if (familia.some((m) => m.toLowerCase() === clean.toLowerCase())) return setMemberError('Ya existe alguien con ese nombre.');
    const next = [...familia, clean];
    persist({ familia: next });
    setNewMemberName('');
    setNewMemberRole('');
    setFamilyNameInput('');
    setMemberError('');
    if (andSelect) chooseProfile(clean);
  };

  // Flujo de onboarding: junta responsabilidad + nombre (ej. "Papá Henry") y,
  // si es una familia recién creada, guarda también el nombre de la familia.
  const submitNewMember = () => {
    const clean = newMemberName.trim();
    if (!clean) return setMemberError('Escribe tu nombre.');
    if (!newMemberRole) return setMemberError('Elige tu responsabilidad en la familia.');
    const roleLabel = ROLES.find((r) => r.id === newMemberRole)?.label || '';
    const displayName = `${roleLabel} ${clean}`.trim();
    if (familia.length === 0 && familyNameInput.trim()) {
      persist({ familyName: familyNameInput.trim() });
    }
    addFamilyMember(displayName, true);
  };

  // ---------- derived: transactions ----------
  const filtered = useMemo(() => {
    const start = startOfPeriod(period);
    return transactions.filter((t) => new Date(t.date + 'T12:00:00') >= start);
  }, [transactions, period]);

  const savingsMovesInPeriod = useMemo(() => {
    const start = startOfPeriod(period);
    let net = 0;
    savings.forEach((acc) => acc.movements.forEach((m) => {
      if (new Date(m.date + 'T12:00:00') >= start) net += m.kind === 'deposito' ? m.amount : -m.amount;
    }));
    return net;
  }, [savings, period]);

  const totals = useMemo(() => {
    let ingresos = 0, gastos = 0;
    filtered.forEach((t) => (t.type === 'ingreso' ? (ingresos += t.amount) : (gastos += t.amount)));
    const disponible = ingresos - gastos - savingsMovesInPeriod;
    return { ingresos, gastos, disponible };
  }, [filtered, savingsMovesInPeriod]);

  const ahorradoTotal = useMemo(
    () => savings.reduce((sum, acc) => sum + acc.movements.reduce((s, m) => s + (m.kind === 'deposito' ? m.amount : -m.amount), 0), 0),
    [savings]
  );

  const grouped = useMemo(() => {
    const groups = {};
    let list = filterCat === 'todas' ? filtered : filtered.filter((t) => t.category === filterCat);
    if (filterAutor !== 'todos') list = list.filter((t) => (t.autor || 'Familia') === filterAutor);
    list.slice().sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
      .forEach((t) => { (groups[t.date] = groups[t.date] || []).push(t); });
    return Object.entries(groups);
  }, [filtered, filterCat, filterAutor]);

  const gastosPorCategoria = useMemo(() => {
    const map = {};
    filtered.filter((t) => t.type === 'gasto').forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).map(([id, value]) => ({ id, name: catById(id).label, value, color: catById(id).color }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const ingresosPorCategoria = useMemo(() => {
    const map = {};
    filtered.filter((t) => t.type === 'ingreso').forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).map(([id, value]) => ({ id, name: catById(id).label, value, color: catById(id).color }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const monthly6 = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('es-MX', { month: 'short' }), ingreso: 0, gasto: 0 });
    }
    transactions.forEach((t) => {
      const d = new Date(t.date + 'T12:00:00');
      const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m[t.type === 'ingreso' ? 'ingreso' : 'gasto'] += t.amount;
    });
    return months;
  }, [transactions]);

  const topCats = gastosPorCategoria.slice(0, 3);
  const maxTop = topCats.length ? topCats[0].value : 1;

  // ---------- derived: compromisos ----------
  const compromisosView = useMemo(() => compromisos.map((c) => {
    if (c.kind === 'deuda') {
      const pagado = c.payments.reduce((s, p) => s + p.amount, 0);
      const pendiente = Math.max(0, c.balance != null ? c.balance : c.amount - pagado);
      const pct = c.amount ? Math.max(0, Math.min(100, (1 - pendiente / c.amount) * 100)) : 0;
      const lastAdjustment = c.adjustments && c.adjustments.length ? c.adjustments[c.adjustments.length - 1] : null;
      return { ...c, pagado, pendiente, pct, liquidada: pendiente <= 0.01, lastAdjustment };
    }
    const pagadoMes = c.payments.filter((p) => p.period === currentPeriodKey).reduce((s, p) => s + p.amount, 0);
    const pendiente = Math.max(0, c.amount - pagadoMes);
    return { ...c, pagado: pagadoMes, pendiente, pct: c.amount ? Math.min(100, (pagadoMes / c.amount) * 100) : 0, liquidada: false };
  }), [compromisos]);

  const deudas = compromisosView.filter((c) => c.kind === 'deuda');
  const fijos = compromisosView.filter((c) => c.kind === 'fijo');
  const ingresosFijos = compromisosView.filter((c) => c.kind === 'ingreso_fijo');

  // Nombre a mostrar para una subcategoría: primero busca si es un gasto fijo
  // o deuda ya capturado (lo normal ahora), y si no, cae al listado viejo de
  // subcategorías fijas de "Servicios" (para movimientos capturados antes).
  const subcatLabel = (id) => {
    if (id == null || id === '') return '';
    const linked = compromisos.find((c) => c.id === id);
    if (linked) return linked.name;
    const legacy = LEGACY_SERVICIO_SUBCATS.find((s) => s.id === id);
    return legacy ? legacy.label : '';
  };

  // Cuentas (gastos fijos ya capturados, o deudas si la categoría es "Deudas")
  // que se pueden elegir como subcategoría rápida para una categoría de gasto dada.
  // Si no hay ninguna cuenta capturada todavía en esa categoría, regresa una lista vacía.
  const getSubAccountsForCategory = (category) => {
    if (!category) return [];
    if (category === 'deudas') return deudas.filter((c) => !c.liquidada && c.category === category);
    return fijos.filter((c) => c.category === category);
  };

  const DEBT_COLORS = ['#1E3D32', '#B0432E', '#C29B3E', '#3E6EA5', '#8A4FA0', '#5A8F3C', '#A85338', '#4E8A93', '#7A4E3A', '#8C6239'];
  const debtsChartData = useMemo(
    () => compromisosView
      .filter((c) => c.kind === 'deuda' && c.pendiente > 0.01)
      .sort((a, b) => b.pendiente - a.pendiente)
      .slice(0, 10)
      .map((c, i) => ({ id: c.id, name: c.name, value: c.pendiente, color: DEBT_COLORS[i % DEBT_COLORS.length] })),
    [compromisosView]
  );

  // ---------- derived: por cobrar (compartido) ----------
  const pendingByPerson = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      if (!t.shared) return;
      t.shared.participants.forEach((p) => {
        if (p.paid) return;
        const key = p.name.trim().toLowerCase();
        if (!map[key]) map[key] = { name: p.name.trim(), total: 0, count: 0 };
        map[key].total += p.amount;
        map[key].count += 1;
      });
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [transactions]);

  const porCobrarTotal = pendingByPerson.reduce((s, p) => s + p.total, 0);

  // ---------- actions ----------
  const openAddTx = (type) => {
    setTxForm({ type, amount: '', category: '', subcategory: '', note: '', date: todayStr(), shared: false, participants: [], fijo: false, fijoTarget: 'new', fijoName: '', fijoNotifyDay: '', fijoAmount: '' });
    setTxError('');
    setSheet({ type: 'add-tx' });
  };

  const submitTx = () => {
    const amt = toNumber(txForm.amount);
    if (!amt || amt <= 0) return setTxError('Ingresa un monto válido.');
    if (!txForm.category) return setTxError('Elige una categoría.');
    let shared = null;
    if (txForm.shared && txForm.type === 'gasto') {
      const parts = txForm.participants.filter((p) => p.name.trim() && toNumber(p.amount) > 0)
        .map((p) => ({ id: uid(), name: p.name.trim(), amount: toNumber(p.amount), paid: false }));
      const sumParts = parts.reduce((s, p) => s + p.amount, 0);
      if (sumParts > amt + 0.01) return setTxError('La suma de las partes no puede ser mayor al monto total.');
      if (parts.length) shared = { participants: parts };
    }

    let compromisoId = null;
    let paymentId = null;
    let nextCompromisos = compromisos;

    // Si eligió una "subcategoría" que en realidad es un gasto fijo o una deuda
    // ya capturados en esa categoría, este movimiento se registra como un abono/pago
    // directo a esa cuenta (sin necesidad de prender el switch de "fijo").
    const linkedFijo = txForm.type === 'gasto' && txForm.category !== 'deudas' && txForm.subcategory
      ? fijos.find((c) => c.id === txForm.subcategory) : null;
    const linkedDeuda = txForm.type === 'gasto' && txForm.category === 'deudas' && txForm.subcategory
      ? deudas.find((c) => c.id === txForm.subcategory) : null;

    if (linkedFijo) {
      paymentId = uid();
      const payment = { id: paymentId, amount: amt, date: txForm.date, period: periodKey(txForm.date), note: '', autor: profile?.name || 'Familia' };
      compromisoId = linkedFijo.id;
      nextCompromisos = compromisos.map((c) => c.id === compromisoId ? { ...c, payments: [...c.payments, payment] } : c);
    } else if (linkedDeuda) {
      paymentId = uid();
      const payment = { id: paymentId, amount: amt, date: txForm.date, period: periodKey(txForm.date), note: '', autor: profile?.name || 'Familia' };
      compromisoId = linkedDeuda.id;
      nextCompromisos = compromisos.map((c) => {
        if (c.id !== compromisoId) return c;
        const currentBalance = c.balance != null ? c.balance : c.amount;
        return { ...c, payments: [...c.payments, payment], balance: Math.max(0, currentBalance - amt) };
      });
    } else if (txForm.fijo) {
      const kind = txForm.type === 'gasto' ? 'fijo' : 'ingreso_fijo';
      const notifyDay = txForm.fijoNotifyDay ? Math.min(31, Math.max(1, parseInt(txForm.fijoNotifyDay, 10))) : null;
      if (!txForm.fijoName.trim()) return setTxError('Ponle un nombre al gasto o ingreso fijo.');
      // El "Monto total" de la cuenta puede ser distinto de lo que se está pagando
      // hoy (ej. das de alta la Renta de $3,000 pero hoy solo abonas $1,500).
      // Si lo dejan en blanco, se asume que el pago de hoy cubre el total.
      const totalAmount = txForm.fijoAmount ? toNumber(txForm.fijoAmount) : amt;
      paymentId = uid();
      const payment = { id: paymentId, amount: amt, date: txForm.date, period: periodKey(txForm.date), note: '', autor: profile?.name || 'Familia' };
      compromisoId = uid();
      nextCompromisos = [...compromisos, {
        id: compromisoId, kind, name: txForm.fijoName.trim(), category: txForm.category,
        amount: totalAmount, balance: null, payments: [payment], adjustments: [], notifyDay, shared: null,
      }];
    }

    const next = [...transactions, { id: uid(), type: txForm.type, amount: amt, category: txForm.category, subcategory: txForm.subcategory || null, note: txForm.note.trim(), date: txForm.date, shared, compromisoId, paymentId, autor: profile?.name || 'Familia' }];
    persist({ transactions: next, compromisos: nextCompromisos });
    setSheet(null);
  };

  const deleteTx = (id) => {
    if (!window.confirm('¿Eliminar este movimiento? No se puede deshacer.')) return;
    persist({ transactions: transactions.filter((t) => t.id !== id) });
  };

  const openEditTx = (t) => {
    setEditTxForm({ id: t.id, type: t.type, amount: formatAmountTyping(String(t.amount)), category: t.category, subcategory: t.subcategory || '', note: t.note || '', date: t.date });
    setEditTxError('');
    setSheet({ type: 'edit-tx' });
  };

  // Si el movimiento está vinculado a un compromiso (gasto/ingreso fijo o deuda),
  // busca el pago que le corresponde dentro de ese compromiso: por su id si ya
  // quedó guardado, o si es un movimiento capturado antes de esta corrección
  // (sin ese id), lo ubica por ser el único pago de ese mes — así también
  // se reconcilian automáticamente los movimientos que ya estaban desfasados.
  const findLinkedPayment = (tx, compromiso) => {
    if (!compromiso) return null;
    if (tx.paymentId) return compromiso.payments.find((p) => p.id === tx.paymentId) || null;
    const period = periodKey(tx.date);
    const candidates = compromiso.payments.filter((p) => p.period === period);
    return candidates.length === 1 ? candidates[0] : null;
  };

  const submitEditTx = () => {
    const amt = toNumber(editTxForm.amount);
    if (!amt || amt <= 0) return setEditTxError('Ingresa un monto válido.');
    if (!editTxForm.category) return setEditTxError('Elige una categoría.');
    const orig = transactions.find((t) => t.id === editTxForm.id);
    let nextCompromisos = compromisos;
    let syncedPaymentId = orig?.paymentId || null;
    if (orig?.compromisoId) {
      const c = compromisos.find((x) => x.id === orig.compromisoId);
      const linkedPayment = findLinkedPayment(orig, c);
      if (c && linkedPayment) {
        syncedPaymentId = linkedPayment.id;
        const delta = amt - linkedPayment.amount;
        nextCompromisos = compromisos.map((x) => {
          if (x.id !== c.id) return x;
          const nextPayments = x.payments.map((p) => p.id === linkedPayment.id ? { ...p, amount: amt, date: editTxForm.date, period: periodKey(editTxForm.date) } : p);
          if (x.kind === 'deuda') {
            const currentBalance = x.balance != null ? x.balance : x.amount;
            return { ...x, payments: nextPayments, balance: Math.max(0, currentBalance - delta) };
          }
          return { ...x, payments: nextPayments };
        });
      }
    }
    const next = transactions.map((t) => t.id === editTxForm.id ? {
      ...t,
      amount: amt,
      category: editTxForm.category,
      subcategory: editTxForm.subcategory || null,
      note: editTxForm.note.trim(),
      date: editTxForm.date,
      paymentId: syncedPaymentId,
    } : t);
    persist({ transactions: next, compromisos: nextCompromisos });
    setSheet(null);
  };

  const deleteTxFromEdit = () => {
    if (!window.confirm('¿Eliminar este movimiento? No se puede deshacer.')) return;
    const orig = transactions.find((t) => t.id === editTxForm.id);
    let nextCompromisos = compromisos;
    if (orig?.compromisoId) {
      const c = compromisos.find((x) => x.id === orig.compromisoId);
      const linkedPayment = findLinkedPayment(orig, c);
      if (c && linkedPayment) {
        nextCompromisos = compromisos.map((x) => {
          if (x.id !== c.id) return x;
          const nextPayments = x.payments.filter((p) => p.id !== linkedPayment.id);
          if (x.kind === 'deuda') {
            const currentBalance = x.balance != null ? x.balance : x.amount;
            return { ...x, payments: nextPayments, balance: Math.max(0, currentBalance + linkedPayment.amount) };
          }
          return { ...x, payments: nextPayments };
        });
      }
    }
    persist({ transactions: transactions.filter((t) => t.id !== editTxForm.id), compromisos: nextCompromisos });
    setSheet(null);
  };

  const openNewCompromiso = () => {
    setCompForm({ kind: 'deuda', name: '', category: 'deudas', amount: '', notifyDay: '', shared: false, participants: [] });
    setCompError('');
    setSheet({ type: 'new-compromiso' });
  };

  const submitCompromiso = () => {
    const amt = toNumber(compForm.amount);
    if (!compForm.name.trim()) return setCompError('Ponle un nombre.');
    if (!amt || amt <= 0) return setCompError('Ingresa un monto válido.');
    let notifyDay = null;
    if ((compForm.kind === 'fijo' || compForm.kind === 'ingreso_fijo') && compForm.notifyDay) {
      const day = parseInt(compForm.notifyDay, 10);
      if (day >= 1 && day <= 31) notifyDay = day;
    }
    let shared = null;
    if (compForm.kind === 'fijo' && compForm.shared) {
      const parts = compForm.participants.filter((p) => p.name.trim() && toNumber(p.amount) > 0)
        .map((p) => ({ id: uid(), name: p.name.trim(), amount: toNumber(p.amount) }));
      const sumParts = parts.reduce((s, p) => s + p.amount, 0);
      if (sumParts > amt + 0.01) return setCompError('La suma de las partes no puede ser mayor al monto mensual.');
      if (parts.length) shared = { participants: parts };
    }
    const next = [...compromisos, { id: uid(), kind: compForm.kind, name: compForm.name.trim(), category: compForm.category, amount: amt, balance: amt, payments: [], adjustments: [], notifyDay, shared }];
    persist({ compromisos: next });
    setSheet(null);
  };

  const addCompParticipant = () => setCompForm((f) => ({ ...f, participants: [...f.participants, { id: uid(), name: '', amount: '' }] }));
  const updateCompParticipant = (id, patch) => setCompForm((f) => ({ ...f, participants: f.participants.map((p) => p.id === id ? { ...p, ...patch } : p) }));
  const removeCompParticipant = (id) => setCompForm((f) => ({ ...f, participants: f.participants.filter((p) => p.id !== id) }));
  const compMyShare = compForm.amount ? Math.max(0, toNumber(compForm.amount) - compForm.participants.reduce((s, p) => s + toNumber(p.amount), 0)) : 0;

  const deleteCompromiso = (id) => {
    const c = compromisos.find((x) => x.id === id);
    const label = c?.kind === 'deuda' ? 'esta deuda' : c?.kind === 'ingreso_fijo' ? 'este ingreso fijo' : 'este gasto fijo';
    if (!window.confirm(`¿Eliminar ${label}${c ? ` "${c.name}"` : ''}? Se perderá su historial de pagos.`)) return;
    persist({ compromisos: compromisos.filter((c) => c.id !== id) });
  };

  const openEditAmount = (compromiso) => {
    setEditAmountForm({ amount: String(compromiso.pendiente ?? compromiso.amount), note: '' });
    setEditAmountError('');
    setSheet({ type: 'edit-amount', compromiso });
  };

  const submitEditAmount = () => {
    const c = sheet.compromiso;
    const amt = toNumber(editAmountForm.amount);
    if (isNaN(amt) || amt < 0) return setEditAmountError('Ingresa un monto válido.');
    const adjustment = { id: uid(), date: todayStr(), from: c.pendiente, to: amt, note: editAmountForm.note.trim(), autor: profile?.name || 'Familia' };
    const nextCompromisos = compromisos.map((x) => x.id === c.id ? { ...x, balance: amt, adjustments: [...(x.adjustments || []), adjustment] } : x);
    persist({ compromisos: nextCompromisos });
    setSheet(null);
  };

  const openAbonar = (compromiso) => {
    setAbonoForm({ amount: compromiso.pendiente > 0 ? String(compromiso.pendiente) : '', date: todayStr(), note: '' });
    setAbonoError('');
    setSheet({ type: 'abonar', compromiso });
  };

  const submitAbono = () => {
    const c = sheet.compromiso;
    const amt = toNumber(abonoForm.amount);
    if (!amt || amt <= 0) return setAbonoError('Ingresa un monto válido.');
    const paymentId = uid();
    const payment = { id: paymentId, amount: amt, date: abonoForm.date, period: periodKey(abonoForm.date), note: abonoForm.note.trim(), autor: profile?.name || 'Familia' };
    const nextCompromisos = compromisos.map((x) => {
      if (x.id !== c.id) return x;
      const nextPayments = [...x.payments, payment];
      if (x.kind === 'deuda') {
        const currentBalance = x.balance != null ? x.balance : x.amount;
        return { ...x, payments: nextPayments, balance: Math.max(0, currentBalance - amt) };
      }
      return { ...x, payments: nextPayments };
    });
    const isIngreso = c.kind === 'ingreso_fijo';
    let shared = null;
    if (!isIngreso && c.shared && c.amount) {
      const ratio = amt / c.amount;
      const parts = c.shared.participants.filter((p) => p.amount > 0).map((p) => ({ id: uid(), name: p.name, amount: Math.round(p.amount * ratio * 100) / 100, paid: false }));
      if (parts.length) shared = { participants: parts };
    }
    const notePrefix = isIngreso ? 'Ingreso' : 'Abono';
    const nextTx = [...transactions, { id: uid(), type: isIngreso ? 'ingreso' : 'gasto', category: c.category, amount: amt, note: `${notePrefix} · ${c.name}${abonoForm.note ? ' — ' + abonoForm.note.trim() : ''}`, date: abonoForm.date, shared, compromisoId: c.id, paymentId, autor: profile?.name || 'Familia' }];
    persist({ compromisos: nextCompromisos, transactions: nextTx });
    setSheet(null);
  };

  const openNewSavings = () => {
    setSavForm({ name: '', target: '' });
    setSavError('');
    setSheet({ type: 'new-savings' });
  };

  const submitSavings = () => {
    if (!savForm.name.trim()) return setSavError('Ponle un nombre a tu meta o cuenta.');
    const target = savForm.target ? toNumber(savForm.target) : null;
    const next = [...savings, { id: uid(), name: savForm.name.trim(), target: target > 0 ? target : null, movements: [] }];
    persist({ savings: next });
    setSheet(null);
  };

  const deleteSavings = (id) => {
    const acc = savings.find((a) => a.id === id);
    if (!window.confirm(`¿Eliminar esta cuenta de ahorro${acc ? ` "${acc.name}"` : ''}? Se perderá su historial de movimientos.`)) return;
    persist({ savings: savings.filter((a) => a.id !== id) });
  };

  const openMove = (account, kind) => {
    setMoveForm({ kind, amount: '', date: todayStr(), note: '' });
    setMoveError('');
    setSheet({ type: 'savings-move', account });
  };

  const submitMove = () => {
    const acc = sheet.account;
    const amt = toNumber(moveForm.amount);
    if (!amt || amt <= 0) return setMoveError('Ingresa un monto válido.');
    const saved = acc.movements.reduce((s, m) => s + (m.kind === 'deposito' ? m.amount : -m.amount), 0);
    if (moveForm.kind === 'retiro' && amt > saved + 0.01) return setMoveError('No puedes retirar más de lo ahorrado.');
    const move = { id: uid(), kind: moveForm.kind, amount: amt, date: moveForm.date, note: moveForm.note.trim(), autor: profile?.name || 'Familia' };
    const next = savings.map((a) => a.id === acc.id ? { ...a, movements: [...a.movements, move] } : a);
    persist({ savings: next });
    setSheet(null);
  };

  const markPersonPaid = (name) => {
    let collected = 0;
    const nextTx = transactions.map((t) => {
      if (!t.shared) return t;
      let changed = false;
      const parts = t.shared.participants.map((p) => {
        if (!p.paid && p.name.trim().toLowerCase() === name.trim().toLowerCase()) { changed = true; collected += p.amount; return { ...p, paid: true }; }
        return p;
      });
      return changed ? { ...t, shared: { ...t.shared, participants: parts } } : t;
    });
    const withIncome = collected > 0
      ? [...nextTx, { id: uid(), type: 'ingreso', category: 'cobranza', amount: collected, note: `Cobro compartido de ${name}`, date: todayStr(), autor: profile?.name || 'Familia' }]
      : nextTx;
    persist({ transactions: withIncome });
  };

  const clearAll = async () => { await persist({ transactions: [], compromisos: [], savings: [] }); setSettingsOpen(false); };

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    } catch (e) { /* el navegador no dejó pedir permiso */ }
  };

  // Revisa los gastos fijos con recordatorio configurado: si hoy es el día
  // que se eligió y todavía no está pagado este mes, dispara una notificación
  // local (una sola vez por compromiso por mes). Solo funciona mientras el
  // celular abre la app en algún momento del día (no hay servidor que empuje
  // notificaciones estando la app cerrada).
  const checkFijoReminders = useCallback(() => {
    if (notifPermission !== 'granted') return;
    const today = new Date();
    const day = today.getDate();
    const period = currentPeriodKey;
    compromisosView.filter((c) => (c.kind === 'fijo' || c.kind === 'ingreso_fijo') && c.notifyDay && c.pendiente > 0.01).forEach((c) => {
      if (c.notifyDay !== day) return;
      const flagKey = `libroDiario:notified:${c.id}:${period}`;
      if (localStorage.getItem(flagKey)) return;
      const isIngreso = c.kind === 'ingreso_fijo';
      const title = isIngreso ? 'Libro·Diario — Ingreso esperado' : 'Libro·Diario — Gasto pendiente';
      const body = isIngreso
        ? `${c.name}: hoy debería llegarte ${fmt(c.amount)}. ¿Ya lo registraste?`
        : `${c.name}: te falta pagar ${fmt(c.pendiente)} este mes.`;
      const show = () => {
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png' })).catch(() => new Notification(title, { body }));
        } else {
          new Notification(title, { body });
        }
      };
      show();
      try { localStorage.setItem(flagKey, '1'); } catch (e) { /* no pasa nada si no se puede guardar la bandera */ }
    });
  }, [compromisosView, notifPermission]);

  useEffect(() => {
    if (loading) return;
    checkFijoReminders();
    const interval = setInterval(checkFijoReminders, 30 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') checkFijoReminders(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loading, checkFijoReminders]);

  const shareInvite = () => {
    const nombre = familyName ? ` de ${familyName}` : '';
    const msg = `Únete a mi Libro·Diario${nombre}. El código de familia es: ${familyCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const catOptions = txForm.type === 'ingreso' ? INGRESO_CATS : GASTO_CATS;
  const editCatOptions = editTxForm.type === 'ingreso' ? INGRESO_CATS : GASTO_CATS;
  const addParticipant = () => setTxForm((f) => ({ ...f, participants: [...f.participants, { id: uid(), name: '', amount: '' }] }));
  const updateParticipant = (id, patch) => setTxForm((f) => ({ ...f, participants: f.participants.map((p) => p.id === id ? { ...p, ...patch } : p) }));
  const removeParticipant = (id) => setTxForm((f) => ({ ...f, participants: f.participants.filter((p) => p.id !== id) }));
  const myShare = txForm.amount ? Math.max(0, toNumber(txForm.amount) - txForm.participants.reduce((s, p) => s + toNumber(p.amount), 0)) : 0;

  // Atajo desde el icono de la app (Android: mantener presionado el ícono)
  // o desde un acceso directo de iOS Shortcuts que abra index.html?accion=gasto
  useEffect(() => {
    if (loading || onboarding) return;
    const params = new URLSearchParams(window.location.search);
    const accion = params.get('accion');
    if (accion === 'gasto' || accion === 'ingreso') {
      openAddTx(accion === 'ingreso' ? 'ingreso' : 'gasto');
      const url = new URL(window.location.href);
      url.searchParams.delete('accion');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [loading, onboarding]);

  const fabAction = () => {
    if (tab === 'compromisos') return openNewCompromiso();
    if (tab === 'ahorro') return openNewSavings();
    return openAddTx('gasto');
  };

  return (
    <div className="ledger-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        .ledger-app {
          --paper: #FAF9F5; --paper-dim: #F0EDE4; --ink: #1C1F1D; --ink-soft: #6B6A62;
          --green: #1E3D32; --green-soft: #2C5645; --gold: #C29B3E; --income: #2E7D5B;
          --expense: #B0432E; --line: #DCD7C9; --mono: 'IBM Plex Mono', ui-monospace, monospace;
          --sans: 'IBM Plex Sans', system-ui, sans-serif;
          font-family: var(--sans); color: var(--ink); background: var(--paper-dim);
          max-width: 460px; margin: 0 auto; height: 100dvh; height: 100vh; display: flex; flex-direction: column;
          position: relative; box-shadow: 0 0 40px rgba(0,0,0,0.08); overflow: hidden;
        }
        .masthead { background: var(--green); color: var(--paper); padding: calc(20px + env(safe-area-inset-top, 0px)) 20px 0 20px; border-radius: 0 0 20px 20px; }
        .masthead-top { display: flex; align-items: center; justify-content: space-between; }
        .brand { font-family: var(--mono); font-size: 13px; letter-spacing: 3px; font-weight: 600; text-transform: uppercase; opacity: 0.85; }
        .brand .dot { color: var(--gold); margin: 0 6px; }
        .icon-btn { background: rgba(255,255,255,0.1); border: none; color: var(--paper); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .icon-btn:hover { background: rgba(255,255,255,0.18); }
        .balance-block { margin-top: 18px; }
        .balance-label { font-size: 12px; opacity: 0.7; text-transform: uppercase; letter-spacing: 1.5px; }
        .balance-amount { font-family: var(--mono); font-weight: 700; font-size: clamp(26px, 8vw, 36px); margin-top: 4px; letter-spacing: -0.5px; overflow-wrap: break-word; }
        .balance-amount.pos { color: #8FD9B6; } .balance-amount.neg { color: #F0A98F; }
        .ahorro-line { font-size: 11.5px; opacity: 0.75; margin-top: 2px; display: flex; align-items: center; gap: 5px; font-family: var(--mono); }
        .period-tabs { display: flex; gap: 6px; margin-top: 14px; }
        .period-chip { font-family: var(--sans); font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.25); background: transparent; color: rgba(255,255,255,0.75); cursor: pointer; }
        .period-chip.active { background: var(--paper); color: var(--green); border-color: var(--paper); font-weight: 600; }
        .stub-row { display: flex; gap: 8px; margin-top: 14px; padding-bottom: 18px; }
        .stub { flex: 1; min-width: 0; background: rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 8px; display: flex; align-items: center; gap: 6px; overflow: hidden; }
        .stub-icon { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stub-icon.in { background: rgba(143,217,182,0.2); color: #8FD9B6; }
        .stub-icon.out { background: rgba(240,169,143,0.2); color: #F0A98F; }
        .stub-text { display: flex; flex-direction: column; min-width: 0; flex: 1; overflow: hidden; }
        .stub-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; opacity: 0.65; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stub-amount { font-family: var(--mono); font-size: clamp(10px, 3.2vw, 14px); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
        .tape-edge { height: 10px; background: linear-gradient(135deg, transparent 6px, var(--paper-dim) 0) 0 0, linear-gradient(-135deg, transparent 6px, var(--paper-dim) 0) 0 0; background-size: 12px 12px; background-repeat: repeat-x; background-color: var(--green); }
        .content { flex: 1; min-height: 0; padding: 16px 16px 150px 16px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .card { background: var(--paper); border-radius: 14px; padding: 16px; margin-bottom: 14px; border: 1px solid var(--line); }
        .card-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; color: var(--ink-soft); font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
        .cat-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .cat-row:last-child { margin-bottom: 0; }
        .cat-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
        .cat-bar-track { flex: 1; height: 6px; background: var(--paper-dim); border-radius: 4px; overflow: hidden; }
        .cat-bar-fill { height: 100%; border-radius: 4px; }
        .cat-row-label { font-size: 13px; width: 84px; flex-shrink: 0; }
        .cat-row-amount { font-family: var(--mono); font-size: 13px; font-weight: 600; width: 78px; text-align: right; flex-shrink: 0; }
        .empty-state { text-align: center; padding: 44px 20px; color: var(--ink-soft); }
        .empty-state .eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--gold); margin-bottom: 8px; }
        .filter-row { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; }
        .filter-chip { font-size: 12px; padding: 6px 12px; border-radius: 20px; border: 1px solid var(--line); background: var(--paper); color: var(--ink-soft); white-space: nowrap; cursor: pointer; flex-shrink: 0; }
        .filter-chip.active { background: var(--green); border-color: var(--green); color: var(--paper); }
        .date-group { margin-bottom: 18px; }
        .date-heading { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--ink-soft); margin-bottom: 8px; padding-left: 2px; }
        .tx-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px dashed var(--line); cursor: pointer; border-radius: 8px; transition: background 0.12s; }
        .tx-row:last-child { border-bottom: none; }
        .tx-row:hover, .tx-row:active { background: var(--paper-dim); }
        .tx-icon { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: white; }
        .tx-mid { flex: 1; min-width: 0; }
        .tx-cat { font-size: 13.5px; font-weight: 600; display: flex; align-items: center; gap: 5px; }
        .tx-note { font-size: 12px; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tx-amount { font-family: var(--mono); font-weight: 700; font-size: 14px; flex-shrink: 0; }
        .tx-amount.in { color: var(--income); } .tx-amount.out { color: var(--expense); }
        .tx-edit-hint { color: var(--ink-soft); opacity: 0.35; flex-shrink: 0; display: flex; }
        .shared-badge { font-size: 9px; background: var(--gold); color: var(--green); padding: 1px 5px; border-radius: 5px; font-weight: 700; letter-spacing: 0.3px; }
        .bottom-nav { position: sticky; bottom: 0; background: var(--paper); border-top: 1px solid var(--line); display: flex; padding: 7px 4px calc(7px + env(safe-area-inset-bottom, 0px)) 4px; justify-content: space-around; align-items: center; }
        .nav-btn { background: none; border: none; display: flex; flex-direction: column; align-items: center; gap: 3px; color: var(--ink-soft); font-size: 9px; font-weight: 600; padding: 6px 10px; border-radius: 12px; cursor: pointer; letter-spacing: 0.3px; text-transform: uppercase; transition: background 0.15s, color 0.15s; }
        .nav-btn.active { font-weight: 700; }
        .fab { position: absolute; right: 18px; bottom: 78px; width: 56px; height: 56px; border-radius: 50%; background: var(--gold); color: var(--green); border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(194,155,62,0.45); cursor: pointer; z-index: 5; }
        .sheet-backdrop, .settings-panel { position: absolute; inset: 0; background: rgba(20,24,20,0.5); display: flex; align-items: flex-end; z-index: 10; }
        .sheet, .settings-card { background: var(--paper); width: 100%; border-radius: 20px 20px 0 0; padding: 18px 18px calc(18px + env(safe-area-inset-bottom, 0px)) 18px; max-height: 88vh; overflow-y: auto; }
        .sheet-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .sheet-title { font-family: var(--mono); font-weight: 700; font-size: 15px; letter-spacing: 0.5px; }
        .type-toggle { display: flex; background: var(--paper-dim); border-radius: 12px; padding: 4px; margin-bottom: 18px; }
        .type-toggle button { flex: 1; border: none; background: none; padding: 10px; border-radius: 9px; font-weight: 600; font-size: 13px; cursor: pointer; color: var(--ink-soft); display: flex; align-items: center; justify-content: center; gap: 6px; }
        .type-toggle button.active.ingreso { background: var(--income); color: white; }
        .type-toggle button.active.gasto { background: var(--expense); color: white; }
        .type-toggle button.active.deuda { background: var(--green); color: white; }
        .type-toggle button.active.fijo { background: var(--gold); color: var(--green); }
        .type-toggle button.active.deposito { background: var(--income); color: white; }
        .type-toggle button.active.retiro { background: var(--expense); color: white; }
        .field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-soft); font-weight: 600; margin: 14px 0 8px 0; }
        .amount-input-wrap { display: flex; align-items: baseline; gap: 6px; border-bottom: 2px solid var(--line); padding-bottom: 6px; }
        .amount-currency { font-family: var(--mono); font-size: 22px; color: var(--ink-soft); }
        .amount-input { border: none; background: none; font-family: var(--mono); font-size: 32px; font-weight: 700; width: 100%; color: var(--ink); outline: none; }
        .cat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .subcat-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
        .subcat-chip { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--line); background: var(--paper); color: var(--ink); border-radius: 999px; padding: 7px 13px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .subcat-chip.selected { background: var(--green); color: var(--paper); border-color: var(--green); }
        .account-info-box { background: var(--paper-dim); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin: 4px 0 12px; }
        .account-info-box .name { font-weight: 700; font-size: 13px; margin-bottom: 3px; }
        .account-info-box .meta { font-size: 11.5px; color: var(--ink-soft); display: flex; flex-wrap: wrap; gap: 10px 14px; }
        .account-feedback { display: flex; align-items: center; font-size: 12px; margin: -6px 0 12px; padding: 8px 10px; border-radius: 8px; }
        .account-feedback.ok { background: rgba(46,125,91,0.12); color: var(--income); }
        .account-feedback.pending { background: rgba(176,67,46,0.1); color: var(--expense); }
        .cat-choice { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 4px; border-radius: 12px; border: 1.5px solid var(--line); background: var(--paper); cursor: pointer; }
        .cat-choice.selected { border-color: var(--green); background: rgba(30,61,50,0.06); }
        .cat-choice-icon { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
        .cat-choice-label { font-size: 10.5px; font-weight: 500; text-align: center; }
        .text-input { width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-family: var(--sans); font-size: 14px; outline: none; background: var(--paper); box-sizing: border-box; }
        .text-input:focus { border-color: var(--green); }
        .form-error { color: var(--expense); font-size: 12px; margin-top: 10px; font-weight: 500; }
        .save-btn { width: 100%; background: var(--green); color: var(--paper); border: none; border-radius: 12px; padding: 14px; font-weight: 700; font-size: 14px; margin-top: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; letter-spacing: 0.3px; }
        .save-btn:active { background: var(--green-soft); }
        .danger-btn { width: 100%; background: none; border: 1.5px solid var(--expense); color: var(--expense); border-radius: 10px; padding: 12px; font-weight: 600; font-size: 13px; margin-top: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .danger-btn.neutral { border-color: var(--line); color: var(--green); }
        .bell-toggle-btn { width: 100%; background: var(--paper-dim); border: 1px solid var(--line); color: var(--ink); border-radius: 10px; padding: 12px; font-weight: 600; font-size: 13px; margin-top: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .bell-toggle-btn.on { background: var(--green); color: var(--paper); border-color: var(--green); }
        .compromiso-notify { font-size: 10.5px; color: var(--ink-soft); display: flex; align-items: center; gap: 4px; margin-top: -4px; margin-bottom: 10px; }
        .close-row { display: flex; justify-content: flex-end; margin-bottom: 6px; }
        .saving-dot { font-size: 10px; color: var(--gold); font-family: var(--mono); letter-spacing: 1px; }
        .chart-wrap { width: 100%; height: 205px; margin-top: 4px; }
        .debts-chart-wrap { width: 100%; margin-top: 6px; }
        .legend-row { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 10px; }
        .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--ink-soft); }
        .legend-dot { width: 8px; height: 8px; border-radius: 2px; }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
        .toggle-row-label { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .switch { width: 42px; height: 24px; border-radius: 14px; background: var(--line); border: none; position: relative; cursor: pointer; flex-shrink: 0; }
        .switch.on { background: var(--green); }
        .switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: white; transition: left 0.15s; }
        .switch.on::after { left: 21px; }
        .participant-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
        .participant-row .text-input { flex: 1; }
        .participant-row .amount-mini { width: 90px; flex-shrink: 0; }
        .remove-participant { background: none; border: none; color: var(--ink-soft); cursor: pointer; flex-shrink: 0; padding: 4px; }
        .add-participant-btn { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--green); background: none; border: 1px dashed var(--line); border-radius: 10px; padding: 9px; width: 100%; justify-content: center; cursor: pointer; margin-top: 4px; }
        .my-share-line { font-size: 12px; color: var(--ink-soft); margin-top: 10px; font-family: var(--mono); }
        .compromiso-card { background: var(--paper); border-radius: 14px; padding: 14px; margin-bottom: 12px; border: 1px solid var(--line); }
        .compromiso-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .compromiso-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
        .compromiso-name { font-weight: 700; font-size: 14px; }
        .compromiso-sub { font-size: 11px; color: var(--ink-soft); }
        .compromiso-del { margin-left: auto; background: none; border: none; color: var(--ink-soft); opacity: 0.4; cursor: pointer; }
        .progress-track { height: 8px; background: var(--paper-dim); border-radius: 5px; overflow: hidden; margin-bottom: 4px; }
        .progress-fill { height: 100%; border-radius: 5px; background: var(--income); }
        .progress-pct { font-size: 11.5px; color: var(--ink-soft); font-weight: 600; margin-bottom: 8px; }
        .compromiso-nums { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 12px; margin-bottom: 10px; }
        .compromiso-nums .pend { color: var(--expense); font-weight: 700; }
        .compromiso-nums .pend.done { color: var(--income); }
        .abonar-btn { width: 100%; background: var(--green); color: var(--paper); border: none; border-radius: 10px; padding: 10px; font-weight: 600; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .abonar-btn:disabled { background: var(--line); color: var(--ink-soft); cursor: default; }
        .kind-badge { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; padding: 2px 6px; border-radius: 5px; }
        .kind-badge.deuda { background: rgba(30,61,50,0.1); color: var(--green); }
        .kind-badge.fijo { background: rgba(194,155,62,0.15); color: #8A6B1F; }
        .kind-badge.ingreso { background: rgba(46,125,91,0.12); color: var(--income); }
        .savings-card { background: var(--paper); border-radius: 14px; padding: 14px; margin-bottom: 12px; border: 1px solid var(--line); }
        .savings-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .savings-icon { width: 36px; height: 36px; border-radius: 50%; background: var(--gold); color: var(--green); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .savings-amount { font-family: var(--mono); font-weight: 700; font-size: 20px; }
        .savings-actions { display: flex; gap: 8px; margin-top: 10px; }
        .savings-actions button { flex: 1; border-radius: 10px; padding: 9px; font-weight: 600; font-size: 12.5px; cursor: pointer; border: none; }
        .btn-deposito { background: var(--income); color: white; }
        .btn-retiro { background: var(--paper-dim); color: var(--ink); border: 1px solid var(--line) !important; }
        .person-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px dashed var(--line); }
        .person-row:last-child { border-bottom: none; }
        .person-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--green); color: var(--paper); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
        .person-mid { flex: 1; }
        .person-name { font-weight: 600; font-size: 13.5px; }
        .person-count { font-size: 11px; color: var(--ink-soft); }
        .person-amount { font-family: var(--mono); font-weight: 700; font-size: 14px; color: var(--expense); }
        .mark-paid-btn { background: var(--paper-dim); border: 1px solid var(--line); color: var(--green); border-radius: 8px; padding: 6px 8px; font-size: 11px; font-weight: 600; cursor: pointer; margin-left: 8px; display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .mini-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px dashed var(--line); }
        .cxp-total-row { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
        .cxp-total-amount { font-family: var(--mono); font-size: 24px; font-weight: 700; color: var(--ink); }
        .cxp-total-label { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
        .totals-subhead { font-size: 10.5px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-soft); font-weight: 700; margin: 10px 0 4px; }
        .totals-subhead:first-child { margin-top: 0; }
        .mini-row:last-child { border-bottom: none; }
        .mini-row-mid { flex: 1; }
        .mini-row-name { font-size: 13px; font-weight: 600; }
        .mini-row-amount { font-family: var(--mono); font-size: 12.5px; color: var(--expense); font-weight: 600; }
        .mini-abonar { background: var(--green); color: var(--paper); border: none; border-radius: 8px; padding: 6px 10px; font-size: 11px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
        .mini-avatar { width: 26px; height: 26px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11.5px; flex-shrink: 0; font-family: var(--mono); }
        .autor-tag { font-weight: 700; }
        .family-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--line); }
        .family-row:last-of-type { border-bottom: none; }
        .family-row-name { font-size: 13.5px; font-weight: 600; flex: 1; }
        .you-badge { font-size: 9px; background: var(--green); color: var(--paper); padding: 2px 6px; border-radius: 5px; font-weight: 700; }
      `}</style>

      <div className="masthead">
        <div className="masthead-top">
          <span className="brand">Libro<span className="dot">•</span>Diario</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {profile && <div className="mini-avatar" style={{ background: colorForName(profile.name) }} title={profile.name}>{profile.name.charAt(0).toUpperCase()}</div>}
            <button className="icon-btn" onClick={loadShared} title="Sincronizar con la familia"><Icon name="RefreshCw" size={15} /></button>
            <button className="icon-btn" onClick={() => setSettingsOpen(true)}><Icon name="Settings" size={16} /></button>
          </div>
        </div>
        <div className="balance-block">
          <span className="balance-label">Disponible · {PERIOD_LABEL[period]}</span>
          <div className={`balance-amount ${totals.disponible >= 0 ? 'pos' : 'neg'}`}>{fmt(totals.disponible)}</div>
          <div className="ahorro-line"><Icon name="PiggyBank" size={12} /> Ahorrado: {fmt(ahorradoTotal)}{porCobrarTotal > 0 && <> · Por cobrar: {fmt(porCobrarTotal)}</>}</div>
        </div>
        <div className="period-tabs">
          {['hoy', 'semana', 'mes', 'todo'].map((p) => (
            <button key={p} className={`period-chip ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
              {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mes' : 'Todo'}
            </button>
          ))}
        </div>
        <div className="stub-row">
          <div className="stub"><div className="stub-icon in"><Icon name="ArrowUpRight" size={14} /></div><div className="stub-text"><span className="stub-label">Ingresos</span><span className="stub-amount">{fmt(totals.ingresos)}</span></div></div>
          <div className="stub"><div className="stub-icon out"><Icon name="ArrowDownRight" size={14} /></div><div className="stub-text"><span className="stub-label">Gastos</span><span className="stub-amount">{fmt(totals.gastos)}</span></div></div>
        </div>
      </div>
      <div className="tape-edge" />

      <div className="content">
        {loading ? (
          <div className="empty-state"><span className="eyebrow">Abriendo el libro…</span></div>
        ) : tab === 'resumen' ? (
          <>
            {deudas.some((c) => c.pendiente > 0.01) && (
              <div className="card">
                <div className="card-title">Cuentas por pagar (CxP)</div>
                <div className="cxp-total-row">
                  <div>
                    <div className="cxp-total-amount">{fmt(deudas.reduce((s, c) => s + (c.pendiente > 0.01 ? c.pendiente : 0), 0))}</div>
                    <div className="cxp-total-label">{deudas.filter((c) => c.pendiente > 0.01).length} deuda{deudas.filter((c) => c.pendiente > 0.01).length !== 1 ? 's' : ''} pendiente{deudas.filter((c) => c.pendiente > 0.01).length !== 1 ? 's' : ''}</div>
                  </div>
                  <button className="mini-abonar" onClick={() => setTab('compromisos')}>Ver detalle</button>
                </div>
              </div>
            )}
            {pendingByPerson.length > 0 && (
              <div className="card">
                <div className="card-title">Por cobrar (gastos compartidos)</div>
                {pendingByPerson.map((p) => (
                  <div className="person-row" key={p.name}>
                    <div className="person-avatar">{p.name.charAt(0).toUpperCase()}</div>
                    <div className="person-mid"><div className="person-name">{p.name}</div><div className="person-count">{p.count} pendiente{p.count !== 1 ? 's' : ''}</div></div>
                    <div className="person-amount">{fmt(p.total)}</div>
                    <button className="mark-paid-btn" onClick={() => markPersonPaid(p.name)}><Icon name="CheckCircle2" size={12} /> Pagó</button>
                  </div>
                ))}
              </div>
            )}
            <div className="card">
              <div className="card-title">Principales gastos · {PERIOD_LABEL[period]}</div>
              {topCats.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Sin gastos registrados todavía.</div> :
                topCats.map((c) => (
                  <div className="cat-row" key={c.id}>
                    <span className="cat-dot" style={{ background: c.color }} />
                    <span className="cat-row-label">{c.name}</span>
                    <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${(c.value / maxTop) * 100}%`, background: c.color }} /></div>
                    <span className="cat-row-amount">{fmt(c.value)}</span>
                  </div>
                ))}
            </div>
            {(gastosPorCategoria.length > 0 || ingresosPorCategoria.length > 0) && (
              <div className="card">
                <div className="card-title">Todos los movimientos · {PERIOD_LABEL[period]}</div>
                {ingresosPorCategoria.length > 0 && (
                  <>
                    <div className="totals-subhead">Ingresos</div>
                    {ingresosPorCategoria.map((c) => (
                      <div className="cat-row" key={`in-${c.id}`}>
                        <span className="cat-dot" style={{ background: c.color }} />
                        <span className="cat-row-label">{c.name}</span>
                        <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${(c.value / (ingresosPorCategoria[0]?.value || 1)) * 100}%`, background: c.color }} /></div>
                        <span className="cat-row-amount">{fmt(c.value)}</span>
                      </div>
                    ))}
                  </>
                )}
                {gastosPorCategoria.length > 0 && (
                  <>
                    <div className="totals-subhead">Gastos</div>
                    {gastosPorCategoria.map((c) => (
                      <div className="cat-row" key={`ga-${c.id}`}>
                        <span className="cat-dot" style={{ background: c.color }} />
                        <span className="cat-row-label">{c.name}</span>
                        <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${(c.value / (gastosPorCategoria[0]?.value || 1)) * 100}%`, background: c.color }} /></div>
                        <span className="cat-row-amount">{fmt(c.value)}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
            <div className="card">
              <div className="card-title">Últimos 6 meses</div>
              <div className="chart-wrap">
                <MonthlyBarChart data={monthly6} />
              </div>
            </div>
          </>
        ) : tab === 'movimientos' ? (
          <>
            <div className="filter-row">
              <button className={`filter-chip ${filterCat === 'todas' ? 'active' : ''}`} onClick={() => setFilterCat('todas')}>Todas</button>
              {ALL_CATS.map((c) => <button key={c.id} className={`filter-chip ${filterCat === c.id ? 'active' : ''}`} onClick={() => setFilterCat(c.id)}>{c.label}</button>)}
            </div>
            {familia.length > 0 && (
              <div className="filter-row">
                <button className={`filter-chip ${filterAutor === 'todos' ? 'active' : ''}`} onClick={() => setFilterAutor('todos')}>Toda la familia</button>
                {familia.map((m) => <button key={m} className={`filter-chip ${filterAutor === m ? 'active' : ''}`} onClick={() => setFilterAutor(m)}>{m}</button>)}
              </div>
            )}
            {grouped.length === 0 ? (
              <div className="empty-state"><div className="eyebrow">El libro está en blanco</div>Registra tu primer movimiento con el botón +.</div>
            ) : grouped.map(([date, txs]) => (
              <div className="date-group" key={date}>
                <div className="date-heading">{new Date(date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
                  {txs.map((t) => {
                    const c = catById(t.category);
                    return (
                      <div className="tx-row" key={t.id} onClick={() => openEditTx(t)}>
                        <div className="tx-icon" style={{ background: c.color }}><Icon name={c.icon} size={16} /></div>
                        <div className="tx-mid">
                          <div className="tx-cat">{c.label}{t.subcategory && ` · ${subcatLabel(t.subcategory)}`}{t.shared && <span className="shared-badge">COMPARTIDO</span>}</div>
                          <div className="tx-note">{t.note}{t.note && ' · '}<span className="autor-tag" style={{ color: colorForName(t.autor || 'Familia') }}>{t.autor || 'Familia'}</span></div>
                        </div>
                        <div className={`tx-amount ${t.type === 'ingreso' ? 'in' : 'out'}`}>{t.type === 'ingreso' ? '+' : '-'}{fmt(t.amount)}</div>
                        <span className="tx-edit-hint"><Icon name="Pencil" size={13} /></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        ) : tab === 'compromisos' ? (
          <>
            <div className="card-title" style={{ padding: '0 2px' }}>Cuentas por pagar (CxP)</div>
            {deudas.length === 0 ? <div className="empty-state" style={{ padding: '20px 10px' }}>Sin deudas registradas.</div> :
              deudas.map((c) => (
                <div className="compromiso-card" key={c.id}>
                  <div className="compromiso-top">
                    <div className="compromiso-icon" style={{ background: catById(c.category).color }}><Icon name="Landmark" size={16} /></div>
                    <div><div className="compromiso-name">{c.name}</div><div className="compromiso-sub"><span className="kind-badge deuda">Deuda</span> · {catById(c.category).label}</div></div>
                    <button className="compromiso-del" onClick={() => deleteCompromiso(c.id)}><Icon name="Trash2" size={14} /></button>
                  </div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${c.pct}%`, background: c.liquidada ? 'var(--income)' : 'var(--gold)' }} /></div>
                  <div className="compromiso-nums">
                    <span>Original: {fmt(c.amount)}</span>
                    <span>Abonado: {fmt(c.pagado)}</span>
                    <span className={`pend ${c.liquidada ? 'done' : ''}`}>{c.liquidada ? 'Liquidada' : `Faltan ${fmt(c.pendiente)}`}</span>
                  </div>
                  {c.lastAdjustment && (
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: -4, marginBottom: 10 }}>
                      Último ajuste: {new Date(c.lastAdjustment.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · {fmt(c.lastAdjustment.to)}{c.lastAdjustment.note ? ` — ${c.lastAdjustment.note}` : ''}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="abonar-btn" disabled={c.liquidada} onClick={() => openAbonar(c)} style={{ flex: 1 }}>{c.liquidada ? 'Liquidada ✓' : 'Abonar'}</button>
                    <button
                      className="abonar-btn"
                      style={{ flex: 1, background: 'var(--paper-dim)', color: 'var(--ink)', border: '1px solid var(--line)' }}
                      onClick={() => openEditAmount(c)}
                      title="Actualiza el saldo con el monto que te mande tu banco"
                    >
                      <Icon name="Pencil" size={12} /> Actualizar monto
                    </button>
                  </div>
                </div>
              ))}
          </>
        ) : tab === 'ahorro' ? (
          <>
            {savings.length === 0 ? (
              <div className="empty-state"><div className="eyebrow">Aún no ahorras nada</div>Crea una cuenta o meta con el botón +.</div>
            ) : savings.map((acc) => {
              const saved = acc.movements.reduce((s, m) => s + (m.kind === 'deposito' ? m.amount : -m.amount), 0);
              const pct = acc.target ? Math.min(100, (saved / acc.target) * 100) : null;
              return (
                <div className="savings-card" key={acc.id}>
                  <div className="savings-top">
                    <div className="savings-icon"><Icon name="PiggyBank" size={17} /></div>
                    <div style={{ flex: 1 }}>
                      <div className="compromiso-name">{acc.name}</div>
                      <div className="savings-amount">{fmt(saved)}{acc.target && <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500 }}> / {fmt(acc.target)}</span>}</div>
                    </div>
                    <button className="compromiso-del" onClick={() => deleteSavings(acc.id)}><Icon name="Trash2" size={14} /></button>
                  </div>
                  {pct !== null && (
                    <>
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                      <div className="progress-pct">{pct.toFixed(0)}% de tu meta</div>
                    </>
                  )}
                  <div className="savings-actions">
                    <button className="btn-deposito" onClick={() => openMove(acc, 'deposito')}>Depositar</button>
                    <button className="btn-retiro" onClick={() => openMove(acc, 'retiro')}>Retirar</button>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <div className="card">
              <div className="card-title">Gastos por categoría · {PERIOD_LABEL[period]}</div>
              {gastosPorCategoria.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Sin gastos en este periodo.</div> : (
                <>
                  <div className="chart-wrap">
                    <CategoryDonut data={gastosPorCategoria} />
                  </div>
                  <div className="legend-row">{gastosPorCategoria.map((c) => <div className="legend-item" key={c.id}><span className="legend-dot" style={{ background: c.color }} />{c.name}</div>)}</div>
                </>
              )}
            </div>
            <div className="card">
              <div className="card-title">Ingresos vs. gastos · últimos 6 meses</div>
              <div className="chart-wrap">
                <MonthlyBarChart data={monthly6} />
              </div>
            </div>
            <div className="card">
              <div className="card-title">Cuentas por pagar (CxP)</div>
              {debtsChartData.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Sin deudas pendientes.</div> : (
                <>
                  <div className="chart-wrap">
                    <CategoryDonut data={debtsChartData} title="CxP" />
                  </div>
                  <div className="legend-row">{debtsChartData.map((c) => <div className="legend-item" key={c.id}><span className="legend-dot" style={{ background: c.color }} />{c.name}</div>)}</div>
                </>
              )}
            </div>
            <div className="card">
              <div className="card-title">Gastos e ingresos fijos</div>
              {fijos.length === 0 && ingresosFijos.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Aún no tienes gastos ni ingresos fijos. Márcalos como "fijo" al registrar un movimiento.</div>
              ) : (
                <>
                  {fijos.map((c) => (
                    <div className="compromiso-card" key={c.id}>
                      <div className="compromiso-top">
                        <div className="compromiso-icon" style={{ background: catById(c.category).color }}><Icon name="Repeat" size={16} /></div>
                        <div><div className="compromiso-name">{c.name}</div><div className="compromiso-sub"><span className="kind-badge fijo">Gasto fijo</span> · {catById(c.category).label}{c.shared && <> · <span className="shared-badge">COMPARTIDO</span></>}</div></div>
                        <button className="compromiso-del" onClick={() => deleteCompromiso(c.id)}><Icon name="Trash2" size={14} /></button>
                      </div>
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${c.pct}%`, background: c.pendiente <= 0.01 ? 'var(--income)' : 'var(--gold)' }} /></div>
                      <div className="compromiso-nums">
                        <span>Mensual: {fmt(c.amount)}</span>
                        <span>Pagado: {fmt(c.pagado)}</span>
                        <span className={`pend ${c.pendiente <= 0.01 ? 'done' : ''}`}>{c.pendiente <= 0.01 ? 'Al día ✓' : `Faltan ${fmt(c.pendiente)}`}</span>
                      </div>
                      {c.notifyDay && (
                        <div className="compromiso-notify">
                          <Icon name={notifPermission === 'granted' ? 'Bell' : 'BellOff'} size={11} />
                          Recordatorio el día {c.notifyDay} de cada mes{notifPermission !== 'granted' ? ' (activa notificaciones en Ajustes)' : ''}
                        </div>
                      )}
                      <button className="abonar-btn" disabled={c.pendiente <= 0.01} onClick={() => openAbonar(c)}>{c.pendiente <= 0.01 ? 'Pagado este mes' : 'Pagar / Abonar'}</button>
                    </div>
                  ))}
                  {ingresosFijos.map((c) => (
                    <div className="compromiso-card" key={c.id}>
                      <div className="compromiso-top">
                        <div className="compromiso-icon" style={{ background: catById(c.category).color }}><Icon name={catById(c.category).icon} size={16} /></div>
                        <div><div className="compromiso-name">{c.name}</div><div className="compromiso-sub"><span className="kind-badge ingreso">Ingreso fijo</span> · {catById(c.category).label}</div></div>
                        <button className="compromiso-del" onClick={() => deleteCompromiso(c.id)}><Icon name="Trash2" size={14} /></button>
                      </div>
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${c.pct}%`, background: 'var(--income)' }} /></div>
                      <div className="compromiso-nums">
                        <span>Esperado: {fmt(c.amount)}</span>
                        <span>Recibido: {fmt(c.pagado)}</span>
                        <span className={`pend ${c.pendiente <= 0.01 ? 'done' : ''}`}>{c.pendiente <= 0.01 ? 'Recibido ✓' : `Faltan ${fmt(c.pendiente)}`}</span>
                      </div>
                      {c.notifyDay && (
                        <div className="compromiso-notify">
                          <Icon name={notifPermission === 'granted' ? 'Bell' : 'BellOff'} size={11} />
                          Recordatorio el día {c.notifyDay} de cada mes{notifPermission !== 'granted' ? ' (activa notificaciones en Ajustes)' : ''}
                        </div>
                      )}
                      <button className="abonar-btn" disabled={c.pendiente <= 0.01} onClick={() => openAbonar(c)}>{c.pendiente <= 0.01 ? 'Recibido este mes' : 'Marcar recibido'}</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>

      <button className="fab" onClick={fabAction}><Icon name="Plus" size={26} /></button>

      <div className="bottom-nav">
        <button className={`nav-btn ${tab === 'resumen' ? 'active' : ''}`} style={tab === 'resumen' ? { color: TAB_COLORS.resumen, background: `${TAB_COLORS.resumen}1A` } : undefined} onClick={() => setTab('resumen')}><Icon name="LayoutGrid" size={17} />Resumen</button>
        <button className={`nav-btn ${tab === 'movimientos' ? 'active' : ''}`} style={tab === 'movimientos' ? { color: TAB_COLORS.movimientos, background: `${TAB_COLORS.movimientos}1A` } : undefined} onClick={() => setTab('movimientos')}><Icon name="List" size={17} />Movs.</button>
        <button className={`nav-btn ${tab === 'compromisos' ? 'active' : ''}`} style={tab === 'compromisos' ? { color: TAB_COLORS.compromisos, background: `${TAB_COLORS.compromisos}1A` } : undefined} onClick={() => setTab('compromisos')}><Icon name="CreditCard" size={17} />CxP</button>
        <button className={`nav-btn ${tab === 'ahorro' ? 'active' : ''}`} style={tab === 'ahorro' ? { color: TAB_COLORS.ahorro, background: `${TAB_COLORS.ahorro}1A` } : undefined} onClick={() => setTab('ahorro')}><Icon name="PiggyBank" size={17} />Ahorro</button>
        <button className={`nav-btn ${tab === 'graficas' ? 'active' : ''}`} style={tab === 'graficas' ? { color: TAB_COLORS.graficas, background: `${TAB_COLORS.graficas}1A` } : undefined} onClick={() => setTab('graficas')}><Icon name="BarChart3" size={17} />Gráf.</button>
      </div>

      {sheet?.type === 'add-tx' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">Nuevo movimiento</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div className="type-toggle">
              <button className={txForm.type === 'ingreso' ? 'active ingreso' : ''} onClick={() => setTxForm((f) => ({ ...f, type: 'ingreso', category: '', shared: false }))}><Icon name="ArrowUpRight" size={14} /> Ingreso</button>
              <button className={txForm.type === 'gasto' ? 'active gasto' : ''} onClick={() => setTxForm((f) => ({ ...f, type: 'gasto', category: '' }))}><Icon name="ArrowDownRight" size={14} /> Gasto</button>
            </div>
            <div className="field-label">Monto</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={txForm.amount} onChange={(e) => setTxForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-label">Categoría</div>
            <div className="cat-grid">
              {catOptions.map((c) => { return (
                <div key={c.id} className={`cat-choice ${txForm.category === c.id ? 'selected' : ''}`} onClick={() => setTxForm((f) => ({ ...f, category: c.id, subcategory: '' }))}>
                  <div className="cat-choice-icon" style={{ background: c.color }}><Icon name={c.icon} size={15} /></div><span className="cat-choice-label">{c.label}</span>
                </div>
              ); })}
            </div>
            {txForm.type === 'gasto' && txForm.category && (() => {
              const subAccounts = getSubAccountsForCategory(txForm.category);
              if (!subAccounts.length) return null;
              const isDeudaCat = txForm.category === 'deudas';
              const selected = subAccounts.find((c) => c.id === txForm.subcategory) || null;
              const enteredAmt = toNumber(txForm.amount);
              let feedback = null;
              if (selected && enteredAmt > 0) {
                const restante = selected.pendiente - enteredAmt;
                if (restante <= 0.005) {
                  feedback = { ok: true, text: isDeudaCat ? 'Con este abono, la deuda queda liquidada.' : 'Con este pago, esta cuenta queda al día este mes.' };
                } else {
                  feedback = { ok: false, text: isDeudaCat ? `Después de este abono, quedarán pendientes ${fmt(restante)}.` : `Aún faltan ${fmt(restante)} para completar el pago de este mes.` };
                }
              }
              return (
                <>
                  <div className="field-label">{isDeudaCat ? '¿A cuál deuda corresponde? (opcional)' : '¿A cuál cuenta corresponde? (opcional)'}</div>
                  <div className="subcat-row">
                    {subAccounts.map((c) => (
                      <button key={c.id} className={`subcat-chip ${txForm.subcategory === c.id ? 'selected' : ''}`} onClick={() => setTxForm((f) => ({ ...f, subcategory: f.subcategory === c.id ? '' : c.id }))}>{c.name}</button>
                    ))}
                  </div>
                  {selected && (
                    <div className="account-info-box">
                      <div className="name">{selected.name}</div>
                      <div className="meta">
                        <span>{isDeudaCat ? `Saldo pendiente: ${fmt(selected.pendiente)}` : `Monto fijo: ${fmt(selected.amount)}`}</span>
                        {!isDeudaCat && selected.notifyDay && <span>Día de pago: {selected.notifyDay}</span>}
                      </div>
                    </div>
                  )}
                  {feedback && (
                    <div className={`account-feedback ${feedback.ok ? 'ok' : 'pending'}`}>
                      <Icon name={feedback.ok ? 'CheckCircle2' : 'Bell'} size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} /> {feedback.text}
                    </div>
                  )}
                </>
              );
            })()}
            {!txForm.subcategory && (
              <div className="toggle-row">
                <span className="toggle-row-label"><Icon name="Repeat" size={14} /> ¿Es un {txForm.type === 'gasto' ? 'gasto' : 'ingreso'} fijo nuevo (recurrente)?</span>
                <button className={`switch ${txForm.fijo ? 'on' : ''}`} onClick={() => setTxForm((f) => ({ ...f, fijo: !f.fijo, fijoTarget: 'new' }))} />
              </div>
            )}
            {txForm.fijo && !txForm.subcategory && (
              <>
                <div className="field-label">Nombre del {txForm.type === 'gasto' ? 'gasto' : 'ingreso'} fijo</div>
                <input className="text-input" placeholder={txForm.type === 'gasto' ? 'Ej. Renta, Internet...' : 'Ej. Nómina, comisiones...'} value={txForm.fijoName} onChange={(e) => setTxForm((f) => ({ ...f, fijoName: e.target.value }))} />
                <div className="field-label">Monto total {txForm.type === 'gasto' ? 'del gasto' : 'del ingreso'} fijo (mensual)</div>
                <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" style={{ fontSize: 22 }} type="text" inputMode="decimal" placeholder={txForm.amount || '0.00'} value={txForm.fijoAmount} onChange={(e) => setTxForm((f) => ({ ...f, fijoAmount: formatAmountTyping(e.target.value) }))} /></div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: -8, marginBottom: 12 }}>Déjalo en blanco si el monto de arriba ya cubre el total mensual.</div>
                <div className="field-label">Recordarme cada mes el día (opcional)</div>
                <input className="text-input" type="text" inputMode="numeric" placeholder="Ej. 5" value={txForm.fijoNotifyDay} onChange={(e) => setTxForm((f) => ({ ...f, fijoNotifyDay: e.target.value.replace(/[^\d]/g, '').slice(0, 2) }))} />
                {(() => {
                  const paidAmt = toNumber(txForm.amount);
                  const totalAmt = txForm.fijoAmount ? toNumber(txForm.fijoAmount) : paidAmt;
                  let feedback = null;
                  if (totalAmt > 0 && paidAmt > 0) {
                    const restante = totalAmt - paidAmt;
                    feedback = restante <= 0.005
                      ? { ok: true, text: `Con este pago, ${txForm.type === 'gasto' ? 'esta cuenta queda al día' : 'este ingreso queda registrado completo'} este mes.` }
                      : { ok: false, text: `Aún faltan ${fmt(restante)} para completar el ${txForm.type === 'gasto' ? 'pago' : 'ingreso'} de este mes.` };
                  }
                  return (
                    <>
                      <div className="account-info-box">
                        <div className="name">{txForm.fijoName.trim() || `Nombre del ${txForm.type === 'gasto' ? 'gasto' : 'ingreso'} fijo`}</div>
                        <div className="meta">
                          <span>Monto total: {fmt(totalAmt)}</span>
                          <span>Día de pago: {txForm.fijoNotifyDay || 'sin definir'}</span>
                        </div>
                      </div>
                      {feedback && (
                        <div className={`account-feedback ${feedback.ok ? 'ok' : 'pending'}`}>
                          <Icon name={feedback.ok ? 'CheckCircle2' : 'Bell'} size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} /> {feedback.text}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
            <div className="field-label">Nota (opcional)</div>
            <input className="text-input" type="text" placeholder="Ej. Netflix, gasolina..." value={txForm.note} onChange={(e) => setTxForm((f) => ({ ...f, note: e.target.value }))} />
            <div className="field-label">Fecha</div>
            <input className="text-input" type="date" value={txForm.date} onChange={(e) => setTxForm((f) => ({ ...f, date: e.target.value }))} />

            {txForm.type === 'gasto' && (
              <>
                <div className="toggle-row">
                  <span className="toggle-row-label"><Icon name="Users" size={14} /> ¿Es un gasto compartido?</span>
                  <button className={`switch ${txForm.shared ? 'on' : ''}`} onClick={() => setTxForm((f) => ({ ...f, shared: !f.shared }))} />
                </div>

                {txForm.shared && (
                  <div style={{ marginTop: 12 }}>
                    {txForm.participants.map((p) => (
                      <div className="participant-row" key={p.id}>
                        <input className="text-input" placeholder="Nombre" value={p.name} onChange={(e) => updateParticipant(p.id, { name: e.target.value })} />
                        <input className="text-input amount-mini" type="text" inputMode="decimal" placeholder="$0" value={p.amount} onChange={(e) => updateParticipant(p.id, { amount: formatAmountTyping(e.target.value) })} />
                        <button className="remove-participant" onClick={() => removeParticipant(p.id)}><Icon name="X" size={15} /></button>
                      </div>
                    ))}
                    <button className="add-participant-btn" onClick={addParticipant}><Icon name="UserPlus" size={14} /> Agregar persona</button>
                    <div className="my-share-line">Tu parte: {fmt(myShare)}</div>
                  </div>
                )}
              </>
            )}
            {txError && <div className="form-error">{txError}</div>}
            <button className="save-btn" onClick={submitTx}><Icon name="Check" size={16} /> Guardar movimiento</button>
          </div>
        </div>
      )}

      {sheet?.type === 'edit-tx' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">Editar movimiento</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div className="type-toggle">
              <button className={editTxForm.type === 'ingreso' ? 'active ingreso' : ''} disabled style={{ opacity: editTxForm.type === 'ingreso' ? 1 : 0.45, cursor: 'default' }}><Icon name="ArrowUpRight" size={14} /> Ingreso</button>
              <button className={editTxForm.type === 'gasto' ? 'active gasto' : ''} disabled style={{ opacity: editTxForm.type === 'gasto' ? 1 : 0.45, cursor: 'default' }}><Icon name="ArrowDownRight" size={14} /> Gasto</button>
            </div>
            <div className="field-label">Monto</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={editTxForm.amount} onChange={(e) => setEditTxForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-label">Categoría</div>
            <div className="cat-grid">
              {editCatOptions.map((c) => { return (
                <div key={c.id} className={`cat-choice ${editTxForm.category === c.id ? 'selected' : ''}`} onClick={() => setEditTxForm((f) => ({ ...f, category: c.id, subcategory: '' }))}>
                  <div className="cat-choice-icon" style={{ background: c.color }}><Icon name={c.icon} size={15} /></div><span className="cat-choice-label">{c.label}</span>
                </div>
              ); })}
            </div>
            {(() => {
              const origTx = transactions.find((t) => t.id === editTxForm.id);
              if (origTx?.compromisoId) {
                return (
                  <div className="account-info-box">
                    <div className="meta"><Icon name="Landmark" size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Vinculado a: {subcatLabel(origTx.compromisoId)}</div>
                  </div>
                );
              }
              const subAccounts = getSubAccountsForCategory(editTxForm.category);
              if (!subAccounts.length) return null;
              return (
                <>
                  <div className="field-label">{editTxForm.category === 'deudas' ? '¿A cuál deuda corresponde? (opcional)' : '¿A cuál cuenta corresponde? (opcional)'}</div>
                  <div className="subcat-row">
                    {subAccounts.map((c) => (
                      <button key={c.id} className={`subcat-chip ${editTxForm.subcategory === c.id ? 'selected' : ''}`} onClick={() => setEditTxForm((f) => ({ ...f, subcategory: f.subcategory === c.id ? '' : c.id }))}>{c.name}</button>
                    ))}
                  </div>
                </>
              );
            })()}
            <div className="field-label">Nota (opcional)</div>
            <input className="text-input" type="text" placeholder="Ej. Netflix, gasolina..." value={editTxForm.note} onChange={(e) => setEditTxForm((f) => ({ ...f, note: e.target.value }))} />
            <div className="field-label">Fecha</div>
            <input className="text-input" type="date" value={editTxForm.date} onChange={(e) => setEditTxForm((f) => ({ ...f, date: e.target.value }))} />
            {editTxError && <div className="form-error">{editTxError}</div>}
            <button className="save-btn" onClick={submitEditTx}><Icon name="Check" size={16} /> Actualizar movimiento</button>
            <button className="danger-btn" onClick={deleteTxFromEdit}><Icon name="Trash2" size={14} /> Eliminar movimiento</button>
          </div>
        </div>
      )}

      {sheet?.type === 'new-compromiso' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">{compForm.kind === 'deuda' ? 'Nueva cuenta por pagar (CxP)' : compForm.kind === 'ingreso_fijo' ? 'Nuevo ingreso fijo' : 'Nuevo gasto fijo'}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div className="type-toggle">
              <button className={compForm.kind === 'deuda' ? 'active deuda' : ''} onClick={() => setCompForm((f) => ({ ...f, kind: 'deuda', category: 'deudas' }))}><Icon name="Landmark" size={14} /> Deuda</button>
              <button className={compForm.kind === 'fijo' ? 'active fijo' : ''} onClick={() => setCompForm((f) => ({ ...f, kind: 'fijo', category: '' }))}><Icon name="Repeat" size={14} /> Gasto fijo</button>
              <button className={compForm.kind === 'ingreso_fijo' ? 'active ingreso' : ''} onClick={() => setCompForm((f) => ({ ...f, kind: 'ingreso_fijo', category: '' }))}><Icon name="ArrowUpRight" size={14} /> Ingreso fijo</button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
              {compForm.kind === 'deuda'
                ? 'Registra préstamos, tarjetas o cuentas por pagar. Podrás abonar después desde la pestaña Deudas.'
                : 'Esto solo da de alta el compromiso; todavía no se crea ningún movimiento. Cuando hagas el pago (o lo recibas), regístralo desde el botón + o con "Abonar" aquí mismo.'}
            </div>
            <div className="field-label">Nombre</div>
            <input className="text-input" placeholder={compForm.kind === 'deuda' ? 'Ej. Préstamo bancario' : compForm.kind === 'ingreso_fijo' ? 'Ej. Nómina, comisiones...' : 'Ej. Renta, Internet...'} value={compForm.name} onChange={(e) => setCompForm((f) => ({ ...f, name: e.target.value }))} />
            <div className="field-label">{compForm.kind === 'deuda' ? 'Monto total de la deuda' : 'Monto mensual'}</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={compForm.amount} onChange={(e) => setCompForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} /></div>
            {compForm.kind === 'deuda' && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 6 }}>
                Si es de un banco (Nu, Bodega Aurrera, etc.) que sube el saldo por intereses, no te preocupes por eso ahora: cada mes podrás actualizar el monto pendiente directo desde la tarjeta de la deuda con el estado de cuenta que te manden.
              </div>
            )}
            <div className="field-label">Categoría</div>
            <div className="cat-grid">
              {(compForm.kind === 'ingreso_fijo' ? INGRESO_CATS : GASTO_CATS).map((c) => { return (
                <div key={c.id} className={`cat-choice ${compForm.category === c.id ? 'selected' : ''}`} onClick={() => setCompForm((f) => ({ ...f, category: c.id }))}>
                  <div className="cat-choice-icon" style={{ background: c.color }}><Icon name={c.icon} size={15} /></div><span className="cat-choice-label">{c.label}</span>
                </div>
              ); })}
            </div>
            {compForm.kind === 'fijo' && (
              <>
                <div className="toggle-row">
                  <span className="toggle-row-label"><Icon name="Users" size={14} /> ¿Es un gasto compartido?</span>
                  <button className={`switch ${compForm.shared ? 'on' : ''}`} onClick={() => setCompForm((f) => ({ ...f, shared: !f.shared }))} />
                </div>
                {compForm.shared && (
                  <div style={{ marginTop: 12 }}>
                    {compForm.participants.map((p) => (
                      <div className="participant-row" key={p.id}>
                        <input className="text-input" placeholder="Nombre" value={p.name} onChange={(e) => updateCompParticipant(p.id, { name: e.target.value })} />
                        <input className="text-input amount-mini" type="text" inputMode="decimal" placeholder="$0" value={p.amount} onChange={(e) => updateCompParticipant(p.id, { amount: formatAmountTyping(e.target.value) })} />
                        <button className="remove-participant" onClick={() => removeCompParticipant(p.id)}><Icon name="X" size={15} /></button>
                      </div>
                    ))}
                    <button className="add-participant-btn" onClick={addCompParticipant}><Icon name="UserPlus" size={14} /> Agregar persona</button>
                    <div className="my-share-line">Tu parte mensual: {fmt(compMyShare)}</div>
                  </div>
                )}
              </>
            )}
            {(compForm.kind === 'fijo' || compForm.kind === 'ingreso_fijo') && (
              <>
                <div className="field-label">{compForm.kind === 'ingreso_fijo' ? 'Recordarme cada mes el día que debería llegar (opcional)' : 'Recordarme cada mes el día (opcional)'}</div>
                <input
                  className="text-input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="31"
                  placeholder="Ej. 5"
                  value={compForm.notifyDay}
                  onChange={(e) => setCompForm((f) => ({ ...f, notifyDay: e.target.value }))}
                />
                {notifPermission !== 'granted' && (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 6 }}>
                    Para recibir el aviso, activa las notificaciones en Ajustes primero.
                  </div>
                )}
              </>
            )}
            {compError && <div className="form-error">{compError}</div>}
            <button className="save-btn" onClick={submitCompromiso}><Icon name="Check" size={16} /> {compForm.kind === 'deuda' ? 'Crear deuda' : compForm.kind === 'ingreso_fijo' ? 'Crear ingreso fijo' : 'Crear gasto fijo'}</button>
          </div>
        </div>
      )}

      {sheet?.type === 'abonar' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">{sheet.compromiso.kind === 'ingreso_fijo' ? 'Ingreso recibido' : 'Abonar'} · {sheet.compromiso.name}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div className="field-label">{sheet.compromiso.kind === 'ingreso_fijo' ? 'Monto recibido' : 'Monto a abonar'}</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" value={abonoForm.amount} onChange={(e) => setAbonoForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-label">Fecha</div>
            <input className="text-input" type="date" value={abonoForm.date} onChange={(e) => setAbonoForm((f) => ({ ...f, date: e.target.value }))} />
            <div className="field-label">Nota (opcional)</div>
            <input className="text-input" placeholder={sheet.compromiso.kind === 'ingreso_fijo' ? 'Ej. Nómina de julio' : 'Ej. Pago parcial de mayo'} value={abonoForm.note} onChange={(e) => setAbonoForm((f) => ({ ...f, note: e.target.value }))} />
            {abonoError && <div className="form-error">{abonoError}</div>}
            <button className="save-btn" onClick={submitAbono}><Icon name="Check" size={16} /> {sheet.compromiso.kind === 'ingreso_fijo' ? 'Registrar ingreso' : 'Registrar abono'}</button>
          </div>
        </div>
      )}

      {sheet?.type === 'edit-amount' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">Actualizar monto · {sheet.compromiso.name}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 4 }}>
              Saldo actual: {fmt(sheet.compromiso.pendiente)}. Escribe el nuevo monto que te mandó el banco (por ejemplo, con el interés de este mes ya incluido).
            </div>
            <div className="field-label">Nuevo monto pendiente</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" value={editAmountForm.amount} onChange={(e) => setEditAmountForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-label">Nota (opcional)</div>
            <input className="text-input" placeholder="Ej. Interés de julio, estado de cuenta Nu" value={editAmountForm.note} onChange={(e) => setEditAmountForm((f) => ({ ...f, note: e.target.value }))} />
            {editAmountError && <div className="form-error">{editAmountError}</div>}
            <button className="save-btn" onClick={submitEditAmount}><Icon name="Check" size={16} /> Guardar nuevo monto</button>
          </div>
        </div>
      )}

      {sheet?.type === 'new-savings' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">Nueva cuenta de ahorro</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div className="field-label">Nombre</div>
            <input className="text-input" placeholder="Ej. Fondo de emergencia" value={savForm.name} onChange={(e) => setSavForm((f) => ({ ...f, name: e.target.value }))} />
            <div className="field-label">Meta (opcional)</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={savForm.target} onChange={(e) => setSavForm((f) => ({ ...f, target: formatAmountTyping(e.target.value) }))} /></div>
            {savError && <div className="form-error">{savError}</div>}
            <button className="save-btn" onClick={submitSavings}><Icon name="Check" size={16} /> Crear cuenta</button>
          </div>
        </div>
      )}

      {sheet?.type === 'savings-move' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">{sheet.account.name}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div className="type-toggle">
              <button className={moveForm.kind === 'deposito' ? 'active deposito' : ''} onClick={() => setMoveForm((f) => ({ ...f, kind: 'deposito' }))}>Depositar</button>
              <button className={moveForm.kind === 'retiro' ? 'active retiro' : ''} onClick={() => setMoveForm((f) => ({ ...f, kind: 'retiro' }))}>Retirar</button>
            </div>
            <div className="field-label">Monto</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" value={moveForm.amount} onChange={(e) => setMoveForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-label">Fecha</div>
            <input className="text-input" type="date" value={moveForm.date} onChange={(e) => setMoveForm((f) => ({ ...f, date: e.target.value }))} />
            {moveError && <div className="form-error">{moveError}</div>}
            <button className="save-btn" onClick={submitMove}><Icon name="Check" size={16} /> Confirmar</button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="settings-panel" onClick={() => setSettingsOpen(false)}>
          <div className="settings-card" onClick={(e) => e.stopPropagation()}>
            <div className="close-row"><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSettingsOpen(false)}><Icon name="X" size={16} /></button></div>
            {familyNameEdit ? (
              <div className="participant-row" style={{ marginBottom: 12 }}>
                <input
                  className="text-input"
                  style={{ padding: '6px 10px', fontSize: 13, fontWeight: 700 }}
                  placeholder="Nombre de la familia"
                  value={familyNameEditInput}
                  onChange={(e) => setFamilyNameEditInput(e.target.value)}
                  autoFocus
                />
                <button className="icon-btn" style={{ background: 'var(--green)' }} onClick={() => renameFamily(familyNameEditInput)}><Icon name="Check" size={14} /></button>
                <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setFamilyNameEdit(false)}><Icon name="X" size={14} /></button>
              </div>
            ) : (
              <div className="card-title">
                <span>{familyName || 'Familia'}</span>
                <button
                  className="icon-btn"
                  style={{ background: 'var(--paper-dim)', color: 'var(--ink)', width: 26, height: 26 }}
                  title="Editar nombre de la familia"
                  onClick={() => { setFamilyNameEditInput(familyName || ''); setFamilyNameEdit(true); }}
                >
                  <Icon name="Pencil" size={12} />
                </button>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--paper-dim)', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-soft)' }}>Código de familia</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700 }}>{familyCode}</div>
              </div>
              <button className="icon-btn" style={{ background: '#25D366' }} title="Compartir por WhatsApp" onClick={shareInvite}><Icon name="Share2" size={14} /></button>
            </div>
            {familia.map((m) => (
              <div className="family-row" key={m}>
                <div className="mini-avatar" style={{ background: colorForName(m) }}>{m.charAt(0).toUpperCase()}</div>
                {profile?.name === m && nicknameEdit ? (
                  <>
                    <input
                      className="text-input"
                      style={{ padding: '6px 10px', fontSize: 13 }}
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      autoFocus
                    />
                    <button className="icon-btn" style={{ background: 'var(--green)' }} onClick={() => renameProfile(nicknameInput)}><Icon name="Check" size={14} /></button>
                    <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setNicknameEdit(false)}><Icon name="X" size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="family-row-name">{m}</span>
                    {profile?.name === m && <span className="you-badge">Tú</span>}
                    {profile?.name === m && (
                      <button
                        className="icon-btn"
                        style={{ background: 'var(--paper-dim)', color: 'var(--ink)', marginLeft: 'auto' }}
                        title="Editar apodo"
                        onClick={() => { setNicknameInput(m); setNicknameError(''); setNicknameEdit(true); }}
                      >
                        <Icon name="Pencil" size={13} />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
            {nicknameError && <div className="form-error">{nicknameError}</div>}
            <div className="participant-row" style={{ marginTop: 10 }}>
              <input className="text-input" placeholder="Nombre de un integrante" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
              <button className="add-participant-btn" style={{ width: 'auto', marginTop: 0 }} onClick={() => addFamilyMember(newMemberName, false)}><Icon name="UserPlus" size={14} /></button>
            </div>
            {memberError && <div className="form-error">{memberError}</div>}
            <button className="danger-btn neutral" onClick={() => { setSettingsOpen(false); setOnboarding(true); }}>
              <Icon name="LogOut" size={14} /> Cambiar de persona
            </button>

            {notifPermission !== 'unsupported' && (
              <>
                <button
                  className={`bell-toggle-btn ${notifPermission === 'granted' ? 'on' : ''}`}
                  onClick={requestNotifPermission}
                  disabled={notifPermission === 'denied'}
                >
                  <Icon name={notifPermission === 'granted' ? 'Bell' : 'BellOff'} size={14} />
                  {notifPermission === 'granted' ? 'Notificaciones activadas' : notifPermission === 'denied' ? 'Notificaciones bloqueadas por el celular' : 'Activar notificaciones de gastos fijos'}
                </button>
                {notifPermission === 'denied' && (
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 6 }}>
                    Las bloqueaste antes. Actívalas desde los ajustes del navegador o del celular para esta app.
                  </div>
                )}
              </>
            )}

            <div className="card-title" style={{ marginTop: 20 }}>Datos</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {transactions.length} movimiento{transactions.length !== 1 ? 's' : ''} · {compromisos.length} compromiso{compromisos.length !== 1 ? 's' : ''} · {savings.length} cuenta{savings.length !== 1 ? 's' : ''} de ahorro. Visibles para toda la familia.
              {saving && <span className="saving-dot"> · guardando…</span>}
            </div>
            {lastSync && (
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="RefreshCw" size={11} /> Sincronizado {new Date(lastSync).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                <button onClick={loadShared} style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 600, cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}>actualizar</button>
              </div>
            )}
            <button className="danger-btn" onClick={() => { if (window.confirm('¿Borrar todo el historial (movimientos, compromisos y ahorros)? Esta acción no se puede deshacer.')) clearAll(); }}>
              <Icon name="Trash2" size={14} /> Borrar todo el historial
            </button>
          </div>
        </div>
      )}
      {onboarding && !familyCode && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <div className="sheet-header"><span className="sheet-title">Código de familia</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
              Este código conecta tu libro con el de tu pareja: ambos deben usar exactamente el mismo. La primera persona lo crea, la segunda lo escribe igual.
            </div>
            <div className="field-label">Escribe el código (si ya existe uno)</div>
            <div className="participant-row">
              <input className="text-input" placeholder="Ej. a3f9k2m8x1" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} autoCapitalize="none" autoCorrect="off" />
              <button className="add-participant-btn" style={{ width: 'auto', marginTop: 0 }} onClick={() => activateFamilyCode(codeInput)}><Icon name="Check" size={14} /></button>
            </div>
            {codeError && <div className="form-error">{codeError}</div>}
            <div style={{ textAlign: 'center', margin: '14px 0', fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 1 }}>o</div>
            <button className="save-btn" onClick={() => { const c = generateCode(); setCodeInput(c); activateFamilyCode(c); }}>
              <Icon name="RefreshCw" size={16} /> Generar código nuevo
            </button>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 10 }}>
              Al generar uno nuevo, podrás compartirlo por WhatsApp con el resto de la familia desde el botón de compartir en Ajustes.
            </div>
          </div>
        </div>
      )}
      {onboarding && familyCode && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <div className="sheet-header"><span className="sheet-title">¿Quién eres tú?</span>{profile && <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setOnboarding(false)}><Icon name="X" size={16} /></button>}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>Este libro es compartido: todo lo que registres lo verá el resto de la familia, y viceversa.</div>
            {familia.length > 0 && (
              <>
                <div className="field-label">Elige tu nombre</div>
                {familia.map((m) => (
                  <div key={m} className="cat-choice" style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 10, padding: '10px 12px', marginBottom: 8, width: '100%', boxSizing: 'border-box' }} onClick={() => chooseProfile(m)}>
                    <div className="mini-avatar" style={{ background: colorForName(m) }}>{m.charAt(0).toUpperCase()}</div>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m}</span>
                  </div>
                ))}
              </>
            )}
            {familia.length === 0 && (
              <>
                <div className="field-label">Nombre de la familia (opcional)</div>
                <input className="text-input" placeholder="Ej. Familia Torres" value={familyNameInput} onChange={(e) => setFamilyNameInput(e.target.value)} />
              </>
            )}
            <div className="field-label">Responsabilidad</div>
            <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {ROLES.map((r) => (
                <div key={r.id} className={`cat-choice ${newMemberRole === r.id ? 'selected' : ''}`} onClick={() => setNewMemberRole(r.id)}>
                  <div className="cat-choice-icon" style={{ background: 'var(--green)' }}><Icon name="Users" size={15} /></div>
                  <span className="cat-choice-label">{r.label}</span>
                </div>
              ))}
            </div>
            <div className="field-label">Agrega tu nombre</div>
            <div className="participant-row">
              <input className="text-input" placeholder="Ej. Henry" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
            </div>
            {memberError && <div className="form-error">{memberError}</div>}
            <button className="save-btn" onClick={submitNewMember}>
              <Icon name="Check" size={16} /> {familia.length === 0 ? 'Crear Familia' : 'Entrar al libro'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LibroDiario />);
