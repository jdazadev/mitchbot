# Tasks: Chatbot RAG, Security, Tool Use & OCR Enhancement

## Phase 1: WebSocket Security (Critical - Week 1)

### Task 1.1: Implement Socket.io JWT Authentication
**Priority:** 🔴 Critical
**Estimated:** 4 hours
**Files:** `websocket/socket.ts`, `middleware/auth.middleware.ts`

**Acceptance Criteria:**
- [x] Socket.io handshake requires valid JWT token
- [x] Token extracted from `socket.handshake.auth.token`
- [x] Invalid tokens rejected with clear error message
- [x] User object attached to socket instance
- [x] Project ID resolved and attached to socket
- [x] Existing chat functionality remains working

**Implementation notes:**
- Create `socketAuth.middleware.ts` for WebSocket-specific auth
- Use existing `authService.verifyToken()`
- Handle both dashboard and public chat connections
- Add `socket.user`, `socket.userId`, `socket.projectId` properties

### Task 1.2: Implement Room Authorization
**Priority:** 🔴 Critical
**Estimated:** 3 hours
**Files:** `websocket/socket.ts`, `services/chat.service.ts`

**Acceptance Criteria:**
- [x] `join:room` validates the conversation belongs to the socket's project
- [x] `join:room` checks user role permissions
- [x] Invalid room access returns error to client
- [x] Admin/Support can join any active conversation in their project
- [x] Assistant role can only join assigned conversations

**Implementation notes:**
- Query `conversations` collection with `projectId` filter
- Check `conversation.status` for role-based access
- Emit `error` event to socket on unauthorized access

### Task 1.3: Implement WebSocket Rate Limiting
**Priority:** 🔴 Critical
**Estimated:** 3 hours
**Files:** `websocket/socket.ts`, `config/redis.ts`

**Acceptance Criteria:**
- [x] Rate limit on `chat:send` events (30 messages/minute per user)
- [x] Rate limit on `join:room` events (10 joins/minute)
- [x] Uses existing Redis connection
- [x] Returns friendly error message when limit exceeded
- [x] Rate limits are configurable

**Implementation notes:**
- Use Redis INCR/EXPIRE pattern
- Key format: `ws:rate:{userId}:{event}`
- Add `configService.get('ws.rate_limit_messages')` for configuration

### Task 1.4: Restrict CORS for Production
**Priority:** 🔴 Critical
**Estimated:** 1 hour
**Files:** `websocket/socket.ts`, `config/env.ts`

**Acceptance Criteria:**
- [x] CORS origin restricted to `FRONTEND_URL` env variable
- [x] `FRONTEND_URL` added to `env.ts` schema
- [x] Supports multiple origins (comma-separated)
- [x] Development mode keeps `*` for convenience
- [x] Public chat namespace has its own CORS rules

**Implementation notes:**
- Add `FRONTEND_URL` to `envSchema`
- Use `process.env.NODE_ENV` to determine strictness
- Public namespace (`/public`) can be more permissive

### Task 1.5: Add WebSocket Security Tests
**Priority:** 🟡 Medium
**Estimated:** 2 hours
**Files:** `tests/websocket/security.test.ts` (new)

**Acceptance Criteria:**
- [x] Test connection without token (should fail)
- [x] Test connection with invalid token (should fail)
- [x] Test joining room without auth (should fail)
- [x] Test joining room of different project (should fail)
- [x] Test rate limiting enforcement

---

## Phase 2: Unified OCR Pipeline (Week 2)

### Task 2.1: Create OCR Service Module
**Priority:** 🔴 Critical
**Estimated:** 4 hours
**Files:** `services/ocr.service.ts` (new), `services/rag.service.ts`

**Acceptance Criteria:**
- [x] New `ocr.service.ts` encapsulates all OCR logic
- [x] Supports 3 providers: `ollama`, `mistral`, `openrouter`
- [x] Configurable via `configService` keys
- [x] Primary: Qwen2.5-VL via Ollama
- [x] Fallback chain: Ollama → Mistral → OpenRouter → pdf-parse (legacy)
- [x] Returns structured output: `{ text, pages, method, confidence }`

**Implementation notes:**
- Extract `extractWithVisionModel` and `extractPdfWithImageModel` from `rag.service.ts`
- Create unified `extractDocument(buffer: Buffer, fileType: string, options: OcrOptions)` function
- Support page batching and parallel processing
- Add language detection in output

### Task 2.2: Update PDF Processing to Always Use OCR
**Priority:** 🔴 Critical
**Estimated:** 2 hours
**Files:** `services/rag.service.ts`

