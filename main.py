import os
import json
import yaml
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq

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
class CaptureRequest(BaseModel):
    content: str
    source: str  # URL o nombre de la app
    entry_type: str # text, link, idea
    title: Optional[str] = "Sin título"

class ProcessRequest(BaseModel):
    filename: str
    action: str # "validate" o "archive"
    category: str
    tags: List[str]

# --- LÓGICA DE IA (GROQ) ---
def get_ai_metadata(content: str):
    truncated_content = content[:4000]
    
    # Prompt más imperativo para asegurar el resumen
    prompt = f"""
            Eres un experto en Personal Knowledge Management (PKM). 
            Tu tarea es analizar el texto del usuario y devolver un JSON estricto con dos campos:
            1. "category": Una sola palabra que defina el área (ej. Programación, Marketing, Filosofía, Herramienta).
            2. "tags": Un array de 1 a 3 etiquetas clave en minúsculas.
            3. "summary": resumen de máximo 10 palabras
            Responde SOLO con el JSON validado.`
    {truncated_content}
    """
    
    try:
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant", # Modelo más robusto
            messages=[
                {"role": "system", "content": "Eres un asistente que solo responde en JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        # Imprime el error real en la terminal para debuggear
        print(f"--- ERROR EN GROQ ---: {e}")
        return {"category": "Archivo", "tags": ["error-ia"], "summary": "Error en el procesamiento de la nota"}

# --- ENDPOINTS ---

@app.post("/capture")
async def capture_entry(data: CaptureRequest):
    """Punto único de captura sin fricción [cite: 117]"""
    # 1. Procesamiento IA en segundo plano [cite: 162]
    ai_suggestions = get_ai_metadata(data.content)    
    
    # 2. Creación de Metadatos (Frontmatter) [cite: 124]
    metadata = {
        "title": data.title,
        "date": datetime.now().isoformat(),
        "source": data.source,
        "type": data.entry_type,
        "status": "pending",
        "category": ai_suggestions.get("category", "Archivo"),
        "tags": ai_suggestions.get("tags", []),
        "summary": ai_suggestions.get("summary", "Sin resumen")
    }
    
    # 3. Guardar como Markdown local [cite: 137]
    filename = f"note_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    filepath = os.path.join(INBOX_DIR, filename)
    
    md_body = f"---\n{yaml.dump(metadata)}---\n\n# {ai_suggestions['summary']}\n\n{data.content}"
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(md_body)
        
    return {"message": "Guardado en Inbox", "file": filename, "proposal": ai_suggestions}

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
                    files.append(meta)
    return files

# Nuevo modelo de datos para actualizar
class UpdateRequest(BaseModel):
    category: str
    tags: List[str]
    action: Optional[str] = None # Si enviamos "validate", la moveremos

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