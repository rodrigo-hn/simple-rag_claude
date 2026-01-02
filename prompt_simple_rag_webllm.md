# PROMPT ULTRA SIMPLE — local-chat (Vanilla JS + WebLLM + RAG básico)

## Objetivo
Genera una app (solo HTML/CSS/JS) llamada **local-chat** que:

- Corre un **LLM en el navegador** usando **WebLLM** (MLC) y **WebGPU** (cuando exista).
- Hace **RAG 100% en el navegador** sobre **1 archivo JSON** (epicrisis) que el usuario sube.
- Usa **embeddings locales** con **Transformers.js** (WebGPU si existe) y el modelo:
  - `intfloat/multilingual-e5-small` (384 dims)
  - prefijos obligatorios: `query:` y `passage:`
- Guarda el índice (vectores + chunks) en **IndexedDB**.
- Backend mínimo (Express) SOLO para servir archivos estáticos y **los artefactos del modelo WebLLM** en **mismo origin**.
- Implementa compactación automática de contexto y protección anti-loop en la salida.

---

## Stack
- Frontend: `index.html` + `app.js` + `style.css` (vanilla)
- LLM: `@mlc-ai/web-llm` (WebLLM)
- Embeddings: `@huggingface/transformers` (Transformers.js)
- Backend: Node + Express (solo static)
- Soporte multi-hilo dinámico cuando `crossOriginIsolated=true` (recomendado).

---

## Reglas obligatorias
1) Ejecutar todo desde `http://<IP>:3030/` (mismo origin).
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
2) Click “Cargar modelo LLM” (WebLLM):
   - crear el engine:
     - `engine = await webllm.CreateMLCEngine(modelId, { initProgressCallback })`
   - `modelId` debe ser configurable (dropdown o constante) y apuntar a un modelo **compatible con WebLLM**.
   - Si vas a servir el modelo localmente (recomendado para “mismo origin”):
     - colocar los artefactos del modelo MLC bajo `/models/<modelId>/...`
     - configurar la carga para usar rutas locales (según el manifest/convención de WebLLM).
   - parámetros conservadores por defecto:
     - `max_tokens` (o equivalente) ≈ 128
     - `temperature` ≈ 0.2–0.7 (por defecto 0.3)
     - `top_p` ≈ 0.9
   - mostrar progreso de carga (porcentaje/estado) en UI.
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
   - MMR para seleccionar K=3 (lambda=0.7)
   - Compactar automáticamente los chunks (usar preferentemente [TEXTO], truncar a ~1200 chars)
   - construir prompt compacto
   - generar con WebLLM:
     - `await engine.chat.completions.create({ messages, max_tokens })` (o API equivalente)
   - post-procesar salida:
     - exigir 4 viñetas + "Fuente:"
     - fallback determinístico si el modelo entra en bucles o formato inválido
   - mostrar respuesta y fuentes

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

Nota: los textos largos se compactan automáticamente antes de enviarse al LLM.

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
- MMR (lambda=0.7) para elegir K=3
- Compactación automática de chunks antes del prompt

---

## Prompt final (compacto y estricto)
Formato:
- "TAREA: extrae 4 frases EXACTAS del CONTEXTO."
- "FORMATO: 4 líneas con '- ' y luego una sola línea: 'Fuente: <sourceHint>'."
- "PROHIBIDO: inventar, resumir, interpretar."
- CONTEXTO: lista de chunks compactados (sourceHint + texto)
- Pregunta: ...
- Respuesta: ...

---

## Características técnicas
- Compactación automática de contexto
- Protección anti-loop con fallback determinístico
- `max_tokens` por defecto ≈ 128

---

## Troubleshooting
- Si WebGPU no está disponible: mostrar mensaje claro (“WebGPU no disponible”) y deshabilitar “Preguntar”.
- Si hay errores de carga de modelo: validar que los artefactos del modelo WebLLM estén en **mismo origin** y que el servidor envíe COOP/COEP/CORP.

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
  models/
    <modelId>/   (artefactos MLC/WebLLM servidos por Express)
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
- `public/app.js` (WebLLM + embeddings + rag + IndexedDB)
- `public/style.css`
- `backend/src/server.ts`
- instrucciones README:
  - npm i
  - npm start
  - abrir http://<IP>:3030

FIN