**Acceptance Criteria:**
- [x] Remove text-only PDF detection logic
- [x] All PDFs convert to images via `pdf-to-img`
- [x] All PDFs pass through OCR pipeline
- [x] Scale reduced to 2 (from 4) for faster processing
- [x] Page batching enabled by default (batch size 4)
- [x] Extraction method logged as `llm_vision` or `ocr`

**Implementation notes:**
- In `processFile`, remove the `if (fileType === 'application/pdf')` special case
- Replace with unified OCR call
- Adjust `pdf-to-img` scale: 2 is sufficient for OCR text extraction
- Keep `extractTextOnly` for DevAdmin tests (backward compat)

### Task 2.3: Add OCR Configuration to DevAdmin
**Priority:** 🟡 Medium
**Estimated:** 2 hours
**Files:** `views/DevAdminModels.vue` (frontend), `services/config.service.ts` (backend)

**Acceptance Criteria:**
- [x] New "OCR" tab in DevAdmin Models
- [x] Provider selector: Ollama / Mistral / OpenRouter
- [x] Model selector (when applicable)
- [x] Config parameters: scale, maxPages, batchSize, timeout
- [x] Test button to verify OCR connection
- [x] Config saved to `provider_configs` collection

**Implementation notes:**
- Add new provider type: `ocr` in DevAdmin
- Reuse existing provider config UI components
- Add `testOCRConnection()` method

### Task 2.4: Update RAG Stats and Logging
**Priority:** 🟡 Medium
**Estimated:** 1 hour
**Files:** `services/rag.service.ts`, `models/document.model.ts`

**Acceptance Criteria:**
- [x] OCR extraction time logged per source
- [x] OCR confidence score stored (if available)
- [x] Pages processed count accurate
- [x] Source log shows which OCR model was used
- [x] Extraction method updated to `ocr` or `ocr_vision`

**Implementation notes:**
- Add `extractionMethod: 'ocr' | 'ocr_vision' | 'llm_vision'` to `KnowledgeSource`
- Track `extractionTimeMs` in source logs
- Update `processFile` progress stages to include OCR steps

---

## Phase 3: Multilingual Embeddings & RAG (Week 3)

### Task 3.1: Implement Structured Chunking
**Priority:** 🔴 Critical
**Estimated:** 3 hours
**Files:** `services/rag.service.ts`, `utils/chunking.ts` (new)

**Acceptance Criteria:**
- [x] Markdown headers detected and used as chunk boundaries
- [x] Each chunk prepended with: `Document: {title} | Section: {heading}`
- [x] Table content preserved as single chunks
- [x] Chunk size: 800 tokens (not characters)
- [x] Overlap: 100 tokens
- [x] Page numbers tracked in chunk metadata

**Implementation notes:**
- Create `chunking.ts` utility with `createSemanticChunks(text, metadata)`
- Use regex for header detection: `/^(#{1,3}\s+.+)$/gm`
- For tables, detect markdown table syntax and keep intact
- Calculate token count roughly (1 token ≈ 4 chars for EN/ES)

### Task 3.2: Add Language Detection to Chunks
**Priority:** 🟡 Medium
**Estimated:** 2 hours
**Files:** `utils/chunking.ts`, `services/rag.service.ts`

**Acceptance Criteria:**
- [x] Language detected per chunk: `en`, `es`, or `mixed`
- [x] Language stored in Qdrant payload
- [x] Simple heuristic: keyword detection (Spanish stop words vs English)
- [x] No external API call for language detection

**Implementation notes:**
- Use simple heuristic: count Spanish vs English common words
- Store `language` field in Qdrant payload
- This helps future filtering if needed

### Task 3.3: Implement Re-Ranking
**Priority:** 🟡 Medium
**Estimated:** 4 hours
**Files:** `services/rag.service.ts`, `services/reranker.service.ts` (new)

**Acceptance Criteria:**
- [x] Re-ranker service created with local model support
- [x] Qdrant search retrieves top 10 (instead of 3)
- [x] Re-ranker scores documents by relevance
- [x] Top 3 returned to chat service
- [x] Re-ranker can be disabled via config
- [x] Falls back to similarity-only if re-ranker unavailable

**Implementation notes:**
- Create `reranker.service.ts` with `rerank(query, documents)` method
- Primary: `cross-encoder/ms-marco-MiniLM-L-6-v2` via Ollama
- Alternative: Simple heuristic re-ranking (keyword overlap)
- Add `rag.use_reranker` config key

