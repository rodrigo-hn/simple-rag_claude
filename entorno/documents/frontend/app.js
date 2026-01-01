import { Wllama } from './lib/index.js';
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/+esm';

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

const DB_NAME = 'local-chat-rag';
const DB_VERSION = 1;
const STORE_CHUNKS = 'chunks';
const STORE_VECTORS = 'vectors';

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
        db.createObjectStore(STORE_CHUNKS, { keyPath: 'chunkKey' });
      }
      if (!db.objectStoreNames.contains(STORE_VECTORS)) {
        db.createObjectStore(STORE_VECTORS, { keyPath: 'chunkKey' });
      }
    };
  });
}

async function putChunk(chunk) {
  const tx = state.db.transaction(STORE_CHUNKS, 'readwrite');
  const store = tx.objectStore(STORE_CHUNKS);
  await store.put(chunk);
  return tx.complete;
}

async function putVector(vectorData) {
  const tx = state.db.transaction(STORE_VECTORS, 'readwrite');
  const store = tx.objectStore(STORE_VECTORS);
  await store.put(vectorData);
  return tx.complete;
}

async function getAllVectors() {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(STORE_VECTORS, 'readonly');
    const store = tx.objectStore(STORE_VECTORS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getChunksByKeys(keys) {
  const chunks = [];
  const tx = state.db.transaction(STORE_CHUNKS, 'readonly');
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
  const tx1 = state.db.transaction(STORE_CHUNKS, 'readwrite');
  const tx2 = state.db.transaction(STORE_VECTORS, 'readwrite');
  await tx1.objectStore(STORE_CHUNKS).clear();
  await tx2.objectStore(STORE_VECTORS).clear();
}

// ============================================================================
// Embedding y normalización
// ============================================================================

async function embed(text) {
  if (!state.embedder) {
    throw new Error('Embedder no está cargado');
  }
  const output = await state.embedder(text, { pooling: 'mean', normalize: true });
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
  const docId = jsonData.id_atencion || 'unknown';

  // 1. Resumen
  const resumenParts = [
    jsonData.motivo_ingreso || '',
    jsonData.antecedentes || '',
    jsonData.diagnostico_ingreso || '',
    jsonData.diagnostico_egreso || '',
    jsonData.procedimientos || '',
    jsonData.tratamientos || '',
  ];
  const resumenText = resumenParts.filter((p) => p && String(p).trim()).join('\n');
  if (resumenText) {
    chunks.push({
      chunkKey: `${docId}::resumen`,
      text: resumenText,
      sourceHint: `[DOC ${docId} | resumen]`,
      chunkType: 'resumen',
    });
  }

  // 2. Evolución por día
  if (jsonData.evolucion_resumen && Array.isArray(jsonData.evolucion_resumen)) {
    jsonData.evolucion_resumen.forEach((ev, idx) => {
      const dia = ev.dia || idx + 1;
      const texto = ev.texto || '';
      if (texto.trim()) {
        chunks.push({
          chunkKey: `${docId}::evolucion_dia_${dia}`,
          text: texto,
          sourceHint: `[DOC ${docId} | evolucion_dia | dia=${dia}]`,
          chunkType: 'evolucion_dia',
          day: dia,
        });
      }
    });
  }

  // 3. Laboratorios
  if (jsonData.laboratorios_resumen && Array.isArray(jsonData.laboratorios_resumen)) {
    const labLines = jsonData.laboratorios_resumen.map((lab) => {
      return `${lab.examen || 'Lab'}: ${lab.resultado || 'N/A'} (${lab.fecha || 'sin fecha'})`;
    });
    const labText = labLines.join('\n');
    if (labText.trim()) {
      chunks.push({
        chunkKey: `${docId}::labs`,
        text: labText,
        sourceHint: `[DOC ${docId} | labs]`,
        chunkType: 'labs',
      });
    }
  }

  // 4. Indicaciones de alta
  if (jsonData.indicaciones_alta) {
    const alta = jsonData.indicaciones_alta;
    const altaParts = [
      alta.medicamentos ? `Medicamentos: ${alta.medicamentos}` : '',
      alta.controles ? `Controles: ${alta.controles}` : '',
      alta.cuidados ? `Cuidados: ${alta.cuidados}` : '',
      alta.signos_alarma ? `Signos de alarma: ${alta.signos_alarma}` : '',
    ];
    const altaText = altaParts.filter((p) => p && String(p).trim()).join('\n');
    if (altaText) {
      chunks.push({
        chunkKey: `${docId}::alta`,
        text: altaText,
        sourceHint: `[DOC ${docId} | alta]`,
        chunkType: 'alta',
      });
    }
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
  let prompt = 'Responde en español.\n';
  prompt += 'Usa SOLO el CONTEXTO proporcionado.\n';
  prompt += 'Si la respuesta no está en el contexto, di: "No está en el informe."\n\n';
  prompt += 'CONTEXTO:\n';
  chunks.forEach((chunk, idx) => {
    prompt += `${idx + 1}. ${chunk.sourceHint}\n${chunk.text}\n\n`;
  });
  prompt += `Pregunta: ${question}\n`;
  prompt += 'Respuesta:';
  return prompt;
}

// ============================================================================
// UI updates
// ============================================================================

function setStatus(elementId, message, type = 'info') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = 'status-text';
  if (type) el.classList.add(type);
}

function showAnswer(answer, sources) {
  const answerSection = document.getElementById('answer-section');
  const answerText = document.getElementById('answer-text');
  const sourcesSection = document.getElementById('sources-section');
  const sourcesList = document.getElementById('sources-list');

  answerText.textContent = answer;
  answerSection.style.display = 'block';

  if (sources && sources.length > 0) {
    sourcesList.innerHTML = '';
    sources.forEach((src) => {
      const li = document.createElement('li');
      li.textContent = src.sourceHint;
      sourcesList.appendChild(li);
    });
    sourcesSection.style.display = 'block';
  } else {
    sourcesSection.style.display = 'none';
  }
}

// ============================================================================
// Handlers
// ============================================================================

async function handleLoadModel() {
  const btn = document.getElementById('load-model-btn');
  const modelSelect = document.getElementById('model-select');
  const selectedModel = modelSelect.value;

  btn.disabled = true;
  modelSelect.disabled = true;
  setStatus('model-status', `Cargando modelo ${selectedModel}...`, 'loading');

  try {
    const baseUrl = window.location.origin;
    console.log('Base URL:', baseUrl);
    console.log('Selected model:', selectedModel);

    const wasmConfig = {
      'single-thread/wllama.wasm': `${baseUrl}/esm/single-thread/wllama.wasm`,
      'multi-thread/wllama.wasm': `${baseUrl}/esm/multi-thread/wllama.wasm`,
    };
    console.log('WASM config:', wasmConfig);

    state.wllama = new Wllama(wasmConfig);
    console.log('Wllama instance created');

    const modelUrl = `${baseUrl}/models/${selectedModel}`;
    console.log('Loading model from:', modelUrl);

    await state.wllama.loadModelFromUrl(modelUrl, {
      n_ctx: 4096,
      n_threads: navigator.hardwareConcurrency || 4,
      n_gpu_layers: 0, // CPU only for browser compatibility
    });

    setStatus('model-status', 'Modelo LLM cargado correctamente', 'success');
    console.log('Model loaded successfully');

    // Cargar embedder
    setStatus('model-status', 'Cargando modelo de embeddings...', 'loading');
    state.embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
      dtype: 'q8',
      device: 'wasm',
    });
    setStatus('model-status', 'Modelo LLM y embeddings cargados', 'success');
    console.log('Embedder loaded successfully');
  } catch (err) {
    console.error('Error completo:', err);
    console.error('Stack:', err.stack);
    setStatus('model-status', `Error: ${err.message}`, 'error');
    btn.disabled = false;
    modelSelect.disabled = false;
  }
}

