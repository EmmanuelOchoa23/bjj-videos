import { firebaseConfig } from './config.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DEF_ACTS = ['Ataque', 'Defensa', 'Escape', 'Barrida'];
const GI = { gi: 'Gi', nogi: 'No-gi', ambos: 'Gi / No-gi' };
const uid = () => crypto.randomUUID().slice(0, 8);

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
/* Devuelve {yt,ig,start} a partir de un link, o null si no es de YouTube ni Instagram */
function parseVideo(u, startTxt) {
  const y = ytId(u); if (y) return { yt: y, ig: null, start: startTxt != null && startTxt !== '' ? parseT(startTxt) : ytStart(u) };
  const i = igId(u); if (i) return { yt: null, ig: i, start: 0 };
  return null;
}
const videoUrl = v => v.ig ? `https://www.instagram.com/p/${v.ig}/` : v.yt ? `https://youtu.be/${v.yt}` : '';
const hasVideo = v => !!(v.yt || v.ig);
const parseT = s => { if (!s) return 0; const p = String(s).trim().split(':').map(Number); return p.some(isNaN) ? 0 : p.reduce((a, b) => a * 60 + b, 0); };
const fmtT = n => { if (!n) return ''; const h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('show'), 1800); }

/* ---------- almacenamiento: local (sin nube) ---------- */
function localStore() {
  const K = 'bjj-videos-v2';
  let s = null;
  try { s = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  s = s || {};
  s.clips ||= []; s.tax ||= []; s.combos ||= [];
  let cb = () => {};
  const emit = () => { try { localStorage.setItem(K, JSON.stringify(s)); } catch (e) {} cb(structuredClone(s)); };
  return {
    mode: 'local', user: { name: 'Modo local' },
    start(c) { cb = c; emit(); },
    async add(d) { s.clips.push({ id: crypto.randomUUID(), ...d }); emit(); },
    async update(id, p) { Object.assign(s.clips.find(x => x.id === id), p); emit(); },
    async del(id) { s.clips = s.clips.filter(x => x.id !== id); emit(); },
    async saveTax(t) { s.tax = t; emit(); },
    async cadd(d) { const id = crypto.randomUUID(); s.combos.push({ id, ...d }); emit(); return id; },
    async cupdate(id, p) { Object.assign(s.combos.find(x => x.id === id), p); emit(); },
    async cdel(id) { s.combos = s.combos.filter(x => x.id !== id); emit(); },
    async importAll(j) { s = { clips: j.clips, tax: j.tax, combos: j.combos || [] }; emit(); },
  };
}

/* ---------- almacenamiento: Firebase (nube + login Google) ---------- */
async function firebaseStore() {
  const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js')]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
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
  if (!user) return { mode: 'cloud', user: null, login };
  const base = `users/${user.uid}`;
  const clipsCol = F.collection(db, base, 'clips');
  const combosCol = F.collection(db, base, 'combos');
  const taxDoc = F.doc(db, base, 'meta', 'tax');
  const st = { clips: [], tax: [], combos: [] };
  return {
    mode: 'cloud', user: { name: user.displayName || user.email, email: user.email }, login,
    logout: () => A.signOut(auth).then(() => location.reload()),
    start(cb) {
      F.onSnapshot(clipsCol, q => { st.clips = q.docs.map(d => ({ id: d.id, ...d.data() })); cb({ ...st }); });
      F.onSnapshot(combosCol, q => { st.combos = q.docs.map(d => ({ id: d.id, ...d.data() })); cb({ ...st }); });
      F.onSnapshot(taxDoc, d => { st.tax = d.exists() ? (d.data().positions || []) : []; cb({ ...st }); });
    },
    add: d => F.addDoc(clipsCol, d),
    update: (id, p) => F.updateDoc(F.doc(clipsCol, id), p),
    del: id => F.deleteDoc(F.doc(clipsCol, id)),
    saveTax: t => F.setDoc(taxDoc, { positions: t }),
    cadd: d => F.addDoc(combosCol, d).then(r => r.id),
    cupdate: (id, p) => F.updateDoc(F.doc(combosCol, id), p),
    cdel: id => F.deleteDoc(F.doc(combosCol, id)),
    async importAll(j) {
      await F.setDoc(taxDoc, { positions: j.tax });
      const all = [...j.clips.map(c => [clipsCol, c]), ...(j.combos || []).map(c => [combosCol, c])];
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
  alert('No se pudo conectar con la nube. Se usa el modo local.');
  store = localStore();
}

if (!store.user) {
  $('#login').hidden = false;
  $('#gbtn').onclick = () => store.login().catch(e => { $('#lerr').textContent = 'No se pudo entrar: ' + (e.code || e.message); });
} else {
  $('#app').hidden = false;
  $('#localwarn').hidden = store.mode !== 'local';
  $('#who').textContent = store.user.email || store.user.name;
  if (store.logout) { $('#out').hidden = false; $('#out').onclick = store.logout; }
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    // Busca una versión nueva cada vez que se abre la app; si la hay, recarga una vez.
    const hadSW = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadSW && !sessionStorage.getItem('bjj-reloaded')) { sessionStorage.setItem('bjj-reloaded', '1'); location.reload(); }
    });
  }
  init();
}

