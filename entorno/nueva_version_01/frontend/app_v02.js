import { Wllama } from "./lib/index.js";
import {
  pipeline,
  env,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/+esm";

// Configurar Transformers.js
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 4;
env.backends.onnx.wasm.proxy = false;

// Estado global
const state = {
  wllama: null,
  embedder: null,
  currentFile: null,
  db: null,
};

// ============================================================================
// IndexedDB
// ============================================================================

const DB_NAME = "local-chat-rag";
const DB_VERSION = 1;
const STORE_CHUNKS = "chunks";
const STORE_VECTORS = "vectors";

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      state.db = request.result;
      resolve(state.db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        db.createObjectStore(STORE_CHUNKS, { keyPath: "chunkKey" });
      }
      if (!db.objectStoreNames.contains(STORE_VECTORS)) {
        db.createObjectStore(STORE_VECTORS, { keyPath: "chunkKey" });
      }
    };
  });
}

async function putChunk(chunk) {
  const tx = state.db.transaction(STORE_CHUNKS, "readwrite");
  const store = tx.objectStore(STORE_CHUNKS);
  await store.put(chunk);
  return tx.complete;
}

async function putVector(vectorData) {
  const tx = state.db.transaction(STORE_VECTORS, "readwrite");
  const store = tx.objectStore(STORE_VECTORS);
  await store.put(vectorData);
  return tx.complete;
}