async function handleFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  state.currentFile = file;
  setStatus('index-status', `Archivo cargado: ${file.name}`, 'info');
  document.getElementById('index-btn').disabled = false;
}

async function handleIndex() {
  if (!state.currentFile) {
    setStatus('index-status', 'No hay archivo seleccionado', 'error');
    return;
  }

  if (!state.embedder) {
    setStatus('index-status', 'Debes cargar el modelo primero', 'error');
    return;
  }

  const btn = document.getElementById('index-btn');
  btn.disabled = true;
  setStatus('index-status', 'Leyendo archivo...', 'loading');

  try {
    const text = await state.currentFile.text();
    const jsonData = JSON.parse(text);

    setStatus('index-status', 'Creando chunks...', 'loading');
    const chunks = createChunks(jsonData);
console.log("crear chunks: " + chunks);
    setStatus('index-status', `Indexando ${chunks.length} chunks...`, 'loading');

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      setStatus('index-status', `Indexando ${i + 1}/${chunks.length}...`, 'loading');

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

    setStatus('index-status', `Indexación completa: ${chunks.length} chunks`, 'success');
    document.getElementById('ask-btn').disabled = false;
  } catch (err) {
    console.error(err);
    setStatus('index-status', `Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function handleAsk() {
  const question = document.getElementById('question-input').value.trim();
  if (!question) {
    setStatus('answer-status', 'Debes escribir una pregunta', 'error');
    return;
  }

  if (!state.wllama) {
    setStatus('answer-status', 'Debes cargar el modelo LLM primero', 'error');
    return;
  }

  const btn = document.getElementById('ask-btn');
  btn.disabled = true;
  setStatus('answer-status', 'Generando embedding de la pregunta...', 'loading');

  try {
    const queryText = `query: ${question}`;
    let qvec = await embed(queryText);
    qvec = normalizeVector(qvec);

    setStatus('answer-status', 'Recuperando documentos...', 'loading');
    const allVectors = await getAllVectors();
    const top10 = topK(qvec, allVectors, 10);
    const top4 = mmr(qvec, top10, allVectors, 4, 0.7);

    const chunkKeys = top4.map((item) => item.chunkKey);
    const retrievedChunks = await getChunksByKeys(chunkKeys);

    setStatus('answer-status', 'Generando respuesta...', 'loading');
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
    setStatus('answer-status', 'Respuesta generada', 'success');
  } catch (err) {
    console.error(err);
    setStatus('answer-status', `Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function handleClearDB() {
  const btn = document.getElementById('clear-db-btn');
  btn.disabled = true;
  setStatus('clear-status', 'Limpiando base de datos...', 'loading');

  try {
    await clearAll();
    setStatus('clear-status', 'Base de datos limpiada', 'success');
    document.getElementById('ask-btn').disabled = true;
    document.getElementById('index-btn').disabled = true;
    document.getElementById('file-input').value = '';
    state.currentFile = null;
  } catch (err) {
    console.error(err);
    setStatus('clear-status', `Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ============================================================================
// Init
// ============================================================================

async function init() {
  const isolated = window.crossOriginIsolated;
  const statusText = document.getElementById('isolation-text');
  statusText.textContent = isolated
    ? '✓ crossOriginIsolated: true'
    : '✗ crossOriginIsolated: false';
  statusText.style.color = isolated ? '#48bb78' : '#f56565';

  await initDB();

  document.getElementById('load-model-btn').addEventListener('click', handleLoadModel);
  document.getElementById('file-input').addEventListener('change', handleFileChange);
  document.getElementById('index-btn').addEventListener('click', handleIndex);
  document.getElementById('ask-btn').addEventListener('click', handleAsk);
  document.getElementById('clear-db-btn').addEventListener('click', handleClearDB);
}

init();
