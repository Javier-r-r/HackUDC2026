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

// Modal
const modal = document.getElementById('edit-modal');
const modalId = document.getElementById('modal-id');
const modalCat = document.getElementById('modal-category');
const modalTags = document.getElementById('modal-tags');
const modalContent = document.getElementById('modal-content');
const modalHeaderTitle = document.getElementById('modal-header-title');

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
  const filteredItems = currentItems.filter(item => item.status === showingStatus);

  if (filteredItems.length === 0) {
    itemsGrid.innerHTML = '<p style="color:var(--text-muted)">No hay elementos en esta vista.</p>';
    return;
  }

  const groupedItems = {};

  filteredItems.forEach(item => {
    // Normalizamos la categoría
    const cat = item.category || (item.ai_proposal && item.ai_proposal.category) || 'Sin categoría';
    
    // Si la categoría no existe en nuestro objeto, creamos un array vacío
    if (!groupedItems[cat]) {
      groupedItems[cat] = [];
    }
    // Metemos la nota en el "cajón" de su categoría
    groupedItems[cat].push(item);
  });

  for (const [categoryName, itemsInCategory] of Object.entries(groupedItems)) {
    
    // -- A. Crear y añadir el Título de la Categoría --
    const categoryHeader = document.createElement('h2');
    categoryHeader.textContent = `📁 ${categoryName}`;
    categoryHeader.style.gridColumn = '1 / -1'; // MÁGIA CSS: Ocupa todo el ancho del Grid
    categoryHeader.style.color = 'var(--primary)';
    categoryHeader.style.borderBottom = '1px solid var(--border)';
    categoryHeader.style.paddingBottom = '10px';
    categoryHeader.style.marginTop = '30px'; // Separación con el grupo anterior
    categoryHeader.style.marginBottom = '10px';
    
    itemsGrid.appendChild(categoryHeader);

    // -- B. Renderizar las tarjetas de esa categoría --
    itemsInCategory.forEach(item => {
      const card = document.createElement('div');
      card.className = 'inbox-item'; // Mantenemos la clase de tu tarjeta

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
          ${status === 'pending' ? `<button class="btn-primary btn-sm" onclick="event.stopPropagation(); approveItem('${item.id}')">✅ Validar a Cerebro</button>` : ''}
        </div>
      `;
      
      itemsGrid.appendChild(card);
    });
  } 
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
  await updateItemInAPI(id, { status: 'processed' });
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