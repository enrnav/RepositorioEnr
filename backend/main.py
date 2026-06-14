import logging
import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models
import routes

# Configuración de Logging
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE_PATH = os.path.join(LOG_DIR, "errors.log")


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE_PATH, encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("backend_logger")

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Tienda La Chiluda API")

# Middleware para registro de errores
@app.middleware("http")
async def errors_logging_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        if response.status_code >= 400:
            logger.warning(
                f"Error HTTP {response.status_code} en petición: {request.method} {request.url.path}"
            )
        return response
    except Exception as exc:
        logger.error(
            f"Error interno del servidor en petición: {request.method} {request.url.path}",
            exc_info=exc
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Error interno del servidor. Por favor, consulte el registro de errores."}
        )


# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000", "*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to Tienda La Chiluda API"}


