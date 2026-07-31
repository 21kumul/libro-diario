# Vincular Libro·Diario con Google Calendar

Esto es opcional. Sin configurar nada, el calendario de **Ajustes › Calendario**
ya funciona: ves los días marcados y puedes tocar "Agregar a Google Calendar"
en cada evento (abre Google Calendar con el evento precargado) o descargar el
mes completo como archivo `.ics` para importarlo.

Si además quieres el botón **Conectar** (que crea los eventos directo en tu
cuenta de Google, sin salir de la app, y te dice cuáles ya están sincronizados),
sigue estos pasos. Se hacen una sola vez.

## 1. Crea un proyecto en Google Cloud

1. Entra a [console.cloud.google.com](https://console.cloud.google.com/) con
   tu cuenta de Google.
2. Arriba a la izquierda, crea un proyecto nuevo (o usa uno que ya tengas).
   El nombre no importa, por ejemplo "Libro Diario".

## 2. Activa la API de Calendar

1. En el buscador de arriba escribe **"Google Calendar API"** y ábrela.
2. Dale clic a **Habilitar**.

## 3. Crea el ID de cliente OAuth

1. Ve a **APIs y servicios › Pantalla de consentimiento de OAuth**.
   - Tipo de usuario: **Externo** (a menos que uses Google Workspace).
   - Llena nombre de la app, correo de soporte y correo de contacto (lo
     mínimo que pida). No hace falta publicarla: mientras la dejes en modo
     "Prueba" (Testing) y agregues tu correo (y el de tu familia) como
     "Usuarios de prueba", ya pueden usarla sin que Google la revise.
2. Ve a **APIs y servicios › Credenciales › Crear credenciales › ID de
   cliente de OAuth**.
   - Tipo de aplicación: **Aplicación web**.
   - Nombre: el que quieras, por ejemplo "Libro Diario web".
   - En **Orígenes de JavaScript autorizados**, agrega **solo el dominio**,
     sin ninguna ruta ni diagonal al final (Google rechaza el origen si le
     pones una ruta — el mensaje de error dice justo eso). Por ejemplo:
     - Si tu app vive en `https://21kumul.github.io/libro-diario/`, el
       origen que va aquí es `https://21kumul.github.io` (nada más — la
       parte `/libro-diario/` NO se pone).
     - Si usas un dominio propio, ej. `https://gastos.midominio.com/app/`,
       el origen es `https://gastos.midominio.com`.
     - Esto es porque Google valida de dónde viene la pestaña (protocolo +
       dominio), no la URL exacta; la ruta específica no importa para esto.
   - No hace falta llenar "URIs de redireccionamiento autorizados" (esta app
     no los usa).
3. Guarda. Google te muestra un **Client ID** que termina en
   `.apps.googleusercontent.com`. Cópialo.

## 4. Pégalo en la app

Abre `google-calendar-config.js` en tu editor de GitHub y pega el Client ID:

```js
var googleCalendarConfig = {
  clientId: "123456789012-abcabcabcabcabcabcabcabcabcabc1.apps.googleusercontent.com",
};
```

Guarda, espera a que se publique tu sitio (si usas GitHub Pages, tarda un
minuto) y listo: en **Ajustes › Calendario** ya debería aparecer el botón
**Conectar**.

## Notas

- El Client ID **no es secreto** — es normal que viaje dentro del código de
  apps web como esta (así funcionan Gmail, Notion, etc. desde el navegador).
  Nunca hace falta un "Client secret" aquí porque esta app no tiene servidor.
- Mientras la pantalla de consentimiento esté en modo "Prueba", solo los
  correos que agregues como "Usuarios de prueba" pueden conectar su cuenta.
  Es lo normal y suficiente para uso familiar; no hace falta que Google
  "apruebe" la app.
- Cada quien conecta **su propia** cuenta de Google desde su celular — no es
  algo que se comparta entre la familia como el código de Libro·Diario.
- Si algún día quieres desconectar, hay un botón para eso en la misma
  pantalla, o puedes revocar el acceso desde
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
