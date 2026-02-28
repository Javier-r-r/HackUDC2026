// 1. Ponemos la URL real de tu API
const API_BASE_URL = 'http://192.168.1.10:8000/inbox';

// Estado local
let currentItems = [];
let showingStatus = 'pending'; // 'pending' o 'processed'

// Elementos del DOM
const itemsGrid = document.getElementById('items-grid');
const btnRefresh = document.getElementById('btn-refresh');
const navInbox = document.getElementById('nav-inbox');
const navProcessed = document.getElementById('nav-processed');
const viewTitle = document.getElementById('view-title');
const loading = document.getElementById('loading');
let selectedTag = null;
const filterContainer = document.getElementById('filter-container')

// Modal
const modal = document.getElementById('edit-modal');
const modalId = document.getElementById('modal-id');
const modalCat = document.getElementById('modal-category');
const modalTags = document.getElementById('modal-tags');
const modalContent = document.getElementById('modal-content');
const modalHeaderTitle = document.getElementById('modal-header-title');

// ==========================================
// HERRAMIENTA PARA LIMPIAR TEXTOS (Acentos y Minúsculas)
// ==========================================
function unificarTexto(texto) {
  if (!texto) return "";
  return texto
    .trim()
    .normalize("NFD")                   // Separa las letras de los acentos
    .replace(/[\u0300-\u036f]/g, "")    // Borra los acentos
    .toLowerCase();                     // Lo pasa todo a minúsculas
}

document.addEventListener('DOMContentLoaded', () => {
  fetchItems(); // Llamamos a la API al cargar la página

  // Navegación
  navInbox.addEventListener('click', () => switchView('pending', '📥 Bandeja de Entrada', navInbox, navProcessed));
  navProcessed.addEventListener('click', () => switchView('processed', '📚 Cerebro Digital', navProcessed, navInbox));
  
  btnRefresh.addEventListener('click', fetchItems);
  
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-save').addEventListener('click', saveItem);
});

function switchView(status, title, activeBtn, inactiveBtn) {
  showingStatus = status;
  viewTitle.textContent = title;
  activeBtn.classList.add('active');
  inactiveBtn.classList.remove('active');
  // Reseteamos el filtro al cambiar de pestaña
  selectedTag = null; 
  
  if (status === 'processed') {
    filterContainer.classList.remove('hidden');
    renderTagFilters(); // Dibujamos los filtros
  } else {
    filterContainer.classList.add('hidden');
  }
  renderItems();
}

