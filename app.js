import { firebaseConfig } from './config.js';
import { t, lang, locale, setLang, translateDOM } from './i18n.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DEF_ACTS = lang === 'en' ? ['Attack', 'Defense', 'Escape', 'Sweep'] : ['Ataque', 'Defensa', 'Escape', 'Barrida'];
const GI = { gi: 'Gi', nogi: 'No-gi', ambos: 'Gi / No-gi' };
const uid = () => crypto.randomUUID().slice(0, 8);

/* Traduce los textos fijos de la página y conecta los botones de idioma (inicio y login) */
translateDOM();
document.querySelectorAll('[data-lang]').forEach(b => {
  b.classList.toggle('on', b.dataset.lang === lang);
  b.onclick = () => { if (b.dataset.lang !== lang) setLang(b.dataset.lang); };
});

/* ---------- utilidades YouTube y tiempo ---------- */
const ytId = u => (String(u).match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/|live\/)([\w-]{11})/) || [])[1];
function ytStart(u) {
  const m = String(u).match(/[?&#](?:t|start)=([\dhms]+)/);
  if (!m) return 0;
  const v = m[1];
  if (/^\d+$/.test(v)) return +v;
  const g = k => +((v.match(new RegExp('(\\d+)' + k)) || [])[1] || 0);
  return g('h') * 3600 + g('m') * 60 + g('s');
}
/* Instagram: publicaciones y reels públicos (sin minuto de inicio ni miniatura) */
const igId = u => (String(u).match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)/) || [])[1];
/* Devuelve {yt,ig,start} a partir de un link, o null si no es de YouTube ni Instagram.
   startSecs: segundos elegidos en los casilleros (null = usar el minuto que traiga el link) */
function parseVideo(u, startSecs) {
  const y = ytId(u); if (y) return { yt: y, ig: null, start: startSecs != null ? startSecs : ytStart(u) };
  const i = igId(u); if (i) return { yt: null, ig: i, start: 0 };
  return null;
}
const videoUrl = v => v.ig ? `https://www.instagram.com/p/${v.ig}/` : v.yt ? `https://youtu.be/${v.yt}` : '';
const hasVideo = v => !!(v.yt || v.ig);
/* Minuto de inicio en dos casilleros: <p>m (minutos) y <p>s (segundos). Vacíos = null */
function getStart(p) {
  const m = $(`#${p}m`).value.trim(), s = $(`#${p}s`).value.trim();
  if (m === '' && s === '') return null;
  return Math.max(0, parseInt(m, 10) || 0) * 60 + Math.max(0, parseInt(s, 10) || 0);
}
function setStart(p, secs) {
  $(`#${p}m`).value = secs ? Math.floor(secs / 60) : '';
  $(`#${p}s`).value = secs ? String(secs % 60).padStart(2, '0') : '';
}
const parseT = s => { if (!s) return 0; const p = String(s).trim().split(':').map(Number); return p.some(isNaN) ? 0 : p.reduce((a, b) => a * 60 + b, 0); };
const fmtT = n => { if (!n) return ''; const h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
function toast(msg) { const e = $('#toast'); e.textContent = msg; e.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('show'), 1800); }

