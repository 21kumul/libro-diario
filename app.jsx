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
  tarjetas: '#2F6B8A',
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
  { id: 'banco', label: 'Banco', icon: 'Landmark', color: '#3E6EA5' },
  { id: 'deudas', label: 'Préstamos', icon: 'CreditCard', color: '#7A4E3A' },
  { id: 'otros_gas', label: 'Otros', icon: 'MoreHorizontal', color: '#9C8672' },
];

// Categorías exclusivas para las cuentas de CxP (gastos fijos, ingresos fijos
// y préstamos): a partir de esta actualización, dar de alta una cuenta en CxP
// solo permite clasificarla en una de estas 3 (el resto de categorías de
// Gastos/Ingresos normales no aplican aquí).
const CXP_CATS = GASTO_CATS.filter((c) => ['banco', 'deudas', 'otros_gas'].includes(c.id));
// Solo estas categorías de CxP permiten editar el monto/saldo a mano
// (ej. actualizar lo que dice el estado de cuenta del banco).
const CXP_EDITABLE_CATS = ['banco', 'deudas', 'cobranza'];

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

// ---------- Catálogo de cuentas contables ----------
// Cada concepto (categoría) que ya se usa para capturar movimientos se liga
// aquí a una cuenta contable, agrupada como se acomodaría en un Estado de
// Resultado clásico: 4xxx Ingresos, 5xxx Costos y gastos de operación,
// 6xxx Gastos financieros. Esto no cambia cómo se capturan los movimientos
// (siguen usando su categoría de siempre); solo agrega la etiqueta contable
// para poder agrupar y reportar por cuenta.
const CUENTA_CONTABLE = {
  // Ingresos
  servicio: { codigo: '4100', nombre: 'Ventas / servicios', grupo: 'ingresos' },
  nomina: { codigo: '4200', nombre: 'Sueldos y salarios percibidos', grupo: 'ingresos' },
  cobranza: { codigo: '4300', nombre: 'Cobranza de cuentas por cobrar', grupo: 'ingresos' },
  comision: { codigo: '4400', nombre: 'Comisiones ganadas', grupo: 'ingresos' },
  otros_ing: { codigo: '4900', nombre: 'Otros ingresos', grupo: 'ingresos' },
  // Gastos de operación
  renta: { codigo: '5100', nombre: 'Renta / arrendamiento', grupo: 'gastos' },
  servicios: { codigo: '5200', nombre: 'Servicios (luz, agua, internet, etc.)', grupo: 'gastos' },
  transporte: { codigo: '5300', nombre: 'Transporte', grupo: 'gastos' },
  comida: { codigo: '5400', nombre: 'Alimentos y comida fuera de casa', grupo: 'gastos' },
  despensa: { codigo: '5500', nombre: 'Despensa / consumibles del hogar', grupo: 'gastos' },
  otros_gas: { codigo: '5900', nombre: 'Otros gastos de operación', grupo: 'gastos' },
  // Gastos financieros
  banco: { codigo: '6100', nombre: 'Comisiones y gastos bancarios', grupo: 'gastos' },
  deudas: { codigo: '6200', nombre: 'Intereses y pago de préstamos', grupo: 'gastos' },
};
const cuentaOf = (catId) => CUENTA_CONTABLE[catId] || { codigo: '4900', nombre: catById(catId).label, grupo: INGRESO_CATS.some((c) => c.id === catId) ? 'ingresos' : 'gastos' };
const GRUPO_LABEL = { ingresos: 'Ingresos', gastos: 'Costos y gastos' };
// El ahorro no es un ingreso ni un gasto: es dinero que se mueve de una cuenta
// de activo (banco/efectivo) a otra cuenta de activo (ahorro), así que no
// entra a las cuentas de arriba y no afecta la utilidad neta. Se registra
// como cuenta de Activo, aparte, para poder mostrarla como referencia.
const CUENTA_AHORRO = { codigo: '1200', nombre: 'Ahorros e inversiones', grupo: 'activo' };
// 'deuda' (dinero que debo, Cuenta por Pagar) y 'cxc' (dinero que me deben,
// Cuenta por Cobrar) se llevan igual: tienen un monto original y un saldo
// pendiente que baja con cada pago/cobro. Solo cambia el sentido del dinero
// (deuda -> pagar = gasto; cxc -> cobrar = ingreso).
const isBalanceKind = (kind) => kind === 'deuda' || kind === 'cxc';

// ---------- Catálogo completo (para la vista "Catálogo de cuentas") ----------
// Las cuentas de Activo/Pasivo no vienen de CUENTA_CONTABLE (esas son solo
// ingresos/gastos): se arman aquí a mano, alineadas a cómo ya se usan en la
// app (ubicaciones de dinero, ahorro, CxP y CxC).
const CATALOGO_ACTIVO_PASIVO = [
  { codigo: '1101', nombre: 'Caja (efectivo)', grupo: '1000 Activo · 1100 Activo circulante', nota: 'Tus ubicaciones de tipo Efectivo, en "¿Dónde está el dinero?"' },
  { codigo: '1102', nombre: 'Bancos', grupo: '1000 Activo · 1100 Activo circulante', nota: 'Tus ubicaciones de tipo Tarjeta/Banco, en "¿Dónde está el dinero?"' },
  { codigo: '1103', nombre: 'Clientes / Cuentas por cobrar (CxC)', grupo: '1000 Activo · 1100 Activo circulante', nota: 'Dinero que te deben — pestaña Cuentas, sección "Me deben (CxC)"' },
  { codigo: CUENTA_AHORRO.codigo, nombre: CUENTA_AHORRO.nombre, grupo: '1000 Activo · 1200 Activo fijo', nota: 'Tus metas y cuentas de ahorro, en la pestaña Ahorro' },
  { codigo: '2101', nombre: 'Préstamos y cuentas por pagar (CxP)', grupo: '2000 Pasivo · 2100 Pasivo circulante', nota: 'Dinero que debes — pestaña Cuentas, sección "Préstamos"' },
];
// Ingresos/gastos: se toman directo de CUENTA_CONTABLE (sin repetir código),
// para que el catálogo siempre esté sincronizado con lo que ya se usa.
const CATALOGO_RESULTADO = Object.values(CUENTA_CONTABLE)
  .filter((v, i, arr) => arr.findIndex((x) => x.codigo === v.codigo) === i)
  .map((v) => ({
    ...v,
    grupo: v.codigo[0] === '4' ? '4000 Cuentas de ingreso' : v.codigo[0] === '6' ? '6300 Gastos financieros' : '5000/6000 Gastos de operación',
  }))
  .sort((a, b) => a.codigo.localeCompare(b.codigo));
const CATALOGO_COMPLETO = [...CATALOGO_ACTIVO_PASIVO, ...CATALOGO_RESULTADO].sort((a, b) => a.codigo.localeCompare(b.codigo));

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
// Formatea dígitos de un número de tarjeta en bloques de 4 mientras se escribe,
// solo para mostrarlo legible (el valor guardado en estado son puros dígitos).
const formatCardNumberTyping = (digits) => (digits || '').replace(/(.{4})/g, '$1 ').trim();

// Conciliación manual: el usuario pega líneas copiadas de su banco. Formato
// recomendado "AAAA-MM-DD | monto | concepto", pero también intenta leer
// líneas sueltas con una fecha AAAA-MM-DD y un monto en cualquier parte.
const parseConciliaLine = (line) => {
  const raw = line.trim();
  if (!raw) return null;
  const parts = raw.split('|').map((p) => p.trim());
  if (parts.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
    const amount = toNumber(parts[1].replace(/[^0-9.\-]/g, ''));
    return { raw, date: parts[0], amount, concepto: parts.slice(2).join(' ').trim() || '(sin concepto)', invalid: isNaN(amount) };
  }
  const dateMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
  const amountMatches = raw.match(/-?\$?\s?\d[\d,]*\.?\d{0,2}/g);
  if (!dateMatch || !amountMatches || !amountMatches.length) return { raw, date: null, amount: null, concepto: raw, invalid: true };
  const lastTok = amountMatches[amountMatches.length - 1];
  let amount = toNumber(lastTok.replace(/[^0-9.\-]/g, ''));
  if (lastTok.trim().startsWith('-')) amount = -Math.abs(amount);
  const concepto = raw.replace(dateMatch[0], '').replace(lastTok, '').replace(/[|·]/g, ' ').replace(/\s+/g, ' ').trim();
  return { raw, date: dateMatch[0], amount, concepto: concepto || '(sin concepto)', invalid: isNaN(amount) };
};

