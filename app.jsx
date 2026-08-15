const { useState, useEffect, useMemo, useCallback, useRef } = React;

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
// Mismos colores pero aclarados para que se puedan leer sobre el fondo
// oscuro del modo noche (los de arriba son oscuros a propósito para verse
// bien sobre el fondo claro, y por eso casi desaparecían en modo oscuro).
const TAB_COLORS_DARK = {
  resumen: '#8FD9B6',
  movimientos: '#8AB4E8',
  compromisos: '#E8C56B',
  tarjetas: '#7FC4E0',
  ahorro: '#D6A8F0',
  graficas: '#E8A183',
};

const INGRESO_CATS = [
  { id: 'servicio', label: 'Ventas', icon: 'ShoppingBag', color: '#2F7D5C' },
  { id: 'nomina', label: 'Sueldo', icon: 'Banknote', color: '#3E8E7E' },
  { id: 'cobranza', label: 'Cobranza', icon: 'Wallet', color: '#5AA98C' },
  { id: 'comision', label: 'Comisiones', icon: 'BarChart3', color: '#79B597' },
  { id: 'otros_ing', label: 'Otros', icon: 'PlusCircle', color: '#8FC1A9' },
];

const CAT_ICON_CHOICES = ['ShoppingBag', 'Home', 'Zap', 'Motorbike', 'Utensils', 'HeartPulse', 'Landmark', 'CreditCard', 'Package', 'Truck', 'PiggyBank', 'Banknote', 'Sparkles', 'Bell', 'Wallet', 'Users', 'Calculator', 'BarChart3', 'MoreHorizontal', 'RefreshCw'];
const CAT_COLOR_CHOICES = ['#2F7D5C', '#B0432E', '#C29B3E', '#3E6EA5', '#8A4FA0', '#5A8F3C', '#A85338', '#4E8A93', '#C15B72', '#8C6BA6', '#5F8A4C', '#7A4E3A'];

const GASTO_CATS = [
  { id: 'renta', label: 'Renta', icon: 'Home', color: '#B0432E' },
  { id: 'servicios', label: 'Servicios', icon: 'Zap', color: '#C9A227' },
  { id: 'transporte', label: 'Transporte', icon: 'Motorbike', color: '#8C6239' },
  { id: 'comida', label: 'Comida', icon: 'Utensils', color: '#D17A4A' },
  { id: 'despensa', label: 'Despensa', icon: 'ShoppingBag', color: '#5F8A4C' },
  { id: 'salud', label: 'Salud', icon: 'HeartPulse', color: '#C15B72' },
  { id: 'banco', label: 'Banco', icon: 'Landmark', color: '#3E6EA5' },
  { id: 'deudas', label: 'Préstamos', icon: 'CreditCard', color: '#7A4E3A' },
  { id: 'tienda_dep', label: 'Tienda departamental', icon: 'Package', color: '#8C6BA6' },
  { id: 'otros_gas', label: 'Otros', icon: 'MoreHorizontal', color: '#9C8672' },
];

// Categorías exclusivas para las cuentas de CxP (gastos fijos, ingresos fijos
// y préstamos): a partir de esta actualización, dar de alta una cuenta en CxP
// solo permite clasificarla en una de estas 4 (el resto de categorías de
// Gastos/Ingresos normales no aplican aquí).
const CXP_CATS = GASTO_CATS.filter((c) => ['banco', 'deudas', 'tienda_dep', 'otros_gas'].includes(c.id));
// Solo estas categorías de CxP permiten editar el monto/saldo a mano
// (ej. actualizar lo que dice el estado de cuenta del banco).
const CXP_EDITABLE_CATS = ['banco', 'deudas', 'tienda_dep', 'cobranza'];

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

// ---------- Leer PDF del banco (para "Conciliar con mi banco") ----------
// Muchos bancos (como Banamex) mandan el estado de cuenta como un PDF que en
// realidad es una imagen (no tiene texto que se pueda copiar/seleccionar),
// así que hace falta OCR (reconocimiento óptico) para leerlo. Cargamos las
// librerías necesarias solo cuando se usa esta función (no al abrir la app),
// para no hacerla más pesada de entrada.
const _loadedScripts = {};
const loadScriptOnce = (src) => {
  if (_loadedScripts[src]) return _loadedScripts[src];
  _loadedScripts[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar ' + src));
    document.body.appendChild(s);
  });
  return _loadedScripts[src];
};