function init() {
  let data = { clips: [], tax: [], combos: [] };
  let sel = { pos: null, act: null, tec: null };
  const flt = { gi: null, fav: false, prac: false, train: false };
  const opened = new Set();
  let view = 'videos', comboId = null;
  let editing = null, first = true;

  /* =====================================================
     VISTAS (Videos / Combos)
     ===================================================== */
  function setView(v) {
    view = v;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    $('#vVideos').hidden = v !== 'videos';
    $('#vCombos').hidden = v !== 'combos';
    $('#q').hidden = v !== 'videos';
    $('#menu').style.visibility = v === 'videos' ? '' : 'hidden';
    $('#add').textContent = v === 'videos' ? '+ Agregar' : '+ Combo';
    if (v === 'combos') renderCombos();
  }
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setView(b.dataset.view));
  $('#add').onclick = () => view === 'videos' ? openEd() : openComboDlg();

  /* =====================================================
     ÁRBOL LATERAL (posición → acción → técnica)
     ===================================================== */
  const count = f => data.clips.filter(f).length;
  function techs(p, a) { return [...new Set(data.clips.filter(c => c.pos === p && c.act === a && c.tec).map(c => c.tec))].sort((x, y) => x.localeCompare(y)); }
  function renderTree() {
    let h = `<div class="n ${!sel.pos ? 'on' : ''}" data-k="all"><span>Todos</span><span class="c">${data.clips.length}</span></div>`;
    if (!data.tax.length) h += `<div class="hint">Todavía no hay posiciones. Creá la primera abajo o al agregar un video.</div>`;
    data.tax.forEach((P, i) => {
      h += `<div class="n ${sel.pos === P.name && !sel.act ? 'on' : ''}" data-p="${i}"><span>${esc(P.name)}</span><span class="c">${count(c => c.pos === P.name)}</span></div>`;
      if (sel.pos !== P.name) return;
      P.acts.forEach((a, j) => {
        h += `<div class="n l2 ${sel.act === a && !sel.tec ? 'on' : ''}" data-p="${i}" data-a="${j}"><span>${esc(a)}</span><span class="c">${count(c => c.pos === P.name && c.act === a)}</span></div>`;
        if (sel.act !== a) return;
        techs(P.name, a).forEach(t => {
          h += `<div class="n l3 ${sel.tec === t ? 'on' : ''}" data-p="${i}" data-a="${j}" data-t="${esc(t)}"><span>${esc(t)}</span><span class="c">${count(c => c.pos === P.name && c.act === a && c.tec === t)}</span></div>`;
        });
      });
      h += `<div class="n l2 addact" data-addact="${i}"><span>+ acción</span></div>`;
    });
    $('#tree').innerHTML = h;
  }
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
    const n = (prompt('Nombre de la nueva posición (ej: Guardia cerrada):') || '').trim();
    if (!n) return null;
    if (data.tax.some(p => p.name.toLowerCase() === n.toLowerCase())) { toast('Esa posición ya existe'); return n; }
    await store.saveTax([...data.tax, { name: n, acts: [...DEF_ACTS] }]);
    toast('Posición creada');
    return n;
  }
  async function newAct(pos) {
    const n = (prompt(`Nueva acción para "${pos}" (ej: Pasaje):`) || '').trim();
    if (!n) return null;
    const tax = data.tax.map(p => p.name === pos && !p.acts.includes(n) ? { ...p, acts: [...p.acts, n] } : p);
    await store.saveTax(tax);
    return n;
  }
  $('#newposside').onclick = newPos;

  /* =====================================================
     LISTA DE VIDEOS (compacta, se abre al tocar)
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
        <span class="hx"><span class="tt">${esc(c.title || c.ytTitle || 'Sin título')}</span><span class="path">${esc(path)}</span></span>
        <span class="mk">${c.fav ? '⭐' : ''}${c.prac ? '🔁' : ''}${c.train ? '🥋' : ''}</span><span class="chev">▸</span>
      </button>
      ${open ? `<div class="body">
        ${c.ig
          ? `<button class="th ig" data-play="${c.id}" aria-label="Ver video de Instagram"><span class="igl">Instagram</span><span class="pl">▶</span></button>`
          : `<button class="th" data-play="${c.id}" aria-label="Ver video"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${c.yt}/mqdefault.jpg"><span class="pl">▶</span>${c.start ? `<span class="t">desde ${fmtT(c.start)}</span>` : ''}</button>`}
        <div><span class="badge">${GI[c.gi] || 'Gi'}</span>${c.ig ? ' <span class="badge">Instagram</span>' : ''}</div>
        <textarea data-note="${c.id}" rows="2" placeholder="Notas…">${esc(c.notes)}</textarea>
        <div class="act">
          <button class="tg ${c.fav ? 'on' : ''}" data-tg="fav" data-id="${c.id}" title="Favorito">⭐</button>
          <button class="tg ${c.prac ? 'on' : ''}" data-tg="prac" data-id="${c.id}" title="Por practicar">🔁</button>
          <button class="tg ${c.train ? 'on' : ''}" data-tg="train" data-id="${c.id}" title="Entrenando">🥋</button>
          <button data-clip="${c.id}" title="Guardar otra técnica del mismo video">+ Recorte</button>
          <button class="r" data-edit="${c.id}">Editar</button>
          <button data-del="${c.id}" title="Borrar">🗑</button>
        </div>
      </div>` : ''}
    </div>`;
  }

  function render() {
    renderTree();
    document.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b.dataset.f === 'gi' ? flt.gi === b.dataset.v : flt[b.dataset.f]));
    $('#crumb').textContent = [sel.pos || 'Todos los videos', sel.act, sel.tec].filter(Boolean).join(' → ');
    if (view === 'combos') renderCombos();
    const ae = document.activeElement;
    if (ae && ae.dataset && ae.dataset.note) return; // no pisar lo que estás escribiendo
    // Orden: 🥋 Entrenando → 🔁 Por practicar → ⭐ Favoritos → el resto; dentro de cada grupo, los más nuevos primero
    const rank = c => c.train ? 0 : c.prac ? 1 : c.fav ? 2 : 3;
    const vs = data.clips.filter(visible).sort((a, b) => rank(a) - rank(b) || (b.added || 0) - (a.added || 0));
    $('#grid').innerHTML = vs.length ? vs.map(itemHTML).join('')
      : `<div class="empty">${data.clips.length ? 'Nada coincide con esta búsqueda o filtro.' : 'Todavía no hay videos. Tocá “+ Agregar” o compartí un video desde YouTube.'}</div>`;
  }

  $('#grid').onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (d.open) { opened.has(d.open) ? opened.delete(d.open) : opened.add(d.open); render(); }
    else if (d.play) { const c = data.clips.find(x => x.id === d.play); playClip(c); }
    else if (d.edit) openEd({ id: d.edit });
    else if (d.clip) openEd({ from: d.clip });
    else if (d.tg) { const c = data.clips.find(x => x.id === d.id); await store.update(d.id, { [d.tg]: !c[d.tg] }); }
    else if (d.del && confirm('¿Borrar este video de tu biblioteca? (No se borra de YouTube)')) { await store.del(d.del); toast('Borrado'); }
  };
  $('#grid').addEventListener('change', async e => {
    const id = e.target.dataset.note; if (!id) return;
    await store.update(id, { notes: e.target.value.trim() });
    toast('Nota guardada');
  });
  $('#grid').addEventListener('focusout', e => { if (e.target.dataset.note) setTimeout(render, 0); });

  /* =====================================================
     REPRODUCTOR (sirve para videos y para cuadritos de combos)
     ===================================================== */
  let onNoteSave = null;
  function play({ yt, ig, start, title, path, notes, label, save }) {
    if (ig) {
      $('#plc').innerHTML = `<iframe class="ig" src="https://www.instagram.com/p/${ig}/embed/" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen scrolling="no"></iframe>`;
      $('#yt').href = `https://www.instagram.com/p/${ig}/`;
      $('#yt').textContent = 'Abrir en Instagram ↗';
    } else {
      $('#plc').innerHTML = `<iframe src="https://www.youtube.com/embed/${yt}?start=${start || 0}&autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
      $('#yt').href = `https://www.youtube.com/watch?v=${yt}&t=${start || 0}s`;
      $('#yt').textContent = 'Abrir en YouTube ↗';
    }
    $('#plt').textContent = title || '';
    $('#plp').textContent = (path || '') + (start && !ig ? ' · empieza en ' + fmtT(start) : '');
    $('#plnl').textContent = label || 'Notas';
    $('#pln').value = notes || ''; $('#plsaved').textContent = '';
    onNoteSave = save;
    $('#pl').showModal();
  }
  const playClip = c => play({
    yt: c.yt, ig: c.ig, start: c.start, title: c.title || c.ytTitle, notes: c.notes,
    path: [c.pos, c.act, c.tec].filter(Boolean).join(' → '),
    save: v => store.update(c.id, { notes: v }),
  });
  $('#pln').onchange = async () => { if (onNoteSave) { await onNoteSave($('#pln').value.trim()); $('#plsaved').textContent = 'Guardado'; } };
  $('#plx').onclick = () => $('#pl').close();
  $('#pl').onclose = () => { $('#plc').innerHTML = ''; onNoteSave = null; };

  /* =====================================================
     FORMULARIO AGREGAR / EDITAR VIDEO
     ===================================================== */
  function fillPos(p) {
    $('#pos').innerHTML = data.tax.length ? data.tax.map(x => `<option>${esc(x.name)}</option>`).join('') : '<option value="">— creá una posición con + —</option>';
    if (p && data.tax.some(x => x.name === p)) $('#pos').value = p;
    fillAct();
  }
  function fillAct(a) {
    const P = data.tax.find(x => x.name === $('#pos').value);
    $('#act').innerHTML = P ? P.acts.map(x => `<option>${esc(x)}</option>`).join('') : '';
    if (a && P && P.acts.includes(a)) $('#act').value = a;
    $('#tecs').innerHTML = techs($('#pos').value, $('#act').value).map(t => `<option value="${esc(t)}">`).join('');
  }
  $('#pos').onchange = () => fillAct();
  $('#act').onchange = () => fillAct($('#act').value);
  $('#newpos').onclick = async () => { const n = await newPos(); if (n) fillPos(n); };
  $('#newact').onclick = async () => { if (!$('#pos').value) return toast('Primero creá una posición'); const n = await newAct($('#pos').value); if (n) fillAct(n); };

  function openEd({ id, from, url } = {}) {
    editing = id || null;
    const c = data.clips.find(x => x.id === (id || from));
    $('#edt').textContent = id ? 'Editar video' : from ? 'Nuevo recorte del mismo video' : 'Agregar video';
    $('#url').value = c ? videoUrl(c) : (url || '');
    $('#title').value = id ? c.title || '' : '';
    $('#yttitle').textContent = c?.ytTitle ? 'En YouTube: ' + c.ytTitle : '';
    $('#yttitle').dataset.v = c?.ytTitle || '';
    fillPos(id ? c.pos : (c?.pos || sel.pos));
    fillAct(id ? c.act : (c?.act || sel.act));
    $('#tec').value = id ? c.tec || '' : (from ? '' : sel.tec || '');
    $('#start').value = id ? fmtT(c.start) : (url ? fmtT(ytStart(url)) : '');
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
    $('#start').disabled = ig;
    if (ig) $('#start').value = '';
    $('#start').placeholder = ig ? 'No disponible en Instagram' : 'Ej: 3:25';
  }
  async function fetchTitle() {
    syncStart();
    const id = ytId($('#url').value); if (!id) return;
    const t = ytStart($('#url').value); if (t && !$('#start').value) $('#start').value = fmtT(t);
    try {
      const r = await fetch('https://noembed.com/embed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
      const j = await r.json();
      if (j.title) { $('#yttitle').textContent = 'En YouTube: ' + j.title; $('#yttitle').dataset.v = j.title; }
    } catch (e) {}
  }
  $('#url').onchange = fetchTitle;
  $('#cx').onclick = () => $('#ed').close();

  $('#f').onsubmit = async e => {
    e.preventDefault();
    const v = parseVideo($('#url').value, $('#start').value);
    if (!v) return alert('Ese link no parece de YouTube ni de Instagram.');
    if (!$('#pos').value) return alert('Elegí o creá una posición (botón +).');
    if (v.ig && !$('#title').value.trim()) return alert('Los videos de Instagram no traen título: escribí uno.');
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
      toast('Guardado');
    } catch (err) { alert('No se pudo guardar: ' + err.message); }
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
          <span class="mut small">Desde ${esc(c.pos)} · ${Math.max(0, (c.nodes || []).length - 1)} técnicas</span></button>`).join('')
        : '<div class="empty">Todavía no hay combos. Tocá “+ Combo” para crear el primero.</div>';
      return;
    }
    $('#cname').textContent = c.name;
    $('#cinfo').textContent = `Desde ${c.pos} · ${c.nodes.length - 1} técnicas`;
    drawDiagram(c);
  }
  $('#clist').onclick = e => { const b = e.target.closest('[data-combo]'); if (b) { comboId = b.dataset.combo; renderCombos(); } };
  $('#cback').onclick = () => { comboId = null; renderCombos(); };

  /* --- crear / renombrar combo --- */
  let renaming = false;
  function openComboDlg(ren = false) {
    renaming = ren;
    const c = ren && combo();
    $('#cdt').textContent = ren ? 'Renombrar combo' : 'Nuevo combo';
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
    if (!confirm(`¿Borrar el combo "${c.name}" con todas sus técnicas?`)) return;
    await store.cdel(c.id); comboId = null; toast('Combo borrado'); renderCombos();
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
        if (n.via) labels += `<div class="via" style="left:${x2}px;top:${my + 6}px">${esc(n.via)}</div>`;
      }
      boxes += `<div class="node ${root ? 'root' : ''}" style="left:${x}px;top:${y}px">
        <div class="nm" title="${esc(n.name)}">${esc(n.name)}</div>
        <div class="nb">
          <button data-nd="desc" data-n="${n.id}" class="${n.desc ? '' : 'off'}" title="Descripción">📝</button>
          ${hasVideo(n) ? `<button data-nd="play" data-n="${n.id}" title="Ver video">▶</button>` : ''}
          <button data-nd="edit" data-n="${n.id}" title="Editar">✎</button>
          <button data-nd="add" data-n="${n.id}" title="Agregar técnica que sigue">＋</button>
        </div></div>`;
    }
    $('#diagram').innerHTML = `<div class="canvas" style="width:${W}px;height:${H}px">
      <svg width="${W}" height="${H}">${paths}</svg>${labels}${boxes}</div>`;
  }

  $('#diagram').onclick = e => {
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
    $('#ndt').textContent = node ? (root ? 'Posición de inicio' : 'Editar técnica') : 'Nueva técnica';
    $('#ndfrom').textContent = par ? 'Viene de: ' + par.name : '';
    $('#ndviaw').hidden = root;
    $('#ndvia').value = node?.via || '';
    $('#ndname').value = node?.name || '';
    $('#nddesc').value = node?.desc || '';
    $('#ndclip').innerHTML = '<option value="">— ninguno —</option>' + [...data.clips]
      .sort((a, b) => (a.title || a.ytTitle || '').localeCompare(b.title || b.ytTitle || ''))
      .map(c => `<option value="${c.id}">${esc(c.title || c.ytTitle || 'Sin título')}${c.tec ? ' · ' + esc(c.tec) : ''}</option>`).join('');
    $('#ndurl').value = node ? videoUrl(node) : '';
    $('#ndstart').value = node?.start ? fmtT(node.start) : '';
    $('#ndvid').open = !!node && hasVideo(node);
    $('#ndel').hidden = !node || root;
    $('#nd').showModal();
    (focusDesc ? $('#nddesc') : node ? $('#ndname') : ($('#ndvia').closest('[hidden]') ? $('#ndname') : $('#ndvia'))).focus();
  }
  $('#ndclip').onchange = () => {
    const c = data.clips.find(x => x.id === $('#ndclip').value); if (!c) return;
    $('#ndurl').value = videoUrl(c);
    $('#ndstart').value = c.ig ? '' : fmtT(c.start);
    if (!$('#ndname').value) $('#ndname').value = c.tec || c.title || c.ytTitle || '';
  };
  $('#ndurl').onchange = () => { const t = ytStart($('#ndurl').value); if (t && !$('#ndstart').value) $('#ndstart').value = fmtT(t); };
  $('#ndcx').onclick = () => $('#nd').close();
  $('#nform').onsubmit = async e => {
    e.preventDefault();
    const name = $('#ndname').value.trim(); if (!name) return;
    const url = $('#ndurl').value.trim(), v = url ? parseVideo(url, $('#ndstart').value) : { yt: null, ig: null, start: 0 };
    if (!v) return alert('Ese link no parece de YouTube ni de Instagram.');
    const d = { name, via: $('#ndvia').value.trim(), desc: $('#nddesc').value.trim(), ...v };
    const c = combo();
    let nodes;
    if (nodeCtx.node) nodes = c.nodes.map(n => n.id === nodeCtx.node.id ? { ...n, ...d } : n);
    else nodes = [...c.nodes, { id: uid(), parent: nodeCtx.parent.id, ...d }];
    $('#nd').close();
    await store.cupdate(c.id, { nodes });
    toast('Guardado');
  };
  $('#ndel').onclick = async () => {
    const c = combo(), id = nodeCtx.node.id;
    const gone = new Set([id]);
    let grew = true;
    while (grew) { grew = false; for (const n of c.nodes) if (!gone.has(n.id) && gone.has(n.parent)) { gone.add(n.id); grew = true; } }
    const extra = gone.size - 1;
    if (!confirm(`¿Borrar "${nodeCtx.node.name}"${extra ? ` y las ${extra} técnicas que salen de ella` : ''}?`)) return;
    $('#nd').close();
    await store.cupdate(c.id, { nodes: c.nodes.filter(n => !gone.has(n.id)) });
  };

  /* =====================================================
     COMPARTIR DESDE YOUTUBE (app instalada)
     ===================================================== */
  function handleShare() {
    const p = new URLSearchParams(location.search);
    const txt = [p.get('url'), p.get('text'), p.get('title')].filter(Boolean).join(' ');
    if (!txt) return;
    history.replaceState(null, '', location.pathname);
    const m = txt.match(/https?:\/\/\S+/g) || [];
    const u = m.find(x => ytId(x) || igId(x));
    if (u) openEd({ url: u }); else toast('No encontré un link de YouTube o Instagram en lo compartido');
  }

  /* =====================================================
     RESPALDO
     ===================================================== */
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ clips: data.clips, tax: data.tax, combos: data.combos }, null, 1)], { type: 'application/json' }));
    a.download = 'bjj-respaldo-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
  };
  $('#imp').onclick = () => $('#file').click();
  $('#file').onchange = async e => {
    try {
      const j = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(j.clips) || !Array.isArray(j.tax)) throw 0;
      if (confirm(`¿Cargar ${j.clips.length} videos y ${(j.combos || []).length} combos del respaldo?`)) { await store.importAll(j); toast('Respaldo cargado'); }
    } catch (_) { alert('Ese archivo no es un respaldo válido.'); }
    e.target.value = '';
  };

  /* ----- conectar datos (al final, cuando todo está definido) ----- */
  store.start(d => {
    data = { clips: [], tax: [], combos: [], ...d };
    render();
    if (first) { first = false; handleShare(); }
  });
}
