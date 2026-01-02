import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('etag');
const PORT = 3030;

// Headers COOP/COEP/CORP globales
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

// Servir modelos desde models/ (GGUF) con soporte de Range (necesario para wllama/llama.cpp wasm)
const modelsPath = path.join(__dirname, '../../models');

app.get('/models/:file', (req, res) => {
  const file = req.params.file;
  console.log(`[models] ${req.method} ${req.originalUrl} range=${req.headers.range || 'none'}`);

  // Seguridad básica: solo permitir .gguf
  if (!file.endsWith('.gguf')) {
    return res.status(400).send('Only .gguf models are allowed');
  }

  const filePath = path.join(modelsPath, file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Model not found');
  }

  const stat = fs.statSync(filePath);
  const total = stat.size;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  // Evitar caches/transformaciones en archivos grandes
  res.setHeader('Cache-Control', 'no-store');
  res.removeHeader('ETag');
  res.removeHeader('Last-Modified');
  res.setHeader("X-Models-Handler", "range-gguf-v1");

  const range = req.headers.range;

  // Si no hay Range, enviar el archivo completo (puede ser pesado, pero correcto)
  if (!range) {
    res.setHeader('Content-Length', total);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Parse Range: bytes=start-end
  const m = /bytes=(\d+)-(\d*)/.exec(range);
  if (!m) {
    return res.status(416).send('Invalid Range');
  }

  const start = parseInt(m[1], 10);
  let end = m[2] ? parseInt(m[2], 10) : Math.min(start + 1024 * 1024 - 1, total - 1); // default 1MB

  if (Number.isNaN(start) || Number.isNaN(end) || start >= total) {
    res.status(416);
    res.setHeader('Content-Range', `bytes */${total}`);
    return res.end();
  }

  end = Math.min(end, total - 1);
  const chunkSize = end - start + 1;

  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
  res.setHeader('Content-Length', chunkSize);

  fs.createReadStream(filePath, { start, end }).pipe(res);
});

// Servir archivos estáticos desde public/ (después de /models para no interceptar)
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath));

// SPA fallback - servir index.html para todas las rutas (excepto /models)
app.get('*', (req, res) => {
  if (req.path.startsWith('/models/')) {
    return res.status(404).send('Model not found');
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving public/ from ${publicPath}`);
  console.log(`🤖 Serving models/ from ${modelsPath}`);
});
