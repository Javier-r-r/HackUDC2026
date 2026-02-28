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
let selectedTags = [];
let tagsExpanded = false;
const filterContainer = document.getElementById('filter-container')
const inboxBadge = document.getElementById('inbox-badge');
let searchQuery = ''; // Guardará el texto del buscador
const searchInput = document.getElementById('search-input');

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
  // Escuchador para la barra de búsqueda (se ejecuta en tiempo real al teclear)
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      // Usamos nuestra función mágica para quitar acentos y mayúsculas
      searchQuery = unificarTexto(e.target.value); 
      renderItems(); // Redibujamos las tarjetas al instante
    });
  }
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
  tagsExpanded = false;
  selectedTags = []; 
  
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

    console.log("Datos crudos recibidos de la API:", datosCrudos);
    
    // 🔥 EL TRUCO: Asegurarnos de que todos tienen un 'id' para el frontend
    currentItems = datosCrudos.map(item => ({
        ...item,
        id:  item.filename 
    }));

    console.log("Notas recuperadas (con ID normalizado):", currentItems);
    
    updateNotificationBadge();
    
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

  // 🔍 1. LÓGICA DE BÚSQUEDA POR TÍTULO (En tiempo real)
  if (searchQuery !== '') {
    filteredItems = filteredItems.filter(item => {
      // Limpiamos el título de la nota actual (sin acentos, en minúsculas)
      const titleLimpio = unificarTexto(item.title || '');
      // Comprobamos si el título incluye lo que el usuario ha escrito
      return titleLimpio.includes(searchQuery);
    });
  }

  // 🏷️ 2. LÓGICA DE FILTRADO MÚLTIPLE (Debe contener TODAS las etiquetas seleccionadas)
  if (showingStatus === 'processed' && selectedTags.length > 0) {
    filteredItems = filteredItems.filter(item => {
      let tagsArray = [];
      if (Array.isArray(item.tags)) tagsArray = item.tags;
      else if (typeof item.tags === 'string') tagsArray = item.tags.split(',');
      
      const cleanTagsOfItem = tagsArray.map(t => unificarTexto(t));
      return selectedTags.every(selected => cleanTagsOfItem.includes(selected));
    });
  }

  if (filteredItems.length === 0) {
    itemsGrid.innerHTML = '<p style="color:var(--text-muted)">No se han encontrado notas con estos filtros.</p>';
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
      <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); deleteItem('${item.id}')" style="color: #cf6679; border-color: rgba(207, 102, 121, 0.3); background: transparent;">🗑️ Borrar</button>
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

function renderTagFilters() {
  if (!filterContainer) return;
  const processedItems = currentItems.filter(item => item.status === 'processed');

  // Extraer todas las etiquetas únicas limpias
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

  // Pequeña función de ayuda para crear los botones HTML
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
    // VISTA CONTRAÍDA
    html += createBtn(null, 'Todas', isAllActive);
    
    // Mostramos TODAS las etiquetas que el usuario tenga seleccionadas actualmente
    if (!isAllActive) {
      selectedTags.forEach(tag => {
        html += createBtn(tag, `#${tag}`, true);
      });
    }
    html += `<button onclick="toggleTags()" style="margin-bottom: 8px; padding: 4px 10px; border-radius: 15px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-main); cursor: pointer; font-size: 10px; transition: all 0.2s;" title="Ver todas las etiquetas">▶ Mostrar más</button>`;
  } else {
    // VISTA EXPANDIDA
    html += createBtn(null, 'Todas', isAllActive);
    allTags.forEach(tag => {
      // El botón está activo si su tag está en el array de seleccionados
      html += createBtn(tag, `#${tag}`, selectedTags.includes(tag));
    });
    html += `<button onclick="toggleTags()" style="margin-bottom: 8px; padding: 4px 10px; border-radius: 15px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-main); cursor: pointer; font-size: 10px; transition: all 0.2s;" title="Ocultar etiquetas">◀ Ocultar</button>`;
  }
  
  html += `</div>`;
  filterContainer.innerHTML = html;
}