async function getAllVectors() {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(STORE_VECTORS, "readonly");
    const store = tx.objectStore(STORE_VECTORS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getChunksByKeys(keys) {
  const chunks = [];
  const tx = state.db.transaction(STORE_CHUNKS, "readonly");
  const store = tx.objectStore(STORE_CHUNKS);

  for (const key of keys) {
    const request = store.get(key);
    const chunk = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (chunk) chunks.push(chunk);
  }

  return chunks;
}

async function clearAll() {
  const tx1 = state.db.transaction(STORE_CHUNKS, "readwrite");
  const tx2 = state.db.transaction(STORE_VECTORS, "readwrite");
  await tx1.objectStore(STORE_CHUNKS).clear();
  await tx2.objectStore(STORE_VECTORS).clear();
}

// ============================================================================
// Embedding y normalización
// ============================================================================

async function embed(text) {
  if (!state.embedder) {
    throw new Error("Embedder no está cargado");
  }
  const output = await state.embedder(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
}

function normalizeVector(vec) {
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return vec.map((val) => val / norm);
}

// ============================================================================
// Chunking del JSON
// ============================================================================

function createChunks(jsonData) {
  const chunks = [];
  const docId = String(
    jsonData.id_atencion || jsonData.atencion?.id || "unknown"
  );

  // ---------- Helpers ----------
  const nonEmpty = (s) => s && String(s).trim().length > 0;

  const listLines = (title, arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    const lines = arr.map((x) => String(x ?? "").trim()).filter(nonEmpty);
    if (lines.length === 0) return "";
    return `${title}:\n- ${lines.join("\n- ")}\n`;
  };

  const codeNameLines = (title, arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    const lines = arr
      .map((o) => {
        const codigo = String(o?.codigo ?? "").trim();
        const nombre = String(o?.nombre ?? "").trim();
        if (codigo && nombre) return `- ${codigo}: ${nombre}`;
        return `- ${codigo || nombre}`.trim();
      })
      .filter(nonEmpty);
    if (lines.length === 0) return "";
    return `${title}:\n${lines.join("\n")}\n`;
  };

  const tratamientosLines = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    const lines = arr
      .map((t) => {
        const codigo = String(t?.codigo ?? "").trim(); // ATC
        const nombre = String(t?.nombre ?? "").trim();
        const via = String(t?.via ?? "").trim();
        const dosis = String(t?.dosis ?? "").trim();
        const freq = String(t?.frecuencia ?? "").trim();
        const ini = String(t?.inicio ?? "").trim();
        const fin = String(t?.fin ?? "").trim();

        const parts = [
          codigo ? `[${codigo}]` : "",
          nombre,
          via ? `vía ${via}` : "",
          dosis ? `dosis ${dosis}` : "",
          freq ? `freq ${freq}` : "",
          ini || fin ? `(${ini || "?"} → ${fin || "?"})` : "",
        ].filter(nonEmpty);

        return parts.length ? `- ${parts.join(" ")}` : "";
      })
      .filter(nonEmpty);

    if (!lines.length) return "";
    return `Tratamientos intrahospitalarios:\n${lines.join("\n")}\n`;
  };

  const labsLines = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    const lines = arr
      .map((l) => {
        const prueba = String(l?.prueba ?? "").trim();
        const unidad = String(l?.unidad ?? "").trim();

        const ingreso = l?.ingreso ?? {};
        const valor = ingreso?.valor;
        const fecha = String(ingreso?.fecha ?? "").trim();
        const estado = String(ingreso?.estado ?? "").trim();
        const ri = ingreso?.rango_inferior;
        const rs = ingreso?.rango_superior;

        const periodo = l?.periodo ?? {};
        const pmin = periodo?.min;
        const pmax = periodo?.max;

        const parts = [];
        if (prueba) parts.push(prueba);
        if (valor !== undefined && valor !== null)
          parts.push(`ingreso=${valor}${unidad ? " " + unidad : ""}`);
        if (estado) parts.push(`(${estado})`);
        if (ri !== undefined || rs !== undefined)
          parts.push(`ref=[${ri ?? "?"}..${rs ?? "?"}]`);
        if (fecha) parts.push(`fecha=${fecha}`);
        if (pmin !== undefined || pmax !== undefined)
          parts.push(`periodo[min=${pmin ?? "?"}, max=${pmax ?? "?"}]`);

        return parts.length ? `- ${parts.join(" ")}` : "";
      })
      .filter(nonEmpty);

    if (!lines.length) return "";
    return `Laboratorios resumen:\n${lines.join("\n")}\n`;
  };

  const altaLines = (alta) => {
    if (!alta || typeof alta !== "object") return "";

    const meds = Array.isArray(alta.medicamentos) ? alta.medicamentos : [];
    const medLines = meds
      .map((m) => {
        const codigo = String(m?.codigo ?? "").trim();
        const nombre = String(m?.nombre ?? "").trim();
        const dosis = String(m?.dosis ?? "").trim();
        const via = String(m?.via ?? "").trim();
        const freq = String(m?.frecuencia ?? "").trim();
        const dur = String(m?.duracion ?? "").trim();

        const parts = [
          codigo ? `[${codigo}]` : "",
          nombre,
          dosis ? `dosis ${dosis}` : "",
          via ? `vía ${via}` : "",
          freq ? `freq ${freq}` : "",
          dur ? `duración ${dur}` : "",
        ].filter(nonEmpty);

        return parts.length ? `- ${parts.join(" ")}` : "";
      })
      .filter(nonEmpty);

    let out = "";
    if (medLines.length) out += `Medicamentos:\n${medLines.join("\n")}\n\n`;
    out += listLines("Controles", alta.controles);
    out += listLines("Cuidados", alta.cuidados);
    out += listLines("Signos de alarma", alta.signos_alarma);
    return out.trim();
  };

  // ---------- 1) RESUMEN ----------
  const ingreso = jsonData.atencion?.fecha_ingreso
    ? `[INGRESO] ${jsonData.atencion.fecha_ingreso}\n`
    : "";
  const altaFecha = jsonData.atencion?.fecha_alta
    ? `[ALTA] ${jsonData.atencion.fecha_alta}\n`
    : "";
  const edad =
    jsonData.paciente?.edad !== undefined
      ? `[EDAD] ${jsonData.paciente.edad}\n`
      : "";
  const sexo = jsonData.paciente?.sexo
    ? `[SEXO] ${jsonData.paciente.sexo}\n`
    : "";
  const motivo = jsonData.motivo_ingreso
    ? `[MOTIVO] ${jsonData.motivo_ingreso}\n`
    : "";

  const antecedentes = jsonData.antecedentes ?? {};
  const antText =
    listLines("Antecedentes médicos", antecedentes.medicos) +
    listLines("Antecedentes quirúrgicos", antecedentes.quirurgicos) +
    (nonEmpty(antecedentes.alergias)
      ? `Alergias: ${antecedentes.alergias}\n`
      : "");

  const dxIngreso = codeNameLines(
    "Diagnóstico de ingreso",
    jsonData.diagnostico_ingreso
  );
  const dxEgreso = codeNameLines(
    "Diagnóstico de egreso",
    jsonData.diagnostico_egreso
  );
  const procs = codeNameLines("Procedimientos", jsonData.procedimientos);
  const trats = tratamientosLines(jsonData.tratamientos_intrahosp);

  const resumenText = (
    `[TIPO] Epicrisis\n` +
    ingreso +
    altaFecha +
    edad +
    sexo +
    motivo +
    `\n` +
    antText +
    `\n` +
    dxIngreso +
    `\n` +
    dxEgreso +
    `\n` +
    procs +
    `\n` +
    trats
  ).trim();

  if (nonEmpty(resumenText)) {
    chunks.push({
      chunkKey: `${docId}::resumen`,
      text: resumenText,
      sourceHint: `[DOC ${docId} | resumen]`,
      chunkType: "resumen",
    });
  }

  // ---------- 2) EVOLUCIÓN DIARIA ----------
  if (Array.isArray(jsonData.evolucion_resumen)) {
    jsonData.evolucion_resumen.forEach((ev, idx) => {
      const day = ev?.dia ?? idx + 1;
      const t = String(ev?.texto ?? "").trim();
      if (!nonEmpty(t)) return;

      const evText = (
        `[TIPO] Evolución diaria\n` +
        `[DIA] ${day}\n` +
        ingreso +
        altaFecha +
        `\n` +
        `[TEXTO]\n${t}\n`
      ).trim();

      chunks.push({
        chunkKey: `${docId}::evo:${day}`,
        text: evText,
        sourceHint: `[DOC ${docId} | evolucion_dia | dia=${day}]`,
        chunkType: "evolucion_dia",
        day,
      });
    });
  }

  // ---------- 3) LABORATORIOS ----------
  const labsText = labsLines(jsonData.laboratorios_resumen);
  if (nonEmpty(labsText)) {
    chunks.push({
      chunkKey: `${docId}::labs`,
      text: (
        `[TIPO] Laboratorios\n` +
        ingreso +
        altaFecha +
        `\n` +
        labsText
      ).trim(),
      sourceHint: `[DOC ${docId} | laboratorios]`,
      chunkType: "laboratorios",
    });
  }

  // ---------- 4) ALTA ----------
  const altaText = altaLines(jsonData.indicaciones_alta);
  if (nonEmpty(altaText)) {
    chunks.push({
      chunkKey: `${docId}::alta`,
      text: (
        `[TIPO] Indicaciones de alta\n` +
        altaFecha +
        `\n\n` +
        altaText
      ).trim(),
      sourceHint: `[DOC ${docId} | alta]`,
      chunkType: "alta",
    });
  }

  return chunks;
}

// ============================================================================
// Retrieval (cosine + MMR)
// ============================================================================

function cosine(vec1, vec2) {
  return vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
}

function topK(queryVec, allVectors, k) {
  const scored = allVectors.map((item) => {
    const vec = Array.from(new Float32Array(item.vec));
    const score = cosine(queryVec, vec);
    return { chunkKey: item.chunkKey, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

function mmr(queryVec, candidates, allVectors, k, lambda = 0.7) {
  const selected = [];
  const remaining = [...candidates];
  const vectorMap = new Map();
  allVectors.forEach((item) => {
    vectorMap.set(item.chunkKey, Array.from(new Float32Array(item.vec)));
  });

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      const candVec = vectorMap.get(cand.chunkKey);
      const relevance = cosine(queryVec, candVec);

      let maxSim = 0;
      for (const sel of selected) {
        const selVec = vectorMap.get(sel.chunkKey);
        const sim = cosine(candVec, selVec);
        if (sim > maxSim) maxSim = sim;
      }

      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      selected.push(remaining[bestIdx]);
      remaining.splice(bestIdx, 1);
    } else {
      break;
    }
  }

  return selected;
}

// ============================================================================
// Prompt construction
// ============================================================================

function buildPrompt(chunks, question) {
  let prompt = "Responde en español.\n";
  prompt += "Usa SOLO el CONTEXTO proporcionado.\n";
  prompt +=
    'Si la respuesta no está en el contexto, di: "No está en el informe."\n\n';
  prompt += "CONTEXTO:\n";
  chunks.forEach((chunk, idx) => {
    prompt += `${idx + 1}. ${chunk.sourceHint}\n${chunk.text}\n\n`;
  });
  prompt += `Pregunta: ${question}\n`;
  prompt += "Respuesta:";
  return prompt;
}

// ============================================================================
// UI updates
// ============================================================================

function setStatus(elementId, message, type = "info") {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = "status-text";
  if (type) el.classList.add(type);
}

function showAnswer(answer, sources) {
  const answerSection = document.getElementById("answer-section");
  const answerText = document.getElementById("answer-text");
  const sourcesSection = document.getElementById("sources-section");
  const sourcesList = document.getElementById("sources-list");

  answerText.textContent = answer;
  answerSection.style.display = "block";

  if (sources && sources.length > 0) {
    sourcesList.innerHTML = "";
    sources.forEach((src) => {
      const li = document.createElement("li");
      li.textContent = src.sourceHint;
      sourcesList.appendChild(li);
    });
    sourcesSection.style.display = "block";
  } else {
    sourcesSection.style.display = "none";
  }
}

// ============================================================================
// Handlers
// ============================================================================

async function handleLoadModel() {
  const btn = document.getElementById("load-model-btn");
  const modelSelect = document.getElementById("model-select");
  const selectedModel = modelSelect.value;

  btn.disabled = true;
  modelSelect.disabled = true;
  setStatus("model-status", `Cargando modelo ${selectedModel}...`, "loading");

  try {
    const baseUrl = window.location.origin;
    console.log("Base URL:", baseUrl);
    console.log("Selected model:", selectedModel);

    const wasmConfig = {
      "single-thread/wllama.wasm": `${baseUrl}/esm/single-thread/wllama.wasm`,
      "multi-thread/wllama.wasm": `${baseUrl}/esm/multi-thread/wllama.wasm`,
    };
    console.log("WASM config:", wasmConfig);

    state.wllama = new Wllama(wasmConfig);
    console.log("Wllama instance created");

    const modelUrl = `${baseUrl}/models/${selectedModel}`;
    console.log("Loading model from:", modelUrl);

    await state.wllama.loadModelFromUrl(modelUrl, {
      n_ctx: 4096,
      n_threads: navigator.hardwareConcurrency || 4,
      n_gpu_layers: 0, // CPU only for browser compatibility
    });

    setStatus("model-status", "Modelo LLM cargado correctamente", "success");
    console.log("Model loaded successfully");

    // Cargar embedder
    setStatus("model-status", "Cargando modelo de embeddings...", "loading");
    state.embedder = await pipeline(
      "feature-extraction",
      "Xenova/multilingual-e5-small",
      {
        dtype: "q8",
        device: "wasm",
      }
    );
    setStatus("model-status", "Modelo LLM y embeddings cargados", "success");
    console.log("Embedder loaded successfully");
  } catch (err) {
    console.error("Error completo:", err);
    console.error("Stack:", err.stack);
    setStatus("model-status", `Error: ${err.message}`, "error");
    btn.disabled = false;
    modelSelect.disabled = false;
  }
}

async function handleFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  state.currentFile = file;
  setStatus("index-status", `Archivo cargado: ${file.name}`, "info");
  document.getElementById("index-btn").disabled = false;
}

async function handleIndex() {
  if (!state.currentFile) {
    setStatus("index-status", "No hay archivo seleccionado", "error");
    return;
  }

  if (!state.embedder) {
    setStatus("index-status", "Debes cargar el modelo primero", "error");
    return;
  }

  const btn = document.getElementById("index-btn");
  btn.disabled = true;
  setStatus("index-status", "Leyendo archivo...", "loading");

  try {
    const text = await state.currentFile.text();
    const jsonData = JSON.parse(text);

    setStatus("index-status", "Creando chunks...", "loading");
    const chunks = createChunks(jsonData);

    setStatus(
      "index-status",
      `Indexando ${chunks.length} chunks...`,
      "loading"
    );

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      setStatus(
        "index-status",
        `Indexando ${i + 1}/${chunks.length}...`,
        "loading"
      );

      const embeddingText = `passage: ${chunk.text}`;
      let vec = await embed(embeddingText);
      vec = normalizeVector(vec);

      await putChunk(chunk);
      await putVector({
        chunkKey: chunk.chunkKey,
        dim: 384,
        vec: new Float32Array(vec).buffer,
      });
    }

    setStatus(
      "index-status",
      `Indexación completa: ${chunks.length} chunks`,
      "success"
    );
    document.getElementById("ask-btn").disabled = false;
  } catch (err) {
    console.error(err);
    setStatus("index-status", `Error: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
  }
}

async function handleAsk() {
  const question = document.getElementById("question-input").value.trim();
  if (!question) {
    setStatus("answer-status", "Debes escribir una pregunta", "error");
    return;
  }

  if (!state.wllama) {
    setStatus("answer-status", "Debes cargar el modelo LLM primero", "error");
    return;
  }

  const btn = document.getElementById("ask-btn");
  btn.disabled = true;
  setStatus(
    "answer-status",
    "Generando embedding de la pregunta...",
    "loading"
  );

  try {
    const queryText = `query: ${question}`;
    let qvec = await embed(queryText);
    qvec = normalizeVector(qvec);

    async function getAllChunks() {
      return new Promise((resolve, reject) => {
        const tx = state.db.transaction(STORE_CHUNKS, "readonly");
        const store = tx.objectStore(STORE_CHUNKS);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    function parseQueryFilters(question) {
      const q = question.toLowerCase();

      // Detectar día (ej: "día 5", "dia 12", "d5")
      let day = null;
      const m1 = q.match(/\b(d[ií]a)\s*(\d{1,2})\b/);
      const m2 = q.match(/\bd(\d{1,2})\b/);
      if (m1) day = parseInt(m1[2], 10);
      else if (m2) day = parseInt(m2[1], 10);

      // Detectar “sección” por keywords
      const wantsAlta =
        /\balta\b|\bindicaciones\b|\bmedicamentos\b|\bcontrol(es)?\b|\bcuidados\b|\bsignos de alarma\b/.test(
          q
        );

      const wantsLabs =
        /\blab(oratorio(s)?)?\b|\bhemoglobina\b|\bhematocrito\b|\bleucocit(os)?\b|\bplaquet(as)?\b|\bcreatinina\b|\burea\b|\bsodio\b|\bpotasio\b|\bph\b/.test(
          q
        );

      const wantsResumen =
        /\bmotivo\b|\bantecedentes\b|\bdiagn[oó]stic(o|os)\b|\bprocedimiento(s)?\b|\btratamiento(s)?\b|\bingreso\b|\begreso\b/.test(
          q
        );

      const wantsEvolucion =
        /\bevoluci[oó]n\b|\bpost\s*op\b|\bpostoperator(io|io)\b|\bd[ií]a\b|\bplan\b|\bse sugiere\b|\btorax\b|\bpleurostom[ií]a\b/.test(
          q
        );

      // Resolver tipos deseados
      const types = new Set();
      if (wantsAlta) types.add("alta");
      if (wantsLabs) types.add("laboratorios"); // OJO: en tu chunking actual lo llamas 'labs' (ver nota abajo)
      if (wantsResumen) types.add("resumen");
      if (wantsEvolucion || day !== null) types.add("evolucion_dia");

      // Si no detecta nada, no filtrar por tipo
      const hasTypeFilter = types.size > 0;

      return { day, types, hasTypeFilter };
    }

    function prefilterChunkKeys(allChunks, filters) {
      let candidates = allChunks;

      // 1) Filtrar por tipo si aplica
      if (filters.hasTypeFilter) {
        candidates = candidates.filter((c) => filters.types.has(c.chunkType));
      }

      // 2) Filtrar por día si aplica
      if (filters.day !== null) {
        candidates = candidates.filter(
          (c) =>
            c.chunkType === "evolucion_dia" && Number(c.day) === filters.day
        );
      }

      // Si quedó vacío, fallback a todos
      if (candidates.length === 0) return allChunks.map((c) => c.chunkKey);

      return candidates.map((c) => c.chunkKey);
    }

    function filterVectorsByKeys(allVectors, allowedKeys) {
      const allow = new Set(allowedKeys);
      return allVectors.filter((v) => allow.has(v.chunkKey));
    }

    setStatus("answer-status", "Recuperando documentos...", "loading");

    // 1) cargar metadata chunks + parsear filtros desde la pregunta
    const allChunks = await getAllChunks();
    const filters = parseQueryFilters(question);

    // 2) aplicar filtros (por tipo y/o por día) para acotar candidatos
    const allowedKeys = prefilterChunkKeys(allChunks, filters);

    // 3) scoring SOLO dentro de candidatos
    const allVectors = await getAllVectors();
    const filteredVectors = filterVectorsByKeys(allVectors, allowedKeys);

    // fallback: si por alguna razón no hay vectores filtrados, usar todos
    const vectorsForSearch = filteredVectors.length
      ? filteredVectors
      : allVectors;

    const top10 = topK(qvec, vectorsForSearch, 10);
    const top4 = mmr(qvec, top10, vectorsForSearch, 4, 0.7);

    // 4) traer chunks definitivos
    const chunkKeys = top4.map((item) => item.chunkKey);
    const retrievedChunks = await getChunksByKeys(chunkKeys);
    /*     setStatus("answer-status", "Recuperando documentos...", "loading");
    const allVectors = await getAllVectors();
    const top10 = topK(qvec, allVectors, 10);
    const top4 = mmr(qvec, top10, allVectors, 4, 0.7);

    const chunkKeys = top4.map((item) => item.chunkKey);
    const retrievedChunks = await getChunksByKeys(chunkKeys); */

    setStatus("answer-status", "Generando respuesta...", "loading");
    const prompt = buildPrompt(retrievedChunks, question);

    const response = await state.wllama.createCompletion(prompt, {
      nPredict: 512,
      sampling: {
        temp: 0.1,
        top_p: 0.9,
      },
    });

    const answer = response.trim();
    showAnswer(answer, retrievedChunks);
    setStatus("answer-status", "Respuesta generada", "success");
  } catch (err) {
    console.error(err);
    setStatus("answer-status", `Error: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
  }
}

async function handleClearDB() {
  const btn = document.getElementById("clear-db-btn");
  btn.disabled = true;
  setStatus("clear-status", "Limpiando base de datos...", "loading");

  try {
    await clearAll();
    setStatus("clear-status", "Base de datos limpiada", "success");
    document.getElementById("ask-btn").disabled = true;
    document.getElementById("index-btn").disabled = true;
    document.getElementById("file-input").value = "";
    state.currentFile = null;
  } catch (err) {
    console.error(err);
    setStatus("clear-status", `Error: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
  }
}

// ============================================================================
// Init
// ============================================================================

async function init() {
  const isolated = window.crossOriginIsolated;
  const statusText = document.getElementById("isolation-text");
  statusText.textContent = isolated
    ? "✓ crossOriginIsolated: true"
    : "✗ crossOriginIsolated: false";
  statusText.style.color = isolated ? "#48bb78" : "#f56565";

  await initDB();

  document
    .getElementById("load-model-btn")
    .addEventListener("click", handleLoadModel);
  document
    .getElementById("file-input")
    .addEventListener("change", handleFileChange);
  document.getElementById("index-btn").addEventListener("click", handleIndex);
  document.getElementById("ask-btn").addEventListener("click", handleAsk);
  document
    .getElementById("clear-db-btn")
    .addEventListener("click", handleClearDB);
}

init();
