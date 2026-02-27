// ATENCIÓN: Para el hackathon, puedes poner tu clave aquí directamente para testear rápido, 
// pero en producción SIEMPRE debe ir en variables de entorno o en las Opciones de la extensión.
const API_KEY = "Groq API Key aquí"; 

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
    category: "Inbox", // Categoría por defecto
    tags: []
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
    newItem.content = "Enlace guardado";
    newItem.category = "Recurso";
  }

  await saveToInbox(newItem);
});

async function analyzeWithLLM(text) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // Modelo gratuito y ultrarrápido
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
      // Ahora sí veremos el error real formateado
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

async function saveToInbox(item) {
  const result = await chrome.storage.local.get({ inbox: [] });
  const updatedInbox = [item, ...result.inbox];
  await chrome.storage.local.set({ inbox: updatedInbox });
}