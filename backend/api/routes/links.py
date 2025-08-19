"""
Link Graph API Routes - Endpoints for wikilink and backlink operations.
Provides access to link relationships, graph analysis, and navigation features.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from api.dependencies import get_vault_service
from services.vault_service import VaultService

router = APIRouter(prefix="/api/v1/links", tags=["links"])


class LinkGraphStatsResponse(BaseModel):
    """Response model for link graph statistics."""
    total_notes: int = Field(..., description="Total number of notes in the graph")
    total_links: int = Field(..., description="Total number of links in the graph")
    orphan_notes: int = Field(..., description="Number of notes with no links")
    average_links_per_note: float = Field(..., description="Average links per note")
    link_density: float = Field(..., description="Graph link density (0-1)")
    connected_components: int = Field(..., description="Number of connected components")
    most_linked_note: Optional[Dict[str, Any]] = Field(None, description="Most linked note information")


class BacklinkResponse(BaseModel):
    """Response model for backlink information."""
    source_note: str = Field(..., description="Note that contains the link")
    source_file: str = Field(..., description="Full path to source file")
    link_type: str = Field(..., description="Type of link (wikilink, heading_reference, block_reference)")
    alias: Optional[str] = Field(None, description="Link alias if present")
    heading: Optional[str] = Field(None, description="Target heading for heading references")
    block_id: Optional[str] = Field(None, description="Target block ID for block references")
    raw_text: str = Field(..., description="Raw link text as it appears in the document")
    context: str = Field(..., description="Surrounding context of the link")


class OutgoingLinkResponse(BaseModel):
    """Response model for outgoing link information."""
    target_note: str = Field(..., description="Target note name")
    link_type: str = Field(..., description="Type of link")
    alias: Optional[str] = Field(None, description="Link alias if present")
    heading: Optional[str] = Field(None, description="Target heading")
    block_id: Optional[str] = Field(None, description="Target block ID")
    raw_text: str = Field(..., description="Raw link text")


class ConnectedNotesResponse(BaseModel):
    """Response model for connected notes."""
    connected_notes: List[Dict[str, Any]] = Field(..., description="List of connected notes with distances")
    paths: Dict[str, List[str]] = Field(..., description="Shortest paths to connected notes")


class MostLinkedNoteResponse(BaseModel):
    """Response model for most linked notes."""
    note: str = Field(..., description="Note name")
    backlink_count: int = Field(..., description="Number of backlinks")


class HubNoteResponse(BaseModel):
    """Response model for hub notes."""
    note: str = Field(..., description="Note name")
    outgoing_links: int = Field(..., description="Number of outgoing links")


class LinkSuggestionResponse(BaseModel):
    """Response model for link suggestions."""
    note: str = Field(..., description="Suggested note to link to")
    similarity_score: float = Field(..., description="Similarity score based on connections")
    common_connections: List[str] = Field(..., description="Notes that both current and suggested note link to")
    reason: str = Field(..., description="Reason for suggestion")


@router.get("/stats/{vault_name}", response_model=LinkGraphStatsResponse)
async def get_link_graph_stats(
    vault_name: str,
    vault_service: VaultService = Depends(get_vault_service)
) -> LinkGraphStatsResponse:
    """Get comprehensive statistics about the link graph for a vault."""
    try:
        stats = await vault_service.get_vault_link_graph_stats(vault_name)
        
        if not stats:
            raise HTTPException(status_code=404, detail=f"No link graph found for vault '{vault_name}'")
        
        return LinkGraphStatsResponse(**stats)
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get link graph stats: {str(e)}")


@router.get("/backlinks/{vault_name}/{note_name}", response_model=List[BacklinkResponse])
async def get_note_backlinks(
    vault_name: str,
    note_name: str,
    vault_service: VaultService = Depends(get_vault_service)
) -> List[BacklinkResponse]:
    """Get all backlinks pointing to a specific note."""
    try:
        backlinks = await vault_service.get_vault_backlinks(vault_name, note_name)
        return [BacklinkResponse(**backlink) for backlink in backlinks]
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get backlinks: {str(e)}")


@router.get("/outgoing/{vault_name}/{note_name}", response_model=List[OutgoingLinkResponse])
async def get_note_outgoing_links(
    vault_name: str,
    note_name: str,
    vault_service: VaultService = Depends(get_vault_service)
) -> List[OutgoingLinkResponse]:
    """Get all outgoing links from a specific note."""
    try:
        outgoing_links = await vault_service.get_vault_outgoing_links(vault_name, note_name)
        return [OutgoingLinkResponse(**link) for link in outgoing_links]
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get outgoing links: {str(e)}")


@router.get("/connected/{vault_name}/{note_name}", response_model=ConnectedNotesResponse)
async def get_connected_notes(
    vault_name: str,
    note_name: str,
    max_distance: int = Query(2, ge=1, le=5, description="Maximum distance to search for connected notes"),
    vault_service: VaultService = Depends(get_vault_service)
) -> ConnectedNotesResponse:
    """Get notes connected to a specific note within the given distance."""
    try:
        connected_data = await vault_service.get_connected_notes(vault_name, note_name, max_distance)
        return ConnectedNotesResponse(**connected_data)
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get connected notes: {str(e)}")


@router.get("/most-linked/{vault_name}", response_model=List[MostLinkedNoteResponse])
async def get_most_linked_notes(
    vault_name: str,
    limit: int = Query(10, ge=1, le=50, description="Number of most linked notes to return"),
    vault_service: VaultService = Depends(get_vault_service)
) -> List[MostLinkedNoteResponse]:
    """Get the notes with the most incoming links (backlinks)."""
    try:
        most_linked = await vault_service.get_most_linked_notes(vault_name, limit)
        return [MostLinkedNoteResponse(**note) for note in most_linked]
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get most linked notes: {str(e)}")


@router.get("/hubs/{vault_name}", response_model=List[HubNoteResponse])
async def get_hub_notes(
    vault_name: str,
    limit: int = Query(10, ge=1, le=50, description="Number of hub notes to return"),
    vault_service: VaultService = Depends(get_vault_service)
) -> List[HubNoteResponse]:
    """Get the notes with the most outgoing links (hub notes)."""
    try:
        hub_notes = await vault_service.get_hub_notes(vault_name, limit)
        return [HubNoteResponse(**note) for note in hub_notes]
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get hub notes: {str(e)}")


@router.get("/orphans/{vault_name}", response_model=List[str])
async def get_orphan_notes(
    vault_name: str,
    vault_service: VaultService = Depends(get_vault_service)
) -> List[str]:
    """Get notes that have no incoming or outgoing links (orphan notes)."""
    try:
        orphan_notes = await vault_service.find_orphan_notes(vault_name)
        return orphan_notes
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get orphan notes: {str(e)}")


@router.get("/suggestions/{vault_name}/{note_name}", response_model=List[LinkSuggestionResponse])
async def get_link_suggestions(
    vault_name: str,
    note_name: str,
    limit: int = Query(5, ge=1, le=20, description="Number of link suggestions to return"),
    vault_service: VaultService = Depends(get_vault_service)
) -> List[LinkSuggestionResponse]:
    """Get link suggestions for a note based on graph analysis."""
    try:
        suggestions = await vault_service.get_link_suggestions(vault_name, note_name, limit)
        return [LinkSuggestionResponse(**suggestion) for suggestion in suggestions]
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get link suggestions: {str(e)}")


@router.get("/graph/{vault_name}/overview")
async def get_graph_overview(
    vault_name: str,
    vault_service: VaultService = Depends(get_vault_service)
) -> Dict[str, Any]:
    """Get a comprehensive overview of the link graph including stats and key nodes."""
    try:
        # Gather all key information in one response
        stats = await vault_service.get_vault_link_graph_stats(vault_name)
        most_linked = await vault_service.get_most_linked_notes(vault_name, 5)
        hub_notes = await vault_service.get_hub_notes(vault_name, 5)
        orphan_notes = await vault_service.find_orphan_notes(vault_name)
        
        return {
            "stats": stats,
            "most_linked_notes": most_linked,
            "hub_notes": hub_notes,
            "orphan_notes": orphan_notes[:10],  # Limit orphans to first 10
            "orphan_count": len(orphan_notes)
        }
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get graph overview: {str(e)}")