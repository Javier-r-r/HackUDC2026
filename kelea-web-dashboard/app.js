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

  filteredItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'inbox-item';
    
    const tagsHTML = item.tags && item.tags.length > 0 
    ? item.tags.map(tag => `<span class="tag">#${tag}</span>`).join(' ') 
    : '';

    // Normalizar fecha: aceptamos `date`, `timestamp` o `created_at` (ISO/string/number)
    const rawDate = item.date || item.timestamp || item.created_at || item.time;
    const date = rawDate ? new Date(rawDate).toLocaleDateString() : '';

    const safeType = item.type || 'text';
    const typeIcon = safeType === 'link' ? '🔗' : safeType === 'text' ? '📝' : '💡';

    const categoryHTML = item.category ? `<span class="category">[${item.title}]</span>` : '';

    // Otros campos que vienen del popup.js
    const title = item.title || '';
    const type = item.type || '';
    
    const status = item.status || 'pending';
    const statusBadge = status === 'pending' 
        ? `<span class="status-badge status-pending">Pendiente</span>` 
        : `<span class="status-badge status-processed">Procesado</span>`;
        
    card.innerHTML = `
        <div class="item-meta" style="align-items: center;">
          <span>${item.title}</span>${typeIcon} ${safeType.toUpperCase()}</span>
          ${statusBadge}
        </div>
        <p class="item-content">${(item.summary || '').substring(0, 300)}${(item.summary || '').length > 300 ? '...' : ''}</p>
        
        ${status === 'pending' ? `
        
        <div class="edit-form hidden" id="edit-form-${item.id}">
          <label style="font-size:11px; color:var(--text-muted)">Modificar Categoría:</label>
          <input type="text" id="edit-cat-${item.id}" value="${item.category || ''}">
          
          <label style="font-size:11px; color:var(--text-muted)">Modificar Etiquetas (separadas por coma):</label>
          <input type="text" id="edit-tags-${item.id}" value="${item.tags ? item.tags.join(', ') : ''}">
          
        <div class="card-actions">
            ${item.status === 'pending' ? `<button class="btn-primary btn-sm" onclick="approveItem('${item.id}')">✅ Validar a Cerebro</button>` : ''}
        </div>
        </div>
        ` : ''}
    `;
    itemsGrid.appendChild(card);
  });
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
  modalContent.value = item.content || item.title || '';
  
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