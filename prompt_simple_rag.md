# PROMPT ULTRA SIMPLE — local-chat (Vanilla JS + wllama + RAG básico)

## Objetivo
Genera una app (solo HTML/CSS/JS) llamada **local-chat** que:

- Corre un **LLM en el navegador** usando **wllama** y un modelo **GGUF**: `LFM2-350M.Q4_K_M.gguf`.
- Hace **RAG 100% en el navegador** sobre **1 archivo JSON** (epicrisis) que el usuario sube.
- Usa **embeddings locales** con **Transformers.js** (WebGPU si existe) y el modelo:
  - `intfloat/multilingual-e5-small` (384 dims)
  - prefijos obligatorios: `query:` y `passage:`
- Guarda el índice (vectores + chunks) en **IndexedDB**.
- Backend mínimo (Express) SOLO para servir archivos estáticos y el `.gguf/.wasm` en **mismo origin**.

---

## Stack
- Frontend: `index.html` + `app.js` + `style.css` (vanilla)
- LLM: `@wllama/wllama`
- Embeddings: `@huggingface/transformers` (Transformers.js)
- Backend: Node + Express (solo static)

---

## Reglas obligatorias
1) Ejecutar todo desde `http://<IP>:8080/` (mismo origin).
2) Backend debe enviar estos headers globalmente:
   - Cross-Origin-Opener-Policy: same-origin
   - Cross-Origin-Embedder-Policy: require-corp
   - Cross-Origin-Resource-Policy: same-origin
3) UI debe mostrar `window.crossOriginIsolated`.

---

## UI mínima (una sola página)
Elementos:
- Botón: “Cargar modelo LLM”
- Input file: “Subir epicrisis JSON”
- Botón: “Indexar”
- Input texto: “Pregunta”
- Botón: “Preguntar”
- Área: “Respuesta”
- (Opcional) Área: “Fuentes” (sourceHint)

---

## Flujo mínimo
1) Usuario abre la web.
2) Click “Cargar modelo LLM”:
   - iniciar Wllama con paths wasm:
     - /esm/single-thread/wllama.wasm
     - /esm/multi-thread/wllama.wasm
   - loadModelFromUrl(`/models/LFM2-350M.Q4_K_M.gguf`)
3) Usuario sube JSON.
4) Click “Indexar”:
   - chunking del JSON (ver abajo)
   - por cada chunk:
     - embedding = embed("passage: " + chunk.text)
     - normalizar vector (L2)
     - guardar en IndexedDB:
       - store `chunks` (chunkKey -> text/sourceHint/...)
       - store `vectors` (chunkKey -> vec ArrayBuffer)
5) Usuario pregunta:
   - qvec = embed("query: " + pregunta), normalize
   - cosine topK=10
   - MMR para seleccionar K=4 (lambda=0.7)
   - construir prompt:
     - instrucciones estrictas
     - contexto = 4 chunks con sourceHint
     - pregunta
   - generar con wllama
   - mostrar respuesta

---

## Chunking del JSON (simple, por secciones)
Crear chunks:
1) resumen:
   - motivo_ingreso + antecedentes + dx ingreso/egreso + procedimientos + tratamientos
2) evolucion_dia:
   - 1 chunk por item en `evolucion_resumen[]` (dia + texto)
3) labs:
   - 1 chunk con todas las filas `laboratorios_resumen[]` formateadas como lista
4) alta:
   - 1 chunk con `indicaciones_alta` (medicamentos + controles + cuidados + signos_alarma)

Cada chunk debe tener:
- chunkKey = `${docId}::${chunkId}`
- sourceHint ejemplo:
  - `[DOC 1416169 | evolucion_dia | dia=5]`

docId = `id_atencion` del JSON.

---

## IndexedDB (simple)
DB: `local-chat-rag`
Stores:
1) `chunks` keyPath=`chunkKey`
   - value: { chunkKey, text, sourceHint, chunkType, day? }
2) `vectors` keyPath=`chunkKey`
   - value: { chunkKey, dim: 384, vec: ArrayBuffer }

Funciones mínimas:
- putChunk()
- putVector()
- getAllVectors()
- getChunksByKeys()
- clearAll()

---

## Retrieval (simple)
Implementar:
- cosine(query, vec) usando dot product (vectores normalizados)
- topK=10 por score
- MMR (lambda=0.7) para elegir K=4

---

## Prompt final (simple y estricto)
Formato:
- “Responde en español.”
- “Usa SOLO el CONTEXTO.”
- “Si no está, di: No está en el informe.”
- CONTEXTO: lista de chunks con sourceHint + text
- Pregunta: ...
- Respuesta: ...

---

## Estructura del repo
local-chat/
  backend/
    src/server.ts
    package.json
    tsconfig.json
  public/
    index.html
    app.js
    style.css
    esm/
      single-thread/wllama.wasm
      multi-thread/wllama.wasm
  models/
    LFM2-350M.Q4_K_M.gguf
  tools/
    copy-assets.mjs (opcional si ya está todo en public/)
  package.json (root scripts opcional)

---

## Backend Express (solo static)
- servir `public/` en `/`
- servir `models/` en `/models`
- headers COOP/COEP/CORP globales
- SPA no necesaria (no hay router), pero servir index.html en `/`
- escuchar `0.0.0.0:3030`

---

## Entregables mínimos que debe generar el agente
- `public/index.html` (UI + import modules)
- `public/app.js` (wllama + embeddings + rag + IndexedDB)
- `public/style.css`
- `backend/src/server.ts`
- instrucciones README:
  - npm i
  - npm start
  - abrir http://<IP>:3030

FIN