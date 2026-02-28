// CONFIGURACIÓN DE TU API (Cámbialo por la URL real de tu backend)
const API_BASE_URL = 'https://tu-api-del-hackathon.com/api/inbox';

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
  fetchItems();

  // Navegación
  navInbox.addEventListener('click', () => switchView('pending', '📥 Inbox', navInbox, navProcessed));
  navProcessed.addEventListener('click', () => switchView('processed', '📚 Done', navProcessed, navInbox));
  
  btnRefresh.addEventListener('click', fetchItems);
  
  // Cerrar/Guardar Modal
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
// LLAMADAS A LA API
// ==========================================

// 1. Obtener notas de la API (GET)
async function fetchItems() {
  loading.classList.remove('hidden');
  itemsGrid.innerHTML = '';
  
  try {
    // Si tu API aún no está lista, comenta el fetch y descomenta los datos de prueba
    /*
    const response = await fetch(API_BASE_URL);
    if (!response.ok) throw new Error('Error en la API');
    currentItems = await response.json();
    */

    // DATOS DE PRUEBA (Borrar cuando conectes la API real)
    currentItems = [
      { id: '1', type: 'link', category: 'Tecnología', tags: ['ia', 'web'], content: 'Resumen mágico de una web de IA.', status: 'pending', timestamp: new Date().toISOString() },
      { id: '2', type: 'text', category: 'Filosofía', tags: ['estoicismo'], content: 'Nota rápida sobre control de emociones.', status: 'processed', timestamp: new Date().toISOString() }
    ];

    renderItems();
  } catch (error) {
    console.error("Error al obtener datos:", error);
    itemsGrid.innerHTML = '<p style="color:#cf6679;">Error al conectar con la API.</p>';
  } finally {
    loading.classList.add('hidden');
  }
}

// 2. Actualizar nota en la API (PUT/PATCH)
async function updateItemInAPI(id, updatedData) {
  try {
    /*
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'PATCH', // o PUT dependiendo de tu backend
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    if (!response.ok) throw new Error('Error al actualizar');
    */
    
    // Simulación para el frontend por ahora
    console.log("Datos enviados a la API:", id, updatedData);
    
    // Actualizamos el estado local para que la UI responda rápido
    const index = currentItems.findIndex(item => item.id === id);
    if (index > -1) {
      currentItems[index] = { ...currentItems[index], ...updatedData };
      renderItems();
    }
  } catch (error) {
    console.error("Error al actualizar:", error);
    alert("Hubo un error al guardar en la nube.");
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
    card.className = 'card';
    
    const tagsHTML = item.tags ? item.tags.map(t => `<span class="tag">#${t}</span>`).join('') : '';
    const date = new Date(item.timestamp).toLocaleDateString();

    card.innerHTML = `
      <div class="card-meta">
        <span class="card-category">[${item.category || 'Sin categoría'}]</span>
        <span>${date}</span>
      </div>
      <div class="card-content">${item.content}</div>
      <div class="card-tags">${tagsHTML}</div>
      <div class="card-actions">
        <button class="btn-secondary btn-sm" onclick="openModal('${item.id}')">✏️ Editar</button>
        ${item.status === 'pending' ? `<button class="btn-primary btn-sm" onclick="approveItem('${item.id}')">✅ Validar a Cerebro</button>` : ''}
      </div>
    `;
    itemsGrid.appendChild(card);
  });
}

// Funciones del Modal y Acciones globales para usar con onclick
window.openModal = (id) => {
  const item = currentItems.find(i => i.id === id);
  if (!item) return;

  modalId.value = item.id;
  modalCat.value = item.category || '';
  modalTags.value = item.tags ? item.tags.join(', ') : '';
  modalContent.value = item.content || '';
  
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