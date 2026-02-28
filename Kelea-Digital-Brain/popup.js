document.addEventListener('DOMContentLoaded', async () => {
  const tabCapture = document.getElementById('tab-capture');
  const tabInbox = document.getElementById('tab-inbox');
  const viewCapture = document.getElementById('view-capture');
  const viewInbox = document.getElementById('view-inbox');
  const btnSave = document.getElementById('btn-save');
  const quickNote = document.getElementById('quick-note');
  const statusMsg = document.getElementById('status-msg');
  const inboxList = document.getElementById('inbox-list');
  const btnExport = document.getElementById('btn-export');
  const btnClear = document.getElementById('btn-clear');

  // Navegación
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

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const newItem = {
      id: Date.now().toString(),
      type: 'idea',
      content: text,
      url: tab?.url || '',
      title: tab?.title || 'Idea rápida',
      category: 'Idea',
      timestamp: new Date().toISOString()
    };

    const result = await chrome.storage.local.get({ inbox: [] });
    await chrome.storage.local.set({ inbox: [newItem, ...result.inbox] });

    quickNote.value = '';
    statusMsg.classList.remove('hidden');
    setTimeout(() => statusMsg.classList.add('hidden'), 2000);
  });

  // Renderizar Inbox a prueba de fallos
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
      const safeType = item.type || 'text';
      const typeIcon = safeType === 'link' ? '🔗' : safeType === 'text' ? '📝' : '💡';
      
      const tagsHTML = item.tags && item.tags.length > 0 
        ? item.tags.map(tag => `<span class="tag">#${tag}</span>`).join(' ') 
        : '';
      
      const categoryHTML = item.category ? `<span class="category">[${item.category}]</span>` : '';

      div.innerHTML = `
        <div class="item-meta">
          <span>${typeIcon} ${safeType.toUpperCase()} ${categoryHTML}</span>
          <span>${date}</span>
        </div>
        <p class="item-content">${(item.content || '').substring(0, 80)}${(item.content || '').length > 80 ? '...' : ''}</p>
        <div class="item-tags">${tagsHTML}</div>
      `;
      inboxList.appendChild(div);
    });
  }

  // Exportar a Markdown blindado
  btnExport.addEventListener('click', async () => {
    const result = await chrome.storage.local.get({ inbox: [] });
    if (result.inbox.length === 0) {
      alert("El Inbox está vacío");
      return;
    }

    let mdContent = '# 🧠 Kelea Digital Brain - Inbox Export\n\n';
    
    result.inbox.forEach(item => {
      // Usamos fallbacks lógicos para que no crashee si faltan datos
      const type = (item.type || 'nota').toUpperCase();
      const title = item.title || 'Sin título';
      const url = item.url || 'Sin enlace';
      const category = item.category || 'Inbox';
      const tags = item.tags && item.tags.length > 0 ? item.tags.map(t => `#${t}`).join(' ') : '';

      mdContent += `## [${type}] ${title}\n`;
      mdContent += `- **Fecha:** ${new Date(item.timestamp).toLocaleString()}\n`;
      mdContent += `- **Categoría:** ${category} \n`;
      if (tags) {
        mdContent += `- **Etiquetas:** ${tags}\n`;
      }
      
      if (url !== 'Sin enlace') {
        mdContent += `- **Fuente:** [Ver enlace original](${url})\n\n`;
      } else {
        mdContent += `- **Fuente:** Sin enlace\n\n`;
      }
      
      mdContent += `> ${item.content || 'Sin contenido'}\n\n`;
      mdContent += `---\n\n`;
    });

    try {
      const blob = new Blob([mdContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Kelea-Brain-Export-${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error al exportar:", e);
      alert("Hubo un error al generar el archivo. Revisa la consola.");
    }
  });

  // Lógica para vaciar el Inbox
  btnClear.addEventListener('click', async () => {
    // 1. Comprobar si ya está vacío para no hacer nada
    const result = await chrome.storage.local.get({ inbox: [] });
    if (result.inbox.length === 0) {
      alert("El Inbox ya está vacío.");
      return;
    }

    // 2. Pedir confirmación al usuario (¡Muy importante en UX!)
    const confirmacion = confirm("¿Estás seguro de que quieres eliminar TODO el Inbox? Esta acción no se puede deshacer.");
    
    // 3. Si acepta, vaciamos el array en chrome.storage y volvemos a renderizar
    if (confirmacion) {
      await chrome.storage.local.set({ inbox: [] });
      renderInbox(); // Actualiza la vista para que se vea vacío
      
      // Opcional: mostrar un mensajito temporal
      const oldText = btnClear.innerHTML;
      btnClear.innerHTML = "✨ Inbox limpio";
      setTimeout(() => btnClear.innerHTML = oldText, 2000);
    }
  });

});