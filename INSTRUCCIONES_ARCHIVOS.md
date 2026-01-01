# Instrucciones para Descargar Archivos Necesarios

La aplicación necesita archivos WASM y el modelo LLM que no están incluidos en el repositorio por su tamaño.

## 1. Archivos WASM de Wllama

**Opción A: Descargar desde NPM (Recomendado)**

```bash
# Instalar wllama temporalmente
npm install @wllama/wllama

# Copiar archivos WASM
cp node_modules/@wllama/wllama/esm/single-thread/wllama.wasm public/esm/single-thread/
cp node_modules/@wllama/wllama/esm/multi-thread/wllama.wasm public/esm/multi-thread/

# Opcional: desinstalar wllama (ya que se carga desde CDN)
npm uninstall @wllama/wllama
```

**Opción B: Descargar desde GitHub**

1. Ve a: https://github.com/ngxson/wllama/tree/main/esm
2. Descarga los archivos:
   - `esm/single-thread/wllama.wasm`
   - `esm/multi-thread/wllama.wasm`
3. Colócalos en:
   - `public/esm/single-thread/wllama.wasm`
   - `public/esm/multi-thread/wllama.wasm`

## 2. Modelos LLM GGUF - LiquidAI LFM2-1.2B-RAG

La aplicación usa los modelos LiquidAI LFM2-1.2B-RAG optimizados para tareas de RAG:

**Opción A: Q4_K_M (Recomendado - Equilibrado)**

```bash
cd models/
wget -O LiquidAI_LFM2-1.2B-RAG-Q4_K_M.gguf \
  https://huggingface.co/LiquidAI/LFM-1.5B-RAG-GGUF/resolve/main/LFM-1.5B-RAG-Q4_K_M.gguf
```

- Tamaño: ~800MB
- Cuantización Q4_K_M
- Balance entre velocidad y calidad
- Recomendado para la mayoría de casos

**Opción B: Q5_K_M (Mayor calidad)**

```bash
cd models/
wget -O LiquidAI_LFM2-1.2B-RAG-Q5_K_M.gguf \
  https://huggingface.co/LiquidAI/LFM-1.5B-RAG-GGUF/resolve/main/LFM-1.5B-RAG-Q5_K_M.gguf
```

- Tamaño: ~1GB
- Cuantización Q5_K_M
- Mejor calidad de respuestas
- Requiere más recursos

**Alternativa: Usar cualquier modelo GGUF**

También puedes usar otros modelos GGUF. Solo necesitas:
1. Descargar el archivo `.gguf` a la carpeta `models/`
2. Renombrarlo según el nombre en el selector o agregar una nueva opción en `index.html`

Modelos recomendados:
- **TinyLlama** (1.1B): https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF
- **Mistral-7B** (7B): https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF
- **Llama-3** (8B): https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF

## 3. Script de descarga automático

Para descargar ambos modelos automáticamente:

```bash
./download-liquidai-models.sh
```

Este script descargará tanto Q4 como Q5 a la carpeta `models/`.

## 4. Verificar instalación

Después de descargar los archivos, verifica que existan:

```bash
ls -lh public/esm/single-thread/wllama.wasm
ls -lh public/esm/multi-thread/wllama.wasm
ls -lh models/LiquidAI_LFM2-1.2B-RAG-Q4_K_M.gguf
ls -lh models/LiquidAI_LFM2-1.2B-RAG-Q5_K_M.gguf
```

## 4. Script automatizado (opcional)

Crea un script `setup.sh`:

```bash
#!/bin/bash

echo "Descargando archivos WASM..."
npm install @wllama/wllama
cp node_modules/@wllama/wllama/esm/single-thread/wllama.wasm public/esm/single-thread/
cp node_modules/@wllama/wllama/esm/multi-thread/wllama.wasm public/esm/multi-thread/
npm uninstall @wllama/wllama

echo "Descargando modelo LLM..."
cd models/
wget -O LFM2-350M.Q4_K_M.gguf https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf

echo "Listo!"
```

Ejecuta con: `chmod +x setup.sh && ./setup.sh`

## 5. Tamaños aproximados

- `wllama.wasm` (single-thread): ~2MB
- `wllama.wasm` (multi-thread): ~2MB
- Modelo GGUF: 300MB - 4GB (dependiendo del modelo)

**Total**: ~300-400MB para configuración mínima
