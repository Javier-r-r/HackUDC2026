import os
import json
import yaml
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from groq import Groq

# --- CONFIGURACIÓN ---
app = FastAPI(title="Kelea Digital Brain API")
#client = Groq(api_key="")

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
    """Analiza el contenido y sugiere clasificación [cite: 187, 191]"""
    prompt = f"""
    Analiza esta entrada de un 'Digital Brain'. 
    Devuelve un JSON con:
    - 'category': Una de (Proyectos, Áreas, Recursos, Archivo) [cite: 135]
    - 'tags': 3 etiquetas técnicas.
    - 'summary': Resumen de 10 palabras.
    CONTENIDO: {content}
    """
    try:
        completion = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(completion.choices[0].message.content)
    except:
        return {"category": "Archivo", "tags": ["sin-etiqueta"], "summary": "Sin resumen"}

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
        "status": "pending", # [cite: 181]
        "ai_proposal": ai_suggestions
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

@app.post("/process")
async def process_note(req: ProcessRequest):
    """Mover del Inbox al Cerebro permanente tras validación humana [cite: 157, 158]"""
    source_path = os.path.join(INBOX_DIR, req.filename)
    dest_path = os.path.join(BRAIN_DIR, req.filename)
    
    if not os.path.exists(source_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
        
    # Aquí podrías actualizar los tags/categoría en el archivo antes de moverlo
    os.rename(source_path, dest_path)
    return {"message": f"Nota movida a {req.category}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)