/* ---------- almacenamiento: local (sin nube) ---------- */
function localStore() {
  const K = 'bjj-videos-v2';
  let s = null;
  try { s = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  s = s || {};
  s.clips ||= []; s.tax ||= []; s.combos ||= []; s.notes ||= [];
  let cb = () => {};
  const emit = () => { try { localStorage.setItem(K, JSON.stringify(s)); } catch (e) {} cb(structuredClone(s)); };
  return {
    mode: 'local', user: { name: t('Modo local') },
    start(c) { cb = c; emit(); },
    async add(d) { s.clips.push({ id: crypto.randomUUID(), ...d }); emit(); },
    async update(id, p) { Object.assign(s.clips.find(x => x.id === id), p); emit(); },
    async del(id) { s.clips = s.clips.filter(x => x.id !== id); emit(); },
    async saveTax(x) { s.tax = x; emit(); },
    async cadd(d) { const id = crypto.randomUUID(); s.combos.push({ id, ...d }); emit(); return id; },
    async cupdate(id, p) { Object.assign(s.combos.find(x => x.id === id), p); emit(); },
    async cdel(id) { s.combos = s.combos.filter(x => x.id !== id); emit(); },
    async nadd(d) { s.notes.push({ id: crypto.randomUUID(), ...d }); emit(); },
    async nupdate(id, p) { Object.assign(s.notes.find(x => x.id === id), p); emit(); },
    async ndel(id) { s.notes = s.notes.filter(x => x.id !== id); emit(); },
    async importAll(j) { s = { clips: j.clips, tax: j.tax, combos: j.combos || [], notes: j.notes || [] }; emit(); },
  };
}

/* Mensajes claros para los errores de inicio de sesión */
function authMsg(e) {
  const m = {
    'auth/invalid-credential': 'Email o contraseña incorrectos. Si siempre entraste con Google, usá el botón de Google.',
    'auth/wrong-password': 'Email o contraseña incorrectos.',
    'auth/user-not-found': 'Email o contraseña incorrectos.',
    'auth/invalid-email': 'Ese email no es válido.',
    'auth/email-already-in-use': 'Ya hay una cuenta con ese email. Tocá "Entrar" (o "Entrar con Google" si es tu Gmail).',
    'auth/weak-password': 'La contraseña tiene que tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos y probá de nuevo.',
    'auth/operation-not-allowed': 'El acceso con email todavía no está activado en Firebase.',
    'auth/network-request-failed': 'Sin conexión a internet.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
    'auth/account-exists-with-different-credential': 'Ese email ya tiene cuenta con otro método. Entrá con email y contraseña.',
  };
  return m[e.code] ? t(m[e.code]) : t('No se pudo entrar ({e}).', { e: e.code || e.message });
}

/* ---------- almacenamiento: Firebase (nube + login Google o email) ---------- */
async function firebaseStore() {
  const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js')]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  auth.languageCode = lang; // emails de Firebase (recuperar contraseña) en el idioma elegido
  const db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  const user = await new Promise(res => { const u = A.onAuthStateChanged(auth, x => { u(); res(x); }); });
  const login = async () => {
    const p = new A.GoogleAuthProvider();
    try { await A.signInWithPopup(auth, p); location.reload(); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await A.signInWithRedirect(auth, p);
      else throw e;
    }
  };
  // Email y contraseña. Las contraseñas las guarda Firebase (encriptadas); la app nunca las almacena.
  const emailLogin = async (mail, pass) => { await A.signInWithEmailAndPassword(auth, mail, pass); location.reload(); };
  const emailSignup = async (mail, pass) => {
    const r = await A.createUserWithEmailAndPassword(auth, mail, pass);
    try { await A.sendEmailVerification(r.user); } catch (e) {}
    location.reload();
  };
  const resetPass = mail => A.sendPasswordResetEmail(auth, mail);
  if (!user) return { mode: 'cloud', user: null, login, emailLogin, emailSignup, resetPass };
  const logout = () => A.signOut(auth).then(() => location.reload());
  const who = { name: user.displayName || user.email, email: user.email };
  const myEmail = (user.email || '').toLowerCase();

  /* --- Control de acceso ---
     1) Cuentas con contraseña: tienen que confirmar el email (link que manda Firebase).
     2) Si las reglas no lo dejan leer sus datos, no está autorizado: se crea (o se muestra) su solicitud. */
  const isPassword = user.providerData.some(p => p.providerId === 'password');
  if (isPassword && !user.emailVerified) {
    return {
      mode: 'cloud', user: who, gate: 'verify', logout,
      resend: () => A.sendEmailVerification(user),
      recheck: async () => { await user.reload(); await user.getIdToken(true); location.reload(); },
    };
  }
  const base = `users/${user.uid}`;
  let allowed = true;
  try { await F.getDocFromServer(F.doc(db, base, 'meta', 'tax')); }
  catch (e) { if (e.code === 'permission-denied') allowed = false; } // sin conexión: se deja pasar (usa lo guardado)
  if (!allowed) {
    const reqRef = F.doc(db, 'requests', user.uid);
    let status = 'pending';
    try {
      const r = await F.getDocFromServer(reqRef);
      if (r.exists()) status = r.data().status || 'pending';
      else await F.setDoc(reqRef, { email: myEmail, name: user.displayName || '', createdAt: Date.now() });
    } catch (e) { console.error(e); }
    return { mode: 'cloud', user: who, gate: status === 'rejected' ? 'rejected' : 'pending', logout, recheck: () => location.reload() };
  }

  /* --- Herramientas del administrador (solo funcionan si las reglas lo reconocen como admin) --- */
  const reqCol = F.collection(db, 'requests'), allowCol = F.collection(db, 'allowed');
  const admin = {
    // cb recibe {requests, allowed}; si no es admin, nunca se llama
    watch(cb) {
      const s = { requests: null, allowed: null };
      const emit = () => { if (s.requests && s.allowed) cb({ ...s }); };
      F.onSnapshot(reqCol, q => { s.requests = q.docs.map(d => ({ uid: d.id, ...d.data() })); emit(); }, () => {});
      F.onSnapshot(allowCol, q => { s.allowed = q.docs.map(d => ({ id: d.id, ...d.data() })); emit(); }, () => {});
    },
    async accept(r) {
      await F.setDoc(F.doc(allowCol, r.email.toLowerCase()), { email: r.email.toLowerCase(), name: r.name || '', addedAt: Date.now() });
      await F.deleteDoc(F.doc(reqCol, r.uid));
    },
    reject: r => F.updateDoc(F.doc(reqCol, r.uid), { status: 'rejected' }),
    forget: r => F.deleteDoc(F.doc(reqCol, r.uid)),
    add: em => F.setDoc(F.doc(allowCol, em.toLowerCase()), { email: em.toLowerCase(), name: '', addedAt: Date.now() }),
    remove: em => F.deleteDoc(F.doc(allowCol, em.toLowerCase())),
    me: myEmail,
  };
  const clipsCol = F.collection(db, base, 'clips');
  const combosCol = F.collection(db, base, 'combos');
  const notesCol = F.collection(db, base, 'notes');
  const taxDoc = F.doc(db, base, 'meta', 'tax');
  const st = { clips: [], tax: [], combos: [], notes: [] };
  return {
    mode: 'cloud', user: who, login, logout, admin,
    start(cb) {
      F.onSnapshot(clipsCol, q => { st.clips = q.docs.map(d => ({ id: d.id, ...d.data() })); cb({ ...st }); });
      F.onSnapshot(combosCol, q => { st.combos = q.docs.map(d => ({ id: d.id, ...d.data() })); cb({ ...st }); });
      F.onSnapshot(notesCol, q => { st.notes = q.docs.map(d => ({ id: d.id, ...d.data() })); cb({ ...st }); });
      F.onSnapshot(taxDoc, d => { st.tax = d.exists() ? (d.data().positions || []) : []; cb({ ...st }); });
    },
    add: d => F.addDoc(clipsCol, d),
    update: (id, p) => F.updateDoc(F.doc(clipsCol, id), p),
    del: id => F.deleteDoc(F.doc(clipsCol, id)),
    saveTax: x => F.setDoc(taxDoc, { positions: x }),
    cadd: d => F.addDoc(combosCol, d).then(r => r.id),
    cupdate: (id, p) => F.updateDoc(F.doc(combosCol, id), p),
    cdel: id => F.deleteDoc(F.doc(combosCol, id)),
    nadd: d => F.addDoc(notesCol, d),
    nupdate: (id, p) => F.updateDoc(F.doc(notesCol, id), p),
    ndel: id => F.deleteDoc(F.doc(notesCol, id)),
    async importAll(j) {
      await F.setDoc(taxDoc, { positions: j.tax });
      const all = [...j.clips.map(c => [clipsCol, c]), ...(j.combos || []).map(c => [combosCol, c]), ...(j.notes || []).map(c => [notesCol, c])];
      for (let i = 0; i < all.length; i += 400) {
        const b = F.writeBatch(db);
        for (const [col, c] of all.slice(i, i + 400)) { const { id, ...d } = c; b.set(F.doc(col, id || crypto.randomUUID()), d); }
        await b.commit();
      }
    },
  };
}

/* ---------- arranque ---------- */
let store;
try {
  store = firebaseConfig && firebaseConfig.apiKey ? await firebaseStore() : localStore();
} catch (e) {
  console.error(e);
  alert(t('No se pudo conectar con la nube. Se usa el modo local.'));
  store = localStore();
}

if (!store.user) {
  $('#login').hidden = false;
  let signup = false;
  const msg = (err, ok = '') => { $('#lerr').textContent = err; $('#lok').textContent = ok; };
  const busy = b => { $('#lgo').disabled = b; $('#gbtn').disabled = b; };
  $('#gbtn').onclick = () => { msg(''); busy(true); store.login().catch(e => { msg(authMsg(e)); busy(false); }); };
  $('#lmode').onclick = e => {
    e.preventDefault(); signup = !signup; msg('');
    $('#lpass2').hidden = !signup; $('#lpass2').required = signup;
    $('#lpass').autocomplete = signup ? 'new-password' : 'current-password';
    $('#lgo').textContent = t(signup ? 'Crear cuenta' : 'Entrar');
    $('#lmode').textContent = t(signup ? '¿Ya tenés cuenta? Entrar' : '¿No tenés cuenta? Crear una');
    $('#lforgot').hidden = signup;
  };
  $('#lform').onsubmit = async e => {
    e.preventDefault(); msg('');
    const mail = $('#lmail').value.trim(), pass = $('#lpass').value;
    if (signup && pass !== $('#lpass2').value) return msg(t('Las contraseñas no coinciden.'));
    busy(true);
    try { await (signup ? store.emailSignup(mail, pass) : store.emailLogin(mail, pass)); }
    catch (err) { msg(authMsg(err)); busy(false); }
  };
  $('#lforgot').onclick = async e => {
    e.preventDefault();
    const mail = $('#lmail').value.trim();
    if (!mail) return msg(t('Escribí tu email arriba y volvé a tocar "¿Olvidaste tu contraseña?".'));
    try { await store.resetPass(mail); msg('', t('Si hay una cuenta con ese email, te llegó un correo para crear una contraseña nueva (mirá también en spam).')); }
    catch (err) { msg(authMsg(err)); }
  };
} else if (store.gate) {
  /* Pantalla de espera: confirmar email, solicitud pendiente o rechazada */
  const G = {
    verify:   { ic: '✉️', h: 'Confirmá tu email', p: 'Te mandamos un email a {e}. Tocá el link que viene adentro y después volvé acá y tocá "Ya lo confirmé". Si no lo ves, mirá en spam.' },
    pending:  { ic: '⏳', h: 'Solicitud enviada', p: 'Tu cuenta ({e}) está esperando que el administrador la acepte. Cuando te acepte, volvé a abrir la app.' },
    rejected: { ic: '🚫', h: 'Solicitud rechazada', p: 'El administrador no aceptó la cuenta {e}. Si creés que es un error, hablalo con él.' },
  }[store.gate];
  $('#gate').hidden = false;
  $('#gic').textContent = G.ic;
  $('#gh').textContent = t(G.h);
  $('#gp').textContent = t(G.p, { e: store.user.email });
  $('#gcheck').textContent = t(store.gate === 'verify' ? 'Ya lo confirmé' : 'Revisar de nuevo');
  $('#gcheck').hidden = store.gate === 'rejected';
  $('#gcheck').onclick = () => store.recheck();
  $('#gresend').hidden = store.gate !== 'verify';
  $('#gresend').onclick = async () => {
    try { await store.resend(); $('#gmsg').textContent = t('Listo, te mandamos el email de nuevo.'); }
    catch (e) { $('#gmsg').textContent = authMsg(e); }
  };
  $('#gout').onclick = store.logout;
} else {
  $('#app').hidden = false;
  $('#localwarn').hidden = store.mode !== 'local';
  const who = store.user.email || store.user.name;
  $('#who').textContent = who;
  $('#hwho').textContent = who;
  if (store.logout) {
    $('#out').hidden = false; $('#out').onclick = store.logout;
    $('#hout').hidden = false; $('#hout').onclick = store.logout;
  }
  init();
}

// Se registra siempre (también en la pantalla de login) para que la app se pueda instalar enseguida.
// Busca una versión nueva cada vez que se abre la app; si la hay, recarga una vez.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadSW && !sessionStorage.getItem('bjj-reloaded')) { sessionStorage.setItem('bjj-reloaded', '1'); location.reload(); }
  });
}

