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
  const btnMic = document.getElementById('btn-mic');
  
  const API_BASE_URL = 'http://192.168.1.10:8000/inbox';
  let isRecording = false; 

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

  async function saveToAPI(newItem) {
    await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem)
    });
  }

  async function renderInbox() {
    inboxList.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Cargando notas...</p>';
    
    try {
      const response = await fetch(API_BASE_URL);
      if (!response.ok) throw new Error("Error de red");
      
      const allItems = await response.json();
      const pendingItems = allItems.filter(item => item.status === 'pending');

      inboxList.innerHTML = '';

      if (pendingItems.length === 0) {
        inboxList.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Inbox vacío. ¡Todo al día! ✨</p>';
        return;
      }

      pendingItems.forEach(item => {
        const safeId = item.id || item.filename || item._id;
        const div = document.createElement('div');
        div.className = 'inbox-item';
        
        const safeType = item.type || 'text';
        const typeIcon = safeType === 'link' ? '🔗' : safeType === 'text' ? '📝' : '💡';
        
        const tagsHTML = item.tags && item.tags.length > 0 
          ? item.tags.map(tag => `<span class="tag">#${tag}</span>`).join(' ') 
          : '';
        
        const categoryHTML = item.category ? `<span class="category">[${item.category}]</span>` : '';
        const commentHTML = item.personalComment ? `<p style="font-size: 12px; color: var(--primary); font-style: italic; margin-top: 6px; background: #2a1f3d; padding: 6px; border-radius: 4px;">💬 ${item.personalComment}</p>` : '';
        
        div.innerHTML = `
          <div class="item-meta" style="align-items: center;">
            <span>${typeIcon} ${safeType.toUpperCase()} ${categoryHTML}</span>
            <span class="status-badge status-pending">Pendiente</span>
          </div>
          <p class="item-content">${(item.summary || item.content || '').substring(0, 150)}...</p>
          <div class="item-tags">${tagsHTML}</div>
          ${commentHTML}
          
          <div class="edit-form hidden" id="edit-form-${safeId}">
            <label style="font-size:11px; color:var(--text-muted)">Modificar Categoría:</label>
            <input type="text" id="edit-cat-${safeId}" value="${item.category || ''}">
            <label style="font-size:11px; color:var(--text-muted)">Modificar Etiquetas (por coma):</label>
            <input type="text" id="edit-tags-${safeId}" value="${item.tags ? item.tags.join(', ') : ''}">
            <button class="btn-small btn-success btn-save-edit" data-id="${safeId}" style="margin-top:4px;">💾 Guardar y Procesar</button>
          </div>
        `;
        inboxList.appendChild(div);
      });
    } catch (error) {
      inboxList.innerHTML = '<p style="color:#cf6679; text-align:center;">❌ Error al conectar con el servidor.</p>';
    }
  }

  async function updateItemData(id, newCategory, newTagsStr, newStatus) {
    try {
      const updatedData = { status: newStatus };
      if (newCategory) updatedData.category = newCategory;
      if (newTagsStr) {
        updatedData.tags = newTagsStr.split(',').map(t => t.trim()).filter(Boolean);
      }
      if (newStatus === 'processed') updatedData.action = 'validate';

      const safeFilename = encodeURIComponent(id);
      await fetch(`${API_BASE_URL}/${safeFilename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      
      renderInbox(); 
    } catch (error) {
      console.error("Error al actualizar:", error);
      alert("Error al guardar en el servidor.");
    }
  }

  async function analyzeTextInPopup(text) {
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
              content: `Eres un experto en PKM. Analiza esta nota y devuelve un JSON estricto:
              1. "category": Una palabra clave.
              2. "tags": Array de 1 a 3 etiquetas en minúsculas.
              Responde SOLO con el JSON.`
            },
            { role: "user", content: text }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) return null;
      let data = await response.json();
      let resultText = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(resultText);
    } catch (e) {
      return null;
    }
  }

  // Exportar arreglado (Lee de la API)
  btnExport.addEventListener('click', async () => {
    try {
      const response = await fetch(API_BASE_URL);
      const allItems = await response.json();
      const pendingItems = allItems.filter(item => item.status === 'pending');

      if (pendingItems.length === 0) {
        alert("El Inbox está vacío");
        return;
      }

      let mdContent = '# 🧠 Kelea Digital Brain - Inbox Export\n\n';
      
      pendingItems.forEach(item => {
        const type = (item.type || 'nota').toUpperCase();
        const title = item.title || 'Sin título';
        const url = item.url || 'Sin enlace';
        const category = item.category || 'Inbox';
        const tags = item.tags && item.tags.length > 0 ? item.tags.map(t => `#${t}`).join(' ') : '';

        mdContent += `## [${type}] ${title}\n`;
        mdContent += `- **Categoría:** ${category} \n`;
        if (tags) mdContent += `- **Etiquetas:** ${tags}\n`;
        mdContent += `- **Fuente:** ${url !== 'Sin enlace' ? `[Ver enlace original](${url})` : 'Sin enlace'}\n\n`;
        mdContent += `> ${item.summary || item.content || 'Sin contenido'}\n\n---\n\n`;
      });

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
      alert("Hubo un error al generar el archivo.");
    }
  });

  btnClear.addEventListener('click', async () => {
    const confirmacion = confirm("¿Vaciar todas las notas pendientes de la base de datos?");
    if (!confirmacion) return;

    try {
      const response = await fetch(API_BASE_URL);
      const allItems = await response.json();
      const pendingItems = allItems.filter(item => item.status === 'pending');

      for (const item of pendingItems) {
        const id = item.id || item.filename;
        await fetch(`${API_BASE_URL}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      }

      renderInbox();
      const oldText = btnClear.innerHTML;
      btnClear.innerHTML = "✨ Inbox limpio";
      setTimeout(() => btnClear.innerHTML = oldText, 2000);
    } catch (e) {
      alert("Error al limpiar el Inbox.");
    }
  });

  inboxList.addEventListener('click', async (e) => {
    const id = e.target.getAttribute('data-id');
    if (!id) return;

    if (e.target.classList.contains('btn-edit')) {
      document.getElementById(`edit-form-${id}`).classList.toggle('hidden');
    }

    if (e.target.classList.contains('btn-approve')) {
      await updateItemData(id, null, null, 'processed');
    }

    if (e.target.classList.contains('btn-save-edit')) {
      const newCat = document.getElementById(`edit-cat-${id}`).value.trim();
      const newTagsStr = document.getElementById(`edit-tags-${id}`).value.trim();
      await updateItemData(id, newCat, newTagsStr, 'processed');
    }
  });

  btnSave.addEventListener('click', async () => {
    const text = quickNote.value.trim();
    const commentElem = document.getElementById('quick-comment');
    const comment = commentElem ? commentElem.value.trim() : "";
    if (!text) return;

    statusMsg.innerText = "🧠 Procesando idea...";
    statusMsg.classList.remove('hidden');
    statusMsg.style.color = "#bb86fc";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const aiData = await analyzeTextInPopup(text);

    const newItem = {
      id: Date.now().toString(),
      type: 'idea',
      summary: text,
      personalComment: comment,
      url: tab?.url || '',
      title: tab?.title || 'Idea rápida',
      category: aiData ? aiData.category : 'Idea',
      tags: aiData ? aiData.tags : [],
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    await saveToAPI(newItem);

    quickNote.value = '';
    if (commentElem) commentElem.value = '';
    statusMsg.innerText = "✅ ¡Idea guardada!";
    statusMsg.style.color = "#4caf50";
    renderInbox();
    setTimeout(() => statusMsg.classList.add('hidden'), 2000);
  });

  btnMic.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.startsWith('http')) {
      alert("⚠️ Abre una página web normal para usar el micrófono.");
      return;
    }

    if (!isRecording) {
      isRecording = true;
      btnMic.classList.add('recording');
      btnMic.innerText = "⏹️"; 
      statusMsg.innerText = "🔴 Grabando... Pulsa ⏹️ para detener.";
      statusMsg.classList.remove('hidden');
      statusMsg.style.color = "#cf6679";

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (!('webkitSpeechRecognition' in window)) {
            alert("Tu navegador no soporta reconocimiento de voz.");
            return;
          }
          
          window.keleaTranscript = '';
          if (window.keleaRecognition) window.keleaRecognition.stop();

          window.keleaRecognition = new webkitSpeechRecognition();
          window.keleaRecognition.continuous = true;
          window.keleaRecognition.interimResults = false;
          window.keleaRecognition.lang = 'es-ES';

          window.keleaRecognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) window.keleaTranscript += event.results[i][0].transcript + ' ';
            }
          };
          window.keleaRecognition.start();
        }
      });

    } else {
      isRecording = false;
      btnMic.classList.remove('recording');
      btnMic.innerText = "🎙️"; 
      statusMsg.innerText = "🧠 Procesando audio...";
      statusMsg.style.color = "#bb86fc";

      try {
        const injectionResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return new Promise((resolve) => {
              if (window.keleaRecognition) {
                window.keleaRecognition.onend = () => resolve(window.keleaTranscript.trim());
                window.keleaRecognition.stop(); 
                setTimeout(() => resolve(window.keleaTranscript ? window.keleaTranscript.trim() : ''), 1000);
              } else {
                resolve('');
              }
            });
          }
        });

        const transcript = injectionResults[0].result;

        if (!transcript) {
          statusMsg.innerText = "⚠️ No se detectó voz.";
          setTimeout(() => statusMsg.classList.add('hidden'), 3000);
          return;
        }

        quickNote.value = transcript; 
        const aiData = await analyzeTextInPopup(transcript);

        const newItem = {
          id: Date.now().toString(),
          type: 'audio',
          summary: transcript,
          url: tab.url,
          title: "🎤 Nota de voz",
          category: aiData ? aiData.category : 'Voz',
          tags: aiData ? aiData.tags : [],
          status: 'pending',
          timestamp: new Date().toISOString()
        };

        await saveToAPI(newItem);

        statusMsg.innerText = "✅ ¡Audio guardado y procesado!";
        statusMsg.style.color = "#4caf50";
        quickNote.value = '';
        renderInbox();
        setTimeout(() => statusMsg.classList.add('hidden'), 3000);
      } catch (error) {
        console.error("Error al detener la grabación:", error);
      }
    }
  });
});