### Task 3.4: Optimize Qdrant Collection Configuration
**Priority:** 🟡 Medium
**Estimated:** 2 hours
**Files:** `config/qdrant.ts`, `services/rag.service.ts`

**Acceptance Criteria:**
- [x] HNSW config: `m: 16`, `ef_construct: 100`, `ef: 64`
- [x] Vectors stored on disk for large collections
- [x] Payload indexes include `language` field
- [x] Collection creation checks existing config before modifying
- [x] Existing collections migrated if needed

**Implementation notes:**
- Update `QdrantVectorStore.fromDocuments` to include collection config
- Add `ensureCollectionConfig()` method
- Use `on_disk: true` for production

### Task 3.5: Re-index Existing Documents
**Priority:** 🟡 Medium
**Estimated:** 3 hours
**Files:** `scripts/reindex-rag.ts` (update), `services/rag.service.ts`

**Acceptance Criteria:**
- [x] Script to re-index all documents with new chunking
- [x] Preserves existing metadata (category, tags, etc.)
- [x] Runs in background via BullMQ queue
- [x] Progress tracked per source
- [x] Rollback on failure

**Implementation notes:**
- Update existing `scripts/reindex-rag.ts`
- Use BullMQ for background processing
- Add `reindexing` stage to source status

---

## Phase 4: Agent Tool Use (Week 4)

### Task 4.1: Create Tool Registry System
**Priority:** 🔴 Critical
**Estimated:** 4 hours
**Files:** `tools/` (new directory), `services/tool.service.ts` (new)

**Acceptance Criteria:**
- [x] Tool registry with all built-in tools
- [x] Tool schema defined (name, description, parameters, execute)
- [x] Tool context includes: conversation, project, contact, agent
- [x] Tool execution returns standardized result
- [x] Tools can require user confirmation
- [x] New tools can be added easily

**Built-in tools to implement:**
- `create_appointment` - Schedule appointment
- `create_order` - Create order/pedido
- `get_product_info` - Query product from RAG
- `get_business_hours` - Return business hours
- `get_service_availability` - Check available slots
- `transfer_to_human` - Switch to human mode
- `send_notification` - Alert admin
- `get_faq_answer` - Answer from KB

**Implementation notes:**
- Directory: `src/tools/`
- Each tool: `tools/{name}.tool.ts`
- Base interface: `Tool` with `execute(params, context)` method
- Tool registry: `tools/index.ts` exports all tools
- Confirmation required for: create_appointment, create_order

### Task 4.2: Update AI Service for Tool Use
**Priority:** 🔴 Critical
**Estimated:** 3 hours
**Files:** `services/ai.service.ts`, `services/chat.service.ts`

**Acceptance Criteria:**
- [x] LLM models support `bindTools()` or `withStructuredOutput()`
- [x] Tool schema injected into system prompt for non-tool LLMs
- [x] Tool call detected in LLM response
- [x] Tool executed and result injected back into conversation
- [x] Final response generated with tool result
- [x] Streaming works with tool use (placeholder + final)

**Implementation notes:**
- Update `generateResponseStream` to handle tool calls
- If tool detected, emit placeholder: "Processing your request..."
- Execute tool, then stream final response
- For Ollama (limited tool support), inject tool descriptions in system prompt

### Task 4.3: Update Chat Service for Tool Flow
**Priority:** 🔴 Critical
**Estimated:** 3 hours
**Files:** `services/chat.service.ts`, `models/message.model.ts`

**Acceptance Criteria:**
- [x] `generateBotResponse` checks for tool calls in LLM response
- [x] Tool execution integrated into chat flow
- [x] Tool confirmation requests sent to user
- [x] Tool results stored as `tool` messages in DB
- [x] Conversation state managed correctly during tool flow
- [x] Error handling for failed tool executions

**Implementation notes:**
- Update `generateBotResponse` flow:
  1. Get user message
  2. Build system prompt with tools
  3. Call LLM
  4. If tool call: execute → store result → re-call LLM
  5. Stream final response
- Add tool confirmation check before executing state-changing tools
- Store `tool_result` messages in DB for audit trail

### Task 4.4: Add Tool Confirmation UI
**Priority:** 🔴 Critical
**Estimated:** 3 hours
**Files:** `views/Messaging.vue` (frontend), `views/TestChat.vue` (frontend)

**Acceptance Criteria:**
- [x] Confirmation buttons render when tool needs confirmation
- [x] Buttons: Confirm, Cancel, Modify
- [x] Confirmation sent back to server via WebSocket
- [x] UI shows tool execution status (pending, success, error)
- [x] Works in both dashboard and test-chat