function init() {
  let data = { clips: [], tax: [], combos: [], notes: [] };
  let sel = { pos: null, act: null, tec: null };
  const flt = { gi: null, fav: false, prac: false, train: false };
  const opened = new Set();
  let view = 'home', comboId = null;
  let editing = null, first = true;

  /* =====================================================
     VISTAS (Inicio / Técnicas / Combos / Notas)
     ===================================================== */
  const VIEWS = {
    home:   { el: '#vHome',   title: 'Inicio',   add: null },
    videos: { el: '#vVideos', title: 'Técnicas', add: '+ Técnica' },
    combos: { el: '#vCombos', title: 'Combos',   add: '+ Combo' },
    notas:  { el: '#vNotas',  title: 'Notas',    add: '+ Nota' },
    admin:  { el: '#vAdmin',  title: 'Usuarios', add: null },
  };
  function setView(v, push = true) {
    if (!VIEWS[v] || (v === 'admin' && !adminData)) v = 'home';
    view = v;
    for (const [k, o] of Object.entries(VIEWS)) $(o.el).hidden = k !== v;
    document.querySelectorAll('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === v));
    document.body.className = document.body.className.replace(/\bv-\w+/g, '').trim() + ' v-' + v;
    $('#vtitle').textContent = t(VIEWS[v].title);
    $('#add').hidden = !VIEWS[v].add;
    $('#add').textContent = VIEWS[v].add ? t(VIEWS[v].add) : '';
    if (push && location.hash !== '#' + v) history.pushState(null, '', v === 'home' ? location.pathname : '#' + v);
    if (v === 'combos') renderCombos();
    if (v === 'notas') renderNotes();
    if (v === 'home') renderHome();
    if (v === 'admin') renderAdmin();
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    if (b.dataset.go === 'combos') comboId = null;
    setView(b.dataset.go);
  });
  // Botón "atrás" del celular: vuelve entre secciones en vez de salir de la app
  window.addEventListener('popstate', () => setView(location.hash.slice(1) || 'home', false));
  $('#add').onclick = () => view === 'videos' ? openEd() : view === 'combos' ? openComboDlg() : view === 'notas' ? openNote() : null;

  /* =====================================================
     INICIO
     ===================================================== */
  const plural = (n, s, p) => t(n === 1 ? s : p, { n });
  function renderHome() {
    renderAdminBanner();
    const tr = data.clips.filter(c => c.train).length;
    $('#hcTec').textContent = plural(data.clips.length, '{n} técnica guardada', '{n} técnicas guardadas') + (tr ? t(' · {n} entrenando', { n: tr }) : '');
    $('#hcCom').textContent = data.combos.length ? plural(data.combos.length, '{n} combo', '{n} combos') : t('Armá cadenas de técnicas en árbol');
    const up = upcoming();
    $('#hcNot').textContent = data.notes.length
      ? plural(data.notes.length, '{n} nota', '{n} notas') + (up.length ? ' · ' + plural(up.length, '{n} recordatorio', '{n} recordatorios') : '')
      : t('Diario de entrenamiento y recordatorios');
    const nx = up[0];
    $('#hnext').innerHTML = nx ? `<button class="nextcard" data-hn="${nx.id}">
        <span class="dt"><b>${dayNum(nx.date)}</b><span>${monShort(nx.date)}</span></span>
        <span class="nx"><span class="lbl">${nx.date === today() ? t('Hoy') : t('Próximo · {d}', { d: esc(weekday(nx.date)) })}</span><span class="tx">${esc(nx.text)}</span></span>
      </button>` : '';
  }
  $('#hnext').onclick = e => { const b = e.target.closest('[data-hn]'); if (b) openNote(data.notes.find(n => n.id === b.dataset.hn)); };

  /* =====================================================
     ADMINISTRADOR: solicitudes y usuarios autorizados
     (solo aparece si las reglas de Firebase te reconocen como admin)
     ===================================================== */
  let adminData = null;
  const pendingReqs = () => (adminData?.requests || []).filter(r => r.status !== 'rejected').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  function renderAdminBanner() {
    if (!adminData) { $('#hadmin').innerHTML = ''; $('#madmin').hidden = true; return; }
    $('#madmin').hidden = false;
    const n = pendingReqs().length;
    $('#hadmin').innerHTML = n
      ? `<button class="adminbar alert" data-go="admin">🔔 <b>${t(n === 1 ? '{n} solicitud pendiente' : '{n} solicitudes pendientes', { n })}</b><span class="harr">›</span></button>`
      : `<button class="adminbar" data-go="admin">👥 ${t('Usuarios autorizados')} <span class="mut">· ${adminData.allowed.length}</span><span class="harr">›</span></button>`;
  }
  const personHTML = (name, email) => `<span class="px">${name ? `<b>${esc(name)}</b><span class="mut small">${esc(email)}</span>` : `<b>${esc(email)}</b>`}</span>`;
  function renderAdmin() {
    if (!adminData) return;
    const pend = pendingReqs(), rej = adminData.requests.filter(r => r.status === 'rejected');
    $('#areq').innerHTML = pend.length
      ? pend.map(r => `<div class="person">${personHTML(r.name, r.email)}
          <span class="pb"><button class="p" data-acc="${r.uid}">✅ ${t('Aceptar')}</button><button data-rej="${r.uid}">❌ ${t('Rechazar')}</button></span></div>`).join('')
      : `<div class="mut small pempty">${t('No hay solicitudes pendientes.')}</div>`;
    $('#arej').innerHTML = rej.length ? `<h3>${t('Rechazadas')}</h3>` + rej.map(r => `<div class="person dim">${personHTML(r.name, r.email)}
          <span class="pb"><button data-acc="${r.uid}">${t('Aceptar')}</button><button data-fgt="${r.uid}" title="${t('Borrar')}">🗑</button></span></div>`).join('') : '';
    const al = [...adminData.allowed].sort((a, b) => a.email.localeCompare(b.email));
    $('#aall').innerHTML = `<div class="person me">${personHTML('', store.admin.me)}<span class="badge">${t('Administrador')}</span></div>`
      + al.filter(a => a.email !== store.admin.me).map(a => `<div class="person">${personHTML(a.name, a.email)}
          <span class="pb"><button data-rm="${esc(a.email)}">${t('Quitar')}</button></span></div>`).join('');
  }
  $('#vAdmin').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset, find = uid => adminData.requests.find(r => r.uid === uid);
    try {
      if (d.acc) { b.disabled = true; await store.admin.accept(find(d.acc)); toast(t('Aceptado')); }
      else if (d.rej && confirm(t('¿Rechazar a {e}?', { e: find(d.rej).email }))) { await store.admin.reject(find(d.rej)); toast(t('Rechazado')); }
      else if (d.fgt) { await store.admin.forget(find(d.fgt)); }
      else if (d.rm && confirm(t('¿Quitarle el acceso a {e}? Sus datos no se borran, pero no va a poder entrar.', { e: d.rm }))) { await store.admin.remove(d.rm); toast(t('Acceso quitado')); }
    } catch (err) { b.disabled = false; alert(t('No se pudo guardar: {e}', { e: err.message })); }
  });
  $('#aform').onsubmit = async e => {
    e.preventDefault();
    const em = $('#amail').value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return alert(t('Ese email no es válido.'));
    try { await store.admin.add(em); $('#amail').value = ''; toast(t('Autorizado')); }
    catch (err) { alert(t('No se pudo guardar: {e}', { e: err.message })); }
  };
  if (store.admin) store.admin.watch(d => {
    adminData = d;
    renderAdminBanner();
    if (view === 'admin') renderAdmin();
    if (first === false && location.hash === '#admin' && view !== 'admin') setView('admin', false);
  });

  /* =====================================================
     ÁRBOL LATERAL (posición → acción → técnica)
     ===================================================== */
  const count = f => data.clips.filter(f).length;
  function techs(p, a) { return [...new Set(data.clips.filter(c => c.pos === p && c.act === a && c.tec).map(c => c.tec))].sort((x, y) => x.localeCompare(y)); }
  function renderTree() {
    let h = `<div class="n ${!sel.pos ? 'on' : ''}" data-k="all"><span>${t('Todos')}</span><span class="c">${data.clips.length}</span></div>`;
    if (!data.tax.length) h += `<div class="hint">${t('Todavía no hay posiciones. Creá la primera abajo o al agregar un video.')}</div>`;
    data.tax.forEach((P, i) => {
      h += `<div class="n ${sel.pos === P.name && !sel.act ? 'on' : ''}" data-p="${i}"><span>${esc(P.name)}</span><span class="c">${count(c => c.pos === P.name)}</span></div>`;
      if (sel.pos !== P.name) return;
      P.acts.forEach((a, j) => {
        h += `<div class="n l2 ${sel.act === a && !sel.tec ? 'on' : ''}" data-p="${i}" data-a="${j}"><span>${esc(a)}</span><span class="c">${count(c => c.pos === P.name && c.act === a)}</span></div>`;
        if (sel.act !== a) return;
        techs(P.name, a).forEach(x => {
          h += `<div class="n l3 ${sel.tec === x ? 'on' : ''}" data-p="${i}" data-a="${j}" data-t="${esc(x)}"><span>${esc(x)}</span><span class="c">${count(c => c.pos === P.name && c.act === a && c.tec === x)}</span></div>`;
        });
      });
      h += `<div class="n l2 addact" data-addact="${i}"><span>${t('+ acción')}</span></div>`;
    });
    $('#tree').innerHTML = h;
    renderMnav();
  }

  /* ----- Celular: "Todas / Por posición" con filas deslizables ----- */
  let posMode = false;
  function renderMnav() {
    const on = posMode || !!sel.pos;
    const pill = (attrs, label, n, active) => `<button class="pill ${active ? 'on' : ''}" ${attrs}>${esc(label)}${n != null ? ` <span class="c">${n}</span>` : ''}</button>`;
    let h = `<div class="seg">
      <button data-mode="all" class="${on ? '' : 'on'}">${t('Todas')} <span class="c">${data.clips.length}</span></button>
      <button data-mode="pos" class="${on ? 'on' : ''}">${t('Por posición')}</button></div>`;
    if (on) {
      h += `<div class="mrow-l">${t('Posición')}</div><div class="hscroll">`
        + data.tax.map((P, i) => pill(`data-mp="${i}"`, P.name, count(c => c.pos === P.name), sel.pos === P.name)).join('')
        + `<button class="pill add" data-newpos="1">${t('＋ Posición')}</button></div>`;
      const i = data.tax.findIndex(P => P.name === sel.pos);
      if (i >= 0) {
        const P = data.tax[i];
        h += `<div class="mrow-l">${t('Acción')}</div><div class="hscroll">`
          + P.acts.map((a, j) => pill(`data-mp="${i}" data-ma="${j}"`, a, count(c => c.pos === P.name && c.act === a), sel.act === a)).join('')
          + `<button class="pill add" data-newact="${i}">${t('＋ Acción')}</button></div>`;
        const ts = sel.act ? techs(P.name, sel.act) : [];
        if (ts.length) h += `<div class="mrow-l">${t('Técnica')}</div><div class="hscroll">`
          + ts.map(x => pill(`data-mp="${i}" data-ma="${P.acts.indexOf(sel.act)}" data-mt="${esc(x)}"`, x, null, sel.tec === x)).join('') + `</div>`;
      }
    }
    $('#mnav').innerHTML = h;
    // Deja visible (centrado) el botón elegido en cada fila
    $('#mnav').querySelectorAll('.hscroll').forEach(r => { const b = r.querySelector('.on'); if (b) r.scrollLeft = b.offsetLeft - r.offsetLeft - (r.clientWidth - b.offsetWidth) / 2; });
  }
  $('#mnav').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.mode === 'all') { posMode = false; sel = { pos: null, act: null, tec: null }; }
    else if (d.mode === 'pos') { posMode = true; }
    else if (d.newpos) { const n = await newPos(); if (n) { posMode = true; sel = { pos: n, act: null, tec: null }; } }
    else if (d.newact) { const P = data.tax[d.newact]; const n = await newAct(P.name); if (n) sel = { pos: P.name, act: n, tec: null }; }
    else if (d.mp != null) {
      const P = data.tax[d.mp];
      const act = d.ma != null ? P.acts[d.ma] : null, tec = d.mt || null;
      // Tocar de nuevo el que ya está elegido lo des-selecciona (vuelve un nivel)
      if (tec) sel = sel.tec === tec ? { pos: P.name, act, tec: null } : { pos: P.name, act, tec };
      else if (act) sel = sel.act === act && !sel.tec ? { pos: P.name, act: null, tec: null } : { pos: P.name, act, tec: null };
      else sel = sel.pos === P.name && !sel.act ? { pos: null, act: null, tec: null } : { pos: P.name, act: null, tec: null };
    }
    render();
  };
  $('#tree').onclick = e => {
    const n = e.target.closest('.n'); if (!n) return;
    if (n.dataset.addact) { newAct(data.tax[n.dataset.addact].name); return; }
    if (n.dataset.k === 'all') sel = { pos: null, act: null, tec: null };
    else {
      const P = data.tax[n.dataset.p];
      sel = { pos: P.name, act: n.dataset.a != null ? P.acts[n.dataset.a] : null, tec: n.dataset.t || null };
    }
    if (n.dataset.t || n.dataset.k) document.body.classList.remove('side');
    render();
  };
  $('#menu').onclick = () => document.body.classList.toggle('side');
  document.addEventListener('click', e => {
    if (document.body.classList.contains('side') && !e.target.closest('aside') && !e.target.closest('#menu')) document.body.classList.remove('side');
  });

  async function newPos() {
    const n = (prompt(t('Nombre de la nueva posición (ej: Guardia cerrada):')) || '').trim();
    if (!n) return null;
    if (data.tax.some(p => p.name.toLowerCase() === n.toLowerCase())) { toast(t('Esa posición ya existe')); return n; }
    await store.saveTax([...data.tax, { name: n, acts: [...DEF_ACTS] }]);
    toast(t('Posición creada'));
    return n;
  }
  async function newAct(pos) {
    const n = (prompt(t('Nueva acción para "{p}" (ej: Pasaje):', { p: pos })) || '').trim();
    if (!n) return null;
    const tax = data.tax.map(p => p.name === pos && !p.acts.includes(n) ? { ...p, acts: [...p.acts, n] } : p);
    await store.saveTax(tax);
    return n;
  }
  $('#newposside').onclick = newPos;

  /* =====================================================
     LISTA DE TÉCNICAS (compacta, se abre al tocar)
     ===================================================== */
  document.querySelectorAll('.chip').forEach(b => b.onclick = () => {
    const f = b.dataset.f;
    if (f === 'gi') flt.gi = flt.gi === b.dataset.v ? null : b.dataset.v; else flt[f] = !flt[f];
    render();
  });
  $('#q').oninput = render;

  function visible(c) {
    if (sel.pos && c.pos !== sel.pos) return false;
    if (sel.act && c.act !== sel.act) return false;
    if (sel.tec && c.tec !== sel.tec) return false;
    if (flt.gi && c.gi !== flt.gi && c.gi !== 'ambos') return false;
    if (flt.fav && !c.fav) return false;
    if (flt.prac && !c.prac) return false;
    if (flt.train && !c.train) return false;
    const q = $('#q').value.trim().toLowerCase();
    return !q || [c.title, c.ytTitle, c.pos, c.act, c.tec, c.notes].join(' ').toLowerCase().includes(q);
  }

  function itemHTML(c) {
    const open = opened.has(c.id);
    const path = [c.pos, c.act, c.tec].filter(Boolean).join(' → ');
    return `<div class="item ${open ? 'open' : ''}">
      <button class="head" data-open="${c.id}">
        <span class="hx"><span class="tt">${esc(c.title || c.ytTitle || t('Sin título'))}</span><span class="path">${esc(path)}</span></span>
        <span class="mk">${c.fav ? '⭐' : ''}${c.prac ? '🔁' : ''}${c.train ? '🥋' : ''}</span><span class="chev">▸</span>
      </button>
      ${open ? `<div class="body">
        ${c.ig
          ? `<button class="th ig" data-play="${c.id}" aria-label="${t('Ver video de Instagram')}"><span class="igl">Instagram</span><span class="pl">▶</span></button>`
          : `<button class="th" data-play="${c.id}" aria-label="${t('Ver video')}"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${c.yt}/mqdefault.jpg"><span class="pl">▶</span>${c.start ? `<span class="t">${t('desde {t}', { t: fmtT(c.start) })}</span>` : ''}</button>`}
        <div><span class="badge">${GI[c.gi] || 'Gi'}</span>${c.ig ? ' <span class="badge">Instagram</span>' : ''}</div>
        <textarea data-note="${c.id}" rows="2" placeholder="${t('Notas…')}">${esc(c.notes)}</textarea>
        <div class="act">
          <button class="tg ${c.fav ? 'on' : ''}" data-tg="fav" data-id="${c.id}" title="${t('Favorito')}">⭐</button>
          <button class="tg ${c.prac ? 'on' : ''}" data-tg="prac" data-id="${c.id}" title="${t('Por practicar')}">🔁</button>
          <button class="tg ${c.train ? 'on' : ''}" data-tg="train" data-id="${c.id}" title="${t('Entrenando')}">🥋</button>
          <button data-clip="${c.id}" title="${t('Guardar otra técnica del mismo video')}">${t('+ Recorte')}</button>
          <button class="r" data-edit="${c.id}">${t('Editar')}</button>
          <button data-del="${c.id}" title="${t('Borrar')}">🗑</button>
        </div>
      </div>` : ''}
    </div>`;
  }

  function render() {
    renderTree();
    document.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b.dataset.f === 'gi' ? flt.gi === b.dataset.v : flt[b.dataset.f]));
    $('#crumb').textContent = [sel.pos || t('Todas las técnicas'), sel.act, sel.tec].filter(Boolean).join(' → ');
    if (view === 'combos') renderCombos();
    if (view === 'notas') renderNotes();
    if (view === 'home') renderHome();
    const ae = document.activeElement;
    if (ae && ae.dataset && ae.dataset.note) return; // no pisar lo que estás escribiendo
    // Orden: 🥋 Entrenando → 🔁 Por practicar → ⭐ Favoritos → el resto; dentro de cada grupo, los más nuevos primero
    const rank = c => c.train ? 0 : c.prac ? 1 : c.fav ? 2 : 3;
    const vs = data.clips.filter(visible).sort((a, b) => rank(a) - rank(b) || (b.added || 0) - (a.added || 0));
    $('#grid').innerHTML = vs.length ? vs.map(itemHTML).join('')
      : `<div class="empty">${data.clips.length ? t('Nada coincide con esta búsqueda o filtro.') : t('Todavía no hay técnicas. Tocá “+ Técnica” o compartí un video desde YouTube o Instagram.')}</div>`;
  }

  $('#grid').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.open) { opened.has(d.open) ? opened.delete(d.open) : opened.add(d.open); render(); }
    else if (d.play) { const c = data.clips.find(x => x.id === d.play); playClip(c); }
    else if (d.edit) openEd({ id: d.edit });
    else if (d.clip) openEd({ from: d.clip });
    else if (d.tg) { const c = data.clips.find(x => x.id === d.id); await store.update(d.id, { [d.tg]: !c[d.tg] }); }
    else if (d.del && confirm(t('¿Borrar este video de tu biblioteca? (No se borra de YouTube)'))) { await store.del(d.del); toast(t('Borrado')); }
  };
  $('#grid').addEventListener('change', async e => {
    const id = e.target.dataset.note; if (!id) return;
    await store.update(id, { notes: e.target.value.trim() });
    toast(t('Nota guardada'));
  });
  $('#grid').addEventListener('focusout', e => { if (e.target.dataset.note) setTimeout(render, 0); });

  /* =====================================================
     REPRODUCTOR (sirve para técnicas y para cuadritos de combos)
     ===================================================== */
  let onNoteSave = null;
  function play({ yt, ig, start, title, path, notes, label, save }) {
    if (ig) {
      $('#plc').innerHTML = `<iframe class="ig" src="https://www.instagram.com/p/${ig}/embed/" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen scrolling="no"></iframe>`;
      $('#yt').href = `https://www.instagram.com/p/${ig}/`;
      $('#yt').textContent = t('Abrir en Instagram ↗');
    } else {
      $('#plc').innerHTML = `<iframe src="https://www.youtube.com/embed/${yt}?start=${start || 0}&autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
      $('#yt').href = `https://www.youtube.com/watch?v=${yt}&t=${start || 0}s`;
      $('#yt').textContent = t('Abrir en YouTube ↗');
    }
    $('#plt').textContent = title || '';
    $('#plp').textContent = (path || '') + (start && !ig ? t(' · empieza en {t}', { t: fmtT(start) }) : '');
    $('#plnl').textContent = t(label || 'Notas');
    $('#pln').value = notes || ''; $('#plsaved').textContent = '';
    onNoteSave = save;
    $('#pl').showModal();
  }
  const playClip = c => play({
    yt: c.yt, ig: c.ig, start: c.start, title: c.title || c.ytTitle, notes: c.notes,
    path: [c.pos, c.act, c.tec].filter(Boolean).join(' → '),
    save: v => store.update(c.id, { notes: v }),
  });
  $('#pln').onchange = async () => { if (onNoteSave) { await onNoteSave($('#pln').value.trim()); $('#plsaved').textContent = t('Guardado'); } };
  $('#plx').onclick = () => $('#pl').close();
  $('#pl').onclose = () => { $('#plc').innerHTML = ''; onNoteSave = null; };

  /* =====================================================
     FORMULARIO AGREGAR / EDITAR TÉCNICA
     ===================================================== */
  function fillPos(p) {
    $('#pos').innerHTML = data.tax.length ? data.tax.map(x => `<option>${esc(x.name)}</option>`).join('') : `<option value="">${t('— creá una posición con + —')}</option>`;
    if (p && data.tax.some(x => x.name === p)) $('#pos').value = p;
    fillAct();
  }
  function fillAct(a) {
    const P = data.tax.find(x => x.name === $('#pos').value);
    $('#act').innerHTML = P ? P.acts.map(x => `<option>${esc(x)}</option>`).join('') : '';
    if (a && P && P.acts.includes(a)) $('#act').value = a;
    $('#tecs').innerHTML = techs($('#pos').value, $('#act').value).map(x => `<option value="${esc(x)}">`).join('');
  }
  $('#pos').onchange = () => fillAct();
  $('#act').onchange = () => fillAct($('#act').value);
  $('#newpos').onclick = async () => { const n = await newPos(); if (n) fillPos(n); };
  $('#newact').onclick = async () => { if (!$('#pos').value) return toast(t('Primero creá una posición')); const n = await newAct($('#pos').value); if (n) fillAct(n); };

  function openEd({ id, from, url } = {}) {
    editing = id || null;
    const c = data.clips.find(x => x.id === (id || from));
    $('#edt').textContent = t(id ? 'Editar técnica' : from ? 'Nuevo recorte del mismo video' : 'Agregar técnica');
    $('#url').value = c ? videoUrl(c) : (url || '');
    $('#title').value = id ? c.title || '' : '';
    $('#yttitle').textContent = c?.ytTitle ? t('En YouTube: {t}', { t: c.ytTitle }) : '';
    $('#yttitle').dataset.v = c?.ytTitle || '';
    fillPos(id ? c.pos : (c?.pos || sel.pos));
    fillAct(id ? c.act : (c?.act || sel.act));
    $('#tec').value = id ? c.tec || '' : (from ? '' : sel.tec || '');
    setStart('start', id ? c.start : (url ? ytStart(url) : 0));
    syncStart();
    $('#gi').value = c?.gi || flt.gi || 'gi';
    $('#fav').checked = id ? !!c.fav : false;
    $('#prac').checked = id ? !!c.prac : false;
    $('#train').checked = id ? !!c.train : false;
    $('#notes').value = id ? c.notes || '' : '';
    $('#ed').showModal();
    if (url) fetchTitle();
    else if (!id && !from) $('#url').focus();
    else $('#title').focus();
  }
  /* Instagram no permite elegir minuto: se desactiva el campo */
  function syncStart() {
    const ig = !!igId($('#url').value);
    $('#startm').disabled = $('#starts').disabled = ig;
    if (ig) setStart('start', 0);
    $('#startm').closest('.tsplit').title = ig ? t('No disponible en Instagram') : '';
  }
  async function fetchTitle() {
    syncStart();
    const id = ytId($('#url').value); if (!id) return;
    const s = ytStart($('#url').value); if (s && getStart('start') == null) setStart('start', s);
    try {
      const r = await fetch('https://noembed.com/embed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
      const j = await r.json();
      if (j.title) { $('#yttitle').textContent = t('En YouTube: {t}', { t: j.title }); $('#yttitle').dataset.v = j.title; }
    } catch (e) {}
  }
  $('#url').onchange = fetchTitle;
  $('#cx').onclick = () => $('#ed').close();

  $('#f').onsubmit = async e => {
    e.preventDefault();
    const v = parseVideo($('#url').value, getStart('start'));
    if (!v) return alert(t('Ese link no parece de YouTube ni de Instagram.'));
    if (!$('#pos').value) return alert(t('Elegí o creá una posición (botón +).'));
    if (v.ig && !$('#title').value.trim()) return alert(t('Los videos de Instagram no traen título: escribí uno.'));
    const d = {
      ...v, title: $('#title').value.trim(), ytTitle: v.yt ? ($('#yttitle').dataset.v || '') : '',
      pos: $('#pos').value, act: $('#act').value, tec: $('#tec').value.trim(),
      gi: $('#gi').value,
      fav: $('#fav').checked, prac: $('#prac').checked, train: $('#train').checked, notes: $('#notes').value.trim(),
    };
    $('#ed').close();
    try {
      if (editing) await store.update(editing, d);
      else await store.add({ ...d, added: Date.now() });
      toast(t('Guardado'));
    } catch (err) { alert(t('No se pudo guardar: {e}', { e: err.message })); }
  };

  /* =====================================================
     COMBOS
     ===================================================== */
  const combo = () => data.combos.find(c => c.id === comboId);

  function renderCombos() {
    const c = combo();
    if (comboId && !c) comboId = null;
    $('#clist').hidden = !!comboId;
    $('#cdetail').hidden = !comboId;
    if (!comboId) {
      const cs = [...data.combos].sort((a, b) => (b.added || 0) - (a.added || 0));
      $('#clist').innerHTML = cs.length ? cs.map(c => `
        <button class="citem" data-combo="${c.id}"><b>${esc(c.name)}</b>
          <span class="mut small">${esc(t('Desde {p} · {n} técnicas', { p: c.pos, n: Math.max(0, (c.nodes || []).length - 1) }))}</span></button>`).join('')
        : `<div class="empty">${t('Todavía no hay combos. Tocá “+ Combo” para crear el primero.')}</div>`;
      return;
    }
    $('#cname').textContent = c.name;
    $('#cinfo').textContent = t('Desde {p} · {n} técnicas', { p: c.pos, n: c.nodes.length - 1 });
    drawDiagram(c);
  }
  $('#clist').onclick = e => { const b = e.target.closest('[data-combo]'); if (b) { comboId = b.dataset.combo; renderCombos(); } };
  $('#cback').onclick = () => { comboId = null; renderCombos(); };

  /* --- crear / renombrar combo --- */
  let renaming = false;
  function openComboDlg(ren = false) {
    renaming = ren;
    const c = ren && combo();
    $('#cdt').textContent = t(ren ? 'Renombrar combo' : 'Nuevo combo');
    $('#cnm').value = c ? c.name : '';
    $('#cpos').value = c ? c.pos : (sel.pos || '');
    $('#cposl').innerHTML = data.tax.map(p => `<option value="${esc(p.name)}">`).join('');
    $('#cdlg').showModal();
    $('#cnm').focus();
  }
  $('#ccx').onclick = () => $('#cdlg').close();
  $('#cform').onsubmit = async e => {
    e.preventDefault();
    const name = $('#cnm').value.trim(), pos = $('#cpos').value.trim();
    if (!name || !pos) return;
    $('#cdlg').close();
    if (renaming) {
      const c = combo();
      const nodes = c.nodes.map(n => n.parent == null ? { ...n, name: pos } : n);
      await store.cupdate(c.id, { name, pos, nodes });
    } else {
      comboId = await store.cadd({ name, pos, added: Date.now(), nodes: [{ id: 'root', parent: null, name: pos, desc: '' }] });
      setView('combos');
    }
    renderCombos();
  };
  $('#cren').onclick = () => openComboDlg(true);
  $('#cdel').onclick = async () => {
    const c = combo();
    if (!confirm(t('¿Borrar el combo "{n}" con todas sus técnicas?', { n: c.name }))) return;
    await store.cdel(c.id); comboId = null; toast(t('Combo borrado')); renderCombos();
  };

  /* --- diagrama de árbol --- */
  const NW = 160, NH = 72, GX = 22, GY = 78;
  function drawDiagram(c) {
    const nodes = c.nodes;
    const kids = id => nodes.filter(n => n.parent === id);
    const pos = {};
    let nextX = 0, maxD = 0;
    (function lay(n, d) {
      maxD = Math.max(maxD, d);
      const ch = kids(n.id);
      if (!ch.length) pos[n.id] = { x: nextX++, d };
      else { ch.forEach(k => lay(k, d + 1)); pos[n.id] = { x: (pos[ch[0].id].x + pos[ch[ch.length - 1].id].x) / 2, d }; }
    })(nodes.find(n => n.parent == null), 0);
    const px = id => pos[id].x * (NW + GX), py = id => pos[id].d * (NH + GY);
    const W = nextX * (NW + GX) - GX, H = (maxD + 1) * (NH + GY) - GY;

    let paths = '', labels = '', boxes = '';
    for (const n of nodes) {
      if (!pos[n.id]) continue;
      const x = px(n.id), y = py(n.id), root = n.parent == null;
      if (!root && pos[n.parent]) {
        const x1 = px(n.parent) + NW / 2, y1 = py(n.parent) + NH, x2 = x + NW / 2, y2 = y, my = (y1 + y2) / 2;
        paths += `<path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}"/><path d="M${x2 - 5},${y2 - 7} L${x2},${y2} L${x2 + 5},${y2 - 7}"/>`;
        // El texto de la flecha se toca para editarlo; si no tiene, aparece un "+ texto" discreto
        labels += n.via
          ? `<button class="via" data-via="${n.id}" style="left:${x2}px;top:${my + 6}px" title="${t('Editar texto de la flecha')}">${esc(n.via)}</button>`
          : `<button class="via add" data-via="${n.id}" style="left:${x2}px;top:${my + 6}px" title="${t('Agregar texto a la flecha')}">${t('+ texto')}</button>`;
      }
      boxes += `<div class="node ${root ? 'root' : ''}" style="left:${x}px;top:${y}px">
        <div class="nm" title="${esc(n.name)}">${esc(n.name)}</div>
        <div class="nb">
          <button data-nd="desc" data-n="${n.id}" class="${n.desc ? '' : 'off'}" title="${t('Descripción')}">📝</button>
          ${hasVideo(n) ? `<button data-nd="play" data-n="${n.id}" title="${t('Ver video')}">▶</button>` : ''}
          <button data-nd="edit" data-n="${n.id}" title="${t('Editar')}">✎</button>
          <button data-nd="add" data-n="${n.id}" title="${t('Agregar técnica que sigue')}">＋</button>
        </div></div>`;
    }
    $('#diagram').innerHTML = `<div class="canvas" style="width:${W}px;height:${H}px">
      <svg width="${W}" height="${H}">${paths}</svg>${labels}${boxes}</div>`;
  }

  /* --- texto de una flecha --- */
  let viaNode = null;
  function openVia(n) {
    viaNode = n;
    const par = combo().nodes.find(x => x.id === n.parent);
    $('#vfrom').textContent = t('De {a} → {b}', { a: par ? par.name : '', b: n.name });
    $('#vtext').value = n.via || '';
    $('#vclear').hidden = !n.via;
    $('#vdlg').showModal();
    $('#vtext').focus();
  }
  $('#vcx').onclick = () => $('#vdlg').close();
  $('#vclear').onclick = async () => { $('#vdlg').close(); await saveNode(viaNode.id, { via: '' }); };
  $('#vform').onsubmit = async e => { e.preventDefault(); $('#vdlg').close(); await saveNode(viaNode.id, { via: $('#vtext').value.trim() }); toast(t('Guardado')); };

  $('#diagram').onclick = e => {
    const v = e.target.closest('[data-via]');
    if (v) return openVia(combo().nodes.find(x => x.id === v.dataset.via));
    const b = e.target.closest('[data-nd]'); if (!b) return;
    const c = combo(), n = c.nodes.find(x => x.id === b.dataset.n);
    if (b.dataset.nd === 'add') openNode({ parent: n });
    else if (b.dataset.nd === 'edit') openNode({ node: n });
    else if (b.dataset.nd === 'desc') {
      if (!n.desc) return openNode({ node: n, focusDesc: true });
      $('#ddt').textContent = n.name;
      $('#ddtx').textContent = n.desc;
      $('#dded').onclick = () => { $('#dd').close(); openNode({ node: n, focusDesc: true }); };
      $('#dd').showModal();
    }
    else if (b.dataset.nd === 'play') play({
      yt: n.yt, ig: n.ig, start: n.start, title: n.name, path: c.name, notes: n.desc, label: 'Descripción',
      save: v => saveNode(n.id, { desc: v }),
    });
  };
  $('#ddx').onclick = () => $('#dd').close();

  async function saveNode(id, patch) {
    const c = combo();
    await store.cupdate(c.id, { nodes: c.nodes.map(n => n.id === id ? { ...n, ...patch } : n) });
  }

  /* --- cuadrito: crear / editar --- */
  let nodeCtx = null;
  function openNode({ node, parent, focusDesc }) {
    nodeCtx = { node, parent };
    const root = node && node.parent == null;
    const par = parent || (node && combo().nodes.find(x => x.id === node.parent));
    $('#ndt').textContent = t(node ? (root ? 'Posición de inicio' : 'Editar técnica') : 'Nueva técnica');
    $('#ndfrom').textContent = par ? t('Viene de: {n}', { n: par.name }) : '';
    $('#ndviaw').hidden = root;
    $('#ndvia').value = node?.via || '';
    $('#ndname').value = node?.name || '';
    $('#nddesc').value = node?.desc || '';
    $('#ndclip').innerHTML = `<option value="">${t('— ninguno —')}</option>` + [...data.clips]
      .sort((a, b) => (a.title || a.ytTitle || '').localeCompare(b.title || b.ytTitle || ''))
      .map(c => `<option value="${c.id}">${esc(c.title || c.ytTitle || t('Sin título'))}${c.tec ? ' · ' + esc(c.tec) : ''}</option>`).join('');
    $('#ndurl').value = node ? videoUrl(node) : '';
    setStart('ndstart', node?.start || 0);
    $('#ndvid').open = !!node && hasVideo(node);
    $('#ndel').hidden = !node || root;
    $('#nd').showModal();
    (focusDesc ? $('#nddesc') : node ? $('#ndname') : ($('#ndvia').closest('[hidden]') ? $('#ndname') : $('#ndvia'))).focus();
  }
  $('#ndclip').onchange = () => {
    const c = data.clips.find(x => x.id === $('#ndclip').value); if (!c) return;
    $('#ndurl').value = videoUrl(c);
    setStart('ndstart', c.ig ? 0 : c.start);
    if (!$('#ndname').value) $('#ndname').value = c.tec || c.title || c.ytTitle || '';
  };
  $('#ndurl').onchange = () => { const s = ytStart($('#ndurl').value); if (s && getStart('ndstart') == null) setStart('ndstart', s); };
  $('#ndcx').onclick = () => $('#nd').close();
  $('#nform').onsubmit = async e => {
    e.preventDefault();
    const name = $('#ndname').value.trim(); if (!name) return;
    const url = $('#ndurl').value.trim(), v = url ? parseVideo(url, getStart('ndstart')) : { yt: null, ig: null, start: 0 };
    if (!v) return alert(t('Ese link no parece de YouTube ni de Instagram.'));
    const d = { name, via: $('#ndvia').value.trim(), desc: $('#nddesc').value.trim(), ...v };
    const c = combo();
    let nodes;
    if (nodeCtx.node) nodes = c.nodes.map(n => n.id === nodeCtx.node.id ? { ...n, ...d } : n);
    else nodes = [...c.nodes, { id: uid(), parent: nodeCtx.parent.id, ...d }];
    $('#nd').close();
    await store.cupdate(c.id, { nodes });
    toast(t('Guardado'));
  };
  $('#ndel').onclick = async () => {
    const c = combo(), id = nodeCtx.node.id;
    const gone = new Set([id]);
    let grew = true;
    while (grew) { grew = false; for (const n of c.nodes) if (!gone.has(n.id) && gone.has(n.parent)) { gone.add(n.id); grew = true; } }
    const extra = gone.size - 1;
    const q = extra ? t('¿Borrar "{n}" y las {k} técnicas que salen de ella?', { n: nodeCtx.node.name, k: extra }) : t('¿Borrar "{n}"?', { n: nodeCtx.node.name });
    if (!confirm(q)) return;
    $('#nd').close();
    await store.cupdate(c.id, { nodes: c.nodes.filter(n => !gone.has(n.id)) });
  };

  /* =====================================================
     COMPARTIR DESDE YOUTUBE / INSTAGRAM (app instalada)
     ===================================================== */
  function handleShare() {
    const p = new URLSearchParams(location.search);
    const txt = [p.get('url'), p.get('text'), p.get('title')].filter(Boolean).join(' ');
    if (!txt) return;
    history.replaceState(null, '', location.pathname);
    const m = txt.match(/https?:\/\/\S+/g) || [];
    const u = m.find(x => ytId(x) || igId(x));
    setView('videos');
    if (u) openEd({ url: u }); else toast(t('No encontré un link de YouTube o Instagram en lo compartido'));
  }

  /* =====================================================
     NOTAS CON FECHA (diario de entrenamiento + recordatorios)
     ===================================================== */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const shift = k => { const d = new Date(); d.setDate(d.getDate() + k); return ymd(d); };
  const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const dayNum = s => toDate(s).getDate();
  const monShort = s => toDate(s).toLocaleDateString(locale, { month: 'short' }).replace('.', '');
  const weekday = s => toDate(s).toLocaleDateString(locale, { weekday: 'long' });
  const longDate = s => toDate(s).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: toDate(s).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  /* Tipo de nota: 'done' (entrenado), 'next' (próximo entrenamiento) o 'pinned' (fija, sin fecha).
     Las notas viejas sin tipo se acomodan por su fecha. */
  const kindOf = n => n.kind || (n.date > today() ? 'next' : 'done');
  const upcoming = () => data.notes.filter(n => kindOf(n) === 'next' && n.date >= today()).sort((a, b) => a.date.localeCompare(b.date) || (a.added || 0) - (b.added || 0));
  const relDay = s => { const diff = Math.round((toDate(s) - toDate(today())) / 864e5); return diff === 0 ? t('Hoy') : diff === 1 ? t('Mañana') : diff === -1 ? t('Ayer') : diff > 1 ? t('En {n} días', { n: diff }) : ''; };

  function noteHTML(n) {
    if (kindOf(n) === 'pinned') return `<button class="note pinned" data-nid="${n.id}">
      <span class="dt"><b>📌</b><span>${t('Fija')}</span></span>
      <span class="nx"><span class="tx">${esc(n.text)}</span></span></button>`;
    const td = today(), nxt = kindOf(n) === 'next';
    const cls = n.date === td ? 'today' : nxt && n.date > td ? 'future' : '';
    const tag = n.date === td ? t('Hoy') : nxt && n.date > td ? t('Próximo entrenamiento') : '';
    return `<button class="note ${cls}" data-nid="${n.id}">
      <span class="dt"><b>${dayNum(n.date)}</b><span>${monShort(n.date)}</span></span>
      <span class="nx"><span class="wd">${esc(longDate(n.date))}${tag ? `<span class="tag">${tag}</span>` : ''}${relDay(n.date) && n.date !== td ? ` · ${relDay(n.date)}` : ''}</span>
      <span class="tx">${esc(n.text)}</span></span></button>`;
  }
  function renderNotes() {
    const td = today();
    const fut = upcoming();
    const pinned = data.notes.filter(n => kindOf(n) === 'pinned').sort((a, b) => (b.added || 0) - (a.added || 0));
    // Diario: lo entrenado + los "próximos" cuya fecha ya pasó
    const past = data.notes.filter(n => kindOf(n) === 'done' || (kindOf(n) === 'next' && n.date < td))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.added || 0) - (a.added || 0));
    if (!data.notes.length) {
      $('#nlist').innerHTML = `<div class="empty">${t('Todavía no hay notas.')}<br><br>${t('Después de entrenar, anotá qué hiciste.')}<br>${t('O dejate un recordatorio para el próximo entrenamiento.')}<br><br><button class="p" id="nfirst">${t('+ Nueva nota')}</button></div>`;
      $('#nfirst').onclick = () => openNote();
      return;
    }
    $('#nlist').innerHTML =
      (fut.length ? `<div class="nsec"><h3>${t('Próximos entrenamientos')}</h3>${fut.map(noteHTML).join('')}</div>` : '') +
      (pinned.length ? `<div class="nsec"><h3>${t('Notas fijas')}</h3>${pinned.map(noteHTML).join('')}</div>` : '') +
      (past.length ? `<div class="nsec"><h3>${t('Diario de entrenamiento')}</h3>${past.map(noteHTML).join('')}</div>` : '');
  }
  $('#nlist').addEventListener('click', e => { const b = e.target.closest('[data-nid]'); if (b) openNote(data.notes.find(n => n.id === b.dataset.nid)); });

  let noteEditing = null, ntKind = 'done';
  const KIND_HINT = {
    done: '🥋 Lo que entrenaste ese día.',
    next: '📅 Un recordatorio para un entrenamiento que viene. Elegí el día.',
    pinned: '📌 Siempre visible, sin fecha. Ideal para cosas que querés tener presentes.',
  };
  const KIND_PH = {
    done: 'Qué entrenaste, qué salió, qué no…',
    next: 'Qué querés practicar ese día…',
    pinned: 'Ej: Siempre cerrar las rodillas en el triángulo.',
  };
  function setKind(k) {
    ntKind = k;
    document.querySelectorAll('#ntkinds [data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    $('#ntdatew').hidden = k === 'pinned';
    $('#ntdate').required = k !== 'pinned';
    if (k !== 'pinned' && !$('#ntdate').value) $('#ntdate').value = today();
    $('#ntkind').textContent = t(KIND_HINT[k]);
    $('#nttext').placeholder = t(KIND_PH[k]);
  }
  function openNote(n) {
    noteEditing = n || null;
    $('#ntt').textContent = t(n ? 'Editar nota' : 'Nueva nota');
    $('#ntdate').value = n && n.date ? n.date : today();
    $('#nttext').value = n ? n.text : '';
    $('#ntdel').hidden = !n;
    setKind(n ? kindOf(n) : 'done');
    $('#ntdlg').showModal();
    if (!n) $('#nttext').focus();
  }
  document.querySelectorAll('#ntkinds [data-k]').forEach(b => b.onclick = () => setKind(b.dataset.k));
  $('#ntcx').onclick = () => $('#ntdlg').close();
  $('#ntform').onsubmit = async e => {
    e.preventDefault();
    const d = { kind: ntKind, date: ntKind === 'pinned' ? '' : $('#ntdate').value, text: $('#nttext').value.trim() };
    if (!d.text || (ntKind !== 'pinned' && !d.date)) return;
    $('#ntdlg').close();
    try {
      if (noteEditing) await store.nupdate(noteEditing.id, d);
      else await store.nadd({ ...d, added: Date.now() });
      toast(t('Nota guardada'));
    } catch (err) { alert(t('No se pudo guardar: {e}', { e: err.message })); }
  };
  $('#ntdel').onclick = async () => {
    if (!confirm(t('¿Borrar esta nota?'))) return;
    $('#ntdlg').close();
    await store.ndel(noteEditing.id);
    toast(t('Nota borrada'));
  };

  /* =====================================================
     RESPALDO
     ===================================================== */
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ clips: data.clips, tax: data.tax, combos: data.combos, notes: data.notes }, null, 1)], { type: 'application/json' }));
    a.download = 'bjj-respaldo-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
  };
  $('#imp').onclick = () => $('#file').click();
  $('#file').onchange = async e => {
    try {
      const j = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(j.clips) || !Array.isArray(j.tax)) throw 0;
      if (confirm(t('¿Cargar {a} técnicas, {b} combos y {c} notas del respaldo?', { a: j.clips.length, b: (j.combos || []).length, c: (j.notes || []).length }))) { await store.importAll(j); toast(t('Respaldo cargado')); }
    } catch (_) { alert(t('Ese archivo no es un respaldo válido.')); }
    e.target.value = '';
  };

  /* ----- conectar datos (al final, cuando todo está definido) ----- */
  store.start(d => {
    data = { clips: [], tax: [], combos: [], notes: [], ...d };
    if (first) { setView(location.hash.slice(1) || 'home', false); }
    render();
    if (first) { first = false; handleShare(); }
  });
}