const MESES_ABBR = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
const quitarAcentos = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Convierte el texto ya reconocido por OCR (todas las páginas juntas) en
// líneas con el mismo formato que ya entiende "Conciliar con mi banco":
// AAAA-MM-DD | ±monto | concepto
const ocrTextoALineasConcilia = (textoCompleto) => {
  // El PDF trae la fecha en la que se solicitó el reporte (ej. "25/07/2026"),
  // la usamos para saber a qué año pertenecen las fechas "DD Mon" de cada
  // movimiento (que no traen año). Si no la encuentra, usa el año actual.
  const fechaReporte = textoCompleto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const anioReporte = fechaReporte ? parseInt(fechaReporte[3], 10) : new Date().getFullYear();

  const lineaRegex = /(\d{1,2})\s+([A-Za-zÑñ]{3,4})\.?\s+(.+?)\s+([+\-]?\$?\s?\d[\d,]*\.\d{2})\s*$/;
  const salida = [];
  let sinLeer = 0;

  textoCompleto.split('\n').forEach((linea) => {
    const l = linea.trim();
    if (!l) return;
    const m = l.match(lineaRegex);
    if (!m) { if (/\d/.test(l) && /[A-Za-z]{3,}/.test(l)) sinLeer++; return; }
    const [, dia, mesTxt, conceptoRaw, montoTxt] = m;
    const mesKey = quitarAcentos(mesTxt.toLowerCase()).slice(0, 3);
    const mes = MESES_ABBR[mesKey];
    if (mes === undefined) { sinLeer++; return; }
    const fecha = `${anioReporte}-${String(mes + 1).padStart(2, '0')}-${String(parseInt(dia, 10)).padStart(2, '0')}`;
    const esIngreso = montoTxt.trim().startsWith('+');
    const monto = parseFloat(montoTxt.replace(/[^0-9.]/g, ''));
    if (isNaN(monto)) { sinLeer++; return; }
    const montoFinal = esIngreso ? monto : -monto;
    // Quita el "AUTHORIZED"/"AUTORIZADO" pegado al final del concepto, y
    // ruido que a veces mete el OCR al principio (como un "=" leído de la
    // rayita de la tabla), para que quede más legible.
    const concepto = conceptoRaw
      .replace(/AUTHORIZED$/i, '')
      .replace(/AUTORIZAD[OA]$/i, '')
      .replace(/^[^A-Za-zÀ-ÿ0-9]+/, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || '(sin concepto)';
    salida.push(`${fecha} | ${montoFinal.toFixed(2)} | ${concepto}`);
  });

  return { texto: salida.join('\n'), leidas: salida.length, sinLeer };
};

// Lee un archivo PDF (imagen escaneada) y devuelve el texto reconocido de
// todas sus páginas, usando pdf.js (para convertir cada página en una
// imagen) + Tesseract.js (OCR). Ambas se cargan de internet la primera vez
// que se usa esta función.
const leerPdfConOcr = async (file, onProgress) => {
  await loadScriptOnce('https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js');
  await loadScriptOnce('https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;

  let textoCompleto = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress && onProgress(`Leyendo página ${i} de ${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.2 }); // más escala = mejor OCR
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    const { data } = await window.Tesseract.recognize(canvas, 'spa');
    textoCompleto += '\n' + data.text;
  }
  return textoCompleto;
};

// A diferencia del PDF (que trae "día mes concepto monto" todo en una sola
// línea, como se ve arriba), en una captura de pantalla de una app de banco
// el concepto y el monto casi siempre quedan juntos en la misma línea (uno
// a la izquierda, el otro a la derecha de la pantalla), y la fecha aparece
// SOLA en la línea de abajo — a veces con una línea de referencia/estatus
// en medio (como en los movimientos de tarjeta: concepto+monto, luego
// "referencia Aprobada", luego la fecha). Este parser busca ese patrón.
const ocrCapturaALineasConcilia = (textoCompleto) => {
  const anioActual = new Date().getFullYear();
  const lineas = textoCompleto.split('\n').map((l) => l.trim()).filter(Boolean);

  const conceptoMontoRe = /^(.{3,60}?)\s+([+\-])?\$?\s?(\d[\d,]*\.\d{2})\s*$/;
  const diaMesRe = /^(\d{1,2})\s+([A-Za-zÑñ]{3,4})\.?\s*$/; // "20 Jul"
  const mesDiaRe = /^([A-Za-zÑñ]{3,4})\.?\s+(\d{1,2})\b/; // "Jul 18" (con o sin hora después)

  const parseFecha = (linea) => {
    let m = linea.match(diaMesRe);
    if (m) {
      const mesKey = quitarAcentos(m[2].toLowerCase()).slice(0, 3);
      const mes = MESES_ABBR[mesKey];
      if (mes !== undefined) return `${anioActual}-${String(mes + 1).padStart(2, '0')}-${String(parseInt(m[1], 10)).padStart(2, '0')}`;
    }
    m = linea.match(mesDiaRe);
    if (m) {
      const mesKey = quitarAcentos(m[1].toLowerCase()).slice(0, 3);
      const mes = MESES_ABBR[mesKey];
      if (mes !== undefined) return `${anioActual}-${String(mes + 1).padStart(2, '0')}-${String(parseInt(m[2], 10)).padStart(2, '0')}`;
    }
    return null;
  };

  const salida = [];
  let sinLeer = 0;

  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(conceptoMontoRe);
    if (!m) continue;
    const [, conceptoRaw, signo, montoTxt] = m;
    // La fecha vive en la línea siguiente, o dos líneas abajo si en medio hay
    // una línea de referencia/estatus (no otro concepto+monto).
    let fecha = i + 1 < lineas.length ? parseFecha(lineas[i + 1]) : null;
    if (!fecha && i + 2 < lineas.length && !conceptoMontoRe.test(lineas[i + 1])) {
      fecha = parseFecha(lineas[i + 2]);
    }
    // Si no hay fecha cerca, probablemente no era un movimiento real sino un
    // resumen (ej. "Ayer gastaste -$25.00"), así que se ignora sin contar
    // como error — evita duplicar el mismo gasto dos veces.
    if (!fecha) continue;

    const monto = parseFloat(montoTxt.replace(/,/g, ''));
    if (isNaN(monto)) { sinLeer++; continue; }
    let esIngreso;
    if (signo === '+') esIngreso = true;
    else if (signo === '-') esIngreso = false;
    else esIngreso = /dep[oó]sito|deposit|recib|abono a favor|reembolso|sueldo|n[oó]mina/i.test(conceptoRaw);
    const montoFinal = esIngreso ? monto : -monto;
    const concepto = conceptoRaw
      .replace(/^[a-zA-Z]{1,3}[)\]]\s*/, '') // basura típica de íconos mal leídos, ej. "is) " o "a] "
      .replace(/^[<>~^*_|]+\s*/, '') // flechas/símbolos mal reconocidos, ej. "<a "
      .replace(/^[a-z]\s+(?=[A-ZÀ-Ý])/, '') // letra suelta que quedó pegada de un ícono, ej. "a Depósito"
      .replace(/\s{2,}/g, ' ')
      .trim() || '(sin concepto)';
    salida.push(`${fecha} | ${montoFinal.toFixed(2)} | ${concepto}`);
  }

  return { texto: salida.join('\n'), leidas: salida.length, sinLeer };
};

// Un mismo archivo puede venir en cualquiera de los dos formatos (PDF de
// estado de cuenta vs. captura de pantalla), así que se prueban ambos
// lectores y nos quedamos con el que haya reconocido más movimientos.
const interpretarTextoBanco = (textoCompleto) => {
  const porLinea = ocrTextoALineasConcilia(textoCompleto);
  const porCaptura = ocrCapturaALineasConcilia(textoCompleto);
  return porCaptura.leidas >= porLinea.leidas ? porCaptura : porLinea;
};

// Adivina la categoría de un ticket de compra según palabras que suelen
// aparecer en el nombre del negocio (impreso arriba del ticket). Cubre las
// variantes más comunes: súper/tienda, gasolinera, comida, farmacia,
// servicios y renta. Si no reconoce nada, cae en "Otros" para que el usuario
// lo ajuste a mano.
const TICKET_CAT_KEYWORDS = [
  { cat: 'despensa', words: ['OXXO', 'SORIANA', 'WALMART', 'WAL-MART', 'WAL MART', 'COSTCO', 'CHEDRAUI', 'LA COMER', 'HEB', 'H-E-B', 'BODEGA AURRERA', 'AURRERA', 'SUPERAMA', 'MERCADO', '7-ELEVEN', 'SEVEN', 'CALIMAX', 'ABARROTES', 'MINISUPER', 'MINI SUPER'] },
  { cat: 'transporte', words: ['PEMEX', 'GASOLINERA', 'GASOLINA', 'ESTACION DE SERVICIO', 'SHELL', 'MOBIL', 'UBER', 'DIDI', 'CABIFY', 'ESTACIONAMIENTO', 'AUTOPISTA', 'CASETA', 'TAXI'] },
  { cat: 'comida', words: ['RESTAURANT', 'RESTAURANTE', 'CAFETERIA', 'CAFETERÍA', 'STARBUCKS', 'MCDONALD', 'MC DONALD', 'BURGER', 'DOMINOS', "DOMINO'S", 'PIZZA', 'TACOS', 'TORTAS', 'SUSHI', 'ANTOJITOS', 'COCINA ECONOMICA', 'FONDA'] },
  { cat: 'salud', words: ['FARMACIA', 'GUADALAJARA', 'SIMILARES', 'BENAVIDES', 'DEL AHORRO', 'HOSPITAL', 'CLINICA', 'CLÍNICA', 'CONSULTORIO', 'LABORATORIO', 'ANALISIS CLINICOS', 'DENTAL', 'OPTICA', 'ÓPTICA'] },
  { cat: 'servicios', words: ['CFE', 'TELMEX', 'TOTALPLAY', 'IZZI', 'NETFLIX', 'SPOTIFY', 'MEGACABLE', 'AT&T', 'TELCEL', 'MOVISTAR', 'AGUA POTABLE', 'GAS NATURAL', 'GAS LP'] },
  { cat: 'renta', words: ['RENTA MENSUAL', 'ARRENDAMIENTO', 'INMOBILIARIA'] },
];
// Líneas que casi nunca sirven como "concepto" de un ticket: razón social,
// domicilio fiscal, folios/IDs de la venta. Muy comunes en OXXO y tiendas de
// conveniencia, que imprimen esto ANTES del nombre de la sucursal o del
// producto — si no las filtramos, el concepto termina siendo puro texto
// legal ilegible en vez de algo útil.
const TICKET_BOILERPLATE_PATTERNS = [
  /S\.?\s*A\.?\s*DE\s*C\.?\s*V\.?/i, // "S.A. DE C.V."
  /CADENA COMERCIAL/i,
  /REGIMEN/i,
  /COLONIA/i,
  /C\.P\.\s*\d/i,
  /^RFC\b/i,
  /^FOL(IO)?[_\s]?VTA/i,
  /^ID\s*=/i,
];
// Un número con forma de dinero de verdad: SIEMPRE trae 2 decimales en
// tickets mexicanos (48.50, 1,234.00...). Un folio de venta, ID de
// transacción o número de afiliación es un entero pelón sin punto decimal,
// así que exigir el ".XX" evita confundirlos con el total — este era
// justo el bug con los tickets de OXXO, que imprimen el folio de venta en
// la MISMA línea que el total.
const MONEY_REGEX = /\$?\s?(\d{1,3}(?:,\d{3})*\.\d{2})/g;
const parseNum = (s) => parseFloat(s.replace(/,/g, ''));
const parseTicket = (text) => {
  const upper = text.toUpperCase();
  let category = 'otros_gas';
  for (const group of TICKET_CAT_KEYWORDS) {
    if (group.words.some((w) => upper.includes(w))) { category = group.cat; break; }
  }
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const isBoilerplate = (l) => TICKET_BOILERPLATE_PATTERNS.some((p) => p.test(l));
  const totalIdx = lines.findIndex((l) => /TOTAL/i.test(l) && !/SUBTOTAL/i.test(l));
  // Concepto: primero intenta encontrar la línea del producto comprado (la
  // que trae letras Y un precio, antes del total) — es lo más útil, ej.
  // "COCA COLA 3L    1    48.50". Si no hay una clara, usa el nombre de
  // sucursal/tienda (la primera línea con letras que no sea puro trámite
  // legal). Cualquiera de las dos es mejor que la razón social.
  const searchLines = totalIdx > 0 ? lines.slice(0, totalIdx + 1) : lines;
  const productLine = searchLines.find((l) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(l) && !isBoilerplate(l) && MONEY_REGEX.test(l));
  MONEY_REGEX.lastIndex = 0; // .test() con /g deja el regex "a medias"; hay que resetearlo antes de reusarlo
  const branchLine = lines.find((l) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(l) && !isBoilerplate(l));
  const note = (productLine || branchLine || '').replace(/\s{2,}/g, ' ').trim().slice(0, 40);
  let amount = 0;
  const totalLine = totalIdx >= 0 ? lines[totalIdx] : null;
  if (totalLine) {
    const found = [...totalLine.matchAll(MONEY_REGEX)].map((m) => parseNum(m[1])).filter((n) => !isNaN(n) && n > 0);
    if (found.length) amount = Math.max(...found);
  }
  if (!amount) {
    const found = [...text.matchAll(MONEY_REGEX)].map((m) => parseNum(m[1])).filter((n) => !isNaN(n) && n > 0 && n < 999999);
    if (found.length) amount = Math.max(...found);
  }
  let date = todayStr();
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dateMatch) {
    let [, d, m, y] = dateMatch;
    if (y.length === 2) y = '20' + y;
    const dd = String(d).padStart(2, '0'), mm = String(m).padStart(2, '0');
    if (+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31) date = `${y}-${mm}-${dd}`;
  }
  return { amount, category, note, date };
};


// directo con OCR. A diferencia del PDF, una imagen no necesita pdf.js para
// "convertirse" en imagen — ya lo es — así que se le pasa a Tesseract.js tal
// cual (se carga de internet la primera vez que se usa, igual que con PDF).
const leerImagenConOcr = async (file, onProgress) => {
  await loadScriptOnce('https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js');
  onProgress && onProgress('Leyendo imagen…');
  const { data } = await window.Tesseract.recognize(file, 'spa');
  return data.text;
};


const fmt = (n) => {
  return (n < 0 ? '-' : '') + Math.abs(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Los campos de "día del mes" (corte/pago de tarjeta, recordatorio de un
// gasto/ingreso fijo mensual) son recurrentes: no importa el mes/año, solo
// el número de día. Para poder elegirlos con un calendario (en vez de
// escribir el número a mano), mostramos ese día dentro del mes actual, y al
// elegir una fecha nos quedamos solo con el día.
const dayToDateInput = (day) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const maxDay = new Date(y, m + 1, 0).getDate();
  const d = day ? Math.min(maxDay, Math.max(1, parseInt(day, 10))) : now.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
const dateInputToDay = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts[2] ? String(parseInt(parts[2], 10)) : '';
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
// Días que faltan para la próxima vez que "toque" un gasto/ingreso fijo
// semanal o quincenal, contando de 7 en 7 (o de 14 en 14) a partir de la
// fecha de referencia que el usuario eligió (anchorDate). Si esa fecha
// todavía no llega, cuenta los días que faltan para llegar a ella.
const diasHastaRecurrencia = (anchorDate, everyDays) => {
  if (!anchorDate) return null;
  const [ay, am, ad] = anchorDate.split('-').map(Number);
  const anchor = new Date(ay, am - 1, ad);
  const hoy = new Date();
  const hoyLimpio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const diffDias = Math.round((hoyLimpio - anchor) / 86400000);
  if (diffDias < 0) return -diffDias;
  const resto = diffDias % everyDays;
  return resto === 0 ? 0 : everyDays - resto;
};
// Texto legible de la recurrencia de un gasto/ingreso fijo para mostrarlo en
// las tarjetas de Cuentas, incluyendo la próxima fecha cuando hay suficiente
// información (día del mes para mensual, o fecha de referencia para
// semanal/quincenal).
const recurrenceText = (c) => {
  const freq = c.recurFreq || 'mensual';
  if (freq === 'mensual') return c.notifyDay ? `Recordatorio el día ${c.notifyDay} de cada mes` : 'Mensual';
  if (freq === 'semanal' || freq === 'quincenal') {
    const label = freq === 'semanal' ? 'Cada semana' : 'Cada 2 semanas';
    if (!c.anchorDate) return label;
    const restantes = diasHastaRecurrencia(c.anchorDate, freq === 'semanal' ? 7 : 14);
    const cuando = restantes === 0 ? 'hoy' : restantes === 1 ? 'mañana' : `en ${restantes} días`;
    return `${label} · próximo ${cuando}`;
  }
  return 'Cada día';
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
// Identifica qué escribió el usuario en el campo único "Clave interbancaria
// o número de tarjeta" y qué se puede autocompletar con ello:
// - CLABE: siempre son exactamente 18 dígitos (estándar Banxico/ABM), así
//   que con esa longitud exacta identificamos el banco de forma confiable.
// - Número de tarjeta: 12-19 dígitos (cualquier longitud distinta de 18),
//   de ahí solo se puede derivar la red (Visa/Mastercard/Amex) de forma
//   confiable; el banco exacto no se puede inferir solo con esos dígitos.
const identifyByDigits = (digits) => {
  const d = digits || '';
  if (d.length === 18) return { tipo: 'clabe', bankName: getBankFromClabe(d), network: null };
  if (d.length >= 12 && d.length <= 19) return { tipo: 'card', bankName: null, network: detectCardNetwork(d) };
  return { tipo: null, bankName: null, network: null };
};
// Identifica el banco de una ubicación ya guardada: primero por CLABE (más
// confiable, no depende de cómo el usuario haya escrito el nombre), y si no
// hay CLABE o no se reconoce, cae al nombre que el usuario escribió a mano.
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
// Dado un periodo "YYYY-MM", regresa el siguiente. Sirve para recorrer, mes
// por mes, los periodos que un gasto/ingreso fijo pudo haberse saltado.
const nextPeriodKey = (pk, dir = 1) => {
  const [y, m] = pk.split('-').map(Number);
  const d = new Date(y, m - 1 + dir, 1); // m es 1-índice; -1 lo vuelve 0-índice antes de sumar la dirección
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const uid = () => Date.now() + Math.random();
// "YYYY-MM" -> "julio 2026", para mostrar a qué mes corresponde cada pago
// cuando se adelantan varios meses de un gasto fijo.
const periodLabel = (pk) => {
  const [y, m] = pk.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
};

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
  // Qué rebanada está "activa" (dedo encima o mouse encima): mientras lo
  // esté, el centro de la dona cambia de mostrar el total general a mostrar
  // el nombre y el monto exacto de esa categoría — así el dato aparece
  // siempre en el mismo lugar (el centro), no en un globito que salta a la
  // izquierda o se sale de la pantalla en el celular.
  const [active, setActive] = useState(null);
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
  const activeSeg = segments.find((s) => s.id === active);
  return (
    <svg viewBox="0 0 180 184" width="100%" height="100%" onClick={() => setActive(null)}>
      {segments.map((s) => (
        <path
          key={s.id}
          d={s.path}
          fill={s.color}
          opacity={active && active !== s.id ? 0.4 : 1}
          style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
          onMouseEnter={() => setActive(s.id)}
          onMouseLeave={() => setActive(null)}
          onClick={(e) => { e.stopPropagation(); setActive(active === s.id ? null : s.id); }}
        ><title>{`${s.name}: ${fmt(s.value)} (${s.pct}%)`}</title></path>
      ))}
      {segments.map((s) => s.showLabel && (
        <text key={`${s.id}-pct`} x={s.labelPt.x} y={s.labelPt.y} textAnchor="middle" dominantBaseline="middle" fontFamily="IBM Plex Sans" fontWeight="700" fontSize="11.5" fill="#FAF9F5" style={{ pointerEvents: 'none' }}>{s.pct}%</text>
      ))}
      {activeSeg ? (
        <>
          <text x={cx} y={cy - 6} textAnchor="middle" fontFamily="IBM Plex Sans" fontSize="10" fontWeight="600" style={{ fill: 'var(--ink-soft)', pointerEvents: 'none' }}>{activeSeg.name} · {activeSeg.pct}%</text>
          <text x={cx} y={cy + 13} textAnchor="middle" fontFamily="IBM Plex Mono" fontWeight="700" fontSize="14" style={{ fill: 'var(--ink)', pointerEvents: 'none' }}>{fmt(activeSeg.value)}</text>
        </>
      ) : (
        <>
          <text x={cx} y={cy - 6} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10.5" style={{ fill: 'var(--ink-soft)', pointerEvents: 'none' }}>{title}</text>
          <text x={cx} y={cy + 13} textAnchor="middle" fontFamily="IBM Plex Mono" fontWeight="700" fontSize="14" style={{ fill: 'var(--ink)', pointerEvents: 'none' }}>{fmt(total)}</text>
        </>
      )}
    </svg>
  );
}
function MonthlyBarChart({ data }) {
  // Igual que en la dona: al tocar/pasar el mouse por una barra aparece un
  // globito con el monto exacto, siempre centrado arriba de la gráfica (no
  // pegado a la izquierda ni fuera de la pantalla).
  const [activeInfo, setActiveInfo] = useState(null); // { label, value, color }
  const max = Math.max(1, ...data.flatMap((d) => [d.ingreso, d.gasto]));
  const W = 320, H = 168, padBottom = 20, padTop = 24, legendY = H + 14;
  const groupW = W / (data.length || 1);
  const barW = Math.min(14, groupW / 3.6);
  const tipText = activeInfo ? `${activeInfo.label}: ${fmt(activeInfo.value)}` : '';
  const tipW = Math.min(W - 8, tipText.length * 6.1 + 22);
  return (
    <svg viewBox={`0 0 ${W} ${legendY + 18}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" onClick={() => setActiveInfo(null)}>
      <rect x="0" y="0" width={W} height={legendY + 18} fill="transparent" />
      <line x1="0" y1={H - padBottom} x2={W} y2={H - padBottom} stroke="#DCD7C9" strokeWidth="1" />
      {data.map((d, i) => {
        const cx = groupW * i + groupW / 2;
        const hIn = ((H - padBottom - padTop) * d.ingreso) / max;
        const hGa = ((H - padBottom - padTop) * d.gasto) / max;
        const showIn = () => setActiveInfo({ label: `Ingresos ${d.label}`, value: d.ingreso });
        const showGa = () => setActiveInfo({ label: `Gastos ${d.label}`, value: d.gasto });
        return (
          <g key={d.key}>
            <rect x={cx - barW - 2} y={H - padBottom - hIn} width={barW} height={Math.max(0, hIn)} rx="2" fill="#2E7D5B" style={{ cursor: 'pointer' }} onMouseEnter={showIn} onMouseLeave={() => setActiveInfo(null)} onClick={(e) => { e.stopPropagation(); showIn(); }} />
            <rect x={cx + 2} y={H - padBottom - hGa} width={barW} height={Math.max(0, hGa)} rx="2" fill="#B0432E" style={{ cursor: 'pointer' }} onMouseEnter={showGa} onMouseLeave={() => setActiveInfo(null)} onClick={(e) => { e.stopPropagation(); showGa(); }} />
            <text x={cx} y={H - 5} textAnchor="middle" fontSize="10" fontFamily="IBM Plex Sans" fill="#6B6A62">{d.label}</text>
          </g>
        );
      })}
      {activeInfo && (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={W / 2 - tipW / 2} y={2} width={tipW} height={18} rx={9} fill="#1C1F1D" />
          <text x={W / 2} y={14.5} textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="IBM Plex Sans" fill="#FAF9F5">{tipText}</text>
        </g>
      )}
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

// Vista previa en vivo de una tarjeta mientras se llena el formulario de
// alta/edición: se actualiza con cada tecla (nombre, últimos 4 dígitos,
// banco/red detectados) y gira en 3D para mostrar el reverso mientras el
// usuario captura el número/CLABE, como una tarjeta física real.
function CardLivePreview({ nombre, ultimos4, esCredito, bankInfo, net, persona, gradient, flipped }) {
  const bg = bankInfo?.gradient || gradient || 'linear-gradient(135deg, #3a3a42, #55565f)';
  const last4 = ultimos4 || '';
  const groups = ['••••', '••••', '••••', last4 ? last4.padStart(4, '•') : '••••'];
  return (
    <div className="card-live-scene">
      <div className={`card-live-inner ${flipped ? 'flipped' : ''}`}>
        <div className="card-live-face card-live-front" style={{ background: bg }}>
          <div className="card-live-top">
            <div className="card-live-chip" />
            {net && /mastercard/i.test(net) ? (
              <div className="card-live-mc"><span className="card-live-mc-circle card-live-mc-a" /><span className="card-live-mc-circle card-live-mc-b" /></div>
            ) : net ? (
              <div className="card-live-network">{net}</div>
            ) : (
              <div className="card-live-brand">{esCredito ? 'Crédito' : 'Débito'}</div>
            )}
          </div>
          <div className="card-live-number">
            {groups.map((g, i) => <span key={i}>{g}</span>)}
          </div>
          <div className="card-live-bottom">
            <div>
              <div className="card-live-field-label">Titular</div>
              <div className="card-live-holder">{(nombre || persona || 'Nombre de la tarjeta').toUpperCase()}</div>
            </div>
            <div className="card-live-field-label" style={{ textAlign: 'right' }}>{esCredito ? 'CRÉDITO' : 'DÉBITO'}</div>
          </div>
        </div>
        <div className="card-live-face card-live-back" style={{ background: bg }}>
          <div className="card-live-stripe" />
          <div className="card-live-signature"><span>{last4 ? `•••• ${last4}` : '•••• ••••'}</span></div>
          <div className="card-live-back-hint">{bankInfo?.name || 'Tarjeta'}</div>
        </div>
      </div>
    </div>
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
  const [customCategories, setCustomCategories] = useState([]); // categorías extra creadas por la familia
  const [categoryMeta, setCategoryMeta] = useState({}); // { [catId]: { description, subItems: [] } } — aplica a categorías propias y a las de fábrica
  // Abre/cierra la "bolsa" de cada persona en la pila de tarjetas (estilo
  // billetera) de la pestaña Tarjetas: al tocarla, sus tarjetas se abanican
  // y se revela el saldo de esa persona (oculto por defecto, por privacidad).
  const [walletOpenMap, setWalletOpenMap] = useState({});
  // Id de la tarjeta que el cursor está sobrevolando dentro de una billetera
  // cerrada: hace que esa tarjeta se asome un poco de la bolsa como vista
  // previa (solo aplica con mouse/trackpad; en táctil no hay "hover").
  const [walletHoverId, setWalletHoverId] = useState(null);
  // Controla el giro 3D (flip) de la vista previa de tarjeta en los modales
  // de alta/edición, activado al capturar el número/CLABE de la tarjeta.
  const [cardPreviewFlippedNew, setCardPreviewFlippedNew] = useState(false);
  const [cardPreviewFlippedEdit, setCardPreviewFlippedEdit] = useState(false);
  const [budgets, setBudgets] = useState({}); // { [categoriaId]: montoMensual }
  const [budgetSavingsLinks, setBudgetSavingsLinks] = useState({}); // { [categoriaId]: idDeCuentaDeAhorro }
  const [profilePhotos, setProfilePhotos] = useState({}); // { [nombreDeFamilia]: dataURL de la foto }
  const [personPins, setPersonPins] = useState({}); // { [nombreDeFamilia]: PIN de 4 dígitos (opcional) }
  const moneyLocationsByPerson = useMemo(() => {
    const map = {};
    moneyLocations.forEach((l) => { (map[l.persona] = map[l.persona] || []).push(l); });
    return Object.entries(map);
  }, [moneyLocations]);
  const moneyLocationsTotal = moneyLocations.reduce((s, l) => s + (l.monto || 0), 0);
  const moneyLocationsDisponible = moneyLocations.filter((l) => !l.esCredito).reduce((s, l) => s + (l.monto || 0), 0);
  const moneyLocationsDeuda = moneyLocations.filter((l) => l.esCredito).reduce((s, l) => s + (l.monto || 0), 0);
  // Para elegir "¿de dónde sale este dinero?" en un gasto: solo cuentas con
  // dinero disponible. En débito/efectivo/monedero eso es monto > 0; en
  // tarjeta de crédito no aplica el mismo criterio (ahí lo que importa es no
  // estar sobregirada, es decir no haber superado el límite). Si se pasa
  // keepId, esa ubicación se conserva siempre (para no "perder" la cuenta ya
  // elegida al editar un movimiento aunque ya no tenga fondos).
  const moneyLocationsForGasto = (keepId) => {
    const withFunds = moneyLocations.filter((l) => {
      if (keepId && l.id === keepId) return true;
      if (l.esCredito) return !(l.limite && l.monto > l.limite + 0.01); // excluye sobregiradas
      return (l.monto || 0) > 0;
    });
    return withFunds.length ? withFunds : moneyLocations;
  };
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
  const [searchMonth, setSearchMonth] = useState(''); // 'YYYY-MM'; si está lleno, manda sobre el filtro Hoy/Semana/Mes/Todo de arriba
  const [conciliaRaw, setConciliaRaw] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketProgress, setTicketProgress] = useState('');
  const [ticketError, setTicketError] = useState('');
  const pdfInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  // Aspecto: preferencia de este celular (no se comparte con la familia).
  // 'light' | 'dark' | 'system' (system = sigue el ajuste del teléfono).
  const [appearance, setAppearance] = useState(() => {
    try { return localStorage.getItem('libroDiario:appearance') || 'system'; } catch (e) { return 'system'; }
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch (e) { return; }
    const onChange = (e) => setSystemPrefersDark(e.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange); };
  }, []);
  const darkMode = appearance === 'system' ? systemPrefersDark : appearance === 'dark';
  const tabColors = darkMode ? TAB_COLORS_DARK : TAB_COLORS;
  const chooseAppearance = (val) => {
    setAppearance(val);
    try { localStorage.setItem('libroDiario:appearance', val); } catch (e) { /* nada que guardar */ }
  };
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', darkMode ? '#121412' : '#1E3D32');
    // El fondo de <body> vive fuera de .ledger-app (no puede leer sus
    // variables de CSS), así que si no se actualiza aquí a mano, cuando el
    // celular hace "overscroll" se asoma un color equivocado (franja clara
    // en modo oscuro) en vez del fondo real de la app.
    document.body.style.background = darkMode ? '#121412' : '#EFEFF2';
  }, [darkMode]);
  const [tab, setTab] = useState('resumen');
  const NAV_TABS = [
    { key: 'resumen', label: 'Resumen', icon: 'LayoutGrid' },
    { key: 'movimientos', label: 'Movs.', icon: 'List' },
    { key: 'compromisos', label: 'Cuentas', icon: 'Landmark' },
    { key: 'ahorro', label: 'Ahorro', icon: 'PiggyBank' },
  ];
  // Pestañas "escondidas": no tienen su propio botón en la barra (para dejar
  // más espacio y que los íconos no se vean apretados), pero se llega a ellas
  // manteniendo presionada la pestaña "padre" de la que cuelgan.
  const HIDDEN_TABS = {
    resumen: { key: 'graficas', label: 'Ver gráficas', icon: 'BarChart3' },
    compromisos: { key: 'tarjetas', label: 'Ver tarjetas', icon: 'CreditCard' },
  };
  // Dado un tab actual (que puede ser uno "escondido"), regresa la key del
  // botón visible correspondiente en la barra — para resaltar el botón
  // correcto, calcular la posición de la burbuja, el swipe, etc.
  const parentOfTab = (t) => {
    const entry = Object.entries(HIDDEN_TABS).find(([, h]) => h.key === t);
    return entry ? entry[0] : t;
  };
  // Barra inferior "cristal": arriba de la página se ve a su tamaño completo;
  // al hacer scroll hacia abajo se vuelve compacta (se reduce, no desaparece),
  // y regresa a su tamaño completo al subir o al llegar al inicio.
  const [navCompact, setNavCompact] = useState(false);
  const contentRef = useRef(null);
  const ticketInputRef = useRef(null);
  const photoInputRef = useRef(null);
  // El panel verde se encoge de forma continua y proporcional a lo que
  // llevas scrolleado (no en un salto de golpe): se actualiza escribiendo
  // directo una variable CSS en el DOM (sin pasar por setState de React)
  // para que sea tan fluido como el propio scroll, sin ningún retraso.
  const mastheadRef = useRef(null);
  const handleContentScroll = useCallback((e) => {
    const st = e.currentTarget.scrollTop;
    setNavCompact(st > 40);
    if (mastheadRef.current) {
      const progress = Math.max(0, Math.min(1, st / 70));
      mastheadRef.current.style.setProperty('--collapse', progress);
    }
  }, []);
  // Deslizar (swipe) horizontal sobre el contenido para pasar entre pestañas,
  // como en apps tipo WhatsApp/Meta.
  const touchStartRef = useRef(null);
  const handleContentTouchStart = (e) => {
    // Si el toque empieza dentro de algo que YA tiene su propio scroll
    // horizontal (como la fila de chips de filtro), no lo tomamos como
    // gesto de "cambiar de pestaña": si no, competían entre sí y el swipe
    // sobre los chips terminaba cambiando de pestaña en vez de solo
    // deslizar los chips.
    if (e.target.closest && e.target.closest('.filter-row')) {
      touchStartRef.current = null;
      return;
    }
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };
  const handleContentTouchEnd = (e) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;
    if (dt > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const order = NAV_TABS.map((n) => n.key);
    const curIdx = order.indexOf(parentOfTab(tab));
    if (curIdx === -1) return;
    if (dx < 0 && curIdx < order.length - 1) goTab(order[curIdx + 1]);
    else if (dx > 0 && curIdx > 0) goTab(order[curIdx - 1]);
  };
  // Indicador "encendido" que se desliza suavemente hacia la pestaña activa.
  const navTabsRef = useRef(null);
  // La burbuja se posiciona en % del ancho del contenedor (no en píxeles
  // medidos con JS). Así, cuando la barra se compacta/expande con el scroll,
  // la burbuja se mueve exactamente en el mismo instante y con la misma
  // curva que los botones (porque ambos son proporcionales al mismo
  // contenedor) — sin rebotes ni desincronía, y sin tener que re-medir nada.
  const navIndex = (key) => Math.max(0, NAV_TABS.findIndex((n) => n.key === parentOfTab(key)));
  const NAV_COUNT = NAV_TABS.length + 1; // los 4 tabs + el "+" al final, todos deslizables como una sola barra
  const navPct = 100 / NAV_COUNT;
  // Arrastre en vivo sobre la barra (como Instagram/Meta): al deslizar el
  // dedo sin soltarlo por encima de los íconos, la burbuja sigue la posición
  // exacta del dedo (en píxeles, de forma continua) para que se vea como una
  // sola pieza deslizándose, no como saltos entre pestañas. El "+" cuenta
  // como un quinto destino más dentro de este mismo arrastre.
  const [dragTabKey, setDragTabKey] = useState(null);
  const [dragLeftPx, setDragLeftPx] = useState(null);
  const navDragStartKey = useRef(null);
  const navDragRect = useRef(null);
  const handleNavTouchStart = (e) => {
    const wrap = navTabsRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const btnWidth = rect.width / NAV_COUNT;
    navDragRect.current = { left: rect.left, width: rect.width, btnWidth };
    const t = e.touches[0];
    const x = Math.max(0, Math.min(rect.width - btnWidth, t.clientX - rect.left - btnWidth / 2));
    const idx = Math.min(NAV_COUNT - 1, Math.max(0, Math.round(x / btnWidth)));
    const key = idx < NAV_TABS.length ? NAV_TABS[idx].key : '__fab__';
    navDragStartKey.current = key;
    setDragTabKey(key);
    setDragLeftPx(x);
  };
  const handleNavTouchMove = (e) => {
    const r = navDragRect.current;
    if (!r || !navDragStartKey.current) return;
    const t = e.touches[0];
    const x = Math.max(0, Math.min(r.width - r.btnWidth, t.clientX - r.left - r.btnWidth / 2));
    setDragLeftPx(x);
    const idx = Math.min(NAV_COUNT - 1, Math.max(0, Math.round(x / r.btnWidth)));
    const key = idx < NAV_TABS.length ? NAV_TABS[idx].key : '__fab__';
    if (key !== dragTabKey) {
      cancelLongPress();
      if (navigator.vibrate) navigator.vibrate(4);
      setDragTabKey(key);
    }
  };
  const handleNavTouchEnd = () => {
    if (dragTabKey && dragTabKey !== navDragStartKey.current) {
      if (dragTabKey === '__fab__') fabAction(); else goTab(dragTabKey);
    }
    navDragStartKey.current = null;
    navDragRect.current = null;
    setDragTabKey(null);
    setDragLeftPx(null);
  };
  const goTab = (t) => {
    setTab(t);
    setNavCompact(false);
    if (contentRef.current) contentRef.current.scrollTop = 0;
    if (mastheadRef.current) mastheadRef.current.style.setProperty('--collapse', 0);
    setHiddenPopoverFor(null);
  };
  // Mantén presionada una pestaña con hijo escondido (ver HIDDEN_TABS) para
  // revelar el acceso a esa vista extra, sin que ocupe su propio botón en
  // la barra — así los íconos y el texto se quedan a buen tamaño y no se
  // sienten apretados.
  const [hiddenPopoverFor, setHiddenPopoverFor] = useState(null);
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);
  const startLongPress = (parentKey) => (e) => {
    if (e.cancelable) e.preventDefault();
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (navigator.vibrate) navigator.vibrate(8);
      setHiddenPopoverFor(parentKey);
    }, 420);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };
  const handleParentTap = (parentKey) => () => {
    if (longPressFired.current) { longPressFired.current = false; return; }
    goTab(parentKey);
  };
  const [period, setPeriod] = useState('mes');
  // Mes seleccionado para las gráficas de la pestaña Gráficas ("YYYY-MM").
  // Es independiente del filtro Hoy/Semana/Mes/Todo de arriba: aquí siempre
  // se elige un mes calendario puntual para poder comparar meses pasados.
  const [chartMonth, setChartMonth] = useState(currentPeriodKey);
  const [sheet, setSheet] = useState(null); // {type, ...}
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetDragging = useRef(false);
  const sheetDragStartY = useRef(0);
  const handleSheetTouchStart = (e) => {
    sheetDragging.current = true;
    sheetDragStartY.current = e.touches[0].clientY;
  };
  const handleSheetTouchMove = (e) => {
    if (!sheetDragging.current) return;
    const delta = e.touches[0].clientY - sheetDragStartY.current;
    if (delta > 0) setSheetDragY(delta);
  };
  const handleSheetTouchEnd = () => {
    if (!sheetDragging.current) return;
    sheetDragging.current = false;
    if (sheetDragY > 90) setSheet(null);
    setSheetDragY(0);
  };
  const sheetDragStyle = sheetDragY
    ? { transform: `translateY(${sheetDragY}px)`, transition: 'none' }
    : { transition: 'transform 0.2s ease' };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState(null); // null = menú principal | 'familia' | 'perfil' | 'datos'
  const [settingsDragY, setSettingsDragY] = useState(0);
  const settingsDragging = useRef(false);
  const settingsDragStartY = useRef(0);
  const handleSettingsTouchStart = (e) => {
    settingsDragging.current = true;
    settingsDragStartY.current = e.touches[0].clientY;
  };
  const handleSettingsTouchMove = (e) => {
    if (!settingsDragging.current) return;
    const delta = e.touches[0].clientY - settingsDragStartY.current;
    if (delta > 0) setSettingsDragY(delta);
  };
  const handleSettingsTouchEnd = () => {
    if (!settingsDragging.current) return;
    settingsDragging.current = false;
    if (settingsDragY > 90) setSettingsOpen(false);
    setSettingsDragY(0);
  };
  const settingsDragStyle = settingsDragY
    ? { transform: `translateY(${settingsDragY}px)`, transition: 'none' }
    : { transition: 'transform 0.2s ease' };
  const [saving, setSavingFlag] = useState(false);
  const [filterCat, setFilterCat] = useState('todas');
  const [filterTipo, setFilterTipo] = useState('todas');

  const [txForm, setTxForm] = useState({ type: 'gasto', amount: '', category: '', subcategory: '', servicio: '', persona: '', note: '', date: todayStr(), shared: false, participants: [], fijo: false, fijoTarget: 'new', fijoName: '', fijoNotifyDay: '', fijoAmount: '', locationId: '', links: [], linkAmounts: {}, linkParticipants: {} });
  const [txError, setTxError] = useState('');

  const [editTxForm, setEditTxForm] = useState({ id: null, type: 'gasto', amount: '', category: '', subcategory: '', note: '', date: todayStr(), locationId: '', shared: false, participants: [] });
  const [editTxError, setEditTxError] = useState('');

  const [editTraspasoForm, setEditTraspasoForm] = useState({ id: null, fromId: '', toId: '', amount: '', note: '', date: todayStr() });
  const [editTraspasoError, setEditTraspasoError] = useState('');

  const [compForm, setCompForm] = useState({ kind: 'deuda', name: '', category: 'deudas', amount: '', notifyDay: '', shared: false, participants: [], locationId: '' });
  const [msiForm, setMsiForm] = useState({ name: '', amount: '', months: '12' });
  const [notifPermission, setNotifPermission] = useState(
    (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'unsupported'
  );
  const [compError, setCompError] = useState('');

  const [editAmountForm, setEditAmountForm] = useState({ amount: '', note: '' });
  const [editAmountError, setEditAmountError] = useState('');

  const [editDateForm, setEditDateForm] = useState({ recurFreq: 'mensual', notifyDay: '', anchorDate: '' });
  const [editDateError, setEditDateError] = useState('');

  const [abonoForm, setAbonoForm] = useState({ amount: '', date: todayStr(), note: '', locationId: '' });
  const [abonoError, setAbonoError] = useState('');

  const [pagoLoteForm, setPagoLoteForm] = useState({ selectedIds: [], locationId: '', date: todayStr() });
  const [pagoLoteError, setPagoLoteError] = useState('');
  const [pagoLoteTab, setPagoLoteTab] = useState('varios');
  const [adelantoForm, setAdelantoForm] = useState({ compromisoId: '', meses: 3, locationId: '', date: todayStr() });
  const [adelantoError, setAdelantoError] = useState('');

  const [savForm, setSavForm] = useState({ name: '', target: '', locationId: '', category: '' });
  const [porCobrarAmount, setPorCobrarAmount] = useState('');
  const [txPickerOpen, setTxPickerOpen] = useState(null); // 'cat' | 'persona' | 'cuenta' | null
  const [catalogExpandedId, setCatalogExpandedId] = useState(null);
  const [subItemDraft, setSubItemDraft] = useState('');
  const [catLabelDraft, setCatLabelDraft] = useState('');
  const [newCatDraft, setNewCatDraft] = useState({ type: 'gasto', label: '', icon: 'ShoppingBag', color: '#5F8A4C' });
  const [newCatError, setNewCatError] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetSavingsChoices, setBudgetSavingsChoices] = useState([]);
  // Normaliza budgetSavingsLinks[catId], que en datos viejos guardaba un solo
  // id de cuenta como string; ahora siempre se maneja como arreglo para
  // poder vincular varias cuentas de ahorro (ej. AT&T + Internet) a la
  // misma categoría de presupuesto.
  const savingsLinksFor = (catId) => {
    const v = budgetSavingsLinks[catId];
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  };
  const [savError, setSavError] = useState('');

  const [moveForm, setMoveForm] = useState({ kind: 'deposito', amount: '', date: todayStr(), note: '', persona: '', locationId: '', origen: '' });
  const [moveError, setMoveError] = useState('');

  const [lastSync, setLastSync] = useState(null);

  // Trae lo último guardado por cualquier integrante de la familia (datos compartidos)
  const loadShared = useCallback(async () => {
    try {
      const [t, c, s, f, fn, ml, bg, pp, pn, bsl, cc, cm] = await Promise.allSettled([
        window.storage.get('transactions', true),
        window.storage.get('compromisos', true),
        window.storage.get('savings', true),
        window.storage.get('familia', true),
        window.storage.get('familyName', true),
        window.storage.get('moneyLocations', true),
        window.storage.get('budgets', true),
        window.storage.get('profilePhotos', true),
        window.storage.get('personPins', true),
        window.storage.get('budgetSavingsLinks', true),
        window.storage.get('customCategories', true),
        window.storage.get('categoryMeta', true),
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
      setBudgets(bg.status === 'fulfilled' && bg.value ? JSON.parse(bg.value.value) : {});
      setBudgetSavingsLinks(bsl.status === 'fulfilled' && bsl.value ? JSON.parse(bsl.value.value) : {});
      setCustomCategories(cc.status === 'fulfilled' && cc.value ? JSON.parse(cc.value.value) : []);
      setCategoryMeta(cm.status === 'fulfilled' && cm.value ? JSON.parse(cm.value.value) : {});
      setProfilePhotos(pp.status === 'fulfilled' && pp.value ? JSON.parse(pp.value.value) : {});
      setPersonPins(pn.status === 'fulfilled' && pn.value ? JSON.parse(pn.value.value) : {});
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

  // Refs que siempre reflejan lo último que ESTE celular tenía en pantalla.
  // Sirven de "base" para persist(): así se puede distinguir un dato que el
  // usuario borró a propósito de uno que simplemente todavía no había visto.
  const transactionsRef = useRef(transactions);
  const compromisosRef = useRef(compromisos);
  const savingsRef = useRef(savings);
  const moneyLocationsRef = useRef(moneyLocations);
  const budgetsRef = useRef(budgets);
  useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  useEffect(() => { compromisosRef.current = compromisos; }, [compromisos]);
  useEffect(() => { savingsRef.current = savings; }, [savings]);
  useEffect(() => { moneyLocationsRef.current = moneyLocations; }, [moneyLocations]);
  useEffect(() => { budgetsRef.current = budgets; }, [budgets]);

  // Antes de guardar un arreglo compartido, revisa si el servidor ya tiene
  // algo que este celular no conocía (agregado por otro familiar mientras
  // este celular no había vuelto a sincronizar) y lo conserva en vez de
  // pisarlo sin querer. Lo que este celular sí conocía y ya no está en lo
  // que va a guardar (porque el usuario lo borró o lo editó) se queda
  // fuera: eso sigue siendo una decisión válida de este celular.
  const mergeAndWrite = async (key, nextArr, baselineArr, setter, ref) => {
    let toSave = nextArr;
    try {
      const remote = await window.storage.get(key, true);
      const remoteArr = remote ? JSON.parse(remote.value) : [];
      const baselineIds = new Set((baselineArr || []).map((x) => x.id));
      const nextIds = new Set(nextArr.map((x) => x.id));
      const faltantes = remoteArr.filter((r) => r && r.id && !baselineIds.has(r.id) && !nextIds.has(r.id));
      if (faltantes.length) {
        toSave = [...nextArr, ...faltantes];
        setter(toSave);
        ref.current = toSave;
      }
    } catch (e) { /* sin internet: se guarda tal cual y se sincroniza después */ }
    return window.storage.set(key, JSON.stringify(toSave), true);
  };

  const persist = useCallback(async (patch) => {
    setSavingFlag(true);
    const baseline = {
      transactions: transactionsRef.current,
      compromisos: compromisosRef.current,
      savings: savingsRef.current,
      moneyLocations: moneyLocationsRef.current,
    };
    // Actualización local instantánea (optimista), como antes.
    if (patch.transactions) { setTransactions(patch.transactions); transactionsRef.current = patch.transactions; }
    if (patch.compromisos) { setCompromisos(patch.compromisos); compromisosRef.current = patch.compromisos; }
    if (patch.savings) { setSavings(patch.savings); savingsRef.current = patch.savings; }
    if (patch.moneyLocations) { setMoneyLocations(patch.moneyLocations); moneyLocationsRef.current = patch.moneyLocations; }
    if (patch.budgets) { setBudgets(patch.budgets); budgetsRef.current = patch.budgets; }
    if (patch.budgetSavingsLinks) setBudgetSavingsLinks(patch.budgetSavingsLinks);
    if (patch.customCategories) setCustomCategories(patch.customCategories);
    if (patch.categoryMeta) setCategoryMeta(patch.categoryMeta);
    if (patch.profilePhotos) setProfilePhotos(patch.profilePhotos);
    if (patch.personPins) setPersonPins(patch.personPins);
    if (patch.familia) setFamilia(patch.familia);
    if (patch.familyName !== undefined) setFamilyName(patch.familyName);
    try {
      const jobs = [];
      if (patch.transactions) jobs.push(mergeAndWrite('transactions', patch.transactions, baseline.transactions, setTransactions, transactionsRef));
      if (patch.compromisos) jobs.push(mergeAndWrite('compromisos', patch.compromisos, baseline.compromisos, setCompromisos, compromisosRef));
      if (patch.savings) jobs.push(mergeAndWrite('savings', patch.savings, baseline.savings, setSavings, savingsRef));
      if (patch.moneyLocations) jobs.push(mergeAndWrite('moneyLocations', patch.moneyLocations, baseline.moneyLocations, setMoneyLocations, moneyLocationsRef));
      if (patch.budgets) jobs.push(window.storage.set('budgets', JSON.stringify(patch.budgets), true));
      if (patch.budgetSavingsLinks) jobs.push(window.storage.set('budgetSavingsLinks', JSON.stringify(patch.budgetSavingsLinks), true));
      if (patch.customCategories) jobs.push(window.storage.set('customCategories', JSON.stringify(patch.customCategories), true));
      if (patch.categoryMeta) jobs.push(window.storage.set('categoryMeta', JSON.stringify(patch.categoryMeta), true));
      if (patch.profilePhotos) jobs.push(window.storage.set('profilePhotos', JSON.stringify(patch.profilePhotos), true));
      if (patch.personPins) jobs.push(window.storage.set('personPins', JSON.stringify(patch.personPins), true));
      if (patch.familia) jobs.push(window.storage.set('familia', JSON.stringify(patch.familia), true));
      if (patch.familyName !== undefined) jobs.push(window.storage.set('familyName', JSON.stringify(patch.familyName), true));
      await Promise.all(jobs);
    } catch (e) { /* local state still holds it for this session */ }
    setSavingFlag(false);
  }, []);

  // ---------- confirmación propia (reemplaza window.confirm) ----------
  // Pide confirmación con un sheet del mismo estilo de la app en vez del
  // cuadro nativo del navegador. onCancel es opcional (ej. para apagar un
  // "cargando..." si el usuario cancela).
  const askConfirm = (message, onConfirm, opts = {}) => {
    setSheet({ type: 'confirm', message, onConfirm, onCancel: opts.onCancel, danger: opts.danger !== false, confirmLabel: opts.confirmLabel || 'Eliminar' });
  };

  // ---------- deshacer (reemplaza los "no se puede deshacer") ----------
  // Guarda una foto de los 4 arreglos compartidos justo antes de que `fn` los
  // modifique, y la deja lista por unos segundos por si el usuario se
  // arrepiente. Deshacer = volver a guardar esa foto tal cual.
  const [undoInfo, setUndoInfo] = useState(null); // { message, snapshot }
  const undoTimeoutRef = useRef(null);
  const withUndo = (message, fn) => {
    const snapshot = {
      transactions: transactionsRef.current,
      moneyLocations: moneyLocationsRef.current,
      compromisos: compromisosRef.current,
      savings: savingsRef.current,
    };
    fn();
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => setUndoInfo(null), 6000);
    setUndoInfo({ message, snapshot });
  };
  const performUndo = () => {
    if (!undoInfo) return;
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    persist(undoInfo.snapshot);
    setUndoInfo(null);
  };


  const chooseProfile = async (name) => {
    const p = { name };
    setProfile(p);
    setOnboarding(false);
    try { await window.storage.set('miPerfil', JSON.stringify(p), false); } catch (e) { /* stays local this session */ }
  };

  // Si esa persona ya configuró un PIN, hay que pedirlo antes de dejar
  // entrar como ella — así cualquiera no puede simplemente tocar su nombre
  // y ya. No es seguridad bancaria (el PIN vive en el mismo lugar que el
  // resto de los datos compartidos), pero sí evita que alguien entre "sin
  // querer" o de broma a la cuenta de otro.
  const [pinPrompt, setPinPrompt] = useState(null); // { name, input, error }
  const requestChooseProfile = (name) => {
    if (personPins[name]) setPinPrompt({ name, input: '', error: '' });
    else chooseProfile(name);
  };
  const submitPinPrompt = () => {
    if (!pinPrompt) return;
    if (pinPrompt.input === personPins[pinPrompt.name]) {
      chooseProfile(pinPrompt.name);
      setPinPrompt(null);
    } else {
      setPinPrompt((p) => ({ ...p, error: 'PIN incorrecto.', input: '' }));
    }
  };

  const [pinSetup, setPinSetup] = useState(null); // { step: 'new'|'confirm', first: '', input: '', error: '' }
  const openPinSetup = () => setPinSetup({ step: 'new', first: '', input: '', error: '' });
  const submitPinSetupDigit = () => {
    if (!pinSetup) return;
    if (pinSetup.step === 'new') {
      if (pinSetup.input.length !== 4) return;
      setPinSetup({ step: 'confirm', first: pinSetup.input, input: '', error: '' });
    } else {
      if (pinSetup.input !== pinSetup.first) {
        setPinSetup({ step: 'new', first: '', input: '', error: 'No coincidió. Intenta de nuevo.' });
        return;
      }
      persist({ personPins: { ...personPins, [profile.name]: pinSetup.input } });
      setPinSetup(null);
    }
  };
  const removePin = () => {
    const next = { ...personPins };
    delete next[profile.name];
    persist({ personPins: next });
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
    const base = searchMonth ? transactions.filter((t) => periodKey(t.date) === searchMonth) : filtered;
    let list = filterCat === 'todas' ? base : base.filter((t) => t.category === filterCat);
    if (filterTipo !== 'todas') list = list.filter((t) => t.type === filterTipo);
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
  }, [filtered, filterCat, filterTipo, filterAutor, searchQuery, searchMonth, transactions]);

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
    setTxForm({ type, amount: formatAmountTyping(String(Math.abs(row.amount))), category: '', subcategory: '', servicio: '', persona: '', note: row.concepto || '', date: row.date, shared: false, participants: [], fijo: false, fijoTarget: 'new', fijoName: '', fijoNotifyDay: '', fijoAmount: '', locationId: '', links: [], linkAmounts: {}, linkParticipants: {} });
    setSheet({ type: 'add-tx' });
  };

  // Escanea la foto de un ticket de compra: reconoce el negocio (para
  // adivinar la categoría — súper, gasolinera, comida, farmacia, etc.), el
  // total, y la fecha si la encuentra. Deja todo precargado en el formulario
  // de "Nuevo movimiento" para que el usuario revise, ajuste si hace falta,
  // y elija con qué cuenta pagó antes de guardar — nunca se guarda solo.
  const handleTicketFile = async (file) => {
    setTicketBusy(true);
    setTicketError('');
    setTicketProgress('Leyendo ticket…');
    try {
      const texto = await leerImagenConOcr(file, setTicketProgress);
      const { amount, category, note, date } = parseTicket(texto);
      if (!amount) {
        setTicketError('No logré reconocer el total de este ticket. Puedes intentar de nuevo (con más luz o menos recorte) o llenar el monto a mano abajo.');
      }
      setTxForm((f) => ({
        ...f,
        type: 'gasto',
        amount: amount ? formatAmountTyping(String(amount)) : f.amount,
        category: category || f.category,
        subcategory: '',
        note: note || f.note,
        date,
      }));
    } catch (e) {
      setTicketError('No se pudo leer la foto: ' + (e.message || e) + '. Revisa tu conexión a internet (la primera vez necesita descargar el lector de OCR).');
    } finally {
      setTicketBusy(false);
      setTicketProgress('');
    }
  };

  // Lee un PDF de estado de cuenta o una imagen (captura de pantalla de la
  // app del banco) con OCR y agrega lo que reconoce al cuadro de "Conciliar
  // con mi banco", en el mismo formato que ya se usa ahí — así el resto de
  // la pantalla (qué ya está registrado / qué falta) sigue funcionando
  // exactamente igual sin importar de dónde vino el texto.
  const handleArchivoBanco = async (file) => {
    setPdfBusy(true);
    setPdfError('');
    setPdfProgress(file.type === 'application/pdf' ? 'Abriendo PDF…' : 'Abriendo imagen…');
    try {
      const textoOcr = file.type === 'application/pdf'
        ? await leerPdfConOcr(file, setPdfProgress)
        : await leerImagenConOcr(file, setPdfProgress);
      const { texto, leidas, sinLeer } = interpretarTextoBanco(textoOcr);
      if (!leidas) {
        setPdfError('No logré reconocer ningún movimiento aquí. Puedes intentar de nuevo (con más luz o menos recorte) o pegar los movimientos a mano abajo.');
      } else {
        setConciliaRaw((prev) => (prev.trim() ? prev.trim() + '\n' + texto : texto));
        if (sinLeer > 0) setPdfError(`Se agregaron ${leidas} movimiento${leidas !== 1 ? 's' : ''}. ${sinLeer} línea${sinLeer !== 1 ? 's' : ''} no se pudo${sinLeer !== 1 ? 'ieron' : ''} leer bien — revisa el texto de abajo por si falta algo.`);
      }
    } catch (e) {
      setPdfError('No se pudo leer el archivo: ' + (e.message || e) + '. Revisa tu conexión a internet (la primera vez necesita descargar el lector de PDF/OCR).');
    } finally {
      setPdfBusy(false);
      setPdfProgress('');
    }
  };

  const gastosPorCategoria = useMemo(() => {
    const map = {};
    filtered.filter((t) => t.type === 'gasto').forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).map(([id, value]) => ({ id, name: catById(id).label, value, color: catById(id).color }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // Gasto del MES EN CURSO por categoría, para comparar contra el presupuesto
  // (siempre mensual, sin importar qué periodo esté elegido en Gráficas).
  const gastoMesActualPorCategoria = useMemo(() => {
    const key = periodKey(todayStr());
    const map = {};
    transactions.forEach((t) => {
      if (t.type === 'gasto' && periodKey(t.date) === key) map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [transactions]);

  // Saldo total de cada cuenta de ahorro (todos los depósitos menos todos los
  // retiros, sin importar el mes) — para las categorías de Presupuesto que
  // estén vinculadas a una cuenta de ahorro (ej. "Transporte" -> "Fondo
  // transporte"). A propósito NO se reinicia cada mes: si un mes ahorras de
  // más, ese sobrante se queda como ventaja para el siguiente mes; y cuando
  // pagas el gasto real desde ahí, el retiro baja el saldo de forma normal
  // (estás gastando lo ahorrado y ahorrando otra vez al mismo tiempo).
  const saldoTotalPorAhorro = useMemo(() => {
    const map = {};
    savings.forEach((acc) => {
      map[acc.id] = acc.movements.reduce((s, m) => s + (m.kind === 'deposito' ? m.amount : -m.amount), 0);
    });
    return map;
  }, [savings]);

  // Progreso de la meta del mes para cuentas de ahorro vinculadas a un
  // presupuesto: el saldo solo no distingue "nunca ahorré" de "ya ahorré Y
  // pagué" (ambos casos terminan en saldo bajo/cero). Por eso el progreso
  // suma de vuelta lo que se RETIRÓ este mes calendario — así, pagar el gasto
  // real con ese dinero sigue contando como meta cumplida, en vez de caer a
  // 0% justo cuando terminas de lograrla. Lo que sobrevive en el saldo (sin
  // haberse retirado) sigue siendo la ventaja real para el siguiente mes.
  const progresoMetaPorAhorro = useMemo(() => {
    const key = periodKey(todayStr());
    const map = {};
    savings.forEach((acc) => {
      const retirosEsteMes = acc.movements.reduce((s, m) => s + (m.kind === 'retiro' && periodKey(m.date) === key ? m.amount : 0), 0);
      map[acc.id] = (saldoTotalPorAhorro[acc.id] || 0) + retirosEsteMes;
    });
    return map;
  }, [savings, saldoTotalPorAhorro]);

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

  // ---------- derived: gráficas por mes elegido (pestaña Gráficas) ----------
  // A diferencia de "filtered" (que respeta el filtro Hoy/Semana/Mes/Todo de
  // arriba), estas se arman a partir del mes puntual que se elija en el
  // selector de la pestaña Gráficas, para poder ver cualquier mes pasado.
  const chartTx = useMemo(() => transactions.filter((t) => periodKey(t.date) === chartMonth), [transactions, chartMonth]);

  const savingsMovesEnChartMonth = useMemo(() => {
    let net = 0;
    savings.forEach((acc) => acc.movements.forEach((m) => {
      if (periodKey(m.date) === chartMonth) net += m.kind === 'deposito' ? m.amount : -m.amount;
    }));
    return net;
  }, [savings, chartMonth]);

  const gastosPorCategoriaMes = useMemo(() => {
    const map = {};
    chartTx.filter((t) => t.type === 'gasto').forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).map(([id, value]) => ({ id, name: catById(id).label, value, color: catById(id).color }))
      .sort((a, b) => b.value - a.value);
  }, [chartTx]);

  const estadoResultadoMes = useMemo(() => {
    const map = {};
    chartTx.forEach((t) => {
      if (t.type === 'traspaso') return;
      const cuenta = cuentaOf(t.category);
      const key = cuenta.codigo;
      if (!map[key]) map[key] = { codigo: cuenta.codigo, nombre: cuenta.nombre, grupo: cuenta.grupo, value: 0 };
      map[key].value += t.amount;
    });
    const rows = Object.values(map).sort((a, b) => a.codigo.localeCompare(b.codigo));
    const ingresos = rows.filter((r) => r.grupo === 'ingresos');
    const gastos = rows.filter((r) => r.grupo === 'gastos');
    const totalIngresos = ingresos.reduce((s, r) => s + r.value, 0);
    const totalGastos = gastos.reduce((s, r) => s + r.value, 0);
    return { ingresos, gastos, totalIngresos, totalGastos, utilidad: totalIngresos - totalGastos };
  }, [chartTx]);

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
    const carryOver = c.carryOver || 0;
    const pendiente = Math.max(0, carryOver + baseAmount - pagadoMes);
    return { ...c, pagado: pagadoMes, pendiente, carryOver, pct: baseAmount ? Math.min(100, (pagadoMes / baseAmount) * 100) : 0, liquidada: false };
  }), [compromisos]);

  // Si un gasto/ingreso fijo se quedó sin pagar el mes en que le tocaba, este
  // efecto (se revisa cada vez que abres la app) mete ese faltante a
  // carryOver, para que se sume al monto de este mes en vez de "perderse" al
  // pasar la página del mes. Solo cuenta desde que se activó esta función en
  // adelante (compromisos ya existentes empiezan su conteo desde hoy, no
  // desde que se crearon).
  useEffect(() => {
    if (!compromisos.length) return;
    let changed = false;
    const next = compromisos.map((c) => {
      if (c.kind !== 'fijo' && c.kind !== 'ingreso_fijo') return c;
      const hadStoredBaseline = !!c.lastCheckedPeriod;
      let checked = c.lastCheckedPeriod || currentPeriodKey;
      let carry = c.carryOver || 0;
      const baseAmount = c.balance != null ? c.balance : c.amount;
      let advanced = false;
      while (checked < currentPeriodKey) {
        const pagadoEnPeriodo = c.payments.filter((p) => p.period === checked).reduce((s, p) => s + p.amount, 0);
        carry += Math.max(0, baseAmount - pagadoEnPeriodo);
        checked = nextPeriodKey(checked);
        advanced = true;
      }
      // Si ya tenía una fecha de referencia guardada y ningún mes se cruzó, no hay nada que actualizar.
      if (hadStoredBaseline && !advanced) return c;
      changed = true;
      return { ...c, carryOver: carry, lastCheckedPeriod: checked };
    });
    if (changed) persist({ compromisos: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compromisos.length]);

  // Limpieza de datos viejos: préstamos/CxC que ya se habían saldado por
  // completo (con "Actualizar monto" a $0) antes de que eso los quitara de
  // la lista automáticamente, y se quedaron atorados mostrando "Liquidado".
  // Se corre una sola vez al cargar y los retira, conservando su historial
  // de pagos en Movimientos (solo se quita la "tarjeta resumen").
  useEffect(() => {
    const atorados = compromisosView.filter((c) => isBalanceKind(c.kind) && c.liquidada);
    if (atorados.length === 0) return;
    const idsAtorados = new Set(atorados.map((c) => c.id));
    persist({ compromisos: compromisos.filter((c) => !idsAtorados.has(c.id)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compromisosView]);

  const deudas = compromisosView.filter((c) => c.kind === 'deuda');
  const cxc = compromisosView.filter((c) => c.kind === 'cxc');
  const fijos = compromisosView.filter((c) => c.kind === 'fijo');
  const ingresosFijos = compromisosView.filter((c) => c.kind === 'ingreso_fijo');
  // Para la lista visible en Cuentas: un gasto fijo ya liquidado este mes
  // (pendiente <= 0, incluyendo lo que traiga de carryOver de meses
  // anteriores) desaparece de la lista, porque ya no hay nada pendiente que
  // atender. Si no está liquidado, sigue apareciendo con el total pendiente
  // (mes en curso + lo que se deba de meses anteriores, vía carryOver).
  const fijosPendientes = fijos.filter((c) => c.pendiente > 0.01);
  // Mismo criterio para ingresos fijos: uno ya recibido este mes (pendiente
  // <= 0, considerando también el carryOver de meses anteriores) desaparece
  // de la lista; si no, se sigue mostrando con el total pendiente acumulado.
  const ingresosFijosPendientes = ingresosFijos.filter((c) => c.pendiente > 0.01);

  // Calendario (Ajustes › Calendario): para un mes "YYYY-MM" dado, arma la
  // lista de ocurrencias de TODOS los gastos/ingresos fijos activos que caen
  // en ese mes (ya estén pagados o pendientes ese mes), con su fecha exacta
  // y si ese mes ya se cubrió o no. Los mensuales usan notifyDay (día del
  // mes); los semanales/quincenales cuentan de 7 o 14 días a partir de
  // anchorDate hacia ambos lados hasta cubrir el mes completo. Los diarios
  // no se marcan (caen todos los días, no aporta verlos en el calendario).
  const eventsForCalMonth = useCallback((monthKey) => {
    const [y, m] = monthKey.split('-').map(Number);
    const diasEnMes = new Date(y, m, 0).getDate();
    const out = [];
    [...fijos, ...ingresosFijos].forEach((c) => {
      const freq = c.recurFreq || 'mensual';
      const baseAmount = c.balance != null ? c.balance : c.amount;
      const pagadoEnMes = c.payments.filter((p) => p.period === monthKey).reduce((s, p) => s + p.amount, 0);
      const pagado = baseAmount > 0 ? pagadoEnMes >= baseAmount - 0.01 : pagadoEnMes > 0;
      if (freq === 'mensual') {
        if (!c.notifyDay || c.notifyDay > diasEnMes) return;
        out.push({ date: `${monthKey}-${String(c.notifyDay).padStart(2, '0')}`, compromiso: c, pagado });
      } else if ((freq === 'semanal' || freq === 'quincenal') && c.anchorDate) {
        const every = freq === 'semanal' ? 7 : 14;
        const [ay, am, ad] = c.anchorDate.split('-').map(Number);
        const anchor = new Date(ay, am - 1, ad);
        const monthStart = new Date(y, m - 1, 1);
        const monthEnd = new Date(y, m - 1, diasEnMes);
        const diffInicio = Math.round((monthStart - anchor) / 86400000);
        let n = Math.floor(diffInicio / every) - 1;
        for (let guard = 0; guard < diasEnMes + every * 2; guard++) {
          const d = new Date(anchor); d.setDate(d.getDate() + n * every);
          if (d > monthEnd) break;
          if (d >= monthStart) out.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, compromiso: c, pagado });
          n++;
        }
      }
    });
    return out.sort((a, b) => a.date < b.date ? -1 : 1);
  }, [fijos, ingresosFijos]);
  const [calMonth, setCalMonth] = useState(currentPeriodKey);
  const [calSelectedDate, setCalSelectedDate] = useState(null);

  // --- Vinculación real con Google Calendar (OAuth, sin backend) ---
  // Usa Google Identity Services (accounts.google.com/gsi/client, cargado en
  // index.html) para pedir un access token directo desde el navegador, con
  // el Client ID que cada quien configura en google-calendar-config.js. Si
  // ese archivo no trae Client ID, esta parte simplemente no se ofrece y la
  // app sigue funcionando con los links "Agregar a Google Calendar" y el
  // .ics de siempre.
  const gcalConfigured = typeof window !== 'undefined' && !!(window.googleCalendarConfig && window.googleCalendarConfig.clientId);
  const [gcalToken, setGcalToken] = useState(() => {
    try {
      const raw = localStorage.getItem('libroDiario:gcalToken');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.expiresAt > Date.now() ? parsed : null;
    } catch (e) { return null; }
  });
  const [gcalSyncedIds, setGcalSyncedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('libroDiario:gcalSynced') || '{}'); } catch (e) { return {}; }
  });
  const [gcalBusy, setGcalBusy] = useState(false);
  const [gcalEventBusy, setGcalEventBusy] = useState(null);
  const [gcalMsg, setGcalMsg] = useState('');
  const [gcalCardHidden, setGcalCardHidden] = useState(false);
  const gcalTokenClientRef = useRef(null);
  const gcalPendingRef = useRef([]);
  const gcalTokenRef = useRef(gcalToken);
  useEffect(() => { gcalTokenRef.current = gcalToken; }, [gcalToken]);

  const getGcalTokenClient = useCallback(() => {
    if (gcalTokenClientRef.current) return gcalTokenClientRef.current;
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2 || !gcalConfigured) return null;
    gcalTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: window.googleCalendarConfig.clientId,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: (resp) => {
        const waiters = gcalPendingRef.current;
        gcalPendingRef.current = [];
        if (resp.error) {
          setGcalMsg('No se pudo conectar con Google: ' + resp.error);
          waiters.forEach(({ reject }) => reject(new Error(resp.error)));
          return;
        }
        const tok = { access_token: resp.access_token, expiresAt: Date.now() + (resp.expires_in - 60) * 1000 };
        setGcalToken(tok);
        try {
          localStorage.setItem('libroDiario:gcalToken', JSON.stringify(tok));
          // Esta marca NO expira con el token: sirve para saber, la próxima
          // vez que se abra la app (aunque hayan pasado horas y el token ya
          // haya vencido), que vale la pena intentar renovarlo solo antes de
          // mostrar "no conectado".
          localStorage.setItem('libroDiario:gcalWasConnected', '1');
        } catch (e) { /* nada que hacer si no hay storage */ }
        setGcalMsg('');
        waiters.forEach(({ resolve }) => resolve(tok.access_token));
      },
    });
    return gcalTokenClientRef.current;
  }, [gcalConfigured]);

  // Devuelve un access token vigente, pidiendo uno nuevo si hace falta.
  // `interactive` fuerza la pantalla de consentimiento de Google (primera
  // vez); si ya se había conectado antes, casi siempre renueva en silencio.
  const ensureGcalToken = useCallback((interactive) => {
    if (gcalTokenRef.current && gcalTokenRef.current.expiresAt > Date.now()) return Promise.resolve(gcalTokenRef.current.access_token);
    const client = getGcalTokenClient();
    if (!client) return Promise.reject(new Error('Google todavía no está listo; espera un segundo e intenta de nuevo.'));
    return new Promise((resolve, reject) => {
      gcalPendingRef.current.push({ resolve, reject });
      client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
    });
  }, [getGcalTokenClient]);

  const connectGoogleCalendar = () => {
    setGcalMsg('');
    ensureGcalToken(true).catch((e) => setGcalMsg('No se pudo conectar: ' + e.message));
  };

  const disconnectGoogleCalendar = () => {
    if (gcalToken?.access_token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(gcalToken.access_token, () => {});
    }
    setGcalToken(null);
    try {
      localStorage.removeItem('libroDiario:gcalToken');
      localStorage.removeItem('libroDiario:gcalWasConnected');
    } catch (e) { /* nada que limpiar */ }
    setGcalMsg('Se desconectó Google Calendar.');
  };

  // Si ya te habías conectado antes (aunque el token de esta sesión ya haya
  // vencido), intenta renovarlo solo en segundo plano en cuanto abre la app,
  // antes de mostrarte "no conectado". Casi siempre funciona sin pedirte
  // nada, mientras sigas con la sesión de Google activa en el navegador.
  useEffect(() => {
    if (gcalToken || !gcalConfigured) return;
    let wasConnected = false;
    try { wasConnected = localStorage.getItem('libroDiario:gcalWasConnected') === '1'; } catch (e) { /* sin storage, nada que hacer */ }
    if (!wasConnected) return;
    let cancelled = false;
    let attempts = 0;
    const tryRefresh = () => {
      if (cancelled) return;
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        ensureGcalToken(false).catch(() => { /* falló el intento silencioso; se queda como "no conectado" y puedes reconectar a mano */ });
        return;
      }
      attempts += 1;
      if (attempts < 20) setTimeout(tryRefresh, 300); // Google Identity Services aún no cargaba; reintenta un rato
    };
    tryRefresh();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gcalConfigured]);

  const markGcalSynced = (key, eventId) => {
    setGcalSyncedIds((prev) => {
      const next = { ...prev, [key]: eventId };
      try { localStorage.setItem('libroDiario:gcalSynced', JSON.stringify(next)); } catch (e) { /* nada que hacer */ }
      return next;
    });
  };

  // Crea (o reutiliza si ya existe) el evento de un día en el Google
  // Calendar principal de la cuenta conectada.
  const gcalCreateEvent = async (ev) => {
    const key = `${ev.compromiso.id}:${ev.date}`;
    if (gcalSyncedIds[key]) return gcalSyncedIds[key];
    const token = await ensureGcalToken(false);
    const isIngreso = ev.compromiso.kind === 'ingreso_fijo';
    const [y, m, d] = ev.date.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    const endDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        summary: `${isIngreso ? 'Ingreso' : 'Pago'} · ${ev.compromiso.name} (${fmt(ev.compromiso.amount)})`,
        description: 'Creado desde Libro·Diario.',
        start: { date: ev.date },
        end: { date: endDate },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Error ${res.status} al crear el evento`);
    }
    const data = await res.json();
    markGcalSynced(key, data.id);
    return data.id;
  };

  const syncOneToGoogle = async (ev) => {
    const key = `${ev.compromiso.id}:${ev.date}`;
    setGcalEventBusy(key);
    setGcalMsg('');
    try {
      await gcalCreateEvent(ev);
    } catch (e) {
      setGcalMsg('No se pudo agregar ese evento: ' + e.message);
    } finally {
      setGcalEventBusy(null);
    }
  };

  const syncMonthToGoogle = async (monthKey) => {
    setGcalBusy(true);
    setGcalMsg('');
    try {
      const events = eventsForCalMonth(monthKey);
      let creados = 0, yaEstaban = 0;
      for (const ev of events) {
        const key = `${ev.compromiso.id}:${ev.date}`;
        if (gcalSyncedIds[key]) { yaEstaban++; continue; }
        await gcalCreateEvent(ev);
        creados++;
      }
      setGcalMsg(creados > 0
        ? `Se agregaron ${creados} evento${creados !== 1 ? 's' : ''} a tu Google Calendar.${yaEstaban ? ` (${yaEstaban} ya estaban.)` : ''}`
        : (events.length ? 'Ya estaba todo sincronizado con Google Calendar.' : 'No hay eventos que sincronizar este mes.'));
    } catch (e) {
      setGcalMsg('Se sincronizó parcialmente; se detuvo por: ' + e.message);
    } finally {
      setGcalBusy(false);
    }
  };

  // "Disponible HOY" y proyección a fin de mes: a diferencia de "Disponible
  // · Mes" (que respeta el filtro Hoy/Semana/Mes/Todo de arriba), esto SIEMPRE
  // mira el mes calendario actual completo, sin importar qué filtro esté
  // activo — porque la pregunta que responde ("¿cuánto me queda / puedo
  // gastar hoy?") solo tiene sentido a nivel mes.
  const flowProjection = useMemo(() => {
    const key = currentPeriodKey;
    let ingresosMes = 0, gastosMes = 0;
    transactions.forEach((t) => {
      if (periodKey(t.date) !== key) return;
      if (t.type === 'ingreso') ingresosMes += t.amount;
      else if (t.type === 'gasto') gastosMes += t.amount;
    });
    let savingsMesNet = 0;
    savings.forEach((acc) => acc.movements.forEach((m) => {
      if (periodKey(m.date) === key) savingsMesNet += m.kind === 'deposito' ? m.amount : -m.amount;
    }));
    const disponibleMes = ingresosMes - gastosMes - savingsMesNet;

    const pendienteGastosFijos = fijos.reduce((s, c) => s + c.pendiente, 0);
    const pendienteIngresosFijos = ingresosFijos.reduce((s, c) => s + c.pendiente, 0);

    const hoy = new Date();
    const finDeMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const diasRestantes = Math.max(1, Math.round((finDeMes - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) / 86400000) + 1);

    const restanteSeguro = disponibleMes - pendienteGastosFijos; // conservador: no suma ingresos fijos que aún no llegan
    const disponibleHoy = Math.max(0, restanteSeguro / diasRestantes);
    const proyectadoFinMes = disponibleMes - pendienteGastosFijos + pendienteIngresosFijos;

    return { disponibleHoy, diasRestantes, proyectadoFinMes, pendienteGastosFijos, pendienteIngresosFijos, disponibleMes };
  }, [transactions, savings, fijos, ingresosFijos]);

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
    // Se usa el monto comprometido del mes en curso (pagado + lo que falte,
    // sin contar el carryOver de meses anteriores) para que un gasto fijo ya
    // pagado este mes siga apareciendo en la gráfica con su rebanada normal,
    // en vez de desaparecer solo por estar al día.
    compromisosView.filter((c) => c.kind === 'fijo').forEach((c) => {
      const montoMes = c.balance != null ? c.balance : c.amount;
      if (montoMes > 0.01) map[c.name] = (map[c.name] || 0) + montoMes;
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
  // Desglose ITEMIZADO de lo pendiente por cobrar: no solo el total por
  // persona, sino cada pago individual que lo compone (de qué cuenta es, de
  // qué fecha, y cómo liquidarlo puntualmente). "Por cobrar" se arma a
  // partir de este mismo desglose, para que ambas vistas concuerden siempre.
  const pendingItemsByPerson = useMemo(() => {
    const map = {};
    const add = (name, amount, meta) => {
      const key = name.trim().toLowerCase();
      if (!map[key]) map[key] = { name: name.trim(), items: [] };
      map[key].items.push({ amount, ...meta });
    };
    // Fuente 1: pagos hechos con "Abonar" / pago en lote / adelantos, que
    // guardan el reparto en la transacción (tx.shared) — el formato normal.
    transactions.forEach((t) => {
      if (!t.shared) return;
      t.shared.participants.forEach((p) => {
        if (p.paid) return;
        add(p.name, p.amount, { source: 'tx', txId: t.id, participantId: p.id, label: t.note || catById(t.category).label, date: t.date });
      });
    });
    // Fuente 2: pagos hechos vinculando la cuenta desde "+", que guardan el
    // reparto directo en el pago del compromiso (payment.participants) en
    // vez de en la transacción. Solo se cuentan aquí si esa transacción en
    // particular NO trae ya su propio "shared", para no contar el mismo
    // pago dos veces.
    compromisos.forEach((c) => {
      (c.payments || []).forEach((p) => {
        if (!p.participants || !p.participants.length) return;
        const tx = transactions.find((t) => t.paymentId === p.id);
        if (tx?.shared) return;
        p.participants.forEach((pp, i) => {
          if (pp.paid) return;
          add(pp.name, pp.amount, { source: 'payment', compromisoId: c.id, paymentId: p.id, participantId: i, label: c.name, date: p.date });
        });
      });
    });
    return map;
  }, [transactions, compromisos]);

  const pendingByPerson = useMemo(() => (
    Object.values(pendingItemsByPerson)
      .map((g) => ({ name: g.name, total: g.items.reduce((s, it) => s + it.amount, 0), count: g.items.length }))
      .sort((a, b) => b.total - a.total)
  ), [pendingItemsByPerson]);

  const porCobrarTotal = pendingByPerson.reduce((s, p) => s + p.total, 0);

  // ---------- actions ----------
  const openAddTx = (type) => {
    setTxForm({ type, amount: '', category: '', subcategory: '', servicio: '', persona: '', note: '', date: todayStr(), shared: false, participants: [], fijo: false, fijoTarget: 'new', fijoName: '', fijoNotifyDay: '', fijoAmount: '', locationId: '', links: [], linkAmounts: {}, linkParticipants: {} });
    setTxError('');
    setSheet({ type: 'add-tx' });
  };

  // Un ingreso SUMA a la ubicación elegida (ahí "cayó" el dinero); un gasto
  // RESTA (de ahí "salió" el dinero).
  const locationDelta = (type, amt) => (type === 'ingreso' ? amt : -amt);

  // Cuánto de lo que hay en una tarjeta/monedero está "apartado" porque
  // pertenece a una cuenta de ahorro vinculada a esa misma ubicación.
  const savedAmount = (acc) => acc.movements.reduce((s, m) => s + (m.kind === 'deposito' ? m.amount : -m.amount), 0);
  const reservedForLocation = (locationId) => savings
    .filter((a) => a.locationId === locationId)
    .reduce((sum, a) => sum + Math.max(0, savedAmount(a)), 0);

  // Cuando un gasto deja el saldo de una cuenta por debajo de lo apartado
  // para ahorro, registra un "retiro" automático en la(s) cuenta(s) de
  // ahorro vinculadas a esa ubicación, por el faltante exacto, para que el
  // ahorro y la tarjeta/monedero siempre cuadren entre sí.
  const applySavingsWithdrawal = (locationId, shortfall) => {
    let restante = shortfall;
    return savings.map((a) => {
      if (restante <= 0.01 || a.locationId !== locationId) return a;
      const saved = savedAmount(a);
      if (saved <= 0.01) return a;
      const retiro = Math.min(saved, restante);
      restante -= retiro;
      const move = {
        id: uid(), kind: 'retiro', amount: retiro, date: todayStr(),
        note: 'Retiro automático: un gasto usó parte de este ahorro.',
        persona: profile?.name || 'Familia', locationId, origenLocationId: null, autor: profile?.name || 'Familia',
      };
      return { ...a, movements: [...a.movements, move] };
    });
  };

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
        return { ...f, links: [...keepIds, c.id], category: c.category, linkAmounts, linkParticipants: { ...linkParticipants, [c.id]: {} } };
      }
      // Cuenta individual (no compartida): selección única, reemplaza cualquier otra.
      const amt = c.pendiente || c.amount;
      return { ...f, links: [c.id], category: c.category, linkAmounts: { [c.id]: amt ? String(amt) : '' }, linkParticipants: {} };
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
    // La categoría del movimiento y el "concepto" en la nota deben salir de
    // la(s) cuenta(s) que se está(n) liquidando, no de lo que haya quedado
    // marcado arriba en el selector de categorías (que solo sirve para
    // encontrar la cuenta en la lista y puede quedar desfasado si el
    // usuario probó varias categorías antes de dar con la correcta). Así
    // nunca se guarda "Otros" por accidente cuando el préstamo/cuenta sí
    // tiene su categoría real bien puesta.
    const finalCategory = links.length ? links[0].c.category : txForm.category;
    const notaBase = txForm.note.trim();
    const finalNote = links.length === 1 ? `${links[0].c.name}${notaBase ? ' — ' + notaBase : ''}` : notaBase;

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
      // Guarda el reparto también en tx.shared (el mismo formato que usan
      // "Abonar" y el resto), para que este pago aparezca en "Por cobrar" de
      // Resumen y en el botón "Pagó" sin depender de un respaldo especial.
      if (!shared && participants && participants.length) {
        shared = { participants: participants.map((p) => ({ id: uid(), name: p.name, amount: p.amount, paid: false })) };
      }
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
    const next = [...transactions, { id: uid(), type: txForm.type, amount: amt, category: finalCategory, subcategory: links.length === 1 ? links[0].c.id : null, servicio: txForm.servicio || null, note: finalNote, date: txForm.date, shared, compromisoId, paymentId, compromisoIds, paymentIds, locationId, autor: profile?.name || 'Familia' }];
    const patch = { transactions: next, compromisos: nextCompromisos };
    const finalizeTx = () => { persist(patch); setSheet(null); };
    if (locationId) {
      patch.moneyLocations = moneyLocations.map((l) => l.id === locationId ? { ...l, monto: (l.monto || 0) + locationDelta(txForm.type, amt) } : l);
      // Si este gasto deja el saldo por debajo de lo que tienes apartado
      // para ahorro en esa misma cuenta, avisa y refleja el retiro en ambas partes.
      if (txForm.type === 'gasto') {
        const loc = moneyLocations.find((l) => l.id === locationId);
        const reserved = reservedForLocation(locationId);
        const newMonto = (loc?.monto || 0) - amt;
        if (reserved > 0.01 && newMonto < reserved - 0.01) {
          const shortfall = Math.min(reserved, reserved - newMonto);
          askConfirm(`Este gasto usa ${fmt(shortfall)} de tu ahorro guardado en esta cuenta. Se registrará como retiro para que el ahorro y la cuenta cuadren. ¿Continuar?`, () => {
            patch.savings = applySavingsWithdrawal(locationId, shortfall);
            finalizeTx();
          }, { confirmLabel: 'Continuar', danger: false });
          return;
        }
      }
    }
    finalizeTx();
  };

  const deleteTx = (id) => {
    askConfirm('¿Eliminar este movimiento?', () => withUndo('Movimiento eliminado', () => {
      const orig = transactions.find((t) => t.id === id);
      const patch = { transactions: transactions.filter((t) => t.id !== id) };
      if (orig?.locationId) {
        patch.moneyLocations = moneyLocations.map((l) => l.id === orig.locationId ? { ...l, monto: (l.monto || 0) - locationDelta(orig.type, orig.amount) } : l);
      }
      persist(patch);
    }));
  };

  // ---------- traspasos entre cuentas propias (ej. Banco -> Efectivo) ----------
  const openTraspaso = (prefill) => {
    setTraspasoForm({ fromId: '', toId: '', amount: '', note: '', date: todayStr(), ...prefill });
    setTraspasoError('');
    setSheet({ type: 'traspaso' });
  };

  const openWalletDetail = (loc) => setSheet({ type: 'wallet-detail', location: loc, historyOpen: false });
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
    askConfirm('¿Eliminar este traspaso? Se revertirá el monto en ambas cuentas.', () => withUndo('Traspaso eliminado', () => {
      const orig = transactions.find((t) => t.id === id);
      if (!orig) return;
      const nextLocations = moneyLocations.map((l) => {
        if (l.id === orig.fromLocationId) return { ...l, monto: (l.monto || 0) + orig.amount };
        if (l.id === orig.toLocationId) return { ...l, monto: (l.monto || 0) - orig.amount };
        return l;
      });
      persist({ transactions: transactions.filter((t) => t.id !== id), moneyLocations: nextLocations });
    }));
  };

  // Un traspaso es editable de forma directa solo cuando ambos lados son
  // ubicaciones de dinero reales. Los que se generaron automáticamente al
  // dar de alta un préstamo/CxC tienen un lado "compromiso:..." y esos se
  // manejan desde ese préstamo/CxC, no aquí.
  // Los ids de tarjetas/monederos son números (uid()); solo los ids de
  // préstamos/CxC recién dados de alta son texto con prefijo "compromiso:".
  // Antes esta función exigía que el id fuera texto, lo cual excluía por
  // error a TODOS los traspasos normales (con ids numéricos).
  const isCompromisoRef = (id) => typeof id === 'string' && id.startsWith('compromiso:');
  const isEditableTraspaso = (t) => t?.type === 'traspaso'
    && t.fromLocationId != null && !isCompromisoRef(t.fromLocationId)
    && t.toLocationId != null && !isCompromisoRef(t.toLocationId);

  const openEditTraspaso = (t) => {
    if (!isEditableTraspaso(t)) return deleteTraspaso(t.id);
    setEditTraspasoForm({ id: t.id, fromId: t.fromLocationId, toId: t.toLocationId, amount: formatAmountTyping(String(t.amount)), note: t.note || '', date: t.date });
    setEditTraspasoError('');
    setSheet({ type: 'edit-traspaso' });
  };

  const submitEditTraspaso = () => {
    const amt = toNumber(editTraspasoForm.amount);
    if (!amt || amt <= 0) return setEditTraspasoError('Ingresa un monto válido.');
    if (!editTraspasoForm.fromId) return setEditTraspasoError('Elige de dónde sale el dinero.');
    if (!editTraspasoForm.toId) return setEditTraspasoError('Elige a dónde entra el dinero.');
    if (editTraspasoForm.fromId === editTraspasoForm.toId) return setEditTraspasoError('Elige dos ubicaciones distintas.');
    if (!editTraspasoForm.date) return setEditTraspasoError('Elige una fecha.');
    const orig = transactions.find((t) => t.id === editTraspasoForm.id);
    if (!orig) return setEditTraspasoError('Este traspaso ya no existe.');
    const from = moneyLocations.find((l) => l.id === editTraspasoForm.fromId);
    const to = moneyLocations.find((l) => l.id === editTraspasoForm.toId);
    if (!from || !to) return setEditTraspasoError('Esa ubicación ya no existe.');
    // Primero revierte el efecto del traspaso original en las cuentas donde
    // estaba, y luego aplica el nuevo monto/cuentas — así todo queda
    // cuadrado aunque hayas cambiado el monto, la fecha o las cuentas.
    let nextLocations = moneyLocations.map((l) => {
      let monto = l.monto || 0;
      if (l.id === orig.fromLocationId) monto += orig.amount;
      if (l.id === orig.toLocationId) monto -= orig.amount;
      return { ...l, monto };
    });
    nextLocations = nextLocations.map((l) => {
      let monto = l.monto || 0;
      if (l.id === from.id) monto -= amt;
      if (l.id === to.id) monto += amt;
      return { ...l, monto };
    });
    const nextTx = transactions.map((t) => t.id === editTraspasoForm.id ? {
      ...t,
      amount: amt,
      fromLocationId: from.id,
      toLocationId: to.id,
      note: editTraspasoForm.note.trim(),
      date: editTraspasoForm.date,
    } : t);
    persist({ transactions: nextTx, moneyLocations: nextLocations });
    setSheet(null);
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
    return `${l.persona} · ${l.tipo === 'tarjeta' ? `${l.nombre || 'Banco'}${l.esCredito != null ? ` · ${l.esCredito ? 'Crédito' : 'Débito'}` : ''}` : 'Monedero'}`;
  };

  const openEditTx = (t) => {
    setEditTxForm({
      id: t.id, type: t.type, amount: formatAmountTyping(String(t.amount)), category: t.category, subcategory: t.subcategory || '', note: t.note || '', date: t.date, locationId: t.locationId || '',
      shared: !!t.shared,
      // Conserva quién ya te había pagado (paid) si el gasto ya venía compartido.
      participants: t.shared ? t.shared.participants.map((p) => ({ id: p.id || uid(), name: p.name, amount: formatAmountTyping(String(p.amount)), paid: !!p.paid })) : [],
    });
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
    // Si activaste "¿Es un gasto compartido?", arma el reparto igual que al
    // crear un movimiento nuevo. Si lo desactivaste, se quita el reparto
    // (deja de contar en "Por cobrar"). Conserva el "paid" de cada persona
    // que ya venía marcada, para no perder lo que ya te habían devuelto.
    const finalShared = (editTxForm.type === 'gasto' && editTxForm.shared)
      ? (() => {
          const parts = editTxForm.participants
            .filter((p) => p.name.trim() && toNumber(p.amount) > 0)
            .map((p) => ({ id: p.id, name: p.name.trim(), amount: toNumber(p.amount), paid: !!p.paid }));
          return parts.length ? { participants: parts } : null;
        })()
      : null;
    const next = transactions.map((t) => t.id === editTxForm.id ? {
      ...t,
      amount: amt,
      category: editTxForm.category,
      subcategory: editTxForm.subcategory || null,
      note: editTxForm.note.trim(),
      date: editTxForm.date,
      paymentId: syncedPaymentId,
      locationId: nextLocationId,
      shared: finalShared,
    } : t);
    const patch = { transactions: next, compromisos: nextCompromisos };
    const finalizeEditTx = () => { persist(patch); setSheet(null); };
    // Revierte la ubicación anterior (si tenía) y aplica la nueva (si eligió una), por si cambió el monto, el tipo o la ubicación.
    if (orig?.locationId || nextLocationId) {
      let nextLocations = moneyLocations;
      if (orig?.locationId) nextLocations = nextLocations.map((l) => l.id === orig.locationId ? { ...l, monto: (l.monto || 0) - locationDelta(orig.type, orig.amount) } : l);
      if (nextLocationId) nextLocations = nextLocations.map((l) => l.id === nextLocationId ? { ...l, monto: (l.monto || 0) + locationDelta(editTxForm.type, amt) } : l);
      patch.moneyLocations = nextLocations;
      // Igual que al registrar un gasto nuevo: si el cambio deja el saldo de
      // la cuenta destino por debajo de lo apartado para ahorro ahí, avisa y
      // refleja el retiro en el ahorro para que ambas partes cuadren.
      if (nextLocationId && editTxForm.type === 'gasto') {
        const nuevaUbic = nextLocations.find((l) => l.id === nextLocationId);
        const reserved = reservedForLocation(nextLocationId);
        if (reserved > 0.01 && (nuevaUbic?.monto || 0) < reserved - 0.01) {
          const shortfall = Math.min(reserved, reserved - (nuevaUbic?.monto || 0));
          askConfirm(`Este cambio deja ${fmt(shortfall)} de ahorro apartado sin cubrir en esa cuenta. Se registrará como retiro para que el ahorro y la cuenta cuadren. ¿Continuar?`, () => {
            patch.savings = applySavingsWithdrawal(nextLocationId, shortfall);
            finalizeEditTx();
          }, { confirmLabel: 'Continuar', danger: false });
          return;
        }
      }
    }
    finalizeEditTx();
  };

  const deleteTxFromEdit = () => {
    askConfirm('¿Eliminar este movimiento?', () => withUndo('Movimiento eliminado', () => {
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
    }));
  };

  const openNewCompromiso = (prefill) => {
    setCompForm({ kind: 'deuda', name: '', category: 'deudas', amount: '', notifyDay: '', recurFreq: 'mensual', anchorDate: todayStr(), shared: false, participants: [], locationId: '', ...prefill });
    setCompError('');
    setSheet({ type: 'new-compromiso' });
  };

  // Tirador "jala para revelar" en Cuentas: vive arriba de la lista (igual
  // que en Movimientos), así que se jala hacia ABAJO para revelar Simular
  // MSI y Movimientos programados, y hacia ARRIBA (o con un toque) para
  // retraerlos — la pantalla de inicio de la pestaña queda solo con las
  // tarjetas de cuentas.
  const [msiRevealed, setMsiRevealed] = useState(false);
  const msiDragStart = useRef(null);
  const handleMsiHandleTouchStart = (e) => {
    const t = e.touches[0];
    msiDragStart.current = { y: t.clientY, time: Date.now() };
  };
  const handleMsiHandleTouchEnd = (e) => {
    if (!msiDragStart.current) return;
    e.preventDefault(); // evita el click fantasma y que el navegador intente "seleccionar texto"
    const t = e.changedTouches[0];
    const dy = t.clientY - msiDragStart.current.y; // positivo = dedo bajó
    const dt = Date.now() - msiDragStart.current.time;
    msiDragStart.current = null;
    if (dt > 700) return;
    if (Math.abs(dy) < 10) { setMsiRevealed((v) => !v); return; } // toque simple
    if (dy > 14) setMsiRevealed(true);
    else if (dy < -14) setMsiRevealed(false);
  };
  // Tirador "jala para revelar" en Movimientos: como este vive arriba de la
  // lista (no abajo, como en Cuentas), el gesto se invierte — se jala hacia
  // ABAJO para revelar conciliación, buscador, categorías y familia. Así la
  // pantalla de inicio de la pestaña es solo la lista de movimientos.
  const [movsRevealed, setMovsRevealed] = useState(false);
  const movsDragStart = useRef(null);
  const handleMovsHandleTouchStart = (e) => {
    const t = e.touches[0];
    movsDragStart.current = { y: t.clientY, time: Date.now() };
  };
  const handleMovsHandleTouchEnd = (e) => {
    if (!movsDragStart.current) return;
    e.preventDefault(); // evita el click fantasma y que el navegador intente "seleccionar texto"
    const t = e.changedTouches[0];
    const dy = t.clientY - movsDragStart.current.y; // positivo = dedo bajó
    const dt = Date.now() - movsDragStart.current.time;
    movsDragStart.current = null;
    if (dt > 700) return;
    if (Math.abs(dy) < 10) { setMovsRevealed((v) => !v); return; } // toque simple
    if (dy > 14) setMovsRevealed(true);
    else if (dy < -14) setMovsRevealed(false);
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
    const recurFreq = (compForm.kind === 'fijo' || compForm.kind === 'ingreso_fijo') ? (compForm.recurFreq || 'mensual') : null;
    const anchorDate = (recurFreq === 'semanal' || recurFreq === 'quincenal') && compForm.anchorDate ? compForm.anchorDate : null;
    let shared = null;
    if (compForm.kind === 'fijo' && compForm.shared) {
      const parts = compForm.participants.filter((p) => p.name.trim() && toNumber(p.amount) > 0)
        .map((p) => ({ id: uid(), name: p.name.trim(), amount: toNumber(p.amount) }));
      const sumParts = parts.reduce((s, p) => s + p.amount, 0);
      if (sumParts > amt + 0.01) return setCompError('La suma de las partes no puede ser mayor al monto mensual.');
      if (parts.length) shared = { participants: parts };
    }
    const compromiso = { id: uid(), kind: compForm.kind, name: compForm.name.trim(), category: compForm.category, amount: amt, balance: amt, payments: [], adjustments: [], notifyDay, recurFreq, anchorDate, shared, carryOver: 0, lastCheckedPeriod: currentPeriodKey };
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
    askConfirm(`¿Eliminar ${label}${c ? ` "${c.name}"` : ''}? Se perderá su historial de pagos.`, () => withUndo('Eliminado', () => {
      persist({ compromisos: compromisos.filter((c) => c.id !== id) });
    }));
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
    // Si es una cuenta de saldo total (préstamo/CxC, no gasto o ingreso fijo
    // recurrente) y el ajuste la deja en $0, ya quedó saldada: se quita de la
    // lista igual que cuando se liquida con "Abonar", en vez de dejarla ahí
    // marcada "Liquidado" para siempre.
    if (isBalanceKind(c.kind) && amt <= 0.01) {
      const nextCompromisos = compromisos.filter((x) => x.id !== c.id);
      withUndo(`"${c.name}" liquidada — se quitó de la lista`, () => persist({ compromisos: nextCompromisos }));
      setSheet(null);
      return;
    }
    const nextCompromisos = compromisos.map((x) => x.id === c.id ? { ...x, balance: amt, adjustments: [...(x.adjustments || []), adjustment] } : x);
    persist({ compromisos: nextCompromisos });
    setSheet(null);
  };

  // ---------- editar la fecha/frecuencia de un gasto o ingreso fijo ----------
  // notifyDay (mensuales) y anchorDate (semanales/quincenales) son la ÚNICA
  // fuente que se usa para calcular las próximas fechas (calendario,
  // recordatorios, texto "cada X días"), así que basta con actualizar el
  // compromiso: desde ese momento, todas las fechas futuras se recalculan
  // solas a partir del nuevo día/fecha. Lo ya pagado en meses anteriores no
  // se toca.
  const openEditDate = (compromiso) => {
    setEditDateForm({ recurFreq: compromiso.recurFreq || 'mensual', notifyDay: compromiso.notifyDay ? String(compromiso.notifyDay) : '', anchorDate: compromiso.anchorDate || todayStr() });
    setEditDateError('');
    setSheet({ type: 'edit-date', compromiso });
  };

  const submitEditDate = () => {
    const c = sheet.compromiso;
    const freq = editDateForm.recurFreq;
    let notifyDay = null, anchorDate = null;
    if (freq === 'mensual') {
      if (editDateForm.notifyDay) {
        const day = parseInt(editDateForm.notifyDay, 10);
        if (day >= 1 && day <= 31) notifyDay = day;
      }
    } else if (freq === 'semanal' || freq === 'quincenal') {
      if (!editDateForm.anchorDate) return setEditDateError('Elige una fecha.');
      anchorDate = editDateForm.anchorDate;
    }
    const nextCompromisos = compromisos.map((x) => x.id === c.id ? { ...x, recurFreq: freq, notifyDay, anchorDate } : x);
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
    // Cuando el abono deja saldada una deuda o cuenta por cobrar, la tarjeta
    // ya no aporta nada nuevo (ya se ve "Liquidado ✓" ahí), así que se quita
    // de la lista de compromisos activos. El movimiento del abono en sí
    // (y todos los anteriores) se queda intacto en Movimientos — solo se
    // borra la "tarjeta resumen", no el historial.
    let justSettled = false;
    const nextCompromisos = compromisos.reduce((acc, x) => {
      if (x.id !== c.id) { acc.push(x); return acc; }
      const nextPayments = [...x.payments, payment];
      if (isBalanceKind(x.kind)) {
        const currentBalance = x.balance != null ? x.balance : x.amount;
        const newBalance = Math.max(0, currentBalance - amt);
        if (newBalance <= 0.01) { justSettled = true; return acc; } // se omite: queda liquidada y se retira de la lista
        acc.push({ ...x, payments: nextPayments, balance: newBalance });
        return acc;
      }
      acc.push({ ...x, payments: nextPayments });
      return acc;
    }, []);
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
    if (justSettled) withUndo(`"${c.name}" liquidada — se quitó de la lista`, () => persist(patch));
    else persist(patch);
    setSheet(null);
  };

  // --- Pago en lote de gastos fijos (CxP) ---
  // Permite marcar varios gastos fijos pendientes a la vez y pagarlos juntos
  // desde una sola cuenta, en lugar de abrir "Abonar" uno por uno. Al abrir,
  // preseleccionamos los que están atrasados (traen carryOver de meses
  // anteriores) porque son los que más urge cubrir; el resto queda
  // disponible para sumarlos también si se quiere.
  const openPagoLote = () => {
    const pendientes = fijos.filter((c) => c.pendiente > 0.01);
    const atrasados = pendientes.filter((c) => c.carryOver > 0.01).map((c) => c.id);
    setPagoLoteForm({ selectedIds: atrasados, locationId: '', date: todayStr() });
    setPagoLoteError('');
    // Si ya no hay nada pendiente este mes, "Pagar varios" se vería vacía:
    // se abre directo en "Adelantar meses" para no obligar a cambiar de pestaña.
    setPagoLoteTab(pendientes.length > 0 ? 'varios' : 'adelanto');
    setAdelantoForm({ compromisoId: fijos[0]?.id || '', meses: 3, locationId: '', date: todayStr() });
    setAdelantoError('');
    setSheet({ type: 'pagar-lote' });
  };

  const togglePagoLoteId = (id) => {
    setPagoLoteForm((f) => ({
      ...f,
      selectedIds: f.selectedIds.includes(id) ? f.selectedIds.filter((x) => x !== id) : [...f.selectedIds, id],
    }));
  };

  const submitPagoLote = () => {
    const pendientes = fijos.filter((c) => c.pendiente > 0.01);
    const seleccionados = pendientes.filter((c) => pagoLoteForm.selectedIds.includes(c.id));
    if (!seleccionados.length) return setPagoLoteError('Selecciona al menos un gasto fijo para pagar.');
    if (!pagoLoteForm.locationId) return setPagoLoteError('Elige de dónde sale el dinero.');
    const date = pagoLoteForm.date;
    const period = periodKey(date);
    const totalAmt = seleccionados.reduce((s, c) => s + c.pendiente, 0);
    const newTx = [];
    const nextCompromisos = compromisos.map((x) => {
      const sel = seleccionados.find((c) => c.id === x.id);
      if (!sel) return x;
      const amt = sel.pendiente;
      const paymentId = uid();
      const payment = { id: paymentId, amount: amt, date, period, note: 'Pago en lote', autor: profile?.name || 'Familia' };
      let shared = null;
      if (x.shared && x.amount) {
        const ratio = amt / x.amount;
        const parts = x.shared.participants.filter((p) => p.amount > 0).map((p) => ({ id: uid(), name: p.name, amount: Math.round(p.amount * ratio * 100) / 100, paid: false }));
        if (parts.length) shared = { participants: parts };
      }
      newTx.push({ id: uid(), type: 'gasto', category: x.category, amount: amt, note: `Pago (lote) · ${x.name}`, date, shared, compromisoId: x.id, paymentId, locationId: pagoLoteForm.locationId, autor: profile?.name || 'Familia' });
      return { ...x, payments: [...x.payments, payment] };
    });
    const patch = { compromisos: nextCompromisos, transactions: [...transactions, ...newTx] };
    patch.moneyLocations = moneyLocations.map((l) => l.id === pagoLoteForm.locationId ? { ...l, monto: (l.monto || 0) + locationDelta('gasto', totalAmt) } : l);
    persist(patch);
    setSheet(null);
  };

  // --- Adelantar pagos de varios meses (un solo gasto fijo) ---
  // Paga hoy, de una sola vez, el mes en curso (si sigue pendiente, lo que
  // ya incluye cualquier atraso vía carryOver) más N meses futuros elegidos
  // por el usuario. Por cada mes cubierto se guarda un "payment" con su
  // propio `period` (que no coincide con la fecha real del pago) para que
  // esos meses futuros ya aparezcan liquidados cuando les toque, y un
  // movimiento en Movimientos por cada uno, todos con la fecha real en que
  // salió el dinero.
  const submitAdelanto = () => {
    const c = fijos.find((x) => x.id === adelantoForm.compromisoId);
    if (!c) return setAdelantoError('Elige el gasto fijo que quieres adelantar.');
    const meses = Math.round(toNumber(adelantoForm.meses));
    if (!(meses > 0)) return setAdelantoError('Indica cuántos meses quieres adelantar.');
    if (!adelantoForm.locationId) return setAdelantoError('Elige de dónde sale el dinero.');
    const date = adelantoForm.date;
    const autor = profile?.name || 'Familia';
    const periods = [];
    if (c.pendiente > 0.01) periods.push({ period: currentPeriodKey, amount: c.pendiente, note: 'Adelanto · mes en curso' });
    let p = currentPeriodKey;
    for (let i = 0; i < meses; i++) {
      p = nextPeriodKey(p);
      periods.push({ period: p, amount: c.amount, note: 'Adelanto' });
    }
    const totalAmt = periods.reduce((s, x) => s + x.amount, 0);
    const newTx = [];
    const nextCompromisos = compromisos.map((x) => {
      if (x.id !== c.id) return x;
      const newPayments = periods.map((pr) => {
        const paymentId = uid();
        let shared = null;
        if (x.shared && x.amount) {
          const ratio = pr.amount / x.amount;
          const parts = x.shared.participants.filter((part) => part.amount > 0).map((part) => ({ id: uid(), name: part.name, amount: Math.round(part.amount * ratio * 100) / 100, paid: false }));
          if (parts.length) shared = { participants: parts };
        }
        newTx.push({ id: uid(), type: 'gasto', category: x.category, amount: pr.amount, note: `Adelanto · ${x.name} · ${periodLabel(pr.period)}`, date, shared, compromisoId: x.id, paymentId, locationId: adelantoForm.locationId, autor });
        return { id: paymentId, amount: pr.amount, date, period: pr.period, note: pr.note, autor };
      });
      return { ...x, payments: [...x.payments, ...newPayments] };
    });
    const patch = { compromisos: nextCompromisos, transactions: [...transactions, ...newTx] };
    patch.moneyLocations = moneyLocations.map((l) => l.id === adelantoForm.locationId ? { ...l, monto: (l.monto || 0) + locationDelta('gasto', totalAmt) } : l);
    persist(patch);
    setSheet(null);
  };

  const openNewSavings = () => {
    setSavForm({ name: '', target: '', locationId: '', category: '' });
    setSavError('');
    setSheet({ type: 'new-savings' });
  };

  const submitSavings = () => {
    if (!savForm.name.trim()) return setSavError('Ponle un nombre a tu meta o cuenta.');
    const target = toNumber(savForm.target);
    if (!target || target <= 0) return setSavError('Ponle una meta (monto a ahorrar) para poder seguir.');
    const next = [...savings, { id: uid(), name: savForm.name.trim(), target, movements: [], locationId: savForm.locationId || null, category: savForm.category || null }];
    persist({ savings: next });
    setSheet(null);
  };

  // Abre la misma tarjeta de ahorro para actualizar lo ya capturado (nombre,
  // meta y categoría) — se dispara al tocar la tarjeta, sin afectar los
  // botones de Depositar/Retirar/vincular/eliminar que van dentro de ella.
  const openEditSavings = (acc) => {
    setSavForm({ name: acc.name, target: String(acc.target || ''), locationId: acc.locationId || '', category: acc.category || '' });
    setSavError('');
    setSheet({ type: 'edit-savings', account: acc });
  };

  const submitEditSavings = () => {
    const acc = sheet.account;
    if (!savForm.name.trim()) return setSavError('Ponle un nombre a tu meta o cuenta.');
    const target = toNumber(savForm.target);
    if (!target || target <= 0) return setSavError('Ponle una meta (monto a ahorrar) para poder seguir.');
    const next = savings.map((a) => a.id === acc.id ? {
      ...a, name: savForm.name.trim(), target, locationId: savForm.locationId || null, category: savForm.category || null,
    } : a);
    persist({ savings: next });
    setSheet(null);
  };

  // Vincula (o desvincula) una cuenta de ahorro a una tarjeta/monedero, para
  // saber en qué cuenta física vive ese dinero y que se refleje en ambas
  // partes si algún gasto llega a tocarlo.
  const openLinkSavings = (acc) => setSheet({ type: 'link-savings', account: acc });
  const submitLinkSavings = (locationId) => {
    const acc = sheet.account;
    persist({ savings: savings.map((a) => a.id === acc.id ? { ...a, locationId: locationId || null } : a) });
    setSheet(null);
  };

  const deleteSavings = (id) => {
    const acc = savings.find((a) => a.id === id);
    askConfirm(`¿Eliminar esta cuenta de ahorro${acc ? ` "${acc.name}"` : ''}? Se perderá su historial de movimientos.`, () => withUndo('Cuenta de ahorro eliminada', () => {
      persist({ savings: savings.filter((a) => a.id !== id) });
    }));
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
    setCardPreviewFlippedNew(false);
    setSheet({ type: 'new-location' });
  };

  // Cuando una tarjeta de crédito se sobregira (el monto capturado supera su
  // límite), esto la convierte en una cuenta por pagar (CxP) ligada a esa
  // tarjeta: si ya estaba vinculada a un préstamo, solo actualiza su saldo
  // para que coincida con el monto de la tarjeta (así, cada vez que se
  // captura a mano el nuevo saldo con intereses, el préstamo se actualiza
  // solo); si no tenía préstamo vinculado, crea uno nuevo automáticamente.
  // Regresa { compromisos, prestamoId } con la lista ya actualizada y el id
  // que debe quedar guardado en la ubicación (tarjeta).
  const syncCardPrestamo = (loc, monto, limite, esCredito, prestamoIdField, baseCompromisos) => {
    if (!esCredito || !limite) return { compromisos: baseCompromisos, prestamoId: null };
    const sobregirada = monto > limite + 0.01;
    let prestamoId = prestamoIdField || null;
    let next = baseCompromisos;
    const yaVinculado = prestamoId && next.some((c) => c.id === prestamoId && c.kind === 'deuda');
    if (yaVinculado) {
      next = next.map((c) => {
        if (c.id !== prestamoId) return c;
        const from = c.balance != null ? c.balance : c.amount;
        if (Math.abs(from - monto) < 0.01) return c; // sin cambios, no ensucia el historial de ajustes
        const adjustment = { id: uid(), date: todayStr(), from, to: monto, note: 'Sincronizado con el saldo de la tarjeta', autor: profile?.name || 'Familia' };
        return { ...c, balance: monto, adjustments: [...(c.adjustments || []), adjustment] };
      });
    } else if (sobregirada) {
      const newId = uid();
      next = [...next, {
        id: newId, kind: 'deuda', category: 'banco',
        name: `Tarjeta ${loc?.nombre || ''} · sobregiro`.trim(),
        amount: monto, balance: monto, payments: [], adjustments: [], carryOver: 0,
      }];
      prestamoId = newId;
    }
    return { compromisos: next, prestamoId };
  };

  const submitLocation = () => {
    if (!locForm.persona.trim()) return setLocError('Elige o escribe a quién pertenece.');
    if (locForm.tipo === 'tarjeta') {
      if (!locForm.nombre.trim()) return setLocError('Ponle un alias a la tarjeta (ej. Tarjeta de nómina).');
      const clabeDigits = locForm.clabe.replace(/\D/g, '');
      const cardDigits = locCardNumber.replace(/\D/g, '');
      if (clabeDigits.length !== 18 && cardDigits.length < 4) {
        return setLocError('Captura tu CLABE (18 dígitos) o al menos los últimos 4 dígitos de tu número de tarjeta.');
      }
    }
    const monto = toNumber(locForm.monto);
    const esCredito = locForm.tipo === 'tarjeta' && locForm.esCredito;
    const limite = esCredito ? toNumber(locForm.limite) || null : null;
    const newLocId = uid();
    const { compromisos: nextCompromisos, prestamoId } = syncCardPrestamo({ id: newLocId, nombre: locForm.nombre }, monto, limite, esCredito, locForm.prestamoId, compromisos);
    const next = [...moneyLocations, {
      id: newLocId, persona: locForm.persona.trim(), tipo: locForm.tipo,
      nombre: locForm.tipo === 'tarjeta' ? locForm.nombre.trim() : (locForm.nombre.trim() || null),
      monto,
      esCredito,
      limite,
      diaCorte: esCredito && locForm.diaCorte ? parseInt(locForm.diaCorte, 10) : null,
      diaPago: esCredito && locForm.diaPago ? parseInt(locForm.diaPago, 10) : null,
      ultimos4: locForm.tipo === 'tarjeta' ? locForm.ultimos4.replace(/\D/g, '').slice(0, 4) || null : null,
      red: locForm.tipo === 'tarjeta' ? (locForm.red || null) : null,
      clabe: locForm.tipo === 'tarjeta' ? (locForm.clabe.replace(/\D/g, '').slice(0, 18) || null) : null,
      montoAPagar: esCredito ? toNumber(locForm.montoAPagar) || null : null,
      prestamoId: esCredito ? (prestamoId || locForm.prestamoId || null) : null,
    }];
    persist({ moneyLocations: next, compromisos: nextCompromisos });
    setSheet(null);
  };

  const openEditLocation = (loc) => {
    setEditLocForm({ monto: String(loc.monto), nombre: loc.nombre || '', esCredito: !!loc.esCredito, limite: loc.limite != null ? String(loc.limite) : '', diaCorte: loc.diaCorte != null ? String(loc.diaCorte) : '', diaPago: loc.diaPago != null ? String(loc.diaPago) : '', ultimos4: loc.ultimos4 || '', red: loc.red || '', clabe: loc.clabe || '', montoAPagar: loc.montoAPagar != null ? String(loc.montoAPagar) : '', prestamoId: loc.prestamoId || '' });
    setEditLocCardNumber('');
    setEditLocError('');
    setCardPreviewFlippedEdit(false);
    setSheet({ type: 'edit-location', location: loc });
  };

  const submitEditLocation = () => {
    const loc = sheet.location;
    const monto = toNumber(editLocForm.monto);
    if (isNaN(monto)) return setEditLocError('Ingresa un monto válido.');
    const esCredito = loc.tipo === 'tarjeta' && editLocForm.esCredito;
    const limite = esCredito ? toNumber(editLocForm.limite) || null : null;
    const { compromisos: nextCompromisos, prestamoId } = syncCardPrestamo(loc, monto, limite, esCredito, editLocForm.prestamoId, compromisos);
    const next = moneyLocations.map((l) => l.id === loc.id ? {
      ...l, monto, nombre: editLocForm.nombre.trim() || l.nombre,
      esCredito,
      limite,
      diaCorte: esCredito && editLocForm.diaCorte ? parseInt(editLocForm.diaCorte, 10) : null,
      diaPago: esCredito && editLocForm.diaPago ? parseInt(editLocForm.diaPago, 10) : null,
      ultimos4: loc.tipo === 'tarjeta' ? (editLocForm.ultimos4.replace(/\D/g, '').slice(0, 4) || null) : null,
      red: loc.tipo === 'tarjeta' ? (editLocForm.red || null) : null,
      clabe: loc.tipo === 'tarjeta' ? (editLocForm.clabe.replace(/\D/g, '').slice(0, 18) || null) : null,
      montoAPagar: esCredito ? toNumber(editLocForm.montoAPagar) || null : null,
      prestamoId: esCredito ? (prestamoId || editLocForm.prestamoId || null) : null,
    } : l);
    persist({ moneyLocations: next, compromisos: nextCompromisos });
    setSheet(null);
  };

  const deleteLocation = (id) => {
    const loc = moneyLocations.find((l) => l.id === id);
    askConfirm(`¿Eliminar esta ubicación${loc ? ` (${loc.persona} · ${loc.tipo === 'tarjeta' ? loc.nombre : 'Monedero'})` : ''}?`, () => withUndo('Ubicación eliminada', () => {
      persist({ moneyLocations: moneyLocations.filter((l) => l.id !== id) });
    }));
  };

  // ---------- presupuestos por categoría (mensual) ----------
  const openBudgetEdit = (catId) => {
    const linkedIds = savingsLinksFor(catId);
    const linkedTotalTarget = linkedIds.reduce((s, id) => s + (savings.find((a) => a.id === id)?.target || 0), 0);
    // Si ya está vinculado a una o más cuentas de ahorro y nunca se capturó
    // un presupuesto aparte, se precarga con la suma de sus metas en vez de
    // dejarlo en 0 — las metas de esas cuentas y el presupuesto de la
    // categoría representan lo mismo, así que no hay por qué pedirla dos veces.
    setBudgetAmount(budgets[catId] ? String(budgets[catId]) : (linkedTotalTarget ? String(linkedTotalTarget) : ''));
    setBudgetSavingsChoices(linkedIds);
    setSheet({ type: 'budget-cat', catId });
  };
  const submitBudget = () => {
    const catId = sheet.catId;
    let amt = toNumber(budgetAmount);
    // Si hay cuentas de ahorro elegidas y no se escribió un presupuesto a
    // mano, se usa la suma de sus metas como presupuesto.
    if (!amt && budgetSavingsChoices.length > 0) {
      amt = budgetSavingsChoices.reduce((s, id) => s + (savings.find((a) => a.id === id)?.target || 0), 0);
    }
    const next = { ...budgets };
    if (!amt || amt <= 0) delete next[catId]; else next[catId] = amt;
    const nextLinks = { ...budgetSavingsLinks };
    if (budgetSavingsChoices.length > 0) nextLinks[catId] = budgetSavingsChoices; else delete nextLinks[catId];
    persist({ budgets: next, budgetSavingsLinks: nextLinks });
    setSheet(null);
  };

  // ---------- foto de perfil ----------
  // Se guarda como dataURL (base64) compartido, así todos en la familia ven
  // la foto de los demás. Se reduce a 160x160 antes de guardarla para que no
  // pese — una foto de cámara completa sería demasiado para guardar así.
  const [photoUploading, setPhotoUploading] = useState(false);
  const uploadProfilePhoto = (name, file) => {
    if (!file) return;
    setPhotoUploading(true);
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        persist({ profilePhotos: { ...profilePhotos, [name]: dataUrl } });
        setPhotoUploading(false);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  const removeProfilePhoto = (name) => {
    const next = { ...profilePhotos };
    delete next[name];
    persist({ profilePhotos: next });
  };

  const markPersonPaid = (name, receivedAmount) => {
    let owed = 0;
    const key = name.trim().toLowerCase();
    const nextTx = transactions.map((t) => {
      if (!t.shared) return t;
      let changed = false;
      const parts = t.shared.participants.map((p) => {
        if (!p.paid && p.name.trim().toLowerCase() === key) { changed = true; owed += p.amount; return { ...p, paid: true }; }
        return p;
      });
      return changed ? { ...t, shared: { ...t.shared, participants: parts } } : t;
    });
    // También liquida lo que venga de pagos hechos vinculando la cuenta
    // desde "+" (que guardan su reparto en payment.participants) y que esta
    // misma tarjeta ya está sumando — si no, "Pagó" nunca lograría bajar el
    // pendiente de esos casos y la persona se quedaría marcada para siempre.
    const nextCompromisos = compromisos.map((c) => {
      let changed = false;
      const payments = (c.payments || []).map((p) => {
        if (!p.participants || !p.participants.length) return p;
        const tx = nextTx.find((t) => t.paymentId === p.id);
        if (tx?.shared) return p; // esto ya se contó y liquidó arriba
        let pChanged = false;
        const participants = p.participants.map((pp) => {
          if (!pp.paid && pp.name.trim().toLowerCase() === key) { pChanged = true; changed = true; owed += pp.amount; return { ...pp, paid: true }; }
          return pp;
        });
        return pChanged ? { ...p, participants } : p;
      });
      return changed ? { ...c, payments } : c;
    });
    // Lo normal es cobrar exactamente lo que se le debía (owed). Pero si
    // recibiste más de eso (ej. redondeaste el cobro), el excedente no es
    // "recuperar tu dinero" — es una entrada nueva, así que se separa como
    // ingreso extra en vez de mezclarse con la cobranza.
    const amt = receivedAmount != null && receivedAmount > 0 ? receivedAmount : owed;
    const base = Math.min(amt, owed);
    const excess = Math.max(0, amt - owed);
    const extraTx = [];
    if (base > 0) extraTx.push({ id: uid(), type: 'ingreso', category: 'cobranza', amount: base, note: `Cobro compartido de ${name}`, date: todayStr(), autor: profile?.name || 'Familia' });
    if (excess > 0.005) extraTx.push({ id: uid(), type: 'ingreso', category: 'otros_ing', amount: excess, note: `Excedente al cobrarle a ${name}`, date: todayStr(), autor: profile?.name || 'Familia' });
    const withIncome = extraTx.length ? [...nextTx, ...extraTx] : nextTx;
    persist({ transactions: withIncome, compromisos: nextCompromisos });
  };

  // Marca/desmarca a UN participante de UN pago puntual, desde el detalle de
  // un gasto compartido (ej. "Ana ya me pagó lo de Netflix de julio"). A
  // diferencia de "Pagó" (que junta y registra un ingreso por todo lo
  // pendiente de esa persona), este es solo un marcador manual: no crea
  // ningún movimiento nuevo, para no duplicar el ingreso si luego también
  // usas "Pagó". Sirve tanto para pagos hechos con "Abonar" (reparto en la
  // transacción) como para los hechos vinculando la cuenta desde "+"
  // (reparto guardado en el pago del compromiso) — por eso recibe también
  // compromisoId y paymentId, por si hace falta ir a buscarlo ahí.
  const toggleTxParticipantPaid = (txId, participantId, compromisoId, paymentId) => {
    if (txId) {
      const nextTx = transactions.map((t) => {
        if (t.id !== txId || !t.shared) return t;
        const participants = t.shared.participants.map((p) => (p.id === participantId ? { ...p, paid: !p.paid } : p));
        return { ...t, shared: { ...t.shared, participants } };
      });
      persist({ transactions: nextTx });
      return;
    }
    // Fuente 2: el reparto vive en compromiso.payments (sin tx.shared). Esos
    // participantes no traen "id" propio (se guardaron como {name, amount}
    // nada más), así que aquí los identificamos por su posición en la lista.
    const nextCompromisos = compromisos.map((c) => {
      if (c.id !== compromisoId) return c;
      const payments = c.payments.map((p) => {
        if (p.id !== paymentId) return p;
        const participants = p.participants.map((pp, i) => (i === participantId ? { ...pp, paid: !pp.paid } : pp));
        return { ...p, participants };
      });
      return { ...c, payments };
    });
    persist({ compromisos: nextCompromisos });
  };

  const clearAll = async () => { await persist({ transactions: [], compromisos: [], savings: [], moneyLocations: [] }); setSettingsOpen(false); };

  // Sale del grupo/código de familia actual: borra el código y el perfil de
  // este celular (los datos compartidos siguen intactos para el resto de la
  // familia) y recarga la app para volver a la pantalla de bienvenida, donde
  // se puede entrar a otro código o crear una familia nueva.
  const leaveFamily = async () => {
    askConfirm('¿Salir de esta familia en este celular? Dejarás de ver y compartir estos movimientos. Podrás volver a entrar con el mismo código cuando quieras.', async () => {
      try { await window.storage.delete('miPerfil', false); } catch (e) { /* sigue igual */ }
      window.libroDiario.clearFamilyCode();
      window.location.reload();
    }, { confirmLabel: 'Salir' });
  };

  // Respaldo manual: descarga todo lo compartido de la familia como un
  // archivo .json en el celular, por si algo le pasa a Firebase o al
  // código de familia. Se puede volver a cargar con "Importar respaldo".
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const backupInputRef = useRef(null);
  const exportBackup = () => {
    const data = { version: 1, exportedAt: new Date().toISOString(), familyName, transactions, compromisos, savings, moneyLocations, familia };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `libro-diario-respaldo-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  // Arma el link "Agregar a Google Calendar" para un evento de un solo día
  // (sin necesitar cuenta de API ni OAuth: es el mismo truco que usan los
  // botones "Add to Calendar" de cualquier página de eventos).
  const gcalUrl = (title, dateStr, details) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const start = `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
    const next = new Date(y, m - 1, d + 1);
    const end = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
    const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${start}/${end}`, details: details || '' });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };
  // Exporta todos los eventos (pagos/ingresos fijos pendientes) de un mes
  // como un .ics estándar, para importarlo de un jalón a Google Calendar (o
  // cualquier otro calendario): Google Calendar › Ajustes › Importar.
  const downloadCalMonthIcs = (monthKey) => {
    const events = eventsForCalMonth(monthKey);
    const pad = (n) => String(n).padStart(2, '0');
    const esc = (s) => String(s).replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
    const now = new Date();
    const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Libro Diario//ES\r\nCALSCALE:GREGORIAN\r\n';
    events.forEach((ev) => {
      const [y, m, d] = ev.date.split('-').map(Number);
      const startNum = `${y}${pad(m)}${pad(d)}`;
      const next = new Date(y, m - 1, d + 1);
      const endNum = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
      const isIngreso = ev.compromiso.kind === 'ingreso_fijo';
      ics += 'BEGIN:VEVENT\r\n';
      ics += `UID:${ev.compromiso.id}-${startNum}@libro-diario\r\n`;
      ics += `DTSTAMP:${dtstamp}\r\n`;
      ics += `DTSTART;VALUE=DATE:${startNum}\r\n`;
      ics += `DTEND;VALUE=DATE:${endNum}\r\n`;
      ics += `SUMMARY:${esc(`${isIngreso ? 'Ingreso' : 'Pago'} · ${ev.compromiso.name} (${fmt(ev.compromiso.amount)})`)}\r\n`;
      ics += 'END:VEVENT\r\n';
    });
    ics += 'END:VCALENDAR\r\n';
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `libro-diario-calendario-${monthKey}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const importBackup = async (file) => {
    setBackupMsg('');
    setBackupBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object') throw new Error('Archivo inválido');
      askConfirm('¿Reemplazar los datos compartidos de la familia con lo que hay en este respaldo? Esto afecta a todos los que usan el mismo código.', () => {
        withUndo('Respaldo restaurado', () => {
          persist({
            transactions: Array.isArray(data.transactions) ? data.transactions : [],
            compromisos: Array.isArray(data.compromisos) ? data.compromisos : [],
            savings: Array.isArray(data.savings) ? data.savings : [],
            moneyLocations: Array.isArray(data.moneyLocations) ? data.moneyLocations : [],
            familia: Array.isArray(data.familia) ? data.familia : familia,
            familyName: typeof data.familyName === 'string' ? data.familyName : familyName,
          });
        });
        setBackupMsg('Respaldo restaurado.');
        setBackupBusy(false);
      }, { confirmLabel: 'Reemplazar', onCancel: () => setBackupBusy(false) });
    } catch (e) {
      setBackupMsg('No se pudo leer ese archivo de respaldo.');
      setBackupBusy(false);
    }
  };

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
    const hoyStr = todayStr();
    compromisosView.filter((c) => (c.kind === 'fijo' || c.kind === 'ingreso_fijo') && c.pendiente > 0.01).forEach((c) => {
      const freq = c.recurFreq || 'mensual';
      let flagKey;
      if (freq === 'mensual') {
        if (!c.notifyDay || c.notifyDay !== day) return;
        flagKey = `libroDiario:notified:${c.id}:${period}`;
      } else if ((freq === 'semanal' || freq === 'quincenal') && c.anchorDate) {
        const every = freq === 'semanal' ? 7 : 14;
        if (diasHastaRecurrencia(c.anchorDate, every) !== 0) return;
        // Dedup por día (no por mes): así puede volver a avisar la próxima semana/quincena.
        flagKey = `libroDiario:notified:${c.id}:${hoyStr}`;
      } else {
        return; // diario, o semanal/quincenal sin fecha de referencia configurada: no hay recordatorio.
      }
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

  const [codeCopied, setCodeCopied] = useState(false);
  const copyFamilyCode = async (code) => {
    const value = code || familyCode;
    try {
      await navigator.clipboard.writeText(value);
    } catch (e) {
      // Si el navegador no deja usar el portapapeles (poco común), lo
      // seleccionamos a mano como respaldo.
      try {
        const ta = document.createElement('textarea');
        ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      } catch (e2) { return; }
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1800);
  };

  const allGastoCats = useMemo(() => [...GASTO_CATS, ...customCategories.filter((c) => c.type === 'gasto')], [customCategories]);
  const allIngresoCats = useMemo(() => [...INGRESO_CATS, ...customCategories.filter((c) => c.type === 'ingreso')], [customCategories]);
  const catOptions = txForm.type === 'ingreso' ? allIngresoCats : allGastoCats;
  const editCatOptions = editTxForm.type === 'ingreso' ? allIngresoCats : allGastoCats;
  const catByIdAny = (id) => [...ALL_CATS, ...customCategories].find((c) => c.id === id) || { id, label: id, icon: 'MoreHorizontal', color: '#9C8672' };
  const isCustomCat = (id) => customCategories.some((c) => c.id === id);
  const cuentaOfAny = (catId) => CUENTA_CONTABLE[catId] || {
    codigo: allIngresoCats.some((c) => c.id === catId) ? '4900' : '5900',
    nombre: catByIdAny(catId).label,
    grupo: allIngresoCats.some((c) => c.id === catId) ? 'ingresos' : 'gastos',
  };
  const submitNewCategory = () => {
    const label = newCatDraft.label.trim();
    if (!label) return setNewCatError('Ponle un nombre a la categoría.');
    const id = 'custom_' + uid();
    setNewCatError('');
    addCustomCategory({ id, type: newCatDraft.type, label, icon: newCatDraft.icon, color: newCatDraft.color });
    setNewCatDraft({ type: newCatDraft.type, label: '', icon: newCatDraft.icon, color: newCatDraft.color });
  };
  const metaFor = (id) => categoryMeta[id] || { description: '', subItems: [] };
  const addCustomCategory = (cat) => {
    persist({ customCategories: [...customCategories, cat] });
  };
  const removeCustomCategory = (id) => {
    const { [id]: _drop, ...restMeta } = categoryMeta;
    persist({ customCategories: customCategories.filter((c) => c.id !== id), categoryMeta: restMeta });
  };
  const updateCustomCategoryLabel = (id, label) => {
    persist({ customCategories: customCategories.map((c) => c.id === id ? { ...c, label } : c) });
  };
  const updateCategoryDescription = (id, description) => {
    persist({ categoryMeta: { ...categoryMeta, [id]: { ...metaFor(id), description } } });
  };
  const addCategorySubItem = (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = metaFor(id).subItems || [];
    if (current.includes(trimmed)) return;
    persist({ categoryMeta: { ...categoryMeta, [id]: { ...metaFor(id), subItems: [...current, trimmed] } } });
  };
  const removeCategorySubItem = (id, name) => {
    const current = metaFor(id).subItems || [];
    persist({ categoryMeta: { ...categoryMeta, [id]: { ...metaFor(id), subItems: current.filter((s) => s !== name) } } });
  };
  const addParticipant = () => setTxForm((f) => ({ ...f, participants: [...f.participants, { id: uid(), name: '', amount: '' }] }));
  const updateParticipant = (id, patch) => setTxForm((f) => ({ ...f, participants: f.participants.map((p) => p.id === id ? { ...p, ...patch } : p) }));
  const removeParticipant = (id) => setTxForm((f) => ({ ...f, participants: f.participants.filter((p) => p.id !== id) }));
  const addEditParticipant = () => setEditTxForm((f) => ({ ...f, participants: [...f.participants, { id: uid(), name: '', amount: '', paid: false }] }));
  const updateEditParticipant = (id, patch) => setEditTxForm((f) => ({ ...f, participants: f.participants.map((p) => p.id === id ? { ...p, ...patch } : p) }));
  const removeEditParticipant = (id) => setEditTxForm((f) => ({ ...f, participants: f.participants.filter((p) => p.id !== id) }));
  const myShare = txForm.amount ? Math.max(0, toNumber(txForm.amount) - txForm.participants.reduce((s, p) => s + toNumber(p.amount), 0)) : 0;

// Atajo desde el icono de la app (Android: mantener presionado el ícono)
  // o desde un acceso directo de iOS Shortcuts que abra index.html?accion=gasto
  //
  // A propósito NO borramos el parámetro de la URL: como este ícono vive
  // guardado en la pantalla de inicio con esta URL fija, cada vez que se abre
  // vuelve a cargar la misma página desde cero — así que queremos que SIEMPRE
  // dispare el formulario, no solo la primera vez.
  useEffect(() => {
    if (loading || onboarding) return;
    const params = new URLSearchParams(window.location.search);
    const accion = params.get('accion');
    if (accion === 'gasto' || accion === 'ingreso') {
      openAddTx(accion === 'ingreso' ? 'ingreso' : 'gasto');
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

  // Selector de "¿de dónde sale / a dónde cae el dinero?" agrupado por
  // familiar (igual que en la pestaña Tarjetas), para no repetir el nombre
  // de la persona en cada tarjeta/monedero cuando tiene varias cuentas.
  // Muestra la foto de perfil de esa persona si ya subió una; si no, cae en
  // el circulito de siempre con su inicial y color.
  const avatarNode = (name, size = 26, fontSize) => profilePhotos[name]
    ? <img src={profilePhotos[name]} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div className="mini-avatar" style={{ width: size, height: size, fontSize: fontSize || Math.round(size * 0.46), background: colorForName(name) }}>{name.charAt(0).toUpperCase()}</div>;

  const renderLocationPicker = (list, selectedId, onSelect) => {
    const order = [];
    const grouped = {};
    list.forEach((l) => {
      if (!grouped[l.persona]) { grouped[l.persona] = []; order.push(l.persona); }
      grouped[l.persona].push(l);
    });
    return order.map((persona) => (
      <div key={persona} style={{ marginBottom: 10 }}>
        <div className="location-group-header">
          <div className="person-avatar" style={{ width: 20, height: 20, fontSize: 10, background: colorForName(persona) }}>{persona.charAt(0).toUpperCase()}</div>
          <span>{persona}</span>
        </div>
        <div className="cat-grid">
          {grouped[persona].map((l) => (
            <div
              key={l.id}
              className={`cat-choice ${selectedId === l.id ? 'selected' : ''}`}
              onClick={() => onSelect(l.id)}
            >
              <div className="cat-choice-icon" style={{ background: l.tipo === 'tarjeta' ? '#3E6EA5' : '#5F8A4C' }}><Icon name={l.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={15} /></div>
              <span className="cat-choice-label">{l.tipo === 'tarjeta' ? `${l.nombre || 'Tarjeta'}${l.esCredito != null ? ` · ${l.esCredito ? 'Crédito' : 'Débito'}` : ''}` : 'Monedero'}</span>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className={`ledger-app ${darkMode ? 'dark' : ''}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        @property --nav-border-angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: -75deg;
        }
        html, body { background: var(--paper-dim); }
        .ledger-app {
          --paper: #FAFAFA; --paper-dim: #EFEFF2; --ink: #1C1C1E; --ink-soft: #6E6E73;
          --green: #1E3D32; --green-soft: #2C5645; --gold: #C29B3E; --income: #2E7D5B;
          --expense: #B0432E; --line: #E3E3E7; --mono: ui-monospace, 'SF Mono', 'IBM Plex Mono', monospace;
          --sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'IBM Plex Sans', sans-serif;
          --shadow-card: 0 1px 1px rgba(0,0,0,0.03), 0 4px 14px rgba(0,0,0,0.055);
          --shadow-sheet: 0 -4px 30px rgba(0,0,0,0.12);
          /* Texto/fondo claro que va ENCIMA del verde (panel superior, botones,
             chips activos, etc.): siempre debe leerse claro sobre ese verde,
             sin importar si el resto de la app está en modo claro u oscuro —
             por eso es una variable fija, no la misma que --paper (que sí
             cambia de blanco a oscuro en modo oscuro). */
          --on-accent: #FAFAFA;
          font-family: var(--sans); color: var(--ink); background: var(--paper-dim);
          width: 100%; max-width: 460px; margin: 0 auto; height: 100vh; height: 100dvh; display: flex; flex-direction: column;
          position: relative; box-shadow: 0 0 40px rgba(0,0,0,0.08); overflow: hidden;
        }
        .ledger-app.dark {
          --paper: #1C1F1C; --paper-dim: #121412; --ink: #ECECE6; --ink-soft: #96968D;
          --green-soft: #2C5645; --income: #4FC08C; --expense: #E2735A; --line: #33362F;
          --shadow-card: 0 1px 1px rgba(0,0,0,0.2), 0 4px 14px rgba(0,0,0,0.35);
          --shadow-sheet: 0 -4px 30px rgba(0,0,0,0.55);
          box-shadow: 0 0 40px rgba(0,0,0,0.4);
        }
        .appearance-row { display: flex; gap: 10px; margin-top: 10px; }
        .appearance-opt { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 7px; background: none; border: none; cursor: pointer; padding: 0; -webkit-tap-highlight-color: transparent; }
        .appearance-preview { width: 100%; aspect-ratio: 4 / 3; border-radius: 12px; border: 2.5px solid rgba(130,130,130,0.35); position: relative; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06); transition: border-color 0.15s; }
        .appearance-opt.active .appearance-preview { border-color: var(--gold); box-shadow: 0 2px 6px rgba(0,0,0,0.15), 0 0 0 1px rgba(194,155,62,0.25); }
        .appearance-preview.light { background: #fff; }
        .appearance-preview.dark { background: #1C1F1C; }
        .appearance-preview.system { background: linear-gradient(135deg, #fff 0%, #fff 50%, #1C1F1C 50%, #1C1F1C 100%); }
        .appearance-lines { position: absolute; top: 16%; left: 12%; width: 55%; z-index: 1; }
        .appearance-preview.light .appearance-line { background: #9A9A9A; }
        .appearance-preview.dark .appearance-line { background: #6E6E73; }
        .appearance-preview.system .appearance-line { background: #7A7A7A; }
        .appearance-line { height: 3px; border-radius: 2px; margin-bottom: 5px; }
        .appearance-dot { position: absolute; bottom: 10%; right: 10%; width: 16%; aspect-ratio: 1; border-radius: 50%; background: #C97B53; z-index: 1; }
        .appearance-label { font-size: 12px; font-weight: 600; color: var(--ink-soft); }
        .appearance-opt.active .appearance-label { color: var(--gold); }
        .ledger-app.dark .bottom-nav { background: linear-gradient(-75deg, rgba(255,255,255,0.03), rgba(255,255,255,0.12), rgba(255,255,255,0.03)), rgba(28,31,28,0.68); box-shadow: inset 0 0.09em 0.09em rgba(0,0,0,0.3), inset 0 -0.09em 0.09em rgba(255,255,255,0.08), 0 10px 28px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.06); }
        .ledger-app.dark .bottom-nav::after { background: conic-gradient(from var(--nav-border-angle) at 50% 50%, rgba(0,0,0,0.5), rgba(0,0,0,0) 5% 40%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 60% 95%, rgba(0,0,0,0.5)), linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.14)); }
        .ledger-app.dark .nav-highlight { background: rgba(255,255,255,0.1); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.3); }
        .ledger-app.dark .nav-popover { background: rgba(28,31,28,0.92); border-color: rgba(255,255,255,0.1); }
        /* El verde de marca (var(--green)) se queda fijo a propósito (es el
           mismo verde del panel superior en ambos temas), pero por eso el
           texto/fondos que lo usaban para "texto o acento sutil sobre una
           tarjeta" se perdían en modo oscuro (verde oscuro sobre fondo
           oscuro). Aquí se aclaran solo esos casos puntuales. */
        .ledger-app.dark .kind-badge.deuda { background: rgba(143,217,182,0.16); color: #8FD9B6; }
        .ledger-app.dark .kind-badge.fijo { background: rgba(232,197,107,0.18); color: #E8C56B; }
        .ledger-app.dark .danger-btn.neutral { color: #8FD9B6; }
        .ledger-app.dark .add-participant-btn { color: #8FD9B6; }
        .ledger-app.dark .cat-choice-row.active { color: #8FD9B6; border-color: #8FD9B6; }
        .ledger-app.dark .mark-paid-btn { color: #8FD9B6; }
        .ledger-app.dark .compromiso-card.selected { border-color: #8FD9B6; background: rgba(143,217,182,0.08); }
        .ledger-app.dark .text-input:focus { border-color: #8FD9B6; }
        /* En pantallas anchas (PC / tablet / celular en horizontal con espacio
           de sobra) el "teléfono" se queda a su ancho normal, centrado, pero
           con espacio a los costados en vez de estirarse feo o perder forma. */
        @media (min-width: 600px) and (pointer: fine) {
          html, body { background: linear-gradient(180deg, #E7E4DB, #DDD9CC); }
          .ledger-app { max-width: 430px; height: min(100vh, 900px); height: min(100dvh, 900px); margin: max(16px, 2vh) auto; border-radius: 28px; box-shadow: 0 30px 60px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04); }
        }
        /* En PC de verdad (pantallas anchas de escritorio) ya no hace falta
           fingir que es un celular angosto: se usa más del espacio real de
           la ventana, en vez de quedar una tarjeta chiquita perdida en medio
           de tanto fondo vacío. */
        @media (min-width: 900px) and (pointer: fine) {
          .ledger-app { max-width: min(600px, 92vw); }
        }
        /* Celular en horizontal: la pantalla es baja, así que compactamos el
           encabezado para que quede espacio real para el contenido. */
        @media (orientation: landscape) and (max-height: 520px) {
          .masthead { padding: calc(10px + env(safe-area-inset-top, 0px)) 20px 0 20px; border-radius: 0 0 14px 14px; }
          .balance-block { margin-top: 8px; }
          .balance-amount { font-size: clamp(20px, 6vw, 28px); margin-top: 2px; }
          .balance-label { font-size: 11px; }
          .ahorro-line { margin-top: 0; }
          .period-tabs { margin-top: 8px; }
          .period-chip { padding: 5px 10px; font-size: 11px; }
          .family-name-line { font-size: 11px; margin-top: 2px; }
          .content { padding-bottom: 110px; }
        }
        .masthead { background: var(--green); color: var(--on-accent); padding: calc(14px + env(safe-area-inset-top, 0px)) 20px 14px 20px; border-radius: 0 0 20px 20px; flex-shrink: 0; }
        .masthead-top { display: flex; align-items: center; justify-content: space-between; }
        .family-name-line { font-family: var(--mono); font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: var(--gold); margin-top: 4px; text-transform: uppercase; }
        .brand { font-family: var(--mono); font-size: 13px; letter-spacing: 3px; font-weight: 600; text-transform: uppercase; opacity: 0.85; }
        .brand .dot { color: var(--gold); margin: 0 6px; }
        .icon-btn { background: rgba(255,255,255,0.1); border: none; color: var(--on-accent); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .icon-btn:hover { background: rgba(255,255,255,0.18); }
        .balance-block { margin-top: 10px; }
        .balance-label { font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 1.5px; }
        .balance-amount { font-family: var(--mono); font-weight: 700; font-size: calc(clamp(24px, 7vw, 30px) - 8px * var(--collapse)); margin-top: 2px; letter-spacing: -0.5px; overflow-wrap: break-word; }
        .balance-amount.pos { color: #8FD9B6; } .balance-amount.neg { color: #F0A98F; }
        .ahorro-line { font-size: 11px; opacity: 0.75; margin-top: 1px; display: flex; align-items: center; gap: 5px; font-family: var(--mono); }
        .hoy-chip { margin-top: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.16); color: var(--on-accent); font-family: var(--mono); font-size: 12px; font-weight: 700; padding: 7px 12px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .hoy-chip-sub { font-weight: 400; opacity: 0.75; font-size: 10.5px; }
        .period-tabs { display: flex; gap: 6px; margin-top: 10px; }
        .period-chip { font-family: var(--sans); font-size: 12px; font-weight: 500; padding: 5px 11px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.25); background: transparent; color: rgba(255,255,255,0.75); cursor: pointer; }
        .period-chip.active { background: var(--on-accent); color: var(--green); border-color: var(--on-accent); font-weight: 600; }
        .stub-row { display: flex; gap: 8px; margin-top: 10px; padding-bottom: 12px; }
        .stub { flex: 1; min-width: 0; background: rgba(255,255,255,0.08); border-radius: 12px; padding: 8px 8px; display: flex; align-items: center; gap: 6px; overflow: hidden; }
        .stub-icon { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        /* Al hacer scroll hacia abajo en el contenido, el panel verde se
           encoge de forma continua y proporcional (--collapse va de 0 a 1
           según cuánto scrolleaste), no de golpe: oculta gradualmente
           "Ahorrado" e Ingresos/Gastos, y el monto se achica suave.
           Se hace en dos tiempos para que nunca se vea "cortado": primero
           (mitad del recorrido) se desvanece el texto por completo, y solo
           DESPUÉS de que ya es invisible se reduce el espacio que ocupaba. */
        .masthead { --collapse: 0; }
        .ahorro-line { opacity: calc(1 - min(1, var(--collapse) * 2)); max-height: calc(20px * (1 - max(0, (var(--collapse) - 0.5) * 2))); overflow: hidden; transition: none; }
        .hoy-chip { opacity: calc(1 - min(1, var(--collapse) * 2)); max-height: calc(34px * (1 - max(0, (var(--collapse) - 0.5) * 2))); overflow: hidden; transition: none; }
        .stub-row { opacity: calc(1 - min(1, var(--collapse) * 2)); max-height: calc(90px * (1 - max(0, (var(--collapse) - 0.5) * 2))); margin-top: calc(10px * (1 - max(0, (var(--collapse) - 0.5) * 2))); padding-bottom: calc(12px * (1 - max(0, (var(--collapse) - 0.5) * 2))); overflow: hidden; transition: none; }
        .period-tabs { margin-top: calc(10px - 2px * var(--collapse)); }
        .stub-icon.in { background: rgba(143,217,182,0.2); color: #8FD9B6; }
        .stub-icon.out { background: rgba(240,169,143,0.2); color: #F0A98F; }
        .stub-text { display: flex; flex-direction: column; min-width: 0; flex: 1; overflow: hidden; }
        .stub-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; opacity: 0.65; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stub-amount { font-family: var(--mono); font-size: clamp(10px, 3.2vw, 14px); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
        .tape-edge { height: 10px; background: linear-gradient(135deg, transparent 6px, var(--paper-dim) 0) 0 0, linear-gradient(-135deg, transparent 6px, var(--paper-dim) 0) 0 0; background-size: 12px 12px; background-repeat: repeat-x; background-color: var(--green); }
        .content { flex: 1; min-height: 0; padding: 16px 16px 150px 16px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .reveal-handle { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0 4px; margin-top: 2px; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; touch-action: none; }
        .reveal-handle * { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
        .reveal-handle-bar { width: 36px; height: 4px; border-radius: 2px; background: var(--line); transition: background 0.2s ease; }
        .reveal-handle.open .reveal-handle-bar { background: var(--gold); }
        .reveal-handle-label { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--ink-soft); font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; }
        .reveal-panel { max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.3s ease, opacity 0.25s ease, margin-top 0.3s ease, margin-bottom 0.3s ease; }
        .reveal-panel.open { max-height: 100px; opacity: 1; margin-top: 8px; }
        .reveal-handle-top { padding: 2px 0 8px; margin-top: -4px; }
        .reveal-panel.reveal-panel-top.open { max-height: 320px; margin-top: 0; margin-bottom: 10px; }
        .card { background: var(--paper); border-radius: 18px; padding: 16px; margin-bottom: 14px; border: 1px solid var(--line); box-shadow: none; }
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
        .month-nav-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .month-input { flex: 1; text-align: center; font-family: var(--mono); font-weight: 700; cursor: pointer; }
        .pin-input { text-align: center; font-size: 26px; letter-spacing: 12px; font-family: var(--mono); font-weight: 700; margin-bottom: 12px; }
        .filter-chip { font-size: 12px; padding: 6px 12px; border-radius: 20px; border: 1px solid var(--line); background: var(--paper); color: var(--ink-soft); white-space: nowrap; cursor: pointer; flex-shrink: 0; }
        .filter-chip.active { background: var(--green); border-color: var(--green); color: var(--on-accent); }
        .date-group { margin-bottom: 18px; }
        .date-heading { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--ink-soft); margin-bottom: 8px; padding-left: 2px; }
        .tx-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px dashed var(--line); cursor: pointer; border-radius: 8px; transition: background 0.12s; }
        .tx-row:last-child { border-bottom: none; }
        .tx-row:hover, .tx-row:active { background: var(--paper-dim); }
        .tx-icon { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: white; }
        .tx-mid { flex: 1; min-width: 0; }
        .tx-cat { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 5px; }
        .tx-note { font-size: 12px; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tx-amount { font-family: var(--mono); font-weight: 700; font-size: 14px; flex-shrink: 0; }
        .tx-amount.in { color: var(--income); } .tx-amount.out { color: var(--expense); }
        .tx-edit-hint { color: var(--ink-soft); opacity: 0.35; flex-shrink: 0; display: flex; }
        .shared-badge { font-size: 9px; background: var(--gold); color: var(--green); padding: 2px 6px; border-radius: 5px; font-weight: 700; letter-spacing: 0.5px; }
        .bottom-nav-shell {
          position: absolute; left: 10px; right: 10px; bottom: 0; z-index: 6;
          transition: left 0.3s cubic-bezier(0.32, 0.72, 0, 1), right 0.3s cubic-bezier(0.32, 0.72, 0, 1);
        }
        .bottom-nav-shell.nav-compact-shell { left: 44px; right: 44px; }
        .bottom-nav {
          position: relative;
          background: linear-gradient(-75deg, rgba(255,255,255,0.10), rgba(255,255,255,0.55), rgba(255,255,255,0.10)), rgba(250,250,250,0.55);
          -webkit-backdrop-filter: blur(22px) saturate(180%);
          backdrop-filter: blur(22px) saturate(180%);
          border: none;
          border-radius: 999px;
          display: flex; align-items: center;
          padding: 4px;
          box-shadow:
            inset 0 0.09em 0.09em rgba(0,0,0,0.05),
            inset 0 -0.09em 0.09em rgba(255,255,255,0.6),
            0 10px 28px rgba(0,0,0,0.16),
            inset 0 0 0 1px rgba(255,255,255,0.25);
          transition: padding 0.3s ease, box-shadow 0.3s ease, --nav-border-angle 500ms ease;
          -webkit-touch-callout: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;
        }
        .bottom-nav::after {
          content: '';
          position: absolute;
          z-index: 3;
          inset: -1px;
          border-radius: 999px;
          padding: 1px;
          box-sizing: border-box;
          background:
            conic-gradient(from var(--nav-border-angle) at 50% 50%,
              rgba(0,0,0,0.35), rgba(0,0,0,0) 5% 40%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0) 60% 95%, rgba(0,0,0,0.35)),
            linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.55));
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          transition: --nav-border-angle 500ms ease;
        }
        .bottom-nav:has(.nav-btn:active, .nav-fab-btn:active) { --nav-border-angle: -125deg; }
        @media (hover: none) and (pointer: coarse) {
          .bottom-nav::after, .bottom-nav:has(.nav-btn:active, .nav-fab-btn:active)::after { --nav-border-angle: -75deg; }
        }
        .bottom-nav.nav-compact { padding-top: 5px; padding-bottom: 5px; }
        .bottom-nav.nav-compact .nav-btn { font-size: 8px; padding: 5px 3px; gap: 2px; }
        .bottom-nav.nav-compact .nav-btn svg { transform: scale(0.8); }
        .bottom-nav.nav-compact .nav-fab-btn { padding: 5px 3px; }
        .bottom-nav.nav-compact .nav-fab-btn svg { transform: scale(0.8); }
        .bottom-nav.nav-compact .nav-highlight { height: 36px; }
        .nav-btn { position: relative; z-index: 1; background: none; border: none; display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; min-width: 0; gap: 4px; color: var(--ink-soft); font-size: 10px; font-weight: 600; padding: 8px 4px; border-radius: 999px; cursor: pointer; letter-spacing: 0.2px; text-transform: uppercase; transition: color 0.2s; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; touch-action: manipulation; }
        .nav-btn svg { transition: transform 0.25s; }
        .nav-btn.active { font-weight: 700; }
        .nav-btn-dot { position: absolute; top: 4px; right: calc(50% - 15px); width: 6px; height: 6px; border-radius: 50%; }
        .nav-tabs { position: relative; display: flex; width: 100%; min-width: 0; align-items: stretch; gap: 0; touch-action: none; -webkit-touch-callout: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
        .nav-highlight { position: absolute; top: 50%; left: 0; transform: translateY(-50%); height: 52px; border-radius: 999px; background: rgba(255,255,255,0.6); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.85), inset 0 0 0 1px rgba(255,255,255,0.4), 0 2px 8px rgba(0,0,0,0.08); transition: left 0.32s cubic-bezier(0.32, 0.72, 0, 1), width 0.32s cubic-bezier(0.32, 0.72, 0, 1); pointer-events: none; z-index: 0; }
        .nav-highlight.dragging { transition: none; }
        .nav-btn-wrap { position: relative; flex: 1; min-width: 0; display: flex; }
        .nav-popover-backdrop { position: fixed; inset: 0; z-index: 6; }
        .nav-popover { position: absolute; bottom: calc(100% + 10px); left: 0; z-index: 7; background: rgba(255,255,255,0.9); backdrop-filter: blur(16px) saturate(180%); -webkit-backdrop-filter: blur(16px) saturate(180%); border: 1px solid rgba(255,255,255,0.6); border-radius: 16px; padding: 5px; box-shadow: 0 10px 26px rgba(0,0,0,0.2); animation: navPopIn 0.16s ease-out; }
        @keyframes navPopIn { from { opacity: 0; transform: translateY(6px) scale(0.94); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .nav-popover-item { display: flex; align-items: center; gap: 7px; white-space: nowrap; background: none; border: none; color: var(--ink); font-family: var(--sans); font-size: 13px; font-weight: 600; padding: 9px 14px; border-radius: 12px; cursor: pointer; }
        .nav-popover-item:active { background: var(--paper-dim); }
        .nav-fab-btn { position: relative; z-index: 1; flex: 1; min-width: 0; background: none; color: var(--ink-soft); border: none; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px 4px; cursor: pointer; transition: transform 0.15s, color 0.2s; -webkit-tap-highlight-color: transparent; }
        .undo-toast { position: absolute; left: 50%; bottom: calc(88px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); background: var(--green); color: #fff; padding: 10px 8px 10px 16px; border-radius: 14px; display: flex; align-items: center; gap: 14px; font-size: 13px; box-shadow: 0 8px 22px rgba(0,0,0,0.28); z-index: 40; max-width: calc(100% - 32px); animation: undoIn 0.18s ease-out; }
        .undo-toast button { background: none; border: none; color: var(--gold); font-weight: 700; font-size: 13px; padding: 8px 10px; cursor: pointer; flex-shrink: 0; }
        @keyframes undoIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .nav-fab-btn:active { transform: scale(0.9); }
        .sheet-backdrop, .settings-panel { position: absolute; inset: 0; background: rgba(20,24,20,0.5); display: flex; align-items: flex-end; z-index: 10; padding-top: max(env(safe-area-inset-top, 0px), 14px); box-sizing: border-box; }
        .sheet, .settings-card { background: var(--paper); width: 100%; border-radius: 24px 24px 0 0; padding: 22px 18px calc(18px + env(safe-area-inset-bottom, 0px)) 18px; max-height: min(82dvh, 82vh); overflow-y: auto; overflow-x: hidden; box-shadow: var(--shadow-sheet); position: relative; box-sizing: border-box; }
        .settings-card { min-height: min(64dvh, 64vh); display: flex; flex-direction: column; }
        .sheet::before, .settings-card::before { content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 36px; height: 4px; border-radius: 3px; background: var(--line); pointer-events: none; }
        .sheet-handle { position: absolute; top: 0; left: 0; right: 0; height: 30px; touch-action: none; z-index: 5; }
        .sheet-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .sheet-title { font-family: var(--mono); font-weight: 700; font-size: 15px; letter-spacing: 0.5px; }
        .type-toggle { display: flex; background: var(--paper-dim); border-radius: 12px; padding: 4px; margin-bottom: 18px; }
        .type-toggle button { flex: 1; border: none; background: none; padding: 10px; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer; color: var(--ink-soft); display: flex; align-items: center; justify-content: center; gap: 6px; }
        .type-toggle button.active.ingreso { background: var(--income); color: white; }
        .type-toggle button.active.gasto { background: var(--expense); color: white; }
        .type-toggle button.active.deuda { background: var(--green); color: white; }
        .type-toggle button.active.fijo { background: var(--gold); color: var(--green); }
        .type-toggle button.active.deposito { background: var(--income); color: white; }
        .type-toggle button.active.retiro { background: var(--expense); color: white; }
        .field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-soft); font-weight: 600; margin: 14px 0 8px 0; }
        .field-row { display: flex; gap: 10px; }
        .field-row > div { flex: 1; min-width: 0; }
        .cat-manage-link { background: none; border: none; color: var(--income); font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; padding: 2px 0; }
        .cat-icon-picker { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
        .cat-icon-choice { width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--line); background: var(--paper-dim); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .cat-icon-choice.selected { border-color: transparent; }
        .cat-color-picker { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
        .cat-color-choice { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
        .cat-color-choice.selected { border-color: var(--ink); box-shadow: 0 0 0 2px var(--paper); }
        .picker-catcher { position: fixed; inset: 0; z-index: 20; }
        .select-wrap { position: relative; }
        .select-btn { width: 100%; display: flex; align-items: center; gap: 7px; border: none; border-radius: 12px; padding: 9px 10px; font-family: var(--sans); font-size: 13px; font-weight: 600; background: var(--paper-dim); color: var(--ink); box-sizing: border-box; cursor: pointer; text-align: left; }
        .select-btn:disabled { opacity: 0.5; cursor: default; }
        .select-btn-icon { width: 22px; height: 22px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .select-btn-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .select-btn-label.placeholder { color: var(--ink-soft); font-weight: 500; }
        .select-popover { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 21; background: var(--paper); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 10px 26px rgba(0,0,0,0.18); padding: 6px; max-height: 240px; overflow-y: auto; animation: navPopIn 0.16s ease-out; }
        .select-popover-item { width: 100%; display: flex; align-items: center; gap: 8px; text-align: left; background: none; border: none; color: var(--ink); font-family: var(--sans); font-size: 13px; font-weight: 600; padding: 8px 8px; border-radius: 10px; cursor: pointer; }
        .select-popover-item:active { background: var(--paper-dim); }
        .amount-input-wrap { display: flex; align-items: baseline; gap: 6px; border-bottom: 2px solid var(--line); padding-bottom: 6px; }
        .amount-currency { font-family: var(--mono); font-size: 22px; color: var(--ink-soft); }
        .amount-input { border: none; background: none; font-family: var(--mono); font-size: 32px; font-weight: 700; width: 100%; color: var(--ink); outline: none; }
        .cat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .subcat-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
        .subcat-chip { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--line); background: var(--paper); color: var(--ink); border-radius: 999px; padding: 7px 13px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .subcat-chip.selected { background: var(--green); color: var(--on-accent); border-color: var(--green); }
        .account-info-box { background: var(--paper-dim); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin: 4px 0 12px; }
        .account-info-box .name { font-weight: 700; font-size: 13px; margin-bottom: 3px; }
        .account-info-box .meta { font-size: 12px; color: var(--ink-soft); display: flex; flex-wrap: wrap; gap: 10px 14px; }
        .account-feedback { display: flex; align-items: center; font-size: 12px; margin: -6px 0 12px; padding: 8px 10px; border-radius: 8px; }
        .account-feedback.ok { background: rgba(46,125,91,0.12); color: var(--income); }
        .account-feedback.pending { background: rgba(176,67,46,0.1); color: var(--expense); }
        .cat-choice { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 4px; border-radius: 14px; border: none; background: var(--paper-dim); cursor: pointer; }
        .cat-choice-row { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--paper); color: var(--ink); font-family: var(--sans); font-size: 13px; font-weight: 600; cursor: pointer; box-sizing: border-box; }
        .cat-choice-row.active { border-color: var(--green); background: var(--paper-dim); color: var(--green); }
        .cat-choice.selected { background: rgba(30,61,50,0.09); box-shadow: inset 0 0 0 1.5px var(--green); }
        .cat-choice-icon { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
        .cat-choice-label { font-size: 11px; font-weight: 500; text-align: center; }
        .text-input { width: 100%; border: none; border-radius: 12px; padding: 11px 12px; font-family: var(--sans); font-size: 14px; outline: none; background: var(--paper-dim); color: var(--ink); box-sizing: border-box; }
        .text-input:focus { border-color: var(--green); }
        .form-error { color: var(--expense); font-size: 12px; margin-top: 10px; font-weight: 500; }
        .save-btn { width: 100%; background: var(--green); color: var(--on-accent); border: none; border-radius: 999px; padding: 14px; font-weight: 700; font-size: 14px; margin-top: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; letter-spacing: 0.3px; }
        .save-btn:disabled { background: var(--line); color: var(--ink-soft); cursor: not-allowed; }
        .save-btn:active { background: var(--green-soft); }
        .onboard-option { width: 100%; display: flex; align-items: center; gap: 14px; background: var(--paper); border: 1.5px solid var(--line); border-radius: 16px; padding: 16px; margin-bottom: 12px; cursor: pointer; text-align: left; }
        .onboard-option:active { background: var(--paper-dim); }
        .onboard-option-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .onboard-option-text { flex: 1; }
        .onboard-option-title { font-weight: 700; font-size: 15px; color: var(--ink); }
        .onboard-option-sub { font-size: 12px; color: var(--ink-soft); margin-top: 2px; line-height: 1.4; }
        .onboard-back { background: none; border: none; color: var(--ink-soft); font-size: 13px; font-weight: 600; cursor: pointer; padding: 0; display: flex; align-items: center; gap: 4px; }
        .code-display { text-align: center; background: var(--paper-dim); border: 1.5px dashed var(--line); border-radius: 14px; padding: 22px 12px; margin-bottom: 6px; }
        .code-display-value { font-family: var(--mono); font-size: 24px; font-weight: 700; letter-spacing: 3px; color: var(--ink); word-break: break-all; }
        .danger-btn { width: 100%; background: none; border: 1.5px solid var(--expense); color: var(--expense); border-radius: 999px; padding: 12px; font-weight: 600; font-size: 13px; margin-top: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .danger-btn.neutral { border-color: var(--line); color: var(--green); }
        .bell-toggle-btn { width: 100%; background: var(--paper-dim); border: 1px solid var(--line); color: var(--ink); border-radius: 10px; padding: 12px; font-weight: 600; font-size: 13px; margin-top: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .bell-toggle-btn.on { background: var(--green); color: var(--on-accent); border-color: var(--green); }
        .compromiso-notify { font-size: 11px; color: var(--ink-soft); display: flex; align-items: center; gap: 4px; margin-top: -4px; margin-bottom: 10px; }
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
        .add-participant-btn { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--green); background: none; border: 1px dashed var(--line); border-radius: 10px; padding: 9px; width: 100%; justify-content: center; cursor: pointer; margin-top: 4px; }
        .my-share-line { font-size: 12px; color: var(--ink-soft); margin-top: 10px; font-family: var(--mono); }
        .compromiso-card { background: var(--paper); border-radius: 16px; padding: 14px; margin-bottom: 12px; border: 1px solid var(--line); box-shadow: none; }
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
        .wallet-card-pill { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; background: rgba(255,255,255,0.22); padding: 2px 8px; border-radius: 5px; margin-top: 5px; }
        .wallet-card-amount { font-family: var(--mono); font-size: 19px; font-weight: 700; }
        .wallet-card-caption { font-size: 11px; opacity: 0.85; margin-top: 2px; }
        .wallet-card-limitrow { display: flex; justify-content: space-between; font-size: 12px; opacity: 0.9; margin-bottom: 6px; }
        .wallet-card-footrow { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-family: var(--mono); font-size: 13px; letter-spacing: 1px; opacity: 0.92; }
        .wallet-card-network { font-family: var(--sans); font-style: italic; font-weight: 700; letter-spacing: 0; text-transform: uppercase; font-size: 12px; opacity: 0.85; padding: 2px 8px; border-radius: 5px; background: rgba(255,255,255,0.18); }
        .wallet-card-network.net-visa { color: #fff; background: rgba(255,255,255,0.16); }
        .wallet-card-network.net-mastercard { color: #FFB020; background: rgba(0,0,0,0.18); }
        .wallet-card-network.net-amex { color: #6FD3FF; background: rgba(0,0,0,0.18); }
        .bank-monogram { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.24); color: #fff; flex-shrink: 0; margin-top: 1px; }
        .net-glyph { display: inline-flex; align-items: center; }
        .net-circle { width: 15px; height: 15px; border-radius: 50%; display: inline-block; }
        .net-circle-a { background: #EB5B3C; }
        .net-circle-b { background: #F2A93C; margin-left: -6px; mix-blend-mode: screen; }
        .net-glyph-visa { width: 22px; height: 14px; border-radius: 3px; background: linear-gradient(135deg, #fff, #dfe6f0); position: relative; }
        .net-glyph-visa::after { content: ''; position: absolute; top: 4px; left: 3px; right: 3px; height: 3px; border-radius: 2px; background: #1a4fa0; }
        .net-glyph-amex { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; background: rgba(255,255,255,0.22); color: #fff; }
        .person-section-header { display: flex; align-items: center; gap: 8px; margin: 4px 2px 10px; font-size: 14px; font-weight: 700; color: var(--ink); }
        .location-group-header { display: flex; align-items: center; gap: 6px; margin: 2px 2px 6px; font-size: 12px; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.3px; }
        .person-avatar { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .wallet-progress-track { height: 6px; border-radius: 4px; background: rgba(255,255,255,0.25); overflow: hidden; margin-bottom: 10px; }
        .wallet-progress-fill { height: 100%; background: #fff; border-radius: 4px; }
        .wallet-pill-btn { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.18); padding: 6px 10px; border-radius: 20px; }
        /* --- Vista previa en vivo de la tarjeta (modal de alta/edición) ---
           Inspirado en la tarjeta animada con flip 3D de Aduok Code: escena
           con perspectiva, cara frontal y reverso, y un halo tipo "aurora"
           (conic-gradient) girando lentamente sobre la superficie. */
        .card-live-scene { perspective: 1000px; margin: 2px 0 20px; }
        .card-live-inner { position: relative; width: 100%; aspect-ratio: 1.6 / 1; min-height: 172px; max-height: 210px; transform-style: preserve-3d; transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1); }
        .card-live-inner.flipped { transform: rotateY(180deg); }
        .card-live-face { position: absolute; inset: 0; border-radius: 18px; backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: hidden; box-shadow: 0 12px 26px rgba(0,0,0,0.28); }
        .card-live-front { padding: 18px 20px; display: flex; flex-direction: column; justify-content: space-between; transition: background 0.35s ease; }
        .card-live-back { transform: rotateY(180deg); }
        .card-live-front::before, .card-live-back::before { content: ''; position: absolute; width: 200%; height: 200%; top: -50%; left: -50%; background: conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255,255,255,0.16) 60deg, rgba(255,255,255,0.06) 120deg, transparent 180deg, rgba(255,255,255,0.10) 240deg, transparent 300deg); animation: card-aurora 9s linear infinite; pointer-events: none; }
        @keyframes card-aurora { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .card-live-top { display: flex; align-items: flex-start; justify-content: space-between; position: relative; z-index: 1; }
        .card-live-chip { width: 34px; height: 25px; border-radius: 6px; background: linear-gradient(135deg, #f0dd9a, #c9a94f); box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15); position: relative; }
        .card-live-chip::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(0,0,0,0.25); }
        .card-live-chip::after { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: rgba(0,0,0,0.25); }
        .card-live-brand { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; opacity: 0.9; text-transform: uppercase; text-align: right; }
        .card-live-mc { width: 38px; height: 24px; position: relative; flex-shrink: 0; }
        .card-live-mc-circle { width: 22px; height: 22px; border-radius: 50%; position: absolute; top: 1px; }
        .card-live-mc-a { background: #EB5B3C; left: 0; }
        .card-live-mc-b { background: #F2A93C; left: 12px; mix-blend-mode: screen; }
        .card-live-number { display: flex; gap: 8px; font-family: var(--mono); font-size: 16px; letter-spacing: 2px; margin: 10px 0 2px; opacity: 0.96; position: relative; z-index: 1; }
        .card-live-bottom { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; position: relative; z-index: 1; }
        .card-live-field-label { font-size: 8px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; }
        .card-live-holder { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 62%; }
        .card-live-network { font-size: 15px; font-weight: 700; font-style: italic; letter-spacing: 0; text-transform: uppercase; opacity: 0.92; flex-shrink: 0; }
        .card-live-stripe { position: absolute; top: 26px; left: 0; right: 0; height: 38px; background: linear-gradient(180deg, #111 0%, #222 50%, #111 100%); z-index: 1; }
        .card-live-signature { position: absolute; left: 16px; right: 16px; bottom: 22px; background: rgba(255,255,255,0.92); border-radius: 5px; height: 32px; display: flex; align-items: center; justify-content: flex-end; padding: 0 12px; z-index: 1; }
        .card-live-signature span { font-family: var(--mono); font-size: 14px; color: #111; letter-spacing: 3px; }
        .card-live-back-hint { position: absolute; left: 16px; bottom: 8px; font-size: 9px; color: rgba(255,255,255,0.6); letter-spacing: 0.4px; z-index: 1; }
        .card-live-flip-hint { font-size: 10.5px; color: var(--ink-soft); margin: -12px 0 14px; text-align: center; }
        /* --- Pila de tarjetas estilo billetera (resumen arriba de la lista) ---
           Inspirado en la wallet UI de Aduok Code: tarjetas dentro de una
           "bolsa" de piel dibujada en SVG, que se abanican al tocar y revelan
           el saldo total con una animación de opacidad/traslación. */
        .wallet-scene { position: relative; width: 100%; max-width: 300px; height: 210px; margin: 2px auto 16px; isolation: isolate; transition: transform 0.3s ease, height 0.35s ease; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
        .wallet-scene.fanned { transform: translateY(-4px); }
        .wallet-shell { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); width: 260px; height: 150px; background: #3b1f0e; border-radius: 22px 22px 60px 60px; box-shadow: inset 0 20px 30px rgba(0,0,0,0.4), inset 0 5px 12px rgba(0,0,0,0.3); z-index: 1; }
        .wallet-mini-card { position: absolute; left: 50%; width: 200px; height: 116px; border-radius: 16px; padding: 14px 16px; color: #fff; box-shadow: 0 8px 18px rgba(0,0,0,0.25); display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease; animation: wallet-mini-drop 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) backwards; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
        @keyframes wallet-mini-drop { from { opacity: 0; transform: translate(-50%, 24px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .wallet-mini-card:hover { filter: brightness(1.06); }
        .wallet-mini-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .wallet-mini-card-title-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .wallet-mini-card-name { font-size: 12.5px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wallet-mini-card-dot { width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.22); flex-shrink: 0; }
        .wallet-mini-card-foot { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.5px; opacity: 0.9; }
        .wallet-mini-card-amount { font-family: var(--mono); font-size: 16px; font-weight: 700; margin-bottom: 2px; }
        .wallet-mini-card-type { font-family: var(--sans); font-size: 8.5px; font-weight: 800; letter-spacing: 0.4px; background: rgba(255,255,255,0.24); padding: 2px 6px; border-radius: 6px; flex-shrink: 0; }
        .wallet-pocket { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); width: 280px; height: 134px; z-index: 50; pointer-events: none; }
        .wallet-pocket svg { width: 100%; height: 100%; display: block; }
        .wallet-pocket-body { position: absolute; left: 50%; bottom: 16px; transform: translate(-50%, 0); text-align: center; width: 200px; pointer-events: auto; cursor: default; }
        .wallet-pocket-balance-real { font-family: var(--mono); font-weight: 700; color: #e8c9a0; font-size: 20px; letter-spacing: 1px; white-space: nowrap; }
        .wallet-pocket-label { font-size: 10px; color: #a0734e; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 4px; }
        .wallet-pocket-close { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.14); border: none; color: #e8c9a0; display: flex; align-items: center; justify-content: center; pointer-events: auto; cursor: pointer; }
        .wallet-pocket-hint { text-align: center; font-size: 11px; color: var(--ink-soft); margin: 0 0 18px; font-style: italic; }
        .wallet-summary-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-width: 300px; margin: 8px auto 0; }
        .wallet-summary-chip { display: flex; align-items: center; gap: 5px; background: var(--paper-dim); border: 1px solid var(--line); border-radius: 20px; padding: 5px 10px 5px 8px; cursor: pointer; color: var(--ink-soft); }
        .wallet-summary-chip:hover { filter: brightness(1.08); }
        .wallet-summary-chip-name { font-size: 11px; font-weight: 600; color: var(--ink); max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wallet-summary-chip-amount { font-family: var(--mono); font-size: 11px; font-weight: 700; color: var(--income); }
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
        .progress-pct { font-size: 12px; color: var(--ink-soft); font-weight: 600; margin-bottom: 8px; }
        .compromiso-nums { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 12px; margin-bottom: 10px; }
        .compromiso-nums .pend { color: var(--expense); font-weight: 700; }
        .compromiso-nums .pend.done { color: var(--income); }
        .abonar-btn { width: 100%; background: var(--green); color: var(--on-accent); border: none; border-radius: 999px; padding: 10px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; }
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
        .savings-actions button { flex: 1; border-radius: 10px; padding: 9px; font-weight: 600; font-size: 13px; cursor: pointer; border: none; }
        .btn-deposito { background: var(--income); color: white; }
        .btn-retiro { background: var(--paper-dim); color: var(--ink); border: 1px solid var(--line) !important; }
        .person-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px dashed var(--line); }
        .person-row:last-child { border-bottom: none; }
        .person-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--green); color: var(--on-accent); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
        .person-mid { flex: 1; }
        .person-name { font-weight: 600; font-size: 14px; }
        .person-count { font-size: 11px; color: var(--ink-soft); }
        .person-amount { font-family: var(--mono); font-weight: 700; font-size: 14px; color: var(--expense); }
        .mark-paid-btn { background: var(--paper-dim); border: 1px solid var(--line); color: var(--green); border-radius: 8px; padding: 6px 8px; font-size: 11px; font-weight: 600; cursor: pointer; margin-left: 8px; display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .mini-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px dashed var(--line); }
        .er-group-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 6px; }
        .er-group-title-link { display: inline-flex; align-items: center; gap: 2px; }
        .er-group-title-link:active { opacity: 0.65; }
        .er-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 13px; }
        .er-cuenta { color: var(--ink); }
        .er-codigo { font-family: var(--mono); color: var(--ink-soft); font-size: 12px; margin-right: 4px; }
        .er-monto { font-family: var(--mono); font-weight: 600; white-space: nowrap; }
        .er-empty { font-size: 13px; color: var(--ink-soft); padding: 2px 0 6px; }
        .er-total-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0 2px; font-size: 14px; font-family: var(--mono); }
        .cxp-total-row { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
        .cxp-total-amount { font-family: var(--mono); font-size: 24px; font-weight: 700; color: var(--ink); }
        .cxp-total-label { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
        .totals-subhead { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-soft); font-weight: 700; margin: 10px 0 4px; }
        .totals-subhead:first-child { margin-top: 0; }
        .subhead-row { display: flex; align-items: center; justify-content: space-between; margin: 10px 0 4px; }
        .subhead-row .totals-subhead { margin: 0; }
        .subhead-action-btn { display: flex; align-items: center; gap: 4px; background: none; border: none; padding: 2px 4px; font-size: 11.5px; font-weight: 700; color: var(--green-soft); cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .ledger-app.dark .subhead-action-btn { color: var(--income); }
        .lote-row { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid var(--line); cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .lote-row:last-child { border-bottom: none; }
        .lote-checkbox { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid var(--line); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--on-accent); transition: background 0.12s, border-color 0.12s; }
        .lote-row.selected .lote-checkbox { background: var(--green-soft); border-color: var(--green-soft); }
        .lote-row-body { flex: 1; min-width: 0; }
        .lote-row-name { font-size: 13.5px; font-weight: 600; }
        .lote-row-sub { font-size: 11.5px; color: var(--ink-soft); margin-top: 1px; }
        .lote-row-amount { font-family: var(--mono); font-size: 13.5px; font-weight: 700; }
        .lote-total-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; margin: 4px 0 12px; border-top: 1px dashed var(--line); border-bottom: 1px dashed var(--line); }
        .stepper-row { display: flex; align-items: center; gap: 10px; margin: 4px 0 12px; }
        .stepper-row .text-input { flex: 1; text-align: center; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .cal-grid-heading { margin-bottom: 4px; }
        .cal-dow { text-align: center; font-size: 10.5px; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; padding: 4px 0; }
        .cal-cell { aspect-ratio: 1; border: none; background: var(--paper-dim); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; cursor: pointer; font-family: inherit; color: var(--ink); -webkit-tap-highlight-color: transparent; padding: 0; }
        .cal-cell.empty { background: none; cursor: default; }
        .cal-cell.today { box-shadow: inset 0 0 0 1.5px var(--green-soft); }
        .cal-cell.selected { background: var(--green-soft); color: var(--on-accent); }
        .cal-daynum { font-size: 12.5px; font-weight: 600; }
        .cal-dots { display: flex; gap: 3px; height: 5px; }
        .cal-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--ink-soft); }
        .cal-dot.gasto { background: var(--expense); }
        .cal-dot.ingreso { background: var(--income); }
        .cal-cell.selected .cal-dot { background: var(--on-accent); }
        .gcal-card { background: var(--paper-dim); border-radius: 14px; padding: 12px; margin-bottom: 4px; }
        .gcal-card-row { display: flex; align-items: center; gap: 10px; }
        .gcal-card-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .gcal-synced-tag { display: flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700; color: var(--income); white-space: nowrap; }
        .gcal-card-links { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
        .gcal-card-links button { background: none; border: none; padding: 6px 2px; text-align: left; font-family: inherit; font-size: 11px; color: var(--ink-soft); text-decoration: underline; cursor: pointer; }
        .gcal-collapsed-row { display: flex; align-items: center; gap: 6px; background: var(--paper-dim); border: none; border-radius: 10px; padding: 8px 12px; font-family: inherit; font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 4px; width: 100%; }
        .gcal-collapsed-row span { flex: 1; text-align: left; }
        .cal-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
        .cal-legend span { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--ink-soft); }
        .cal-dot.paid { opacity: 0.35; }
        /* --paper-dim se invierte en modo oscuro (queda más oscuro que el
           fondo del panel, no más claro), así que estos elementos "chip"
           nuevos del calendario necesitan su propio fondo fijo para seguir
           leyéndose ahí — si no, se pierden contra el fondo. */
        .ledger-app.dark .cal-cell:not(.empty) { background: rgba(255,255,255,0.07); }
        .ledger-app.dark .gcal-card { background: rgba(255,255,255,0.06); }
        .ledger-app.dark .gcal-collapsed-row { background: rgba(255,255,255,0.07); }
        /* Las "pistas" de barra (Presupuestos y Ahorro) no llevan borde, solo
           color de fondo — y --paper-dim en modo oscuro es literalmente el
           mismo tono que el fondo de toda la pantalla, así que la pista
           desaparecía por completo (sobre todo con $0.00, el caso más
           común, donde no hay relleno de color que la delate). */
        .ledger-app.dark .cat-bar-track { background: rgba(255,255,255,0.1); }
        .ledger-app.dark .progress-track { background: rgba(255,255,255,0.1); }
        .mini-row:last-child { border-bottom: none; }
        .mini-row-mid { flex: 1; }
        .mini-row-name { font-size: 13px; font-weight: 600; }
        .mini-row-amount { font-family: var(--mono); font-size: 13px; color: var(--expense); font-weight: 600; }
        .mini-abonar { background: var(--green); color: var(--on-accent); border: none; border-radius: 999px; padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
        .mini-avatar { width: 26px; height: 26px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; flex-shrink: 0; font-family: var(--mono); }
        .autor-tag { font-weight: 700; }
        .family-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--line); }
        .settings-menu-row { display: flex; align-items: center; gap: 12px; width: 100%; background: var(--paper-dim); border: none; border-radius: 14px; padding: 12px; margin-bottom: 10px; cursor: pointer; text-align: left; -webkit-tap-highlight-color: transparent; }
        .settings-menu-icon { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
        .settings-menu-mid { flex: 1; min-width: 0; }
        .settings-menu-title { font-size: 14px; font-weight: 700; color: var(--ink); }
        .settings-menu-sub { font-size: 11.5px; color: var(--ink-soft); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .settings-back-row { display: flex; align-items: center; gap: 2px; background: none; border: none; color: var(--ink); font-family: var(--sans); font-size: 16px; font-weight: 700; padding: 0; margin-bottom: 16px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .family-row:last-of-type { border-bottom: none; }
        .family-row-name { font-size: 14px; font-weight: 600; flex: 1; }
        .avatar-upload-btn { position: relative; background: none; border: none; padding: 0; cursor: pointer; flex-shrink: 0; -webkit-tap-highlight-color: transparent; }
        .avatar-upload-badge { position: absolute; bottom: -2px; right: -2px; width: 15px; height: 15px; border-radius: 50%; background: var(--gold); color: var(--green); display: flex; align-items: center; justify-content: center; border: 2px solid var(--paper); }
        .you-badge { font-size: 9px; background: var(--green); color: var(--on-accent); padding: 2px 6px; border-radius: 5px; font-weight: 700; }
      `}</style>

      <div className="masthead" ref={mastheadRef}>
        <div className="masthead-top">
          <span className="brand">Libro<span className="dot">•</span>Diario</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {profile && <div title={profile.name}>{avatarNode(profile.name, 26)}</div>}
            <button className="icon-btn" onClick={loadShared} title="Sincronizar con la familia"><Icon name="RefreshCw" size={15} /></button>
            <button className="icon-btn" onClick={() => { setSettingsSection(null); setSettingsOpen(true); }}><Icon name="Settings" size={16} /></button>
          </div>
        </div>
        {familyName && <div className="family-name-line">{familyName}</div>}
        <div className="balance-block">
          <span className="balance-label">Disponible · {PERIOD_LABEL[period]}</span>
          <div className={`balance-amount ${totals.disponible >= 0 ? 'pos' : 'neg'}`}>{fmt(totals.disponible)}</div>
          <div className="ahorro-line"><Icon name="PiggyBank" size={12} /> Ahorrado: {fmt(ahorradoTotal)}{porCobrarTotal > 0 && <> · Por cobrar: {fmt(porCobrarTotal)}</>}</div>
          <button className="hoy-chip" onClick={() => setSheet({ type: 'flow-projection' })}>
            <Icon name="Sparkles" size={12} /> Hoy puedes gastar {fmt(flowProjection.disponibleHoy)} <span className="hoy-chip-sub">· {flowProjection.diasRestantes} días para fin de mes</span>
          </button>
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

      <div className="content" ref={contentRef} onScroll={handleContentScroll} onTouchStart={handleContentTouchStart} onTouchEnd={handleContentTouchEnd}>
        {loading ? (
          <div className="empty-state"><span className="eyebrow">Abriendo el libro…</span></div>
        ) : tab === 'resumen' ? (
          <>
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>¿Dónde está el dinero?</span>
                <button className="mini-abonar" onClick={() => goTab('tarjetas')}>Ver detalle</button>
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
                            <div className="mini-row-name">{l.tipo === 'tarjeta' ? `${l.nombre || 'Tarjeta'}${l.esCredito != null ? ` · ${l.esCredito ? 'Crédito' : 'Débito'}` : ''}` : 'Monedero'}</div>
                          </div>
                          <div className="mini-row-amount" style={{ color: l.esCredito ? 'var(--expense)' : 'var(--ink)' }}>
                            {l.esCredito ? `Debes ${fmt(l.monto)}` : fmt(l.monto)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="cxp-total-row" style={{ paddingTop: 10, borderTop: '1px dashed var(--line)', marginTop: 4 }}>
                    <div>
                      <div className="cxp-total-amount" style={{ fontSize: 18 }}>{fmt(moneyLocationsDisponible)}</div>
                      <div className="cxp-total-label">Disponible real (efectivo y débito)</div>
                    </div>
                  </div>
                  {moneyLocationsDeuda > 0.01 && (
                    <div className="cxp-total-row" style={{ paddingTop: 6 }}>
                      <div>
                        <div className="cxp-total-amount" style={{ fontSize: 15, color: 'var(--expense)' }}>{fmt(moneyLocationsDeuda)}</div>
                        <div className="cxp-total-label">Debes en tarjetas de crédito</div>
                      </div>
                    </div>
                  )}
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
                  <button className="mini-abonar" onClick={() => goTab('compromisos')}>Ver detalle</button>
                </div>
              </div>
            )}
            {pendingByPerson.length > 0 && (
              <div className="card">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Por cobrar (gastos compartidos)</span>
                  <button className="mini-abonar" onClick={() => goTab('movimientos')}>Ver en Movimientos</button>
                </div>
                {pendingByPerson.map((p) => (
                  <div className="person-row" key={p.name} onClick={() => { setPorCobrarAmount(''); setSheet({ type: 'por-cobrar-detalle', name: p.name }); }} style={{ cursor: 'pointer' }}>
                    <div className="person-avatar">{p.name.charAt(0).toUpperCase()}</div>
                    <div className="person-mid"><div className="person-name">{p.name}</div><div className="person-count">{p.count} pendiente{p.count !== 1 ? 's' : ''} · toca para ver el detalle</div></div>
                    <div className="person-amount">{fmt(p.total)}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="card">
              <div className="card-title">Presupuestos · {new Date().toLocaleDateString('es-MX', { month: 'long' })}</div>
              {allGastoCats.map((c) => {
                const linkedSavingsIds = savingsLinksFor(c.id);
                const linkedSavingsAccs = linkedSavingsIds.map((id) => savings.find((a) => a.id === id)).filter(Boolean);
                const linkedTargetSum = linkedSavingsAccs.reduce((s, a) => s + (a.target || 0), 0);
                const budget = linkedSavingsAccs.length > 0 ? (budgets[c.id] || linkedTargetSum || 0) : (budgets[c.id] || 0);
                if (linkedSavingsAccs.length > 0) {
                  const apartado = linkedSavingsAccs.reduce((s, a) => s + (progresoMetaPorAhorro[a.id] || 0), 0);
                  const pct = budget ? Math.min(100, (apartado / budget) * 100) : 0;
                  const done = budget > 0 && apartado >= budget;
                  const barColor = !budget ? 'var(--line)' : done ? 'var(--income)' : pct >= 60 ? 'var(--gold)' : c.color;
                  return (
                    <div key={c.id} className="cat-row" style={{ cursor: 'pointer' }} onClick={() => openBudgetEdit(c.id)}>
                      <span className="cat-dot" style={{ background: c.color }} />
                      <span className="cat-row-label"><Icon name="PiggyBank" size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{c.label}{linkedSavingsAccs.length > 1 ? ` (${linkedSavingsAccs.length})` : ''}</span>
                      <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${budget ? pct : 0}%`, background: barColor }} /></div>
                      <span className="cat-row-amount" style={{ width: 'auto', minWidth: 60, fontSize: 12, whiteSpace: 'nowrap', ...(done ? { color: 'var(--income)' } : {}) }}>
                        {budget ? `${fmt(apartado)} / ${fmt(budget)}` : 'Fijar'}
                      </span>
                    </div>
                  );
                }
                const spent = gastoMesActualPorCategoria[c.id] || 0;
                const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
                const over = budget > 0 && spent > budget;
                const barColor = !budget ? 'var(--line)' : over ? 'var(--expense)' : pct >= 85 ? 'var(--gold)' : c.color;
                return (
                  <div key={c.id} className="cat-row" style={{ cursor: 'pointer' }} onClick={() => openBudgetEdit(c.id)}>
                    <span className="cat-dot" style={{ background: c.color }} />
                    <span className="cat-row-label">{c.label}</span>
                    <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${budget ? pct : 0}%`, background: barColor }} /></div>
                    <span className="cat-row-amount" style={{ width: 'auto', minWidth: 60, fontSize: 12, whiteSpace: 'nowrap', ...(over ? { color: 'var(--expense)' } : {}) }}>
                      {budget ? `${fmt(spent)} / ${fmt(budget)}` : 'Fijar'}
                    </span>
                  </div>
                );
              })}
            </div>
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
            <div
              className={`reveal-handle reveal-handle-top ${movsRevealed ? 'open' : ''}`}
              onClick={() => setMovsRevealed((v) => !v)}
              onTouchStart={handleMovsHandleTouchStart}
              onTouchEnd={handleMovsHandleTouchEnd}
            >
              <span className="reveal-handle-bar" />
              <span className="reveal-handle-label">
                <Icon name={movsRevealed ? 'ChevronUp' : 'ChevronDown'} size={12} />
                {movsRevealed ? 'Ocultar filtros' : 'Buscar y filtrar'}
              </span>
            </div>
            <div className={`reveal-panel reveal-panel-top ${movsRevealed ? 'open' : ''}`}>
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
              <div className="month-nav-row">
                <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSearchMonth(nextPeriodKey(searchMonth || currentPeriodKey, -1))}><Icon name="ChevronLeft" size={15} /></button>
                <input
                  className="text-input month-input"
                  type="month"
                  value={searchMonth || currentPeriodKey}
                  onChange={(e) => setSearchMonth(e.target.value)}
                />
                <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSearchMonth(nextPeriodKey(searchMonth || currentPeriodKey))}><Icon name="ChevronRight" size={15} /></button>
                {searchMonth && <button className="filter-chip" onClick={() => setSearchMonth('')}>Volver a "{PERIOD_LABEL[period]}"</button>}
              </div>
              <div className="filter-row">
                <button className={`filter-chip ${filterTipo === 'todas' ? 'active' : ''}`} onClick={() => setFilterTipo('todas')}>Todos los tipos</button>
                <button className={`filter-chip ${filterTipo === 'ingreso' ? 'active' : ''}`} onClick={() => setFilterTipo('ingreso')}>Ingresos</button>
                <button className={`filter-chip ${filterTipo === 'gasto' ? 'active' : ''}`} onClick={() => setFilterTipo('gasto')}>Gastos</button>
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
            </div>
            {grouped.length === 0 ? (
              <div className="empty-state"><div className="eyebrow">El libro está en blanco</div>Registra tu primer movimiento con el botón +.</div>
            ) : grouped.map(([date, txs]) => (
              <div className="date-group" key={date}>
                <div className="date-heading">{new Date(date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
                  {txs.map((t) => {
                    if (t.type === 'traspaso') {
                      return (
                        <div className="tx-row" key={t.id} onClick={() => openEditTraspaso(t)}>
                          <div className="tx-icon" style={{ background: 'var(--gold)' }}><Icon name="ArrowLeftRight" size={16} /></div>
                          <div className="tx-mid">
                            <div className="tx-cat">Traspaso{t.shared && <span className="shared-badge">COMPARTIDO</span>}</div>
                            <div className="tx-note">{locationLabel(t.fromLocationId)} → {locationLabel(t.toLocationId)}{t.note && ` · ${t.note}`} · <span className="autor-tag" style={{ color: colorForName(t.autor || 'Familia') }}>{t.autor || 'Familia'}</span></div>
                          </div>
                          <div className="tx-amount" style={{ color: 'var(--gold)' }}>{fmt(t.amount)}</div>
                          <span className="tx-edit-hint"><Icon name={isEditableTraspaso(t) ? 'Pencil' : 'Trash2'} size={13} /></span>
                        </div>
                      );
                    }
                    const c = catById(t.category);
                    return (
                      <div className="tx-row" key={t.id} onClick={() => openEditTx(t)}>
                        <div className="tx-icon" style={{ background: c.color }}><Icon name={c.icon} size={16} /></div>
                        <div className="tx-mid">
                          <div className="tx-cat">{c.label}{t.subcategory && ` · ${subcatLabel(t.subcategory)}`}{!t.subcategory && t.servicio && ` · ${t.servicio}`}{t.shared && <span className="shared-badge">COMPARTIDO</span>}</div>
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
            {pendingByPerson.length > 0 && (
              <div className="card">
                <div className="card-title">Por cobrar (gastos compartidos)</div>
                {pendingByPerson.map((p) => (
                  <div className="person-row" key={p.name} onClick={() => { setPorCobrarAmount(''); setSheet({ type: 'por-cobrar-detalle', name: p.name }); }} style={{ cursor: 'pointer' }}>
                    <div className="person-avatar">{p.name.charAt(0).toUpperCase()}</div>
                    <div className="person-mid"><div className="person-name">{p.name}</div><div className="person-count">{p.count} pendiente{p.count !== 1 ? 's' : ''} · toca para ver el detalle</div></div>
                    <div className="person-amount">{fmt(p.total)}</div>
                    <button className="mark-paid-btn" onClick={(e) => { e.stopPropagation(); markPersonPaid(p.name); }}><Icon name="CheckCircle2" size={12} /> Pagó</button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : tab === 'compromisos' ? (
          <>
            <div
              className={`reveal-handle reveal-handle-top ${msiRevealed ? 'open' : ''}`}
              onClick={() => setMsiRevealed((v) => !v)}
              onTouchStart={handleMsiHandleTouchStart}
              onTouchEnd={handleMsiHandleTouchEnd}
            >
              <span className="reveal-handle-bar" />
              <span className="reveal-handle-label">
                <Icon name={msiRevealed ? 'ChevronUp' : 'ChevronDown'} size={12} />
                {msiRevealed ? 'Ocultar opciones' : 'Más opciones'}
              </span>
            </div>
            <div className={`reveal-panel reveal-panel-top ${msiRevealed ? 'open' : ''}`}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="multiselect-toggle" onClick={openMsi}><Icon name="Calculator" size={12} /> Simular compra a MSI</button>
                <button className="multiselect-toggle" onClick={() => setSheet({ type: 'programados' })}><Icon name="CalendarCheck" size={12} /> Movimientos programados</button>
              </div>
            </div>
            <div className="card-title" style={{ padding: '0 2px' }}>Mis cuentas</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', padding: '0 2px', margin: '-6px 0 10px' }}>
              Da de alta aquí tus préstamos (CxP), lo que te deben (CxC), gastos fijos e ingresos fijos. Usa el botón + para agregar uno nuevo.
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
                {(fijosPendientes.length > 0 || fijos.length > 0) && (
                  <>
                    <div className="subhead-row">
                      <div className="totals-subhead">Gastos fijos</div>
                      {fijos.length > 0 && (
                        <button className="subhead-action-btn" onClick={openPagoLote}><Icon name="Zap" size={13} /> Pagar varios / Adelantar</button>
                      )}
                    </div>
                    {fijosPendientes.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '-4px 2px 12px' }}>
                        Ya están al día este mes. Usa "Pagar varios / Adelantar" arriba si quieres adelantar el pago de meses futuros (ej. tu plan de telefonía del siguiente mes).
                      </div>
                    )}
                    {fijosPendientes.map((c) => (
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
                        {c.carryOver > 0.01 && (
                          <div className="compromiso-notify" style={{ color: 'var(--expense)' }}>
                            <Icon name="AlertTriangle" size={11} /> Incluye {fmt(c.carryOver)} sin pagar de meses anteriores
                          </div>
                        )}
                        {((c.recurFreq && c.recurFreq !== 'mensual') || c.notifyDay) && (
                          <div className="compromiso-notify">
                            <Icon name={notifPermission === 'granted' ? 'Bell' : 'BellOff'} size={11} />
                            {recurrenceText(c)}{notifPermission !== 'granted' && (c.notifyDay || c.anchorDate) ? ' (activa notificaciones en Ajustes)' : ''}
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
                          <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)', flexShrink: 0 }} onClick={() => openEditDate(c)} title="Editar fecha de pago"><Icon name="CalendarCheck" size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {ingresosFijosPendientes.length > 0 && (
                  <>
                    <div className="totals-subhead">Ingresos fijos</div>
                    {ingresosFijosPendientes.map((c) => (
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
                        {c.carryOver > 0.01 && (
                          <div className="compromiso-notify" style={{ color: 'var(--expense)' }}>
                            <Icon name="AlertTriangle" size={11} /> Incluye {fmt(c.carryOver)} sin recibir de meses anteriores
                          </div>
                        )}
                        {((c.recurFreq && c.recurFreq !== 'mensual') || c.notifyDay) && (
                          <div className="compromiso-notify">
                            <Icon name={notifPermission === 'granted' ? 'Bell' : 'BellOff'} size={11} />
                            {recurrenceText(c)}{notifPermission !== 'granted' && (c.notifyDay || c.anchorDate) ? ' (activa notificaciones en Ajustes)' : ''}
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
                          <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)', flexShrink: 0 }} onClick={() => openEditDate(c)} title="Editar fecha de llegada"><Icon name="CalendarCheck" size={14} /></button>
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
                <div className="cxp-total-row" style={{ paddingTop: 0, marginBottom: 4 }}>
                  <div>
                    <div className="cxp-total-amount" style={{ fontSize: 18 }}>{fmt(moneyLocationsDisponible)}</div>
                    <div className="cxp-total-label">Disponible real (efectivo y débito)</div>
                  </div>
                </div>
                {moneyLocationsDeuda > 0.01 && (
                  <div className="cxp-total-row" style={{ paddingTop: 6, marginBottom: 10, borderBottom: '1px dashed var(--line)', paddingBottom: 14 }}>
                    <div>
                      <div className="cxp-total-amount" style={{ fontSize: 15, color: 'var(--expense)' }}>{fmt(moneyLocationsDeuda)}</div>
                      <div className="cxp-total-label">Debes en tarjetas de crédito</div>
                    </div>
                  </div>
                )}
                {moneyLocationsByPerson.map(([persona, locs]) => {
                  const tarjetas = locs.filter((l) => l.tipo === 'tarjeta');
                  const efectivos = locs.filter((l) => l.tipo === 'efectivo');
                  const todos = [...tarjetas, ...efectivos]; // todo lo que va dentro de la billetera de esta persona
                  const n = todos.length;
                  const disponible = locs.filter((l) => !l.esCredito).reduce((s, l) => s + (l.monto || 0), 0);
                  const open = !!walletOpenMap[persona];
                  // Geometría del abanico: en reposo, sin importar cuántas
                  // tarjetas haya, solo se asoman como máximo 2 detrás de la
                  // de enfrente (el resto queda perfectamente escondida
                  // debajo, a la misma altura) — así nunca se ve "ya salida".
                  // La base de reposo (restBase) deja libre la parte baja de
                  // la bolsa para que el "SALDO DISPONIBLE" siempre se vea,
                  // incluso con la billetera cerrada. Al abrir, se reparten
                  // en columna con más espacio entre ellas para que el dedo
                  // tenga un objetivo de toque cómodo.
                  const maxPeek = 2;
                  const peekGap = 6;
                  const fanGap = 44;
                  const fanBase = 46;
                  const restBase = 74;
                  const restBottom = (i) => restBase + Math.min(n - 1 - i, maxPeek) * peekGap;
                  const fannedBottom = (i) => fanBase + (n - 1 - i) * fanGap;
                  const sceneHeightRest = restBottom(0) + 116 + 24;
                  const sceneHeightFanned = fannedBottom(0) + 116 + 24;
                  const sceneHeight = Math.max(210, open ? sceneHeightFanned : sceneHeightRest);
                  return (
                    <div key={persona} style={{ marginBottom: 18 }}>
                      <div className="person-section-header">
                        <div className="person-avatar" style={{ background: colorForName(persona) }}>{persona.charAt(0).toUpperCase()}</div>
                        <span>{persona}</span>
                      </div>
                      {n > 0 && (
                        <>
                          {/* Cada billetera es independiente: su estado de apertura vive en
                              walletOpenMap[persona], así que tocar la de una persona nunca
                              afecta la de otra. La altura de la escena solo crece mientras
                              está abierta (con transición), para no dejar un hueco vacío
                              enorme reservado de antemano cuando está cerrada. */}
                          <div
                            className={`wallet-scene ${open ? 'fanned' : ''}`}
                            style={{ height: sceneHeight }}
                            onClick={() => setWalletOpenMap((m) => ({ ...m, [persona]: !m[persona] }))}
                          >
                            <div className="wallet-shell" />
                            {todos.map((l, i) => {
                              const hovered = walletHoverId === l.id;
                              let transform;
                              if (open) {
                                const delta = fannedBottom(i) - restBottom(i);
                                const back = n - 1 - i; // 0 = tarjeta de enfrente, crece hacia atrás
                                const rot = back === 0 ? 0 : (back % 2 === 1 ? 1 : -1) * (1.6 + back * 0.5);
                                transform = `translate(-50%, ${-delta}px) rotate(${rot}deg)`;
                              } else if (hovered) {
                                transform = 'translate(-50%, -20px) scale(1.03)';
                              } else {
                                transform = 'translate(-50%, 0)';
                              }
                              return (
                                <div
                                  key={l.id}
                                  className="wallet-mini-card"
                                  style={{ background: cardBg(l), bottom: restBottom(i), zIndex: i + 2, transform, animationDelay: `${i * 0.05}s` }}
                                  onMouseEnter={() => setWalletHoverId(l.id)}
                                  onMouseLeave={() => setWalletHoverId((id) => (id === l.id ? null : id))}
                                  onClick={(e) => {
                                    if (!open) return; // deja que el toque burbujee y abra la billetera
                                    // Cada tarjeta abre su propia edición, sin excepción (incluida
                                    // la de Monedero); la billetera se cierra tocando la bolsa.
                                    e.stopPropagation();
                                    openWalletDetail(l);
                                  }}
                                >
                                  <div className="wallet-mini-card-top">
                                    <div className="wallet-mini-card-title-row">
                                      <span className="wallet-mini-card-name">{l.tipo === 'efectivo' ? 'Monedero' : (l.nombre || 'Tarjeta')}</span>
                                      {l.tipo !== 'efectivo' && <span className="wallet-mini-card-type">{l.esCredito ? 'CRÉDITO' : 'DÉBITO'}</span>}
                                    </div>
                                    <span className="wallet-mini-card-dot" />
                                  </div>
                                  <div>
                                    <div className="wallet-mini-card-amount">{fmt(l.monto)}</div>
                                    <div className="wallet-mini-card-foot">
                                      {l.tipo === 'efectivo' ? 'Efectivo' : (l.ultimos4 ? `•••• ${l.ultimos4}` : '')}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <div className="wallet-pocket">
                              <svg viewBox="0 0 280 160" fill="none" preserveAspectRatio="none">
                                <path d="M0 20C0 10 5 10 10 10C20 10 25 25 40 25 L240 25C255 25 260 10 270 10C275 10 280 10 280 20 L280 120C280 155 260 160 240 160 L40 160C20 160 0 155 0 120Z" fill="#3b1f0e" />
                                <path d="M8 22C8 16 12 16 15 16C23 16 27 29 40 29 L240 29C253 29 257 16 265 16C268 16 272 16 272 22 L272 120C272 150 255 152 240 152 L40 152C25 152 8 152 8 120Z" stroke="#6b3a1f" strokeWidth="1.5" strokeDasharray="6 4" />
                              </svg>
                              {/* La base de reposo (restBase) de las tarjetas deja esta franja
                                  siempre libre, así que el monto nunca queda tapado. */}
                              <div className="wallet-pocket-body" onClick={(e) => e.stopPropagation()}>
                                <div className="wallet-pocket-balance-real">{fmt(disponible)}</div>
                                <div className="wallet-pocket-label">Saldo disponible</div>
                              </div>
                              {open && (
                                <button
                                  className="wallet-pocket-close"
                                  onClick={(e) => { e.stopPropagation(); setWalletOpenMap((m) => ({ ...m, [persona]: false })); }}
                                  aria-label="Cerrar billetera"
                                >
                                  <Icon name="ChevronDown" size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="wallet-summary-chips">
                            {todos.map((l) => (
                              <div
                                key={l.id}
                                className="wallet-summary-chip"
                                onClick={(e) => { e.stopPropagation(); openWalletDetail(l); }}
                              >
                                <Icon name={l.tipo === 'efectivo' ? 'Wallet' : 'CreditCard'} size={11} />
                                <span className="wallet-summary-chip-name">{l.tipo === 'efectivo' ? 'Monedero' : (l.nombre || 'Tarjeta')}</span>
                                <span className="wallet-summary-chip-amount" style={l.esCredito ? { color: 'var(--expense)' } : undefined}>{fmt(l.monto)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="wallet-pocket-hint">
                            {open ? 'Toca una tarjeta para editarla · toca la flecha o la bolsa para guardar' : `Toca la billetera para ver ${n > 1 ? `las ${n} tarjetas` : 'la tarjeta'}`}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
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
                <div className="savings-card" key={acc.id} style={{ cursor: 'pointer' }} onClick={() => openEditSavings(acc)}>
                  <div className="savings-top">
                    <div className="savings-icon"><Icon name={acc.category ? catById(acc.category).icon : 'PiggyBank'} size={17} /></div>
                    <div style={{ flex: 1 }}>
                      <div className="compromiso-name">{acc.name}</div>
                      {acc.category && <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>{catById(acc.category).label}</div>}
                      <div className="savings-amount">{fmt(saved)}{acc.target && <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500 }}> / {fmt(acc.target)}</span>}</div>
                    </div>
                    <button className="compromiso-del" onClick={(e) => { e.stopPropagation(); deleteSavings(acc.id); }}><Icon name="Trash2" size={14} /></button>
                  </div>
                  {(() => {
                    const linkedLoc = acc.locationId ? moneyLocations.find((l) => l.id === acc.locationId) : null;
                    return (
                      <button
                        onClick={(e) => { e.stopPropagation(); openLinkSavings(acc); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, margin: '2px 0 8px', cursor: 'pointer', fontSize: 11.5, color: linkedLoc ? 'var(--ink-soft)' : 'var(--income)', fontWeight: 600 }}
                      >
                        <Icon name={linkedLoc?.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={12} />
                        {linkedLoc ? `Guardado en: ${linkedLoc.persona} · ${linkedLoc.tipo === 'tarjeta' ? (linkedLoc.nombre || 'Tarjeta') : 'Monedero'}` : 'Vincular a una tarjeta o monedero'}
                      </button>
                    );
                  })()}
                  {pct !== null && (
                    <>
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                      <div className="progress-pct">{pct.toFixed(0)}% de tu meta</div>
                    </>
                  )}
                  <div className="savings-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-deposito" onClick={() => openMove(acc, 'deposito')}>Depositar</button>
                    <button className="btn-retiro" onClick={() => openMove(acc, 'retiro')}>Retirar</button>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div className="card-title" style={{ padding: 0 }}>Mes de las gráficas</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>Filtra "Gastos por categoría" y "Estado de Resultado" de abajo.</div>
              </div>
              <input
                className="text-input"
                type="month"
                style={{ width: 'auto', flexShrink: 0 }}
                value={chartMonth}
                max={currentPeriodKey}
                onChange={(e) => e.target.value && setChartMonth(e.target.value)}
              />
            </div>
            <div className="card">
              <div className="card-title">Gastos por categoría · {periodLabel(chartMonth)}</div>
              {gastosPorCategoriaMes.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Sin gastos en este mes.</div> : (
                <>
                  <div className="chart-wrap">
                    <CategoryDonut data={gastosPorCategoriaMes} />
                  </div>
                  <div className="legend-row">{gastosPorCategoriaMes.map((c) => <div className="legend-item" key={c.id}><span className="legend-dot" style={{ background: c.color }} />{c.name}</div>)}</div>
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
              {gastosFijosPorConcepto.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Sin gastos fijos dados de alta. Dalos de alta desde la pestaña Cuentas.</div> : (
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
              <div className="card-title">Estado de Resultado · {periodLabel(chartMonth)}</div>
              {estadoResultadoMes.ingresos.length === 0 && estadoResultadoMes.gastos.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Sin movimientos en este mes.</div>
              ) : (
                <>
                  <div
                    className="er-group-title er-group-title-link"
                    style={{ color: 'var(--income)', cursor: 'pointer' }}
                    onClick={() => {
                      setFilterTipo('ingreso');
                      setFilterCat('todas');
                      setFilterAutor('todos');
                      setSearchQuery('');
                      setSearchMonth(chartMonth === currentPeriodKey ? '' : chartMonth);
                      setMovsRevealed(true);
                      goTab('movimientos');
                    }}
                  >
                    {GRUPO_LABEL.ingresos} <Icon name="ChevronRight" size={13} style={{ verticalAlign: -2 }} />
                  </div>
                  {estadoResultadoMes.ingresos.length === 0 ? (
                    <div className="er-empty">Sin ingresos en este mes.</div>
                  ) : estadoResultadoMes.ingresos.map((r) => (
                    <div className="er-row" key={r.codigo}>
                      <span className="er-cuenta"><span className="er-codigo">{r.codigo}</span> {r.nombre}</span>
                      <span className="er-monto">{fmt(r.value)}</span>
                    </div>
                  ))}
                  <div className="er-total-row" style={{ borderTop: '1px solid var(--line)' }}>
                    <span>Total ingresos</span>
                    <span style={{ color: 'var(--income)' }}>{fmt(estadoResultadoMes.totalIngresos)}</span>
                  </div>

                  <div
                    className="er-group-title er-group-title-link"
                    style={{ color: 'var(--expense)', marginTop: 14, cursor: 'pointer' }}
                    onClick={() => {
                      setFilterTipo('gasto');
                      setFilterCat('todas');
                      setFilterAutor('todos');
                      setSearchQuery('');
                      setSearchMonth(chartMonth === currentPeriodKey ? '' : chartMonth);
                      setMovsRevealed(true);
                      goTab('movimientos');
                    }}
                  >
                    {GRUPO_LABEL.gastos} <Icon name="ChevronRight" size={13} style={{ verticalAlign: -2 }} />
                  </div>
                  {estadoResultadoMes.gastos.length === 0 ? (
                    <div className="er-empty">Sin gastos en este mes.</div>
                  ) : estadoResultadoMes.gastos.map((r) => (
                    <div className="er-row" key={r.codigo}>
                      <span className="er-cuenta"><span className="er-codigo">{r.codigo}</span> {r.nombre}</span>
                      <span className="er-monto">{fmt(r.value)}</span>
                    </div>
                  ))}
                  <div className="er-total-row" style={{ borderTop: '1px solid var(--line)' }}>
                    <span>Total costos y gastos</span>
                    <span style={{ color: 'var(--expense)' }}>{fmt(estadoResultadoMes.totalGastos)}</span>
                  </div>

                  <div className="er-total-row" style={{ borderTop: '2px solid var(--ink)', marginTop: 10, paddingTop: 10 }}>
                    <span style={{ fontWeight: 700 }}>Utilidad neta</span>
                    <span style={{ fontWeight: 700, color: estadoResultadoMes.utilidad >= 0 ? 'var(--income)' : 'var(--expense)' }}>{fmt(estadoResultadoMes.utilidad)}</span>
                  </div>

                  <div className="er-group-title" style={{ color: 'var(--gold)', marginTop: 14 }}>Balance (no afecta la utilidad)</div>
                  <div className="er-row">
                    <span className="er-cuenta"><span className="er-codigo">{CUENTA_AHORRO.codigo}</span> {CUENTA_AHORRO.nombre}</span>
                    <span className="er-monto">{fmt(savingsMovesEnChartMonth)}</span>
                  </div>
                  <div className="er-empty">Traspaso de banco/efectivo a ahorro en el mes · cuenta de Activo, no es gasto.</div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {undoInfo && (
        <div className="undo-toast">
          <span>{undoInfo.message}</span>
          <button onClick={performUndo}>Deshacer</button>
        </div>
      )}

      <div className={`bottom-nav-shell ${navCompact ? 'nav-compact-shell' : ''}`}>
        <div className={`bottom-nav ${navCompact ? 'nav-compact' : ''}`}>
          {hiddenPopoverFor && <div className="nav-popover-backdrop" onClick={() => setHiddenPopoverFor(null)} />}
        <div
          className="nav-tabs"
          ref={navTabsRef}
          onTouchStart={handleNavTouchStart}
          onTouchMove={handleNavTouchMove}
          onTouchEnd={handleNavTouchEnd}
          onTouchCancel={handleNavTouchEnd}
        >
          <div
            className={`nav-highlight ${dragTabKey ? 'dragging' : ''}`}
            style={dragLeftPx != null
              ? { left: `${dragLeftPx}px`, width: navDragRect.current ? navDragRect.current.btnWidth : `${navPct}%` }
              : { left: `${navIndex(tab) * navPct}%`, width: `${navPct}%` }}
          />
          {NAV_TABS.map((n) => {
            const hidden = HIDDEN_TABS[n.key];
            const highlightKey = dragTabKey || tab;
            const active = hidden ? (highlightKey === n.key || highlightKey === hidden.key) : highlightKey === n.key;
            const btn = (
              <button
                key={n.key}
                data-navkey={n.key}
                className={`nav-btn ${active ? 'active' : ''}`}
                style={active ? { color: tabColors[hidden && tab === hidden.key ? hidden.key : n.key] } : undefined}
                onMouseDown={hidden ? startLongPress(n.key) : undefined}
                onMouseUp={hidden ? cancelLongPress : undefined}
                onMouseLeave={hidden ? cancelLongPress : undefined}
                onTouchStart={hidden ? startLongPress(n.key) : undefined}
                onTouchEnd={hidden ? cancelLongPress : undefined}
                onContextMenu={hidden ? (e) => e.preventDefault() : undefined}
                onClick={hidden ? handleParentTap(n.key) : () => goTab(n.key)}
              >
                <Icon name={n.icon} size={20} />{n.label}
                {hidden && tab === hidden.key && <span className="nav-btn-dot" style={{ background: tabColors[hidden.key] }} />}
              </button>
            );
            if (!hidden) return btn;
            return (
              <div className="nav-btn-wrap" key={n.key}>
                {btn}
                {hiddenPopoverFor === n.key && (
                  <div className="nav-popover">
                    <button className="nav-popover-item" onClick={() => goTab(hidden.key)}><Icon name={hidden.icon} size={15} /> {hidden.label}</button>
                  </div>
                )}
              </div>
            );
          })}
          <button
            className={`nav-fab-btn ${dragTabKey === '__fab__' ? 'active' : ''}`}
            data-navkey="__fab__"
            style={dragTabKey === '__fab__' ? { color: 'var(--gold)' } : undefined}
            onClick={fabAction}
            aria-label="Agregar movimiento"
          ><Icon name="Plus" size={20} /></button>
        </div>
        </div>
      </div>

      {sheet?.type === 'add-tx' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
            <div className="sheet-header"><span className="sheet-title">Nuevo movimiento</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <input
              type="file" accept="image/*" capture="environment" ref={ticketInputRef} style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) handleTicketFile(f); }}
            />
            <button
              className="save-btn"
              style={{ background: 'var(--paper-dim)', color: 'var(--ink)', border: '1px dashed var(--line)', marginBottom: 14 }}
              disabled={ticketBusy}
              onClick={() => ticketInputRef.current && ticketInputRef.current.click()}
            >
              <Icon name={ticketBusy ? 'RefreshCw' : 'Search'} size={16} /> {ticketBusy ? (ticketProgress || 'Leyendo…') : 'Escanear ticket de compra'}
            </button>
            {ticketError && <div style={{ fontSize: 12, color: 'var(--expense)', marginTop: -8, marginBottom: 12 }}>{ticketError}</div>}
            <div className="type-toggle">
              <button className={txForm.type === 'ingreso' ? 'active ingreso' : ''} onClick={() => setTxForm((f) => ({ ...f, type: 'ingreso', category: '', shared: false }))}><Icon name="ArrowUpRight" size={14} /> Ingreso</button>
              <button className={txForm.type === 'gasto' ? 'active gasto' : ''} onClick={() => setTxForm((f) => ({ ...f, type: 'gasto', category: '' }))}><Icon name="ArrowDownRight" size={14} /> Gasto</button>
            </div>
            <div className="field-label">Monto *</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={txForm.amount} onChange={(e) => setTxForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-row" style={{ alignItems: 'flex-end' }}>
              <span className="field-label" style={{ margin: 0, flex: 1 }}>Categoría *</span>
              <button type="button" className="cat-manage-link" onClick={() => setSheet({ type: 'catalogo-cuentas' })}><Icon name="Settings" size={11} /> Gestionar categorías</button>
            </div>
            {txPickerOpen && <div className="picker-catcher" onClick={() => setTxPickerOpen(null)} />}
            <div className="field-row">
              <div className="select-wrap">
                <button type="button" className="select-btn" onClick={() => setTxPickerOpen(txPickerOpen === 'cat' ? null : 'cat')}>
                  {txForm.category ? (
                    <>
                      <span className="select-btn-icon" style={{ background: catByIdAny(txForm.category).color }}><Icon name={catByIdAny(txForm.category).icon} size={13} color="#fff" /></span>
                      <span className="select-btn-label">{catByIdAny(txForm.category).label}</span>
                    </>
                  ) : <span className="select-btn-label placeholder">Elegir categoría…</span>}
                  <Icon name="ChevronDown" size={14} color="var(--ink-soft)" style={{ flexShrink: 0 }} />
                </button>
                {txPickerOpen === 'cat' && (
                  <div className="select-popover">
                    {catOptions.map((c) => (
                      <button key={c.id} type="button" className="select-popover-item" onClick={() => { setTxForm((f) => ({ ...f, category: c.id, subcategory: '', servicio: '' })); setTxPickerOpen(null); }}>
                        <span className="select-btn-icon" style={{ background: c.color }}><Icon name={c.icon} size={13} color="#fff" /></span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="select-wrap">
                {(() => {
                  const pickList = txForm.type === 'ingreso' ? moneyLocations : moneyLocationsForGasto();
                  const personas = [...new Set(pickList.map((l) => l.persona))];
                  return (
                    <>
                      <button type="button" className="select-btn" disabled={moneyLocations.length === 0} onClick={() => setTxPickerOpen(txPickerOpen === 'persona' ? null : 'persona')}>
                        {txForm.persona ? (
                          <>
                            {avatarNode(txForm.persona, 20, 10)}
                            <span className="select-btn-label">{txForm.persona}</span>
                          </>
                        ) : <span className="select-btn-label placeholder">{txForm.type === 'ingreso' ? '¿Dónde cae?' : '¿Quién paga?'}</span>}
                        <Icon name="ChevronDown" size={14} color="var(--ink-soft)" style={{ flexShrink: 0 }} />
                      </button>
                      {txPickerOpen === 'persona' && (
                        <div className="select-popover">
                          {personas.map((p) => (
                            <button key={p} type="button" className="select-popover-item" onClick={() => { setTxForm((f) => ({ ...f, persona: p, locationId: '' })); setTxPickerOpen(null); }}>
                              {avatarNode(p, 20, 10)} {p}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
            {moneyLocations.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--expense)', margin: '-4px 0 12px' }}>
                Todavía no tienes ubicaciones de dinero. Créalas primero desde la pestaña Tarjetas para poder guardar este movimiento.
              </div>
            ) : txForm.persona && (() => {
              const pickList = txForm.type === 'ingreso' ? moneyLocations : moneyLocationsForGasto();
              const cuentas = pickList.filter((l) => l.persona === txForm.persona);
              const selectedCuenta = cuentas.find((l) => l.id === txForm.locationId);
              const cuentaLabel = (l) => l.tipo === 'tarjeta' ? `${l.nombre || 'Tarjeta'}${l.esCredito != null ? ` · ${l.esCredito ? 'Crédito' : 'Débito'}` : ''}` : 'Monedero';
              return (
                <>
                  <div className="field-label">{txForm.type === 'ingreso' ? 'Cuenta / monedero donde cae *' : 'Cuenta / monedero de donde sale *'}</div>
                  <div className="select-wrap" style={{ marginBottom: 12 }}>
                    <button type="button" className="select-btn" style={{ width: '100%' }} onClick={() => setTxPickerOpen(txPickerOpen === 'cuenta' ? null : 'cuenta')}>
                      {selectedCuenta ? (
                        <>
                          <span className="select-btn-icon" style={{ background: selectedCuenta.tipo === 'tarjeta' ? '#3E6EA5' : '#5F8A4C' }}><Icon name={selectedCuenta.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={13} color="#fff" /></span>
                          <span className="select-btn-label">{cuentaLabel(selectedCuenta)}</span>
                        </>
                      ) : <span className="select-btn-label placeholder">Elegir cuenta…</span>}
                      <Icon name="ChevronDown" size={14} color="var(--ink-soft)" style={{ flexShrink: 0 }} />
                    </button>
                    {txPickerOpen === 'cuenta' && (
                      <div className="select-popover">
                        {cuentas.map((l) => (
                          <button key={l.id} type="button" className="select-popover-item" onClick={() => { setTxForm((f) => ({ ...f, locationId: l.id })); setTxPickerOpen(null); }}>
                            <span className="select-btn-icon" style={{ background: l.tipo === 'tarjeta' ? '#3E6EA5' : '#5F8A4C' }}><Icon name={l.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={13} color="#fff" /></span>
                            {cuentaLabel(l)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
            {txForm.category && (metaFor(txForm.category).subItems || []).length > 0 && (
              <>
                <div className="field-label">Servicio específico (opcional)</div>
                <div className="subcat-row">
                  {metaFor(txForm.category).subItems.map((s) => (
                    <button key={s} type="button" className={`subcat-chip ${txForm.servicio === s ? 'selected' : ''}`} onClick={() => setTxForm((f) => ({ ...f, servicio: f.servicio === s ? '' : s }))}>{s}</button>
                  ))}
                </div>
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
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
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
              <div>
                {renderLocationPicker(
                  editTxForm.type === 'ingreso'
                    ? moneyLocations
                    : moneyLocationsForGasto(editTxForm.locationId),
                  editTxForm.locationId,
                  (id) => setEditTxForm((f) => ({ ...f, locationId: f.locationId === id ? '' : id }))
                )}
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

            {editTxForm.type === 'gasto' && (
              <>
                <div className="toggle-row">
                  <span className="toggle-row-label"><Icon name="Users" size={14} /> ¿Es un gasto compartido?</span>
                  <button className={`switch ${editTxForm.shared ? 'on' : ''}`} onClick={() => setEditTxForm((f) => ({ ...f, shared: !f.shared }))} />
                </div>
                {editTxForm.shared && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 6 }}>
                      Ya lo pagaste completo tú; agrega quién te debe su parte para que aparezca en "Por cobrar" hasta que te la regresen.
                    </div>
                    {editTxForm.participants.map((p) => (
                      <div className="participant-row" key={p.id}>
                        <input className="text-input" placeholder="Nombre" value={p.name} onChange={(e) => updateEditParticipant(p.id, { name: e.target.value })} />
                        <input className="text-input amount-mini" type="text" inputMode="decimal" placeholder="$0" value={p.amount} onChange={(e) => updateEditParticipant(p.id, { amount: formatAmountTyping(e.target.value) })} />
                        <button
                          type="button"
                          onClick={() => updateEditParticipant(p.id, { paid: !p.paid })}
                          title={p.paid ? 'Marcar como pendiente' : 'Marcar como ya me pagó'}
                          style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                        >
                          {p.paid
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--income)' }}><Icon name="CheckCircle2" size={13} /> Recibido</span>
                            : <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)' }}><Icon name="Circle" size={13} /> Pendiente</span>}
                        </button>
                        <button className="remove-participant" onClick={() => removeEditParticipant(p.id)}><Icon name="X" size={15} /></button>
                      </div>
                    ))}
                    <button className="add-participant-btn" onClick={addEditParticipant}><Icon name="UserPlus" size={14} /> Agregar persona</button>
                    <div className="my-share-line">Tu parte: {fmt(Math.max(0, toNumber(editTxForm.amount) - editTxForm.participants.reduce((s, p) => s + toNumber(p.amount), 0)))}</div>
                  </div>
                )}
              </>
            )}

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
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
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
                          <div className="compromiso-sub">{recurrenceText(c)}</div>
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
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
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
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
            <div className="sheet-header"><span className="sheet-title">{compForm.kind === 'deuda' ? 'Nueva cuenta por pagar (CxP)' : compForm.kind === 'cxc' ? 'Nueva cuenta por cobrar (CxC)' : compForm.kind === 'ingreso_fijo' ? 'Nuevo ingreso fijo' : 'Nuevo gasto fijo'}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div className="type-toggle" style={{ flexWrap: 'wrap' }}>
              <button className={compForm.kind === 'deuda' ? 'active deuda' : ''} onClick={() => setCompForm((f) => ({ ...f, kind: 'deuda', category: 'deudas' }))}><Icon name="Landmark" size={14} /> Préstamo</button>
              <button className={compForm.kind === 'cxc' ? 'active deuda' : ''} onClick={() => setCompForm((f) => ({ ...f, kind: 'cxc', category: 'cobranza' }))}><Icon name="ArrowDownRight" size={14} /> Me deben (CxC)</button>
              <button className={compForm.kind === 'fijo' ? 'active fijo' : ''} onClick={() => setCompForm((f) => ({ ...f, kind: 'fijo', category: '' }))}><Icon name="Repeat" size={14} /> Gasto fijo</button>
              <button className={compForm.kind === 'ingreso_fijo' ? 'active ingreso' : ''} onClick={() => setCompForm((f) => ({ ...f, kind: 'ingreso_fijo', category: '' }))}><Icon name="ArrowUpRight" size={14} /> Ingreso fijo</button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
              {compForm.kind === 'deuda'
                ? 'Registra préstamos, tarjetas o cuentas por pagar. Solo se pueden abonar (no editar el monto a mano); si es la deuda de una tarjeta de crédito, vincúlala desde la tarjeta y su saldo se actualizará solo.'
                : compForm.kind === 'cxc'
                ? 'Registra dinero que le prestaste a alguien. Cuando te vaya pagando, regístralo como cobro y se sumará a tus ingresos (cuenta 4300 · Cobranza).'
                : 'Esto solo da de alta el compromiso; todavía no se crea ningún movimiento. Cuando hagas el pago (o lo recibas), regístralo desde el botón + o con "Abonar" aquí mismo.'}
            </div>
            <div className="field-label">Nombre</div>
            <input className="text-input" placeholder={compForm.kind === 'deuda' ? 'Ej. Préstamo bancario' : compForm.kind === 'cxc' ? 'Ej. Le presté a mi hermano' : compForm.kind === 'ingreso_fijo' ? 'Ej. Nómina, comisiones...' : 'Ej. Renta, Internet...'} value={compForm.name} onChange={(e) => setCompForm((f) => ({ ...f, name: e.target.value }))} />
            <div className="field-label">
              {compForm.kind === 'deuda' ? 'Monto total del préstamo' : compForm.kind === 'cxc' ? 'Monto total prestado' : ({
                diario: 'Monto por día',
                semanal: 'Monto semanal',
                quincenal: 'Monto catorcenal (cada 2 semanas)',
                mensual: 'Monto mensual',
              }[compForm.recurFreq || 'mensual'])}
            </div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={compForm.amount} onChange={(e) => setCompForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} /></div>
            {compForm.kind === 'deuda' && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 6 }}>
                Si es la deuda de una tarjeta de crédito (Nu, Bodega Aurrera, etc.) que sube el saldo por intereses, no la des de alta aquí: mejor márcala como tarjeta de crédito en "¿Dónde está el dinero?" y vincúlala a un préstamo — así el saldo se actualiza solo cada vez que captures el monto de la tarjeta.
              </div>
            )}
            {isBalanceKind(compForm.kind) && moneyLocations.length > 0 && (
              <>
                <div className="field-label">{compForm.kind === 'deuda' ? '¿A qué cuenta entra el dinero? (opcional)' : '¿De qué cuenta sale el dinero? (opcional)'}</div>
                <div>{renderLocationPicker(moneyLocations, compForm.locationId, (id) => setCompForm((f) => ({ ...f, locationId: f.locationId === id ? '' : id })))}</div>
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
                  {(compForm.kind === 'ingreso_fijo' ? INGRESO_CATS : CXP_CATS).map((c) => { return (
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
                <div className="field-label">Repetir</div>
                <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {[
                    { id: 'diario', label: 'Cada día' },
                    { id: 'semanal', label: 'Cada semana' },
                    { id: 'quincenal', label: 'Cada 2 semanas' },
                    { id: 'mensual', label: 'Cada mes' },
                  ].map((r) => (
                    <div key={r.id} className={`cat-choice ${compForm.recurFreq === r.id ? 'selected' : ''}`} onClick={() => setCompForm((f) => ({ ...f, recurFreq: r.id }))}>
                      <Icon name="RefreshCw" size={14} />
                      <span className="cat-choice-label">{r.label}</span>
                    </div>
                  ))}
                </div>
                {compForm.recurFreq === 'mensual' && (
                  <>
                    <div className="field-label">{compForm.kind === 'ingreso_fijo' ? '¿Qué día del mes debería llegar? (opcional)' : '¿Qué día del mes se cobra? (opcional)'}</div>
                    <input
                      className="text-input"
                      type="date"
                      value={dayToDateInput(compForm.notifyDay)}
                      onChange={(e) => setCompForm((f) => ({ ...f, notifyDay: dateInputToDay(e.target.value) }))}
                    />
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-6px 0 12px' }}>
                      Elige cualquier fecha; solo tomamos el día. Ej. si eliges el 15, te lo recordamos cada 15 de cada mes.
                    </div>
                  </>
                )}
                {(compForm.recurFreq === 'semanal' || compForm.recurFreq === 'quincenal') && (
                  <>
                    <div className="field-label">{compForm.kind === 'ingreso_fijo' ? '¿Qué día debería llegar? (opcional)' : '¿Qué día se cobra? (opcional)'}</div>
                    <input
                      className="text-input"
                      type="date"
                      value={compForm.anchorDate || todayStr()}
                      onChange={(e) => setCompForm((f) => ({ ...f, anchorDate: e.target.value }))}
                    />
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-6px 0 12px' }}>
                      Elige cualquier fecha en la que caiga este {compForm.kind === 'ingreso_fijo' ? 'ingreso' : 'pago'}; a partir de ahí contamos cada {compForm.recurFreq === 'semanal' ? '7' : '14'} días para el siguiente y para el recordatorio.
                    </div>
                  </>
                )}
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
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
            <div className="sheet-header"><span className="sheet-title">{sheet.compromiso.kind === 'ingreso_fijo' ? 'Ingreso recibido' : sheet.compromiso.kind === 'cxc' ? 'Cobro' : 'Abonar'} · {sheet.compromiso.name}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div className="field-label">{sheet.compromiso.kind === 'ingreso_fijo' ? 'Monto recibido' : sheet.compromiso.kind === 'cxc' ? 'Monto cobrado' : 'Monto a abonar'} *</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" value={abonoForm.amount} onChange={(e) => setAbonoForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-label">{sheet.compromiso.kind === 'ingreso_fijo' || sheet.compromiso.kind === 'cxc' ? '¿Dónde cae este dinero? *' : '¿De dónde sale este dinero? *'}</div>
            {moneyLocations.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--expense)', margin: '-4px 0 12px' }}>
                Todavía no tienes ubicaciones de dinero. Créalas primero desde la pestaña Tarjetas para poder guardar este movimiento.
              </div>
            ) : (
              <div>{renderLocationPicker(moneyLocations, abonoForm.locationId, (id) => setAbonoForm((f) => ({ ...f, locationId: f.locationId === id ? '' : id })))}</div>
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

      {sheet?.type === 'pagar-lote' && (() => {
        const pendientes = fijos.filter((c) => c.pendiente > 0.01);
        const totalSeleccionado = pendientes.filter((c) => pagoLoteForm.selectedIds.includes(c.id)).reduce((s, c) => s + c.pendiente, 0);
        const adelantoC = fijos.find((c) => c.id === adelantoForm.compromisoId);
        const adelantoMeses = Math.max(0, Math.round(toNumber(adelantoForm.meses)) || 0);
        const adelantoPendienteActual = adelantoC && adelantoC.pendiente > 0.01 ? adelantoC.pendiente : 0;
        const adelantoTotal = adelantoC ? adelantoPendienteActual + adelantoMeses * adelantoC.amount : 0;
        return (
          <div className="sheet-backdrop" onClick={() => setSheet(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
              <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
              <div className="sheet-header"><span className="sheet-title">{pagoLoteTab === 'varios' ? 'Pagar varios gastos fijos' : 'Adelantar meses'}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
              <div className="type-toggle">
                <button className={pagoLoteTab === 'varios' ? 'active fijo' : ''} onClick={() => setPagoLoteTab('varios')}><Icon name="List" size={14} /> Pagar varios</button>
                <button className={pagoLoteTab === 'adelanto' ? 'active fijo' : ''} onClick={() => setPagoLoteTab('adelanto')}><Icon name="Zap" size={14} /> Adelantar meses</button>
              </div>
              {pagoLoteTab === 'varios' ? (
                <>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
                    Marca los que quieras pagar juntos. Los atrasados (con saldo de meses anteriores) ya vienen marcados.
                  </div>
                  {pendientes.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>No tienes gastos fijos pendientes por pagar ahorita.</div>
                  ) : (
                    <div style={{ marginBottom: 8 }}>
                      {pendientes.map((c) => {
                        const selected = pagoLoteForm.selectedIds.includes(c.id);
                        const atrasado = c.carryOver > 0.01;
                        return (
                          <div key={c.id} className={`lote-row ${selected ? 'selected' : ''}`} onClick={() => togglePagoLoteId(c.id)}>
                            <div className="lote-checkbox">{selected && <Icon name="Check" size={13} />}</div>
                            <div className="lote-row-body">
                              <div className="lote-row-name">{c.name}</div>
                              <div className="lote-row-sub">
                                {atrasado ? `Atrasado · incluye ${fmt(c.carryOver)} de antes` : catById(c.category).label}
                              </div>
                            </div>
                            <div className="lote-row-amount">{fmt(c.pendiente)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {pagoLoteForm.selectedIds.length > 0 && (
                    <div className="lote-total-row">
                      <span className="totals-subhead" style={{ margin: 0 }}>Total a pagar</span>
                      <span className="cxp-total-amount" style={{ fontSize: 18 }}>{fmt(totalSeleccionado)}</span>
                    </div>
                  )}
                  <div className="field-label">¿De dónde sale este dinero? *</div>
                  {moneyLocations.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: 'var(--expense)', margin: '-4px 0 12px' }}>
                      Todavía no tienes ubicaciones de dinero. Créalas primero desde la pestaña Tarjetas para poder guardar este movimiento.
                    </div>
                  ) : (
                    <div>{renderLocationPicker(moneyLocationsForGasto(), pagoLoteForm.locationId, (id) => setPagoLoteForm((f) => ({ ...f, locationId: f.locationId === id ? '' : id })))}</div>
                  )}
                  <div className="field-label">Fecha</div>
                  <input className="text-input" type="date" value={pagoLoteForm.date} onChange={(e) => setPagoLoteForm((f) => ({ ...f, date: e.target.value }))} />
                  {pagoLoteError && <div className="form-error">{pagoLoteError}</div>}
                  <button className="save-btn" disabled={!(pagoLoteForm.selectedIds.length > 0 && pagoLoteForm.locationId)} onClick={submitPagoLote}><Icon name="Check" size={16} /> Pagar {pagoLoteForm.selectedIds.length > 0 ? `${pagoLoteForm.selectedIds.length} gasto${pagoLoteForm.selectedIds.length !== 1 ? 's' : ''} fijo${pagoLoteForm.selectedIds.length !== 1 ? 's' : ''}` : 'seleccionados'}</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
                    Elige un gasto fijo y paga hoy varios meses de una vez. Si trae algo pendiente del mes en curso (o atrasado), primero se liquida eso y luego se suman los meses futuros que elijas.
                  </div>
                  {fijos.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Todavía no tienes gastos fijos creados.</div>
                  ) : (
                    <div style={{ marginBottom: 8 }}>
                      {fijos.map((c) => {
                        const selected = adelantoForm.compromisoId === c.id;
                        return (
                          <div key={c.id} className={`lote-row ${selected ? 'selected' : ''}`} onClick={() => setAdelantoForm((f) => ({ ...f, compromisoId: c.id }))}>
                            <div className="lote-checkbox">{selected && <Icon name="Check" size={13} />}</div>
                            <div className="lote-row-body">
                              <div className="lote-row-name">{c.name}</div>
                              <div className="lote-row-sub">
                                {c.pendiente > 0.01 ? `Pendiente este mes: ${fmt(c.pendiente)}` : 'Al día este mes'} · {fmt(c.amount)}/mes
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="field-label">¿Cuántos meses quieres adelantar?</div>
                  <div className="stepper-row">
                    <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setAdelantoForm((f) => ({ ...f, meses: Math.max(1, (Math.round(toNumber(f.meses)) || 1) - 1) }))}><Icon name="Minus" size={14} /></button>
                    <input className="text-input" type="number" min="1" max="24" value={adelantoForm.meses} onChange={(e) => setAdelantoForm((f) => ({ ...f, meses: e.target.value }))} />
                    <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setAdelantoForm((f) => ({ ...f, meses: Math.min(24, (Math.round(toNumber(f.meses)) || 0) + 1) }))}><Icon name="Plus" size={14} /></button>
                  </div>
                  {adelantoC && adelantoMeses > 0 && (
                    <div className="lote-total-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                      {adelantoPendienteActual > 0.01 && (
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Pendiente actual: {fmt(adelantoPendienteActual)}</div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{adelantoMeses} mes{adelantoMeses !== 1 ? 'es' : ''} × {fmt(adelantoC.amount)} = {fmt(adelantoMeses * adelantoC.amount)}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Cubre hasta {periodLabel(nextPeriodKey(currentPeriodKey, adelantoMeses - 1))}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 4 }}>
                        <span className="totals-subhead" style={{ margin: 0 }}>Total a pagar</span>
                        <span className="cxp-total-amount" style={{ fontSize: 18 }}>{fmt(adelantoTotal)}</span>
                      </div>
                    </div>
                  )}
                  <div className="field-label">¿De dónde sale este dinero? *</div>
                  {moneyLocations.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: 'var(--expense)', margin: '-4px 0 12px' }}>
                      Todavía no tienes ubicaciones de dinero. Créalas primero desde la pestaña Tarjetas para poder guardar este movimiento.
                    </div>
                  ) : (
                    <div>{renderLocationPicker(moneyLocationsForGasto(), adelantoForm.locationId, (id) => setAdelantoForm((f) => ({ ...f, locationId: f.locationId === id ? '' : id })))}</div>
                  )}
                  <div className="field-label">Fecha</div>
                  <input className="text-input" type="date" value={adelantoForm.date} onChange={(e) => setAdelantoForm((f) => ({ ...f, date: e.target.value }))} />
                  {adelantoError && <div className="form-error">{adelantoError}</div>}
                  <button className="save-btn" disabled={!(adelantoC && adelantoMeses > 0 && adelantoForm.locationId)} onClick={submitAdelanto}><Icon name="Check" size={16} /> Adelantar {adelantoMeses > 0 ? `${adelantoMeses} mes${adelantoMeses !== 1 ? 'es' : ''}` : ''}</button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {sheet?.type === 'edit-amount' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
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

      {sheet?.type === 'edit-date' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
            <div className="sheet-header"><span className="sheet-title">Editar fecha · {sheet.compromiso.name}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 4 }}>
              Cambia el día en que {sheet.compromiso.kind === 'ingreso_fijo' ? 'debería llegar este ingreso' : 'se cobra este gasto'}. A partir de guardar, todas las fechas futuras (calendario, recordatorios, "cada X días") se recalculan solas desde el nuevo día — lo que ya está pagado o cobrado en meses anteriores no se toca.
            </div>
            <div className="field-label">Repetir</div>
            <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {[
                { id: 'diario', label: 'Cada día' },
                { id: 'semanal', label: 'Cada semana' },
                { id: 'quincenal', label: 'Cada 2 semanas' },
                { id: 'mensual', label: 'Cada mes' },
              ].map((r) => (
                <div key={r.id} className={`cat-choice ${editDateForm.recurFreq === r.id ? 'selected' : ''}`} onClick={() => setEditDateForm((f) => ({ ...f, recurFreq: r.id }))}>
                  <Icon name="RefreshCw" size={14} />
                  <span className="cat-choice-label">{r.label}</span>
                </div>
              ))}
            </div>
            {editDateForm.recurFreq === 'mensual' && (
              <>
                <div className="field-label">{sheet.compromiso.kind === 'ingreso_fijo' ? '¿Qué día del mes debería llegar? (opcional)' : '¿Qué día del mes se cobra? (opcional)'}</div>
                <input
                  className="text-input"
                  type="date"
                  value={dayToDateInput(editDateForm.notifyDay)}
                  onChange={(e) => setEditDateForm((f) => ({ ...f, notifyDay: dateInputToDay(e.target.value) }))}
                />
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-6px 0 12px' }}>
                  Elige cualquier fecha; solo tomamos el día. Ej. si eliges el 15, se recalcula para el 15 de cada mes en adelante.
                </div>
              </>
            )}
            {(editDateForm.recurFreq === 'semanal' || editDateForm.recurFreq === 'quincenal') && (
              <>
                <div className="field-label">{sheet.compromiso.kind === 'ingreso_fijo' ? '¿Qué día debería llegar? (opcional)' : '¿Qué día se cobra? (opcional)'}</div>
                <input
                  className="text-input"
                  type="date"
                  value={editDateForm.anchorDate || todayStr()}
                  onChange={(e) => setEditDateForm((f) => ({ ...f, anchorDate: e.target.value }))}
                />
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-6px 0 12px' }}>
                  Elige cualquier fecha en la que caiga este {sheet.compromiso.kind === 'ingreso_fijo' ? 'ingreso' : 'pago'}; desde ahí se cuenta cada {editDateForm.recurFreq === 'semanal' ? '7' : '14'} días para el siguiente y para el recordatorio.
                </div>
              </>
            )}
            {editDateError && <div className="form-error">{editDateError}</div>}
            <button className="save-btn" onClick={submitEditDate}><Icon name="Check" size={16} /> Guardar fecha</button>
          </div>
        </div>
      )}

      {sheet?.type === 'por-cobrar-detalle' && (() => {
        const key = sheet.name.trim().toLowerCase();
        const group = pendingItemsByPerson[key];
        const items = (group?.items || []).slice().sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (b.id || 0) - (a.id || 0)));
        const total = items.reduce((s, it) => s + it.amount, 0);
        return (
          <div className="sheet-backdrop" onClick={() => setSheet(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
              <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
              <div className="sheet-header"><span className="sheet-title">Por cobrar · {sheet.name}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
                Esto es lo que {sheet.name} todavía no te ha devuelto. Si ya te pagó alguno, tócalo para marcarlo "Recibido" sin que se registre nada más; si te devolvió todo junto, usa "Marcar todo pagado" para además dejarlo anotado como ingreso.
              </div>
              {items.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Ya no hay nada pendiente de {sheet.name}.</div>
              ) : (
                items.map((it, idx) => (
                  <button
                    key={idx}
                    onClick={() => it.source === 'tx' ? toggleTxParticipantPaid(it.txId, it.participantId) : toggleTxParticipantPaid(null, it.participantId, it.compromisoId, it.paymentId)}
                    className="lote-row"
                    style={{ width: '100%', textAlign: 'left', marginBottom: 6, background: 'none', border: 'none', borderBottom: '1px solid var(--line)', font: 'inherit', color: 'inherit' }}
                  >
                    <div className="lote-row-body">
                      <div className="lote-row-name">{it.label}</div>
                      <div className="lote-row-sub">{new Date(it.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                    <div className="lote-row-amount">{fmt(it.amount)}</div>
                  </button>
                ))
              )}
              {items.length > 0 && (
                <>
                  <div className="lote-total-row">
                    <span className="totals-subhead" style={{ margin: 0 }}>Total pendiente</span>
                    <span className="cxp-total-amount" style={{ fontSize: 18 }}>{fmt(total)}</span>
                  </div>
                  <div className="field-label">¿Cuánto te dio realmente?</div>
                  <div className="amount-input-wrap" style={{ marginBottom: 4 }}>
                    <span className="amount-currency">$</span>
                    <input
                      className="amount-input"
                      style={{ fontSize: 20 }}
                      type="text"
                      inputMode="decimal"
                      placeholder={total.toFixed(2)}
                      value={porCobrarAmount}
                      onChange={(e) => setPorCobrarAmount(formatAmountTyping(e.target.value))}
                    />
                  </div>
                  {(() => {
                    const given = porCobrarAmount ? toNumber(porCobrarAmount) : total;
                    const excess = given - total;
                    return excess > 0.5 ? (
                      <div style={{ fontSize: 11.5, color: 'var(--income)', margin: '0 0 12px' }}>
                        Te dio {fmt(excess)} de más — se anota aparte como ingreso extra, no como cobranza.
                      </div>
                    ) : <div style={{ marginBottom: 12 }} />;
                  })()}
                  <button className="save-btn" onClick={() => { markPersonPaid(sheet.name, porCobrarAmount ? toNumber(porCobrarAmount) : null); setSheet(null); }}><Icon name="CheckCircle2" size={16} /> Marcar todo pagado</button>
                </>
              )}
            </div>
          </div>
        );
      })()}


      {sheet?.type === 'budget-cat' && (() => {
        const c = catById(sheet.catId);
        const spent = gastoMesActualPorCategoria[c.id] || 0;
        return (
          <div className="sheet-backdrop" onClick={() => setSheet(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
              <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
              <div className="sheet-header"><span className="sheet-title">Presupuesto · {c.label}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 4 }}>
                {budgetSavingsChoices.length > 0
                  ? `Llevas ${fmt(budgetSavingsChoices.reduce((s, id) => s + (progresoMetaPorAhorro[id] || 0), 0))} de meta este mes entre esa${budgetSavingsChoices.length > 1 ? 's' : ''} cuenta${budgetSavingsChoices.length > 1 ? 's' : ''} (cuenta lo ahorrado y lo que ya hayas pagado desde ahí; lo que sobre sin retirar es tu ventaja para el siguiente mes).`
                  : `Llevas gastado ${fmt(spent)} este mes en esta categoría.`} Deja en blanco o en 0 para quitar el presupuesto.
              </div>
              <div className="field-label">Presupuesto mensual</div>
              <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={budgetAmount} onChange={(e) => setBudgetAmount(formatAmountTyping(e.target.value))} autoFocus /></div>

              <div className="field-label" style={{ marginTop: 4 }}>Vincular a una o varias cuentas de ahorro (opcional)</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>
                Si vinculas alguna, la barra de arriba ya no compara "gastado", sino lo que hayas <b>apartado este mes</b> entre esas cuentas — como una meta de ahorro por categoría. Útil si un mismo gasto se paga desde varias cuentas (ej. AT&T + Internet dentro de "Servicios").
              </div>
              {savings.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12 }}>
                  Todavía no tienes cuentas de ahorro. Crea una desde la pestaña Ahorro y regresa aquí para vincularla.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  <button
                    className={`cat-choice-row ${budgetSavingsChoices.length === 0 ? 'active' : ''}`}
                    onClick={() => setBudgetSavingsChoices([])}
                  >Sin vincular · comparar contra lo gastado</button>
                  {savings.map((a) => {
                    const selected = budgetSavingsChoices.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        className={`cat-choice-row ${selected ? 'active' : ''}`}
                        onClick={() => setBudgetSavingsChoices((ids) => {
                          const next = selected ? ids.filter((id) => id !== a.id) : [...ids, a.id];
                          if (!selected && !toNumber(budgetAmount) && a.target) setBudgetAmount(String(next.reduce((s, id) => s + (savings.find((x) => x.id === id)?.target || 0), 0)));
                          return next;
                        })}
                      >
                        <Icon name="PiggyBank" size={13} /> {a.name}{selected ? ' ✓' : ''}
                      </button>
                    );
                  })}
                </div>
              )}

              <button className="save-btn" onClick={submitBudget}><Icon name="Check" size={16} /> Guardar presupuesto</button>
            </div>
          </div>
        );
      })()}

      {sheet?.type === 'compromiso-shared-detail' && (() => {
        const c = compromisosView.find((x) => x.id === sheet.compromiso.id) || sheet.compromiso;
        const totalParts = (c.shared?.participants || []).reduce((s, p) => s + p.amount, 0);
        const paymentsSorted = [...(c.payments || [])].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (b.id || 0) - (a.id || 0)));
        return (
          <div className="sheet-backdrop" onClick={() => setSheet(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
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
                paymentsSorted.map((p) => {
                  // El desglose de quién debe qué de ESTE pago normalmente
                  // vive en la transacción vinculada (tx.shared) — eso pasa
                  // cuando se pagó con "Abonar", pago en lote o adelanto. Si
                  // se pagó vinculando la cuenta desde "+", en cambio, el
                  // desglose se guardó directo en el pago del compromiso
                  // (p.participants); por eso revisamos ambos lugares.
                  const tx = transactions.find((t) => t.paymentId === p.id);
                  const usaTx = !!tx?.shared;
                  const parts = usaTx ? tx.shared.participants : (p.participants || []);
                  return (
                    <div key={p.id} style={{ marginBottom: 8 }}>
                      <div className="mini-row">
                        <div className="mini-row-mid">
                          <div className="mini-row-name">{new Date(p.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                          {p.note && <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{p.note}</div>}
                        </div>
                        <div className="mini-row-amount">{fmt(p.amount)}</div>
                      </div>
                      {parts.length > 0 && (
                        <div style={{ margin: '0 0 0 12px', paddingLeft: 10, borderLeft: '2px solid var(--line)' }}>
                          {parts.map((pp, i) => (
                            <div key={pp.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
                              <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{pp.name}</span>
                              <button
                                onClick={() => (usaTx ? toggleTxParticipantPaid(tx.id, pp.id) : toggleTxParticipantPaid(null, i, c.id, p.id))}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontFamily: 'inherit' }}
                                title={pp.paid ? 'Marcar como pendiente' : 'Marcar como ya me pagó'}
                              >
                                <span style={{ fontSize: 11.5, fontWeight: 600, color: pp.paid ? 'var(--ink-soft)' : 'var(--ink)', textDecoration: pp.paid ? 'line-through' : 'none' }}>{fmt(pp.amount)}</span>
                                {pp.paid
                                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--income)' }}><Icon name="CheckCircle2" size={12} /> Recibido</span>
                                  : <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--expense)' }}><Icon name="Circle" size={12} /> Pendiente</span>}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <button className="abonar-btn" style={{ marginTop: 16 }} disabled={c.pendiente <= 0.01} onClick={() => { setSheet(null); openAbonar(c); }}>{c.pendiente <= 0.01 ? 'Pagado este mes' : 'Pagar / Abonar'}</button>
            </div>
          </div>
        );
      })()}

      {(sheet?.type === 'new-savings' || sheet?.type === 'edit-savings') && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
            <div className="sheet-header"><span className="sheet-title">{sheet.type === 'edit-savings' ? 'Editar cuenta de ahorro' : 'Nueva cuenta de ahorro'}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div className="field-label">Nombre</div>
            <input className="text-input" placeholder="Ej. Fondo de emergencia" value={savForm.name} onChange={(e) => setSavForm((f) => ({ ...f, name: e.target.value }))} />
            <div className="field-label">Meta *</div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-2px 0 6px' }}>¿Cuánto quieres juntar? Lo necesitamos para calcular tu avance.</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={savForm.target} onChange={(e) => setSavForm((f) => ({ ...f, target: formatAmountTyping(e.target.value) }))} /></div>
            <div className="field-label">Categoría (opcional)</div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-2px 0 6px' }}>Para agrupar varias cuentas de ahorro bajo un mismo gasto — ej. AT&T e Internet ambas como "Servicios".</div>
            <div className="cat-grid">
              {allGastoCats.map((c) => (
                <div key={c.id} className={`cat-choice ${savForm.category === c.id ? 'selected' : ''}`} onClick={() => setSavForm((f) => ({ ...f, category: f.category === c.id ? '' : c.id }))}>
                  <div className="cat-choice-icon" style={{ background: c.color }}><Icon name={c.icon} size={15} /></div><span className="cat-choice-label">{c.label}</span>
                </div>
              ))}
            </div>
            {moneyLocations.length > 0 && (
              <>
                <div className="field-label">¿En qué cuenta vive este ahorro? (opcional)</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-2px 0 6px' }}>Así sabrás en la pestaña Tarjetas cuánto de esa cuenta ya está apartado.</div>
                <div>
                  {renderLocationPicker(moneyLocations, savForm.locationId, (id) => setSavForm((f) => ({ ...f, locationId: f.locationId === id ? '' : id })))}
                </div>
              </>
            )}
            {savError && <div className="form-error">{savError}</div>}
            <button className="save-btn" disabled={!(savForm.name.trim() && toNumber(savForm.target) > 0)} onClick={sheet.type === 'edit-savings' ? submitEditSavings : submitSavings}>
              <Icon name="Check" size={16} /> {sheet.type === 'edit-savings' ? 'Guardar cambios' : 'Crear cuenta'}
            </button>
          </div>
        </div>
      )}

      {sheet?.type === 'link-savings' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
            <div className="sheet-header"><span className="sheet-title">¿En qué cuenta vive "{sheet.account.name}"?</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
              Vincula esta meta a la tarjeta o monedero donde realmente está guardado ese dinero.
            </div>
            {moneyLocations.length === 0 ? (
              <div className="empty-state" style={{ padding: '16px 10px' }}>Todavía no tienes tarjetas ni monederos. Créalos primero desde la pestaña Tarjetas.</div>
            ) : (
              <>
                <div>{renderLocationPicker(moneyLocations, sheet.account.locationId, (id) => submitLinkSavings(sheet.account.locationId === id ? null : id))}</div>
                {sheet.account.locationId && (
                  <button className="danger-btn neutral" style={{ marginTop: 10 }} onClick={() => submitLinkSavings(null)}>
                    <Icon name="X" size={14} /> Quitar vínculo
                  </button>
                )}
              </>
            )}
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
            <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
              <div className="sheet-header"><span className="sheet-title">{loc.tipo === 'tarjeta' ? (loc.nombre || 'Tarjeta') : 'Monedero'}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '-10px 0 12px' }}>De {loc.persona}</div>
              <div className={`wallet-card ${loc.tipo === 'efectivo' ? 'wallet-card-cash' : ''}`} style={{ background: loc.tipo === 'tarjeta' ? bg : undefined, cursor: 'default', marginBottom: 16, ...(sobregirada ? { boxShadow: '0 0 0 2px var(--expense), var(--shadow-card)' } : {}) }}>
                <div className="wallet-card-top">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {loc.tipo === 'tarjeta' && bankInfo?.name && <span className="bank-monogram"><Icon name="Landmark" size={14} /></span>}
                    <div>
                      <div className="wallet-card-name">{loc.tipo === 'tarjeta' ? (loc.nombre || 'Tarjeta') : 'Monedero'}</div>
                      <span className="wallet-card-pill">{loc.tipo === 'tarjeta' ? (loc.esCredito ? 'CRÉDITO' : 'DÉBITO') : 'MONEDERO'}</span>
                      {sobregirada && <span className="wallet-card-pill" style={{ background: 'var(--expense)', marginLeft: 5 }}>SOBREGIRADA</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="wallet-card-amount">{fmt(loc.monto)}</div>
                    {loc.esCredito && <div className="wallet-card-caption">Gastos del mes (ciclo)</div>}
                  </div>
                </div>
                {!loc.esCredito && reservedForLocation(loc.id) > 0.01 && (
                  <div className="wallet-card-footrow">
                    <span><Icon name="PiggyBank" size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Apartado para ahorro</span>
                    <span>{fmt(reservedForLocation(loc.id))}</span>
                  </div>
                )}
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
                    {/mastercard/i.test(net || '') && <span className="net-glyph"><span className="net-circle net-circle-a" /><span className="net-circle net-circle-b" /></span>}
                    {/visa/i.test(net || '') && <span className="net-glyph net-glyph-visa" />}
                    {/amex|american express/i.test(net || '') && <span className="net-glyph net-glyph-amex"><Icon name="CreditCard" size={12} /></span>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {moneyLocations.length >= 2 && (
                  <button className="save-btn" style={{ background: 'var(--gold)' }} onClick={() => openTraspaso({ fromId: loc.id })}><Icon name="ArrowLeftRight" size={16} /> Traspasar dinero</button>
                )}
                <button className="save-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)', border: '1px solid var(--line)' }} onClick={() => openEditLocation(loc)}><Icon name="Pencil" size={16} /> Editar {loc.tipo === 'tarjeta' ? 'tarjeta' : 'monedero'}</button>
                <button className="save-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)', border: '1px solid var(--line)' }} onClick={() => setSheet((s) => ({ ...s, historyOpen: !s.historyOpen }))}>
                  <Icon name={sheet.historyOpen ? 'ChevronUp' : 'ChevronDown'} size={16} /> {sheet.historyOpen ? 'Ocultar historial' : 'Mostrar historial'}
                </button>
                {sheet.historyOpen && (() => {
                  const historyTxs = transactions
                    .filter((t) => t.locationId === loc.id || t.fromLocationId === loc.id || t.toLocationId === loc.id)
                    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.id - a.id));
                  if (historyTxs.length === 0) {
                    return <div className="empty-state" style={{ padding: '14px 0' }}>Sin movimientos todavía.</div>;
                  }
                  return (
                    <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
                      {historyTxs.map((t) => {
                        const dateLabel = new Date(t.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
                        if (t.type === 'traspaso') {
                          const isOut = t.fromLocationId === loc.id;
                          return (
                            <div className="tx-row" key={t.id} style={{ cursor: 'default' }}>
                              <div className="tx-icon" style={{ background: 'var(--gold)' }}><Icon name="ArrowLeftRight" size={16} /></div>
                              <div className="tx-mid">
                                <div className="tx-cat">Traspaso</div>
                                <div className="tx-note">{locationLabel(t.fromLocationId)} → {locationLabel(t.toLocationId)} · {dateLabel}</div>
                              </div>
                              <div className="tx-amount" style={{ color: isOut ? 'var(--expense)' : 'var(--income)' }}>{isOut ? '-' : '+'}{fmt(t.amount)}</div>
                            </div>
                          );
                        }
                        const c = catById(t.category);
                        return (
                          <div className="tx-row" key={t.id} style={{ cursor: 'default' }}>
                            <div className="tx-icon" style={{ background: c.color }}><Icon name={c.icon} size={16} /></div>
                            <div className="tx-mid">
                              <div className="tx-cat">{c.label}{t.subcategory && ` · ${subcatLabel(t.subcategory)}`}{!t.subcategory && t.servicio && ` · ${t.servicio}`}</div>
                              <div className="tx-note">{t.note}{t.note && ' · '}{dateLabel}</div>
                            </div>
                            <div className={`tx-amount ${t.type === 'ingreso' ? 'in' : 'out'}`}>{t.type === 'ingreso' ? '+' : '-'}{fmt(t.amount)}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <button className="danger-btn" onClick={() => { setSheet(null); deleteLocation(loc.id); }}><Icon name="Trash2" size={14} /> Eliminar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {sheet?.type === 'flow-projection' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
            <div className="sheet-header"><span className="sheet-title">Flujo del mes</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>

            <div className="card" style={{ background: 'var(--green)', color: 'var(--on-accent)' }}>
              <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Puedes gastar hoy, sin comprometer lo que ya viene</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 700, marginTop: 4 }}>{fmt(flowProjection.disponibleHoy)}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Repartido entre los {flowProjection.diasRestantes} días que faltan para fin de mes</div>
            </div>

            <div className="card">
              <div className="card-title">Cómo se calculó</div>
              <div className="compromiso-nums" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Disponible de este mes</span><span style={{ fontFamily: 'var(--mono)' }}>{fmt(flowProjection.disponibleMes)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--expense)' }}><span>− Gastos fijos que aún faltan</span><span style={{ fontFamily: 'var(--mono)' }}>{fmt(flowProjection.pendienteGastosFijos)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--line)', paddingTop: 8, fontWeight: 700 }}><span>÷ {flowProjection.diasRestantes} días restantes</span><span style={{ fontFamily: 'var(--mono)' }}>{fmt(flowProjection.disponibleHoy)}/día</span></div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Proyección a fin de mes</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: flowProjection.proyectadoFinMes >= 0 ? 'var(--income)' : 'var(--expense)' }}>{fmt(flowProjection.proyectadoFinMes)}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                Si de aquí a fin de mes solo pasa lo que ya sabes que viene: te faltan {fmt(flowProjection.pendienteGastosFijos)} en gastos fijos
                {flowProjection.pendienteIngresosFijos > 0 && <> y esperas {fmt(flowProjection.pendienteIngresosFijos)} en ingresos fijos</>}.
              </div>
            </div>
          </div>
        </div>
      )}

      {pinSetup && (
        <div className="sheet-backdrop" onClick={() => setPinSetup(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">{pinSetup.step === 'new' ? 'Crea tu PIN' : 'Confírmalo'}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setPinSetup(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
              {pinSetup.step === 'new' ? '4 dígitos. Solo tú deberías saberlo.' : 'Escríbelo otra vez para confirmar.'}
            </div>
            <input
              className="text-input pin-input"
              type="password" inputMode="numeric" maxLength={4} autoFocus
              value={pinSetup.input}
              onChange={(e) => setPinSetup((p) => ({ ...p, input: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              onKeyDown={(e) => { if (e.key === 'Enter' && pinSetup.input.length === 4) submitPinSetupDigit(); }}
            />
            {pinSetup.error && <div className="form-error">{pinSetup.error}</div>}
            <button className="save-btn" disabled={pinSetup.input.length !== 4} onClick={submitPinSetupDigit}>
              <Icon name="Check" size={16} /> {pinSetup.step === 'new' ? 'Siguiente' : 'Guardar PIN'}
            </button>
          </div>
        </div>
      )}

      {sheet?.type === 'confirm' && (
        <div className="sheet-backdrop" onClick={() => { const cancel = sheet.onCancel; setSheet(null); cancel && cancel(); }}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ ...sheetDragStyle, paddingTop: 26 }}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
            <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink)', marginBottom: 20 }}>{sheet.message}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className={sheet.danger ? 'danger-btn' : 'save-btn'}
                onClick={() => { const fn = sheet.onConfirm; setSheet(null); fn && fn(); }}
              >{sheet.confirmLabel}</button>
              <button
                className="save-btn"
                style={{ background: 'var(--paper-dim)', color: 'var(--ink)', border: '1px solid var(--line)' }}
                onClick={() => { const cancel = sheet.onCancel; setSheet(null); cancel && cancel(); }}
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {sheet?.type === 'wallet-menu' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
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
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
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
            {locForm.tipo === 'tarjeta' && (() => {
              const previewBankInfo = getBankInfo(locForm);
              const previewNet = locForm.red || previewBankInfo?.network;
              const previewGradient = CARD_GRADIENTS[hashStr(locForm.nombre || 'nueva-tarjeta') % CARD_GRADIENTS.length];
              return (
                <>
                  <CardLivePreview
                    nombre={locForm.nombre}
                    ultimos4={locForm.ultimos4}
                    esCredito={locForm.esCredito}
                    bankInfo={previewBankInfo}
                    net={previewNet}
                    persona={locForm.persona}
                    gradient={previewGradient}
                    flipped={cardPreviewFlippedNew}
                  />
                  <div className="card-live-flip-hint">La tarjeta gira mientras capturas el número o CLABE</div>
                  <div className="field-label">Nombre / alias</div>
                  <input className="text-input" placeholder="Ej. Tarjeta de nómina, Tarjeta principal..." value={locForm.nombre} onChange={(e) => setLocForm((f) => ({ ...f, nombre: e.target.value }))} />
                  <div className="field-label">CLABE interbancaria (opcional)</div>
                  <input
                    className="text-input"
                    inputMode="numeric"
                    maxLength={18}
                    placeholder="18 dígitos"
                    value={locForm.clabe}
                    onFocus={() => setCardPreviewFlippedNew(true)}
                    onBlur={() => setCardPreviewFlippedNew(false)}
                    onChange={(e) => setLocForm((f) => ({ ...f, clabe: e.target.value.replace(/\D/g, '').slice(0, 18) }))}
                  />
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-6px 0 12px' }}>
                    {previewBankInfo ? `Banco identificado: ${previewBankInfo.name}.` : 'Escribe el nombre de tu banco o captura tu CLABE para identificarlo automáticamente.'}
                  </div>
                  <div className="field-label">Número de tarjeta (opcional)</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-2px 0 6px' }}>Solo para detectar la red (Visa/Mastercard/Amex) y los últimos 4 dígitos; no se guarda el número completo.</div>
                  <input
                    className="text-input"
                    inputMode="numeric"
                    maxLength={19}
                    placeholder="•••• •••• •••• ••••"
                    value={formatCardNumberTyping(locCardNumber)}
                    onFocus={() => setCardPreviewFlippedNew(true)}
                    onBlur={() => setCardPreviewFlippedNew(false)}
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
                  <div className="field-label">{locForm.esCredito ? 'Gastado en el ciclo actual (opcional)' : 'Monto actual (opcional)'}</div>
                  <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={locForm.monto} onChange={(e) => setLocForm((f) => ({ ...f, monto: formatAmountTyping(e.target.value) }))} /></div>
                  <div className="field-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 0 14px' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>¿Es tarjeta de crédito?</span>
                    <div className={`switch ${locForm.esCredito ? 'on' : ''}`} onClick={() => setLocForm((f) => ({ ...f, esCredito: !f.esCredito }))} />
                  </div>
                </>
              );
            })()}
            {locForm.tipo === 'tarjeta' && locForm.esCredito && (
              <>
                <div className="field-label">Límite de crédito</div>
                <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={locForm.limite} onChange={(e) => setLocForm((f) => ({ ...f, limite: formatAmountTyping(e.target.value) }))} /></div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div className="field-label">Día de corte</div>
                    <input className="text-input" type="date" value={dayToDateInput(locForm.diaCorte)} onChange={(e) => setLocForm((f) => ({ ...f, diaCorte: dateInputToDay(e.target.value) }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="field-label">Día de pago</div>
                    <input className="text-input" type="date" value={dayToDateInput(locForm.diaPago)} onChange={(e) => setLocForm((f) => ({ ...f, diaPago: dateInputToDay(e.target.value) }))} />
                  </div>
                </div>
                <div className="field-label">Monto a pagar (opcional)</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-2px 0 6px' }}>Lo que te pide tu estado de cuenta este ciclo (pago para no generar intereses, o el mínimo).</div>
                <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={locForm.montoAPagar} onChange={(e) => setLocForm((f) => ({ ...f, montoAPagar: formatAmountTyping(e.target.value) }))} /></div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '10px 0 -2px' }}>
                  Si el monto que captures arriba supera el límite, esta tarjeta se vincula sola a un préstamo (CxP) por ese saldo, y cada vez que actualices el monto de la tarjeta ese préstamo se actualiza junto con ella.
                </div>
                {deudas.length > 0 && (
                  <>
                    <div className="field-label" style={{ marginTop: 12 }}>¿Esta tarjeta está ligada a un préstamo? (opcional — se llena sola si se sobregira)</div>
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
            {locForm.tipo === 'efectivo' && (
              <>
                <div className="field-label">Monto actual (opcional)</div>
                <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={locForm.monto} onChange={(e) => setLocForm((f) => ({ ...f, monto: formatAmountTyping(e.target.value) }))} /></div>
              </>
            )}
            {locError && <div className="form-error">{locError}</div>}
            <button className="save-btn" onClick={submitLocation}><Icon name="Check" size={16} /> Guardar ubicación</button>
          </div>
        </div>
      )}

      {sheet?.type === 'edit-location' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
            <div className="sheet-header"><span className="sheet-title">Actualizar {sheet.location.tipo === 'tarjeta' ? 'tarjeta' : 'monedero'}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12 }}>{sheet.location.persona} · {sheet.location.tipo === 'tarjeta' ? (sheet.location.nombre || 'Tarjeta') : 'Monedero'}</div>
            {sheet.location.tipo === 'tarjeta' && (
              <>
                <CardLivePreview
                  nombre={editLocForm.nombre}
                  ultimos4={editLocForm.ultimos4}
                  esCredito={sheet.location.esCredito}
                  bankInfo={getBankInfo(editLocForm)}
                  net={editLocForm.red || getBankInfo(editLocForm)?.network}
                  persona={sheet.location.persona}
                  gradient={CARD_GRADIENTS[hashStr(sheet.location.id || editLocForm.nombre || 'tarjeta') % CARD_GRADIENTS.length]}
                  flipped={cardPreviewFlippedEdit}
                />
                <div className="card-live-flip-hint">La tarjeta gira mientras editas el número</div>
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
                  onFocus={() => setCardPreviewFlippedEdit(true)}
                  onBlur={() => setCardPreviewFlippedEdit(false)}
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
                    <input className="text-input" type="date" value={dayToDateInput(editLocForm.diaCorte)} onChange={(e) => setEditLocForm((f) => ({ ...f, diaCorte: dateInputToDay(e.target.value) }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="field-label">Día de pago</div>
                    <input className="text-input" type="date" value={dayToDateInput(editLocForm.diaPago)} onChange={(e) => setEditLocForm((f) => ({ ...f, diaPago: dateInputToDay(e.target.value) }))} />
                  </div>
                </div>
                <div className="field-label">Monto a pagar (opcional)</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '-2px 0 6px' }}>Lo que te pide tu estado de cuenta este ciclo.</div>
                <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={editLocForm.montoAPagar} onChange={(e) => setEditLocForm((f) => ({ ...f, montoAPagar: formatAmountTyping(e.target.value) }))} /></div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '10px 0 -2px' }}>
                  Si el monto que captures arriba supera el límite, esta tarjeta se vincula sola a un préstamo (CxP) por ese saldo, y cada vez que actualices el monto de la tarjeta ese préstamo se actualiza junto con ella.
                </div>
                {deudas.length > 0 && (
                  <>
                    <div className="field-label" style={{ marginTop: 12 }}>¿Esta tarjeta está ligada a un préstamo? (opcional — se llena sola si se sobregira)</div>
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
            <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
              <div className="sheet-header"><span className="sheet-title">Conciliar con mi banco</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
              <input
                type="file"
                accept="application/pdf,image/*"
                ref={pdfInputRef}
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) handleArchivoBanco(f); }}
              />
              <button
                className="mini-abonar"
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}
                disabled={pdfBusy}
                onClick={() => pdfInputRef.current && pdfInputRef.current.click()}
              >
                <Icon name="Upload" size={13} />
                {pdfBusy ? (pdfProgress || 'Leyendo…') : 'Leer PDF o captura de mi banco'}
              </button>
              {pdfError && (
                <div style={{ fontSize: 11.5, color: 'var(--expense)', margin: '-4px 0 10px', lineHeight: 1.4 }}>{pdfError}</div>
              )}
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 10px' }}>
                Sube el PDF que te manda tu banco (aunque sea una imagen, sin texto seleccionable) o una captura de pantalla de tu app del banco, y se agregan solos abajo. O si prefieres, pega aquí los movimientos a mano, uno por línea, así: <b>AAAA-MM-DD | monto | concepto</b>. Ejemplo: <code style={{ fontSize: 10.5 }}>2026-07-14 | -700.00 | Pago tarjeta</code>. Usa monto negativo para cargos/gastos y positivo para depósitos/ingresos.
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
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
            <div className="sheet-header"><span className="sheet-title">Traspaso entre cuentas</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
              Mueve dinero entre tus propias ubicaciones (ej. te llega dinero a tu tarjeta/banco y retiras a efectivo). No suma ni resta a tus ingresos o gastos: una cuenta baja y la otra sube por el mismo monto.
            </div>
            <div className="field-label">Monto *</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={traspasoForm.amount} onChange={(e) => setTraspasoForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-label">Sale de *</div>
            <div>{renderLocationPicker(moneyLocations, traspasoForm.fromId, (id) => setTraspasoForm((f) => ({ ...f, fromId: f.fromId === id ? '' : id })))}</div>
            <div className="field-label">Entra a *</div>
            <div>{renderLocationPicker(moneyLocations.filter((l) => l.id !== traspasoForm.fromId), traspasoForm.toId, (id) => setTraspasoForm((f) => ({ ...f, toId: f.toId === id ? '' : id })))}</div>
            <div className="field-label">Nota (opcional)</div>
            <input className="text-input" type="text" placeholder="Ej. Retiro de cajero, depósito..." value={traspasoForm.note} onChange={(e) => setTraspasoForm((f) => ({ ...f, note: e.target.value }))} />
            <div className="field-label">Fecha *</div>
            <input className="text-input" type="date" value={traspasoForm.date} onChange={(e) => setTraspasoForm((f) => ({ ...f, date: e.target.value }))} />
            {traspasoError && <div className="form-error">{traspasoError}</div>}
            <button className="save-btn" onClick={submitTraspaso}><Icon name="Check" size={16} /> Guardar traspaso</button>
          </div>
        </div>
      )}

      {sheet?.type === 'edit-traspaso' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
            <div className="sheet-header"><span className="sheet-title">Editar traspaso</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>
              Si cambias el monto o las cuentas, primero se revierte el traspaso original y luego se aplica el nuevo, para que ambas cuentas queden cuadradas.
            </div>
            <div className="field-label">Monto *</div>
            <div className="amount-input-wrap"><span className="amount-currency">$</span><input className="amount-input" type="text" inputMode="decimal" placeholder="0.00" value={editTraspasoForm.amount} onChange={(e) => setEditTraspasoForm((f) => ({ ...f, amount: formatAmountTyping(e.target.value) }))} autoFocus /></div>
            <div className="field-label">Sale de *</div>
            <div>{renderLocationPicker(moneyLocations, editTraspasoForm.fromId, (id) => setEditTraspasoForm((f) => ({ ...f, fromId: f.fromId === id ? '' : id })))}</div>
            <div className="field-label">Entra a *</div>
            <div>{renderLocationPicker(moneyLocations.filter((l) => l.id !== editTraspasoForm.fromId), editTraspasoForm.toId, (id) => setEditTraspasoForm((f) => ({ ...f, toId: f.toId === id ? '' : id })))}</div>
            <div className="field-label">Nota (opcional)</div>
            <textarea className="text-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }} placeholder="Ej. Retiro de cajero, depósito..." value={editTraspasoForm.note} onChange={(e) => setEditTraspasoForm((f) => ({ ...f, note: e.target.value }))} />
            <div className="field-label">Fecha *</div>
            <input className="text-input" type="date" value={editTraspasoForm.date} onChange={(e) => setEditTraspasoForm((f) => ({ ...f, date: e.target.value }))} />
            {editTraspasoError && <div className="form-error">{editTraspasoError}</div>}
            <button
              className="save-btn"
              disabled={!(toNumber(editTraspasoForm.amount) > 0 && editTraspasoForm.fromId && editTraspasoForm.toId && editTraspasoForm.date)}
              onClick={submitEditTraspaso}
            ><Icon name="Check" size={16} /> Actualizar traspaso</button>
            <button className="danger-btn" onClick={() => deleteTraspaso(editTraspasoForm.id)}><Icon name="Trash2" size={14} /> Eliminar traspaso</button>
          </div>
        </div>
      )}

      {sheet?.type === 'savings-move' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
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
            <div className="field-label">{moveForm.kind === 'deposito' ? '¿En qué cuenta queda guardado el ahorro? *' : '¿A qué cuenta regresa? *'}</div>
            {moneyLocations.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 12px' }}>Primero registra una tarjeta o monedero en la pestaña Tarjetas.</div>
            ) : (
              <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {moneyLocations.filter((l) => !moveForm.persona || l.persona === moveForm.persona).map((l) => (
                  <div key={l.id} className={`cat-choice ${moveForm.locationId === l.id ? 'selected' : ''}`} onClick={() => setMoveForm((f) => ({ ...f, locationId: l.id }))}>
                    <Icon name={l.tipo === 'tarjeta' ? 'CreditCard' : 'Wallet'} size={16} />
                    <span className="cat-choice-label">{l.tipo === 'tarjeta' ? `${l.nombre || 'Tarjeta'}${l.esCredito != null ? ` · ${l.esCredito ? 'Crédito' : 'Débito'}` : ''}` : 'Monedero'}</span>
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
                  <div>{renderLocationPicker(moneyLocations.filter((l) => l.id !== moveForm.locationId), moveForm.origen, (id) => setMoveForm((f) => ({ ...f, origen: f.origen === id ? '' : id })))}</div>
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
          <div className="settings-card" onClick={(e) => e.stopPropagation()} style={settingsDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSettingsTouchStart} onTouchMove={handleSettingsTouchMove} onTouchEnd={handleSettingsTouchEnd} />
            <div className="close-row"><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSettingsOpen(false)}><Icon name="X" size={16} /></button></div>

            {settingsSection === null && (
              <>
                <div className="card-title">{familyName || 'Familia'}</div>
                <button className="settings-menu-row" onClick={() => setSettingsSection('familia')}>
                  <div className="settings-menu-icon" style={{ background: 'var(--green)' }}><Icon name="Users" size={17} color="#fff" /></div>
                  <div className="settings-menu-mid">
                    <div className="settings-menu-title">Familia</div>
                    <div className="settings-menu-sub">Nombre, código de invitación, integrantes</div>
                  </div>
                  <Icon name="ChevronRight" size={16} color="var(--ink-soft)" />
                </button>
                <button className="settings-menu-row" onClick={() => setSettingsSection('perfil')}>
                  <div className="settings-menu-icon" style={{ background: 'var(--gold)' }}>{profile ? avatarNode(profile.name, 34) : <Icon name="Users" size={17} color="var(--green)" />}</div>
                  <div className="settings-menu-mid">
                    <div className="settings-menu-title">Mi perfil</div>
                    <div className="settings-menu-sub">{profile?.name || 'Tú'} · foto, PIN, notificaciones</div>
                  </div>
                  <Icon name="ChevronRight" size={16} color="var(--ink-soft)" />
                </button>
                <button className="settings-menu-row" onClick={() => setSettingsSection('aspecto')}>
                  <div className="settings-menu-icon" style={{ background: '#1C1C1E' }}><Icon name="Moon" size={17} color="#fff" /></div>
                  <div className="settings-menu-mid">
                    <div className="settings-menu-title">Aspecto</div>
                    <div className="settings-menu-sub">{{ light: 'Claro', dark: 'Oscuro', system: 'Sistema' }[appearance] || 'Sistema'}</div>
                  </div>
                  <Icon name="ChevronRight" size={16} color="var(--ink-soft)" />
                </button>
                <button className="settings-menu-row" onClick={() => { setCalMonth(currentPeriodKey); setCalSelectedDate(null); setSettingsSection('calendario'); }}>
                  <div className="settings-menu-icon" style={{ background: 'var(--gold)' }}><Icon name="CalendarCheck" size={17} color="var(--green)" /></div>
                  <div className="settings-menu-mid">
                    <div className="settings-menu-title">Calendario</div>
                    <div className="settings-menu-sub">Días de pagos e ingresos pendientes, vinculado a Google Calendar</div>
                  </div>
                  <Icon name="ChevronRight" size={16} color="var(--ink-soft)" />
                </button>
                <button className="settings-menu-row" onClick={() => setSettingsSection('datos')}>
                  <div className="settings-menu-icon" style={{ background: '#6E6E73' }}><Icon name="List" size={17} color="#fff" /></div>
                  <div className="settings-menu-mid">
                    <div className="settings-menu-title">Datos</div>
                    <div className="settings-menu-sub">Catálogo, respaldo, borrar historial</div>
                  </div>
                  <Icon name="ChevronRight" size={16} color="var(--ink-soft)" />
                </button>
                <button className="settings-menu-row" onClick={() => window.open('https://github.com/21kumul/libro-diario/blob/main/MANUAL.md', '_blank')}>
                  <div className="settings-menu-icon" style={{ background: 'var(--income)' }}><Icon name="Share2" size={17} color="#fff" /></div>
                  <div className="settings-menu-mid">
                    <div className="settings-menu-title">Manual de usuario</div>
                    <div className="settings-menu-sub">Cómo funciona cada parte de la app · se abre en GitHub</div>
                  </div>
                  <Icon name="ChevronRight" size={16} color="var(--ink-soft)" />
                </button>
              </>
            )}

            {settingsSection === 'familia' && (
              <>
                <button className="settings-back-row" onClick={() => setSettingsSection(null)}><Icon name="ChevronLeft" size={16} /> Familia</button>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {codeCopied && <span style={{ fontSize: 11, color: 'var(--income)', fontWeight: 600 }}>¡Copiado!</span>}
                    <button className="icon-btn" style={{ background: codeCopied ? 'var(--income)' : 'var(--paper)', color: codeCopied ? 'var(--on-accent)' : 'var(--ink)', border: '1px solid var(--line)' }} title="Copiar código" onClick={() => copyFamilyCode()}><Icon name={codeCopied ? 'Check' : 'Copy'} size={14} /></button>
                    <button className="icon-btn" style={{ background: '#25D366' }} title="Compartir por WhatsApp" onClick={shareInvite}><Icon name="Share2" size={14} /></button>
                  </div>
                </div>
                {familia.map((m) => (
                  <div className="family-row" key={m}>
                    {avatarNode(m, 26)}
                    <span className="family-row-name">{m}</span>
                    {profile?.name === m && <span className="you-badge">Tú</span>}
                  </div>
                ))}
                <div className="participant-row" style={{ marginTop: 10 }}>
                  <input className="text-input" placeholder="Nombre de un integrante" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
                  <button className="add-participant-btn" style={{ width: 'auto', marginTop: 0 }} onClick={() => addFamilyMember(newMemberName, false)}><Icon name="UserPlus" size={14} /></button>
                </div>
                {memberError && <div className="form-error">{memberError}</div>}
              </>
            )}

            {settingsSection === 'perfil' && (
              <>
                <button className="settings-back-row" onClick={() => setSettingsSection(null)}><Icon name="ChevronLeft" size={16} /> Mi perfil</button>
                <input
                  type="file" accept="image/*" ref={photoInputRef} style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f && profile) uploadProfilePhoto(profile.name, f); }}
                />
                {profile && (
                  <div className="family-row" style={{ marginBottom: 4 }}>
                    <button
                      className="avatar-upload-btn"
                      title="Cambiar foto de perfil"
                      disabled={photoUploading}
                      onClick={() => photoInputRef.current && photoInputRef.current.click()}
                    >
                      {avatarNode(profile.name, 34)}
                      <span className="avatar-upload-badge"><Icon name={photoUploading ? 'RefreshCw' : 'Pencil'} size={9} /></span>
                    </button>
                    {nicknameEdit ? (
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
                        <span className="family-row-name">{profile.name}</span>
                        {profilePhotos[profile.name] && (
                          <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} title="Quitar foto de perfil" onClick={() => removeProfilePhoto(profile.name)}>
                            <Icon name="Trash2" size={13} />
                          </button>
                        )}
                        <button
                          className="icon-btn"
                          style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }}
                          title="Editar apodo"
                          onClick={() => { setNicknameInput(profile.name); setNicknameError(''); setNicknameEdit(true); }}
                        >
                          <Icon name="Pencil" size={13} />
                        </button>
                      </>
                    )}
                  </div>
                )}
                {nicknameError && <div className="form-error">{nicknameError}</div>}

                <div className="card-title" style={{ marginTop: 18 }}>PIN de acceso</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>
                  {personPins[profile?.name] ? 'Ya tienes un PIN. Se pedirá cada vez que alguien intente entrar como tú.' : 'Opcional. Evita que alguien más entre como tú por accidente o de broma.'}
                </div>
                <button className="danger-btn neutral" onClick={openPinSetup}>
                  <Icon name="Lock" size={14} /> {personPins[profile?.name] ? 'Cambiar PIN' : 'Crear PIN'}
                </button>
                {personPins[profile?.name] && (
                  <button className="danger-btn neutral" onClick={removePin}>
                    <Icon name="X" size={14} /> Quitar PIN
                  </button>
                )}

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

                <button className="danger-btn neutral" style={{ marginTop: 16 }} onClick={() => { setSettingsOpen(false); setOnboarding(true); }}>
                  <Icon name="LogOut" size={14} /> Cambiar de persona
                </button>
                <button className="danger-btn" onClick={leaveFamily}>
                  <Icon name="LogOut" size={14} /> Salir de la familia
                </button>
              </>
            )}

            {settingsSection === 'aspecto' && (
              <>
                <button className="settings-back-row" onClick={() => setSettingsSection(null)}><Icon name="ChevronLeft" size={16} /> Aspecto</button>
                <div className="appearance-row">
                  {[
                    { key: 'light', label: 'Claro' },
                    { key: 'dark', label: 'Oscuro' },
                    { key: 'system', label: 'Sistema' },
                  ].map((opt) => (
                    <button key={opt.key} className={`appearance-opt ${appearance === opt.key ? 'active' : ''}`} onClick={() => chooseAppearance(opt.key)}>
                      <span className={`appearance-preview ${opt.key}`}>
                        <span className="appearance-lines">
                          <span className="appearance-line" style={{ width: '85%' }} />
                          <span className="appearance-line" style={{ width: '60%' }} />
                        </span>
                        <span className="appearance-dot" />
                      </span>
                      <span className="appearance-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {settingsSection === 'calendario' && (() => {
              const [y, m] = calMonth.split('-').map(Number);
              const first = new Date(y, m - 1, 1);
              const startDow = first.getDay();
              const daysInMonth = new Date(y, m, 0).getDate();
              const monthEvents = eventsForCalMonth(calMonth);
              const eventsByDate = {};
              monthEvents.forEach((ev) => { (eventsByDate[ev.date] = eventsByDate[ev.date] || []).push(ev); });
              const cells = [];
              for (let i = 0; i < startDow; i++) cells.push(null);
              for (let d = 1; d <= daysInMonth; d++) cells.push(`${calMonth}-${String(d).padStart(2, '0')}`);
              const selectedEvents = calSelectedDate ? (eventsByDate[calSelectedDate] || []) : [];
              const monthLabel = first.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
              return (
                <>
                  <button className="settings-back-row" onClick={() => setSettingsSection(null)}><Icon name="ChevronLeft" size={16} /> Calendario</button>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 14px' }}>
                    Días en que caen tus gastos e ingresos fijos (mensuales, semanales o quincenales), pagados o pendientes.
                  </div>

                  {gcalConfigured && !gcalCardHidden && (
                    <div className="gcal-card">
                      <div className="gcal-card-row">
                        <div className="gcal-card-icon" style={{ background: gcalToken ? 'var(--income)' : 'rgba(130,130,130,0.18)', color: gcalToken ? '#fff' : 'var(--ink-soft)' }}>
                          <Icon name="CalendarCheck" size={16} color={gcalToken ? '#fff' : undefined} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{gcalToken ? 'Conectado a Google Calendar' : 'Google Calendar no está conectado'}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{gcalToken ? 'Puedes sincronizar tus pagos e ingresos con un toque.' : 'Vincula tu cuenta para crear los eventos directo, sin descargar nada.'}</div>
                        </div>
                        {gcalToken ? (
                          <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setGcalCardHidden(true)} title="Ocultar esta tarjeta (sigue conectado)"><Icon name="ChevronUp" size={15} /></button>
                        ) : (
                          <button className="save-btn" style={{ width: 'auto', padding: '10px 14px', margin: 0 }} onClick={connectGoogleCalendar}>Conectar</button>
                        )}
                      </div>
                      {gcalToken && (
                        <>
                          <button className="danger-btn neutral" style={{ marginTop: 10 }} disabled={gcalBusy || monthEvents.length === 0} onClick={() => syncMonthToGoogle(calMonth)}>
                            <Icon name={gcalBusy ? 'RefreshCw' : 'CalendarCheck'} size={14} /> {gcalBusy ? 'Sincronizando…' : `Sincronizar ${monthLabel} con Google Calendar`}
                          </button>
                          <div className="gcal-card-links">
                            <button onClick={() => askConfirm('¿Borrar el historial de sincronización? Los eventos ya creados en tu Google Calendar NO se borran allá, pero la app dejará de marcarlos como "En Google" y podrás volver a mandarlos si quieres.', () => { setGcalSyncedIds({}); try { localStorage.removeItem('libroDiario:gcalSynced'); } catch (e) {} }, { confirmLabel: 'Borrar historial', danger: false })}>Borrar historial de sincronización</button>
                            <button onClick={() => askConfirm('¿Desconectar tu cuenta de Google? Vas a tener que volver a dar permiso la próxima vez que quieras sincronizar.', disconnectGoogleCalendar, { confirmLabel: 'Desconectar' })}>Desconectar cuenta</button>
                          </div>
                        </>
                      )}
                      {gcalMsg && <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 8 }}>{gcalMsg}</div>}
                    </div>
                  )}
                  {gcalConfigured && gcalCardHidden && (
                    <button className="gcal-collapsed-row" onClick={() => setGcalCardHidden(false)}>
                      <Icon name="CalendarCheck" size={14} color={gcalToken ? 'var(--income)' : 'var(--ink-soft)'} />
                      <span>{gcalToken ? 'Conectado a Google Calendar' : 'Google Calendar'}</span>
                      <Icon name="ChevronDown" size={14} />
                    </button>
                  )}
                  {!gcalConfigured && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', background: 'var(--paper-dim)', borderRadius: 12, padding: 12, marginBottom: 4 }}>
                      La sincronización directa con Google Calendar todavía no está configurada (falta el Client ID en <code>google-calendar-config.js</code>, ver <code>GOOGLE-CALENDAR.md</code>). Mientras tanto puedes usar los links "Agregar a Google Calendar" de cada día o descargar el mes en .ics.
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 10px' }}>
                    <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => { setCalMonth(nextPeriodKey(calMonth, -1)); setCalSelectedDate(null); }}><Icon name="ChevronLeft" size={15} /></button>
                    <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>{monthLabel}</div>
                    <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => { setCalMonth(nextPeriodKey(calMonth)); setCalSelectedDate(null); }}><Icon name="ChevronRight" size={15} /></button>
                  </div>
                  <div className="cal-grid cal-grid-heading">
                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
                  </div>
                  <div className="cal-grid">
                    {cells.map((date, i) => {
                      if (!date) return <div key={`e${i}`} className="cal-cell empty" />;
                      const evs = eventsByDate[date] || [];
                      const dayNum = Number(date.slice(-2));
                      const isToday = date === todayStr();
                      const hasIngresoPend = evs.some((e) => e.compromiso.kind === 'ingreso_fijo' && !e.pagado);
                      const hasGastoPend = evs.some((e) => e.compromiso.kind === 'fijo' && !e.pagado);
                      const hasIngresoPag = evs.some((e) => e.compromiso.kind === 'ingreso_fijo' && e.pagado);
                      const hasGastoPag = evs.some((e) => e.compromiso.kind === 'fijo' && e.pagado);
                      return (
                        <button key={date} className={`cal-cell ${isToday ? 'today' : ''} ${calSelectedDate === date ? 'selected' : ''}`} onClick={() => evs.length > 0 && setCalSelectedDate(date === calSelectedDate ? null : date)}>
                          <span className="cal-daynum">{dayNum}</span>
                          {evs.length > 0 && (
                            <span className="cal-dots">
                              {hasGastoPend && <span className="cal-dot gasto" />}
                              {hasIngresoPend && <span className="cal-dot ingreso" />}
                              {hasGastoPag && <span className="cal-dot gasto paid" />}
                              {hasIngresoPag && <span className="cal-dot ingreso paid" />}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="cal-legend">
                    <span><span className="cal-dot gasto" /> Gasto pendiente</span>
                    <span><span className="cal-dot ingreso" /> Ingreso pendiente</span>
                    <span><span className="cal-dot gasto paid" /> Ya pagado/cobrado</span>
                  </div>
                  {monthEvents.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 14 }}>No hay gastos o ingresos fijos con fecha programada este mes.</div>
                  ) : (
                    <button className="danger-btn neutral" style={{ marginTop: 14 }} onClick={() => downloadCalMonthIcs(calMonth)}>
                      <Icon name="CalendarCheck" size={14} /> Descargar mes completo (.ics)
                    </button>
                  )}
                  {calSelectedDate && (
                    <div style={{ marginTop: 14 }}>
                      <div className="field-label" style={{ margin: '0 0 8px' }}>{new Date(calSelectedDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                      {selectedEvents.map((ev) => {
                        const isIngreso = ev.compromiso.kind === 'ingreso_fijo';
                        const title = `${isIngreso ? 'Ingreso' : 'Pago'} · ${ev.compromiso.name}`;
                        const key = `${ev.compromiso.id}:${ev.date}`;
                        const synced = !!gcalSyncedIds[key];
                        const busy = gcalEventBusy === key;
                        return (
                          <div key={key} className="lote-row" style={{ cursor: 'default' }}>
                            <div className="lote-row-body">
                              <div className="lote-row-name">{ev.compromiso.name}</div>
                              <div className="lote-row-sub" style={{ color: isIngreso ? 'var(--income)' : 'var(--expense)' }}>
                                {isIngreso ? 'Ingreso fijo' : 'Gasto fijo'} · {fmt(ev.compromiso.amount)} · {ev.pagado ? (isIngreso ? 'Ya cobrado' : 'Ya pagado') : 'Pendiente'}
                              </div>
                            </div>
                            {gcalConfigured && gcalToken ? (
                              synced ? (
                                <span className="gcal-synced-tag"><Icon name="CheckCircle2" size={13} /> En Google</span>
                              ) : (
                                <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} disabled={busy} onClick={() => syncOneToGoogle(ev)} title="Agregar a Google Calendar">
                                  <Icon name={busy ? 'RefreshCw' : 'CalendarCheck'} size={15} />
                                </button>
                              )
                            ) : (
                              <a className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} href={gcalUrl(title, ev.date, 'Registrado en Libro·Diario')} target="_blank" rel="noopener noreferrer" title="Agregar a Google Calendar">
                                <Icon name="CalendarCheck" size={15} />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}

            {settingsSection === 'datos' && (
              <>
                <button className="settings-back-row" onClick={() => setSettingsSection(null)}><Icon name="ChevronLeft" size={16} /> Datos</button>
                <button className="danger-btn neutral" onClick={() => { setSettingsOpen(false); setSheet({ type: 'catalogo-cuentas' }); }}>
                  <Icon name="List" size={14} /> Catálogo de cuentas contables
                </button>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '4px 2px 0' }}>Aquí también puedes crear categorías nuevas y editar las que ya tienes (descripción y servicios como Netflix, Spotify, etc.).</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 14 }}>
                  {transactions.length} movimiento{transactions.length !== 1 ? 's' : ''} · {compromisos.length} compromiso{compromisos.length !== 1 ? 's' : ''} · {savings.length} cuenta{savings.length !== 1 ? 's' : ''} de ahorro. Visibles para toda la familia.
                  {saving && <span className="saving-dot"> · guardando…</span>}
                </div>
                {lastSync && (
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="RefreshCw" size={11} /> Sincronizado {new Date(lastSync).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    <button onClick={loadShared} style={{ background: 'none', border: 'none', color: 'var(--income)', fontWeight: 600, cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}>actualizar</button>
                  </div>
                )}
                <button className="danger-btn neutral" style={{ marginTop: 12 }} onClick={exportBackup}>
                  <Icon name="List" size={14} /> Exportar respaldo (.json)
                </button>
                <input
                  type="file"
                  accept="application/json"
                  ref={backupInputRef}
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ''; }}
                />
                <button className="danger-btn neutral" disabled={backupBusy} onClick={() => backupInputRef.current?.click()}>
                  <Icon name="RefreshCw" size={14} /> {backupBusy ? 'Restaurando…' : 'Importar respaldo'}
                </button>
                {backupMsg && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{backupMsg}</div>}
                <button className="danger-btn" onClick={() => askConfirm('¿Borrar todo el historial (movimientos, compromisos y ahorros)?', () => withUndo('Historial borrado', clearAll), { confirmLabel: 'Borrar todo' })}>
                  <Icon name="Trash2" size={14} /> Borrar todo el historial
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {sheet?.type === 'catalogo-cuentas' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={sheetDragStyle}>
            <div className="sheet-handle" onTouchStart={handleSheetTouchStart} onTouchMove={handleSheetTouchMove} onTouchEnd={handleSheetTouchEnd} />
            <div className="sheet-header"><span className="sheet-title">Catálogo de cuentas contables</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setSheet(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '-4px 0 14px' }}>
              Toca una categoría de ingreso o gasto para agregarle una descripción o "servicios" (ej. Netflix, Spotify dentro de Servicios). También puedes crear categorías nuevas abajo.
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="er-group-title" style={{ color: 'var(--ink-soft)' }}>1000/2000 Activo · Pasivo</div>
              {CATALOGO_ACTIVO_PASIVO.map((c) => (
                <div className="er-row" key={c.codigo + c.nombre} style={{ alignItems: 'flex-start' }}>
                  <span className="er-cuenta">
                    <span className="er-codigo">{c.codigo}</span> {c.nombre}
                    {c.nota && <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 1 }}>{c.nota}</div>}
                  </span>
                </div>
              ))}
            </div>

            {[
              { title: '4000 Cuentas de ingreso', cats: allIngresoCats },
              { title: '5000/6000 Costos y gastos', cats: allGastoCats },
            ].map(({ title, cats }) => (
              <div key={title} style={{ marginBottom: 16 }}>
                <div className="er-group-title" style={{ color: 'var(--ink-soft)' }}>{title}</div>
                {cats.map((c) => {
                  const cuenta = cuentaOfAny(c.id);
                  const meta = metaFor(c.id);
                  const expanded = catalogExpandedId === c.id;
                  const custom = isCustomCat(c.id);
                  return (
                    <div key={c.id} style={{ borderBottom: '1px dashed var(--line)' }}>
                      <div
                        className="er-row"
                        style={{ alignItems: 'center', cursor: 'pointer', borderBottom: 'none' }}
                        onClick={() => {
                          if (expanded) { setCatalogExpandedId(null); return; }
                          setCatalogExpandedId(c.id);
                          setCatLabelDraft(c.label);
                          setSubItemDraft('');
                        }}
                      >
                        <div className="cat-choice-icon" style={{ background: c.color, width: 28, height: 28, flexShrink: 0 }}><Icon name={c.icon} size={14} /></div>
                        <span className="er-cuenta" style={{ flex: 1 }}>
                          <span className="er-codigo">{cuenta.codigo}</span> {c.label}
                          {meta.subItems && meta.subItems.length > 0 && <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 1 }}>{meta.subItems.join(' · ')}</div>}
                        </span>
                        <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={15} color="var(--ink-soft)" />
                      </div>
                      {expanded && (
                        <div style={{ padding: '2px 2px 14px' }}>
                          {custom && (
                            <>
                              <div className="field-label" style={{ margin: '6px 0 6px' }}>Nombre</div>
                              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                                <input className="text-input" value={catLabelDraft} onChange={(e) => setCatLabelDraft(e.target.value)} />
                                <button className="icon-btn" style={{ background: 'var(--green)', flexShrink: 0 }} onClick={() => updateCustomCategoryLabel(c.id, catLabelDraft.trim() || c.label)}><Icon name="Check" size={14} /></button>
                              </div>
                            </>
                          )}
                          <div className="field-label" style={{ margin: '6px 0 6px' }}>Descripción (opcional)</div>
                          <input
                            className="text-input"
                            style={{ marginBottom: 10 }}
                            placeholder="Ej. Todo lo relacionado a consultas, medicinas y seguros"
                            defaultValue={meta.description}
                            onBlur={(e) => updateCategoryDescription(c.id, e.target.value)}
                          />
                          <div className="field-label" style={{ margin: '6px 0 6px' }}>Servicios / conceptos dentro de esta categoría</div>
                          {(meta.subItems || []).length > 0 && (
                            <div className="subcat-row">
                              {meta.subItems.map((s) => (
                                <button key={s} type="button" className="subcat-chip selected" onClick={() => removeCategorySubItem(c.id, s)}>{s} <Icon name="X" size={11} /></button>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6, marginBottom: custom ? 12 : 4 }}>
                            <input
                              className="text-input"
                              placeholder="Ej. Netflix, Spotify…"
                              value={subItemDraft}
                              onChange={(e) => setSubItemDraft(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { addCategorySubItem(c.id, subItemDraft); setSubItemDraft(''); } }}
                            />
                            <button className="icon-btn" style={{ background: 'var(--green)', flexShrink: 0 }} onClick={() => { addCategorySubItem(c.id, subItemDraft); setSubItemDraft(''); }}><Icon name="Plus" size={14} /></button>
                          </div>
                          {custom && (
                            <button
                              className="danger-btn"
                              style={{ marginTop: 0 }}
                              onClick={() => askConfirm(`¿Eliminar la categoría "${c.label}"? Los movimientos ya guardados con esta categoría no se borran.`, () => { setCatalogExpandedId(null); removeCustomCategory(c.id); })}
                            >
                              <Icon name="Trash2" size={13} /> Eliminar categoría
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="card" style={{ marginTop: 4 }}>
              <div className="card-title">Nueva categoría</div>
              <div className="type-toggle" style={{ marginBottom: 12 }}>
                <button className={newCatDraft.type === 'gasto' ? 'active gasto' : ''} onClick={() => setNewCatDraft((f) => ({ ...f, type: 'gasto' }))}><Icon name="ArrowDownRight" size={13} /> Gasto</button>
                <button className={newCatDraft.type === 'ingreso' ? 'active ingreso' : ''} onClick={() => setNewCatDraft((f) => ({ ...f, type: 'ingreso' }))}><Icon name="ArrowUpRight" size={13} /> Ingreso</button>
              </div>
              <div className="field-label" style={{ marginTop: 0 }}>Nombre *</div>
              <input className="text-input" placeholder="Ej. Salud, Mascotas…" value={newCatDraft.label} onChange={(e) => setNewCatDraft((f) => ({ ...f, label: e.target.value }))} />
              <div className="field-label">Ícono</div>
              <div className="cat-icon-picker">
                {CAT_ICON_CHOICES.map((ic) => (
                  <button key={ic} type="button" className={`cat-icon-choice ${newCatDraft.icon === ic ? 'selected' : ''}`} style={{ background: newCatDraft.icon === ic ? newCatDraft.color : undefined }} onClick={() => setNewCatDraft((f) => ({ ...f, icon: ic }))}>
                    <Icon name={ic} size={15} color={newCatDraft.icon === ic ? '#fff' : 'var(--ink-soft)'} />
                  </button>
                ))}
              </div>
              <div className="field-label">Color</div>
              <div className="cat-color-picker">
                {CAT_COLOR_CHOICES.map((col) => (
                  <button key={col} type="button" className={`cat-color-choice ${newCatDraft.color === col ? 'selected' : ''}`} style={{ background: col }} onClick={() => setNewCatDraft((f) => ({ ...f, color: col }))} />
                ))}
              </div>
              {newCatError && <div className="form-error">{newCatError}</div>}
              <button className="save-btn" style={{ marginTop: 12 }} onClick={submitNewCategory}><Icon name="PlusCircle" size={16} /> Agregar categoría</button>
            </div>
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
                <div className="code-display">
                  <div className="code-display-value">{codeInput}</div>
                </div>
                <button
                  className="save-btn"
                  style={{ background: codeCopied ? 'var(--income)' : 'var(--paper-dim)', color: codeCopied ? 'var(--on-accent)' : 'var(--ink)', border: '1px solid var(--line)' }}
                  onClick={() => copyFamilyCode(codeInput)}
                ><Icon name={codeCopied ? 'Check' : 'Copy'} size={16} /> {codeCopied ? '¡Código copiado!' : 'Copiar código'}</button>
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
      {onboarding && familyCode && pinPrompt && (
        <div className="sheet-backdrop" onClick={() => setPinPrompt(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header"><span className="sheet-title">PIN de {pinPrompt.name}</span><button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setPinPrompt(null)}><Icon name="X" size={16} /></button></div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>{pinPrompt.name} le puso un PIN a su cuenta. Pídeselo si no eres tú.</div>
            <input
              className="text-input pin-input"
              type="password" inputMode="numeric" maxLength={4} autoFocus
              value={pinPrompt.input}
              onChange={(e) => setPinPrompt((p) => ({ ...p, input: e.target.value.replace(/\D/g, '').slice(0, 4), error: '' }))}
              onKeyDown={(e) => { if (e.key === 'Enter' && pinPrompt.input.length === 4) submitPinPrompt(); }}
            />
            {pinPrompt.error && <div className="form-error">{pinPrompt.error}</div>}
            <button className="save-btn" disabled={pinPrompt.input.length !== 4} onClick={submitPinPrompt}><Icon name="Check" size={16} /> Entrar</button>
          </div>
        </div>
      )}
      {onboarding && familyCode && !pinPrompt && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <div className="sheet-header"><span className="sheet-title">¿Quién eres tú?</span>{profile && <button className="icon-btn" style={{ background: 'var(--paper-dim)', color: 'var(--ink)' }} onClick={() => setOnboarding(false)}><Icon name="X" size={16} /></button>}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>Este libro es compartido: todo lo que registres lo verá el resto de la familia, y viceversa.</div>
            {familia.length > 0 && (
              <>
                <div className="field-label">Elige tu nombre</div>
                {familia.map((m) => (
                  <div key={m} className="cat-choice" style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 10, padding: '10px 12px', marginBottom: 8, width: '100%', boxSizing: 'border-box' }} onClick={() => requestChooseProfile(m)}>
                    <div className="mini-avatar" style={{ background: colorForName(m) }}>{m.charAt(0).toUpperCase()}</div>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m}</span>
                    {personPins[m] && <Icon name="Lock" size={13} color="var(--ink-soft)" style={{ marginLeft: 'auto' }} />}
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

// Red de seguridad: como esta app compila el JSX en el propio navegador (sin
// paso de build), cualquier error de ejecución no atrapado deja la pantalla
// completamente en blanco y sin ningún aviso. Este componente atrapa esos
// errores dentro del árbol de React y muestra una pantalla de recuperación
// en vez de dejar la app "congelada" en blanco.
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('Libro·Diario: error de renderizado', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#EFEFF2', color: '#2A2A28' }}>
          <div style={{ fontSize: 34 }}>😕</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Algo salió mal</div>
          <div style={{ fontSize: 13, color: '#6B6A62', maxWidth: 280, lineHeight: 1.5 }}>
            Libro·Diario tuvo un error inesperado. Tus datos están a salvo (viven en tu dispositivo y en la nube); solo hace falta recargar.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 6, padding: '11px 26px', borderRadius: 999, border: 'none', background: '#1E3D32', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Recargar
          </button>
          {this.state.error && (
            <div style={{ fontSize: 10.5, color: '#9A9990', marginTop: 10, maxWidth: 300, wordBreak: 'break-word' }}>
              {String(this.state.error?.message || this.state.error)}
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <LibroDiario />
  </AppErrorBoundary>
);
