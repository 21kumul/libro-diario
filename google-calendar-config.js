// google-calendar-config.js
//
// ⚠️ EDITA ESTE ARCHIVO (opcional) ⚠️
// Esto es solo para la vinculación EN VIVO con Google Calendar (el botón
// "Conectar" y "Sincronizar" dentro de Ajustes › Calendario). Si lo dejas
// como está, la app sigue funcionando normal: el calendario se ve igual y
// puedes usar los links "Agregar a Google Calendar" de cada día o descargar
// el .ics del mes; simplemente no aparecerá el botón de conexión directa.
//
// Instrucciones paso a paso en GOOGLE-CALENDAR.md. Resumen:
//   1. Ve a https://console.cloud.google.com/ y crea un proyecto (o usa uno
//      que ya tengas).
//   2. Activa la "Google Calendar API" (menú "APIs y servicios" › "Habilitar
//      APIs y servicios" › busca "Google Calendar API" › Habilitar).
//   3. Ve a "APIs y servicios" › "Credenciales" › "Crear credenciales" ›
//      "ID de cliente de OAuth" › tipo "Aplicación web".
//   4. En "Orígenes de JavaScript autorizados" agrega la URL exacta donde
//      vive tu app (por ejemplo https://tu-usuario.github.io, sin diagonal
//      al final; si la sirves en un dominio propio, pon ese).
//   5. Copia el "Client ID" que te dio Google (termina en
//      ".apps.googleusercontent.com") y pégalo abajo.
//
// El Client ID no es secreto (es normal que viaje en el HTML de apps web
// como esta); nunca pegues aquí un "Client secret", ese es para apps con
// servidor y esta app no tiene uno.

var googleCalendarConfig = {
  clientId: "", // Ej. "123456789012-abcabcabcabcabcabcabcabcabcabc1.apps.googleusercontent.com"
};
