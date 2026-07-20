// storage.js
// Reproduce la misma API que usa la app (window.storage.get/set/delete),
// pero en vez de vivir dentro de Claude, guarda:
//   - datos privados de este celular (shared=false)   -> localStorage
//   - datos compartidos con la familia (shared=true)  -> Firebase Firestore,
//     con persistencia local activada para que la app funcione sin internet
//     y se sincronice sola en cuanto vuelva la señal.
//
// Script clásico (sin import/export) para poder cachearlo fácil y que
// funcione sin conexión desde el primer momento.

(function () {
  var LOCAL_PREFIX = 'libroDiario:';

  function getFamilyCode() {
    try { return localStorage.getItem(LOCAL_PREFIX + 'familyCode') || null; }
    catch (e) { return null; }
  }
  function setFamilyCode(code) {
    localStorage.setItem(LOCAL_PREFIX + 'familyCode', code);
  }

  var app = null, db = null;

  function ensureFirebase() {
    if (db) return db;
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    // Deja que Firestore guarde copia local (IndexedDB) de todo lo leído/escrito:
    // así la app funciona sin conexión y sincroniza sola al volver la señal.
    db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
      console.warn('No se pudo activar el modo sin conexión de Firestore:', err.code);
    });
    return db;
  }

  function familyDocRef(key) {
    var code = getFamilyCode();
    if (!code) throw new Error('Todavía no hay código de familia configurado');
    return ensureFirebase().collection('familias').doc(code).collection('datos').doc(key);
  }

  var cache = {};          // key -> valor (string JSON), espejo local de Firestore
  var cacheReady = {};     // key -> boolean, si ya llegó el primer snapshot
  var listeners = {};      // key -> función para cancelar el listener
  var readyWaiters = {};   // key -> lista de resolvers en espera del primer snapshot

  function subscribe(key) {
    if (listeners[key]) return;
    var ref;
    try { ref = familyDocRef(key); } catch (e) { return; }
    listeners[key] = ref.onSnapshot(function (snap) {
      var data = snap.data();
      cache[key] = data && typeof data.value === 'string' ? data.value : null;
      cacheReady[key] = true;
      (readyWaiters[key] || []).forEach(function (resolve) { resolve(); });
      readyWaiters[key] = [];
      window.dispatchEvent(new CustomEvent('libro-diario:sync', { detail: { key: key } }));
    }, function (err) {
      console.warn('Error de sincronización en', key, err);
      cacheReady[key] = true;
      (readyWaiters[key] || []).forEach(function (resolve) { resolve(); });
      readyWaiters[key] = [];
    });
  }

  function waitReady(key) {
    if (cacheReady[key]) return Promise.resolve();
    return new Promise(function (resolve) {
      readyWaiters[key] = readyWaiters[key] || [];
      readyWaiters[key].push(resolve);
      // Si no hay conexión ni caché local todavía, no esperar para siempre.
      setTimeout(resolve, 4000);
    });
  }

  window.storage = {
    get: function (key, shared) {
      if (!shared) {
        var raw = localStorage.getItem(LOCAL_PREFIX + key);
        return Promise.resolve(raw ? { key: key, value: raw, shared: false } : null);
      }
      if (!getFamilyCode()) return Promise.resolve(null);
      subscribe(key);
      return waitReady(key).then(function () {
        var value = cache[key];
        return value != null ? { key: key, value: value, shared: true } : null;
      });
    },

    set: function (key, value, shared) {
      if (!shared) {
        localStorage.setItem(LOCAL_PREFIX + key, value);
        return Promise.resolve({ key: key, value: value, shared: false });
      }
      if (!getFamilyCode()) return Promise.reject(new Error('Todavía no hay código de familia configurado'));
      subscribe(key);
      cache[key] = value; // optimista: se ve al instante en este mismo celular
      cacheReady[key] = true;
      familyDocRef(key).set({ value: value }, { merge: true }).catch(function (err) {
        console.warn('Guardado en cola (sin conexión), se sincronizará solo:', err.code || err);
      });
      return Promise.resolve({ key: key, value: value, shared: true });
    },

    delete: function (key, shared) {
      if (!shared) {
        localStorage.removeItem(LOCAL_PREFIX + key);
        return Promise.resolve({ key: key, deleted: true, shared: false });
      }
      cache[key] = null;
      return familyDocRef(key).set({ value: null }, { merge: true })
        .then(function () { return { key: key, deleted: true, shared: true }; })
        .catch(function () { return { key: key, deleted: true, shared: true }; });
    },

    list: function () {
      return Promise.resolve({ keys: [], shared: true });
    },
  };

  window.libroDiario = { getFamilyCode: getFamilyCode, setFamilyCode: setFamilyCode };
})();
