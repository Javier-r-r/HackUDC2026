document.addEventListener('DOMContentLoaded', async () => {
  // Elementos DOM
  const tabCapture = document.getElementById('tab-capture');
  const tabInbox = document.getElementById('tab-inbox');
  const viewCapture = document.getElementById('view-capture');
  const viewInbox = document.getElementById('view-inbox');
  const btnSave = document.getElementById('btn-save');
  const quickNote = document.getElementById('quick-note');
  const statusMsg = document.getElementById('status-msg');
  const inboxList = document.getElementById('inbox-list');
  const btnExport = document.getElementById('btn-export');

  // Navegación por pestañas
  tabCapture.addEventListener('click', () => switchTab(tabCapture, viewCapture, tabInbox, viewInbox));
  tabInbox.addEventListener('click', () => {
    switchTab(tabInbox, viewInbox, tabCapture, viewCapture);
    renderInbox();
  });

  function switchTab(activeTab, activeView, inactiveTab, inactiveView) {
    activeTab.classList.add('active');
    activeView.classList.add('active');
    inactiveTab.classList.remove('active');
    inactiveView.classList.remove('active');
  }

  // Guardar nota rápida
  btnSave.addEventListener('click', async () => {
    const text = quickNote.value.trim();
    if (!text) return;

    // Obtener la URL de la pestaña activa como contexto
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const newItem = {
      id: Date.now().toString(),
      type: 'idea',
      content: text,
      url: tab.url,
      title: tab.title,
      timestamp: new Date().toISOString()
    };

    const result = await chrome.storage.local.get({ inbox: [] });
    await chrome.storage.local.set({ inbox: [newItem, ...result.inbox] });

    quickNote.value = '';
    statusMsg.classList.remove('hidden');
    setTimeout(() => statusMsg.classList.add('hidden'), 2000);
  });

  // Renderizar Inbox
  async function renderInbox() {
    const result = await chrome.storage.local.get({ inbox: [] });
    inboxList.innerHTML = '';

    if (result.inbox.length === 0) {
      inboxList.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Inbox vacío.</p>';
      return;
    }

    result.inbox.forEach(item => {
      const div = document.createElement('div');
      div.className = 'inbox-item';
      
      const date = new Date(item.timestamp).toLocaleDateString('es-ES', {hour: '2-digit', minute:'2-digit'});
      const typeIcon = item.type === 'link' ? '🔗' : item.type === 'text' ? '📝' : '💡';

      div.innerHTML = `
        <div class="item-meta">
          <span>${typeIcon} ${item.type.toUpperCase()}</span>
          <span>${date}</span>
        </div>
        <p class="item-content">${item.content.substring(0, 80)}${item.content.length > 80 ? '...' : ''}</p>
      `;
      inboxList.appendChild(div);
    });
  }

  // Exportar a Markdown
  btnExport.addEventListener('click', async () => {
    const result = await chrome.storage.local.get({ inbox: [] });
    if (result.inbox.length === 0) return;

    let mdContent = '# 🧠 Kelea Digital Brain - Inbox Export\n\n';
    
    result.inbox.forEach(item => {
      mdContent += `## [${item.type.toUpperCase()}] ${item.title || 'Sin título'}\n`;
      mdContent += `- **Fecha:** ${new Date(item.timestamp).toLocaleString()}\n`;
      mdContent += `- **Fuente:** [Enlace Original](${item.url})\n\n`;
      mdContent += `> ${item.content}\n\n`;
      mdContent += `---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    // Crear un enlace temporal para descargar
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kelea-Brain-Export-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});