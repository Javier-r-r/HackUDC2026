// Instalar menús contextuales
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "capture-selection",
    title: "🧠 Guardar texto en Digital Brain",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "capture-page",
    title: "🧠 Guardar página en Digital Brain",
    contexts: ["page"]
  });
});

// Manejar clics en el menú contextual
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const newItem = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    url: info.pageUrl || tab.url,
    title: tab.title || "Página sin título"
  };

  if (info.menuItemId === "capture-selection") {
    newItem.type = "text";
    newItem.content = info.selectionText;
  } else if (info.menuItemId === "capture-page") {
    newItem.type = "link";
    newItem.content = "Enlace guardado";
  }

  await saveToInbox(newItem);
});

// Función para guardar en el storage
async function saveToInbox(item) {
  const result = await chrome.storage.local.get({ inbox: [] });
  const updatedInbox = [item, ...result.inbox];
  await chrome.storage.local.set({ inbox: updatedInbox });
  console.log("Elemento guardado en Kelea Brain:", item);
}