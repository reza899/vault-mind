"""
FastAPI application entry point for Vault Mind.
Provides REST API and WebSocket endpoints for Obsidian vault indexing and search.
"""
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional

from fastapi import FastAPI, Request, HTTPException, status, WebSocket
from fastapi.responses import JSONResponse
import uvicorn

from config import config
from database import VaultDatabase, EmbeddingService
from api.routes import indexing, search, status
from api.dependencies import set_global_dependencies
from api.websocket import websocket_endpoint


# Configure logging
logging.basicConfig(
    level=config.log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Global service instances
vault_db: Optional[VaultDatabase] = None
embedding_service: Optional[EmbeddingService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown."""
    # Startup
    logger.info("Starting Vault Mind API server...")
    
    global vault_db, embedding_service
    
    try:
        # Initialize database connection
        vault_db = VaultDatabase(persist_directory=config.chroma_persist_dir)
        await vault_db.connect()
        logger.info("VaultDatabase connected successfully")
        
        # Initialize embedding service
        embedding_service = EmbeddingService(provider_type=config.embedding_provider)
        await embedding_service.initialize()
        logger.info("EmbeddingService initialized successfully")
        
        # Set global dependencies for FastAPI dependency injection
        set_global_dependencies(vault_db, embedding_service)
        
        # Health check
        db_health = await vault_db.health_check()
        embed_health = await embedding_service.health_check()
        
        if db_health["status"] != "healthy" or embed_health["status"] != "healthy":
            logger.error("Service initialization failed health checks")
            raise RuntimeError("Service health check failed")
        
        logger.info("All services initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Vault Mind API server...")
    
    try:
        if embedding_service:
            await embedding_service.cleanup()
            logger.info("EmbeddingService cleaned up")
        
        if vault_db:
            await vault_db.disconnect()
            logger.info("VaultDatabase disconnected")
            
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")
    
    logger.info("Shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="Vault Mind API",
    description="Obsidian vault indexing and semantic search API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)


# Include API routers
app.include_router(indexing.router)
app.include_router(search.router)
app.include_router(status.router)

# Add WebSocket endpoint
@app.websocket("/ws")
async def websocket_route(websocket: WebSocket):
    """WebSocket endpoint for real-time progress updates."""
    await websocket_endpoint(websocket)

# Middleware can be added later if needed for frontend integration


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log all requests with correlation IDs."""
    # Generate correlation ID
    correlation_id = str(uuid.uuid4())
    request.state.correlation_id = correlation_id
    
    # Log request
    start_time = time.time()
    logger.info(
        f"Request started - {request.method} {request.url.path} "
        f"[{correlation_id}]"
    )
    
    # Process request
    try:
        response = await call_next(request)
        
        # Log successful response
        process_time = time.time() - start_time
        logger.info(
            f"Request completed - {request.method} {request.url.path} "
            f"Status: {response.status_code} Time: {process_time:.3f}s "
            f"[{correlation_id}]"
        )
        
        # Add correlation ID to response headers
        response.headers["X-Correlation-ID"] = correlation_id
        
        return response
        
    except Exception as e:
        # Log error
        process_time = time.time() - start_time
        logger.error(
            f"Request failed - {request.method} {request.url.path} "
            f"Error: {str(e)} Time: {process_time:.3f}s "
            f"[{correlation_id}]"
        )
        raise


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with consistent response format."""
    correlation_id = getattr(request.state, 'correlation_id', str(uuid.uuid4()))
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "details": {}
            },
            "timestamp": time.time(),
            "request_id": correlation_id
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions with consistent response format."""
    correlation_id = getattr(request.state, 'correlation_id', str(uuid.uuid4()))
    
    logger.error(f"Unhandled exception: {str(exc)} [{correlation_id}]", exc_info=True)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "details": {"error_type": type(exc).__name__}
            },
            "timestamp": time.time(),
            "request_id": correlation_id
        }
    )


@app.get("/health", tags=["System"])
async def health_check(request: Request) -> Dict[str, Any]:
    """
    Health check endpoint for system status monitoring.
    
    Returns:
        System health status including database and embedding service status
    """
    correlation_id = getattr(request.state, 'correlation_id', str(uuid.uuid4()))
    
    try:
        # Check database health
        db_health = {"status": "unhealthy", "error": "Not initialized"}
        if vault_db:
            db_health = await vault_db.health_check()
        
        # Check embedding service health
        embed_health = {"status": "unhealthy", "error": "Not initialized"}
        if embedding_service:
            embed_health = await embedding_service.health_check()
        
        # Determine overall health
        overall_status = "healthy"
        if db_health["status"] != "healthy" or embed_health["status"] != "healthy":
            overall_status = "unhealthy"
        
        return {
            "status": "success",
            "data": {
                "service_status": overall_status,
                "database": db_health,
                "embedding_service": embed_health,
                "version": "1.0.0",
                "environment": config.environment
            },
            "message": f"Health check completed - {overall_status}",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e} [{correlation_id}]")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Health check failed"
        )


@app.get("/", tags=["System"])
async def root(request: Request) -> Dict[str, Any]:
    """
    Root endpoint with API information.
    
    Returns:
        Basic API information and available endpoints
    """
    correlation_id = getattr(request.state, 'correlation_id', str(uuid.uuid4()))
    
    return {
        "status": "success",
        "data": {
            "name": "Vault Mind API",
            "version": "1.0.0",
            "description": "Obsidian vault indexing and semantic search API",
            "documentation": "/docs",
            "health_check": "/health",
            "endpoints": {
                "indexing": "/index (POST)",
                "search": "/search (GET)",
                "status": "/status (GET)",
                "websocket": "/ws"
            }
        },
        "message": "Vault Mind API is running",
        "timestamp": time.time(),
        "request_id": correlation_id
    }


# Dependency injection moved to api.dependencies module


if __name__ == "__main__":
    # Development server
    uvicorn.run(
        "app:app",
        host=config.host,
        port=config.port,
        reload=config.environment == "development",
        log_level=config.log_level.lower()
    )