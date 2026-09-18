# Design: Chatbot RAG, Security, Tool Use & OCR Enhancement

## 1. Unified OCR Pipeline for All PDFs

### 1.1 Design Decision

**All PDFs (text and image) pass through OCR.** This ensures maximum extraction accuracy regardless of PDF quality, encoding, or text layer presence.

```
┌─────────────────────────────────────────────────────────────┐
│                 UNIFIED OCR PIPELINE                        │
│                                                             │
│   Input: PDF File                                           │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────────────────────┐                              │
│   │  pdf-to-img (png)        │  ← Convert every page to PNG │
│   │  Scale: 2 (configurable) │                              │
│   └────────────┬────────────┘                              │
│                │                                            │
│                ▼                                            │
│   ┌─────────────────────────┐                              │
│   │  OCR Vision Model         │  ← Extract text from images   │
│   │  • Qwen2.5-VL (Ollama)   │  ← Free, local, ES/EN         │
│   │  • Mistral OCR (API)     │  ← Fallback, paid             │
│   │  • GLM-OCR (API)         │  ← Fallback, paid             │
│   └────────────┬────────────┘                              │
│                │                                            │
│                ▼                                            │
│   ┌─────────────────────────┐                              │
│   │  Markdown Output          │  ← Structured text            │
│   │  • Headers preserved     │                              │
│   │  • Tables as markdown    │                              │
│   │  • Page numbers tracked  │                              │
│   └────────────┬────────────┘                              │
│                │                                            │
│                ▼                                            │
│   ┌─────────────────────────┐                              │
│   │  Chunking + Embeddings  │                              │
│   └─────────────────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 OCR Model Selection

| Model | Provider | Cost | ES/EN | Speed | Recommendation |
|-------|----------|------|-------|-------|----------------|
| Qwen2.5-VL | Ollama (local) | Free | Excellent | Medium | **Primary** |
| Mistral OCR | API | Low | Excellent | Fast | Fallback |
| GLM-OCR | API | Low | Good (ES ok) | Fast | Secondary fallback |
| GPT-4o Vision | API | High | Excellent | Fast | Legacy support |

**Primary choice: Qwen2.5-VL via Ollama**
- Zero cost per page
- Supports both English and Spanish natively
- Can run on modest GPU (8GB VRAM)
- No API rate limits

### 1.3 Configuration

New config keys in `configService`:
```typescript
'rag.ocr_provider': 'ollama',  // 'ollama' | 'mistral' | 'glm' | 'openrouter'
'rag.ocr_ollama_model': 'qwen2.5-vl',
'rag.ocr_scale': 2,  // Lower = faster, 2 is sufficient for text
'rag.ocr_max_pages': 0,  // 0 = unlimited
'rag.ocr_batch_size': 4,  // Parallel pages
'rag.ocr_timeout_ms': 60000,
```

### 1.4 Implementation

Replace `extractPdfWithImageModel` in `rag.service.ts`:
1. Remove conditional logic (text vs image PDF)
2. Always convert to images via `pdf-to-img`
3. Send to OCR model with prompt: "Extract ALL text in Spanish or English. Preserve structure."
4. Return combined markdown

**Tradeoffs:**
- Slightly slower for text-only PDFs (but more accurate)
- Higher CPU usage for `pdf-to-img`
- Slightly higher memory usage during extraction
- **Benefit:** Consistent accuracy, no missed text due to encoding issues

---

## 2. Agent Tool Use (Function Calling)

### 2.1 Design Philosophy

**Zero-configuration for the business owner.** The tools should work out-of-the-box for any business without requiring API integrations or complex setup.

### 2.2 Tool Registry Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 TOOL SYSTEM ARCHITECTURE                    │
│                                                             │
│   ┌─────────────────┐                                      │
│   │  Tool Registry  │  ← Central catalog of all tools      │
│   │  (tools/)       │                                      │
│   └────────┬────────┘                                      │
│            │                                                │
│            ▼                                                │
│   ┌─────────────────────────────────────────────────────┐  │
│   │           TOOL CATEGORIES                            │  │
│   │                                                      │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐   │  │
│   │  │ BUSINESS     │  │ CONVERSATION │  │ UTILITY  │   │  │
│   │  │ ACTIONS      │  │ CONTROL      │  │          │   │  │
│   │  │              │  │              │  │          │   │  │
│   │  │ • create_    │  │ • transfer_  │  │ • get_   │   │  │
│   │  │   appointment│  │   to_human   │  │   business│   │  │
│   │  │ • create_    │  │ • close_     │  │   _hours │   │  │
│   │  │   order      │  │   conversation│  │ • send_  │   │  │
│   │  │ • get_       │  │ • escalate_  │  │   notification│ │  │
│   │  │   product_   │  │              │  │          │   │  │
│   │  │   info       │  │              │  │          │   │  │
│   │  │ • get_       │  │              │  │          │   │  │
│   │  │   service_   │  │              │  │          │   │  │
│   │  │   availability│  │              │  │          │   │  │
│   │  └──────────────┘  └──────────────┘  └──────────┘   │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │           EXECUTION FLOW                             │  │
│   │                                                      │  │
│   │  1. LLM receives user message + system prompt        │  │
│   │  2. LLM detects intent + parameters                  │  │
│   │  3. LLM outputs JSON tool call                       │  │
│   │  4. Tool executor runs the function                  │  │
│   │  5. Result injected back into conversation           │  │
│   │  6. LLM generates final response                   │  │
│   └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Tool Schema (OpenAI-compatible)

Each tool exports:
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: any, context: ToolContext) => Promise<ToolResult>;
  requiresConfirmation?: boolean;  // Ask user before executing?
}

interface ToolContext {
  conversationId: string;
  projectId: string;
  contactId?: string;
  userMessage: string;
  agent: Agent;
}
```

