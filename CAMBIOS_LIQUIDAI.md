# Cambios - Modelos LiquidAI LFM2-1.2B-RAG

## Resumen
Se actualizó la aplicación para usar los modelos LiquidAI LFM2-1.2B-RAG optimizados para tareas de RAG.

## Modelos Actualizados

### Antes:
- LFM2-350M.Q4_K_M.gguf (350MB)
- LFM2-1.2B-RAG.Q4_K_M.gguf (1.2GB)

### Ahora:
- **LiquidAI_LFM2-1.2B-RAG-Q4_K_M.gguf** (~800MB)
  - Cuantización Q4_K_M
  - Balance entre velocidad y calidad
  - Recomendado para la mayoría de casos

- **LiquidAI_LFM2-1.2B-RAG-Q5_K_M.gguf** (~1GB)
  - Cuantización Q5_K_M
  - Mejor calidad de respuestas
  - Requiere más recursos pero mejor precisión

## Archivos Modificados

### 1. public/index.html
```html
<option value="LiquidAI_LFM2-1.2B-RAG-Q4_K_M.gguf">LiquidAI LFM2-1.2B-RAG Q4 (~800MB - Equilibrado)</option>
<option value="LiquidAI_LFM2-1.2B-RAG-Q5_K_M.gguf">LiquidAI LFM2-1.2B-RAG Q5 (~1GB - Mejor calidad)</option>
```

### 2. download-liquidai-models.sh (NUEVO)
Script automatizado para descargar ambos modelos desde HuggingFace.

### 3. README.md
- Actualizada sección de modelos GGUF
- Información sobre cuantizaciones Q4 y Q5
- Instrucciones de descarga

### 4. INSTRUCCIONES_ARCHIVOS.md
- Comandos wget actualizados para LiquidAI
- Descripción de diferencias entre Q4 y Q5
- Script de descarga automático

## Ventajas de los Modelos LiquidAI

### LFM2-1.2B-RAG
- Específicamente entrenado para tareas de RAG
- Mejor comprensión de contexto
- Optimizado para responder basándose en documentos proporcionados
- Menor alucinación en comparación con modelos genéricos

### Cuantización Q4_K_M vs Q5_K_M

**Q4_K_M:**
- Menor tamaño (~800MB)
- Más rápido
- Menor uso de RAM
- Buena calidad para la mayoría de casos

**Q5_K_M:**
- Mayor tamaño (~1GB)
- Mejor calidad de respuestas
- Más preciso
- Recomendado si tienes recursos disponibles

## Descargar Modelos

### Método 1: Script automatizado (Recomendado)
```bash
./download-liquidai-models.sh
```

### Método 2: Manual
```bash
cd models/

# Q4_K_M
wget -O LiquidAI_LFM2-1.2B-RAG-Q4_K_M.gguf \
  https://huggingface.co/LiquidAI/LFM-1.5B-RAG-GGUF/resolve/main/LFM-1.5B-RAG-Q4_K_M.gguf

# Q5_K_M
wget -O LiquidAI_LFM2-1.2B-RAG-Q5_K_M.gguf \
  https://huggingface.co/LiquidAI/LFM-1.5B-RAG-GGUF/resolve/main/LFM-1.5B-RAG-Q5_K_M.gguf
```

## Uso

1. Descargar los modelos usando el script
2. Recargar la página de la aplicación
3. Seleccionar el modelo deseado del dropdown
4. Click en "Cargar Modelo LLM"

## Recomendaciones

- **Para pruebas iniciales**: Usar Q4_K_M
- **Para producción/mejor calidad**: Usar Q5_K_M
- Si tienes ≤8GB RAM: Usar Q4_K_M
- Si tienes ≥16GB RAM: Puedes usar Q5_K_M sin problemas

## Fuente de los Modelos

- **Organización**: LiquidAI
- **Repositorio**: https://huggingface.co/LiquidAI/LFM-1.5B-RAG-GGUF
- **Licencia**: Verificar en HuggingFace
- **Formato**: GGUF (compatible con Wllama)