window.filterByTag = (tag) => {
  if (tag === null) {
    // Si hace clic en "Todas", vaciamos la lista y contraemos el menú
    selectedTags = [];
    tagsExpanded = false;
  } else {
    // Si hace clic en una etiqueta, la ponemos o la quitamos
    if (selectedTags.includes(tag)) {
      selectedTags = selectedTags.filter(t => t !== tag); // La quitamos
    } else {
      selectedTags.push(tag); // La añadimos
    }
    // Nota: ¡NO ponemos tagsExpanded = false aquí para que puedas elegir varias!
  }
  
  renderTagFilters(); 
  renderItems(); 
};

window.toggleTags = () => {
  tagsExpanded = !tagsExpanded; // Cambia entre verdadero y falso
  renderTagFilters(); // Redibuja los botones
};

// ==========================================
// SISTEMA DE ELIMINACIÓN Y DUPLICADOS
// ==========================================

// Función base para borrar una nota llamando a la API
window.deleteItem = async (id, skipConfirm = false) => {
  if (!skipConfirm && !confirm("¿Seguro que quieres eliminar esta nota de forma permanente?")) return;
  
  try {
    const safeFilename = encodeURIComponent(id);
    const response = await fetch(`${API_BASE_URL}/${safeFilename}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error("Error al borrar en el servidor");
    
    // Solo recargamos si es un borrado manual único
    if (!skipConfirm) {
      console.log(`🗑️ Nota ${id} eliminada`);
      await fetchItems();
    }
  } catch (error) {
    console.error("❌ Error al eliminar:", error);
  }
}

// Función MÁGICA para detectar y limpiar duplicados
window.cleanDuplicates = async () => {
  // Vamos a usar el 'título' como identificador de duplicados. 
  // (Si capturas la misma web 2 veces, tendrá el mismo título).
  const seenTitles = new Set();
  const duplicateIds = [];

  currentItems.forEach(item => {
    // Normalizamos el título para evitar fallos por mayúsculas o espacios
    const titleKey = item.title ? unificarTexto(item.title) : null;
    
    if (!titleKey) return; // Si no tiene título, lo ignoramos

    if (seenTitles.has(titleKey)) {
      // Si ya hemos visto este título, es un duplicado
      duplicateIds.push(item.id);
    } else {
      // Si es la primera vez que lo vemos, lo registramos
      seenTitles.add(titleKey);
    }
  });

  // Avisamos al usuario
  if (duplicateIds.length === 0) {
    alert("✨ ¡Tu cerebro está limpio! No se han encontrado notas duplicadas.");
    return;
  }

  const confirmacion = confirm(`🧹 Se han encontrado ${duplicateIds.length} notas duplicadas.\n\nEl sistema mantendrá la versión más antigua y borrará las copias. ¿Deseas proceder?`);
  
  if (confirmacion) {
    // Ponemos el mensaje de "Cargando" para que el usuario espere
    document.getElementById('loading').classList.remove('hidden');
    
    // Borramos los duplicados uno por uno (silenciosamente)
    for (const id of duplicateIds) {
      await deleteItem(id, true); // true = skipConfirm
    }
    
    // Recargamos la interfaz
    await fetchItems();
    alert("✅ Limpieza de duplicados completada con éxito.");
  }
}

// Actualiza el contador de notificaciones de la Bandeja de Entrada
window.updateNotificationBadge = () => {
  if (!inboxBadge) return;
  
  // Contamos cuántas notas están pendientes
  const pendingCount = currentItems.filter(item => item.status === 'pending').length;
  
  if (pendingCount > 0) {
    inboxBadge.textContent = pendingCount;
    inboxBadge.classList.remove('hidden');
    inboxBadge.classList.add('pulse');
  } else {
    // Si no hay nada, ocultamos la burbuja
    inboxBadge.classList.add('hidden');
    inboxBadge.classList.remove('pulse');
  }
}