### 2.4 Built-in Tools (Zero-config)

| Tool | Description | Confirmation | Data Source |
|------|-------------|--------------|-------------|
| `create_appointment` | Schedule a meeting/appointment | Yes | Config service (business hours) |
| `create_order` | Create a product/service order | Yes | RAG (product catalog) |
| `get_product_info` | Query product details | No | RAG knowledge base |
| `get_business_hours` | Return opening hours | No | Config service |
| `transfer_to_human` | Switch to human takeover | No | Conversation mode change |
| `send_notification` | Alert admin via email/WS | No | WebSocket + email |
| `get_service_availability` | Check available slots | No | Config service |
| `get_faq_answer` | Answer from knowledge base | No | RAG search |

### 2.5 Tool Confirmation Flow

For actions that modify state (create_appointment, create_order):
```
User: "Agenda una cita para mañana a las 3pm"
Bot: "Voy a agendar una cita para mañana (15/01) a las 3:00 PM. ¿Confirmas?"
      [Sí] [No] [Modificar]
User: "Sí"
Bot: "✅ Cita agendada exitosamente para mañana a las 3:00 PM."
```

**Implementation:** The tool returns a `pendingConfirmation` state. The frontend renders confirmation buttons. Only after user confirmation the tool executes.

### 2.6 LLM Integration

Use `withStructuredOutput` or `bindTools` from LangChain:

```typescript
// In ai.service.ts
const modelWithTools = chatModel.bindTools(tools);
const response = await modelWithTools.invoke(messages);

if (response.tool_calls && response.tool_calls.length > 0) {
  // Execute tool and re-invoke
  const toolResults = await executeTools(response.tool_calls);
  messages.push(new ToolMessage(toolResults));
  const finalResponse = await modelWithTools.invoke(messages);
}
```

**Supported providers for tool use:**
- ✅ OpenRouter (GPT-4, Claude 3.5+)
- ✅ Gemini (native tool support)
- ⚠️ Ollama (limited, requires llama3.2 or qwen2.5+)

### 2.7 Tool Result Storage

Tool executions create a new message type: `tool_result` in the messages collection:
```typescript
interface ToolResultMessage extends Message {
  sender: 'tool';
  toolName: string;
  toolParams: any;
  toolResult: any;
  status: 'success' | 'error' | 'pending_confirmation';
}
```

---

## 3. Multilingual Embeddings for Qdrant

### 3.1 Embedding Strategy

**Primary model: `nomic-embed-text` (via Ollama)**
- Already used in the project
- 768 dimensions
- Supports 100+ languages including English and Spanish
- Excellent for Spanish semantic search

