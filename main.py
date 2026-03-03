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
import pdfplumber
import chromadb
from chromadb.utils import embedding_functions
from fastapi.staticfiles import StaticFiles
BASE_DIR = "digital_brain"
INBOX_DIR = os.path.join(BASE_DIR, "inbox")

client = Groq()

def extract_text_from_pdf(file_path):
    """Extrae el texto de un PDF de forma robusta (Solo las primeras 5 páginas)"""
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                if i >= 5: 
                    break
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
                    
        print(f"✅ Extraídos {len(text)} caracteres del PDF para la IA.")
        return text.strip()
    except Exception as e:
        print(f"❌ Error leyendo PDF con pdfplumber: {e}")
        return ""

def process_with_ai(file_path, filename):
    """Detecta si es audio o texto, lo procesa y devuelve un JSON con categoría, tags y resumen"""
    ext = filename.split('.')[-1].lower()
    text_content = ""

    try:
        if ext in ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']:
            print(f"🎙️ Transcribiendo audio {filename} con Whisper...")
            with open(file_path, "rb") as file:
                transcription = client.audio.transcriptions.create(
                  file=(filename, file.read()),
                  model="whisper-large-v3",
                  response_format="json",
                  language="es"
                )
            text_content = transcription.text
            
        elif ext == 'pdf':
            print(f"📄 Extrayendo texto del PDF {filename}...")
            text_content = extract_text_from_pdf(file_path)
            
        elif ext in ['txt', 'md', 'csv']:
            print(f"📄 Leyendo texto plano de {filename}...")
            with open(file_path, "r", encoding="utf-8") as file:
                text_content = file.read()
        else:
            print(f"⚠️ Formato no soportado por IA: {ext}")
            return None

        if not text_content:
            print("⚠️ No se extrajo texto del archivo. La IA no actuará.")
            return None

        print("🧠 Analizando contenido con LLaMA...")
        prompt = f"""Eres un asistente PKM. Analiza el siguiente texto y devuelve un JSON estricto.
        Estructura requerida:
        {{
            "category": "Una palabra clave (ej. Apuntes, Reunión, Programación)",
            "tags": ["tag1", "tag2"],
            "summary": "Un resumen muy conciso (máximo 3 líneas) de lo que trata."
        }}
        
        Texto a analizar:
        {text_content[:4000]}"""

        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        raw_json = chat_completion.choices[0].message.content
        result_data = json.loads(raw_json)
        
        result_data["full_text"] = text_content 
        print(f"✨ ¡Éxito! IA asignó la categoría: {result_data.get('category')}")
        return result_data

    except Exception as e:
        print(f"❌ Error interno en process_with_ai: {e}")
        return None

app = FastAPI(title="Kelea Digital Brain API")

app.mount("/view_file", StaticFiles(directory=INBOX_DIR), name="static_files")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = "digital_brain"
INBOX_DIR = os.path.join(BASE_DIR, "inbox")

for folder in [INBOX_DIR]:
    os.makedirs(folder, exist_ok=True)

chroma_client = chromadb.PersistentClient(path=os.path.join(BASE_DIR, "chroma_db"))
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="paraphrase-multilingual-MiniLM-L12-v2")

