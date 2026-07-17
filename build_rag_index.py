"""
Run this script once to build the RAG knowledge base index,
and again any time you add, remove, or change PDFs in knowledge_base/.

Usage:
    python build_rag_index.py
"""
import rag

if __name__ == "__main__":
    rag.build_index()