**Alternative: `multilingual-e5-large` (if using API)**
- Better cross-lingual performance
- Can search Spanish queries against English documents
- Available via Ollama or API

### 3.2 Structured Chunking

Replace simple `RecursiveCharacterTextSplitter` with **semantic chunking**:

```typescript
interface ChunkMetadata {
  document_id: string;
  chunk_id: number;
  document_title: string;
  section_heading: string;
  page_number?: number;
  text: string;
  total_chunks: number;
  // Qdrant payload
  category?: string;
  tags?: string[];
  access_level?: string;
  created_at?: string;
  language?: 'en' | 'es' | 'mixed';  // NEW
}
```

**Chunking rules:**
1. Split by Markdown headers (h1, h2, h3)
2. Each chunk includes: `Document: {title} | Section: {heading} | Content: {text}`
3. Max chunk size: 800 tokens (not characters)
4. Overlap: 100 tokens (not 200)
5. Preserve tables as single chunks

### 3.3 Re-Ranking Strategy

Add a **local re-ranking** step to improve retrieval quality:

```
User Query
    │
    ▼
┌─────────────────┐
│  Qdrant Search  │  ← Retrieve top 10 (instead of 3)
│  (similarity)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Re-Ranker      │  ← Cross-encoder model (local)
│  (cross-encoder)│  • ms-marco-MiniLM-L-6-v2
│                 │  • Ranks 10 docs by relevance
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Top 3 Results  │  ← Most relevant chunks
│  (with scores)  │
└────────┬────────┘
         │
         ▼
   LLM Context
```

**Re-ranker model:** `cross-encoder/ms-marco-MiniLM-L-6-v2` via Ollama or HuggingFace
- Free, local
- Adds ~50-100ms latency
- Significant relevance improvement

### 3.4 Qdrant Collection Configuration

```typescript
// Collection creation parameters
{
  vectors: {
    size: 768,
    distance: 'Cosine',
    on_disk: true,  // For large collections
  },
  hnsw_config: {
    m: 16,           // Connections per node
    ef_construct: 100,  // Build quality
    ef: 64,          // Search quality
  },
  optimizers_config: {
    indexing_threshold: 10000,  // Start indexing after 10k vectors
  }
}
```

### 3.5 Payload Indexes

Maintain existing payload indexes + add language detection:
```typescript
// Payload indexes
[
  { field: 'category', type: 'keyword' },
  { field: 'tags', type: 'keyword' },
  { field: 'access_level', type: 'keyword' },
  { field: 'created_at', type: 'datetime' },
  { field: 'language', type: 'keyword' },  // NEW
  { field: 'document_title', type: 'text' },  // NEW (for text search fallback)
]
```

### 3.6 Hybrid Search (Dense + Sparse)

For future enhancement (not in this change):
- Use Qdrant's sparse vectors for BM25/TF-IDF keyword matching
- Combine dense (semantic) + sparse (lexical) search
- Excellent for Spanish where word order matters

---

## 4. WebSocket Security Hardening

### 4.1 Authentication Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              SECURE WEBSOCKET FLOW                          │
│                                                             │
│  Client (Browser)          Server (Socket.io)              │
│       │                          │                         │
│       │  1. GET /api/auth/me   │                         │
│       │────────────────────────▶│                         │
│       │  (JWT token)            │                         │
│       │                          │                         │
│       │  2. WS connect          │                         │
│       │  + auth: { token }     │                         │
│       │────────────────────────▶│                         │
│       │                          │  3. JWT verify          │
│       │                          │     + user lookup        │
│       │                          │                         │
│       │  4. Connected           │                         │
│       │◀────────────────────────│                         │
│       │                          │                         │
│       │  5. join:room {id}      │                         │
│       │────────────────────────▶│  6. Permission check   │
│       │                          │     (user owns conv?)    │
│       │                          │                         │
│       │  7. Joined / Denied     │                         │
│       │◀────────────────────────│                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Middleware Stack

