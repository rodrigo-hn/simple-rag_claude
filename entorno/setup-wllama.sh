#!/bin/bash

echo "========================================="
echo "Configurando Wllama para Local Chat"
echo "========================================="

# Crear directorio temporal
mkdir -p temp_wllama

# Instalar wllama temporalmente
echo "Descargando @wllama/wllama..."
cd temp_wllama
npm init -y > /dev/null 2>&1
npm install @wllama/wllama > /dev/null 2>&1

# Copiar archivos WASM
echo "Copiando archivos WASM..."
mkdir -p ../public/esm/single-thread
mkdir -p ../public/esm/multi-thread

if [ -f "node_modules/@wllama/wllama/esm/single-thread/wllama.wasm" ]; then
    cp node_modules/@wllama/wllama/esm/single-thread/wllama.wasm ../public/esm/single-thread/
    echo "✓ Copiado: single-thread/wllama.wasm"
else
    echo "✗ No se encontró: single-thread/wllama.wasm"
fi

if [ -f "node_modules/@wllama/wllama/esm/multi-thread/wllama.wasm" ]; then
    cp node_modules/@wllama/wllama/esm/multi-thread/wllama.wasm ../public/esm/multi-thread/
    echo "✓ Copiado: multi-thread/wllama.wasm"
else
    echo "✗ No se encontró: multi-thread/wllama.wasm"
fi

# Copiar el módulo JS para servir localmente (opcional)
echo "Copiando módulo Wllama..."
mkdir -p ../public/lib
if [ -f "node_modules/@wllama/wllama/esm/index.js" ]; then
    cp -r node_modules/@wllama/wllama/esm/* ../public/lib/
    echo "✓ Copiado: módulo Wllama a public/lib/"
fi

# Limpiar
cd ..
rm -rf temp_wllama

echo ""
echo "========================================="
echo "Descargando modelo LLM de ejemplo"
echo "========================================="

# Descargar modelo pequeño para pruebas
if [ ! -f "models/LFM2-350M.Q4_K_M.gguf" ]; then
    echo "Descargando Qwen2.5-0.5B (~350MB)..."
    echo "Esto puede tardar varios minutos..."

    cd models/

    # Intentar con wget
    if command -v wget &> /dev/null; then
        wget -O LFM2-350M.Q4_K_M.gguf https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf
    # Intentar con curl
    elif command -v curl &> /dev/null; then
        curl -L -o LFM2-350M.Q4_K_M.gguf https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf
    else
        echo "✗ No se encontró wget ni curl"
        echo "Por favor, descarga manualmente el modelo desde:"
        echo "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF"
    fi

    cd ..

    if [ -f "models/LFM2-350M.Q4_K_M.gguf" ]; then
        echo "✓ Modelo descargado correctamente"
    fi
else
    echo "✓ El modelo ya existe"
fi

echo ""
echo "========================================="
echo "Verificación de archivos"
echo "========================================="

# Verificar archivos
check_file() {
    if [ -f "$1" ]; then
        size=$(ls -lh "$1" | awk '{print $5}')
        echo "✓ $1 ($size)"
        return 0
    else
        echo "✗ $1 - NO ENCONTRADO"
        return 1
    fi
}

check_file "public/esm/single-thread/wllama.wasm"
check_file "public/esm/multi-thread/wllama.wasm"
check_file "models/LFM2-350M.Q4_K_M.gguf"

echo ""
echo "========================================="
echo "Configuración completada!"
echo "========================================="
echo ""
echo "Próximos pasos:"
echo "1. npm start"
echo "2. Abrir http://127.0.0.1:3030"
echo ""
