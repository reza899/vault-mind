#!/usr/bin/env python3
"""
Sync existing ChromaDB collections to the metadata database.
This resolves the issue where collections exist in ChromaDB but not in the metadata DB.
"""

import sqlite3
from datetime import datetime
from pathlib import Path
import chromadb

def sync_collections():
    """Sync ChromaDB collections to metadata database."""
    
    # ChromaDB client
    chroma_path = "/app/chroma_db"
    client = chromadb.PersistentClient(path=chroma_path)
    
    # Metadata database
    metadata_db_path = Path(chroma_path) / "collections_metadata.db"
    
    print(f"ChromaDB path: {chroma_path}")
    print(f"Metadata DB path: {metadata_db_path}")
    
    # Get existing ChromaDB collections
    chroma_collections = client.list_collections()
    print(f"Found {len(chroma_collections)} ChromaDB collections:")
    
    for collection in chroma_collections:
        print(f"  - {collection.name}")
    
    if not chroma_collections:
        print("No ChromaDB collections to sync.")
        return
    
    # Connect to metadata database
    with sqlite3.connect(metadata_db_path) as conn:
        conn.execute("BEGIN TRANSACTION")
        
        try:
            for collection in chroma_collections:
                collection_name = collection.name
                
                # Extract vault name from collection name (remove 'vault_' prefix)
                vault_name = collection_name.replace('vault_', '', 1)
                
                # Check if already exists
                existing = conn.execute(
                    "SELECT name FROM collections WHERE name = ?", 
                    (collection_name,)
                ).fetchone()
                
                if existing:
                    print(f"Collection {collection_name} already exists in metadata DB, skipping.")
                    continue
                
                # Get collection stats
                try:
                    count = collection.count()
                    print(f"Collection {collection_name} has {count} documents")
                except Exception as e:
                    print(f"Error getting count for {collection_name}: {e}")
                    count = 0
                
                # Determine vault path based on naming
                if 'testvault' in collection_name.lower():
                    vault_path = '/Users/reza/Documents/MyVault1'
                elif 'myvault1' in collection_name.lower():
                    vault_path = '/Users/reza/Documents/MyVault1'
                else:
                    vault_path = f'/Users/reza/Documents/{vault_name}'
                
                # Insert into metadata database
                now = datetime.now().isoformat()
                conn.execute("""
                    INSERT INTO collections (
                        name, vault_path, description, created_at, updated_at,
                        last_indexed_at, document_count, size_bytes, status, health_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    collection_name,
                    vault_path,
                    f"Synced collection for vault {vault_name}",
                    now,
                    now,
                    now,
                    count,
                    count * 1000,  # Estimate size
                    'active',
                    'healthy'
                ))
                
                print(f"✅ Synced collection: {collection_name}")
            
            conn.execute("COMMIT")
            print("✅ All collections synced successfully!")
            
        except Exception as e:
            conn.execute("ROLLBACK")
            print(f"❌ Error syncing collections: {e}")
            raise

if __name__ == "__main__":
    sync_collections()