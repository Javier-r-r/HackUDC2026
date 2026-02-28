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
    summary: "", // Iniciamos vacío para que lo llene la IA
    status: "pending" 
  };

  if (info.menuItemId === "capture-selection") {
    newItem.type = "text";
    newItem.content = info.selectionText;
    
    chrome.action.setBadgeText({ text: "..." });

    const aiData = await analyzeWithLLM(newItem.content);
    if (aiData) {
        newItem.category = aiData.category;
        newItem.tags = aiData.tags;
        newItem.summary = aiData.summary; // 👈 Ahora sí asignamos el resumen de la IA
        // Eliminado el error de pageText
    }
    
    chrome.action.setBadgeText({ text: "" });

  } else if (info.menuItemId === "capture-page") {
    newItem.type = "link";
    chrome.action.setBadgeText({ text: "IA" });

    try {
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText
      });

      const pageText = injectionResults[0].result;
      const truncatedText = pageText.substring(0, 5000);

      const aiData = await summarizePageWithLLM(truncatedText);

      if (aiData) {
        newItem.category = aiData.category;
        newItem.tags = aiData.tags;
        newItem.summary = aiData.summary; // 👈 Aseguramos que se guarde aquí
        newItem.content = aiData.summary; // Usamos el resumen como contenido principal para links
      } else {
        newItem.content = "Enlace guardado (Sin resumen de IA)";
      }
    } catch (e) {
      console.error("Error:", e);
      newItem.content = "Error extrayendo texto";
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
            3. "summary": Un resumen muy conciso (máximo 3 líneas) explicando de qué trata la página y por qué es útil.
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
  try {
    const response = await fetch('http://localhost:8000/capture', {  
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
      content: item.content, 
      source: item.url,
      category: item.category,
      tags: item.tags,
      summary: item.summary, // 👈 Asegúrate de que esta variable tenga el texto de la IA
      files: []
  })
    });

    if (response.ok) {
        console.log("✅ Captura enviada al Cerebro Digital");
    }
  } catch (error) {
    console.error("❌ Error enviando al servidor:", error);
    // Backup local si falla el servidor
    const result = await chrome.storage.local.get({ inbox: [] });
    await chrome.storage.local.set({ inbox: [item, ...result.inbox] });
  }
}

// background.js de tu extensión
async function checkPendingNotes() {
  try {
    const response = await fetch('http://192.168.1.10:8000/inbox');
    const items = await response.json();
    const pendingCount = items.filter(item => item.status === 'pending').length;

    if (pendingCount > 0) {
      // Pone el numerito en el icono de la extensión
      chrome.action.setBadgeText({ text: pendingCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#cf6679' });
    } else {
      // Quita el numerito si está limpio
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error("No se pudo conectar con el Cerebro");
  }
}

// Que compruebe cada vez que se abre el navegador y luego cada 5 minutos
checkPendingNotes();
setInterval(checkPendingNotes, 5 * 60 * 1000);