# Verificación de Instalación - Local Chat RAG

## Estado Actual

### ✓ Archivos necesarios descargados:
- [x] `public/esm/single-thread/wllama.wasm` (2.1 MB)
- [x] `public/esm/multi-thread/wllama.wasm` (2.1 MB)
- [x] `public/lib/index.js` (módulo Wllama local)
- [x] `models/LFM2-350M.Q4_K_M.gguf` (469 MB)

### ✓ Servidor corriendo:
- Puerto: 3030
- URL: http://127.0.0.1:3030

### ✓ Configuración actualizada:
- [x] Import de Wllama cambiado a local (`./lib/index.js`)
- [x] Rutas WASM configuradas correctamente

## Pasos para verificar funcionamiento:

### 1. Verificar crossOriginIsolated
Abre http://127.0.0.1:3030 y verifica que se muestre:
```
✓ crossOriginIsolated: true
```

Si muestra `false`, verifica que el servidor esté sirviendo los headers COOP/COEP correctamente.

### 2. Probar carga del modelo
1. Click en "Cargar Modelo LLM"
2. Deberías ver:
   - "Cargando modelo LLM..."
   - "Cargando modelo de embeddings..."
   - "Modelo LLM y embeddings cargados" (en verde)

### 3. Probar indexación
1. Selecciona el archivo `ejemplo_epicrisis.json`
2. Click en "Indexar"
3. Deberías ver:
   - "Indexando X/Y chunks..."
   - "Indexación completa: X chunks" (en verde)

### 4. Probar consultas
1. Escribe una pregunta, por ejemplo: "¿Cuál fue el motivo de ingreso?"
2. Click en "Preguntar"
3. Deberías ver:
   - "Generando embedding de la pregunta..."
   - "Recuperando documentos..."
   - "Generando respuesta..."
   - La respuesta generada
   - Las fuentes utilizadas

## Errores comunes y soluciones:

### Error: "crossOriginIsolated: false"
**Causa**: Headers COOP/COEP no configurados correctamente
**Solución**:
- Reiniciar el servidor: `npm start`
- Verificar que estés accediendo vía http://127.0.0.1:3030 (no file://)

### Error al cargar módulos
**Causa**: Rutas incorrectas o archivos no descargados
**Solución**:
```bash
# Re-ejecutar el script de setup
./setup-wllama.sh
```

### Error 404 en archivos WASM
**Causa**: Archivos WASM no en la ubicación correcta
**Solución**:
```bash
ls -lh public/esm/single-thread/wllama.wasm
ls -lh public/esm/multi-thread/wllama.wasm
```

### Modelo muy lento o no responde
**Causa**: Modelo muy grande para tu hardware
**Solución**: Usar un modelo más pequeño (ej: TinyLlama)

## Logs de prueba:

Abre la consola del navegador (F12 → Console) y verifica que no haya errores rojos.

Los mensajes esperados incluyen:
- "Cargando modelo LLM..."
- "Modelo LLM cargado correctamente"
- Mensajes de indexación
- Mensajes de generación de respuesta

## Ejemplo de uso exitoso:

```
1. Cargar Modelo LLM → ✓ Modelo LLM y embeddings cargados
2. Subir archivo → ejemplo_epicrisis.json
3. Indexar → ✓ Indexación completa: 7 chunks
4. Preguntar: "¿Cuál fue el motivo de ingreso?"
5. Respuesta: "Paciente masculino de 45 años que consulta por dolor abdominal..."
```

## Siguiente paso:

Por favor, recarga la página (Ctrl+R) y prueba el flujo completo. Si encuentras algún error, comparte el mensaje de la consola del navegador.