```typescript
// websocket/socket.ts

io.use(async (socket, next) => {
  try {
    // 1. Extract token
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) throw new Error('Token required');
    
    // 2. Verify JWT
    const decoded = authService.verifyToken(token);
    const user = await userService.findById(decoded.userId);
    if (!user || user.status === 'Inactive') throw new Error('Invalid user');
    
    // 3. Attach user to socket
    socket.user = user;
    socket.userId = decoded.userId;
    
    // 4. Get active project
    const project = await projectService.getActiveProject();
    socket.projectId = project?._id?.toString();
    
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});
```

### 4.3 Room Authorization

```typescript
socket.on('join:room', async (roomId: string) => {
  // 1. Validate roomId is a conversationId
  if (!ObjectId.isValid(roomId)) {
    socket.emit('error', 'Invalid room ID');
    return;
  }
  
  // 2. Check conversation exists and belongs to project
  const conversation = await getConversationsCollection().findOne({
    _id: new ObjectId(roomId),
    projectId: new ObjectId(socket.projectId),
  });
  
  if (!conversation) {
    socket.emit('error', 'Conversation not found or access denied');
    return;
  }
  
  // 3. Admin can join any room; support only active conversations
  if (socket.user.role === 'assistant' && conversation.status !== 'active') {
    socket.emit('error', 'Conversation not active');
    return;
  }
  
  // 4. Join room
  socket.join(roomId);
  logger.info(`Socket ${socket.id} joined room ${roomId}`);
});
```

### 4.4 Public Chat (test-chat) Security

Public chat connections use a different namespace or auth method:
```typescript
// Public namespace: /public
const publicIo = io.of('/public');

publicIo.use(async (socket, next) => {
  // 1. Validate slug
  const slug = socket.handshake.query.slug;
  const project = await projectService.findBySlug(slug);
  if (!project) return next(new Error('Invalid project'));
  
  // 2. Rate limiting via Redis
  const clientIp = socket.handshake.address;
  const allowed = await rateLimiter.check(clientIp, 10, 60); // 10 per minute
  if (!allowed) return next(new Error('Rate limit exceeded'));
  
  // 3. Attach project to socket
  socket.projectId = project._id.toString();
  socket.isPublic = true;
  
  next();
});
```

### 4.5 CORS Configuration

```typescript
// Production CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  // Add custom domains per project
];

io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
```

### 4.6 Rate Limiting

```typescript
// Redis-based rate limiter for WebSocket events
const wsRateLimiter = {
  async check(socket: Socket, event: string, maxPoints: number, duration: number) {
    const key = `ws:${socket.userId || socket.handshake.address}:${event}`;
    const current = await redisClient.incr(key);
    if (current === 1) await redisClient.expire(key, duration);
    return current <= maxPoints;
  }
};

// Apply to chat:send
socket.on('chat:send', async (data) => {
  const allowed = await wsRateLimiter.check(socket, 'send', 30, 60); // 30 msg/min
  if (!allowed) {
    socket.emit('error', 'Too many messages. Please slow down.');
    return;
  }
  // ... process message
});
```

### 4.7 Socket.io Error Handling

```typescript
io.on('connection', (socket) => {
  socket.on('error', (error) => {
    logger.error(`Socket error: ${error.message}`, { socketId: socket.id });
    socket.emit('error', { message: 'An error occurred', code: 'INTERNAL_ERROR' });
  });
  
  // Connection timeout
  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);
  });
});
```

---

## 5. Data Model Changes

### 5.1 New Message Type: `tool`

```typescript
// models/message.model.ts
export interface Message {
  _id?: ObjectId;
  conversationId: ObjectId;
  sender: 'contact' | 'ai_agent' | 'human_agent' | 'tool';  // ADD 'tool'
  senderName: string;
  content: string;
  contentType: 'text' | 'tool_call' | 'tool_result' | 'confirmation_request';  // NEW
  isBot: boolean;
  toolData?: {  // NEW
    toolName: string;
    params: any;
    result?: any;
    status: 'pending' | 'success' | 'error' | 'needs_confirmation';
    confirmedBy?: string;  // userId or 'contact'
  };
  createdAt: Date;
}
```

### 5.2 New Collection: `tool_executions`

```typescript
interface ToolExecution {
  _id: ObjectId;
  conversationId: ObjectId;
  toolName: string;
  params: any;
  result: any;
  status: 'pending_confirmation' | 'executed' | 'failed' | 'cancelled';
  executedBy?: string;  // 'contact' | 'userId'
  executedAt?: Date;
  createdAt: Date;
}
```

