# Cambios Realizados - Selector de Modelos

## Resumen
Se agregó un selector de modelos a la aplicación que permite elegir entre dos modelos LLM antes de cargarlos.

## Cambios en los archivos

### 1. public/index.html
- Agregado dropdown `<select>` para seleccionar el modelo
- Opciones disponibles:
  - `LFM2-350M.Q4_K_M.gguf` (350MB - Rápido)
  - `LFM2-1.2B-RAG.Q4_K_M.gguf` (1.2GB - Mejor calidad)

### 2. public/style.css
- Nuevos estilos para `.model-selector-group`
- Nuevos estilos para `.model-label`
- Nuevos estilos para `.model-select` con efectos hover y focus

### 3. public/app.js
- Modificada función `handleLoadModel()` para:
  - Leer el modelo seleccionado del dropdown
  - Deshabilitar el selector durante la carga
  - Mostrar el nombre del modelo en el mensaje de estado
  - Construir la URL del modelo dinámicamente
  - Re-habilitar el selector en caso de error

### 4. INSTRUCCIONES_ARCHIVOS.md
- Actualizado con información sobre los dos modelos
- Agregadas instrucciones para descargar LFM2-1.2B-RAG
- Agregadas sugerencias de modelos alternativos

### 5. README.md
- Actualizada sección de modelos GGUF
- Agregada información sobre el selector de modelos
- Actualizado flujo de uso

### 6. Nuevos archivos
- `download-lfm2-1.2b.sh`: Script para descargar el modelo LFM2-1.2B-RAG

## Uso del selector

1. **Al cargar la página**: El selector muestra por defecto "LFM2-350M"
2. **Cambiar modelo**: Click en el dropdown y seleccionar el modelo deseado
3. **Cargar**: Click en "Cargar Modelo LLM"
4. **Durante la carga**: El selector se deshabilita para evitar cambios
5. **Después de cargar**: Si hay éxito, el modelo queda cargado. Si hay error, el selector se habilita nuevamente

## Descargar el modelo LFM2-1.2B-RAG

Para usar el segundo modelo, ejecuta:

```bash
./download-lfm2-1.2b.sh
```

Este script descargará el modelo Phi-2 Q4_K_M (~1.2GB) y lo guardará como `LFM2-1.2B-RAG.Q4_K_M.gguf` en la carpeta `models/`.

## Agregar más modelos

Para agregar un nuevo modelo al selector:

1. Descarga el archivo `.gguf` a la carpeta `models/`
2. Edita `public/index.html` y agrega una nueva opción en el `<select>`:
   ```html
   <option value="nombre-del-modelo.gguf">Nombre Mostrado (Tamaño)</option>
   ```
3. El modelo estará disponible en el selector automáticamente

## Modelos recomendados

- **LFM2-350M** (~350MB): Ideal para pruebas rápidas y hardware limitado
- **LFM2-1.2B-RAG** (~1.2GB): Mejor calidad de respuestas para RAG
- **TinyLlama** (~1.1GB): Bueno para español, rápido
- **Mistral-7B** (~4GB): Excelente calidad, requiere más RAM
- **Llama-3** (~5GB): Última generación, mejor rendimiento

## Notas técnicas

- El selector se deshabilita durante la carga para evitar cambios de modelo mientras se está cargando
- La URL del modelo se construye dinámicamente: `${baseUrl}/models/${selectedModel}`
- El modelo seleccionado se muestra en los mensajes de estado
- Si la carga falla, el selector se vuelve a habilitar para permitir seleccionar otro modelo