const fmt = (n) => {
  return (n < 0 ? '-' : '') + Math.abs(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Días que faltan para la próxima vez que ocurra ese día del mes (corte/pago
// de una tarjeta de crédito). Si ya pasó este mes, calcula el del siguiente.
const diasHasta = (dia) => {
  if (!dia) return null;
  const hoy = new Date();
  const y = hoy.getFullYear(), m = hoy.getMonth(), d = hoy.getDate();
  let target = new Date(y, m, dia);
  if (target < new Date(y, m, d)) target = new Date(y, m + 1, dia);
  return Math.round((target - new Date(y, m, d)) / 86400000);
};
const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return h; };
// Degradados inspirados en tarjetas bancarias reales, para diferenciar cada
// tarjeta a simple vista sin depender de logos de bancos.
const CARD_GRADIENTS = [
  'linear-gradient(135deg, #6b7a4f, #8a9765)',
  'linear-gradient(135deg, #1f4e9c, #2f6fd6)',
  'linear-gradient(135deg, #1a1a1e, #3a3a42)',
  'linear-gradient(135deg, #7a2f3d, #a8455a)',
  'linear-gradient(135deg, #2f6b5e, #3f9484)',
  'linear-gradient(135deg, #5a3d8a, #7c5cb8)',
];
// Estilos inspirados en el diseño real de bancos/fintechs mexicanos más
// comunes. Se detectan automáticamente por el nombre que el usuario le puso
// a su tarjeta (ej. "Banamex", "BBVA", "Nu"), sin necesidad de conectarse a
// ningún banco: es una captura manual de los datos de tu tarjeta.
const BANK_STYLES = [
  { match: /banamex|citibanamex/i, name: 'Banamex', gradient: 'linear-gradient(135deg, #7a0f1e, #b21e2f)', network: 'Mastercard' },
  { match: /bbva|bancomer/i, name: 'BBVA', gradient: 'linear-gradient(135deg, #072146, #1464F4)', network: 'Visa' },
  { match: /santander/i, name: 'Santander', gradient: 'linear-gradient(135deg, #8c0a0a, #ec0000)', network: 'Visa' },
  { match: /banorte/i, name: 'Banorte', gradient: 'linear-gradient(135deg, #7a1f1f, #d61f26)', network: 'Mastercard' },
  { match: /hsbc/i, name: 'HSBC', gradient: 'linear-gradient(135deg, #4d0000, #DB0011)', network: 'Visa' },
  { match: /nubank|\bnu\b/i, name: 'Nu', gradient: 'linear-gradient(135deg, #6b2f9c, #9c5cd6)', network: 'Mastercard' },
  { match: /azteca/i, name: 'Banco Azteca', gradient: 'linear-gradient(135deg, #1f5c1f, #2e8b2e)', network: 'Mastercard' },
  { match: /inbursa/i, name: 'Inbursa', gradient: 'linear-gradient(135deg, #7a5210, #c98a1f)', network: 'Visa' },
  { match: /scotiabank|scotia/i, name: 'Scotiabank', gradient: 'linear-gradient(135deg, #7a0000, #d21f1f)', network: 'Visa' },
  { match: /fondeadora/i, name: 'Fondeadora', gradient: 'linear-gradient(135deg, #0a0a0a, #2a2a2a)', network: 'Mastercard' },
  { match: /didi/i, name: 'Didi', gradient: 'linear-gradient(135deg, #0a0a0a, #ff6d00)', network: 'Visa' },
  { match: /mercado ?pago/i, name: 'Mercado Pago', gradient: 'linear-gradient(135deg, #0038ff, #00b1ea)', network: 'Mastercard' },
  { match: /klar/i, name: 'Klar', gradient: 'linear-gradient(135deg, #101010, #3d2b8c)', network: 'Mastercard' },
  { match: /spin/i, name: 'Spin by OXXO', gradient: 'linear-gradient(135deg, #d61f26, #ef4136)', network: 'Mastercard' },
];
const getBankStyle = (nombre) => {
  if (!nombre) return null;
  return BANK_STYLES.find((b) => b.match.test(nombre)) || null;
};
// Detección de banco por Clave Interbancaria (CLABE): los primeros 3 dígitos
// son el código de institución asignado por Banxico/ABM. Cubre los bancos y
// fintechs más comunes en México; si no se reconoce el código, simplemente
// no se autocompleta nada (no afecta el registro manual).
const CLABE_BANKS = {
  '002': 'Banamex', '012': 'BBVA', '014': 'Santander', '021': 'HSBC',
  '030': 'BanBajío', '036': 'Inbursa', '042': 'Mifel', '044': 'Scotiabank',
  '058': 'Banregio', '059': 'Invex', '060': 'Bansi', '062': 'Afirme',
  '072': 'Banorte', '103': 'American Express', '127': 'Banco Azteca',
  '130': 'Compartamos', '137': 'BanCoppel', '143': 'CIBanco', '166': 'Banco del Bienestar',
  '646': 'Fintech (STP)', '699': 'Fondeadora',
};
const getBankFromClabe = (clabe) => {
  const digits = (clabe || '').replace(/\D/g, '');
  if (digits.length < 3) return null;
  return CLABE_BANKS[digits.slice(0, 3)] || null;
};
// Detección de red (Visa/Mastercard/Amex) a partir del número de tarjeta.
// Se basa en los rangos de BIN públicos y estandarizados por las propias
// marcas (ISO/IEC 7812), por lo que es 100% determinística y confiable,
// a diferencia de intentar adivinar el banco exacto por los primeros
// dígitos (eso sí varía banco a banco y no está estandarizado).
const detectCardNetwork = (numero) => {
  const digits = (numero || '').replace(/\D/g, '');
  if (digits.length < 2) return null;
  if (digits[0] === '4') return 'Visa';
  const two = parseInt(digits.slice(0, 2), 10);
  const four = parseInt(digits.slice(0, 4), 10);
  if (two >= 51 && two <= 55) return 'Mastercard';
  if (four >= 2221 && four <= 2720) return 'Mastercard';
  if (two === 34 || two === 37) return 'American Express';
  return null;
};
// Iniciales para el "logo" del banco: como no usamos imágenes de marcas
// reales (por derechos de autor/marca), generamos un monograma de 1-2
// letras a partir del nombre, en el color de la tarjeta identificada.
const getInitials = (name) => {
  if (!name) return '';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};
// Clase CSS para colorear el badge de red (Visa/Mastercard/Amex) sin usar
// los logos reales de las marcas.
const networkClass = (net) => {
  if (!net) return '';
  if (/visa/i.test(net)) return 'net-visa';
  if (/mastercard/i.test(net)) return 'net-mastercard';
  if (/amex|american express/i.test(net)) return 'net-amex';
  return '';
};
// Identifica el banco de una ubicación: primero por CLABE (más confiable,
// no depende de cómo el usuario haya escrito el nombre), y si no hay CLABE
// o no se reconoce, cae al nombre que el usuario escribió a mano.
const getBankInfo = (loc) => {
  const byClabe = getBankFromClabe(loc?.clabe);
  if (byClabe) {
    const style = BANK_STYLES.find((b) => b.match.test(byClabe));
    if (style) return style;
    return { name: byClabe, gradient: null, network: null };
  }
  return getBankStyle(loc?.nombre);
};
// Color/degradado final de una tarjeta: usa el diseño real del banco si se
// reconoce el nombre; si no, cae al degradado genérico asignado por id.
const cardBg = (loc) => (loc.tipo === 'tarjeta' ? (getBankInfo(loc)?.gradient || CARD_GRADIENTS[hashStr(loc.id) % CARD_GRADIENTS.length]) : '#5F8A4C');
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
  // "¿Dónde está el dinero?": saldos de efectivo/tarjeta por persona, visibles
  // en Resumen. Se capturan a mano y se suman solos cuando registras un
  // ingreso y eliges a cuál de estas ubicaciones cayó.
  const [moneyLocations, setMoneyLocations] = useState([]);
  const moneyLocationsByPerson = useMemo(() => {
    const map = {};
    moneyLocations.forEach((l) => { (map[l.persona] = map[l.persona] || []).push(l); });
    return Object.entries(map);
  }, [moneyLocations]);
  const moneyLocationsTotal = moneyLocations.reduce((s, l) => s + (l.monto || 0), 0);
  const [familia, setFamilia] = useState([]);
  const [familyName, setFamilyName] = useState('');
  const [familyNameInput, setFamilyNameInput] = useState('');
  const [profile, setProfile] = useState(null);
  const [familyCode, setFamilyCode] = useState(null);
  const [codeInput, setCodeInput] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('codigo') || '';
    } catch (e) { return ''; }
  });
  // Pantalla de bienvenida en 3 pasos: 'choose' (¿tienes código o generas uno?),
  // 'enter' (escribirlo), 'created' (mostrar el que se acaba de generar).
  // Si llegó por un enlace de invitación con ?codigo=, se salta directo a 'enter'.
  const [codeStep, setCodeStep] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('codigo') ? 'enter' : 'choose';
    } catch (e) { return 'choose'; }
  });
  const [codeError, setCodeError] = useState('');
  const [onboarding, setOnboarding] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const [memberError, setMemberError] = useState('');
  const [filterAutor, setFilterAutor] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [conciliaRaw, setConciliaRaw] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('resumen');
  const [period, setPeriod] = useState('mes');
  const [sheet, setSheet] = useState(null); // {type, ...}
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSavingFlag] = useState(false);
  const [filterCat, setFilterCat] = useState('todas');

  const [txForm, setTxForm] = useState({ type: 'gasto', amount: '', category: '', subcategory: '', note: '', date: todayStr(), shared: false, participants: [], fijo: false, fijoTarget: 'new', fijoName: '', fijoNotifyDay: '', fijoAmount: '', locationId: '', links: [], linkAmounts: {}, linkParticipants: {} });
  const [txError, setTxError] = useState('');

  const [editTxForm, setEditTxForm] = useState({ id: null, type: 'gasto', amount: '', category: '', subcategory: '', note: '', date: todayStr(), locationId: '' });
  const [editTxError, setEditTxError] = useState('');

  const [compForm, setCompForm] = useState({ kind: 'deuda', name: '', category: 'deudas', amount: '', notifyDay: '', shared: false, participants: [], locationId: '' });
  const [msiForm, setMsiForm] = useState({ name: '', amount: '', months: '12' });
  const [notifPermission, setNotifPermission] = useState(
    (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'unsupported'
  );
  const [compError, setCompError] = useState('');

  const [editAmountForm, setEditAmountForm] = useState({ amount: '', note: '' });
  const [editAmountError, setEditAmountError] = useState('');

  const [abonoForm, setAbonoForm] = useState({ amount: '', date: todayStr(), note: '', locationId: '' });
  const [abonoError, setAbonoError] = useState('');

  const [savForm, setSavForm] = useState({ name: '', target: '' });
  const [savError, setSavError] = useState('');

  const [moveForm, setMoveForm] = useState({ kind: 'deposito', amount: '', date: todayStr(), note: '', persona: '', locationId: '', origen: '' });
  const [moveError, setMoveError] = useState('');

  const [lastSync, setLastSync] = useState(null);

  // Trae lo último guardado por cualquier integrante de la familia (datos compartidos)
  const loadShared = useCallback(async () => {
    try {
      const [t, c, s, f, fn, ml] = await Promise.allSettled([
        window.storage.get('transactions', true),
        window.storage.get('compromisos', true),
        window.storage.get('savings', true),
        window.storage.get('familia', true),
        window.storage.get('familyName', true),
        window.storage.get('moneyLocations', true),
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
      setMoneyLocations(ml.status === 'fulfilled' && ml.value ? JSON.parse(ml.value.value) : []);
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
    if (patch.moneyLocations) setMoneyLocations(patch.moneyLocations);
    if (patch.familia) setFamilia(patch.familia);
    if (patch.familyName !== undefined) setFamilyName(patch.familyName);
    try {
      const jobs = [];
      if (patch.transactions) jobs.push(window.storage.set('transactions', JSON.stringify(patch.transactions), true));
      if (patch.compromisos) jobs.push(window.storage.set('compromisos', JSON.stringify(patch.compromisos), true));
      if (patch.savings) jobs.push(window.storage.set('savings', JSON.stringify(patch.savings), true));
      if (patch.moneyLocations) jobs.push(window.storage.set('moneyLocations', JSON.stringify(patch.moneyLocations), true));
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
    filtered.forEach((t) => {
      if (t.type === 'ingreso') ingresos += t.amount;
      else if (t.type === 'gasto') gastos += t.amount;
      // 'traspaso' no es ingreso ni gasto: es dinero que se mueve entre tus propias cuentas.
    });
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
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const cat = t.type === 'traspaso' ? 'traspaso' : catById(t.category).label.toLowerCase();
        const haystack = [t.note, cat, String(t.amount)].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }
    list.slice().sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
      .forEach((t) => { (groups[t.date] = groups[t.date] || []).push(t); });
    return Object.entries(groups);
  }, [filtered, filterCat, filterAutor, searchQuery]);

  const conciliacionRows = useMemo(() => {
    return conciliaRaw.split('\n').map(parseConciliaLine).filter(Boolean).map((row) => {
      if (row.invalid) return { ...row, matched: false };
      const type = row.amount < 0 ? 'gasto' : 'ingreso';
      const match = transactions.find((t) => t.type === type && t.date === row.date && Math.abs(Math.abs(t.amount) - Math.abs(row.amount)) < 0.01);
      return { ...row, matched: !!match };
    });
  }, [conciliaRaw, transactions]);

  const openAddTxFromConcilia = (row) => {
    const type = row.amount < 0 ? 'gasto' : 'ingreso';
    setTxForm({ type, amount: formatAmountTyping(String(Math.abs(row.amount))), category: '', subcategory: '', note: row.concepto || '', date: row.date, shared: false, participants: [], fijo: false, fijoTarget: 'new', fijoName: '', fijoNotifyDay: '', fijoAmount: '', locationId: '', links: [], linkAmounts: {}, linkParticipants: {} });
    setSheet({ type: 'add-tx' });
  };

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

  // Estado de Resultado: los mismos movimientos del periodo, pero agrupados
  // por cuenta contable (vía CUENTA_CONTABLE) en vez de por categoría suelta,
  // como se vería en un estado de resultados real.
  const estadoResultado = useMemo(() => {
    const map = {}; // codigo -> { codigo, nombre, grupo, value }
    filtered.forEach((t) => {
      if (t.type === 'traspaso') return; // mueve dinero entre cuentas propias, no es ingreso ni gasto
      const cuenta = cuentaOf(t.category);
      const signed = t.type === 'ingreso' ? t.amount : t.amount; // se separan por grupo, no se resta aquí
      const key = cuenta.codigo;
      if (!map[key]) map[key] = { codigo: cuenta.codigo, nombre: cuenta.nombre, grupo: cuenta.grupo, value: 0 };
      map[key].value += signed;
    });
    const rows = Object.values(map).sort((a, b) => a.codigo.localeCompare(b.codigo));
    const ingresos = rows.filter((r) => r.grupo === 'ingresos');
    const gastos = rows.filter((r) => r.grupo === 'gastos');
    const totalIngresos = ingresos.reduce((s, r) => s + r.value, 0);
    const totalGastos = gastos.reduce((s, r) => s + r.value, 0);
    return { ingresos, gastos, totalIngresos, totalGastos, utilidad: totalIngresos - totalGastos };
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
    if (isBalanceKind(c.kind)) {
      const pagado = c.payments.reduce((s, p) => s + p.amount, 0);
      const pendiente = Math.max(0, c.balance != null ? c.balance : c.amount - pagado);
      const pct = c.amount ? Math.max(0, Math.min(100, (1 - pendiente / c.amount) * 100)) : 0;
      const lastAdjustment = c.adjustments && c.adjustments.length ? c.adjustments[c.adjustments.length - 1] : null;
      return { ...c, pagado, pendiente, pct, liquidada: pendiente <= 0.01, lastAdjustment };
    }
    const pagadoMes = c.payments.filter((p) => p.period === currentPeriodKey).reduce((s, p) => s + p.amount, 0);
    const baseAmount = c.balance != null ? c.balance : c.amount;
    const pendiente = Math.max(0, baseAmount - pagadoMes);
    return { ...c, pagado: pagadoMes, pendiente, pct: baseAmount ? Math.min(100, (pagadoMes / baseAmount) * 100) : 0, liquidada: false };
  }), [compromisos]);

  const deudas = compromisosView.filter((c) => c.kind === 'deuda');
  const cxc = compromisosView.filter((c) => c.kind === 'cxc');
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
  const getSubAccountsForCategory = (type, category) => {
    if (!category) return [];
    if (type === 'ingreso') return [...ingresosFijos, ...cxc].filter((c) => c.category === category && !c.liquidada);
    if (category === 'deudas') return deudas.filter((c) => !c.liquidada && c.category === category);
    return fijos.filter((c) => c.category === category);
  };

  // Gráfica de CxP · Préstamos: agrupa los préstamos pendientes por su categoría (Banco / Préstamos / Otros).
  const prestamosPorCategoria = useMemo(() => {
    const map = {};
    compromisosView.filter((c) => c.kind === 'deuda' && c.pendiente > 0.01).forEach((c) => {
      map[c.category] = (map[c.category] || 0) + c.pendiente;
    });
    return Object.entries(map).map(([id, value]) => ({ id, name: catById(id).label, value, color: catById(id).color }))
      .sort((a, b) => b.value - a.value);
  }, [compromisosView]);

  // Gráfica de CxP · Gastos fijos: cada concepto capturado (Renta, Internet...) es su propia rebanada.
  // Se agrupa por nombre (por si hay dos cuentas con el mismo nombre) y NO se
  // recorta la lista, para que el total de la gráfica siempre coincida con la
  // suma real que se ve en la pestaña Cuentas.
  const ITEM_COLORS = ['#1E3D32', '#B0432E', '#C29B3E', '#3E6EA5', '#8A4FA0', '#5A8F3C', '#A85338', '#4E8A93', '#7A4E3A', '#8C6239'];
  const gastosFijosPorConcepto = useMemo(() => {
    const map = {};
    compromisosView.filter((c) => c.kind === 'fijo' && c.pendiente > 0.01).forEach((c) => {
      map[c.name] = (map[c.name] || 0) + c.pendiente;
    });
    return Object.entries(map)
      .map(([name, value], i) => ({ id: name, name, value, color: ITEM_COLORS[i % ITEM_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [compromisosView]);

  // Gráfica de "¿Dónde está el dinero?": total por persona.
  const moneyPorPersona = useMemo(
    () => moneyLocationsByPerson
      .map(([persona, locs]) => ({ id: persona, name: persona, value: locs.reduce((s, l) => s + (l.monto || 0), 0), color: colorForName(persona) }))
      .filter((p) => p.value > 0.01)
      .sort((a, b) => b.value - a.value),
    [moneyLocationsByPerson]
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
    setTxForm({ type, amount: '', category: '', subcategory: '', note: '', date: todayStr(), shared: false, participants: [], fijo: false, fijoTarget: 'new', fijoName: '', fijoNotifyDay: '', fijoAmount: '', locationId: '', links: [], linkAmounts: {}, linkParticipants: {} });
    setTxError('');
    setSheet({ type: 'add-tx' });
  };

  // Un ingreso SUMA a la ubicación elegida (ahí "cayó" el dinero); un gasto
  // RESTA (de ahí "salió" el dinero).
  const locationDelta = (type, amt) => (type === 'ingreso' ? amt : -amt);

  // Selecciona/quita una cuenta de CxP a la que corresponde este movimiento.
  // - Cuenta NO compartida: selección única (un monto simple); elegir otra la reemplaza.
  // - Cuenta COMPARTIDA: se pueden elegir varias a la vez, y cada una muestra a
  //   sus participantes con el monto que le toca a cada quien (editable).
  const toggleTxLink = (c, pool) => {
    setTxForm((f) => {
      if (f.links.includes(c.id)) {
        const links = f.links.filter((id) => id !== c.id);
        const linkAmounts = { ...f.linkAmounts };
        delete linkAmounts[c.id];
        const linkParticipants = { ...f.linkParticipants };
        delete linkParticipants[c.id];
        return { ...f, links, linkAmounts, linkParticipants };
      }
      if (c.shared) {
        // Se combina solo con otras cuentas COMPARTIDAS ya elegidas; si había una cuenta individual, se reemplaza.
        const keepIds = f.links.filter((id) => { const x = pool.find((p) => p.id === id); return x && x.shared; });
        const linkAmounts = {};
        const linkParticipants = {};
        keepIds.forEach((id) => { linkParticipants[id] = f.linkParticipants[id]; });
        // Empieza sin nadie seleccionado: eliges a quién(es) corresponde este pago.
        return { ...f, links: [...keepIds, c.id], linkAmounts, linkParticipants: { ...linkParticipants, [c.id]: {} } };
      }
      // Cuenta individual (no compartida): selección única, reemplaza cualquier otra.
      const amt = c.pendiente || c.amount;
      return { ...f, links: [c.id], linkAmounts: { [c.id]: amt ? String(amt) : '' }, linkParticipants: {} };
    });
  };

  // Dentro de una cuenta compartida ya elegida, marca/desmarca a una persona
  // como parte de este pago (permite que una o varias personas —o quien
  // patrocina— queden incluidas en un mismo movimiento).
  const toggleParticipantLink = (accountId, p) => {
    setTxForm((f) => {
      const current = { ...(f.linkParticipants[accountId] || {}) };
      if (Object.prototype.hasOwnProperty.call(current, p.name)) {
        delete current[p.name];
      } else {
        current[p.name] = p.amount ? String(p.amount) : '';
      }
      return { ...f, linkParticipants: { ...f.linkParticipants, [accountId]: current } };
    });
  };

  const submitTx = () => {
    const amt = toNumber(txForm.amount);
    if (!amt || amt <= 0) return setTxError('Ingresa un monto válido.');
    if (!txForm.category) return setTxError('Elige una categoría.');
    if (!txForm.locationId) return setTxError(txForm.type === 'ingreso' ? 'Elige a dónde entra este dinero.' : 'Elige de dónde sale este dinero.');
    if (!txForm.note.trim()) return setTxError('Escribe una nota.');
    if (!txForm.date) return setTxError('Elige una fecha.');
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
    let compromisoIds = null;
    let paymentIds = null;
    let nextCompromisos = compromisos;

    // Cuentas de CxP elegidas para este movimiento (una o varias), con el
    // monto que le corresponde a cada una. Si la cuenta es compartida, se
    // arma a partir de lo que se capturó por persona.
    const pool = txForm.type === 'ingreso' ? [...ingresosFijos, ...cxc] : (txForm.category === 'deudas' ? deudas : fijos);
    const links = (txForm.links || [])
      .map((id) => {
        const c = pool.find((x) => x.id === id);
        if (!c) return null;
        if (c.shared) {
          const participants = Object.entries(txForm.linkParticipants[id] || {})
            .map(([name, v]) => ({ name, amount: toNumber(v) }))
            .filter((p) => p.amount > 0);
          const total = participants.reduce((s, p) => s + p.amount, 0);
          return total > 0 ? { c, amt: total, participants } : null;
        }
        const linkAmt = toNumber(txForm.linkAmounts[id]);
        return linkAmt > 0 ? { c, amt: linkAmt, participants: null } : null;
      })
      .filter(Boolean);
    const linkedTotal = links.reduce((s, e) => s + e.amt, 0);
    if (links.length && linkedTotal > amt + 0.01) return setTxError('La suma de los montos vinculados no puede ser mayor al total del movimiento.');

    if (links.length === 1) {
      const { c, amt: linkAmt, participants } = links[0];
      paymentId = uid();
      const payment = { id: paymentId, amount: linkAmt, date: txForm.date, period: periodKey(txForm.date), note: '', autor: profile?.name || 'Familia', participants: participants || undefined };
      compromisoId = c.id;
      nextCompromisos = compromisos.map((x) => {
        if (x.id !== compromisoId) return x;
        if (isBalanceKind(x.kind)) {
          const currentBalance = x.balance != null ? x.balance : x.amount;
          return { ...x, payments: [...x.payments, payment], balance: Math.max(0, currentBalance - linkAmt) };
        }
        return { ...x, payments: [...x.payments, payment] };
      });
    } else if (links.length > 1) {
      paymentIds = {};
      nextCompromisos = compromisos.map((x) => {
        const entry = links.find((e) => e.c.id === x.id);
        if (!entry) return x;
        const pid = uid();
        paymentIds[x.id] = pid;
        const payment = { id: pid, amount: entry.amt, date: txForm.date, period: periodKey(txForm.date), note: '', autor: profile?.name || 'Familia', participants: entry.participants || undefined };
        if (isBalanceKind(x.kind)) {
          const currentBalance = x.balance != null ? x.balance : x.amount;
          return { ...x, payments: [...x.payments, payment], balance: Math.max(0, currentBalance - entry.amt) };
        }
        return { ...x, payments: [...x.payments, payment] };
      });
      compromisoIds = links.map((e) => e.c.id);
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

    const locationId = txForm.locationId || null;
    const next = [...transactions, { id: uid(), type: txForm.type, amount: amt, category: txForm.category, subcategory: links.length === 1 ? links[0].c.id : null, note: txForm.note.trim(), date: txForm.date, shared, compromisoId, paymentId, compromisoIds, paymentIds, locationId, autor: profile?.name || 'Familia' }];
    const patch = { transactions: next, compromisos: nextCompromisos };
    if (locationId) {
      patch.moneyLocations = moneyLocations.map((l) => l.id === locationId ? { ...l, monto: (l.monto || 0) + locationDelta(txForm.type, amt) } : l);
    }
    persist(patch);
    setSheet(null);
  };

  const deleteTx = (id) => {
    if (!window.confirm('¿Eliminar este movimiento? No se puede deshacer.')) return;
    const orig = transactions.find((t) => t.id === id);
    const patch = { transactions: transactions.filter((t) => t.id !== id) };
    if (orig?.locationId) {
      patch.moneyLocations = moneyLocations.map((l) => l.id === orig.locationId ? { ...l, monto: (l.monto || 0) - locationDelta(orig.type, orig.amount) } : l);
    }
    persist(patch);
  };

  // ---------- traspasos entre cuentas propias (ej. Banco -> Efectivo) ----------
  const openTraspaso = (prefill) => {
    setTraspasoForm({ fromId: '', toId: '', amount: '', note: '', date: todayStr(), ...prefill });
    setTraspasoError('');
    setSheet({ type: 'traspaso' });
  };

  const openWalletDetail = (loc) => setSheet({ type: 'wallet-detail', location: loc });
  const openWalletMenu = () => setSheet({ type: 'wallet-menu' });

  const submitTraspaso = () => {
    const amt = toNumber(traspasoForm.amount);
    if (!amt || amt <= 0) return setTraspasoError('Ingresa un monto válido.');
    if (!traspasoForm.fromId) return setTraspasoError('Elige de dónde sale el dinero.');
    if (!traspasoForm.toId) return setTraspasoError('Elige a dónde entra el dinero.');
    if (traspasoForm.fromId === traspasoForm.toId) return setTraspasoError('Elige dos ubicaciones distintas.');
    if (!traspasoForm.date) return setTraspasoError('Elige una fecha.');
    const from = moneyLocations.find((l) => l.id === traspasoForm.fromId);
    const to = moneyLocations.find((l) => l.id === traspasoForm.toId);
    if (!from || !to) return setTraspasoError('Esa ubicación ya no existe.');
    const tx = {
      id: uid(), type: 'traspaso', amount: amt,
      fromLocationId: from.id, toLocationId: to.id,
      note: traspasoForm.note.trim(), date: traspasoForm.date,
      autor: profile?.name || 'Familia',
    };
    const nextLocations = moneyLocations.map((l) => {
      if (l.id === from.id) return { ...l, monto: (l.monto || 0) - amt };
      if (l.id === to.id) return { ...l, monto: (l.monto || 0) + amt };
      return l;
    });
    persist({ transactions: [...transactions, tx], moneyLocations: nextLocations });
    setSheet(null);
  };

  const deleteTraspaso = (id) => {
    if (!window.confirm('¿Eliminar este traspaso? Se revertirá el monto en ambas cuentas. No se puede deshacer.')) return;
    const orig = transactions.find((t) => t.id === id);
    if (!orig) return;
    const nextLocations = moneyLocations.map((l) => {
      if (l.id === orig.fromLocationId) return { ...l, monto: (l.monto || 0) + orig.amount };
      if (l.id === orig.toLocationId) return { ...l, monto: (l.monto || 0) - orig.amount };
      return l;
    });
    persist({ transactions: transactions.filter((t) => t.id !== id), moneyLocations: nextLocations });
  };
  // Nombre corto de una ubicación para mostrar en el detalle del traspaso.
  const locationLabel = (id) => {
    if (typeof id === 'string' && id.startsWith('compromiso:')) {
      const [, kind, compId] = id.split(':');
      const c = compromisos.find((x) => x.id === compId);
      if (!c) return kind === 'deuda' ? 'Préstamo eliminado' : 'Cuenta por cobrar eliminada';
      return kind === 'deuda' ? `Préstamo · ${c.name}` : `CxC · ${c.name}`;
    }
    const l = moneyLocations.find((x) => x.id === id);
    if (!l) return 'Cuenta eliminada';
    return `${l.persona} · ${l.tipo === 'tarjeta' ? (l.nombre || 'Banco') : 'Monedero'}`;
  };

  const openEditTx = (t) => {
    setEditTxForm({ id: t.id, type: t.type, amount: formatAmountTyping(String(t.amount)), category: t.category, subcategory: t.subcategory || '', note: t.note || '', date: t.date, locationId: t.locationId || '' });
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
    if (!editTxForm.locationId) return setEditTxError(editTxForm.type === 'ingreso' ? 'Elige a dónde entra este dinero.' : 'Elige de dónde sale este dinero.');
    if (!editTxForm.note.trim()) return setEditTxError('Escribe una nota.');
    if (!editTxForm.date) return setEditTxError('Elige una fecha.');
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
          if (isBalanceKind(x.kind)) {
            const currentBalance = x.balance != null ? x.balance : x.amount;
            return { ...x, payments: nextPayments, balance: Math.max(0, currentBalance - delta) };
          }
          return { ...x, payments: nextPayments };
        });
      }
    }
    const nextLocationId = editTxForm.locationId || null;
    const next = transactions.map((t) => t.id === editTxForm.id ? {
      ...t,
      amount: amt,
      category: editTxForm.category,
      subcategory: editTxForm.subcategory || null,
      note: editTxForm.note.trim(),
      date: editTxForm.date,
      paymentId: syncedPaymentId,
      locationId: nextLocationId,
    } : t);
    const patch = { transactions: next, compromisos: nextCompromisos };
    // Revierte la ubicación anterior (si tenía) y aplica la nueva (si eligió una), por si cambió el monto, el tipo o la ubicación.
    if (orig?.locationId || nextLocationId) {
      let nextLocations = moneyLocations;
      if (orig?.locationId) nextLocations = nextLocations.map((l) => l.id === orig.locationId ? { ...l, monto: (l.monto || 0) - locationDelta(orig.type, orig.amount) } : l);
      if (nextLocationId) nextLocations = nextLocations.map((l) => l.id === nextLocationId ? { ...l, monto: (l.monto || 0) + locationDelta(editTxForm.type, amt) } : l);
      patch.moneyLocations = nextLocations;
    }
    persist(patch);
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
          if (isBalanceKind(x.kind)) {
            const currentBalance = x.balance != null ? x.balance : x.amount;
            return { ...x, payments: nextPayments, balance: Math.max(0, currentBalance + linkedPayment.amount) };
          }
          return { ...x, payments: nextPayments };
        });
      }
    } else if (orig?.compromisoIds?.length) {
      // Movimiento "pago junto": revierte el abono correspondiente en cada gasto/ingreso fijo vinculado.
      nextCompromisos = compromisos.map((x) => {
        const paymentId = orig.paymentIds && orig.paymentIds[x.id];
        if (!paymentId) return x;
        return { ...x, payments: x.payments.filter((p) => p.id !== paymentId) };
      });
    }
    const patch = { transactions: transactions.filter((t) => t.id !== editTxForm.id), compromisos: nextCompromisos };
    if (orig?.locationId) {
      patch.moneyLocations = moneyLocations.map((l) => l.id === orig.locationId ? { ...l, monto: (l.monto || 0) - locationDelta(orig.type, orig.amount) } : l);
    }
    persist(patch);
    setSheet(null);
  };

  const openNewCompromiso = (prefill) => {
    setCompForm({ kind: 'deuda', name: '', category: 'deudas', amount: '', notifyDay: '', shared: false, participants: [], locationId: '', ...prefill });
    setCompError('');
    setSheet({ type: 'new-compromiso' });
  };

  const openMsi = () => {
    setMsiForm({ name: '', amount: '', months: '12' });
    setSheet({ type: 'msi' });
  };

  // Referencia legible para el detalle de un traspaso cuando uno de los lados
  // no es una ubicación de dinero sino un préstamo o una cuenta por cobrar
  // recién dada de alta (ver locationLabel más abajo, que ya sabe leer esto).
  const compromisoRef = (c) => `compromiso:${c.kind}:${c.id}`;

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
    const compromiso = { id: uid(), kind: compForm.kind, name: compForm.name.trim(), category: compForm.category, amount: amt, balance: amt, payments: [], adjustments: [], notifyDay, shared };
    const next = [...compromisos, compromiso];
    const patch = { compromisos: next };
    // Si al dar de alta un préstamo o una cuenta por cobrar se eligió una
    // ubicación de dinero, esto NO es un ingreso ni un gasto: es dinero que
    // entra (préstamo que te dan) o sale (dinero que prestas) de esa cuenta.
    // Igual que un traspaso, se ve reflejado en Movimientos pero no toca la
    // Utilidad neta.
    if (isBalanceKind(compForm.kind) && compForm.locationId) {
      const loc = moneyLocations.find((l) => l.id === compForm.locationId);
      if (loc) {
        const delta = compForm.kind === 'deuda' ? amt : -amt;
        patch.moneyLocations = moneyLocations.map((l) => l.id === loc.id ? { ...l, monto: (l.monto || 0) + delta } : l);
        const tx = {
          id: uid(), type: 'traspaso', amount: amt,
          fromLocationId: compForm.kind === 'deuda' ? compromisoRef(compromiso) : loc.id,
          toLocationId: compForm.kind === 'deuda' ? loc.id : compromisoRef(compromiso),
          note: compForm.kind === 'deuda' ? 'Alta de préstamo' : 'Alta de cuenta por cobrar',
          date: todayStr(), autor: profile?.name || 'Familia',
        };
        patch.transactions = [...transactions, tx];
      }
    }
    persist(patch);
    setSheet(null);
  };

  const addCompParticipant = () => setCompForm((f) => ({ ...f, participants: [...f.participants, { id: uid(), name: '', amount: '' }] }));
  const updateCompParticipant = (id, patch) => setCompForm((f) => ({ ...f, participants: f.participants.map((p) => p.id === id ? { ...p, ...patch } : p) }));
  const removeCompParticipant = (id) => setCompForm((f) => ({ ...f, participants: f.participants.filter((p) => p.id !== id) }));
  const compMyShare = compForm.amount ? Math.max(0, toNumber(compForm.amount) - compForm.participants.reduce((s, p) => s + toNumber(p.amount), 0)) : 0;

  const deleteCompromiso = (id) => {
    const c = compromisos.find((x) => x.id === id);
    const label = c?.kind === 'deuda' ? 'este préstamo' : c?.kind === 'cxc' ? 'esta cuenta por cobrar' : c?.kind === 'ingreso_fijo' ? 'este ingreso fijo' : 'este gasto fijo';
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
    setAbonoForm({ amount: compromiso.pendiente > 0 ? String(compromiso.pendiente) : '', date: todayStr(), note: '', locationId: '' });
    setAbonoError('');
    setSheet({ type: 'abonar', compromiso });
  };

  const submitAbono = () => {
    const c = sheet.compromiso;
    const amt = toNumber(abonoForm.amount);
    const isIngreso = c.kind === 'ingreso_fijo' || c.kind === 'cxc';
    if (!amt || amt <= 0) return setAbonoError('Ingresa un monto válido.');
    if (!abonoForm.locationId) return setAbonoError(isIngreso ? 'Elige a dónde entra este dinero.' : 'Elige de dónde sale este dinero.');
    const paymentId = uid();
    const payment = { id: paymentId, amount: amt, date: abonoForm.date, period: periodKey(abonoForm.date), note: abonoForm.note.trim(), autor: profile?.name || 'Familia' };
    const nextCompromisos = compromisos.map((x) => {
      if (x.id !== c.id) return x;
      const nextPayments = [...x.payments, payment];
      if (isBalanceKind(x.kind)) {
        const currentBalance = x.balance != null ? x.balance : x.amount;
        return { ...x, payments: nextPayments, balance: Math.max(0, currentBalance - amt) };
      }
      return { ...x, payments: nextPayments };
    });
    let shared = null;
    if (!isIngreso && c.shared && c.amount) {
      const ratio = amt / c.amount;
      const parts = c.shared.participants.filter((p) => p.amount > 0).map((p) => ({ id: uid(), name: p.name, amount: Math.round(p.amount * ratio * 100) / 100, paid: false }));
      if (parts.length) shared = { participants: parts };
    }
    const notePrefix = c.kind === 'cxc' ? 'Cobro' : (isIngreso ? 'Ingreso' : 'Abono');
    const nextTx = [...transactions, { id: uid(), type: isIngreso ? 'ingreso' : 'gasto', category: c.category, amount: amt, note: `${notePrefix} · ${c.name}${abonoForm.note ? ' — ' + abonoForm.note.trim() : ''}`, date: abonoForm.date, shared, compromisoId: c.id, paymentId, locationId: abonoForm.locationId, autor: profile?.name || 'Familia' }];
    const patch = { compromisos: nextCompromisos, transactions: nextTx };
    patch.moneyLocations = moneyLocations.map((l) => l.id === abonoForm.locationId ? { ...l, monto: (l.monto || 0) + locationDelta(isIngreso ? 'ingreso' : 'gasto', amt) } : l);
    persist(patch);
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
    setMoveForm({ kind, amount: '', date: todayStr(), note: '', persona: profile?.name || '', locationId: '', origen: '' });
    setMoveError('');
    setSheet({ type: 'savings-move', account });
  };

  const submitMove = () => {
    const acc = sheet.account;
    const amt = toNumber(moveForm.amount);
    if (!amt || amt <= 0) return setMoveError('Ingresa un monto válido.');
    if (!moveForm.persona.trim()) return setMoveError('Elige quién tiene el dinero de este movimiento.');
    if (!moveForm.locationId) return setMoveError('Elige en qué cuenta (efectivo o tarjeta) está ese dinero.');
    if (moveForm.kind === 'deposito' && !moveForm.origen) return setMoveError('Elige de qué cuenta se tomó ese dinero.');
    if (moveForm.kind === 'deposito' && moveForm.origen === moveForm.locationId) return setMoveError('La cuenta de origen y la cuenta donde queda el ahorro deben ser distintas.');
    const saved = acc.movements.reduce((s, m) => s + (m.kind === 'deposito' ? m.amount : -m.amount), 0);
    if (moveForm.kind === 'retiro' && amt > saved + 0.01) return setMoveError('No puedes retirar más de lo ahorrado.');
    const move = {
      id: uid(), kind: moveForm.kind, amount: amt, date: moveForm.date, note: moveForm.note.trim(),
      persona: moveForm.persona.trim(), locationId: moveForm.locationId, origenLocationId: moveForm.kind === 'deposito' ? moveForm.origen : null,
      autor: profile?.name || 'Familia',
    };
    const next = savings.map((a) => a.id === acc.id ? { ...a, movements: [...a.movements, move] } : a);
    const patch = { savings: next };
    // Depósito: el dinero sale de la cuenta de origen y entra a la cuenta
    // donde queda guardado el ahorro (dos cuentas reales, como un traspaso).
    // Retiro: el dinero regresa de la "bolsa" de ahorro a la cuenta elegida.
    patch.moneyLocations = moneyLocations.map((l) => {
      if (moveForm.kind === 'deposito') {
        if (l.id === moveForm.locationId) return { ...l, monto: (l.monto || 0) + amt };
        if (l.id === moveForm.origen) return { ...l, monto: (l.monto || 0) - amt };
      } else if (l.id === moveForm.locationId) {
        return { ...l, monto: (l.monto || 0) + amt };
      }
      return l;
    });
    persist(patch);
    setSheet(null);
  };

  const [locForm, setLocForm] = useState({ persona: '', tipo: 'efectivo', nombre: '', monto: '', esCredito: false, limite: '', diaCorte: '', diaPago: '', ultimos4: '', red: '', clabe: '', montoAPagar: '', prestamoId: '' });
  const [locError, setLocError] = useState('');
  // Número de tarjeta capturado solo para auto-detectar red y últimos 4
  // dígitos; nunca se persiste completo (no guardamos el PAN por seguridad).
  const [locCardNumber, setLocCardNumber] = useState('');

  // Traspaso: mover dinero entre dos ubicaciones propias (ej. Banco -> Efectivo).
  // No es un ingreso ni un gasto: una cuenta baja y la otra sube por el mismo monto.
  const [traspasoForm, setTraspasoForm] = useState({ fromId: '', toId: '', amount: '', note: '', date: todayStr() });
  const [traspasoError, setTraspasoError] = useState('');
  const [editLocForm, setEditLocForm] = useState({ monto: '', nombre: '', esCredito: false, limite: '', diaCorte: '', diaPago: '', ultimos4: '', red: '', clabe: '', montoAPagar: '', prestamoId: '' });
  const [editLocError, setEditLocError] = useState('');
  const [editLocCardNumber, setEditLocCardNumber] = useState('');

  const openNewLocation = (personaDefault) => {
    setLocForm({ persona: personaDefault || profile?.name || '', tipo: 'efectivo', nombre: '', monto: '', esCredito: false, limite: '', diaCorte: '', diaPago: '', ultimos4: '', red: '', clabe: '', montoAPagar: '', prestamoId: '' });
    setLocCardNumber('');
    setLocError('');
    setSheet({ type: 'new-location' });
  };

  const submitLocation = () => {
    if (!locForm.persona.trim()) return setLocError('Elige o escribe a quién pertenece.');
    if (locForm.tipo === 'tarjeta' && !locForm.nombre.trim()) return setLocError('Ponle un nombre a la tarjeta o cuenta (ej. Nu, BBVA...).');
    const monto = toNumber(locForm.monto);
    const esCredito = locForm.tipo === 'tarjeta' && locForm.esCredito;
    const next = [...moneyLocations, {
      id: uid(), persona: locForm.persona.trim(), tipo: locForm.tipo,
      nombre: locForm.tipo === 'tarjeta' ? locForm.nombre.trim() : (locForm.nombre.trim() || null),
      monto,
      esCredito,
      limite: esCredito ? toNumber(locForm.limite) || null : null,
      diaCorte: esCredito && locForm.diaCorte ? parseInt(locForm.diaCorte, 10) : null,
      diaPago: esCredito && locForm.diaPago ? parseInt(locForm.diaPago, 10) : null,
      ultimos4: locForm.tipo === 'tarjeta' ? locForm.ultimos4.replace(/\D/g, '').slice(0, 4) || null : null,
      red: locForm.tipo === 'tarjeta' ? (locForm.red || null) : null,
      clabe: locForm.tipo === 'tarjeta' ? (locForm.clabe.replace(/\D/g, '').slice(0, 18) || null) : null,
      montoAPagar: esCredito ? toNumber(locForm.montoAPagar) || null : null,
      prestamoId: esCredito ? (locForm.prestamoId || null) : null,
    }];
    persist({ moneyLocations: next });
    setSheet(null);
  };

  const openEditLocation = (loc) => {
    setEditLocForm({ monto: String(loc.monto), nombre: loc.nombre || '', esCredito: !!loc.esCredito, limite: loc.limite != null ? String(loc.limite) : '', diaCorte: loc.diaCorte != null ? String(loc.diaCorte) : '', diaPago: loc.diaPago != null ? String(loc.diaPago) : '', ultimos4: loc.ultimos4 || '', red: loc.red || '', clabe: loc.clabe || '', montoAPagar: loc.montoAPagar != null ? String(loc.montoAPagar) : '', prestamoId: loc.prestamoId || '' });
    setEditLocCardNumber('');
    setEditLocError('');
    setSheet({ type: 'edit-location', location: loc });
  };

  const submitEditLocation = () => {
    const loc = sheet.location;
    const monto = toNumber(editLocForm.monto);
    if (isNaN(monto)) return setEditLocError('Ingresa un monto válido.');
    const esCredito = loc.tipo === 'tarjeta' && editLocForm.esCredito;
    const next = moneyLocations.map((l) => l.id === loc.id ? {
      ...l, monto, nombre: editLocForm.nombre.trim() || l.nombre,
      esCredito,
      limite: esCredito ? toNumber(editLocForm.limite) || null : null,
      diaCorte: esCredito && editLocForm.diaCorte ? parseInt(editLocForm.diaCorte, 10) : null,
      diaPago: esCredito && editLocForm.diaPago ? parseInt(editLocForm.diaPago, 10) : null,
      ultimos4: loc.tipo === 'tarjeta' ? (editLocForm.ultimos4.replace(/\D/g, '').slice(0, 4) || null) : null,
      red: loc.tipo === 'tarjeta' ? (editLocForm.red || null) : null,
      clabe: loc.tipo === 'tarjeta' ? (editLocForm.clabe.replace(/\D/g, '').slice(0, 18) || null) : null,
      montoAPagar: esCredito ? toNumber(editLocForm.montoAPagar) || null : null,
      prestamoId: esCredito ? (editLocForm.prestamoId || null) : null,
    } : l);
    persist({ moneyLocations: next });
    setSheet(null);
  };

  const deleteLocation = (id) => {
    const loc = moneyLocations.find((l) => l.id === id);
    if (!window.confirm(`¿Eliminar esta ubicación${loc ? ` (${loc.persona} · ${loc.tipo === 'tarjeta' ? loc.nombre : 'Monedero'})` : ''}?`)) return;
    persist({ moneyLocations: moneyLocations.filter((l) => l.id !== id) });
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

  const clearAll = async () => { await persist({ transactions: [], compromisos: [], savings: [], moneyLocations: [] }); setSettingsOpen(false); };

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
    const msg = `*LIBRO DIARIO*\nhttps://21kumul.github.io/libro-diario/?codigo=${familyCode}\n🏦 Únete a mi Libro·Diario${nombre}.`;
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

  // Limpia el ?codigo= del enlace de invitación una vez que ya lo leímos
  // (para no dejarlo pegado en la URL ni que se reenvíe sin querer).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('codigo')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('codigo');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []);

  const fabAction = () => {
    if (tab === 'compromisos') return openNewCompromiso();
    if (tab === 'ahorro') return openNewSavings();
    if (tab === 'tarjetas') return openWalletMenu();
    return openAddTx('gasto');
  };

  return (
    <div className="ledger-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        .ledger-app {
          --paper: #FAFAFA; --paper-dim: #EFEFF2; --ink: #1C1C1E; --ink-soft: #6E6E73;
          --green: #1E3D32; --green-soft: #2C5645; --gold: #C29B3E; --income: #2E7D5B;
          --expense: #B0432E; --line: #E3E3E7; --mono: ui-monospace, 'SF Mono', 'IBM Plex Mono', monospace;
          --sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'IBM Plex Sans', sans-serif;
          --shadow-card: 0 1px 1px rgba(0,0,0,0.03), 0 4px 14px rgba(0,0,0,0.055);
          --shadow-sheet: 0 -4px 30px rgba(0,0,0,0.12);
          font-family: var(--sans); color: var(--ink); background: var(--paper-dim);
          max-width: 460px; margin: 0 auto; height: 100vh; height: 100dvh; display: flex; flex-direction: column;
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
        .card { background: var(--paper); border-radius: 18px; padding: 16px; margin-bottom: 14px; border: none; box-shadow: var(--shadow-card); }
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
        .search-wrap { display: flex; align-items: center; gap: 8px; background: var(--paper-dim); border-radius: 14px; padding: 10px 14px; margin-bottom: 12px; color: var(--ink-soft); }
        .search-input { flex: 1; border: none; background: transparent; outline: none; font-size: 15px; font-family: inherit; color: var(--ink); }
        .search-input::placeholder { color: var(--ink-soft); }
        .search-clear { background: var(--line); border: none; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; color: var(--ink-soft); cursor: pointer; flex-shrink: 0; }
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
        .nav-btn { background: none; border: none; display: flex; flex-direction: column; align-items: center; gap: 3px; color: var(--ink-soft); font-size: 8.5px; font-weight: 600; padding: 6px 6px; border-radius: 12px; cursor: pointer; letter-spacing: 0.2px; text-transform: uppercase; transition: background 0.15s, color 0.15s; }
        .nav-btn.active { font-weight: 700; }
        .fab { position: absolute; right: 18px; bottom: 78px; width: 56px; height: 56px; border-radius: 50%; background: var(--gold); color: var(--green); border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(194,155,62,0.45); cursor: pointer; z-index: 5; }
        .sheet-backdrop, .settings-panel { position: absolute; inset: 0; background: rgba(20,24,20,0.5); display: flex; align-items: flex-end; z-index: 10; padding-top: max(env(safe-area-inset-top, 0px), 14px); box-sizing: border-box; }
        .sheet, .settings-card { background: var(--paper); width: 100%; border-radius: 24px 24px 0 0; padding: 22px 18px calc(18px + env(safe-area-inset-bottom, 0px)) 18px; max-height: min(82dvh, 82vh); overflow-y: auto; box-shadow: var(--shadow-sheet); position: relative; box-sizing: border-box; }
        .sheet::before, .settings-card::before { content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 36px; height: 4px; border-radius: 3px; background: var(--line); }
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
        .cat-choice { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 4px; border-radius: 14px; border: none; background: var(--paper-dim); cursor: pointer; }
        .cat-choice.selected { background: rgba(30,61,50,0.09); box-shadow: inset 0 0 0 1.5px var(--green); }
        .cat-choice-icon { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
        .cat-choice-label { font-size: 10.5px; font-weight: 500; text-align: center; }
        .text-input { width: 100%; border: none; border-radius: 12px; padding: 11px 12px; font-family: var(--sans); font-size: 14px; outline: none; background: var(--paper-dim); box-sizing: border-box; }
        .text-input:focus { border-color: var(--green); }
        .form-error { color: var(--expense); font-size: 12px; margin-top: 10px; font-weight: 500; }
        .save-btn { width: 100%; background: var(--green); color: var(--paper); border: none; border-radius: 999px; padding: 14px; font-weight: 700; font-size: 14px; margin-top: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; letter-spacing: 0.3px; }
        .save-btn:disabled { background: var(--line); color: var(--ink-soft); cursor: not-allowed; }
        .save-btn:active { background: var(--green-soft); }
        .onboard-option { width: 100%; display: flex; align-items: center; gap: 14px; background: var(--paper); border: 1.5px solid var(--line); border-radius: 16px; padding: 16px; margin-bottom: 12px; cursor: pointer; text-align: left; }
        .onboard-option:active { background: var(--paper-dim); }
        .onboard-option-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .onboard-option-text { flex: 1; }
        .onboard-option-title { font-weight: 700; font-size: 14.5px; color: var(--ink); }
        .onboard-option-sub { font-size: 11.5px; color: var(--ink-soft); margin-top: 2px; line-height: 1.4; }
        .onboard-back { background: none; border: none; color: var(--ink-soft); font-size: 13px; font-weight: 600; cursor: pointer; padding: 0; display: flex; align-items: center; gap: 4px; }
        .code-display { text-align: center; background: var(--paper-dim); border: 1.5px dashed var(--line); border-radius: 14px; padding: 22px 12px; margin-bottom: 6px; }
        .code-display-value { font-family: var(--mono); font-size: 24px; font-weight: 700; letter-spacing: 3px; color: var(--ink); word-break: break-all; }
        .danger-btn { width: 100%; background: none; border: 1.5px solid var(--expense); color: var(--expense); border-radius: 999px; padding: 12px; font-weight: 600; font-size: 13px; margin-top: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
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
        .compromiso-card { background: var(--paper); border-radius: 16px; padding: 14px; margin-bottom: 12px; border: none; box-shadow: var(--shadow-card); }
        .wallet-card { border-radius: 20px; padding: 18px; margin-bottom: 14px; color: #fff; cursor: pointer; box-shadow: 0 6px 16px rgba(0,0,0,0.16); box-sizing: border-box; width: 100%; aspect-ratio: 1.6 / 1; min-height: 190px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
        .wallet-card-body { display: flex; flex-direction: column; gap: 0; overflow-y: auto; flex: 1; margin: -2px 0; padding-right: 2px; scrollbar-width: thin; }
        .wallet-card-body::-webkit-scrollbar { width: 3px; }
        .wallet-card-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 3px; }
        .wallet-card-cash {
          background: linear-gradient(135deg, #2f6b45, #468a5c);
          background-image: linear-gradient(135deg, #2f6b45, #468a5c), radial-gradient(circle, rgba(255,255,255,0.07) 1.5px, transparent 1.5px);
          background-size: auto, 14px 14px;
          position: relative; overflow: hidden;
        }
        .wallet-card-cash::after {
          content: '$'; position: absolute; right: 8px; bottom: -18px; font-family: var(--mono); font-size: 96px; font-weight: 700; color: rgba(255,255,255,0.08); line-height: 1; pointer-events: none;
        }
        .wallet-card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
        .wallet-card-name { font-size: 16px; font-weight: 700; }
        .wallet-card-pill { display: inline-block; font-size: 9.5px; font-weight: 700; letter-spacing: 0.5px; background: rgba(255,255,255,0.22); padding: 2px 8px; border-radius: 6px; margin-top: 5px; }
        .wallet-card-amount { font-family: var(--mono); font-size: 19px; font-weight: 700; }
        .wallet-card-caption { font-size: 10.5px; opacity: 0.85; margin-top: 2px; }
        .wallet-card-limitrow { display: flex; justify-content: space-between; font-size: 11.5px; opacity: 0.9; margin-bottom: 6px; }
        .wallet-card-footrow { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-family: var(--mono); font-size: 13px; letter-spacing: 1px; opacity: 0.92; }
        .wallet-card-network { font-family: var(--sans); font-style: italic; font-weight: 700; letter-spacing: 0; text-transform: uppercase; font-size: 12px; opacity: 0.85; padding: 2px 8px; border-radius: 5px; background: rgba(255,255,255,0.18); }
        .wallet-card-network.net-visa { color: #fff; background: rgba(255,255,255,0.16); }
        .wallet-card-network.net-mastercard { color: #FFB020; background: rgba(0,0,0,0.18); }
        .wallet-card-network.net-amex { color: #6FD3FF; background: rgba(0,0,0,0.18); }
        .bank-monogram { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.24); font-size: 9.5px; font-weight: 800; letter-spacing: 0.3px; flex-shrink: 0; margin-top: 1px; }
        .wallet-progress-track { height: 6px; border-radius: 4px; background: rgba(255,255,255,0.25); overflow: hidden; margin-bottom: 10px; }
        .wallet-progress-fill { height: 100%; background: #fff; border-radius: 4px; }
        .wallet-pill-btn { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.18); padding: 6px 10px; border-radius: 20px; }
        .compromiso-card.selectable { cursor: pointer; }
        .compromiso-card.clickable { cursor: pointer; }
        .compromiso-card.clickable:active { background: var(--paper-dim); }
        .compromiso-card.selected { border-color: var(--green); background: #F0F4EF; }
        .multiselect-toggle { display: inline-flex; align-items: center; gap: 6px; background: var(--paper-dim); border: none; color: var(--ink); font-weight: 600; font-size: 12px; cursor: pointer; padding: 8px 14px; border-radius: 999px; }
        .check-circle { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--line); flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .check-circle.on { background: var(--green); border-color: var(--green); }
        .multiselect-bar { display: flex; align-items: center; justify-content: space-between; background: var(--paper-dim); border-radius: 12px; padding: 10px 12px; margin: -2px 0 14px; position: sticky; bottom: 0; }
        .multiselect-count { font-size: 11px; color: var(--ink-soft); font-weight: 600; }
        .multiselect-total { font-family: var(--mono); font-size: 17px; font-weight: 700; color: var(--ink); }
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
        .abonar-btn { width: 100%; background: var(--green); color: var(--paper); border: none; border-radius: 999px; padding: 10px; font-weight: 600; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; }
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
        .er-group-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 6px; }
        .er-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 13px; }
        .er-cuenta { color: var(--ink); }
        .er-codigo { font-family: var(--mono); color: var(--ink-soft); font-size: 11.5px; margin-right: 4px; }
        .er-monto { font-family: var(--mono); font-weight: 600; white-space: nowrap; }
        .er-empty { font-size: 12.5px; color: var(--ink-soft); padding: 2px 0 6px; }
        .er-total-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0 2px; font-size: 13.5px; font-family: var(--mono); }
        .cxp-total-row { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
        .cxp-total-amount { font-family: var(--mono); font-size: 24px; font-weight: 700; color: var(--ink); }
        .cxp-total-label { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
        .totals-subhead { font-size: 10.5px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-soft); font-weight: 700; margin: 10px 0 4px; }
        .totals-subhead:first-child { margin-top: 0; }
        .mini-row:last-child { border-bottom: none; }
        .mini-row-mid { flex: 1; }
        .mini-row-name { font-size: 13px; font-weight: 600; }
        .mini-row-amount { font-family: var(--mono); font-size: 12.5px; color: var(--expense); font-weight: 600; }
        .mini-abonar { background: var(--green); color: var(--paper); border: none; border-radius: 999px; padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
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
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>¿Dónde está el dinero?</span>
                <button className="mini-abonar" onClick={() => setTab('tarjetas')}>Ver detalle</button>
              </div>
              {moneyLocations.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Registra cuánto efectivo o saldo en tarjeta tiene cada quien desde la pestaña Tarjetas.</div>
              ) : (
                <>
                  {moneyLocationsByPerson.map(([persona, locs]) => (
                    <div key={persona} style={{ marginBottom: 6 }}>
                      <div className="totals-subhead">{persona}</div>
                      {locs.map((l) => (
                        <div className="mini-row" key={l.id}>
                          <div className="savings-icon" style={{ width: 28, height: 28, background: l.tipo === 'tarjeta' ? '#3E6EA5' : '#5F8A4C', color: '#fff' }}>
                            <Icon name={l.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={14} />
                          </div>
                          <div className="mini-row-mid">
                            <div className="mini-row-name">{l.tipo === 'tarjeta' ? (l.nombre || 'Tarjeta') : 'Monedero'}</div>
                          </div>
                          <div className="mini-row-amount" style={{ color: 'var(--ink)' }}>{fmt(l.monto)}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="cxp-total-row" style={{ paddingTop: 10, borderTop: '1px dashed var(--line)', marginTop: 4 }}>
                    <div>
                      <div className="cxp-total-amount" style={{ fontSize: 18 }}>{fmt(moneyLocationsTotal)}</div>
                      <div className="cxp-total-label">Total entre efectivo y tarjetas</div>
                    </div>
                  </div>
                </>
              )}
            </div>
            {deudas.some((c) => c.pendiente > 0.01) && (
              <div className="card">
                <div className="card-title">Cuentas por pagar (CxP)</div>
                <div className="cxp-total-row">
                  <div>
                    <div className="cxp-total-amount">{fmt(deudas.reduce((s, c) => s + (c.pendiente > 0.01 ? c.pendiente : 0), 0))}</div>
                    <div className="cxp-total-label">{deudas.filter((c) => c.pendiente > 0.01).length} préstamo{deudas.filter((c) => c.pendiente > 0.01).length !== 1 ? 's' : ''} pendiente{deudas.filter((c) => c.pendiente > 0.01).length !== 1 ? 's' : ''}</div>
                  </div>
                  <button className="mini-abonar" onClick={() => setTab('compromisos')}>Ver detalle</button>
                </div>
              </div>
            )}
            {pendingByPerson.length > 0 && (
              <div className="card">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Por cobrar (gastos compartidos)</span>
                  <button className="mini-abonar" onClick={() => setTab('movimientos')}>Ver en Movimientos</button>
                </div>
                {pendingByPerson.map((p) => (
                  <div className="person-row" key={p.name}>
                    <div className="person-avatar">{p.name.charAt(0).toUpperCase()}</div>
                    <div className="person-mid"><div className="person-name">{p.name}</div><div className="person-count">{p.count} pendiente{p.count !== 1 ? 's' : ''}</div></div>
                    <div className="person-amount">{fmt(p.total)}</div>
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
            <button className="multiselect-toggle" style={{ marginBottom: 10 }} onClick={() => { setConciliaRaw(''); setSheet({ type: 'conciliacion' }); }}>
              <Icon name="ArrowLeftRight" size={12} /> Conciliar con mi banco
            </button>
            <div className="search-wrap">
              <Icon name="Search" size={15} />
              <input
                className="search-input"
                type="text"
                placeholder="Buscar concepto, monto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}><Icon name="X" size={13} /></button>
              )}
            </div>
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
                    if (t.type === 'traspaso') {
                      return (
                        <div className="tx-row" key={t.id} onClick={() => deleteTraspaso(t.id)}>
                          <div className="tx-icon" style={{ background: 'var(--gold)' }}><Icon name="ArrowLeftRight" size={16} /></div>
                          <div className="tx-mid">
                            <div className="tx-cat">Traspaso{t.shared && <span className="shared-badge">COMPARTIDO</span>}</div>
                            <div className="tx-note">{locationLabel(t.fromLocationId)} → {locationLabel(t.toLocationId)}{t.note && ` · ${t.note}`} · <span className="autor-tag" style={{ color: colorForName(t.autor || 'Familia') }}>{t.autor || 'Familia'}</span></div>
                          </div>
                          <div className="tx-amount" style={{ color: 'var(--gold)' }}>{fmt(t.amount)}</div>
                          <span className="tx-edit-hint"><Icon name="Trash2" size={13} /></span>
                        </div>
                      );
                    }
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
            <div className="card-title" style={{ padding: '0 2px' }}>Mis cuentas</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', padding: '0 2px', margin: '-6px 0 10px' }}>
              Da de alta aquí tus préstamos (CxP), lo que te deben (CxC), gastos fijos e ingresos fijos. Usa el botón + para agregar uno nuevo.
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <button className="multiselect-toggle" onClick={openMsi}><Icon name="Calculator" size={12} /> Simular compra a MSI</button>
              <button className="multiselect-toggle" onClick={() => setSheet({ type: 'programados' })}><Icon name="CalendarCheck" size={12} /> Movimientos programados</button>
            </div>
            {deudas.length === 0 && cxc.length === 0 && fijos.length === 0 && ingresosFijos.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 10px' }}>Sin cuentas registradas todavía.</div>
            ) : (
              <>
                {deudas.length > 0 && (
                  <>
                    <div className="totals-subhead">Préstamos</div>
                    {deudas.map((c) => (
                      <div className="compromiso-card" key={c.id}>
                        <div className="compromiso-top">
                          <div className="compromiso-icon" style={{ background: catById(c.category).color }}><Icon name="Landmark" size={16} /></div>
                          <div><div className="compromiso-name">{c.name}</div><div className="compromiso-sub"><span className="kind-badge deuda">Préstamo · CxP</span> · {catById(c.category).label}</div></div>
                          <button className="compromiso-del" onClick={() => deleteCompromiso(c.id)}><Icon name="Trash2" size={14} /></button>
                        </div>
                        <div className="progress-track"><div className="progress-fill" style={{ width: `${c.pct}%`, background: c.liquidada ? 'var(--income)' : 'var(--gold)' }} /></div>
                        <div className="compromiso-nums">
                          <span>Original: {fmt(c.amount)}</span>
                          <span>Abonado: {fmt(c.pagado)}</span>
                          <span className={`pend ${c.liquidada ? 'done' : ''}`}>{c.liquidada ? 'Liquidado' : `Faltan ${fmt(c.pendiente)}`}</span>
                        </div>
                        {c.lastAdjustment && (
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: -4, marginBottom: 10 }}>
                            Último ajuste: {new Date(c.lastAdjustment.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · {fmt(c.lastAdjustment.to)}{c.lastAdjustment.note ? ` — ${c.lastAdjustment.note}` : ''}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="abonar-btn" disabled={c.liquidada} onClick={() => openAbonar(c)} style={{ flex: 1 }}>{c.liquidada ? 'Liquidado ✓' : 'Abonar'}</button>
                          {CXP_EDITABLE_CATS.includes(c.category) && (
                            <button
                              className="abonar-btn"
                              style={{ flex: 1, background: 'var(--paper-dim)', color: 'var(--ink)', border: '1px solid var(--line)' }}
                              onClick={() => openEditAmount(c)}
                              title="Actualiza el saldo con el monto que te mande tu banco"
                            >
                              <Icon name="Pencil" size={12} /> Actualizar monto
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {cxc.length > 0 && (
                  <>
                    <div className="totals-subhead">Me deben (CxC)</div>
                    {cxc.map((c) => (
                      <div className="compromiso-card" key={c.id}>
                        <div className="compromiso-top">
                          <div className="compromiso-icon" style={{ background: '#3E8E7E' }}><Icon name="ArrowDownRight" size={16} /></div>
                          <div><div className="compromiso-name">{c.name}</div><div className="compromiso-sub"><span className="kind-badge ingreso">Cuenta por cobrar · CxC</span> · Cobranza</div></div>
                          <button className="compromiso-del" onClick={() => deleteCompromiso(c.id)}><Icon name="Trash2" size={14} /></button>
                        </div>
                        <div className="progress-track"><div className="progress-fill" style={{ width: `${c.pct}%`, background: c.liquidada ? 'var(--income)' : 'var(--gold)' }} /></div>
                        <div className="compromiso-nums">
                          <span>Prestado: {fmt(c.amount)}</span>
                          <span>Cobrado: {fmt(c.pagado)}</span>
                          <span className={`pend ${c.liquidada ? 'done' : ''}`}>{c.liquidada ? 'Cobrado ✓' : `Faltan ${fmt(c.pendiente)}`}</span>
                        </div>
                        {c.lastAdjustment && (
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: -4, marginBottom: 10 }}>
                            Último ajuste: {new Date(c.lastAdjustment.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · {fmt(c.lastAdjustment.to)}{c.lastAdjustment.note ? ` — ${c.lastAdjustment.note}` : ''}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="abonar-btn" disabled={c.liquidada} onClick={() => openAbonar(c)} style={{ flex: 1 }}>{c.liquidada ? 'Cobrado ✓' : 'Registrar cobro'}</button>
                          {CXP_EDITABLE_CATS.includes('cobranza') && (
                            <button
                              className="abonar-btn"
                              style={{ flex: 1, background: 'var(--paper-dim)', color: 'var(--ink)', border: '1px solid var(--line)' }}
                              onClick={() => openEditAmount(c)}
                              title="Actualiza el saldo pendiente a mano"
                            >
                              <Icon name="Pencil" size={12} /> Actualizar monto
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {fijos.length > 0 && (
                  <>
                    <div className="totals-subhead">Gastos fijos</div>
                    {fijos.map((c) => (
                      <div
                        className={`compromiso-card ${c.shared ? 'clickable' : ''}`}
                        key={c.id}
                        onClick={c.shared ? () => setSheet({ type: 'compromiso-shared-detail', compromiso: c }) : undefined}
                      >
                        <div className="compromiso-top">
                          <div className="compromiso-icon" style={{ background: catById(c.category).color }}><Icon name="Repeat" size={16} /></div>
                          <div><div className="compromiso-name">{c.name}</div><div className="compromiso-sub"><span className="kind-badge fijo">Gasto fijo</span> · {catById(c.category).label}{c.shared && <> · <span className="shared-badge">COMPARTIDO</span> <Icon name="MoreHorizontal" size={11} style={{ verticalAlign: 'middle' }} /></>}</div></div>
                          <button className="compromiso-del" onClick={(e) => { e.stopPropagation(); deleteCompromiso(c.id); }}><Icon name="Trash2" size={14} /></button>
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
                        <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                          <button className="abonar-btn" disabled={c.pendiente <= 0.01} onClick={() => openAbonar(c)} style={{ flex: 1 }}>{c.pendiente <= 0.01 ? 'Pagado este mes' : 'Pagar / Abonar'}</button>
                          {CXP_EDITABLE_CATS.includes(c.category) && (
                            <button
                              className="abonar-btn"
                              style={{ flex: 1, background: 'var(--paper-dim)', color: 'var(--ink)', border: '1px solid var(--line)' }}
                              onClick={() => openEditAmount(c)}
                              title="Actualiza el monto mensual"
                            >
                              <Icon name="Pencil" size={12} /> Actualizar monto
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {ingresosFijos.length > 0 && (
                  <>
                    <div className="totals-subhead">Ingresos fijos</div>
                    {ingresosFijos.map((c) => (
                      <div className="compromiso-card" key={c.id}>
                        <div className="compromiso-top">
                          <div className="compromiso-icon" style={{ background: catById(c.category).color }}><Icon name={catById(c.category).icon} size={16} /></div>
                          <div><div className="compromiso-name">{c.name}</div><div className="compromiso-sub"><span className="kind-badge ingreso">Ingreso fijo</span> · {catById(c.category).label}</div></div>
                          <button className="compromiso-del" onClick={(e) => { e.stopPropagation(); deleteCompromiso(c.id); }}><Icon name="Trash2" size={14} /></button>
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
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="abonar-btn" disabled={c.pendiente <= 0.01} onClick={() => openAbonar(c)} style={{ flex: 1 }}>{c.pendiente <= 0.01 ? 'Recibido este mes' : 'Marcar recibido'}</button>
                          {CXP_EDITABLE_CATS.includes(c.category) && (
                            <button
                              className="abonar-btn"
                              style={{ flex: 1, background: 'var(--paper-dim)', color: 'var(--ink)', border: '1px solid var(--line)' }}
                              onClick={() => openEditAmount(c)}
                              title="Actualiza el monto esperado"
                            >
                              <Icon name="Pencil" size={12} /> Actualizar monto
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        ) : tab === 'tarjetas' ? (
          <>
            <div className="totals-subhead" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 0 }}>
              <span>¿Dónde está el dinero?</span>
            </div>
            {moneyLocations.length === 0 ? (
              <div className="empty-state" style={{ padding: '16px 10px' }}>Registra cuánto efectivo o saldo en tarjeta tiene cada quien. Usa el botón + para agregar.</div>
            ) : (
              <>
                {moneyLocations.some((l) => l.tipo === 'tarjeta') && (
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, color: 'var(--ink-soft)', margin: '4px 2px 10px' }}>Tarjetas</div>
                )}
                {moneyLocations.filter((l) => l.tipo === 'tarjeta').map((l) => {
                  const pct = l.esCredito && l.limite ? Math.max(0, Math.min(100, (l.monto / l.limite) * 100)) : null;
                  const diasCorte = l.esCredito ? diasHasta(l.diaCorte) : null;
                  const diasPago = l.esCredito ? diasHasta(l.diaPago) : null;
                  const bg = cardBg(l);
                  const bankInfo = getBankInfo(l);
                  const net = l.red || bankInfo?.network;
                  const sobregirada = l.esCredito && l.limite && l.monto > l.limite + 0.01;
                  const prestamoLigado = l.esCredito && l.prestamoId ? deudas.find((d) => d.id === l.prestamoId) : null;
                  return (
                    <div key={l.id} className="wallet-card" style={{ background: bg, ...(sobregirada ? { boxShadow: '0 0 0 2px var(--expense), var(--shadow-card)' } : {}) }} onClick={() => openWalletDetail(l)}>
                      <div className="wallet-card-top">
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          {bankInfo?.name && <span className="bank-monogram">{getInitials(bankInfo.name)}</span>}
                          <div>
                            <div className="wallet-card-name">{l.nombre || 'Tarjeta'}</div>
                            <span className="wallet-card-pill">{l.esCredito ? 'CRÉDITO' : 'DÉBITO'}</span>
                            {sobregirada && <span className="wallet-card-pill" style={{ background: 'var(--expense)', marginLeft: 5 }}>SOBREGIRADA</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="wallet-card-amount">{fmt(l.monto)}</div>
                          <div className="wallet-card-caption">{l.esCredito ? 'Gastos del mes (ciclo)' : l.persona}</div>
                        </div>
                      </div>
                      {l.esCredito && (
                        <div className="wallet-card-body">
                          <div className="wallet-card-limitrow">
                            <span>Uso del límite</span>
                            <span>{l.limite ? `${pct.toFixed(1)}%` : '---%'}</span>
                          </div>
                          <div className="wallet-progress-track"><div className="wallet-progress-fill" style={{ width: `${Math.min(pct || 0, 100)}%`, background: sobregirada ? 'var(--expense)' : '#fff' }} /></div>
                          <div className="wallet-card-limitrow" style={{ marginBottom: l.montoAPagar || prestamoLigado ? 6 : 12 }}>
                            <span>Límite: {l.limite ? fmt(l.limite) : '····'}</span>
                          </div>
                          {l.montoAPagar > 0 && (
                            <div className="wallet-card-limitrow" style={{ marginBottom: 6, fontWeight: 700 }}>
                              <span>Monto a pagar</span>
                              <span>{fmt(l.montoAPagar)}</span>
                            </div>
                          )}
                          {prestamoLigado && (
                            <div className="wallet-card-limitrow" style={{ marginBottom: 12, fontSize: 10.5, opacity: 0.9 }}>
                              <span><Icon name="Landmark" size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Préstamo: {prestamoLigado.name}</span>
                              <span>{prestamoLigado.liquidada ? 'Liquidado' : fmt(prestamoLigado.pendiente)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8 }}>
                            {l.diaCorte && <span className="wallet-pill-btn"><Icon name="CalendarCheck" size={12} /> Corte en {diasCorte} día{diasCorte !== 1 ? 's' : ''}</span>}
                            {l.diaPago && <span className="wallet-pill-btn"><Icon name="CreditCard" size={12} /> Pago en {diasPago} día{diasPago !== 1 ? 's' : ''}</span>}
                          </div>
                        </div>
                      )}
                      {(l.ultimos4 || net) && (
                        <div className="wallet-card-footrow">
                          <span>{l.ultimos4 ? `•••• ${l.ultimos4}` : ''}</span>
                          {net && <span className={`wallet-card-network ${networkClass(net)}`}>{net}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {moneyLocations.some((l) => l.tipo === 'efectivo') && (
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, color: 'var(--ink-soft)', margin: '14px 2px 10px' }}>Monedero</div>
                )}
                {moneyLocationsByPerson.map(([persona, locs]) => locs.filter((l) => l.tipo === 'efectivo').map((l) => (
                  <div key={l.id} className="wallet-card wallet-card-cash" onClick={() => openWalletDetail(l)}>
                    <div className="wallet-card-top">
                      <div>
                        <div className="wallet-card-name">Monedero</div>
                        <span className="wallet-card-pill">EFECTIVO</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="wallet-card-amount">{fmt(l.monto)}</div>
                        <div className="wallet-card-caption">{persona}</div>
                      </div>
                    </div>
                    <div className="wallet-card-footrow">
                      <span><Icon name="Banknote" size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Efectivo disponible</span>
                    </div>
                  </div>
                )))}
                <div className="cxp-total-row" style={{ paddingTop: 14, borderTop: '1px dashed var(--line)', marginTop: 10 }}>
                  <div>
                    <div className="cxp-total-amount" style={{ fontSize: 18 }}>{fmt(moneyLocationsTotal)}</div>
                    <div className="cxp-total-label">Total entre efectivo y tarjetas</div>
                  </div>
                </div>
              </>
            )}
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
            <div style={{ padding: '4px 2px 0' }}>
              <div className="card-title" style={{ padding: 0 }}>Cuentas por pagar (CxP)</div>
            </div>
            <div className="card">
              <div className="card-title">Préstamos · por categoría</div>
              {prestamosPorCategoria.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Sin préstamos pendientes. Dalos de alta desde la pestaña Cuentas.</div> : (
                <>
                  <div className="chart-wrap">
                    <CategoryDonut data={prestamosPorCategoria} title="Préstamos" />
                  </div>
                  <div className="legend-row">{prestamosPorCategoria.map((c) => <div className="legend-item" key={c.id}><span className="legend-dot" style={{ background: c.color }} />{c.name}</div>)}</div>
                </>
              )}
            </div>
            <div className="card">
              <div className="card-title">Gastos fijos · por concepto</div>
              {gastosFijosPorConcepto.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Sin gastos fijos pendientes. Dalos de alta desde la pestaña Cuentas.</div> : (
                <>
                  <div className="chart-wrap">
                    <CategoryDonut data={gastosFijosPorConcepto} title="Fijos" />
                  </div>
                  <div className="legend-row">{gastosFijosPorConcepto.map((c) => <div className="legend-item" key={c.id}><span className="legend-dot" style={{ background: c.color }} />{c.name}</div>)}</div>
                </>
              )}
            </div>
            <div className="card">
              <div className="card-title">¿Dónde está el dinero? · por persona</div>
              {moneyPorPersona.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Registra saldos de efectivo/tarjeta desde la pestaña Tarjetas.</div> : (
                <>
                  <div className="chart-wrap">
                    <CategoryDonut data={moneyPorPersona} title="Dinero" />
                  </div>
                  <div className="legend-row">{moneyPorPersona.map((c) => <div className="legend-item" key={c.id}><span className="legend-dot" style={{ background: c.color }} />{c.name}</div>)}</div>
                </>
              )}
            </div>
            <div className="card">
              <div className="card-title">Estado de Resultado · {PERIOD_LABEL[period]}</div>
              {estadoResultado.ingresos.length === 0 && estadoResultado.gastos.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Sin movimientos en este periodo.</div>
              ) : (
                <>
                  <div className="er-group-title" style={{ color: 'var(--income)' }}>{GRUPO_LABEL.ingresos}</div>
                  {estadoResultado.ingresos.length === 0 ? (
                    <div className="er-empty">Sin ingresos en este periodo.</div>
                  ) : estadoResultado.ingresos.map((r) => (
                    <div className="er-row" key={r.codigo}>
                      <span className="er-cuenta"><span className="er-codigo">{r.codigo}</span> {r.nombre}</span>
                      <span className="er-monto">{fmt(r.value)}</span>
                    </div>
                  ))}
                  <div className="er-total-row" style={{ borderTop: '1px solid var(--line)' }}>
                    <span>Total ingresos</span>
                    <span style={{ color: 'var(--income)' }}>{fmt(estadoResultado.totalIngresos)}</span>
                  </div>

                  <div className="er-group-title" style={{ color: 'var(--expense)', marginTop: 14 }}>{GRUPO_LABEL.gastos}</div>
                  {estadoResultado.gastos.length === 0 ? (
                    <div className="er-empty">Sin gastos en este periodo.</div>
                  ) : estadoResultado.gastos.map((r) => (
                    <div className="er-row" key={r.codigo}>
                      <span className="er-cuenta"><span className="er-codigo">{r.codigo}</span> {r.nombre}</span>
                      <span className="er-monto">{fmt(r.value)}</span>
                    </div>
                  ))}
                  <div className="er-total-row" style={{ borderTop: '1px solid var(--line)' }}>
                    <span>Total costos y gastos</span>
                    <span style={{ color: 'var(--expense)' }}>{fmt(estadoResultado.totalGastos)}</span>
                  </div>

                  <div className="er-total-row" style={{ borderTop: '2px solid var(--ink)', marginTop: 10, paddingTop: 10 }}>
                    <span style={{ fontWeight: 700 }}>Utilidad neta</span>
                    <span style={{ fontWeight: 700, color: estadoResultado.utilidad >= 0 ? 'var(--income)' : 'var(--expense)' }}>{fmt(estadoResultado.utilidad)}</span>
                  </div>

                  <div className="er-group-title" style={{ color: 'var(--gold)', marginTop: 14 }}>Balance (no afecta la utilidad)</div>
                  <div className="er-row">
                    <span className="er-cuenta"><span className="er-codigo">{CUENTA_AHORRO.codigo}</span> {CUENTA_AHORRO.nombre}</span>
                    <span className="er-monto">{fmt(savingsMovesInPeriod)}</span>
                  </div>
                  <div className="er-empty">Traspaso de banco/efectivo a ahorro en el periodo · cuenta de Activo, no es gasto.</div>
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
        <button className={`nav-btn ${tab === 'compromisos' ? 'active' : ''}`} style={tab === 'compromisos' ? { color: TAB_COLORS.compromisos, background: `${TAB_COLORS.compromisos}1A` } : undefined} onClick={() => setTab('compromisos')}><Icon name="Landmark" size={17} />Cuentas</button>
        <button className={`nav-btn ${tab === 'tarjetas' ? 'active' : ''}`} style={tab === 'tarjetas' ? { color: TAB_COLORS.tarjetas, background: `${TAB_COLORS.tarjetas}1A` } : undefined} onClick={() => setTab('tarjetas')}><Icon name="CreditCard" size={17} />Tarjetas</button>
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
            <div className="field-label">Monto *</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={txForm.amount} onChange={(e) => setTxForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-label">Categoría *</div>
            <div className="cat-grid">
              {catOptions.map((c) => { return (
                <div key={c.id} className={`cat-choice ${txForm.category === c.id ? 'selected' : ''}`} onClick={() => setTxForm((f) => ({ ...f, category: c.id, subcategory: '' }))}>
                  <div className="cat-choice-icon" style={{ background: c.color }}><Icon name={c.icon} size={15} /></div><span className="cat-choice-label">{c.label}</span>
                </div>
              ); })}
            </div>
            {(txForm.type === 'ingreso' || txForm.type === 'gasto') && (
              <>
                <div className="field-label">{txForm.type === 'ingreso' ? '¿Dónde cae este dinero? *' : '¿De dónde sale este dinero? *'}</div>
                {moneyLocations.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: 'var(--expense)', margin: '-4px 0 12px' }}>
                    Todavía no tienes ubicaciones de dinero. Créalas primero desde la pestaña Tarjetas para poder guardar este movimiento.
                  </div>
                ) : (
                  <div className="cat-grid">
                    {moneyLocations.map((l) => (
                      <div
                        key={l.id}
                        className={`cat-choice ${txForm.locationId === l.id ? 'selected' : ''}`}
                        onClick={() => setTxForm((f) => ({ ...f, locationId: f.locationId === l.id ? '' : l.id }))}
                      >
                        <div className="cat-choice-icon" style={{ background: l.tipo === 'tarjeta' ? '#3E6EA5' : '#5F8A4C' }}><Icon name={l.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={15} /></div>
                        <span className="cat-choice-label">{l.persona} · {l.tipo === 'tarjeta' ? (l.nombre || 'Tarjeta') : 'Monedero'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {(txForm.type === 'gasto' || txForm.type === 'ingreso') && txForm.category && (() => {
              const subAccounts = getSubAccountsForCategory(txForm.type, txForm.category);
              if (!subAccounts.length) return null;
              const isDeudaCat = txForm.type === 'gasto' && txForm.category === 'deudas';
              const enteredAmt = toNumber(txForm.amount);
              const linkedTotal = (txForm.links || []).reduce((s, id) => {
                const c = subAccounts.find((x) => x.id === id);
                if (c && c.shared) return s + Object.values(txForm.linkParticipants[id] || {}).reduce((ss, v) => ss + (toNumber(v) || 0), 0);
                return s + (toNumber(txForm.linkAmounts[id]) || 0);
              }, 0);
              const kindLabel = isDeudaCat ? 'préstamo' : txForm.type === 'ingreso' ? 'ingreso fijo' : 'cuenta';
              const anyShared = txForm.links.some((id) => { const c = subAccounts.find((x) => x.id === id); return c && c.shared; });
              return (
                <>
                  <div className="field-label">¿A cuál {kindLabel} corresponde? (opcional{anyShared ? ', puedes elegir varias compartidas' : ''})</div>
                  <div className="subcat-row">
                    {subAccounts.map((c) => (
                      <button key={c.id} className={`subcat-chip ${txForm.links.includes(c.id) ? 'selected' : ''}`} onClick={() => toggleTxLink(c, subAccounts)}>{c.name}{c.shared ? ' 👥' : ''}</button>
                    ))}
                  </div>
                  {txForm.links.length > 0 && (
                    <div style={{ margin: '2px 0 4px' }}>
                      {txForm.links.map((id) => {
                        const c = subAccounts.find((x) => x.id === id);
                        if (!c) return null;
                        if (c.shared) {
                          return (
                            <div key={id} style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', margin: '6px 0 4px' }}>{c.name} <span className="shared-badge" style={{ marginLeft: 4 }}>COMPARTIDO</span></div>
                              <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-2px 0 6px' }}>Toca a quién(es) corresponde este pago. Puedes elegir a una o varias personas (por ejemplo, si alguien patrocina la parte de otro).</div>
                              {(c.shared.participants || []).map((p) => {
                                const sel = Object.prototype.hasOwnProperty.call(txForm.linkParticipants[id] || {}, p.name);
                                return (
                                  <div
                                    className="participant-row"
                                    key={p.id}
                                    style={{ cursor: 'pointer', alignItems: 'center' }}
                                    onClick={() => toggleParticipantLink(id, p)}
                                  >
                                    <div className={`check-circle ${sel ? 'on' : ''}`}>{sel && <Icon name="Check" size={11} color="#fff" />}</div>
                                    <div className="mini-avatar" style={{ background: colorForName(p.name) }}>{p.name.charAt(0).toUpperCase()}</div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                                      <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Le toca: {fmt(p.amount)}</div>
                                    </div>
                                    {sel && (
                                      <input
                                        className="text-input amount-mini"
                                        type="text" inputMode="decimal" placeholder="$0"
                                        value={(txForm.linkParticipants[id] || {})[p.name] || ''}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setTxForm((f) => ({ ...f, linkParticipants: { ...f.linkParticipants, [id]: { ...f.linkParticipants[id], [p.name]: formatAmountTyping(e.target.value) } } }))}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        return (
                          <div className="participant-row" key={id}>
                            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center' }}>{c.name}</div>
                            <input className="text-input amount-mini" type="text" inputMode="decimal" placeholder="$0" value={txForm.linkAmounts[id] || ''} onChange={(e) => setTxForm((f) => ({ ...f, linkAmounts: { ...f.linkAmounts, [id]: formatAmountTyping(e.target.value) } }))} />
                            <button className="remove-participant" onClick={() => toggleTxLink(c, subAccounts)}><Icon name="X" size={15} /></button>
                          </div>
                        );
                      })}
                      <div style={{ fontSize: 11.5, color: linkedTotal > enteredAmt + 0.01 ? 'var(--expense)' : 'var(--ink-soft)', margin: '2px 2px 12px' }}>
                        Vinculado: {fmt(linkedTotal)} de {fmt(enteredAmt)}{linkedTotal > enteredAmt + 0.01 ? ' — reduce algún monto' : ''}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            {!txForm.links.length && (
              <div className="toggle-row">
                <span className="toggle-row-label"><Icon name="Repeat" size={14} /> ¿Es un {txForm.type === 'gasto' ? 'gasto' : 'ingreso'} fijo nuevo (recurrente)?</span>
                <button className={`switch ${txForm.fijo ? 'on' : ''}`} onClick={() => setTxForm((f) => ({ ...f, fijo: !f.fijo, fijoTarget: 'new' }))} />
              </div>
            )}
            {txForm.fijo && !txForm.links.length && (
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
            <div className="field-label">Nota *</div>
            <input className="text-input" type="text" placeholder="Ej. Netflix, gasolina..." value={txForm.note} onChange={(e) => setTxForm((f) => ({ ...f, note: e.target.value }))} />
            <div className="field-label">Fecha *</div>
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
            <button
              className="save-btn"
              disabled={!(toNumber(txForm.amount) > 0 && txForm.category && txForm.locationId && txForm.note.trim() && txForm.date)}
              onClick={submitTx}
            ><Icon name="Check" size={16} /> Guardar movimiento</button>
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
            <div className="field-label">Monto *</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={editTxForm.amount} onChange={(e) => setEditTxForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-label">Categoría *</div>
            <div className="cat-grid">
              {editCatOptions.map((c) => { return (
                <div key={c.id} className={`cat-choice ${editTxForm.category === c.id ? 'selected' : ''}`} onClick={() => setEditTxForm((f) => ({ ...f, category: c.id, subcategory: '' }))}>
                  <div className="cat-choice-icon" style={{ background: c.color }}><Icon name={c.icon} size={15} /></div><span className="cat-choice-label">{c.label}</span>
                </div>
              ); })}
            </div>
            <div className="field-label">{editTxForm.type === 'ingreso' ? '¿Dónde cae este dinero? *' : '¿De dónde sale este dinero? *'}</div>
            {moneyLocations.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--expense)', margin: '-4px 0 12px' }}>
                Todavía no tienes ubicaciones de dinero. Créalas primero desde la pestaña Tarjetas para poder guardar este movimiento.
              </div>
            ) : (
              <div className="cat-grid">
                {moneyLocations.map((l) => (
                  <div
                    key={l.id}
                    className={`cat-choice ${editTxForm.locationId === l.id ? 'selected' : ''}`}
                    onClick={() => setEditTxForm((f) => ({ ...f, locationId: f.locationId === l.id ? '' : l.id }))}
                  >
                    <div className="cat-choice-icon" style={{ background: l.tipo === 'tarjeta' ? '#3E6EA5' : '#5F8A4C' }}><Icon name={l.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={15} /></div>
                    <span className="cat-choice-label">{l.persona} · {l.tipo === 'tarjeta' ? (l.nombre || 'Tarjeta') : 'Monedero'}</span>
                  </div>
                ))}
              </div>
            )}
            {(() => {
              const origTx = transactions.find((t) => t.id === editTxForm.id);
              if (origTx?.compromisoId) {
                return (
                  <div className="account-info-box">
                    <div className="meta"><Icon name="Landmark" size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Vinculado a: {subcatLabel(origTx.compromisoId)}</div>
                  </div>
                );
              }
              const subAccounts = getSubAccountsForCategory(editTxForm.type, editTxForm.category);
              if (!subAccounts.length) return null;
              return (
                <>
                  <div className="field-label">{editTxForm.category === 'deudas' ? '¿A cuál préstamo corresponde? (opcional)' : '¿A cuál cuenta corresponde? (opcional)'}</div>
                  <div className="subcat-row">
                    {subAccounts.map((c) => (
                      <button key={c.id} className={`subcat-chip ${editTxForm.subcategory === c.id ? 'selected' : ''}`} onClick={() => setEditTxForm((f) => ({ ...f, subcategory: f.subcategory === c.id ? '' : c.id }))}>{c.name}</button>
                    ))}
                  </div>
                </>
              );
            })()}
            <div className="field-label">Nota *</div>
            <input className="text-input" type="text" placeholder="Ej. Netflix, gasolina..." value={editTxForm.note} onChange={(e) => setEditTxForm((f) => ({ ...f, note: e.target.value }))} />
            <div className="field-label">Fecha *</div>
            <input className="text-input" type="date" value={editTxForm.date} onChange={(e) => setEditTxForm((f) => ({ ...f, date: e.target.value }))} />
            {editTxError && <div className="form-error">{editTxError}</div>}
            <button
              className="save-btn"
              disabled={!(toNumber(editTxForm.amount) > 0 && editTxForm.category && editTxForm.locationId && editTxForm.note.trim() && editTxForm.date)}
              onClick={submitEditTx}
            ><Icon name="Check" size={16} /> Actualizar movimiento</button>
            <button className="danger-btn" onClick={deleteTxFromEdit}><Icon name="Trash2" size={14} /> Eliminar movimiento</button>
          </div>
        </div>
      )}

      {sheet?.type === 'programados' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">Movimientos programados</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            {[...fijos, ...ingresosFijos].length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 10px' }}>No tienes gastos ni ingresos fijos dados de alta todavía.</div>
            ) : (
              [...fijos, ...ingresosFijos]
                .slice()
                .sort((a, b) => (a.notifyDay || 99) - (b.notifyDay || 99))
                .map((c) => {
                  const pagado = c.pendiente <= 0.01;
                  return (
                    <div className="compromiso-card" key={c.id}>
                      <div className="compromiso-top">
                        <div className="compromiso-icon" style={{ background: pagado ? 'var(--ink-soft)' : 'var(--expense)' }}><Icon name="CalendarCheck" size={16} /></div>
                        <div style={{ flex: 1 }}>
                          <div className="compromiso-name">{c.name}</div>
                          <div className="compromiso-sub">Mensual{c.notifyDay ? ` · Día ${c.notifyDay}` : ''}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: c.kind === 'ingreso_fijo' ? 'var(--income)' : 'var(--expense)' }}>{fmt(c.amount)}</div>
                          <span className={`pend ${pagado ? 'done' : ''}`} style={{ fontSize: 10 }}>{pagado ? 'PAGADO' : 'PENDIENTE'}</span>
                        </div>
                      </div>
                      {!pagado && (
                        <button className="abonar-btn" onClick={() => openAbonar(c)}><Icon name="Check" size={13} /> Marcar como pagado</button>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}
      {sheet?.type === 'msi' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">Simular compra a MSI</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
              Dale el monto total y a cuántos meses sin intereses lo diferiste; te calculo el pago mensual y, si quieres, lo doy de alta como gasto fijo para que no se te olvide.
            </div>
            <div className="field-label">¿Qué compraste?</div>
            <input className="text-input" type="text" placeholder="Ej. Laptop, refri, viaje..." value={msiForm.name} onChange={(e) => setMsiForm((f) => ({ ...f, name: e.target.value }))} />
            <div className="field-label">Monto total de la compra</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={msiForm.amount} onChange={(e) => setMsiForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} /></div>
            <div className="field-label">Meses sin intereses</div>
            <div className="cat-grid">
              {[3, 6, 9, 12, 18, 24].map((m) => (
                <div key={m} className={`cat-choice ${String(msiForm.months) === String(m) ? 'selected' : ''}`} onClick={() => setMsiForm((f) => ({ ...f, months: String(m) }))}>
                  <span className="cat-choice-label" style={{ fontWeight: 700, fontSize: 14 }}>{m}m</span>
                </div>
              ))}
            </div>
            {toNumber(msiForm.amount) > 0 && toNumber(msiForm.months) > 0 && (
              <div className="er-total-row" style={{ borderTop: '2px solid var(--ink)', marginTop: 4, paddingTop: 10 }}>
                <span style={{ fontWeight: 700 }}>Pago mensual</span>
                <span style={{ fontWeight: 700 }}>{fmt(toNumber(msiForm.amount) / toNumber(msiForm.months))}</span>
              </div>
            )}
            <button
              className="save-btn"
              disabled={!(msiForm.name.trim() && toNumber(msiForm.amount) > 0 && toNumber(msiForm.months) > 0)}
              onClick={() => openNewCompromiso({ kind: 'fijo', name: `${msiForm.name.trim()} (MSI ${msiForm.months}m)`, amount: formatAmountTyping((toNumber(msiForm.amount) / toNumber(msiForm.months)).toFixed(2)) })}
            >
              <Icon name="Check" size={16} /> Dar de alta como gasto fijo
            </button>
          </div>
        </div>
      )}
      {sheet?.type === 'new-compromiso' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">{compForm.kind === 'deuda' ? 'Nueva cuenta por pagar (CxP)' : compForm.kind === 'cxc' ? 'Nueva cuenta por cobrar (CxC)' : compForm.kind === 'ingreso_fijo' ? 'Nuevo ingreso fijo' : 'Nuevo gasto fijo'}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div className="type-toggle" style={{ flexWrap: 'wrap' }}>
              <button className={compForm.kind === 'deuda' ? 'active deuda' : ''} onClick={() => setCompForm((f) => ({ ...f, kind: 'deuda', category: 'deudas' }))}><Icon name="Landmark" size={14} /> Préstamo</button>
              <button className={compForm.kind === 'cxc' ? 'active deuda' : ''} onClick={() => setCompForm((f) => ({ ...f, kind: 'cxc', category: 'cobranza' }))}><Icon name="ArrowDownRight" size={14} /> Me deben (CxC)</button>
              <button className={compForm.kind === 'fijo' ? 'active fijo' : ''} onClick={() => setCompForm((f) => ({ ...f, kind: 'fijo', category: '' }))}><Icon name="Repeat" size={14} /> Gasto fijo</button>
              <button className={compForm.kind === 'ingreso_fijo' ? 'active ingreso' : ''} onClick={() => setCompForm((f) => ({ ...f, kind: 'ingreso_fijo', category: '' }))}><Icon name="ArrowUpRight" size={14} /> Ingreso fijo</button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
              {compForm.kind === 'deuda'
                ? 'Registra préstamos, tarjetas o cuentas por pagar. Podrás abonar después desde la pestaña Cuentas.'
                : compForm.kind === 'cxc'
                ? 'Registra dinero que le prestaste a alguien. Cuando te vaya pagando, regístralo como cobro y se sumará a tus ingresos (cuenta 4300 · Cobranza).'
                : 'Esto solo da de alta el compromiso; todavía no se crea ningún movimiento. Cuando hagas el pago (o lo recibas), regístralo desde el botón + o con "Abonar" aquí mismo.'}
            </div>
            <div className="field-label">Nombre</div>
            <input className="text-input" placeholder={compForm.kind === 'deuda' ? 'Ej. Préstamo bancario' : compForm.kind === 'cxc' ? 'Ej. Le presté a mi hermano' : compForm.kind === 'ingreso_fijo' ? 'Ej. Nómina, comisiones...' : 'Ej. Renta, Internet...'} value={compForm.name} onChange={(e) => setCompForm((f) => ({ ...f, name: e.target.value }))} />
            <div className="field-label">{compForm.kind === 'deuda' ? 'Monto total del préstamo' : compForm.kind === 'cxc' ? 'Monto total prestado' : 'Monto mensual'}</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={compForm.amount} onChange={(e) => setCompForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} /></div>
            {compForm.kind === 'deuda' && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 6 }}>
                Si es de un banco (Nu, Bodega Aurrera, etc.) que sube el saldo por intereses, no te preocupes por eso ahora: cada mes podrás actualizar el monto pendiente directo desde la tarjeta del préstamo con el estado de cuenta que te manden.
              </div>
            )}
            {isBalanceKind(compForm.kind) && moneyLocations.length > 0 && (
              <>
                <div className="field-label">{compForm.kind === 'deuda' ? '¿A qué cuenta entra el dinero? (opcional)' : '¿De qué cuenta sale el dinero? (opcional)'}</div>
                <div className="cat-grid">
                  {moneyLocations.map((l) => (
                    <div
                      key={l.id}
                      className={`cat-choice ${compForm.locationId === l.id ? 'selected' : ''}`}
                      onClick={() => setCompForm((f) => ({ ...f, locationId: f.locationId === l.id ? '' : l.id }))}
                    >
                      <div className="cat-choice-icon" style={{ background: l.tipo === 'tarjeta' ? '#3E6EA5' : '#5F8A4C' }}><Icon name={l.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={15} /></div>
                      <span className="cat-choice-label">{l.persona} · {l.tipo === 'tarjeta' ? (l.nombre || 'Banco') : 'Monedero'}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
                  {compForm.kind === 'deuda'
                    ? 'Si el dinero del préstamo ya te lo depositaron o ya lo tienes en efectivo, elige aquí a dónde entró. Si no, déjalo vacío.'
                    : 'Si el dinero que prestaste salió de una de tus cuentas, elige de cuál. Si no, déjalo vacío.'}
                </div>
              </>
            )}
            {compForm.kind !== 'cxc' && (
              <>
                <div className="field-label">Categoría</div>
                <div className="cat-grid">
                  {CXP_CATS.map((c) => { return (
                    <div key={c.id} className={`cat-choice ${compForm.category === c.id ? 'selected' : ''}`} onClick={() => setCompForm((f) => ({ ...f, category: c.id }))}>
                      <div className="cat-choice-icon" style={{ background: c.color }}><Icon name={c.icon} size={15} /></div><span className="cat-choice-label">{c.label}</span>
                    </div>
                  ); })}
                </div>
              </>
            )}
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
            <button className="save-btn" onClick={submitCompromiso}><Icon name="Check" size={16} /> {compForm.kind === 'deuda' ? 'Crear préstamo' : compForm.kind === 'cxc' ? 'Crear cuenta por cobrar' : compForm.kind === 'ingreso_fijo' ? 'Crear ingreso fijo' : 'Crear gasto fijo'}</button>
          </div>
        </div>
      )}

      {sheet?.type === 'abonar' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">{sheet.compromiso.kind === 'ingreso_fijo' ? 'Ingreso recibido' : sheet.compromiso.kind === 'cxc' ? 'Cobro' : 'Abonar'} · {sheet.compromiso.name}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div className="field-label">{sheet.compromiso.kind === 'ingreso_fijo' ? 'Monto recibido' : sheet.compromiso.kind === 'cxc' ? 'Monto cobrado' : 'Monto a abonar'} *</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" value={abonoForm.amount} onChange={(e) => setAbonoForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-label">{sheet.compromiso.kind === 'ingreso_fijo' || sheet.compromiso.kind === 'cxc' ? '¿Dónde cae este dinero? *' : '¿De dónde sale este dinero? *'}</div>
            {moneyLocations.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--expense)', margin: '-4px 0 12px' }}>
                Todavía no tienes ubicaciones de dinero. Créalas primero desde la pestaña Tarjetas para poder guardar este movimiento.
              </div>
            ) : (
              <div className="cat-grid">
                {moneyLocations.map((l) => (
                  <div
                    key={l.id}
                    className={`cat-choice ${abonoForm.locationId === l.id ? 'selected' : ''}`}
                    onClick={() => setAbonoForm((f) => ({ ...f, locationId: f.locationId === l.id ? '' : l.id }))}
                  >
                    <div className="cat-choice-icon" style={{ background: l.tipo === 'tarjeta' ? '#3E6EA5' : '#5F8A4C' }}><Icon name={l.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={15} /></div>
                    <span className="cat-choice-label">{l.persona} · {l.tipo === 'tarjeta' ? (l.nombre || 'Tarjeta') : 'Monedero'}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="field-label">Fecha</div>
            <input className="text-input" type="date" value={abonoForm.date} onChange={(e) => setAbonoForm((f) => ({ ...f, date: e.target.value }))} />
            <div className="field-label">Nota (opcional)</div>
            <input className="text-input" placeholder={sheet.compromiso.kind === 'ingreso_fijo' ? 'Ej. Nómina de julio' : sheet.compromiso.kind === 'cxc' ? 'Ej. Abono de Juan' : 'Ej. Pago parcial de mayo'} value={abonoForm.note} onChange={(e) => setAbonoForm((f) => ({ ...f, note: e.target.value }))} />
            {abonoError && <div className="form-error">{abonoError}</div>}
            <button className="save-btn" disabled={!(toNumber(abonoForm.amount) > 0 && abonoForm.locationId)} onClick={submitAbono}><Icon name="Check" size={16} /> {sheet.compromiso.kind === 'ingreso_fijo' ? 'Registrar ingreso' : sheet.compromiso.kind === 'cxc' ? 'Registrar cobro' : 'Registrar abono'}</button>
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

      {sheet?.type === 'compromiso-shared-detail' && (() => {
        const c = compromisosView.find((x) => x.id === sheet.compromiso.id) || sheet.compromiso;
        const totalParts = (c.shared?.participants || []).reduce((s, p) => s + p.amount, 0);
        const paymentsSorted = [...(c.payments || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
        return (
          <div className="sheet-backdrop" onClick={() => setSheet(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-header"><span className="sheet-title">{c.name} <span className="shared-badge" style={{ marginLeft: 6 }}>COMPARTIDO</span></span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
                {catById(c.category).label} · Mensual: {fmt(c.amount)} · Pagado este mes: {fmt(c.pagado)}
              </div>
              <div className="totals-subhead">División acordada</div>
              {(c.shared?.participants || []).length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 10 }}>Sin participantes definidos.</div>
              ) : (
                <>
                  {c.shared.participants.map((p) => (
                    <div className="mini-row" key={p.id}>
                      <div className="mini-avatar" style={{ background: colorForName(p.name) }}>{p.name.charAt(0).toUpperCase()}</div>
                      <div className="mini-row-mid"><div className="mini-row-name">{p.name}</div></div>
                      <div className="mini-row-amount">{fmt(p.amount)}</div>
                    </div>
                  ))}
                  <div className="cxp-total-row" style={{ paddingTop: 8, borderTop: '1px dashed var(--line)', marginTop: 4, marginBottom: 14 }}>
                    <div><div className="cxp-total-amount" style={{ fontSize: 15 }}>{fmt(totalParts)}</div><div className="cxp-total-label">Total repartido</div></div>
                  </div>
                </>
              )}
              <div className="totals-subhead">Historial de pagos</div>
              {paymentsSorted.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Todavía no hay pagos registrados.</div>
              ) : (
                paymentsSorted.map((p) => (
                  <div key={p.id} style={{ marginBottom: 8 }}>
                    <div className="mini-row">
                      <div className="mini-row-mid">
                        <div className="mini-row-name">{new Date(p.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        {p.note && <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{p.note}</div>}
                      </div>
                      <div className="mini-row-amount">{fmt(p.amount)}</div>
                    </div>
                    {p.participants && p.participants.length > 0 && (
                      <div style={{ margin: '0 0 0 12px', paddingLeft: 10, borderLeft: '2px solid var(--line)' }}>
                        {p.participants.map((pp, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-soft)', padding: '2px 0' }}>
                            <span>{pp.name}</span><span>{fmt(pp.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
              <button className="abonar-btn" style={{ marginTop: 16 }} disabled={c.pendiente <= 0.01} onClick={() => { setSheet(null); openAbonar(c); }}>{c.pendiente <= 0.01 ? 'Pagado este mes' : 'Pagar / Abonar'}</button>
            </div>
          </div>
        );
      })()}

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

      {sheet?.type === 'wallet-detail' && (() => {
        const loc = moneyLocations.find((l) => l.id === sheet.location.id) || sheet.location;
        const pct = loc.esCredito && loc.limite ? Math.max(0, Math.min(100, (loc.monto / loc.limite) * 100)) : null;
        const diasCorte = loc.esCredito ? diasHasta(loc.diaCorte) : null;
        const diasPago = loc.esCredito ? diasHasta(loc.diaPago) : null;
        const bg = cardBg(loc);
        const bankInfo = getBankInfo(loc);
        const net = loc.red || bankInfo?.network;
        const sobregirada = loc.esCredito && loc.limite && loc.monto > loc.limite + 0.01;
        const prestamoLigado = loc.esCredito && loc.prestamoId ? deudas.find((d) => d.id === loc.prestamoId) : null;
        return (
          <div className="sheet-backdrop" onClick={() => setSheet(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-header"><span className="sheet-title">{loc.tipo === 'tarjeta' ? (loc.nombre || 'Tarjeta') : 'Monedero'}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
              <div className={`wallet-card ${loc.tipo === 'efectivo' ? 'wallet-card-cash' : ''}`} style={{ background: loc.tipo === 'tarjeta' ? bg : undefined, cursor: 'default', marginBottom: 16, ...(sobregirada ? { boxShadow: '0 0 0 2px var(--expense), var(--shadow-card)' } : {}) }}>
                <div className="wallet-card-top">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {loc.tipo === 'tarjeta' && bankInfo?.name && <span className="bank-monogram">{getInitials(bankInfo.name)}</span>}
                    <div>
                      <div className="wallet-card-name">{loc.tipo === 'tarjeta' ? (loc.nombre || 'Tarjeta') : 'Monedero'}</div>
                      <span className="wallet-card-pill">{loc.tipo === 'tarjeta' ? (loc.esCredito ? 'CRÉDITO' : 'DÉBITO') : 'MONEDERO'}</span>
                      {sobregirada && <span className="wallet-card-pill" style={{ background: 'var(--expense)', marginLeft: 5 }}>SOBREGIRADA</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="wallet-card-amount">{fmt(loc.monto)}</div>
                    <div className="wallet-card-caption">{loc.esCredito ? 'Gastos del mes (ciclo)' : loc.persona}</div>
                  </div>
                </div>
                {loc.esCredito && (
                  <div className="wallet-card-body">
                    <div className="wallet-card-limitrow"><span>Uso del límite</span><span>{loc.limite ? `${pct.toFixed(1)}%` : '---%'}</span></div>
                    <div className="wallet-progress-track"><div className="wallet-progress-fill" style={{ width: `${Math.min(pct || 0, 100)}%`, background: sobregirada ? 'var(--expense)' : '#fff' }} /></div>
                    <div className="wallet-card-limitrow" style={{ marginBottom: loc.montoAPagar || prestamoLigado ? 6 : 12 }}><span>Límite: {loc.limite ? fmt(loc.limite) : '····'}</span></div>
                    {loc.montoAPagar > 0 && (
                      <div className="wallet-card-limitrow" style={{ marginBottom: 6, fontWeight: 700 }}>
                        <span>Monto a pagar</span>
                        <span>{fmt(loc.montoAPagar)}</span>
                      </div>
                    )}
                    {prestamoLigado && (
                      <div className="wallet-card-limitrow" style={{ marginBottom: 12, fontSize: 10.5, opacity: 0.9 }}>
                        <span><Icon name="Landmark" size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Préstamo: {prestamoLigado.name}</span>
                        <span>{prestamoLigado.liquidada ? 'Liquidado' : fmt(prestamoLigado.pendiente)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {loc.diaCorte && <span className="wallet-pill-btn"><Icon name="CalendarCheck" size={12} /> Corte en {diasCorte} día{diasCorte !== 1 ? 's' : ''}</span>}
                      {loc.diaPago && <span className="wallet-pill-btn"><Icon name="CreditCard" size={12} /> Pago en {diasPago} día{diasPago !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                )}
                {(loc.ultimos4 || net) && (
                  <div className="wallet-card-footrow">
                    <span>{loc.ultimos4 ? `•••• ${loc.ultimos4}` : ''}</span>
                    {net && <span className={`wallet-card-network ${networkClass(net)}`}>{net}</span>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {moneyLocations.length >= 2 && (
                  <button className="save-btn" style={{ background: 'var(--gold)' }} onClick={() => openTraspaso({ fromId: loc.id })}><Icon name="ArrowLeftRight" size={16} /> Traspasar dinero</button>
                )}
                <button className="save-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)', border: '1px solid var(--line)' }} onClick={() => openEditLocation(loc)}><Icon name="Pencil" size={16} /> Editar {loc.tipo === 'tarjeta' ? 'tarjeta' : 'efectivo'}</button>
                <button className="danger-btn" onClick={() => { setSheet(null); deleteLocation(loc.id); }}><Icon name="Trash2" size={14} /> Eliminar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {sheet?.type === 'wallet-menu' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">¿Qué quieres hacer?</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="save-btn" onClick={() => openNewLocation()}><Icon name="Plus" size={16} /> Agregar tarjeta o monedero</button>
              {moneyLocations.length >= 2 && (
                <button className="save-btn" style={{ background: 'var(--gold)' }} onClick={() => openTraspaso()}><Icon name="ArrowLeftRight" size={16} /> Traspasar dinero</button>
              )}
            </div>
          </div>
        </div>
      )}

      {sheet?.type === 'new-location' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">Nueva ubicación de dinero</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
              Registra cuánto efectivo o saldo en tarjeta tiene cada quien. Cuando registres un ingreso, podrás elegir a cuál de estas se suma solo.
            </div>
            <div className="field-label">¿De quién es?</div>
            {familia.length > 0 ? (
              <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {familia.map((m) => (
                  <div key={m} className={`cat-choice ${locForm.persona === m ? 'selected' : ''}`} onClick={() => setLocForm((f) => ({ ...f, persona: m }))}>
                    <div className="mini-avatar" style={{ background: colorForName(m) }}>{m.charAt(0).toUpperCase()}</div>
                    <span className="cat-choice-label">{m}</span>
                  </div>
                ))}
              </div>
            ) : (
              <input className="text-input" placeholder="Ej. Mamá, Papá..." value={locForm.persona} onChange={(e) => setLocForm((f) => ({ ...f, persona: e.target.value }))} />
            )}
            <div className="field-label" style={{ marginTop: 12 }}>Tipo</div>
            <div className="type-toggle">
              <button className={locForm.tipo === 'efectivo' ? 'active deposito' : ''} onClick={() => setLocForm((f) => ({ ...f, tipo: 'efectivo', nombre: '' }))}><Icon name="Wallet" size={14} /> Monedero</button>
              <button className={locForm.tipo === 'tarjeta' ? 'active deposito' : ''} onClick={() => setLocForm((f) => ({ ...f, tipo: 'tarjeta' }))}><Icon name="CreditCard" size={14} /> Tarjeta</button>
            </div>
            {locForm.tipo === 'tarjeta' && (
              <>
                <div className="field-label">Nombre del banco o cuenta</div>
                <input className="text-input" placeholder="Ej. Banamex, BBVA, Nu..." value={locForm.nombre} onChange={(e) => setLocForm((f) => ({ ...f, nombre: e.target.value }))} />
                <div className="field-label">CLABE interbancaria (opcional)</div>
                <input
                  className="text-input"
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="18 dígitos"
                  value={locForm.clabe}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 18);
                    const detected = getBankFromClabe(digits);
                    setLocForm((f) => ({ ...f, clabe: digits, nombre: detected && !f.nombre.trim() ? detected : f.nombre }));
                  }}
                />
                <div style={{ fontSize: 11, color: getBankFromClabe(locForm.clabe) ? 'var(--income)' : 'var(--ink-soft)', margin: '-6px 0 12px' }}>
                  {getBankInfo(locForm) ? `Banco identificado: ${getBankInfo(locForm).name}.` : 'Escribe el nombre de tu banco (ej. Banamex, BBVA, Santander, Nu) o captura tu CLABE para identificarlo automáticamente.'}
                </div>
                <div className="field-label">Número de tarjeta (opcional)</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-2px 0 6px' }}>Solo para detectar la red (Visa/Mastercard/Amex) y los últimos 4 dígitos; no se guarda el número completo.</div>
                <input
                  className="text-input"
                  inputMode="numeric"
                  maxLength={19}
                  placeholder="•••• •••• •••• ••••"
                  value={formatCardNumberTyping(locCardNumber)}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
                    setLocCardNumber(digits);
                    const net = detectCardNetwork(digits);
                    setLocForm((f) => ({ ...f, ultimos4: digits.length >= 4 ? digits.slice(-4) : f.ultimos4, red: net || f.red }));
                  }}
                />
                {locCardNumber.length >= 2 && (
                  <div style={{ fontSize: 11, color: detectCardNetwork(locCardNumber) ? 'var(--income)' : 'var(--ink-soft)', margin: '-6px 0 12px' }}>
                    {detectCardNetwork(locCardNumber) ? `Red detectada: ${detectCardNetwork(locCardNumber)}.` : 'No se reconoce la red con estos dígitos.'}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div className="field-label">Últimos 4 dígitos (opcional)</div>
                    <input className="text-input" inputMode="numeric" maxLength={4} placeholder="Ej. 0102" value={locForm.ultimos4} onChange={(e) => setLocForm((f) => ({ ...f, ultimos4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="field-label">Red (opcional)</div>
                    <select className="text-input" value={locForm.red} onChange={(e) => setLocForm((f) => ({ ...f, red: e.target.value }))}>
                      <option value="">Auto</option>
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="American Express">Amex</option>
                    </select>
                  </div>
                </div>
                <div className="field-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 0 14px' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>¿Es tarjeta de crédito?</span>
                  <div className={`switch ${locForm.esCredito ? 'on' : ''}`} onClick={() => setLocForm((f) => ({ ...f, esCredito: !f.esCredito }))} />
                </div>
              </>
            )}
            {locForm.tipo === 'tarjeta' && locForm.esCredito && (
              <>
                <div className="field-label">Límite de crédito</div>
                <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={locForm.limite} onChange={(e) => setLocForm((f) => ({ ...f, limite: formatAmountTyping(e.target.value) }))} /></div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div className="field-label">Día de corte</div>
                    <input className="text-input" type="number" min="1" max="31" placeholder="Ej. 18" value={locForm.diaCorte} onChange={(e) => setLocForm((f) => ({ ...f, diaCorte: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="field-label">Día de pago</div>
                    <input className="text-input" type="number" min="1" max="31" placeholder="Ej. 6" value={locForm.diaPago} onChange={(e) => setLocForm((f) => ({ ...f, diaPago: e.target.value }))} />
                  </div>
                </div>
                <div className="field-label">Monto a pagar (opcional)</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-2px 0 6px' }}>Lo que te pide tu estado de cuenta este ciclo (pago para no generar intereses, o el mínimo).</div>
                <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={locForm.montoAPagar} onChange={(e) => setLocForm((f) => ({ ...f, montoAPagar: formatAmountTyping(e.target.value) }))} /></div>
                {deudas.length > 0 && (
                  <>
                    <div className="field-label" style={{ marginTop: 12 }}>¿Esta tarjeta está ligada a un préstamo? (opcional)</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-2px 0 8px' }}>Por ejemplo, si el banco te dio un préstamo sobre esta tarjeta que llevas por separado en Cuentas.</div>
                    <div className="cat-grid">
                      {deudas.map((d) => (
                        <div key={d.id} className={`cat-choice ${locForm.prestamoId === d.id ? 'selected' : ''}`} onClick={() => setLocForm((f) => ({ ...f, prestamoId: f.prestamoId === d.id ? '' : d.id }))}>
                          <Icon name="Landmark" size={15} />
                          <span className="cat-choice-label">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            <div className="field-label">{locForm.tipo === 'tarjeta' && locForm.esCredito ? 'Gastado en el ciclo actual' : 'Monto actual'}</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={locForm.monto} onChange={(e) => setLocForm((f) => ({ ...f, monto: formatAmountTyping(e.target.value) }))} /></div>
            {locError && <div className="form-error">{locError}</div>}
            <button className="save-btn" onClick={submitLocation}><Icon name="Check" size={16} /> Guardar ubicación</button>
          </div>
        </div>
      )}

      {sheet?.type === 'edit-location' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">Actualizar {sheet.location.tipo === 'tarjeta' ? 'tarjeta' : 'monedero'}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12 }}>{sheet.location.persona} · {sheet.location.tipo === 'tarjeta' ? (sheet.location.nombre || 'Tarjeta') : 'Monedero'}</div>
            {sheet.location.tipo === 'tarjeta' && (
              <>
                <div className="field-label">Nombre del banco o cuenta</div>
                <input className="text-input" value={editLocForm.nombre} onChange={(e) => setEditLocForm((f) => ({ ...f, nombre: e.target.value }))} />
                <div className="field-label">CLABE interbancaria (opcional)</div>
                <input
                  className="text-input"
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="18 dígitos"
                  value={editLocForm.clabe}
                  onChange={(e) => setEditLocForm((f) => ({ ...f, clabe: e.target.value.replace(/\D/g, '').slice(0, 18) }))}
                />
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-6px 0 12px' }}>
                  {getBankInfo(editLocForm) ? `Banco identificado: ${getBankInfo(editLocForm).name}.` : 'Escribe el nombre de tu banco o captura tu CLABE para identificarlo automáticamente.'}
                </div>
                <div className="field-label">Número de tarjeta (opcional)</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-2px 0 6px' }}>Solo para detectar la red (Visa/Mastercard/Amex) y los últimos 4 dígitos; no se guarda el número completo.</div>
                <input
                  className="text-input"
                  inputMode="numeric"
                  maxLength={19}
                  placeholder="•••• •••• •••• ••••"
                  value={formatCardNumberTyping(editLocCardNumber)}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
                    setEditLocCardNumber(digits);
                    const net = detectCardNetwork(digits);
                    setEditLocForm((f) => ({ ...f, ultimos4: digits.length >= 4 ? digits.slice(-4) : f.ultimos4, red: net || f.red }));
                  }}
                />
                {editLocCardNumber.length >= 2 && (
                  <div style={{ fontSize: 11, color: detectCardNetwork(editLocCardNumber) ? 'var(--income)' : 'var(--ink-soft)', margin: '-6px 0 12px' }}>
                    {detectCardNetwork(editLocCardNumber) ? `Red detectada: ${detectCardNetwork(editLocCardNumber)}.` : 'No se reconoce la red con estos dígitos.'}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div className="field-label">Últimos 4 dígitos (opcional)</div>
                    <input className="text-input" inputMode="numeric" maxLength={4} placeholder="Ej. 0102" value={editLocForm.ultimos4} onChange={(e) => setEditLocForm((f) => ({ ...f, ultimos4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="field-label">Red (opcional)</div>
                    <select className="text-input" value={editLocForm.red} onChange={(e) => setEditLocForm((f) => ({ ...f, red: e.target.value }))}>
                      <option value="">Auto</option>
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="American Express">Amex</option>
                    </select>
                  </div>
                </div>
                <div className="field-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 0 14px' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>¿Es tarjeta de crédito?</span>
                  <div className={`switch ${editLocForm.esCredito ? 'on' : ''}`} onClick={() => setEditLocForm((f) => ({ ...f, esCredito: !f.esCredito }))} />
                </div>
              </>
            )}
            {sheet.location.tipo === 'tarjeta' && editLocForm.esCredito && (
              <>
                <div className="field-label">Límite de crédito</div>
                <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={editLocForm.limite} onChange={(e) => setEditLocForm((f) => ({ ...f, limite: formatAmountTyping(e.target.value) }))} /></div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div className="field-label">Día de corte</div>
                    <input className="text-input" type="number" min="1" max="31" placeholder="Ej. 18" value={editLocForm.diaCorte} onChange={(e) => setEditLocForm((f) => ({ ...f, diaCorte: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="field-label">Día de pago</div>
                    <input className="text-input" type="number" min="1" max="31" placeholder="Ej. 6" value={editLocForm.diaPago} onChange={(e) => setEditLocForm((f) => ({ ...f, diaPago: e.target.value }))} />
                  </div>
                </div>
                <div className="field-label">Monto a pagar (opcional)</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-2px 0 6px' }}>Lo que te pide tu estado de cuenta este ciclo.</div>
                <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={editLocForm.montoAPagar} onChange={(e) => setEditLocForm((f) => ({ ...f, montoAPagar: formatAmountTyping(e.target.value) }))} /></div>
                {deudas.length > 0 && (
                  <>
                    <div className="field-label" style={{ marginTop: 12 }}>¿Esta tarjeta está ligada a un préstamo? (opcional)</div>
                    <div className="cat-grid">
                      {deudas.map((d) => (
                        <div key={d.id} className={`cat-choice ${editLocForm.prestamoId === d.id ? 'selected' : ''}`} onClick={() => setEditLocForm((f) => ({ ...f, prestamoId: f.prestamoId === d.id ? '' : d.id }))}>
                          <Icon name="Landmark" size={15} />
                          <span className="cat-choice-label">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            <div className="field-label">{sheet.location.tipo === 'tarjeta' && editLocForm.esCredito ? 'Gastado en el ciclo actual' : 'Monto actual'}</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={editLocForm.monto} onChange={(e) => setEditLocForm((f) => ({ ...f, monto: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            {editLocError && <div className="form-error">{editLocError}</div>}
            <button className="save-btn" onClick={submitEditLocation}><Icon name="Check" size={16} /> Actualizar monto</button>
          </div>
        </div>
      )}

      {sheet?.type === 'conciliacion' && (() => {
        const validRows = conciliacionRows.filter((r) => !r.invalid);
        const matched = validRows.filter((r) => r.matched);
        const unmatched = validRows.filter((r) => !r.matched);
        const invalidCount = conciliacionRows.length - validRows.length;
        return (
          <div className="sheet-backdrop" onClick={() => setSheet(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-header"><span className="sheet-title">Conciliar con mi banco</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 10px' }}>
                Pega aquí los movimientos de tu estado de cuenta o app del banco, uno por línea, así: <b>AAAA-MM-DD | monto | concepto</b>. Ejemplo: <code style={{ fontSize: 10.5 }}>2026-07-14 | -700.00 | Pago tarjeta</code>. Usa monto negativo para cargos/gastos y positivo para depósitos/ingresos.
              </div>
              <textarea
                className="text-input"
                style={{ minHeight: 110, resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.5 }}
                placeholder={'2026-07-14 | -700.00 | Pago tarjeta\n2026-07-12 | 2703.32 | Depósito nómina'}
                value={conciliaRaw}
                onChange={(e) => setConciliaRaw(e.target.value)}
              />
              {conciliacionRows.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: 8, margin: '14px 0 12px' }}>
                    <span className="pend done" style={{ padding: '5px 10px' }}><Icon name="Check" size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{matched.length} ya registrado{matched.length !== 1 ? 's' : ''}</span>
                    <span className="pend" style={{ padding: '5px 10px' }}>{unmatched.length} faltante{unmatched.length !== 1 ? 's' : ''}</span>
                    {invalidCount > 0 && <span className="pend" style={{ padding: '5px 10px', opacity: 0.7 }}>{invalidCount} línea{invalidCount !== 1 ? 's' : ''} sin leer</span>}
                  </div>
                  {unmatched.length > 0 && (
                    <>
                      <div className="field-label">Movimientos no registrados</div>
                      {unmatched.map((row, i) => (
                        <div className="tx-row" key={i} style={{ cursor: 'default' }}>
                          <div className="tx-icon" style={{ background: row.amount < 0 ? 'var(--expense)' : 'var(--income)' }}><Icon name={row.amount < 0 ? 'ArrowDownRight' : 'ArrowUpRight'} size={16} /></div>
                          <div className="tx-mid">
                            <div className="tx-cat">{row.concepto}</div>
                            <div className="tx-note">{row.date} · {fmt(Math.abs(row.amount))}</div>
                          </div>
                          <button className="mini-abonar" onClick={() => openAddTxFromConcilia(row)}>Agregar</button>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {sheet?.type === 'traspaso' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">Traspaso entre cuentas</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
              Mueve dinero entre tus propias ubicaciones (ej. te llega dinero a tu tarjeta/banco y retiras a efectivo). No suma ni resta a tus ingresos o gastos: una cuenta baja y la otra sube por el mismo monto.
            </div>
            <div className="field-label">Monto *</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={traspasoForm.amount} onChange={(e) => setTraspasoForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-label">Sale de *</div>
            <div className="cat-grid">
              {moneyLocations.map((l) => (
                <div
                  key={l.id}
                  className={`cat-choice ${traspasoForm.fromId === l.id ? 'selected' : ''}`}
                  onClick={() => setTraspasoForm((f) => ({ ...f, fromId: f.fromId === l.id ? '' : l.id }))}
                >
                  <div className="cat-choice-icon" style={{ background: l.tipo === 'tarjeta' ? '#3E6EA5' : '#5F8A4C' }}><Icon name={l.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={15} /></div>
                  <span className="cat-choice-label">{l.persona} · {l.tipo === 'tarjeta' ? (l.nombre || 'Banco') : 'Monedero'}</span>
                </div>
              ))}
            </div>
            <div className="field-label">Entra a *</div>
            <div className="cat-grid">
              {moneyLocations.filter((l) => l.id !== traspasoForm.fromId).map((l) => (
                <div
                  key={l.id}
                  className={`cat-choice ${traspasoForm.toId === l.id ? 'selected' : ''}`}
                  onClick={() => setTraspasoForm((f) => ({ ...f, toId: f.toId === l.id ? '' : l.id }))}
                >
                  <div className="cat-choice-icon" style={{ background: l.tipo === 'tarjeta' ? '#3E6EA5' : '#5F8A4C' }}><Icon name={l.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={15} /></div>
                  <span className="cat-choice-label">{l.persona} · {l.tipo === 'tarjeta' ? (l.nombre || 'Banco') : 'Monedero'}</span>
                </div>
              ))}
            </div>
            <div className="field-label">Nota (opcional)</div>
            <input className="text-input" type="text" placeholder="Ej. Retiro de cajero, depósito..." value={traspasoForm.note} onChange={(e) => setTraspasoForm((f) => ({ ...f, note: e.target.value }))} />
            <div className="field-label">Fecha *</div>
            <input className="text-input" type="date" value={traspasoForm.date} onChange={(e) => setTraspasoForm((f) => ({ ...f, date: e.target.value }))} />
            {traspasoError && <div className="form-error">{traspasoError}</div>}
            <button className="save-btn" onClick={submitTraspaso}><Icon name="Check" size={16} /> Guardar traspaso</button>
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
            <div className="field-label">¿Quién tiene este dinero? *</div>
            {familia.length > 0 ? (
              <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {familia.map((m) => (
                  <div key={m} className={`cat-choice ${moveForm.persona === m ? 'selected' : ''}`} onClick={() => setMoveForm((f) => ({ ...f, persona: m, locationId: '' }))}>
                    <div className="mini-avatar" style={{ background: colorForName(m) }}>{m.charAt(0).toUpperCase()}</div>
                    <span className="cat-choice-label">{m}</span>
                  </div>
                ))}
              </div>
            ) : (
              <input className="text-input" placeholder="Ej. Mamá, Papá..." value={moveForm.persona} onChange={(e) => setMoveForm((f) => ({ ...f, persona: e.target.value, locationId: '' }))} />
            )}
            <div className="field-label">{moveForm.kind === 'deposito' ? '¿De qué cuenta sale? *' : '¿A qué cuenta regresa? *'}</div>
            {moneyLocations.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>Primero registra una tarjeta o monedero en la pestaña Tarjetas.</div>
            ) : (
              <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {moneyLocations.filter((l) => !moveForm.persona || l.persona === moveForm.persona).map((l) => (
                  <div key={l.id} className={`cat-choice ${moveForm.locationId === l.id ? 'selected' : ''}`} onClick={() => setMoveForm((f) => ({ ...f, locationId: l.id }))}>
                    <Icon name={l.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={16} />
                    <span className="cat-choice-label">{l.persona} · {l.tipo === 'tarjeta' ? (l.nombre || 'Tarjeta') : 'Monedero'}</span>
                  </div>
                ))}
              </div>
            )}
            {moveForm.kind === 'deposito' && (
              <>
                <div className="field-label">¿De qué cuenta se tomó ese dinero? *</div>
                {moneyLocations.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>Primero registra una tarjeta o monedero en la pestaña Tarjetas.</div>
                ) : (
                  <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                    {moneyLocations.filter((l) => l.id !== moveForm.locationId).map((l) => (
                      <div key={l.id} className={`cat-choice ${moveForm.origen === l.id ? 'selected' : ''}`} onClick={() => setMoveForm((f) => ({ ...f, origen: f.origen === l.id ? '' : l.id }))}>
                        <Icon name={l.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={16} />
                        <span className="cat-choice-label">{l.persona} · {l.tipo === 'tarjeta' ? (l.nombre || 'Tarjeta') : 'Monedero'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="field-label">Fecha</div>
            <input className="text-input" type="date" value={moveForm.date} onChange={(e) => setMoveForm((f) => ({ ...f, date: e.target.value }))} />
            {moveError && <div className="form-error">{moveError}</div>}
            <button
              className="save-btn"
              disabled={!(toNumber(moveForm.amount) > 0 && moveForm.persona.trim() && moveForm.locationId && (moveForm.kind === 'retiro' || moveForm.origen))}
              onClick={submitMove}
            ><Icon name="Check" size={16} /> Confirmar</button>
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
            <button className="danger-btn neutral" onClick={() => { setSettingsOpen(false); setSheet({ type: 'catalogo-cuentas' }); }}>
              <Icon name="List" size={14} /> Catálogo de cuentas contables
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
      {sheet?.type === 'catalogo-cuentas' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">Catálogo de cuentas contables</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 14px' }}>
              Todas las cuentas contables que Libro·Diario ya usa para clasificar tus movimientos, agrupadas como un catálogo contable normal.
            </div>
            {Object.entries(
              CATALOGO_COMPLETO.reduce((acc, c) => { (acc[c.grupo] = acc[c.grupo] || []).push(c); return acc; }, {})
            ).map(([grupo, cuentas]) => (
              <div key={grupo} style={{ marginBottom: 16 }}>
                <div className="er-group-title" style={{ color: 'var(--ink-soft)' }}>{grupo}</div>
                {cuentas.map((c) => (
                  <div className="er-row" key={c.codigo + c.nombre} style={{ alignItems: 'flex-start' }}>
                    <span className="er-cuenta">
                      <span className="er-codigo">{c.codigo}</span> {c.nombre}
                      {c.nota && <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 1 }}>{c.nota}</div>}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {onboarding && !familyCode && (
        <div className="sheet-backdrop">
          <div className="sheet">
            {codeStep === 'choose' && (
              <>
                <div className="sheet-header"><span className="sheet-title">Bienvenido a Libro·Diario</span></div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 18, lineHeight: 1.5 }}>
                  Este libro se comparte con tu familia usando un código: todos deben usar exactamente el mismo. ¿Cuál es tu caso?
                </div>
                <button className="onboard-option" onClick={() => { setCodeInput(''); setCodeError(''); setCodeStep('enter'); }}>
                  <div className="onboard-option-icon" style={{ background: '#3E6EA5' }}><Icon name="CheckCircle2" size={20} color="#fff" /></div>
                  <div className="onboard-option-text">
                    <div className="onboard-option-title">Ya tengo un código</div>
                    <div className="onboard-option-sub">Alguien de mi familia ya me lo compartió</div>
                  </div>
                </button>
                <button className="onboard-option" onClick={() => { const c = generateCode(); setCodeInput(c); setCodeError(''); setCodeStep('created'); }}>
                  <div className="onboard-option-icon" style={{ background: 'var(--green)' }}><Icon name="Plus" size={20} color="#fff" /></div>
                  <div className="onboard-option-text">
                    <div className="onboard-option-title">Soy el primero en entrar</div>
                    <div className="onboard-option-sub">Genera un código nuevo para compartir con tu familia</div>
                  </div>
                </button>
              </>
            )}

            {codeStep === 'enter' && (
              <>
                <div className="sheet-header">
                  <span className="sheet-title">Escribe tu código</span>
                  <button className="onboard-back" onClick={() => { setCodeStep('choose'); setCodeError(''); }}>‹ Atrás</button>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.5 }}>
                  Pídeselo a quien te invitó y escríbelo tal cual — debe quedar exactamente igual, sin espacios.
                </div>
                <div className="field-label">Código de familia</div>
                <input
                  className="text-input"
                  style={{ fontFamily: 'var(--mono)', fontSize: 17, textAlign: 'center', letterSpacing: 1 }}
                  placeholder="a3f9k2m8x1"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  autoCapitalize="none" autoCorrect="off" autoFocus
                />
                {codeError && <div className="form-error">{codeError}</div>}
                <button className="save-btn" disabled={!codeInput.trim()} onClick={() => activateFamilyCode(codeInput)}><Icon name="Check" size={16} /> Entrar con este código</button>
              </>
            )}

            {codeStep === 'created' && (
              <>
                <div className="sheet-header">
                  <span className="sheet-title">¡Tu código está listo!</span>
                  <button className="onboard-back" onClick={() => { setCodeStep('choose'); setCodeError(''); }}>‹ Atrás</button>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.5 }}>
                  Compártelo con tu familia — todos deben escribir exactamente este mismo código para ver la misma información.
                </div>
                <div className="code-display"><div className="code-display-value">{codeInput}</div></div>
                <button
                  className="save-btn"
                  style={{ background: '#25D366' }}
                  onClick={() => {
                    const msg = `*LIBRO DIARIO*\nhttps://21kumul.github.io/libro-diario/?codigo=${codeInput}\n🏦 Únete a mi Libro·Diario.`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                ><Icon name="Share2" size={16} /> Compartir por WhatsApp</button>
                <button className="save-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)', border: '1px solid var(--line)' }} onClick={() => activateFamilyCode(codeInput)}>
                  <Icon name="Check" size={16} /> Continuar sin compartir todavía
                </button>
              </>
            )}
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