### 5.3 New Collection: `appointments` (or reuse existing?)

For zero-config, store appointments in MongoDB:
```typescript
interface Appointment {
  _id: ObjectId;
  conversationId: ObjectId;
  contactId?: ObjectId;
  projectId: ObjectId;
  date: Date;
  time: string;
  service: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: Date;
}
```

---

## 6. Error Handling & Fallbacks

### 6.1 OCR Fallbacks

```
Qwen2.5-VL (Ollama)
    │
    ├─► Success → Continue
    │
    └─► Error / Timeout
         │
         ▼
    Mistral OCR (API)
         │
         ├─► Success → Continue
         │
         └─► Error
              │
              ▼
    pdf-parse (legacy) → Extract raw text
```

### 6.2 Tool Use Fallbacks

If LLM doesn't support tool calling:
- Fallback to regex-based intent detection
- Use keyword matching for common intents
- Store tools in system prompt as "instructions"

### 6.3 Embedding Fallbacks

If Ollama embeddings fail:
- Use OpenRouter embeddings (if configured)
- Fallback to simple keyword search (BM25 via MongoDB text index)

---

## 7. Monitoring & Observability

### 7.1 New Metrics to Track

- `rag_extraction_time`: Time to extract text from PDF
- `rag_extraction_accuracy`: User-reported accuracy (feedback)
- `tool_execution_rate`: % of tool calls that succeed
- `tool_confirmation_rate`: % of pending confirmations that get approved
- `ws_auth_failures`: Number of WebSocket auth failures
- `ws_room_violations`: Attempts to join unauthorized rooms

### 7.2 Logging

Add structured logging for:
- Tool executions (start, end, result, error)
- OCR pipeline (model used, pages, time, success)
- WebSocket events (auth, join, leave, errors)

---

## 8. Testing Strategy

### 8.1 Unit Tests

- Tool executor with mock context
- OCR pipeline with sample PDFs
- WebSocket middleware with mock sockets
- Embedding quality with test queries

### 8.2 Integration Tests

- End-to-end: PDF upload → extraction → search → chat response
- Tool flow: User message → tool detection → execution → confirmation → result
- Security: Unauthorized socket access, room hopping, rate limiting

### 8.3 Manual QA

- Upload 10 PDFs (text, image, mixed, Spanish, English)
- Test each tool with real conversations
- Verify WebSocket security with invalid tokens

---

## 9. Rollout Plan

### Phase 1: WebSocket Security (Week 1)
- Critical for production
- No breaking changes if done correctly

### Phase 2: OCR Pipeline (Week 2)
- Replaces existing extraction
- Test with existing PDFs to ensure parity

### Phase 3: Embeddings (Week 3)
- Can be deployed alongside existing
- Re-index existing documents in background

### Phase 4: Tool Use (Week 4)
- Most complex feature
- Requires frontend changes for confirmations

---

## 10. Open Questions

1. **Q: Should we keep the old PDF extraction as a fallback?**
   A: No, the unified OCR replaces it entirely. If OCR fails, we retry with a different model.

2. **Q: How do we handle tool confirmations in WhatsApp/Instagram (when implemented)?**
   A: Use quick reply buttons or numbered options. Store in the same `toolData` structure.

3. **Q: Should we support English-only documents in a Spanish conversation?**
   A: Yes, nomic-embed-text handles cross-lingual search. The chunking should detect language and store it.

4. **Q: What happens if the user changes the embedding model mid-project?**
   A: Keep existing collection. Start a new collection for the new model. The search queries both (or migrate in background).

---

## 11. Dependencies

**New packages:**
- `cross-encoder` (optional, for re-ranking)
- `date-fns` (for appointment date handling)
- `node-cron` (for appointment reminders)

**Ollama models to pull:**
```bash
ollama pull qwen2.5-vl
ollama pull cross-encoder/ms-marco-MiniLM-L-6-v2  # If available, else use API
```

**No new infrastructure:**
- Uses existing MongoDB, Redis, Qdrant, Ollama
- No new Docker services

---

*End of design document*
