#!/bin/bash

echo "========================================="
echo "Descargando modelos LiquidAI LFM2-1.2B-RAG"
echo "========================================="

cd models/

# Función para verificar y descargar modelo
download_model() {
    local filename=$1
    local url=$2
    local size=$3

    if [ -f "$filename" ]; then
        echo "✓ $filename ya existe"
        return 0
    fi

    echo "Descargando $filename ($size)..."
    echo "Esto puede tardar varios minutos..."
    echo ""

    # Intentar con wget
    if command -v wget &> /dev/null; then
        wget -O "$filename" "$url"
    # Intentar con curl
    elif command -v curl &> /dev/null; then
        curl -L -o "$filename" "$url"
    else
        echo "✗ No se encontró wget ni curl"
        echo "Por favor, descarga manualmente desde: $url"
        echo "Y guárdalo como: models/$filename"
        return 1
    fi

    if [ -f "$filename" ]; then
        file_size=$(ls -lh "$filename" | awk '{print $5}')
        echo "✓ $filename descargado ($file_size)"
        return 0
    else
        echo "✗ Error al descargar $filename"
        return 1
    fi
}

# Descargar modelo Q4_K_M
echo "1. Descargando LiquidAI LFM2-1.2B-RAG Q4_K_M..."
download_model \
    "LiquidAI_LFM2-1.2B-RAG-Q4_K_M.gguf" \
    "https://huggingface.co/LiquidAI/LFM-1.5B-RAG-GGUF/resolve/main/LFM-1.5B-RAG-Q4_K_M.gguf" \
    "~800MB"

echo ""

# Descargar modelo Q5_K_M
echo "2. Descargando LiquidAI LFM2-1.2B-RAG Q5_K_M..."
download_model \
    "LiquidAI_LFM2-1.2B-RAG-Q5_K_M.gguf" \
    "https://huggingface.co/LiquidAI/LFM-1.5B-RAG-GGUF/resolve/main/LFM-1.5B-RAG-Q5_K_M.gguf" \
    "~1GB"

echo ""
echo "========================================="
echo "Resumen de descarga"
echo "========================================="

ls -lh LiquidAI_LFM2-1.2B-RAG-Q4_K_M.gguf 2>/dev/null && echo "✓ Q4_K_M listo" || echo "✗ Q4_K_M falta"
ls -lh LiquidAI_LFM2-1.2B-RAG-Q5_K_M.gguf 2>/dev/null && echo "✓ Q5_K_M listo" || echo "✗ Q5_K_M falta"

echo ""
echo "Descarga completada. Ahora puedes usar los modelos en la aplicación."
