# Local Chat - RAG en el Navegador

Aplicación de chat con RAG (Retrieval-Augmented Generation) que funciona 100% en el navegador usando:
- **LLM**: Wllama con modelo GGUF (`LFM2-350M.Q4_K_M.gguf`)
- **Embeddings**: Transformers.js con `multilingual-e5-small`
- **Almacenamiento**: IndexedDB
- **Backend**: Express (solo para servir archivos estáticos)

## Requisitos

- Node.js 18 o superior
- Navegador moderno con soporte para WebAssembly y SharedArrayBuffer

## Instalación

1. Instalar dependencias:
```bash
npm run setup
```

Este comando instalará las dependencias del backend y compilará el código TypeScript.

## Configuración de archivos WASM y modelo

### 1. Archivos WASM de Wllama

Descarga los archivos WASM de Wllama y colócalos en:
- `public/esm/single-thread/wllama.wasm`
- `public/esm/multi-thread/wllama.wasm`

Puedes obtenerlos de: https://github.com/ngxson/wllama/tree/main/esm

### 2. Modelos LLM GGUF - LiquidAI LFM2-1.2B-RAG

La aplicación incluye un selector con dos versiones del modelo LiquidAI LFM2-1.2B-RAG:

**Modelo Q4 (Recomendado - Equilibrado):**
- Archivo: `LiquidAI_LFM2-1.2B-RAG-Q4_K_M.gguf` (~800MB)
- Cuantización Q4_K_M: Balance entre tamaño y calidad

**Modelo Q5 (Mayor calidad):**
- Archivo: `LiquidAI_LFM2-1.2B-RAG-Q5_K_M.gguf` (~1GB)
- Cuantización Q5_K_M: Mejor calidad de respuestas

**Descargar ambos modelos:**
```bash
./download-liquidai-models.sh
```

Puedes agregar más modelos GGUF descargándolos a la carpeta `models/` y agregando opciones en `public/index.html`.

## Uso

1. Iniciar el servidor:
```bash
npm start
```

2. Abrir el navegador en:
```
http://<IP>:3030
```

**Nota**: Reemplaza `<IP>` con tu dirección IP local (ej: `192.168.1.10` o `localhost`)

3. Verificar que `crossOriginIsolated` sea `true` en la UI

## Flujo de uso

1. **Seleccionar y Cargar Modelo LLM**:
   - Selecciona el modelo deseado del dropdown (Q4 o Q5)
   - Click en "Cargar Modelo LLM" para inicializar Wllama y el modelo de embeddings
   - Q4 es más rápido, Q5 tiene mejor calidad de respuestas

2. **Subir Documento**: Selecciona un archivo JSON con formato de epicrisis

3. **Indexar**: Click en "Indexar" para procesar el documento:
   - Crea chunks por secciones (resumen, evolución, labs, alta)
   - Genera embeddings con prefijo "passage:"
   - Guarda en IndexedDB

4. **Preguntar**: Escribe tu pregunta y presiona "Preguntar":
   - Genera embedding con prefijo "query:"
   - Recupera top-10 chunks más relevantes
   - Aplica MMR para seleccionar 4 chunks diversos
   - Genera respuesta con el LLM
   - Muestra fuentes utilizadas

## Formato del JSON de epicrisis

```json
{
  "id_atencion": "1416169",
  "motivo_ingreso": "Dolor abdominal",
  "antecedentes": "HTA, DM2",
  "diagnostico_ingreso": "Abdomen agudo",
  "diagnostico_egreso": "Apendicitis aguda",
  "procedimientos": "Apendicectomía laparoscópica",
  "tratamientos": "ATB + analgesia",
  "evolucion_resumen": [
    {
      "dia": 1,
      "texto": "Paciente ingresa con dolor abdominal..."
    }
  ],
  "laboratorios_resumen": [
    {
      "examen": "Leucocitos",
      "resultado": "15000",
      "fecha": "2024-01-10"
    }
  ],
  "indicaciones_alta": {
    "medicamentos": "Paracetamol 500mg c/8h",
    "controles": "Control en 7 días",
    "cuidados": "Reposo relativo",
    "signos_alarma": "Fiebre, dolor intenso"
  }
}
```

## Estructura del proyecto

```
local-chat/
├── backend/
│   ├── src/
│   │   └── server.ts      # Servidor Express
│   ├── package.json
│   └── tsconfig.json
├── public/
│   ├── index.html         # UI principal
│   ├── app.js            # Lógica de la app
│   ├── style.css         # Estilos
│   └── esm/
│       ├── single-thread/
│       │   └── wllama.wasm
│       └── multi-thread/
│           └── wllama.wasm
├── models/
│   └── LFM2-350M.Q4_K_M.gguf
├── package.json
└── README.md
```

## Características técnicas

- **Cross-Origin Isolation**: Headers COOP/COEP/CORP configurados para habilitar SharedArrayBuffer
- **Embeddings locales**: Modelo multilingual-e5-small (384 dims) con prefijos obligatorios
- **Retrieval**: Cosine similarity + MMR (λ=0.7) para diversidad
- **Chunking inteligente**: Por secciones del documento médico
- **Almacenamiento persistente**: IndexedDB para chunks y vectores

## Troubleshooting

### crossOriginIsolated es false
- Verifica que el servidor esté corriendo en `http://IP:3030` (no `file://`)
- Asegúrate de que los headers COOP/COEP estén configurados correctamente

### Error al cargar el modelo
- Verifica que el archivo `.gguf` esté en `models/`
- Verifica que los archivos `.wasm` estén en `public/esm/`

### Error de memoria
- El modelo GGUF puede requerir bastante RAM
- Cierra otras pestañas del navegador
- Usa un modelo más pequeño si es necesario

## Puerto del servidor

El servidor escucha en el puerto `3030` en todas las interfaces de red (`0.0.0.0`).

## Licencia

MIT
