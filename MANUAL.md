# 📖 Libro·Diario — Manual de usuario

Guía de referencia de cómo funciona cada parte de la app. Está pensada para consultarse cuando se te olvide "¿y esto cómo era?" — no hace falta leerla completa de un jalón.

> Libro·Diario es una PWA de finanzas familiares compartida. Todos los que tienen el mismo código de familia ven y editan la misma información en tiempo real.

---

## Índice

1. [Estructura general](#1-estructura-general)
2. [Pestaña Resumen](#2-pestaña-resumen)
3. [Pestaña Movimientos](#3-pestaña-movimientos)
4. [Registrar un movimiento nuevo](#4-registrar-un-movimiento-nuevo)
5. [Gastos compartidos y "Por cobrar"](#5-gastos-compartidos-y-por-cobrar)
6. [Pestaña Cuentas (Compromisos)](#6-pestaña-cuentas-compromisos)
7. [Pestaña Tarjetas (billeteras)](#7-pestaña-tarjetas-billeteras)
8. [Pestaña Ahorro](#8-pestaña-ahorro)
9. [Categorías y catálogo de cuentas contables](#9-categorías-y-catálogo-de-cuentas-contables)
10. [Estado de Resultado](#10-estado-de-resultado)
11. [Ajustes](#11-ajustes)
12. [Glosario rápido](#12-glosario-rápido)
13. [Preguntas frecuentes](#13-preguntas-frecuentes)

---

## 1. Estructura general

En la parte superior (el "header" verde oscuro) siempre ves:

- **Nombre de la familia** y tu perfil activo (círculo con tu inicial o foto, arriba a la derecha).
- **Disponible · [periodo]**: el efectivo + saldo de débito que realmente tienes libre, sumando todas las cuentas de todas las personas, para el periodo elegido.
- **Filtro de periodo**: `Hoy` · `Semana` · `Mes` · `Todo`. Cambia lo que se cuenta como "disponible" y lo que aparece en Movimientos/Resumen/Estado de Resultado. **No afecta** la lista de "Por cobrar" (ver sección 5) ni los compromisos — esos siempre se ven completos sin importar el filtro.
- **Selector de persona** (`Toda la familia` / `Papá Abraham` / `Jessica`, etc.): filtra lo que ves a los movimientos de una sola persona.

Botón **+** flotante (abajo, en la barra central de cristal): abre el formulario correcto según en qué pestaña estés — nuevo movimiento en Movimientos, nuevo compromiso en Cuentas, nueva meta en Ahorro, nueva tarjeta/monedero en Tarjetas.

La barra inferior tiene 5 pestañas: **Resumen · Movimientos · Cuentas · Ahorro · (+)**.

---

## 2. Pestaña Resumen

Vista rápida de "cómo estamos" del periodo elegido:

- **Disponible real (efectivo y débito)** y, si aplica, **Debes en tarjetas de crédito**.
- **Cuentas por pagar (CxP)**: total de préstamos/deudas pendientes, con acceso directo a Cuentas.
- **Por cobrar (gastos compartidos)**: quién te debe dinero de algo que ya pagaste tú (ver sección 5).
- **Presupuestos del mes**: barra de avance por categoría (gasto contra lo presupuestado). Si una categoría está ligada a una meta de ahorro, la barra muestra cuánto llevas apartado en vez de gastado.
- **Principales gastos** del periodo (top 3 categorías).
- **Últimos movimientos** del periodo y **gráfica de los últimos 6 meses**.

---

## 3. Pestaña Movimientos

Lista cronológica de todo lo que entra y sale, agrupado por día. Cada renglón muestra: ícono de categoría, nombre de categoría (+ servicio específico si aplica, ej. "Servicios · Netflix"), nota, quién lo capturó, y el monto (verde = ingreso, rojo = gasto).

- Toca cualquier movimiento para **editarlo** (o borrarlo).
- Arriba hay filtros por categoría, por quién lo capturó, buscador de texto y selector de mes específico.
- Abajo de la lista, si hay algo pendiente, aparece la tarjeta **"Por cobrar (gastos compartidos)"**.

### Escanear ticket de compra
Desde "Nuevo movimiento" puedes tocar **"Escanear ticket de compra"**: toma foto del ticket y la app intenta llenar monto y nota automáticamente. Siempre revisa que lo haya leído bien antes de guardar.

---

## 4. Registrar un movimiento nuevo

Al tocar **+** en Movimientos se abre "Nuevo movimiento":

1. **Ingreso / Gasto** — el interruptor de arriba.
2. **Monto**.
3. **Categoría** y **¿Quién paga? / ¿Dónde cae?** — dos menús desplegables compactos, en la misma fila. Cada uno muestra su ícono (categoría con su color, persona con su avatar).
4. **Cuenta / monedero** — aparece después de elegir a la persona, mostrando solo las cuentas que le pertenecen a ella (ícono de tarjeta o monedero según el tipo).
5. **Servicio específico** (opcional) — si la categoría tiene "servicios" configurados (ej. Netflix, Spotify dentro de "Servicios"), aparecen como chips para elegir uno.
6. **Nota**, **Fecha**.
7. **¿Es un gasto compartido?** — ver sección 5.
8. **Guardar movimiento**.

> **Nota:** los gastos e ingresos **fijos/recurrentes** (rentas, sueldos, suscripciones que se repiten cada mes) ya **no** se dan de alta desde aquí — se crean desde la pestaña **Cuentas** como un "Compromiso". Este formulario es solo para movimientos puntuales.

### Gestionar categorías
Junto al selector de Categoría hay un enlace **"⚙️ Gestionar categorías"** que te manda directo al catálogo de cuentas contables (sección 9) para crear una categoría nueva o editar una existente sin salir del flujo.

---

## 5. Gastos compartidos y "Por cobrar"

### ¿Cómo funciona?
El flujo normal es: **tú pagas completo algo (ej. Netflix) → activas "¿Es un gasto compartido?" → repartes cuánto le toca a cada quien → cuando te lo regresan, lo marcas como recibido.**

- Al activar el interruptor, agregas personas y el monto que le toca a cada una. Tu propia parte (si te toca pagar algo tú también) se calcula sola como "Tu parte".
- Mientras alguien no haya pagado, su parte aparece en la tarjeta **"Por cobrar (gastos compartidos)"** (en Resumen y en Movimientos) — sin importar de qué mes sea, esta lista **no se filtra por Hoy/Semana/Mes/Todo**, siempre muestra todo lo pendiente.
- Cuando te paga, tienes tres formas de marcarlo:
  1. **Botón "Pagó"** directo en la tarjeta resumen — usa el monto exacto que se le debía.
  2. Entrar al **detalle de la persona** ("toca para ver el detalle") y marcar renglón por renglón, o usar **"Marcar todo pagado"**, donde puedes indicar **"¿Cuánto te dio realmente?"** — si te dio de más, el sobrante se registra aparte como ingreso extra (no se mezcla con la cobranza).
  3. Editando el movimiento original y tocando el estado ("Recibido ✓" / "Pendiente ○") de cada persona directamente.

### ¿Es un "ingreso real" cuando te pagan?
No es ganancia — es que recuperas tu propio dinero. La app lo registra como ingreso (categoría **Cobranza**) a propósito, porque:
- Tu **saldo disponible** debe subir cuando físicamente recuperas el efectivo.
- En el **Estado de Resultado**, con el tiempo se cancela solo: gasto −$31 (cuando pagaste) + ingreso +$31 (cuando te regresan) = neto $0. Si el pago y el cobro caen en meses distintos, ese mes en particular se puede ver "desbalanceado" — es normal, no es un error, se corrige solo en el balance acumulado.

### ¿Qué significa "gasto compartido de $6.2"?
Es la parte individual que le toca pagar a esa persona. Si pagaste $31 de Netflix y lo repartiste entre 5 personas, cada una debe $6.2.

### Si algo pendiente "desapareció" sin que te hayan pagado
Revisa que no se haya marcado "Recibido" sin querer (al editar el movimiento, o con el botón rápido "Pagó"). No hay una papelera separada para esto: simplemente entra al movimiento y regresa el estado de esa persona a "Pendiente" — vuelve a aparecer en "Por cobrar" automáticamente.

---

## 6. Pestaña Cuentas (Compromisos)

Aquí viven los movimientos **recurrentes o de saldo** — todo lo que no es un gasto/ingreso puntual:

| Tipo | Qué es | Ejemplo |
|---|---|---|
| **Gasto fijo** | Se repite cada mes/semana/quincena | Renta, Internet, Netflix |
| **Ingreso fijo** | Entrada recurrente | Sueldo, nómina |
| **Deuda (CxP)** | Debes un monto total, se va abonando | Préstamo, tarjeta de crédito a MSI |
| **Cuenta por cobrar (CxC)** | Te deben un monto total, se va cobrando | Préstamo que hiciste a alguien |

- Botón **+** en esta pestaña → **"Nuevo compromiso"**: eliges el tipo, nombre, categoría, monto, frecuencia y (si aplica) si es compartido.
- Cada tarjeta muestra el saldo pendiente y un botón **Abonar / Pagar / Registrar cobro** según el tipo — ahí indicas cuánto y desde/hacia qué cuenta.
- Los compromisos con la etiqueta **COMPARTIDO** funcionan igual que los gastos compartidos de la sección 5, pero acumulan su historial de pagos dentro de la misma tarjeta (toca la tarjeta para ver "Historial de pagos" y el detalle por persona).
- **Pago en lote**: paga varios gastos fijos pendientes a la vez desde una sola cuenta.
- **MSI (meses sin intereses)**: se manejan como una deuda con un número de mensualidades fijo.

---

## 7. Pestaña Tarjetas (billeteras)

Es el **"¿dónde está el dinero?"** — cada persona tiene su propia billetera visual con sus tarjetas y monedero, y debajo aparecen chips con el nombre y monto de cada uno (sin necesidad de tocar la bolsa para verlos).

- Toca la billetera de alguien para abrirla y ver/editar cada tarjeta o monedero.
- Botón **+** → agrega una tarjeta (débito/crédito) o monedero de efectivo nuevo, y a quién pertenece.
- Arriba de todo aparece el total **"Disponible real (efectivo y débito)"** y, si hay deuda de tarjetas de crédito, **"Debes en tarjetas de crédito"**.
- Cada ubicación de dinero (`moneyLocation`) es la que eliges como origen/destino al capturar un movimiento — por eso conviene tenerlas creadas antes de empezar a registrar gastos.

---

## 8. Pestaña Ahorro

Metas y cuentas de ahorro/inversión, separadas del flujo normal de ingreso/gasto (mover dinero a ahorro no cuenta como gasto, ni sacarlo cuenta como ingreso — es un traspaso entre tus propias cuentas).

- Botón **+** → nueva meta: nombre, monto objetivo, cuenta de origen, y opcionalmente una categoría de presupuesto ligada (así la barra de esa categoría en Resumen muestra el avance del ahorro en vez del gasto).
- Cada meta tiene botón para depositar/retirar, con su propio historial de movimientos.

---

## 9. Categorías y catálogo de cuentas contables

Se accede desde **Ajustes → Datos → Catálogo de cuentas contables**, o desde el enlace "Gestionar categorías" al capturar un movimiento.

- Lista todas las categorías de ingreso y gasto (de fábrica + las tuyas), cada una con su código contable (ej. `5200` Servicios).
- Toca una categoría para expandirla y:
  - Agregarle una **descripción**.
  - Agregarle **servicios/conceptos específicos** (ej. dentro de "Servicios": Netflix, Spotify, Disney+...) — luego aparecen como chips seleccionables al capturar un gasto de esa categoría.
  - Si es una categoría que tú creaste, también puedes **renombrarla** o **eliminarla**.
- Al final del catálogo hay un formulario para **crear una categoría nueva**: tipo (gasto/ingreso), nombre, ícono y color.
- Las categorías nuevas también aparecen automáticamente en Presupuestos y en la categoría opcional de metas de ahorro.

---

## 10. Estado de Resultado

Se ve dentro de la pestaña de gráficas (accesible desde Resumen), para el mes que elijas:

- **Ingresos** y **Costos y gastos**, agrupados por cuenta contable (mismo catálogo de la sección 9).
- **Utilidad neta** = Ingresos − Gastos, del mes.
- Los títulos **"Ingresos"** y **"Costos y gastos"** son tocables: te mandan directo a Movimientos, ya filtrado a ese tipo y ese mes, para ver el detalle línea por línea.
- Abajo hay una sección **"Balance (no afecta la utilidad)"** con lo relacionado a ahorro/deuda, que no cuenta como ingreso ni gasto real (es solo mover dinero entre tus propias cuentas).

---

## 11. Ajustes

Ícono de engrane, arriba a la derecha.

- **Familia**: código de familia compartido, miembros.
- **Mi perfil**: tu nombre, foto, color, PIN de 4 dígitos para cambiar de perfil.
- **Aspecto**: modo claro/oscuro y demás preferencias visuales.
- **Calendario**: integración con Google Calendar para recordatorios de pagos.
- **Datos**: exportar/respaldar información, y el **Catálogo de cuentas contables** (sección 9).

---

## 12. Glosario rápido

| Término | Significado |
|---|---|
| **Disponible** | Efectivo + saldo de débito libre, sin contar deuda de crédito ni lo apartado en ahorro |
| **Compromiso** | Un gasto/ingreso fijo, una deuda o una cuenta por cobrar dada de alta en la pestaña Cuentas |
| **CxP** | Cuenta por Pagar — dinero que tú debes |
| **CxC** | Cuenta por Cobrar — dinero que te deben |
| **Abonar** | Registrar un pago parcial o total hacia un compromiso |
| **Por cobrar** | Lo que alguien te debe de un gasto compartido, aún no recibido |
| **Cobranza** | Categoría de ingreso que se usa cuando te regresan un gasto compartido |
| **MSI** | Meses Sin Intereses — una compra a plazos, se maneja como una deuda |
| **Ubicación de dinero (moneyLocation)** | Una tarjeta o monedero específico de una persona, en la pestaña Tarjetas |
| **Servicio específico** | Sub-etiqueta dentro de una categoría (ej. Netflix dentro de Servicios) |

---

## 13. Preguntas frecuentes

**¿Por qué mi "Disponible" no incluye lo que me deben?**
Porque todavía no lo tienes en la mano. En cuanto lo marques como recibido en "Por cobrar", sí se suma.

**¿Por qué un gasto compartido pagado sube mi "ingreso" del mes?**
Porque técnicamente entró dinero a tu cuenta ese día. No es ganancia, es recuperación de tu propio gasto — ver sección 5.

**¿Dónde doy de alta algo que se repite cada mes (renta, Netflix, sueldo)?**
Pestaña **Cuentas** → botón **+** → Nuevo compromiso. No se hace desde "Nuevo movimiento".

**Marqué "Recibido" por error, ¿cómo lo deshago?**
Abre el movimiento (o el compromiso si es fijo) y toca el estado de esa persona para regresarlo a "Pendiente". No se borra ni duplica nada.

**Alguien me dio más dinero del que me debía, ¿qué hago?**
En el detalle de "Por cobrar" de esa persona, en el campo "¿Cuánto te dio realmente?" pon el monto real que te dio. La app separa automáticamente lo que era cobranza (recuperar tu dinero) de lo que fue de más (ingreso extra real).

---

*Última actualización: agosto 2026 — mantenlo junto al código en el repositorio para que se vaya actualizando con cada cambio.*