// ==========================================
// LLAMADA REAL A TU API (Fusionado con tu código)
// ==========================================
async function fetchItems() {
  loading.classList.remove('hidden');
  itemsGrid.innerHTML = ''; // Limpiar antes de cargar
  
  try {
    const respuesta = await fetch(API_BASE_URL, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!respuesta.ok) {
        throw new Error(`Error en la red: ${respuesta.status}`); // Añadidas las comillas invertidas
    }

    // Guardamos los datos de TU API en nuestra variable global
    let datosCrudos = await respuesta.json();
    
    // 🔥 EL TRUCO: Asegurarnos de que todos tienen un 'id' para el frontend
    currentItems = datosCrudos.map(item => ({
        ...item,
        id: item.id || item.filename || item._id || Date.now().toString()
    }));

    console.log("Notas recuperadas (con ID normalizado):", currentItems);

    // Llamamos a la función que pinta las tarjetas
    renderItems();
    

  } catch (error) {
    console.error("No se pudo recuperar el inbox:", error);
    itemsGrid.innerHTML = `<p style="color:#cf6679; text-align:center;">
      ❌ Error al conectar con la API.<br><br>
      Asegúrate de que el servidor en 192.168.1.10:8000 está encendido.
    </p>`;
  } finally {
    loading.classList.add('hidden');
  }
}
// 2. Actualizar nota en la API (PUT/PATCH)
async function updateItemInAPI(filename, updatedData) {
  try {
    const safeFilename = encodeURIComponent(filename);
    // Ahora sí es un PUT a la URL del recurso específico
    const response = await fetch(`${API_BASE_URL}/${safeFilename}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: updatedData.category || "General",
        tags: updatedData.tags || [],
        action: "validate" // Le decimos al backend que queremos validarla
      })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al actualizar');
    }
    
    console.log(`✅ Nota ${filename} actualizada por API REST`);
    
    // Recargamos la interfaz
    await fetchItems(); 
    
  } catch (error) {
    console.error("❌ Error:", error);
    alert("Hubo un error al guardar: " + error.message);
  }
}

// ==========================================
// RENDERIZADO Y LÓGICA DE UI
// ==========================================

function renderItems() {
  itemsGrid.innerHTML = '';
  let filteredItems = currentItems.filter(item => item.status === showingStatus);

  // Lógica de filtrado por etiqueta (solo para el Cerebro)
  if (showingStatus === 'processed' && selectedTag !== null) {
    filteredItems = filteredItems.filter(item => {
      let tagsArray = [];
      if (Array.isArray(item.tags)) tagsArray = item.tags;
      else if (typeof item.tags === 'string') tagsArray = item.tags.split(',');
      
      // Comparamos el texto unificado de la etiqueta de la nota con el tag seleccionado
      return tagsArray.some(t => unificarTexto(t) === selectedTag);
    });
  }

  if (filteredItems.length === 0) {
    itemsGrid.innerHTML = '<p style="color:var(--text-muted)">No hay elementos en esta vista.</p>';
    return;
  }

  // 🔥 LA MAGIA ESTÁ AQUÍ: Evaluamos en qué pestaña estamos
  if (showingStatus === 'processed') {
    
    // 2. VISTA CEREBRO: Agrupamos por categorías (Sin acentos y primera mayúscula)
    const groupedItems = {};
    filteredItems.forEach(item => {
      const rawCat = item.category || (item.ai_proposal && item.ai_proposal.category) || 'Sin categoría';
      
      // Pasamos por la limpiadora ("PROGRAMACIÓN" -> "programacion")
      const catLimpia = unificarTexto(rawCat);
      // Ponemos la primera en mayúscula ("programacion" -> "Programacion")
      const catKey = catLimpia.charAt(0).toUpperCase() + catLimpia.slice(1);

      if (!groupedItems[catKey]) groupedItems[catKey] = [];
      groupedItems[catKey].push(item);
  });

    for (const [categoryName, itemsInCategory] of Object.entries(groupedItems)) {
      // Dibujamos el título de la categoría
      const categoryHeader = document.createElement('h2');
      categoryHeader.textContent = `📁 ${categoryName}`;
      categoryHeader.style.gridColumn = '1 / -1'; 
      categoryHeader.style.color = 'var(--primary)';
      categoryHeader.style.borderBottom = '1px solid var(--border)';
      categoryHeader.style.paddingBottom = '10px';
      categoryHeader.style.marginTop = '30px'; 
      categoryHeader.style.marginBottom = '10px';
      itemsGrid.appendChild(categoryHeader);

      // Dibujamos las tarjetas de esta categoría
      itemsInCategory.forEach(item => createAndAppendCard(item));
    }

  } else {
    // VISTA INBOX: Lista plana, tal cual vienen, sin títulos
    filteredItems.forEach(item => createAndAppendCard(item));
  }
}

// Función reutilizable para crear la tarjeta visualmente
function createAndAppendCard(item) {
  const card = document.createElement('div');
  card.className = 'inbox-item'; 

  // Normalizar tags
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
  const typeIcon = safeType === 'link' ? '🔗' : safeType === 'text' ? '📝' : '💡';
  const status = item.status || 'pending';
  
  const statusBadge = status === 'pending' 
      ? `<span class="status-badge status-pending" style="background-color: #cf6679; color: #121212; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">PENDIENTE</span>` 
      : `<span class="status-badge status-processed" style="background-color: #4caf50; color: #121212; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">PROCESADO</span>`;

  // Si está procesado, dejamos abrir el modal de lectura/edición
  if (status === 'processed') {
    card.style.cursor = 'pointer';
    card.setAttribute('onclick', `openModal('${item.id}')`);
  }

  // Montar HTML de la tarjeta
  card.innerHTML = `
    <div class="item-meta" style="align-items: center; justify-content: space-between; display: flex;">
    <span><strong>${item.title || 'Sin título'}</strong> ${typeIcon} ${safeType.toUpperCase()}</span>
      ${statusBadge}
    </div>
        
    <p class="item-content" style="margin-top: 10px; margin-bottom: 15px;">
      ${(item.summary || item.content || '').substring(0, 300)}${(item.summary || item.content || '').length > 300 ? '...' : ''}
    </p>
        
    ${status === 'pending' ? `
        <div class="inline-triage" style="background: rgba(255, 255, 255, 0.03); padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px dashed var(--border);">
        <div style="margin-bottom: 8px;">
            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">📂 Categoría (Propuesta por IA):</label>
            <input type="text" id="edit-cat-${item.id}" value="${item.category || ''}" onclick="event.stopPropagation()" style="width:100%; padding:6px; border-radius:4px; border:1px solid var(--border); background:var(--bg-dark); color:var(--text-main); font-size:12px;">
        </div>
        
        <div>
            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">🏷️ Etiquetas (separadas por coma):</label>
            <input type="text" id="edit-tags-${item.id}" value="${tagsArray.join(', ')}" onclick="event.stopPropagation()" style="width:100%; padding:6px; border-radius:4px; border:1px solid var(--border); background:var(--bg-dark); color:var(--text-main); font-size:12px;">
        </div>
        </div>
    ` : ''}

    ${status === 'processed' ? `
      <div class="item-tags" style="margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 6px;">
        ${tagsHTML}
      </div>
    ` : ''}
        
    <div class="card-actions" style="margin-top: 15px; display: flex; gap: 8px; border-top: 1px solid var(--border); padding-top: 10px;">
      ${status === 'pending' ? `<button class="btn-primary btn-sm" onclick="event.stopPropagation(); approveItem('${item.id}')">✅ Confirmar y Enviar al Cerebro</button>` : ''}
    </div>
  `;
  
  itemsGrid.appendChild(card);
}

// Funciones del Modal y Acciones globales para usar con onclick
window.openModal = (id) => {
  const item = currentItems.find(i => i.id === id);
  if (!item) return;
  // Normalizar tags como string para el input del modal
  const tagsArray = Array.isArray(item.tags)
    ? item.tags
    : (typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : []);

  modalId.value = item.id;
  modalCat.value = item.category || '';
  modalTags.value = tagsArray.join(', ');
  // Preferir content, pero si no existe usar title (como en popup.js)
  modalContent.value = item.summary || item.title || '';
  modalHeaderTitle.textContent = `${item.title || 'Sin título'}`;
  modal.classList.remove('hidden');
}

window.closeModal = () => {
  modal.classList.add('hidden');
}

window.saveItem = async () => {
  const id = modalId.value;
  const newTags = modalTags.value.split(',').map(t => t.trim()).filter(t => t);
  
  const updatedData = {
    category: modalCat.value,
    tags: newTags,
    content: modalContent.value,
    status: 'processed' // Si edita y guarda, asumimos que lo procesa
  };

  closeModal();
  await updateItemInAPI(id, updatedData);
}

window.approveItem = async (id) => {
  // 1. Buscamos los inputs específicos de la tarjeta que el usuario acaba de clickar
  const catInput = document.getElementById(`edit-cat-${id}`);
  const tagsInput = document.getElementById(`edit-tags-${id}`);
  
  // Si por algún motivo no encuentra los inputs, paramos para evitar errores
  if (!catInput || !tagsInput) {
      console.error("No se encontraron los inputs de edición para la tarjeta", id);
      return;
  }

  // 2. Extraemos y limpiamos los valores que ha escrito el usuario
  const newCategory = catInput.value.trim() || "Sin categoría";
  const newTagsStr = tagsInput.value.trim();
  
  // Convertimos el texto de las etiquetas ("ia, web, diseño") en un array ["ia", "web", "diseño"]
  const newTags = newTagsStr.split(',').map(tag => tag.trim()).filter(tag => tag !== "");
  
  // 3. Preparamos el paquete de datos
  const updatedData = {
    category: newCategory,
    tags: newTags,
    status: 'processed' 
  };

  console.log("Enviando datos a la API:", updatedData);

  // 4. Ejecutamos la petición PUT (que gracias a tu updateItemInAPI ya manda el action: "validate")
  await updateItemInAPI(id, updatedData);
}

window.processInline = async (id) => {
  // 1. Buscamos los inputs específicos de esta tarjeta
  const catInput = document.getElementById(`edit-cat-${id}`);
  const tagsInput = document.getElementById(`edit-tags-${id}`);
  
  // 2. Extraemos y limpiamos los valores
  const newCategory = catInput.value.trim();
  const newTagsStr = tagsInput.value.trim();
  const newTags = newTagsStr.split(',').map(t => t.trim()).filter(t => t);
  
  // 3. Preparamos los datos
  const updatedData = {
    category: newCategory || "General",
    tags: newTags,
    status: 'processed' // Lo marcamos como validado
  };

  // 4. Enviamos a la API (usando tu función existente)
  await updateItemInAPI(id, updatedData);
}

function renderTagFilters() {
  if (!filterContainer) return;
  const processedItems = currentItems.filter(item => item.status === 'processed');

  // 1. Extraer todas las etiquetas únicas
  const allTags = new Set();
  processedItems.forEach(item => {
    let tagsArray = [];
    if (Array.isArray(item.tags)) tagsArray = item.tags;
    else if (typeof item.tags === 'string') tagsArray = item.tags.split(',').map(t => t.trim()).filter(Boolean);
    
    // Convertimos cada etiqueta a minúscula antes de añadirla a la lista de botones
    tagsArray.forEach(t => allTags.add(t.toLowerCase()));
  });

  // 2. Si no hay etiquetas, vaciamos el contenedor
  if (allTags.size === 0) {
    filterContainer.innerHTML = '';
    return;
  }

  // 3. Dibujamos los botones
  let html = `<span style="font-size: 13px; color: var(--text-muted); margin-right: 15px;">🏷️ Filtrar por:</span>`;

  // Botón "Todas"
  const allActive = selectedTag === null;
  html += `<button onclick="filterByTag(null)" style="margin-right: 8px; margin-bottom: 8px; padding: 4px 12px; border-radius: 15px; border: 1px solid var(--primary); background: ${allActive ? 'var(--primary)' : 'transparent'}; color: ${allActive ? '#121212' : 'var(--primary)'}; cursor: pointer; font-size: 12px; font-weight: bold; transition: all 0.2s;">Todas</button>`;

  // Botones para cada etiqueta
  allTags.forEach(tag => {
    const isActive = selectedTag === tag;
    html += `<button onclick="filterByTag('${tag}')" style="margin-right: 8px; margin-bottom: 8px; padding: 4px 12px; border-radius: 15px; border: 1px solid var(--primary); background: ${isActive ? 'var(--primary)' : 'transparent'}; color: ${isActive ? '#121212' : 'var(--primary)'}; cursor: pointer; font-size: 12px; transition: all 0.2s;">#${tag}</button>`;
  });

  filterContainer.innerHTML = html;
}

window.filterByTag = (tag) => {
  selectedTag = tag; // Actualizamos la etiqueta elegida
  renderTagFilters(); // Redibujamos los botones para cambiar los colores (cuál está activo)
  renderItems(); // Redibujamos las tarjetas filtradas
};