const API_BASE_URL = 'http://localhost:8000/inbox';

/**
 * Create context menu entries when the extension is installed.
 */
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

/**
 * Handle context menu clicks for selection and page captures.
 */
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
    newItem.summary = info.selectionText;

    chrome.action.setBadgeText({ text: "..." });
    chrome.action.setBadgeBackgroundColor({ color: "#bb86fc" });

    const aiData = await analyzeWithLLM(newItem.summary);
    if (aiData) {
      newItem.category = aiData.category;
      newItem.tags = aiData.tags;
    }
    chrome.action.setBadgeText({ text: "" });

  } else if (info.menuItemId === "capture-page") {
    newItem.type = "link";
    newItem.summary = "Procesando página... ⏳";

    chrome.action.setBadgeText({ text: "IA" });
    chrome.action.setBadgeBackgroundColor({ color: "#bb86fc" });

    try {
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const mainContent = document.querySelector('article, main') || document.body;
          return mainContent.innerText;
        }
      });

      const pageText = injectionResults[0].result;
      const truncatedText = pageText.substring(0, 5000);
      const aiData = await summarizePageWithLLM(truncatedText);

      if (aiData) {
        newItem.category = aiData.category;
        newItem.tags = aiData.tags;
        newItem.summary = aiData.summary;
      } else {
        newItem.summary = "Enlace guardado (Sin resumen de IA)";
      }

    } catch (e) {
      console.error("Error extrayendo texto:", e);
      newItem.summary = "Enlace guardado (No se pudo extraer el texto)";
    }
    chrome.action.setBadgeText({ text: "" });
  }

  await saveToInbox(newItem);
});

/**
 * Analyze a text string using the configured LLM and return parsed JSON
 * with `category` and `tags` or null on failure.
 * @param {string} text
 * @returns {Promise<{category:string,tags:string[]}|null>}
 */
async function analyzeWithLLM(text) {
  try {
    const result = await chrome.storage.local.get(['apiKey']);
    const apiKey = result.apiKey;

    if (!apiKey) {
      console.warn("⚠️ No hay API Key configurada.");
      return null;
    }

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
            content: `Eres un experto en Personal Knowledge Management (PKM). Tu tarea es analizar el texto del usuario y devolver un JSON estricto con dos campos: 1. "category": Una sola palabra que defina el área. 2. "tags": Un array de 1 a 3 etiquetas clave en minúsculas. Responde SOLO con el JSON validado, sin texto adicional.`
          },
          { role: "user", content: text }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    let resultText = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(resultText);
  } catch (error) {
    console.error("❌ Error en la IA:", error);
    return null;
  }
}

/**
 * Summarize a larger page text using the LLM and return parsed JSON
 * with `category`, `tags` and `summary` or null on failure.
 * @param {string} text
 * @returns {Promise<{category:string,tags:string[],summary:string}|null>}
 */
async function summarizePageWithLLM(text) {
  try {
    const result = await chrome.storage.local.get(['apiKey']);
    if (!result.apiKey) return null;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${result.apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `Eres un asistente experto en PKM. Analiza el siguiente texto y devuelve un JSON estricto con 3 campos: 1. "category": Una palabra clave. 2. "tags": Array de 1 a 3 etiquetas clave. 3. "summary": Un resumen muy conciso (máximo 3 líneas). Responde SOLO con el JSON validado.`
          },
          { role: "user", content: text }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    let resultText = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(resultText);
  } catch (error) {
    return null;
  }
}

/**
 * Save a note/item to the backend inbox API and refresh badge count.
 * @param {Object} item
 */
async function saveToInbox(item) {
  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });

    if (!response.ok) throw new Error(`Error en la API: ${response.status}`);
    console.log("✅ Nota guardada exitosamente en la API");
    checkPendingNotes();
  } catch (error) {
    console.error("❌ Error guardando en la API:", error);
  }
}

/**
 * Query the inbox and update the extension badge with pending notes count.
 */
async function checkPendingNotes() {
  try {
    const response = await fetch(API_BASE_URL);
    const items = await response.json();
    const pendingCount = items.filter(item => item.status === 'pending').length;

    if (pendingCount > 0) {
      chrome.action.setBadgeText({ text: pendingCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#cf6679' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error("No se pudo conectar con el Cerebro");
  }
}

chrome.alarms.create("checkPendingNotes", { periodInMinutes: 1 });

/**
 * Alarm handler - used to periodically refresh pending notes count.
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkPendingNotes") {
    checkPendingNotes();
  }
});

checkPendingNotes();
