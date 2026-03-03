# 🧠🐦‍⬛ Muninn (AI Second Brain)

> Un sistema de Gestión del Conocimiento Personal (PKM) impulsado por IA, diseñado para capturar contenido web sin fricción, clasificarlo inteligentemente y construir tu propia base de conocimiento interconectada.

![Estado](https://img.shields.io/badge/Estado-MVP_Hackathon-success)
![Tecnologías](https://img.shields.io/badge/Stack-FastAPI%20%7C%20Vanilla_JS%20%7C%20Chrome_Ext-blue)

## 💡 El Problema
Diariamente consumimos decenas de artículos, hilos y recursos interesantes, pero guardarlos en marcadores convencionales los convierte en un "agujero negro" de información que nunca volvemos a leer. Falta una capa de inteligencia y un flujo de revisión rápido.

## 🚀 La Solución
**Cerebro Digital** soluciona esto mediante un flujo de trabajo *Human-in-the-loop*:
1. **Captura:** Guardas contenido a través de nuestra Extensión de Chrome en 1 clic.
2. **Clasificación AI:** La Inteligencia Artificial analiza el texto, propone una categoría y extrae etiquetas clave automáticamente.
3. **Triaje sin Fricción:** Un Dashboard minimalista donde el humano valida o corrige la propuesta de la IA en segundos.
4. **Conocimiento:** El contenido pasa a tu Cerebro Permanente, organizado, deduplicado y fácilmente filtrable.

---

## ✨ Características Principales

* 📥 **Bandeja de Entrada Inteligente (Inbox):** Interfaz de triaje rápido para validar las propuestas de la IA sin abrir ventanas emergentes.
* 📚 **Cerebro Permanente:** Visualización de notas procesadas agrupadas automáticamente por categorías.
* 🕸️ **Grafo de Conocimiento:** Red interactiva generada dinámicamente que conecta tus notas a través de sus etiquetas para un descubrimiento visual.
* ✨ **Búsqueda Semántica (RAG):** Encuentra notas por concepto o contexto usando una base de datos vectorial (ChromaDB), no solo por palabras exactas.
* 🎙️ **Transcripción y OCR:** Graba notas de voz o sube PDFs; el backend se encarga de transcribir y extraer el texto automáticamente antes de resumirlo.
* 🌍 **Aprendizaje Proactivo:** Botón "Conocer más" que consulta a la IA en tiempo real para sugerirte 3 enlaces reales donde seguir investigando sobre tu nota.
* 🧹 **Higiene de Datos:** Algoritmo integrado para detectar y limpiar notas duplicadas con un solo clic.

---

## 🏗️ Arquitectura del Proyecto

El proyecto se divide en 3 pilares fundamentales:

1. **Extensión de Chrome (Manifest V3):** Actúa como recolector. Extrae el contenido de la web, graba audio y se comunica con la API.
2. **Backend (FastAPI + ChromaDB):** Servidor local en Python. Recibe los datos, interactúa con la IA de Groq (LLaMA 3 / Whisper) para extraer metadatos, gestiona RAG y expone los endpoints (GET, PUT, DELETE).
3. **Frontend Dashboard:** Aplicación web estática (HTML/CSS/JS Vanilla) de alto rendimiento. Interfaz oscura, motor de físicas para el grafo y sin dependencias pesadas.

---

## 🛠️ Instalación y Uso (Local)

**🔑 Requisito previo: API Key de Groq**
Para que la Inteligencia Artificial funcione a la velocidad del rayo, necesitarás una clave API de [Groq](https://console.groq.com/).

### 1. Iniciar el Backend (API)
Asegúrate de tener Python instalado. Abre una terminal en la carpeta del backend:
```bash
pip install fastapi uvicorn pyyaml groq chromadb sentence-transformers pdfplumber
```
**⚠️ Configura la IA en el Backend:** Para proteger tu clave y no exponerla en el código fuente, la cargaremos mediante un archivo de entorno.

1. Crea un archivo llamado `.env` en la misma carpeta que `main.py`.
2. Escribe tu clave dentro del archivo con este formato:
   
```powershell
    GROQ_API_KEY=gsk_TU_CLAVE_AQUI
```

Una vez configurada la clave en tu archivo `.env`, inicia el servidor:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```
### 2. Instalar y Configurar la extensión de Chrome

1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el **"Modo desarrollador"** (arriba a la derecha).
3. Haz clic en **"Carga descomprimida"** y selecciona la carpeta que contiene la extensión.
4. **⚠️ Configura la IA en la Extensión:** Haz clic derecho sobre el icono del cerebro en la barra de extensiones de Chrome y pulsa en **"Opciones"**. Pega ahí tu API Key de Groq y guárdala.

### 3. Abrir el Dashboard

Haz doble clic en el archivo `index.html` para abrir tu Cerebro Digital en el navegador. *(Nota: La primera vez que uses la función "Conocer más" dentro del Dashboard, el navegador te pedirá la API Key por motivos de seguridad del LocalStorage).*

---

## 🎮 Demo del Flujo de Trabajo (Paso a Paso)

Para experimentar la verdadera magia del **Cerebro Digital**, te invitamos a seguir este recorrido de 60 segundos:

1. 🎯 **La Captura (Cero Fricción):** Navega a cualquier artículo o haz clic en el micrófono de la extensión para grabar una idea. ¡Ya está capturado!
2. 🔔 **La Magia en Segundo Plano:** La IA de Groq procesa el texto o audio. El icono de la extensión mostrará un **Badge rojo (1)** indicando conocimiento pendiente.
3. 📥 **Triaje Inteligente (Inbox):** Abre el Dashboard web. En *Bandeja de Entrada* verás tu nota con categoría, resumen y etiquetas propuestas por la IA.
4. ✅ **Validación (Human-in-the-loop):** Haz clic en **"✅ Confirmar y Enviar al Cerebro"**. El badge desaparecerá.
5. 🕸️ **Exploración:** Cambia a la pestaña *Grafo de Conocimiento*. Verás tus notas orbitando alrededor de sus etiquetas en tiempo real.
6. ✨ **Búsqueda Semántica:** Usa la barra de búsqueda y pulsa "✨ Ranking IA". El sistema usará embeddings vectoriales para encontrar notas relacionadas por concepto, no por texto exacto.
