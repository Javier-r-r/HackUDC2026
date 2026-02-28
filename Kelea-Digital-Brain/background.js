chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "capture-selection",
    title: "🧠 Guardar y Analizar texto",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "capture-page",
    title: "🧠 Guardar página",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const newItem = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    url: info.pageUrl || tab.url,
    title: tab.title || "Página sin título",
    category: "Inbox", 
    tags: [],
    status: "pending" 
  };

  if (info.menuItemId === "capture-selection") {
    newItem.type = "text";
    newItem.content = info.selectionText;
    
    // Mostramos un badge de "cargando" en el icono
    chrome.action.setBadgeText({ text: "..." });
    chrome.action.setBadgeBackgroundColor({ color: "#bb86fc" });

    // Llamada a la IA
    const aiData = await analyzeWithLLM(newItem.content);
    if (aiData) {
      newItem.category = aiData.category;
      newItem.tags = aiData.tags;
    }
    
    chrome.action.setBadgeText({ text: "" }); // Limpiamos el badge

  } else if (info.menuItemId === "capture-page") {
    newItem.type = "link";
    newItem.content = "Procesando página... ⏳"; // Mensaje temporal

    chrome.action.setBadgeText({ text: "IA" });
    chrome.action.setBadgeBackgroundColor({ color: "#bb86fc" });

    try {
      // 1. Inyectar script para extraer el texto de la web actual
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Intenta buscar el contenido principal, si no, coge todo el body
          const mainContent = document.querySelector('article, main') || document.body;
          return mainContent.innerText;
        }
      });

      const pageText = injectionResults[0].result;
      
      // 2. Cortamos el texto (primeros 5000 caracteres) para que la IA no se sature ni tarde mucho
      const truncatedText = pageText.substring(0, 5000);

      // 3. Mandamos el texto a la IA para que lo resuma
      const aiData = await summarizePageWithLLM(truncatedText);

      if (aiData) {
        newItem.category = aiData.category;
        newItem.tags = aiData.tags;
        newItem.content = aiData.summary; // Guardamos el resumen de 3 líneas
      } else {
        newItem.content = "Enlace guardado (Sin resumen de IA)";
      }

    } catch (e) {
      console.error("Error extrayendo texto de la página:", e);
      newItem.content = "Enlace guardado (No se pudo extraer el texto)";
    }

    chrome.action.setBadgeText({ text: "" });
  }

  await saveToInbox(newItem);
});

async function analyzeWithLLM(text) {
  try {
    // 1. OBTENER LA CLAVE DEL STORAGE
    const result = await chrome.storage.local.get(['apiKey']);
    const apiKey = result.apiKey;

    if (!apiKey) {
      console.warn("⚠️ No hay API Key configurada. Por favor, ve a las opciones de la extensión.");
      return null; // Devolvemos null para que se guarde sin categorizar pero no de error
    }

    // 2. HACER LA PETICIÓN USANDO LA CLAVE DINÁMICA
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` // Usamos la variable apiKey aquí
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // El modelo actual de Groq
        messages: [
          {
            role: "system",
            content: `Eres un experto en Personal Knowledge Management (PKM). 
            Tu tarea es analizar el texto del usuario y devolver un JSON estricto con dos campos:
            1. "category": Una sola palabra que defina el área (ej. Programación, Marketing, Filosofía, Herramienta).
            2. "tags": Un array de 1 a 3 etiquetas clave en minúsculas.
            Responde SOLO con el JSON validado, sin texto adicional.`
          },
          { role: "user", content: text }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Groq ha rechazado la petición:", JSON.stringify(errorData, null, 2));
      return null;
    }

    const data = await response.json();
    let resultText = data.choices[0].message.content;
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(resultText); 
    
  } catch (error) {
    console.error("❌ Error grave en la función de IA:", error);
    return null; 
  }
}

// Nueva función para resumir páginas web
async function summarizePageWithLLM(text) {
  try {
    const result = await chrome.storage.local.get(['apiKey']);
    const apiKey = result.apiKey;

    if (!apiKey) return null;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `Eres un asistente experto en PKM. Analiza el siguiente texto extraído de una página web y devuelve un JSON estricto con 3 campos:
            1. "category": Una palabra clave (ej. Tecnología, Tutorial, Noticia).
            2. "tags": Array de 1 a 3 etiquetas clave.
            3. "summary": Un resumen muy conciso (máximo 3 líneas) explicando de qué trata la página y por qué es útil.
            Responde SOLO con el JSON validado, sin texto adicional.`
          },
          { role: "user", content: text }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    let resultText = data.choices[0].message.content;
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(resultText); 
  } catch (error) {
    console.error("❌ Error en el resumen:", error);
    return null; 
  }
}

async function saveToInbox(item) {
  const result = await chrome.storage.local.get({ inbox: [] });
  const updatedInbox = [item, ...result.inbox];
  await chrome.storage.local.set({ inbox: updatedInbox });
}