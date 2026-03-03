const API_BASE_URL = 'http://localhost:8000/inbox';

let currentItems = [];
let showingStatus = 'pending';

const itemsGrid = document.getElementById('items-grid');
const networkGraph = document.getElementById('network-graph');
const btnRefresh = document.getElementById('btn-refresh');
const navInbox = document.getElementById('nav-inbox');
const navProcessed = document.getElementById('nav-processed');
const navGraph = document.getElementById('nav-graph');
const viewTitle = document.getElementById('view-title');
const loading = document.getElementById('loading');
let selectedTags = [];
let tagsExpanded = false;
const filterContainer = document.getElementById('filter-container')
const inboxBadge = document.getElementById('inbox-badge');
let searchQuery = '';
const searchInput = document.getElementById('search-input');
const btnSemanticSearch = document.getElementById('btn-semantic-search');

const modal = document.getElementById('edit-modal');
const modalId = document.getElementById('modal-id');
const modalCat = document.getElementById('modal-category');
const modalTags = document.getElementById('modal-tags');
const modalContent = document.getElementById('modal-content');
const modalHeaderTitle = document.getElementById('modal-header-title');

/**
 * Normaliza texto: trim, elimina acentos y pasa a minúsculas.
 * @param {string} texto - Texto a normalizar
 * @returns {string} Texto normalizado
 */
function unificarTexto(texto) {
  if (!texto) return "";
  return texto
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Inicializa listeners y carga inicial de la interfaz cuando el DOM está listo.
 */
document.addEventListener('DOMContentLoaded', () => {
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = unificarTexto(e.target.value);
      if (searchQuery === '') {
        fetchItems();
      } else {
        renderItems();
      }
    });
  }

  if (btnSemanticSearch) {
    btnSemanticSearch.addEventListener('click', async () => {
      const query = searchInput.value.trim();
      if (!query) {
        alert("Escribe una idea, concepto o pregunta en la barra para buscar con IA.");
        return;
      }
      await realizarBusquedaSemantica(query);
    });
  }

  fetchItems();

  navInbox.addEventListener('click', () => switchView('pending', '📥 Bandeja de Entrada', navInbox));
  navProcessed.addEventListener('click', () => switchView('processed', '📚 Cerebro Digital', navProcessed));
  navGraph.addEventListener('click', () => switchView('graph', '🕸️ Grafo de Conocimiento', navGraph));

  btnRefresh.addEventListener('click', fetchItems);

  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-save').addEventListener('click', saveItem);
});

/**
 * Cambia la vista actual (inbox / processed / graph) y actualiza la UI.
 * @param {string} status - 'pending' | 'processed' | 'graph'
 * @param {string} title - Título a mostrar en el encabezado
 * @param {HTMLElement} activeBtn - Botón de navegación activado
 */
function switchView(status, title, activeBtn) {
  showingStatus = status;
  viewTitle.textContent = title;

  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  activeBtn.classList.add('active');

  tagsExpanded = false;
  selectedTags = [];

  if (status === 'processed') {
    filterContainer.classList.remove('hidden');
    document.querySelector('.search-container').classList.remove('hidden');
    renderTagFilters();
  } else if (status === 'graph') {
    filterContainer.classList.add('hidden');
    document.querySelector('.search-container').classList.add('hidden');
  } else {
    filterContainer.classList.add('hidden');
    document.querySelector('.search-container').classList.remove('hidden');
  }

  renderItems();
}

/**
 * Recupera las notas desde la API y actualiza la interfaz.
 */
async function fetchItems() {
  loading.classList.remove('hidden');
  itemsGrid.innerHTML = '';

  try {
    const respuesta = await fetch(API_BASE_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!respuesta.ok) throw new Error(`Error en la red: ${respuesta.status}`);

    let datosCrudos = await respuesta.json();

    currentItems = datosCrudos.map(item => ({ ...item, id: item.filename }));

    updateNotificationBadge();
    renderItems();
  } catch (error) {
    console.error("No se pudo recuperar el inbox:", error);
    itemsGrid.innerHTML = `<p style="color:#cf6679; text-align:center;">Error al conectar con la API.</p>`;
  } finally {
    loading.classList.add('hidden');
  }
}

