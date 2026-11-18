import { firebaseConfig } from './config.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DEF_ACTS = ['Ataque', 'Defensa', 'Escape', 'Barrida'];
const GI = { gi: 'Gi', nogi: 'No-gi', ambos: 'Gi / No-gi' };

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
const parseT = s => { if (!s) return 0; const p = String(s).trim().split(':').map(Number); return p.some(isNaN) ? 0 : p.reduce((a, b) => a * 60 + b, 0); };
const fmtT = n => { if (!n) return ''; const h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('show'), 1800); }

/* ---------- almacenamiento: local (sin nube) ---------- */
function localStore() {
  const K = 'bjj-videos-v2';
  let s = null;
  try { s = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  s = s || { clips: [], tax: [] };
  let cb = () => {};
  const emit = () => { try { localStorage.setItem(K, JSON.stringify(s)); } catch (e) {} cb(structuredClone(s)); };
  return {
    mode: 'local', user: { name: 'Modo local' },
    start(c) { cb = c; emit(); },
    async add(d) { s.clips.push({ id: crypto.randomUUID(), ...d }); emit(); },
    async update(id, p) { Object.assign(s.clips.find(x => x.id === id), p); emit(); },
    async del(id) { s.clips = s.clips.filter(x => x.id !== id); emit(); },
    async saveTax(t) { s.tax = t; emit(); },
    async importAll(j) { s = { clips: j.clips, tax: j.tax }; emit(); },
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
  const taxDoc = F.doc(db, base, 'meta', 'tax');
  const st = { clips: [], tax: [] };
  return {
    mode: 'cloud', user: { name: user.displayName || user.email, email: user.email }, login,
    logout: () => A.signOut(auth).then(() => location.reload()),
    start(cb) {
      F.onSnapshot(clipsCol, q => { st.clips = q.docs.map(d => ({ id: d.id, ...d.data() })); cb({ ...st }); });
      F.onSnapshot(taxDoc, d => { st.tax = d.exists() ? (d.data().positions || []) : []; cb({ ...st }); });
    },
    add: d => F.addDoc(clipsCol, d),
    update: (id, p) => F.updateDoc(F.doc(clipsCol, id), p),
    del: id => F.deleteDoc(F.doc(clipsCol, id)),
    saveTax: t => F.setDoc(taxDoc, { positions: t }),
    async importAll(j) {
      await F.setDoc(taxDoc, { positions: j.tax });
      for (let i = 0; i < j.clips.length; i += 400) {
        const b = F.writeBatch(db);
        for (const c of j.clips.slice(i, i + 400)) { const { id, ...d } = c; b.set(F.doc(clipsCol, id || crypto.randomUUID()), d); }
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
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
  init();
}

function init() {
  let data = { clips: [], tax: [] };
  let sel = { pos: null, act: null, tec: null };
  const flt = { gi: null, fav: false, prac: false };
  let editing = null, playing = null, first = true;

  /* ----- árbol ----- */
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

  /* ----- filtros y búsqueda ----- */
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
    const q = $('#q').value.trim().toLowerCase();
    return !q || [c.title, c.ytTitle, c.pos, c.act, c.tec, c.notes].join(' ').toLowerCase().includes(q);
  }

  /* ----- tarjetas ----- */
  function render() {
    renderTree();
    document.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b.dataset.f === 'gi' ? flt.gi === b.dataset.v : flt[b.dataset.f]));
    $('#crumb').textContent = [sel.pos || 'Todos los videos', sel.act, sel.tec].filter(Boolean).join(' → ');
    const vs = data.clips.filter(visible).sort((a, b) => (b.added || 0) - (a.added || 0));
    const ae = document.activeElement;
    if (ae && ae.dataset && ae.dataset.note) return; // no pisar lo que estás escribiendo
    $('#grid').innerHTML = vs.length ? vs.map(c => `
      <div class="card">
        <button class="th" data-play="${c.id}" aria-label="Ver video"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${c.yt}/mqdefault.jpg"><span class="pl">▶</span>${c.start ? `<span class="t">desde ${fmtT(c.start)}</span>` : ''}</button>
        <div class="cb">
          <b>${esc(c.title || c.ytTitle || 'Sin título')}</b>
          <div class="path">${esc([c.pos, c.act, c.tec].filter(Boolean).join(' → '))}<span class="badge">${GI[c.gi] || 'Gi'}</span></div>
          <textarea data-note="${c.id}" rows="2" placeholder="Notas…">${esc(c.notes)}</textarea>
          <div class="act">
            <button class="tg ${c.fav ? 'on' : ''}" data-tg="fav" data-id="${c.id}" title="Favorito">⭐</button>
            <button class="tg ${c.prac ? 'on' : ''}" data-tg="prac" data-id="${c.id}" title="Por practicar">🔁</button>
            <button data-clip="${c.id}" title="Guardar otra técnica del mismo video">+ Recorte</button>
            <button class="r" data-edit="${c.id}">Editar</button>
            <button data-del="${c.id}" title="Borrar">🗑</button>
          </div>
        </div>
      </div>`).join('')
      : `<div class="empty">${data.clips.length ? 'Nada coincide con esta búsqueda o filtro.' : 'Todavía no hay videos. Tocá “+ Agregar” o compartí un video desde YouTube.'}</div>`;
  }

  $('#grid').onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (d.play) play(d.play);
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

  /* ----- reproductor ----- */
  function play(id) {
    const c = data.clips.find(x => x.id === id); playing = id;
    $('#plc').innerHTML = `<iframe src="https://www.youtube.com/embed/${c.yt}?start=${c.start || 0}&autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    $('#plt').textContent = c.title || c.ytTitle || '';
    $('#plp').textContent = [c.pos, c.act, c.tec].filter(Boolean).join(' → ') + (c.start ? ' · empieza en ' + fmtT(c.start) : '');
    $('#pln').value = c.notes || ''; $('#plsaved').textContent = '';
    $('#yt').href = `https://www.youtube.com/watch?v=${c.yt}&t=${c.start || 0}s`;
    $('#pl').showModal();
  }
  $('#pln').onchange = async () => { await store.update(playing, { notes: $('#pln').value.trim() }); $('#plsaved').textContent = 'Nota guardada'; };
  $('#plx').onclick = () => $('#pl').close();
  $('#pl').onclose = () => { $('#plc').innerHTML = ''; playing = null; };

  /* ----- formulario agregar / editar ----- */
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
    $('#url').value = c ? `https://youtu.be/${c.yt}` : (url || '');
    $('#title').value = id ? c.title || '' : '';
    $('#yttitle').textContent = c?.ytTitle ? 'En YouTube: ' + c.ytTitle : '';
    $('#yttitle').dataset.v = c?.ytTitle || '';
    fillPos(id ? c.pos : (c?.pos || sel.pos));
    fillAct(id ? c.act : (c?.act || sel.act));
    $('#tec').value = id ? c.tec || '' : (from ? '' : sel.tec || '');
    $('#start').value = id ? fmtT(c.start) : (url ? fmtT(ytStart(url)) : '');
    $('#gi').value = c?.gi || flt.gi || 'gi';
    $('#fav').checked = id ? !!c.fav : false;
    $('#prac').checked = id ? !!c.prac : false;
    $('#notes').value = id ? c.notes || '' : '';
    $('#ed').showModal();
    if (url) fetchTitle();
    else if (!id && !from) $('#url').focus();
    else $('#title').focus();
  }
  async function fetchTitle() {
    const id = ytId($('#url').value); if (!id) return;
    const t = ytStart($('#url').value); if (t && !$('#start').value) $('#start').value = fmtT(t);
    try {
      const r = await fetch('https://noembed.com/embed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
      const j = await r.json();
      if (j.title) { $('#yttitle').textContent = 'En YouTube: ' + j.title; $('#yttitle').dataset.v = j.title; }
    } catch (e) {}
  }
  $('#url').onchange = fetchTitle;
  $('#add').onclick = () => openEd();
  $('#cx').onclick = () => $('#ed').close();

  $('#f').onsubmit = async e => {
    e.preventDefault();
    const yt = ytId($('#url').value);
    if (!yt) return alert('Ese link no parece de YouTube.');
    if (!$('#pos').value) return alert('Elegí o creá una posición (botón +).');
    const d = {
      yt, title: $('#title').value.trim(), ytTitle: $('#yttitle').dataset.v || '',
      pos: $('#pos').value, act: $('#act').value, tec: $('#tec').value.trim(),
      start: parseT($('#start').value), gi: $('#gi').value,
      fav: $('#fav').checked, prac: $('#prac').checked, notes: $('#notes').value.trim(),
    };
    $('#ed').close();
    try {
      if (editing) await store.update(editing, d);
      else await store.add({ ...d, added: Date.now() });
      toast('Guardado');
    } catch (err) { alert('No se pudo guardar: ' + err.message); }
  };

  /* ----- compartir desde YouTube (app instalada) ----- */
  function handleShare() {
    const p = new URLSearchParams(location.search);
    const txt = [p.get('url'), p.get('text'), p.get('title')].filter(Boolean).join(' ');
    if (!txt) return;
    history.replaceState(null, '', location.pathname);
    const m = txt.match(/https?:\/\/\S+/g) || [];
    const u = m.find(ytId);
    if (u) openEd({ url: u }); else toast('No encontré un link de YouTube en lo compartido');
  }

  /* ----- respaldo ----- */
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ clips: data.clips, tax: data.tax }, null, 1)], { type: 'application/json' }));
    a.download = 'bjj-respaldo-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
  };
  $('#imp').onclick = () => $('#file').click();
  $('#file').onchange = async e => {
    try {
      const j = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(j.clips) || !Array.isArray(j.tax)) throw 0;
      if (confirm(`Cargar ${j.clips.length} videos del respaldo? Se suman/reemplazan en tu biblioteca.`)) { await store.importAll(j); toast('Respaldo cargado'); }
    } catch (_) { alert('Ese archivo no es un respaldo válido.'); }
    e.target.value = '';
  };

  /* ----- conectar datos (al final, cuando todo está definido) ----- */
  store.start(d => {
    data = d;
    render();
    if (first) { first = false; handleShare(); }
  });
}
