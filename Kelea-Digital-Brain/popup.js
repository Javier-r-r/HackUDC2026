document.addEventListener('DOMContentLoaded', () => {
  const btnSave = document.getElementById('btn-save');
  const fileInput = document.getElementById('file-input');
  const fileNameDisplay = document.getElementById('file-name-display');
  const quickNote = document.getElementById('quick-note');
  const statusMsg = document.getElementById('status-msg');

  let selectedFileBase64 = null;
  let selectedFileName = "";

  // Mostrar nombre del archivo al seleccionar
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedFileName = file.name;
      fileNameDisplay.textContent = `Archivo: ${file.name}`;
      fileNameDisplay.classList.remove('hidden');

      const reader = new FileReader();
      reader.onload = () => { selectedFileBase64 = reader.result.split(',')[1]; };
      reader.readAsDataURL(file);
    }
  });

  btnSave.addEventListener('click', async () => {
    const text = quickNote.value.trim();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const payload = {
      title: selectedFileName || tab.title || "Nueva entrada",
      content: text || (selectedFileName ? `Archivo adjunto: ${selectedFileName}` : ""),
      source: tab.url,
      entry_type: selectedFileBase64 ? "file" : "idea",
      file_data: selectedFileBase64, // Campo nuevo para el archivo
      file_name: selectedFileName
    };

    try {
      const response = await fetch('http://localhost:8000/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showStatus("¡Guardado correctamente!");
        resetForm();
      }
    } catch (err) {
      console.error("Error enviando al server:", err);
    }
  });

  function resetForm() {
    quickNote.value = '';
    fileInput.value = '';
    selectedFileBase64 = null;
    selectedFileName = "";
    fileNameDisplay.classList.add('hidden');
  }

  function showStatus(msg) {
    statusMsg.textContent = msg;
    statusMsg.classList.remove('hidden');
    setTimeout(() => statusMsg.classList.add('hidden'), 3000);
  }
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
