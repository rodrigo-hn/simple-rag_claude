#!/bin/bash

echo "========================================="
echo "Descargando LFM2-1.2B-RAG"
echo "========================================="

cd models/

if [ -f "LFM2-1.2B-RAG.Q4_K_M.gguf" ]; then
    echo "✓ El modelo LFM2-1.2B-RAG ya existe"
    exit 0
fi

echo "Descargando Phi-2 Q4_K_M (~1.2GB)..."
echo "Esto puede tardar varios minutos dependiendo de tu conexión..."
echo ""

# Intentar con wget
if command -v wget &> /dev/null; then
    wget -O LFM2-1.2B-RAG.Q4_K_M.gguf https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf
# Intentar con curl
elif command -v curl &> /dev/null; then
    curl -L -o LFM2-1.2B-RAG.Q4_K_M.gguf https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf
else
    echo "✗ No se encontró wget ni curl"
    echo "Por favor, descarga manualmente el modelo desde:"
    echo "https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf"
    echo "Y guárdalo como: models/LFM2-1.2B-RAG.Q4_K_M.gguf"
    exit 1
fi

if [ -f "LFM2-1.2B-RAG.Q4_K_M.gguf" ]; then
    size=$(ls -lh LFM2-1.2B-RAG.Q4_K_M.gguf | awk '{print $5}')
    echo ""
    echo "========================================="
    echo "✓ Modelo descargado correctamente"
    echo "Tamaño: $size"
    echo "========================================="
else
    echo "✗ Error al descargar el modelo"
    exit 1
fi
