# 🧠 Cerebro Digital (AI Second Brain)

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

* 📥 **Bandeja de Entrada Inteligente (Inbox):** Interfaz de triaje rápido (Zero-Friction) para validar las propuestas de la IA sin abrir ventanas emergentes.
* 📚 **Cerebro Permanente:** Visualización de notas procesadas agrupadas automáticamente por categorías.
* 🏷️ **Filtrado Avanzado:** Sistema de selección múltiple de etiquetas, insensible a mayúsculas y acentos (`#Programación` = `#programacion`).
* 🧹 **Higiene de Datos:** Algoritmo integrado para detectar y limpiar notas duplicadas con un solo clic.
* 🔔 **Notificaciones Proactivas:** La extensión de Chrome cuenta con un *Badge* dinámico que te avisa de cuántas notas tienes pendientes de procesar, creando un hábito saludable de revisión.

---

## 🏗️ Arquitectura del Proyecto

El proyecto se divide en 3 pilares fundamentales:

1. **Extensión de Chrome:** Actúa como recolector. Extrae el contenido de la web activa y lo envía al backend. Muestra notificaciones de estado.
2. **Backend (FastAPI):** Servidor local en Python. Recibe los datos, interactúa con la IA para la extracción de metadatos, y expone los endpoints (GET, PUT, DELETE) para el frontend.
3. **Frontend Dashboard:** Aplicación web estática (HTML/CSS/JS Vanilla) de alto rendimiento. Interfaz oscura (Dark Mode), diseño responsivo y sin dependencias pesadas.

---

## 🛠️ Instalación y Uso (Local)

### 1. Iniciar el Backend (API)
Asegúrate de tener Python instalado. Abre una terminal en la carpeta del backend:
```bash
pip install fastapi uvicorn
# Añade aquí cualquier otra dependencia que uses (ej: openai, requests...)

# Iniciar el servidor
uvicorn main:app --host 0.0.0.0 --port 8000
```
### 2. Instalar la extensión de Chrome

1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el **"Modo desarrollador"** (arriba a la derecha).
3. Haz clic en **"Carga descomprimida"** y selecciona la carpeta que contiene la extensión.

### 3. Abrir el Dashboard

Simplemente haz doble clic en el archivo `index.html` para abrirlo en el navegador. (Opcionalmente, puedes servirlo con `python -m http.server 3000).

## 🎮 Demo del Flujo de Trabajo (Paso a Paso)

Para experimentar la verdadera magia del **Cerebro Digital**, te invitamos a seguir este recorrido de 60 segundos:

1. 🎯 **La Captura (Cero Fricción):** Navega a cualquier artículo, hilo de Twitter o página interesante. Haz clic en el icono de nuestra Extensión de Chrome. ¡Ya está! El contenido ha sido capturado.
2. 🔔 **La Magia en Segundo Plano:** Sin que tengas que hacer nada, la IA está procesando el texto. Fíjate en el icono de la extensión en tu navegador: aparecerá un **Badge rojo (1)** indicando que tienes nuevo conocimiento esperando ser validado.
3. 📥 **Triaje Inteligente (Inbox):** Abre el Dashboard web. En la pestaña *Bandeja de Entrada* te estará esperando la nota. Verás que la IA ya ha hecho el trabajo pesado: te propone una categoría y extrae las etiquetas clave.
4. ✅ **Validación (Human-in-the-loop):** Si te gusta la propuesta de la IA, no tienes que rellenar formularios. Simplemente haz clic en **"✅ Confirmar y Enviar al Cerebro"**. El badge de notificaciones desaparecerá instantáneamente.
5. 🧠 **El Cerebro Conectado:** Cambia a la pestaña *Cerebro Digital*. Verás tu nota mágicamente agrupada bajo su categoría correspondiente (con una tipografía limpia y estructurada). 
6. 🏷️ **Filtrado Avanzado:** Despliega el menú de etiquetas superior (▶ Mostrar más). Selecciona varias etiquetas a la vez y observa cómo la interfaz cruza los datos en milisegundos para mostrarte solo el conocimiento hiperespecífico que buscas.
7. 🧹 **Bonus - Higiene de Datos:** Intenta capturar la misma página web dos veces. Vuelve al Dashboard y haz clic en el botón **"🧹 Limpiar Duplicados"**. El sistema detectará la copia, te avisará y mantendrá tu Cerebro impecable.