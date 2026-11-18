# BJJ Videos – guía

## Qué hay en esta carpeta
| Archivo | Para qué sirve |
|---|---|
| `index.html`, `style.css`, `app.js` | La app en sí |
| `config.js` | Datos de conexión a Firebase (la nube) |
| `manifest.json`, `sw.js`, `icon-*.png` | Para instalarla en el celular y que aparezca en "Compartir" de YouTube |
| `firestore.rules` | Reglas de seguridad: cada uno ve solo sus videos |

## Paso 1 – Crear la nube en Firebase (gratis, ~10 min)
1. Entrá a https://console.firebase.google.com con tu cuenta de Google.
2. **Crear proyecto** → nombre: `bjj-videos` → podés desactivar Google Analytics → Crear.
3. En el proyecto: ícono **`</>`** (Web) → apodo `bjj-videos` → **Registrar app**
   (NO marques "Firebase Hosting"). Te muestra un bloque `const firebaseConfig = { ... }`.
   **Copiá ese bloque y pasámelo** (no es secreto, es normal que sea público).
4. Menú izquierdo → **Compilación → Authentication** → Comenzar → **Google** → Habilitar → elegí tu email de soporte → Guardar.
5. Menú izquierdo → **Compilación → Firestore Database** → Crear base de datos → ubicación cercana (ej. `southamerica-east1`) → **modo de producción** → Crear.
6. En Firestore → pestaña **Reglas** → pegá el contenido de `firestore.rules` → Publicar.

## Paso 2 – Publicarla en internet (GitHub Pages)
Lo hago yo con tu permiso: creo un repositorio en tu GitHub, subo los archivos y activo GitHub Pages.
Queda en una dirección como `https://TU-USUARIO.github.io/bjj-videos/`.

Después, en Firebase → Authentication → **Configuración → Dominios autorizados** → agregar `TU-USUARIO.github.io`.

## Paso 3 – Instalarla en el celular (Android)
1. Abrí el link en Chrome → menú ⋮ → **Instalar app** / **Agregar a pantalla principal**.
2. En YouTube: **Compartir** → elegí **BJJ Videos** → se abre el formulario con el link y el minuto.

> En iPhone se puede instalar (Safari → Compartir → "Agregar a inicio"), pero iOS no deja que aparezca en el menú Compartir de YouTube: ahí hay que copiar y pegar el link.

## Cómo se usa
- **Posiciones**: empezás de cero. "+ Nueva posición" en la barra lateral (o el `+` en el formulario).
  Cada posición nueva trae Ataque / Defensa / Escape / Barrida, y podés sumar más acciones con "+ acción".
- **Técnica**: escribila al guardar el video; las que ya usaste aparecen como sugerencia.
- **Empieza en**: si el link de YouTube trae el minuto (`&t=85s`) se completa solo; si no, escribilo (ej. `3:25`).
- **+ Recorte**: guarda otra técnica del mismo video, con otro minuto.
- **Notas**: se editan directo debajo de cada video o mientras lo mirás.
- **⭐ / 🔁**: favorito y por practicar. Filtros arriba: Gi, No-gi, ⭐, 🔁.
- **⋯ → Descargar respaldo**: guarda una copia de todo en un archivo.