**Implementation notes:**
- Add new WebSocket event: `tool:confirm`
- Frontend renders buttons inline in chat
- On confirm, emit `tool:confirm` with `conversationId` and `toolExecutionId`
- Server executes tool and sends result

### Task 4.5: Create Appointments & Orders Storage
**Priority:** 🟡 Medium
**Estimated:** 3 hours
**Files:** `models/appointment.model.ts`, `models/order.model.ts` (new)

**Acceptance Criteria:**
- [x] `appointments` collection: date, time, service, contact, status
- [x] `orders` collection: items, total, contact, status, conversation
- [x] CRUD operations in service layer
- [x] Linked to conversation and contact
- [x] Status tracking: pending, confirmed, completed, cancelled

**Implementation notes:**
- Simple MongoDB schemas
- No external calendar integration (MVP)
- Store in project-specific collections
- Add endpoints: `GET /api/appointments`, `GET /api/orders` (for dashboard)

### Task 4.6: Update Message Model for Tool Data
**Priority:** 🟡 Medium
**Estimated:** 2 hours
**Files:** `models/message.model.ts`, `services/chat.service.ts`

**Acceptance Criteria:**
- [x] `sender` enum includes `'tool'`
- [x] `contentType` enum includes `'tool_call'`, `'tool_result'`, `'confirmation_request'`
- [x] `toolData` field stores tool execution details
- [x] Frontend renders tool messages correctly
- [x] Existing messages unaffected

**Implementation notes:**
- MongoDB schema update (no migration needed for NoSQL)
- Frontend: render `tool` messages with special styling
- Confirmation requests: render as interactive cards

---

## Phase 5: Testing & Polish (Week 5)

### Task 5.1: Integration Testing
**Priority:** 🔴 Critical
**Estimated:** 4 hours
**Files:** `tests/integration/` (new)

**Acceptance Criteria:**
- [x] End-to-end PDF upload → OCR → chunking → search → chat
- [x] Tool flow: message → intent → confirmation → execution → response
- [x] WebSocket security: unauthorized access blocked
- [x] RAG quality: test with 10 sample queries

### Task 5.2: Update AGENTS.md
**Priority:** 🟡 Medium
**Estimated:** 1 hour
**Files:** `AGENTS.md`

**Acceptance Criteria:**
- [x] Document new tool system architecture
- [x] Document OCR pipeline
- [x] Document WebSocket security
- [x] Update version to v1.16.0

### Task 5.3: Update Changelog
**Priority:** 🟡 Medium
**Estimated:** 1 hour
**Files:** `changelog.md`

**Acceptance Criteria:**
- [x] Add v1.16.0 entry
- [x] List all 4 major features
- [x] Document breaking changes (if any)
- [x] Add migration notes

### Task 5.4: Performance Testing
**Priority:** 🟡 Medium
**Estimated:** 2 hours
**Files:** Various

**Acceptance Criteria:**
- [x] PDF OCR benchmark: 10 PDFs, measure time
- [x] RAG search benchmark: 100 queries, measure latency
- [x] Tool execution benchmark: 50 tool calls
- [x] WebSocket load test: 100 concurrent connections

---

## Summary

| Phase | Tasks | Priority | Est. Hours |
|-------|-------|----------|------------|
| 1. WebSocket Security | 5 tasks | 🔴 Critical | 13 hours |
| 2. OCR Pipeline | 4 tasks | 🔴 Critical | 9 hours |
| 3. Embeddings & RAG | 5 tasks | 🟡 Medium | 14 hours |
| 4. Tool Use | 6 tasks | 🔴 Critical | 16 hours |
| 5. Testing & Polish | 4 tasks | 🟡 Medium | 8 hours |
| **Total** | **24 tasks** | | **60 hours** |

**Dependencies:**
- Phase 1 can be done independently
- Phase 2 depends on nothing (can be parallel with Phase 1)
- Phase 3 depends on Phase 2 (chunking changes)
- Phase 4 depends on Phase 1 (WebSocket for confirmations) and Phase 3 (RAG for product queries)
- Phase 5 depends on all previous phases

**Ready for implementation order:**
1. Phase 1 (WebSocket Security) - Critical, no deps
2. Phase 2 (OCR) - Critical, no deps
3. Phase 3 (Embeddings) - Medium, depends on Phase 2
4. Phase 4 (Tool Use) - Critical, depends on Phase 1 + 3
5. Phase 5 (Testing) - Final validation

---

*End of tasks document*
