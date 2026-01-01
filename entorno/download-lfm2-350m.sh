#!/bin/bash

echo "========================================="
echo "Descargando LFM2-350M-Q8_0"
echo "========================================="

cd models/

if [ -f "LFM2-350M-Q8_0.gguf" ]; then
    echo "✓ El modelo LFM2-350M-Q8_0 ya existe"
    exit 0
fi

echo "Descargando LFM2-350M Q8_0 (~350MB)..."
echo "Este es el modelo más pequeño y rápido, ideal para pruebas."
echo ""

# Intentar con wget
if command -v wget &> /dev/null; then
    wget -O LFM2-350M-Q8_0.gguf https://huggingface.co/LiquidAI/LFM-350M-GGUF/resolve/main/LFM-350M-Q8_0.gguf
# Intentar con curl
elif command -v curl &> /dev/null; then
    curl -L -o LFM2-350M-Q8_0.gguf https://huggingface.co/LiquidAI/LFM-350M-GGUF/resolve/main/LFM-350M-Q8_0.gguf
else
    echo "✗ No se encontró wget ni curl"
    echo "Por favor, descarga manualmente el modelo desde:"
    echo "https://huggingface.co/LiquidAI/LFM-350M-GGUF/resolve/main/LFM-350M-Q8_0.gguf"
    echo "Y guárdalo como: models/LFM2-350M-Q8_0.gguf"
    exit 1
fi

if [ -f "LFM2-350M-Q8_0.gguf" ]; then
    size=$(ls -lh LFM2-350M-Q8_0.gguf | awk '{print $5}')
    echo ""
    echo "========================================="
    echo "✓ Modelo descargado correctamente"
    echo "Tamaño: $size"
    echo "========================================="
    echo ""
    echo "Este modelo es ideal para:"
    echo "- Pruebas rápidas"
    echo "- Hardware limitado (≤8GB RAM)"
    echo "- Respuestas rápidas con calidad aceptable"
else
    echo "✗ Error al descargar el modelo"
    exit 1
fi
