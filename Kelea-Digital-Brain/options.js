/**
 * Initialize the options page: load stored API key and bind save button.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const btnSave = document.getElementById('btn-save-options');
  const status = document.getElementById('status-options');

  const result = await chrome.storage.local.get(['apiKey']);
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }

  btnSave.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();

    await chrome.storage.local.set({ apiKey: key });

    status.classList.remove('hidden');
    setTimeout(() => {
      status.classList.add('hidden');
    }, 2500);
  });
});