/**
 * Actualiza una nota en la API (PUT) y recarga la lista.
 * @param {string} filename - Identificador del recurso (filename)
 * @param {object} updatedData - Datos a actualizar (category, tags, ...)
 */
async function updateItemInAPI(filename, updatedData) {
  try {
    const safeFilename = encodeURIComponent(filename);
    const response = await fetch(`${API_BASE_URL}/${safeFilename}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: updatedData.category || "General",
        tags: updatedData.tags || [],
        action: "validate"
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Error al actualizar');
    }

    await fetchItems();
  } catch (error) {
    console.error("Error:", error);
    alert("Hubo un error al guardar: " + error.message);
  }
}

/**
 * Renderiza las tarjetas de notas según estado, búsqueda y filtros.
 */
function renderItems() {
  itemsGrid.innerHTML = '';
  let filteredItems = currentItems.filter(item => item.status === showingStatus);

  if (searchQuery !== '') {
    filteredItems = filteredItems.filter(item => {
      const titleLimpio = unificarTexto(item.title || '');
      return titleLimpio.includes(searchQuery);
    });
  }

  if (showingStatus === 'processed' && selectedTags.length > 0) {
    filteredItems = filteredItems.filter(item => {
      let tagsArray = [];
      if (Array.isArray(item.tags)) tagsArray = item.tags;
      else if (typeof item.tags === 'string') tagsArray = item.tags.split(',');

      const cleanTagsOfItem = tagsArray.map(t => unificarTexto(t));
      return selectedTags.every(selected => cleanTagsOfItem.includes(selected));
    });
  }

  if (showingStatus === 'graph') {
    itemsGrid.classList.add('hidden');
    networkGraph.classList.remove('hidden');
    renderGraph(filteredItems);
    return;
  } else {
    itemsGrid.classList.remove('hidden');
    networkGraph.classList.add('hidden');
  }

  if (filteredItems.length === 0) {
    itemsGrid.innerHTML = '<p style="color:var(--text-muted)">No se han encontrado notas con estos filtros.</p>';
    return;
  }

  if (showingStatus === 'processed') {
    const groupedItems = {};
    filteredItems.forEach(item => {
      const rawCat = item.category || (item.ai_proposal && item.ai_proposal.category) || 'Sin categoría';
      const catLimpia = unificarTexto(rawCat);
      const catKey = catLimpia.charAt(0).toUpperCase() + catLimpia.slice(1);
      if (!groupedItems[catKey]) groupedItems[catKey] = [];
      groupedItems[catKey].push(item);
    });

    for (const [categoryName, itemsInCategory] of Object.entries(groupedItems)) {
      const categoryHeader = document.createElement('h2');
      categoryHeader.textContent = `📁 ${categoryName}`;
      categoryHeader.style.gridColumn = '1 / -1';
      categoryHeader.style.color = 'var(--primary)';
      categoryHeader.style.borderBottom = '1px solid var(--border)';
      categoryHeader.style.paddingBottom = '10px';
      categoryHeader.style.marginTop = '30px';
      categoryHeader.style.marginBottom = '10px';
      itemsGrid.appendChild(categoryHeader);

      itemsInCategory.forEach(item => createAndAppendCard(item));
    }
  } else {
    filteredItems.forEach(item => createAndAppendCard(item));
  }
}

/**
 * Crea la tarjeta HTML de una nota y la añade al grid.
 * @param {object} item - Objeto con los datos de la nota
 */
function createAndAppendCard(item) {
  const card = document.createElement('div');
  card.className = 'inbox-item';

  let downloadsHTML = '';
  if (item.download_links && item.download_links.length > 0) {
    downloadsHTML = `
      <div class="attachment-section" style="margin: 12px 0; padding: 10px; background: rgba(187, 134, 252, 0.05); border-radius: 8px; border: 1px solid rgba(187, 134, 252, 0.2);">
        <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px; font-weight: bold;">📎 ARCHIVOS ADJUNTOS:</p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${item.download_links.map(link => `
            <a href="${link.url}" download="${link.name}" class="btn-download" 
               style="text-decoration:none; font-size:11px; padding: 6px 12px; background: #bb86fc; color: #000; border-radius: 6px; font-weight: bold; display: flex; align-items: center; gap: 5px; transition: transform 0.1s;">
               📥 Descargar ${link.name.split('.').pop().toUpperCase()}
            </a>
          `).join('')}
        </div>
      </div>`;
  }

  let tagsArray = [];
  if (Array.isArray(item.tags)) {
    tagsArray = item.tags;
  } else if (typeof item.tags === 'string') {
    tagsArray = item.tags.split(',').map(t => t.trim()).filter(Boolean);
  }

  const tagsHTML = tagsArray.length > 0
    ? tagsArray.map(tag => `<span class="tag" style="background: rgba(187, 134, 252, 0.1); color: var(--primary); padding: 3px 8px; border-radius: 12px; font-size: 11px; border: 1px solid rgba(187, 134, 252, 0.3);">#${tag}</span>`).join('')
    : '';

  const safeType = item.type || 'text';
  const typeIcon = safeType === 'link' ? '🔗' : (safeType === 'audio' ? '🎙️' : '📝');
  const status = item.status || 'pending';

  const statusBadge = status === 'pending'
      ? `<span class="status-badge status-pending" style="background-color: #cf6679; color: #121212; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">PENDIENTE</span>`
      : `<span class="status-badge status-processed" style="background-color: #4caf50; color: #121212; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">PROCESADO</span>`;

  if (status === 'processed') {
    card.style.cursor = 'pointer';
    card.setAttribute('onclick', `openModal('${item.id}')`);
  }

  card.innerHTML = `
    <div class="item-meta" style="align-items: center; justify-content: space-between; display: flex;">
    <span><strong>${item.title || 'Sin título'}</strong> ${typeIcon}</span>
      ${statusBadge}
    </div>
        
    <p class="item-content" style="margin-top: 10px; margin-bottom: 10px; color: #bbb; line-height: 1.5;">
      ${(item.summary || item.content || '').substring(0, 300)}...
    </p>

    ${downloadsHTML} ${status === 'pending' ? `
        <div class="inline-triage" style="background: rgba(255, 255, 255, 0.03); padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px dashed var(--border);">
          <div style="margin-bottom: 8px;">
              <input type="text" id="edit-cat-${item.id}" value="${item.category || ''}" placeholder="Categoría..." onclick="event.stopPropagation()" style="width:100%; padding:6px; border-radius:4px; border:1px solid var(--border); background:var(--bg-dark); color:var(--text-main); font-size:12px;">
          </div>
          <div>
              <input type="text" id="edit-tags-${item.id}" value="${tagsArray.join(', ')}" placeholder="Etiquetas..." onclick="event.stopPropagation()" style="width:100%; padding:6px; border-radius:4px; border:1px solid var(--border); background:var(--bg-dark); color:var(--text-main); font-size:12px;">
          </div>
        </div>
    ` : ''}

    ${status === 'processed' ? `
      <div class="item-tags" style="margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 6px;">
        ${tagsHTML}
      </div>
    ` : ''}
        
    <div class="card-actions" style="margin-top: 15px; display: flex; gap: 8px; border-top: 1px solid var(--border); padding-top: 10px;">
      ${status === 'processed' ? `<button class="btn-secondary btn-sm" onclick="event.stopPropagation(); exportItemToMD('${item.id}')" style="color: #bb86fc; border-color: rgba(187, 134, 252, 0.3); background: transparent;">⬇️ Exportar MD</button>` : ''}
      ${status === 'pending' ? `<button class="btn-primary btn-sm" onclick="event.stopPropagation(); approveItem('${item.id}')">✅ Confirmar y Enviar al Cerebro</button>` : ''}
      ${status === 'processed' ? `<button class="btn-secondary btn-sm" onclick="event.stopPropagation(); getRecommendations('${item.id}')" style="color: #03dac6; border-color: rgba(3, 218, 198, 0.3); background: transparent;">🌍 Conocer más</button>` : ''}
      <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); deleteItem('${item.id}')" style="color: #cf6679; border-color: rgba(207, 102, 121, 0.3); background: transparent;">🗑️ Borrar</button>
    </div>
  `;
  
  itemsGrid.appendChild(card);
}

/**
 * Abre el modal de edición para la nota indicada.
 * @param {string} id - Identificador de la nota
 */
window.openModal = (id) => {
  const item = currentItems.find(i => i.id === id);
  if (!item) return;
  const tagsArray = Array.isArray(item.tags)
    ? item.tags
    : (typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : []);

  modalId.value = item.id;
  modalCat.value = item.category || '';
  modalTags.value = tagsArray.join(', ');
  modalContent.value = item.summary || item.title || '';
  modalHeaderTitle.textContent = `${item.title || 'Sin título'}`;
  modal.classList.remove('hidden');
}

/**
 * Cierra el modal de edición.
 */
window.closeModal = () => {
  modal.classList.add('hidden');
}

/**
 * Guarda los cambios del modal y actualiza la nota en la API.
 */
window.saveItem = async () => {
  const id = modalId.value;
  const newTags = modalTags.value.split(',').map(t => t.trim()).filter(t => t);
  
  const updatedData = {
    category: modalCat.value,
    tags: newTags,
    content: modalContent.value,
    status: 'processed'
  };

  closeModal();
  await updateItemInAPI(id, updatedData);
}

/**
 * Aprueba una nota desde la vista inbox: lee inputs en la tarjeta y actualiza.
 * @param {string} id - Identificador de la nota
 */
window.approveItem = async (id) => {
  const catInput = document.getElementById(`edit-cat-${id}`);
  const tagsInput = document.getElementById(`edit-tags-${id}`);
  if (!catInput || !tagsInput) {
    console.error("No se encontraron los inputs de edición para la tarjeta", id);
    return;
  }

  const newCategory = catInput.value.trim() || "Sin categoría";
  const newTagsStr = tagsInput.value.trim();
  const newTags = newTagsStr.split(',').map(tag => tag.trim()).filter(tag => tag !== "");

  const updatedData = { category: newCategory, tags: newTags, status: 'processed' };
  await updateItemInAPI(id, updatedData);
}

/**
 * Renderiza los botones de filtrado por etiquetas en la vista processed.
 */
function renderTagFilters() {
  if (!filterContainer) return;
  const processedItems = currentItems.filter(item => item.status === 'processed');

  const allTags = new Set();
  processedItems.forEach(item => {
    let tagsArray = [];
    if (Array.isArray(item.tags)) tagsArray = item.tags;
    else if (typeof item.tags === 'string') tagsArray = item.tags.split(',');

    tagsArray.forEach(t => {
      const tagLimpio = unificarTexto(t);
      if (tagLimpio) allTags.add(tagLimpio);
    });
  });

  if (allTags.size === 0) {
    filterContainer.innerHTML = '';
    return;
  }

  const createBtn = (tagValue, label, isActive) => {
    const bg = isActive ? 'var(--primary)' : 'transparent';
    const color = isActive ? '#121212' : 'var(--primary)';
    const fw = isActive ? 'bold' : 'normal';
    const arg = tagValue === null ? 'null' : `'${tagValue}'`;
    return `<button onclick="filterByTag(${arg})" style="margin-right: 8px; margin-bottom: 8px; padding: 4px 12px; border-radius: 15px; border: 1px solid var(--primary); background: ${bg}; color: ${color}; cursor: pointer; font-size: 12px; font-weight: ${fw}; transition: all 0.2s;">${label}</button>`;
  };

  let html = `<div style="display: flex; align-items: center; flex-wrap: wrap;">`;
  html += `<span style="font-size: 13px; color: var(--text-muted); margin-right: 15px; margin-bottom: 8px;">🏷️ Filtrar por:</span>`;

  const isAllActive = selectedTags.length === 0;

  if (!tagsExpanded) {
    html += createBtn(null, 'Todas', isAllActive);

    if (!isAllActive) {
      selectedTags.forEach(tag => {
        html += createBtn(tag, `#${tag}`, true);
      });
    }
    html += `<button onclick="toggleTags()" style="margin-bottom: 8px; padding: 4px 10px; border-radius: 15px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-main); cursor: pointer; font-size: 10px; transition: all 0.2s;" title="Ver todas las etiquetas">▶ Mostrar más</button>`;
  } else {
    html += createBtn(null, 'Todas', isAllActive);
    allTags.forEach(tag => {
      html += createBtn(tag, `#${tag}`, selectedTags.includes(tag));
    });
    html += `<button onclick="toggleTags()" style="margin-bottom: 8px; padding: 4px 10px; border-radius: 15px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-main); cursor: pointer; font-size: 10px; transition: all 0.2s;" title="Ocultar etiquetas">◀ Ocultar</button>`;
  }

  html += `</div>`;
  filterContainer.innerHTML = html;
}

/**
 * Añade o quita una etiqueta de los filtros activos.
 * @param {string|null} tag - Tag a togglear (null = todas)
 */
window.filterByTag = (tag) => {
  if (tag === null) {
    selectedTags = [];
    tagsExpanded = false;
  } else {
    if (selectedTags.includes(tag)) selectedTags = selectedTags.filter(t => t !== tag);
    else selectedTags.push(tag);
  }

  renderTagFilters();
  renderItems();
};

/**
 * Expande o contrae la vista de etiquetas.
 */
window.toggleTags = () => {
  tagsExpanded = !tagsExpanded;
  renderTagFilters();
};

/**
 * Elimina una nota llamando a la API y actualiza la UI.
 * @param {string} id - Identificador de la nota
 * @param {boolean} [skipConfirm=false] - Omitir confirmación
 */
window.deleteItem = async (id, skipConfirm = false) => {
  if (!skipConfirm && !confirm("¿Seguro que quieres eliminar esta nota de forma permanente?")) return;

  try {
    const safeFilename = encodeURIComponent(id);
    const response = await fetch(`${API_BASE_URL}/${safeFilename}`, { method: 'DELETE' });
    if (!response.ok) throw new Error("Error al borrar en el servidor");
    if (!skipConfirm) await fetchItems();
  } catch (error) {
    console.error("Error al eliminar:", error);
  }
}

/**
 * Detecta y elimina notas duplicadas por título (mantiene la versión más antigua).
 */
window.cleanDuplicates = async () => {
  const seenTitles = new Set();
  const duplicateIds = [];

  currentItems.forEach(item => {
    const titleKey = item.title ? unificarTexto(item.title) : null;
    if (!titleKey) return;
    if (seenTitles.has(titleKey)) duplicateIds.push(item.id);
    else seenTitles.add(titleKey);
  });

  if (duplicateIds.length === 0) {
    alert("✨ ¡Tu cerebro está limpio! No se han encontrado notas duplicadas.");
    return;
  }

  const confirmacion = confirm(`Se han encontrado ${duplicateIds.length} notas duplicadas. ¿Deseas proceder?`);
  if (confirmacion) {
    document.getElementById('loading').classList.remove('hidden');
    for (const id of duplicateIds) await deleteItem(id, true);
    await fetchItems();
    alert("✅ Limpieza de duplicados completada con éxito.");
  }
}

/**
 * Actualiza la burbuja de notificaciones con el número de items pendientes.
 */
window.updateNotificationBadge = () => {
  if (!inboxBadge) return;
  const pendingCount = currentItems.filter(item => item.status === 'pending').length;
  if (pendingCount > 0) {
    inboxBadge.textContent = pendingCount;
    inboxBadge.classList.remove('hidden');
    inboxBadge.classList.add('pulse');
  } else {
    inboxBadge.classList.add('hidden');
    inboxBadge.classList.remove('pulse');
  }
}

/**
 * Exporta una nota a un archivo Markdown descargable.
 * @param {string} id - Identificador de la nota
 */
window.exportItemToMD = (id) => {
  const item = currentItems.find(i => i.id === id);
  if (!item) return;

  const type = (item.type || 'nota').toUpperCase();
  const title = item.title || 'Sin título';
  const url = item.url || 'Sin enlace';
  const category = item.category || 'Sin categoría';
  
  let tagsArray = [];
  if (Array.isArray(item.tags)) tagsArray = item.tags;
  else if (typeof item.tags === 'string') tagsArray = item.tags.split(',').map(t => t.trim()).filter(Boolean);
  const tagsStr = tagsArray.length > 0 ? tagsArray.map(t => `#${t}`).join(' ') : '';
  
  const date = item.date ? new Date(item.date).toLocaleString() : new Date().toLocaleString();
  const content = item.content || item.summary || 'Sin contenido';

  let mdContent = `# 🧠🐦‍⬛ Muninn - Nota Exportada\n\n`;
  mdContent += `## [${type}] ${title}\n`;
  mdContent += `- **Fecha:** ${date}\n`;
  mdContent += `- **Categoría:** ${category}\n`;
  if (tagsStr) mdContent += `- **Etiquetas:** ${tagsStr}\n`;
  mdContent += `- **Fuente:** ${url !== 'Sin enlace' ? `[Ver enlace original](${url})` : 'Sin enlace'}\n\n`;
  mdContent += `### Contenido:\n\n> ${content}\n\n`;
  if (item.personalComment) mdContent += `\n**Comentario Personal:**\n${item.personalComment}\n\n`;
  mdContent += `---\n`;

  try {
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
    a.download = `Nota_${safeTitle}_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
  } catch (e) {
    console.error("Error al exportar a MD:", e);
    alert("Hubo un error al exportar la nota.");
  }
};

/**
 * Renderiza el grafo de conocimiento usando vis-network.
 * @param {Array} [items] - Opcional lista de items para renderizar
 */
function renderGraph(items) {
  const processedItems = Array.isArray(items) ? items : currentItems.filter(item => item.status === 'processed');
  const nodesArray = [];
  const edgesArray = [];
  const tagNodesAdded = new Set();

  processedItems.forEach(item => {
    const shortTitle = (item.title || 'Nota').substring(0, 20) + (item.title?.length > 20 ? '...' : '');
    nodesArray.push({
      id: item.id,
      label: shortTitle,
      title: item.summary || item.content || 'Sin contenido',
      shape: 'box',
      color: { background: '#1e1e1e', border: '#bb86fc' },
      font: { color: '#e0e0e0' }
    });

    let tags = [];
    if (Array.isArray(item.tags)) tags = item.tags;
    else if (typeof item.tags === 'string') tags = item.tags.split(',').map(t => t.trim()).filter(Boolean);

    tags.forEach(tag => {
      const tagLimpio = unificarTexto(tag);
      if (!tagLimpio) return;
      const tagId = 'tag_' + tagLimpio;
      if (!tagNodesAdded.has(tagId)) {
        nodesArray.push({
          id: tagId,
          label: '#' + tagLimpio,
          shape: 'dot',
          size: 15,
          color: { background: '#cf6679', border: '#cf6679' },
          font: { color: '#e0e0e0', size: 14, bold: true }
        });
        tagNodesAdded.add(tagId);
      }

      edgesArray.push({ from: item.id, to: tagId, color: { color: '#555' } });
    });
  });

  const data = { nodes: new vis.DataSet(nodesArray), edges: new vis.DataSet(edgesArray) };
  const options = {
    physics: { barnesHut: { gravitationalConstant: -3000, centralGravity: 0.3, springLength: 150 } },
    interaction: { hover: true },
    nodes: { borderWidth: 2, shadow: true },
    edges: { smooth: { type: 'continuous' } }
  };

  const network = new vis.Network(networkGraph, data, options);

  network.on("doubleClick", function (params) {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      if (!nodeId.startsWith('tag_')) openModal(nodeId);
    }
  });
}

/**
 * Realiza una búsqueda semántica (RAG) llamando al endpoint `/search`.
 * @param {string} texto - Consulta de búsqueda
 */
async function realizarBusquedaSemantica(texto) {
  loading.classList.remove('hidden');
  try {
    const searchUrl = API_BASE_URL.replace('/inbox', '') + `/search?query=${encodeURIComponent(texto)}`;
    const respuesta = await fetch(searchUrl);
    if (!respuesta.ok) throw new Error("Error en la búsqueda semántica");
    const resultados = await respuesta.json();

    if (resultados.length === 0) {
      itemsGrid.innerHTML = '<p style="color:var(--text-muted)">No se encontró información relacionada en tu Cerebro Digital.</p>';
      return;
    }

    currentItems = resultados.map(item => ({ ...item, id: item.filename, status: showingStatus === 'graph' ? 'processed' : showingStatus }));
    searchQuery = '';
    renderItems();
  } catch (e) {
    console.error("Error en búsqueda semántica", e);
    alert("Error al conectar con el motor de IA.");
  } finally {
    loading.classList.add('hidden');
  }
}

/**
 * Cierra el modal de recomendaciones.
 */
window.closeRecommendations = () => {
  document.getElementById('recommendations-modal').classList.add('hidden');
};

/**
 * Solicita recomendaciones (3 enlaces) a la IA para una nota dada y muestra el modal.
 * @param {string} id - Identificador de la nota
 */
window.getRecommendations = async (id) => {
  const modalEl = document.getElementById('recommendations-modal');
  const body = document.getElementById('recommendations-body');
  const item = currentItems.find(i => i.id === id);
  if (!item) return;

  body.innerHTML = `<div style="text-align:center; padding: 20px;">` +
    `<p style="color:var(--primary); font-weight: bold; font-size: 16px;">🤖 Analizando tu nota...</p>` +
    `<p style="color:var(--text-muted); font-size: 13px;">Buscando enlaces de interés relacionados con este tema.</p>` +
    `</div>`;
  modalEl.classList.remove('hidden');

  try {
    let apiKey = localStorage.getItem('groqApiKey_web');
    if (!apiKey) {
      apiKey = prompt("🔒 Por seguridad de Chrome, introduce tu API Key de Groq para habilitar la IA en esta vista:");
      if (apiKey && apiKey.trim() !== "") localStorage.setItem('groqApiKey_web', apiKey.trim());
      else {
        body.innerHTML = '<p style="color:#cf6679; text-align:center;">Operación cancelada. Se necesita la clave para consultar a la IA.</p>';
        return;
      }
    }

    const textoNota = `Título: ${item.title || ''}. Contenido: ${item.summary || item.content || ''}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: `Eres un asistente de investigación. Basándote en el tema de la nota proporcionada, devuelve exactamente 3 enlaces útiles y reales (URLs) para seguir aprendiendo. Responde ÚNICAMENTE con un JSON estricto con este formato: [{"title": "Título del recurso", "url": "https://...", "description": "Por qué es útil (1 línea)"}]` },
          { role: "user", content: textoNota.substring(0, 1500) }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      if (response.status === 401) localStorage.removeItem('groqApiKey_web');
      throw new Error("Error obteniendo datos de la IA o API Key inválida");
    }

    const data = await response.json();
    let resultText = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
    const links = JSON.parse(resultText);

    let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
    links.forEach(link => {
      html += `
        <li style="margin-bottom: 12px; padding: 12px; background: rgba(3, 218, 198, 0.05); border: 1px solid rgba(3, 218, 198, 0.2); border-radius: 8px; transition: transform 0.2s;">
          <a href="${link.url}" target="_blank" style="color: #03dac6; font-weight: bold; text-decoration: none; font-size: 14px; display: block; margin-bottom: 4px;">🔗 ${link.title}</a>
          <p style="margin: 0; font-size: 12px; color: var(--text-main); line-height: 1.4;">${link.description}</p>
        </li>
      `;
    });
    html += '</ul>';
    body.innerHTML = html;
  } catch (error) {
    console.error("Error en recomendaciones:", error);
    body.innerHTML = '<p style="color:#cf6679; text-align:center;">La IA no pudo procesar esta nota. Revisa tu API Key y vuelve a intentarlo.</p>';
  }
};
