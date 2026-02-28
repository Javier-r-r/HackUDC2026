import os
import json
import yaml
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
import base64

# --- CONFIGURACIÓN ---
app = FastAPI(title="Kelea Digital Brain API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # ID de la extensión de Chrome
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directorios de almacenamiento (Formatos abiertos) [cite: 113, 137]
BASE_DIR = "digital_brain"
INBOX_DIR = os.path.join(BASE_DIR, "inbox")
BRAIN_DIR = os.path.join(BASE_DIR, "permanent_notes")

for folder in [INBOX_DIR, BRAIN_DIR]:
    os.makedirs(folder, exist_ok=True)

# --- MODELOS DE DATOS ---
class FileData(BaseModel):
    name: str
    base64: str

class MultiCaptureRequest(BaseModel):
    content: Optional[str] = ""
    source: Optional[str] = "Chrome Extension"
    files: List[FileData] = []
    # Añadimos los campos que procesa la IA en el background.js
    category: Optional[str] = "Inbox"
    tags: Optional[List[str]] = []
    summary: Optional[str] = "AAAA"

class UpdateRequest(BaseModel):
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None
    action: Optional[str] = None


# --- ENDPOINTS ---

@app.post("/capture")
async def capture_entry(data: MultiCaptureRequest):
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    saved_files = []
    
    if data.files:
        for file in data.files:
            file_path = os.path.join(INBOX_DIR, file.name)
            with open(file_path, "wb") as f:
                f.write(base64.b64decode(file.base64))
            saved_files.append(file.name)
            
    # Generamos la nota vinculada al archivo físico
    filename = f"note_{timestamp}.md"
    filepath = os.path.join(INBOX_DIR, filename)
    
    metadata = {
        "title": file.name,
        "date": datetime.now().isoformat(),
        "source": data.source,
        "type": "collection" if len(saved_files) > 1 else "file",
        "status": "pending",
        "category": data.category,
        "tags": data.tags,
        "summary": data.summary or "Archivo adjunto",
        "attached_files": saved_files
    }

    file_links = "\n".join([f"* [{f}](../inbox/{f})" for f in saved_files])
    md_body = f"---\n{yaml.dump(metadata)}---\n\n# {metadata['summary']}\n\n## Archivos Adjuntos:\n{file_links}\n\n## Notas:\n{data.content}" 
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(md_body)

    return {"status": "success", "note": filename, "files_saved": saved_files}

@app.post("/inbox")
async def save_direct_to_inbox(item: dict):
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    item_type = item.get("type", "generic")
    filename = f"note_{item_type}_{timestamp}.md"
    
    # El diccionario 'item' que envía JS ya tiene toda la estructura perfecta
    md_body = f"---\n{yaml.dump(item)}---\n\n# {item.get('title', 'Sin título')}\n\n{item.get('summary', item.get('content', ''))}"
    
    with open(os.path.join(INBOX_DIR, filename), "w", encoding="utf-8") as f:
        f.write(md_body)
        
    return {"status": "success", "filename": filename}

@app.get("/inbox")
async def list_inbox():
    """Listar entradas pendientes de procesar [cite: 125, 142]"""
    files = []
    for f in os.listdir(INBOX_DIR):
        if f.endswith(".md"):
            with open(os.path.join(INBOX_DIR, f), "r") as file:
                # Leer solo el frontmatter para velocidad
                content = file.read()
                parts = content.split("---")
                if len(parts) >= 3:
                    meta = yaml.safe_load(parts[1])
                    meta["filename"] = f

                    # 1. Verificamos si la nota tiene un archivo original asociado
                    original_name = meta.get("original_file")
                    if original_name:
                        file_path = os.path.join(INBOX_DIR, original_name)
                        # 2. Si el archivo existe físicamente, generamos la URL
                        if os.path.exists(file_path):
                            meta["download_url"] = f"http://localhost:8000/download/{original_name}"
                        else:
                            meta["download_url"] = None

                    files.append(meta)
    return files

# El nuevo endpoint RESTful
@app.put("/inbox/{filename}")
async def update_inbox_note(filename: str, req: UpdateRequest):
    """Actualizar una nota específica (sin moverla físicamente)"""
    # Todo vive en la misma carpeta ahora
    filepath = os.path.join(INBOX_DIR, filename) 
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    parts = content.split("---")
    if len(parts) >= 3:
        meta = yaml.safe_load(parts[1])
        
        # Actualizamos los datos
        meta["category"] = req.category
        meta["tags"] = req.tags
        meta["status"] = req.status
        
        # MAGIA AQUÍ: Si la acción es validate, cambiamos el estado, pero NO movemos el archivo
        if req.action == "validate":
            meta["status"] = "processed"
            
        new_content = f"---\n{yaml.dump(meta)}---\n{parts[2]}"
    else:
        raise HTTPException(status_code=500, detail="Formato markdown inválido")

    # Sobrescribimos el archivo en el mismo sitio
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)
        
    return {"message": "Nota actualizada correctamente"}

@app.delete("/inbox/{filename}")
async def delete_note(filename: str):
    filepath = os.path.join(INBOX_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    try:
        # 1. Leer metadatos
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        parts = content.split("---")
        if len(parts) >= 3:
            metadata = yaml.safe_load(parts[1])
            print(f"Metadatos extraídos: {metadata}")

            # Recolectar nombres de archivos de todas las posibles llaves
            files_to_delete = []
            
            # Revisar 'attached_files' (lista)
            attached = metadata.get("attached_files", [])
            if not isinstance(adjuntos, list): adjuntos = []
            
            # Revisar 'original_file' (string único)
            original = metadata.get("original_file")
            if original and original not in adjuntos:
                adjuntos.append(original)

            # 2. Borrar archivos físicos
            for file_name in adjuntos:
                if not file_name: continue
                
                # Intentar borrar tanto en INBOX como en BRAIN (por si acaso)
                for file_name in adjuntos:
                    if not file_name: continue
                    adjunto_full_path = os.path.join(INBOX_DIR, file_name)
                    if os.path.exists(adjunto_full_path):
                        os.remove(adjunto_full_path)
                        print(f"✅ Adjunto eliminado: {file_name}")

        # 3. Borrar la nota
        os.remove(filepath)
        return {"status": "success", "message": f"Nota y adjuntos de {filename} eliminados."}

    except Exception as e:
        print(f"❌ Error al borrar: {e}")
        raise HTTPException(status_code=500, detail=str(e))