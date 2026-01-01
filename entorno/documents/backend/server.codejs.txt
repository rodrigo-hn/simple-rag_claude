import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3030;

// Headers COOP/COEP/CORP globales
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

// Servir archivos estáticos desde public/
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath));

// Servir modelos desde models/
const modelsPath = path.join(__dirname, '../../models');
app.use('/models', express.static(modelsPath));

// SPA fallback - servir index.html para todas las rutas
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving public/ from ${publicPath}`);
  console.log(`🤖 Serving models/ from ${modelsPath}`);
});
