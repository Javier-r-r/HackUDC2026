document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const btnSave = document.getElementById('btn-save-options');
  const status = document.getElementById('status-options');

  // 1. Cargar la API Key guardada previamente
  const result = await chrome.storage.local.get(['apiKey']);
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }

  // 2. Guardar la nueva API Key al hacer clic
  btnSave.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    
    await chrome.storage.local.set({ apiKey: key });
    
    // Mostrar mensaje de éxito
    status.classList.remove('hidden');
    setTimeout(() => {
      status.classList.add('hidden');
    }, 2500);
  });
});