collection = chroma_client.get_or_create_collection(
    name="cerebro_digital",
    embedding_function=sentence_transformer_ef
)

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
@app.post("/capture")
async def capture_entry(data: MultiCaptureRequest):
    """Procesa una nueva entrada, guarda archivos adjuntos y genera su nota en markdown"""
    saved_files = []
    
    if data.files:
        for file in data.files:
            file_path = os.path.join(INBOX_DIR, file.name)
            
            b64_data = file.base64
            if "," in b64_data:
                b64_data = b64_data.split(",")[1]
                
            with open(file_path, "wb") as f:
                f.write(base64.b64decode(b64_data))
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"note_{timestamp}_{file.name}.md"
            
            ai_data = process_with_ai(file_path, file.name)
            
            final_category = data.category or "Inbox"
            final_tags = data.tags or []
            final_summary = "Archivo adjunto (sin procesar)"
            final_content = f"Archivo adjunto original: [{file.name}](http://localhost:8000/download/{file.name})"

            if ai_data:
                final_category = ai_data.get("category", final_category)
                final_tags = ai_data.get("tags", final_tags)
                final_summary = ai_data.get("summary", final_summary)
                final_content = f"**Contenido Extraído / Transcripción:**\n\n> {ai_data.get('full_text', '')}"

            metadata = {
                "title": file.name,
                "date": datetime.now().isoformat(),
                "source": data.source,
                "type": "audio" if file.name.split('.')[-1].lower() in ['mp3', 'wav', 'm4a'] else "file",
                "status": "pending",
                "category": final_category,
                "tags": final_tags,
                "summary": final_summary,
                "attached_files": [file.name],
                "original_file": file.name
            }
            
            md_body = f"---\n{yaml.dump(metadata)}---\n\n# {metadata['summary']}\n\n{final_content}"
            with open(os.path.join(INBOX_DIR, filename), "w", encoding="utf-8") as f:
                f.write(md_body)
            saved_files.append(file.name)
            
            texto_a_indexar = f"{metadata['title']} {metadata['summary']} {final_content}"
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

        texto_a_indexar = f"{metadata['summary']} {data.content}"
        collection.upsert(documents=[texto_a_indexar], metadatas=[{"title": metadata["title"], "category": metadata["category"]}], ids=[filename])

    return {"status": "success", "processed": saved_files}

@app.post("/inbox")
async def save_direct_to_inbox(item: dict):
    """Guarda un item directamente en el inbox en formato markdown"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    item_type = item.get("type", "generic")
    filename = f"note_{item_type}_{timestamp}.md"
    
    md_body = f"---\n{yaml.dump(item)}---\n\n# {item.get('title', 'Sin título')}\n\n{item.get('summary', item.get('content', ''))}"
    
    with open(os.path.join(INBOX_DIR, filename), "w", encoding="utf-8") as f:
        f.write(md_body)
        
    texto_a_indexar = f"{item.get('title', '')} {item.get('summary', item.get('content', ''))}"
    collection.upsert(documents=[texto_a_indexar], metadatas=[{"title": item.get('title', 'Sin título'), "category": item.get('category', 'Inbox')}], ids=[filename])

    return {"status": "success", "filename": filename}

@app.get("/inbox")
async def list_inbox():
    """Lista todas las notas del inbox con sus metadatos y enlaces de descarga"""
    files = []
    for f in os.listdir(INBOX_DIR):
        if f.endswith(".md"):
            with open(os.path.join(INBOX_DIR, f), "r", encoding="utf-8") as file:
                content = file.read()
                parts = content.split("---")
                if len(parts) >= 3:
                    meta = yaml.safe_load(parts[1])
                    meta["filename"] = f

                    adjuntos = meta.get("attached_files", [])
                    if not isinstance(adjuntos, list):
                        adjuntos = []
                    
                    orig = meta.get("original_file")
                    if orig and orig not in adjuntos:
                        adjuntos.append(orig)

                    links = []
                    for name in adjuntos:
                        if name:
                            file_path = os.path.join(INBOX_DIR, name)
                            if os.path.exists(file_path):
                                links.append({
                                    "name": name,
                                    "url": f"http://localhost:8000/view_file/{name}"
                                })
                    
                    meta["download_links"] = links
                    files.append(meta)
    return files

@app.put("/inbox/{filename}")
async def update_inbox_note(filename: str, req: UpdateRequest):
    """Actualiza la categoría, tags o estado de una nota específica"""
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
    """Elimina una nota y sus archivos adjuntos asociados del sistema y de la base de datos vectorial"""
    filepath = os.path.join(INBOX_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    try:
        files_to_delete = []
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        parts = content.split("---")
        if len(parts) >= 3:
            metadata = yaml.safe_load(parts[1])
            
            attached = metadata.get("attached_files", [])
            if isinstance(attached, list):
                files_to_delete.extend(attached)
            
            original = metadata.get("original_file")
            if original and original not in files_to_delete:
                files_to_delete.append(original)

        for file_name in files_to_delete:
            if not file_name: continue
            adjunto_path = os.path.join(INBOX_DIR, file_name)
            if os.path.exists(adjunto_path):
                os.remove(adjunto_path)

        os.remove(filepath)

        try:
            collection.delete(ids=[filename])
        except Exception:
            pass

        return {"status": "success"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search")
async def semantic_search(query: str, limit: int = 10):
    """Realiza una búsqueda semántica en la base de datos vectorial"""
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