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

# --- NUEVOS IMPORTS PARA IA VECTORIAL ---
import chromadb
from chromadb.utils import embedding_functions

# --- CONFIGURACIÓN ---
app = FastAPI(title="Kelea Digital Brain API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directorios de almacenamiento
BASE_DIR = "digital_brain"
INBOX_DIR = os.path.join(BASE_DIR, "inbox")
BRAIN_DIR = os.path.join(BASE_DIR, "permanent_notes")

for folder in [INBOX_DIR, BRAIN_DIR]:
    os.makedirs(folder, exist_ok=True)

# --- INICIALIZAR CHROMA DB (BASE VECTORIAL) ---
chroma_client = chromadb.PersistentClient(path=os.path.join(BASE_DIR, "chroma_db"))
# Usamos un modelo multilenguaje ligero y rápido
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="paraphrase-multilingual-MiniLM-L12-v2")

collection = chroma_client.get_or_create_collection(
    name="cerebro_digital",
    embedding_function=sentence_transformer_ef
)

# --- MODELOS DE DATOS ---
class FileData(BaseModel):
    name: str
    base64: str

class MultiCaptureRequest(BaseModel):
    content: Optional[str] = ""
    source: Optional[str] = "Chrome Extension"
    files: List[FileData] = []
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
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"note_{timestamp}_{file.name}.md"
            
            metadata = {
                "title": file.name,
                "date": datetime.now().isoformat(),
                "source": data.source,
                "type": "file",
                "status": "pending",
                "category": data.category,
                "tags": data.tags,
                "summary": data.summary or "Archivo adjunto",
                "original_file": file.name
            }
            
            md_body = f"---\n{yaml.dump(metadata)}---\n\n# {metadata['summary']}\n\n{data.content}"
            with open(os.path.join(INBOX_DIR, filename), "w", encoding="utf-8") as f:
                f.write(md_body)
            saved_files.append(file.name)
            
            # ✨ INDEXAR EN CHROMA (Archivo)
            texto_a_indexar = f"{metadata['title']} {metadata['summary']} {data.content}"
            collection.upsert(documents=[texto_a_indexar], metadatas=[{"title": metadata["title"], "category": metadata["category"]}], ids=[filename])

    elif data.content:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"note_text_{timestamp}.md"
        
        metadata = {
            "title": "Captura rápida",
            "date": datetime.now().isoformat(),
            "source": data.source,
            "type": "text",
            "status": "pending",
            "category": data.category,
            "tags": data.tags,
            "summary": data.summary or "Sin resumen",
            "original_file": None
        }
        
        md_body = f"---\n{yaml.dump(metadata)}---\n\n# {metadata['summary']}\n\n{data.content}"
        with open(os.path.join(INBOX_DIR, filename), "w", encoding="utf-8") as f:
            f.write(md_body)
        saved_files.append(filename)

        # ✨ INDEXAR EN CHROMA (Texto)
        texto_a_indexar = f"{metadata['summary']} {data.content}"
        collection.upsert(documents=[texto_a_indexar], metadatas=[{"title": metadata["title"], "category": metadata["category"]}], ids=[filename])

    return {"status": "success", "processed": saved_files}

@app.post("/inbox")
async def save_direct_to_inbox(item: dict):
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    item_type = item.get("type", "generic")
    filename = f"note_{item_type}_{timestamp}.md"
    
    md_body = f"---\n{yaml.dump(item)}---\n\n# {item.get('title', 'Sin título')}\n\n{item.get('summary', item.get('content', ''))}"
    
    with open(os.path.join(INBOX_DIR, filename), "w", encoding="utf-8") as f:
        f.write(md_body)
        
    # ✨ INDEXAR EN CHROMA (Entrada directa)
    texto_a_indexar = f"{item.get('title', '')} {item.get('summary', item.get('content', ''))}"
    collection.upsert(documents=[texto_a_indexar], metadatas=[{"title": item.get('title', 'Sin título'), "category": item.get('category', 'Inbox')}], ids=[filename])

    return {"status": "success", "filename": filename}

@app.get("/inbox")
async def list_inbox():
    files = []
    for f in os.listdir(INBOX_DIR):
        if f.endswith(".md"):
            with open(os.path.join(INBOX_DIR, f), "r", encoding="utf-8") as file:
                content = file.read()
                parts = content.split("---")
                if len(parts) >= 3:
                    meta = yaml.safe_load(parts[1])
                    meta["filename"] = f

                    original_name = meta.get("original_file")
                    if original_name:
                        file_path = os.path.join(INBOX_DIR, original_name)
                        if os.path.exists(file_path):
                            meta["download_url"] = f"http://localhost:8000/download/{original_name}"
                        else:
                            meta["download_url"] = None

                    files.append(meta)
    return files

@app.put("/inbox/{filename}")
async def update_inbox_note(filename: str, req: UpdateRequest):
    filepath = os.path.join(INBOX_DIR, filename) 
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    parts = content.split("---")
    if len(parts) >= 3:
        meta = yaml.safe_load(parts[1])
        
        meta["category"] = req.category
        meta["tags"] = req.tags
        meta["status"] = req.status
        
        if req.action == "validate":
            meta["status"] = "processed"
            
        new_content = f"---\n{yaml.dump(meta)}---\n{parts[2]}"
    else:
        raise HTTPException(status_code=500, detail="Formato markdown inválido")

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
    inbox_path = os.path.join(INBOX_DIR, filename)
    if os.path.exists(inbox_path):
        os.remove(inbox_path)
        collection.delete(ids=[filename]) # ✨ ELIMINAR DE CHROMA
        return {"message": "Nota eliminada del Inbox"}
        
    brain_path = os.path.join(BRAIN_DIR, filename)
    if os.path.exists(brain_path):
        os.remove(brain_path)
        collection.delete(ids=[filename]) # ✨ ELIMINAR DE CHROMA
        return {"message": "Nota eliminada del Cerebro"}
        
    raise HTTPException(status_code=404, detail="Archivo no encontrado")

# ✨ NUEVO ENDPOINT DE BÚSQUEDA SEMÁNTICA
@app.get("/search")
async def semantic_search(query: str, limit: int = 10):
    try:
        results = collection.query(
            query_texts=[query],
            n_results=limit
        )
        
        if not results["ids"] or not results["ids"][0]:
            return []

        matched_filenames = results["ids"][0]
        distances = results["distances"][0] 
        
        found_notes = []
        for idx, fname in enumerate(matched_filenames):
            # Asumimos que están en INBOX_DIR porque tienes todo ahí ahora
            filepath = os.path.join(INBOX_DIR, fname)
            if os.path.exists(filepath):
                with open(filepath, "r", encoding="utf-8") as file:
                    content = file.read()
                    parts = content.split("---")
                    if len(parts) >= 3:
                        meta = yaml.safe_load(parts[1])
                        meta["filename"] = fname
                        meta["similarity_score"] = float(distances[idx])
                        found_notes.append(meta)
                        
        return found_notes
    except Exception as e:
        print(f"Error en búsqueda: {str(e)}")
        return []
