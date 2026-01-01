#!/bin/bash

echo "========================================="
echo "Descarga de todos los modelos disponibles"
echo "========================================="
echo ""
echo "Este script descargará los siguientes modelos:"
echo "1. LFM2-350M Q8_0 (~350MB) - Rápido"
echo "2. LiquidAI LFM2-1.2B-RAG Q4_K_M (~800MB) - Equilibrado"
echo "3. LiquidAI LFM2-1.2B-RAG Q5_K_M (~1GB) - Mejor calidad"
echo ""
echo "Tamaño total aproximado: ~2.15GB"
echo ""
read -p "¿Deseas continuar? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[SsYy]$ ]]
then
    echo "Descarga cancelada."
    exit 1
fi

echo ""
echo "========================================="
echo "Iniciando descarga..."
echo "========================================="

# Modelo 1: LFM2-350M
echo ""
echo "1/3 - Descargando LFM2-350M Q8_0..."
./download-lfm2-350m.sh

# Modelo 2 y 3: LiquidAI RAG
echo ""
echo "2-3/3 - Descargando LiquidAI LFM2-1.2B-RAG (Q4 y Q5)..."
./download-liquidai-models.sh

echo ""
echo "========================================="
echo "Resumen de modelos descargados"
echo "========================================="

cd models/

if [ -f "LFM2-350M-Q8_0.gguf" ]; then
    size=$(ls -lh LFM2-350M-Q8_0.gguf | awk '{print $5}')
    echo "✓ LFM2-350M Q8_0: $size"
else
    echo "✗ LFM2-350M Q8_0: No descargado"
fi

if [ -f "LiquidAI_LFM2-1.2B-RAG-Q4_K_M.gguf" ]; then
    size=$(ls -lh LiquidAI_LFM2-1.2B-RAG-Q4_K_M.gguf | awk '{print $5}')
    echo "✓ LiquidAI LFM2-1.2B-RAG Q4: $size"
else
    echo "✗ LiquidAI LFM2-1.2B-RAG Q4: No descargado"
fi

if [ -f "LiquidAI_LFM2-1.2B-RAG-Q5_K_M.gguf" ]; then
    size=$(ls -lh LiquidAI_LFM2-1.2B-RAG-Q5_K_M.gguf | awk '{print $5}')
    echo "✓ LiquidAI LFM2-1.2B-RAG Q5: $size"
else
    echo "✗ LiquidAI LFM2-1.2B-RAG Q5: No descargado"
fi

echo ""
echo "========================================="
echo "Descarga completada!"
echo "========================================="
echo ""
echo "Recarga la página y selecciona el modelo que desees usar."
