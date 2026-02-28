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


    
    chrome.action.setBadgeText({ text: "" }); // Limpiamos el badge

  } else if (info.menuItemId === "capture-page") {
    newItem.type = "link";
    newItem.content = "Enlace guardado";
    newItem.category = "Recurso";
  }

  await saveToInbox(newItem);
});


// Función actualizada para enviar datos al servidor FastAPI
async function saveToInbox(item) {
  try {
    // Intentar enviar al servidor
    const response = await fetch('http://localhost:8000/capture', {  
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: item.content,
        source: item.url,
        entry_type: item.type,
        title: item.title
      })
    });
  } catch (error) {
    console.error("❌ Error de red (¿Está el servidor encendido?):", error);
    
    // Backup: Guardar localmente si el servidor no responde
    const result = await chrome.storage.local.get({ inbox: [] });
    await chrome.storage.local.set({ inbox: [item, ...result.inbox] });
  }
}