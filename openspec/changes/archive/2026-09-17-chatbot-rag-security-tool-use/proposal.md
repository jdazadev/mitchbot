# Proposal: Chatbot RAG, Security, Tool Use & OCR Enhancement

## What & Why

This change transforms MitchBot v2 from a passive Q&A chatbot into an **active business agent** that can execute actions (appointments, orders, transfers) while significantly improving the RAG pipeline, security, and cost-efficiency.

### 4 Critical Improvements

1. **Unified OCR Pipeline for All PDFs (EN + ES)**
   - Every PDF (text or image) passes through OCR for maximum extraction accuracy
   - Optimized for both English and Spanish documents
   - Reduces hallucination and improves RAG quality

2. **Agent Tool Use (Function Calling)**
   - Bot can execute actions: create appointments, orders, transfer to human, etc.
   - Zero-configuration tools that adapt to any business out-of-the-box
   - Transforms the bot from passive responder to active business assistant

3. **Multilingual Qdrant Embeddings (EN + ES)**
   - Optimized embedding strategy for both English and Spanish
   - Better chunking, re-ranking, and retrieval quality
   - Improved context injection for the LLM

4. **WebSocket Security Hardening**
   - JWT authentication for all Socket.io connections
   - Room-level access control (users can only join their authorized conversations)
   - Rate limiting and CORS restrictions
   - Critical for production deployment

### Business Impact

| Metric | Before | After |
|--------|--------|-------|
| Bot capability | Passive Q&A | Active business actions |
| PDF extraction accuracy | ~75% (text-only) | ~95% (OCR + vision) |
| RAG retrieval quality | Basic similarity | Re-ranked + structured |
| Security | Dev-only (CORS: *) | Production-ready |
| Customer setup time | Hours configuring | Minutes (zero-config tools) |

### Non-Goals

- WhatsApp/Instagram integration (separate change)
- Multi-tenant architecture (separate change)
- Analytics dashboard (real data) (separate change)
- Changing the existing UI framework or design system

### Scope

**In scope:**
- Backend OCR pipeline (rag.service.ts)
- Tool registry and executor system (new)
- Embedding strategy improvements (chunking, re-ranking)
- WebSocket security middleware

**Out of scope:**
- Frontend changes (except minimal UI for tool confirmations)
- Third-party integrations (WhatsApp, Instagram, external calendars)
- Multi-project support

## Success Criteria

- [ ] All PDFs (text/image) extracted with OCR with >90% accuracy
- [ ] Bot can execute at least 5 tools: appointment, order, human_transfer, product_query, hours_query
- [ ] RAG retrieval returns more relevant results (measured by human evaluation)
- [ ] WebSocket connections require valid JWT and respect room permissions
- [ ] No breaking changes to existing chat functionality
