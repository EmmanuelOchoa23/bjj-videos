// Idiomas: español (por defecto) e inglés.
// Los textos se escriben en español en el código; acá está su traducción al inglés.
// Los datos del usuario (posiciones, técnicas, notas) NO se traducen.
const KEY = 'bjj-lang';
export const lang = (() => { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'es'; } catch (e) { return 'es'; } })();
export const locale = lang === 'en' ? 'en' : 'es';
export function setLang(l) { try { localStorage.setItem(KEY, l); } catch (e) {} location.reload(); }

const EN = {
  // --- General / navegación ---
  'Inicio': 'Home', 'Técnicas': 'Techniques', 'Combos': 'Combos', 'Notas': 'Notes',
  '+ Técnica': '+ Technique', '+ Combo': '+ Combo', '+ Nota': '+ Note',
  'Descargar respaldo': 'Download backup', 'Cargar respaldo': 'Restore backup', 'Cerrar sesión': 'Sign out',
  'Modo local: los datos se guardan solo en este navegador.': 'Local mode: data is only saved in this browser.',
  'Modo local': 'Local mode',
  'Todo lo que aprendés en el tatami, en un solo lugar.': 'Everything you learn on the mats, in one place.',
  'Cancelar': 'Cancel', 'Guardar': 'Save', 'Borrar': 'Delete', 'Cerrar': 'Close', 'Editar': 'Edit', '✎ Editar': '✎ Edit',
  'Guardado': 'Saved', 'Borrado': 'Deleted',
  'Idioma': 'Language', 'Más opciones': 'More options', 'Ver posiciones': 'Show positions',

  // --- Login ---
  'Entrar con Google': 'Sign in with Google', 'o con tu email': 'or with your email',
  'Contraseña': 'Password', 'Repetí la contraseña': 'Repeat password', 'Entrar': 'Sign in', 'Crear cuenta': 'Create account',
  '¿No tenés cuenta? Crear una': "Don't have an account? Create one", '¿Ya tenés cuenta? Entrar': 'Already have an account? Sign in',
  '¿Olvidaste tu contraseña?': 'Forgot your password?',
  'Las contraseñas no coinciden.': "Passwords don't match.",
  'Escribí tu email arriba y volvé a tocar "¿Olvidaste tu contraseña?".': 'Type your email above and tap "Forgot your password?" again.',
  'Si hay una cuenta con ese email, te llegó un correo para crear una contraseña nueva (mirá también en spam).': 'If there is an account with that email, we sent you a message to create a new password (check your spam folder too).',
  'Email o contraseña incorrectos. Si siempre entraste con Google, usá el botón de Google.': 'Wrong email or password. If you always signed in with Google, use the Google button.',
  'Email o contraseña incorrectos.': 'Wrong email or password.',
  'Ese email no es válido.': "That email isn't valid.",
  'Ya hay una cuenta con ese email. Tocá "Entrar" (o "Entrar con Google" si es tu Gmail).': 'There is already an account with that email. Tap "Sign in" (or "Sign in with Google" if it is your Gmail).',
  'La contraseña tiene que tener al menos 6 caracteres.': 'Password must be at least 6 characters.',
  'Demasiados intentos. Esperá unos minutos y probá de nuevo.': 'Too many attempts. Wait a few minutes and try again.',
  'El acceso con email todavía no está activado en Firebase.': 'Email sign-in is not enabled in Firebase yet.',
  'Sin conexión a internet.': 'No internet connection.',
  'Se cerró la ventana de Google antes de terminar.': 'The Google window was closed before finishing.',
  'Ese email ya tiene cuenta con otro método. Entrá con email y contraseña.': 'That email already has an account with another method. Sign in with email and password.',
  'No se pudo entrar ({e}).': 'Could not sign in ({e}).',
  'No se pudo conectar con la nube. Se usa el modo local.': 'Could not connect to the cloud. Using local mode.',

  // --- Inicio ---
  '{n} técnica guardada': '{n} saved technique', '{n} técnicas guardadas': '{n} saved techniques', ' · {n} entrenando': ' · {n} training',
  '{n} combo': '{n} combo', '{n} combos': '{n} combos', 'Armá cadenas de técnicas en árbol': 'Build technique chains as a tree',
  '{n} nota': '{n} note', '{n} notas': '{n} notes', '{n} recordatorio': '{n} reminder', '{n} recordatorios': '{n} reminders',
  'Diario de entrenamiento y recordatorios': 'Training journal and reminders',
  'Hoy': 'Today', 'Próximo · {d}': 'Next · {d}',

  // --- Técnicas ---
  'Buscar técnica, posición, nota…': 'Search technique, position, note…',
  '+ Nueva posición': '+ New position', 'Todos': 'All', 'Todas': 'All', 'Por posición': 'By position',
  'Posición': 'Position', 'Acción': 'Action', 'Técnica': 'Technique', '＋ Posición': '＋ Position', '＋ Acción': '＋ Action', '+ acción': '+ action',
  'Filtrar': 'Filter', 'Todas las técnicas': 'All techniques',
  '🥋 Entrenando': '🥋 Training', '🔁 Por practicar': '🔁 To practice', '⭐ Favoritos': '⭐ Favorites',
  'Entrenando': 'Training', 'Por practicar': 'To practice', 'Favorito': 'Favorite', '⭐ Favorito': '⭐ Favorite',
  'Todavía no hay posiciones. Creá la primera abajo o al agregar un video.': 'No positions yet. Create the first one below or when adding a video.',
  'Nombre de la nueva posición (ej: Guardia cerrada):': 'Name of the new position (e.g. Closed guard):',
  'Nueva acción para "{p}" (ej: Pasaje):': 'New action for "{p}" (e.g. Pass):',
  'Esa posición ya existe': 'That position already exists', 'Posición creada': 'Position created',
  'Sin título': 'Untitled', 'Ver video': 'Watch video', 'Ver video de Instagram': 'Watch Instagram video', 'desde {t}': 'from {t}',
  'Notas…': 'Notes…', '+ Recorte': '+ Clip', 'Guardar otra técnica del mismo video': 'Save another technique from the same video',
  'Nada coincide con esta búsqueda o filtro.': 'Nothing matches this search or filter.',
  'Todavía no hay técnicas. Tocá “+ Técnica” o compartí un video desde YouTube o Instagram.': 'No techniques yet. Tap “+ Technique” or share a video from YouTube or Instagram.',
  '¿Borrar este video de tu biblioteca? (No se borra de YouTube)': 'Delete this video from your library? (It is not deleted from YouTube)',
  'Nota guardada': 'Note saved',

  // --- Formulario técnica ---
  'Agregar técnica': 'Add technique', 'Editar técnica': 'Edit technique', 'Nuevo recorte del mismo video': 'New clip from the same video',
  'Link de YouTube o Instagram': 'YouTube or Instagram link',
  'https://youtu.be/... o https://instagram.com/reel/...': 'https://youtu.be/... or https://instagram.com/reel/...',
  'Tu título': 'Your title', 'Ej: Triángulo desde guardia cerrada – detalle de la cadera': 'E.g. Triangle from closed guard – hip detail',
  'Ej: Triángulo': 'E.g. Triangle', 'Empieza en (min:seg)': 'Starts at (min:sec)', 'Ej: 3:25': 'E.g. 3:25', 'Ej: 1:30': 'E.g. 1:30',
  'Modalidad': 'Style', 'Ambos': 'Both', 'Nueva posición': 'New position', 'Nueva acción': 'New action',
  'Detalles, errores comunes, tips…': 'Details, common mistakes, tips…',
  '— creá una posición con + —': '— create a position with + —',
  'En YouTube: {t}': 'On YouTube: {t}', 'No disponible en Instagram': 'Not available on Instagram',
  'Primero creá una posición': 'Create a position first',
  'Ese link no parece de YouTube ni de Instagram.': "That link doesn't look like YouTube or Instagram.",
  'Elegí o creá una posición (botón +).': 'Pick or create a position (+ button).',
  'Los videos de Instagram no traen título: escribí uno.': "Instagram videos don't include a title: type one.",
  'No se pudo guardar: {e}': 'Could not save: {e}',
  'No encontré un link de YouTube o Instagram en lo compartido': "I couldn't find a YouTube or Instagram link in what you shared",

  // --- Reproductor ---
  'Abrir en YouTube ↗': 'Open on YouTube ↗', 'Abrir en Instagram ↗': 'Open on Instagram ↗',
  ' · empieza en {t}': ' · starts at {t}', 'Descripción': 'Description', 'Escribí tus notas…': 'Write your notes…',

  // --- Combos ---
  '← Combos': '← Combos', 'Renombrar': 'Rename', 'Borrar combo': 'Delete combo',
  'Tocá': 'Tap', 'en un cuadrito para agregar la técnica que sigue.': 'on a box to add the next technique.',
  'descripción ·': 'description ·', 'video ·': 'video ·', 'editar.': 'edit.',
  'Desde {p} · {n} técnicas': 'From {p} · {n} techniques',
  'Todavía no hay combos. Tocá “+ Combo” para crear el primero.': 'No combos yet. Tap “+ Combo” to create the first one.',
  'Nuevo combo': 'New combo', 'Renombrar combo': 'Rename combo', 'Nombre del combo': 'Combo name',
  'Ej: Combo de raspados': 'E.g. Sweep combo', 'Posición de inicio': 'Starting position', 'Ej: Guardia cerrada': 'E.g. Closed guard',
  '¿Borrar el combo "{n}" con todas sus técnicas?': 'Delete the combo "{n}" with all its techniques?', 'Combo borrado': 'Combo deleted',
  'Ver video': 'Watch video', 'Agregar técnica que sigue': 'Add next technique',
  'Nueva técnica': 'New technique', 'Viene de: {n}': 'Comes from: {n}',
  'Cuándo se usa (texto de la flecha, opcional)': 'When to use it (arrow text, optional)', 'Ej: si defiende con el brazo': 'E.g. if he defends with the arm',
  'Nombre de la técnica': 'Technique name', 'Ej: Hip bump': 'E.g. Hip bump', 'Descripción (con tus palabras)': 'Description (in your own words)',
  'Cómo se hace, detalles, errores comunes…': 'How to do it, details, common mistakes…',
  '🎬 Video (opcional)': '🎬 Video (optional)', 'Elegir de mis técnicas': 'Pick from my techniques',
  '…o pegar un link de YouTube o Instagram': '…or paste a YouTube or Instagram link', '— ninguno —': '— none —',
  '¿Borrar "{n}"?': 'Delete "{n}"?', '¿Borrar "{n}" y las {k} técnicas que salen de ella?': 'Delete "{n}" and the {k} techniques that come from it?',

  // --- Notas ---
  'Nueva nota': 'New note', 'Editar nota': 'Edit note', 'Fecha': 'Date', 'Nota': 'Note', 'Mañana': 'Tomorrow', 'Ayer': 'Yesterday',
  'Qué entrenaste, qué salió, qué no… o qué querés practicar ese día.': 'What you trained, what worked, what didn’t… or what you want to practice that day.',
  'Próximos entrenamientos': 'Upcoming sessions', 'Diario de entrenamiento': 'Training journal', 'Recordatorio': 'Reminder',
  'En {n} días': 'In {n} days',
  '📅 Recordatorio para un entrenamiento futuro': '📅 Reminder for a future session', '🥋 Nota de hoy': "🥋 Today's note", '📓 Nota de un entrenamiento pasado': '📓 Note from a past session',
  'Todavía no hay notas.': 'No notes yet.', 'Después de entrenar, anotá qué hiciste.': 'After training, write down what you did.',
  'O dejate un recordatorio para el próximo entrenamiento.': 'Or leave yourself a reminder for the next session.',
  '+ Nueva nota': '+ New note', '¿Borrar esta nota?': 'Delete this note?', 'Nota borrada': 'Note deleted',
  'Tipo de nota': 'Note type', 'Entrenado': 'Trained', 'Próximo entrenamiento': 'Next session', 'Nota fija': 'Pinned note',
  'Notas fijas': 'Pinned notes', 'Fija': 'Pinned',
  '🥋 Lo que entrenaste ese día.': '🥋 What you trained that day.',
  '📅 Un recordatorio para un entrenamiento que viene. Elegí el día.': '📅 A reminder for an upcoming session. Pick the day.',
  '📌 Siempre visible, sin fecha. Ideal para cosas que querés tener presentes.': '📌 Always visible, no date. Great for things you want to keep in mind.',
  'Qué entrenaste, qué salió, qué no…': 'What you trained, what worked, what didn’t…',
  'Qué querés practicar ese día…': 'What you want to practice that day…',
  'Ej: Siempre cerrar las rodillas en el triángulo.': 'E.g. Always squeeze the knees in the triangle.',

  // --- Respaldo ---
  '¿Cargar {a} técnicas, {b} combos y {c} notas del respaldo?': 'Load {a} techniques, {b} combos and {c} notes from the backup?',
  'Respaldo cargado': 'Backup restored', 'Ese archivo no es un respaldo válido.': "That file isn't a valid backup.",
};

/* Traduce un texto (con variables opcionales {x}) */
export function t(s, vars) {
  let r = (lang === 'en' && EN[s]) || s;
  if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
  return r;
}

/* Traduce los textos fijos del HTML (textos, placeholders, títulos) */
export function translateDOM(root = document.body) {
  document.documentElement.lang = lang;
  if (lang === 'es') return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) {
    const k = n.nodeValue.trim();
    if (k && EN[k]) n.nodeValue = n.nodeValue.replace(k, EN[k]);
  }
  for (const a of ['placeholder', 'title', 'aria-label', 'data-label']) {
    root.querySelectorAll(`[${a}]`).forEach(el => { const v = el.getAttribute(a); if (EN[v]) el.setAttribute(a, EN[v]); });
  }
}
