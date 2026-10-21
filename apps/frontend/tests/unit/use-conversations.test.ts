import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (data: any) => void>()
vi.mock('@/services/socket.service', () => ({
  socketService: { on: (event: string, handler: (data: any) => void) => handlers.set(event, handler) },
}))

const { messagingService } = await import('@/services/messaging.service')
const { useConversations, INBOX_PAGE_SIZE } = await import('@/composables/useConversations')

const conv = (id: string, unreadCount = 0) => ({ _id: id, contactName: `Cliente ${id}`, platform: 'Web', status: 'active', mode: 'auto_pilot', lastMessage: 'x', lastMessageAt: '2026-10-21T10:00:00Z', unreadCount } as any)
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useConversations', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('carga por páginas con los filtros y toma los no leídos del servidor', async () => {
    const page = vi.spyOn(messagingService, 'getConversationPage')
      .mockResolvedValueOnce({ conversations: [conv('a', 2), conv('b')], hasMore: true, nextCursor: 'c1', unreadTotal: 7 })
      .mockResolvedValueOnce({ conversations: [conv('b'), conv('c', 1)], hasMore: false, nextCursor: null, unreadTotal: 7 })
    const inbox = useConversations()
    inbox.setActiveChannel('WhatsApp')
    inbox.setSearchQuery('ana')
    await inbox.loadConversations(true)
    expect(page).toHaveBeenLastCalledWith({ limit: INBOX_PAGE_SIZE, q: 'ana', platform: 'WhatsApp' })
    expect(inbox.unreadTotal.value).toBe(7)
    expect(inbox.hasMore.value).toBe(true)

    await inbox.loadMore()
    expect(page).toHaveBeenLastCalledWith({ limit: INBOX_PAGE_SIZE, before: 'c1', q: 'ana', platform: 'WhatsApp' })
    expect(inbox.conversations.value.map((c) => c._id)).toEqual(['a', 'b', 'c'])
    expect(inbox.hasMore.value).toBe(false)
    inbox.setActiveChannel('All')
    inbox.setSearchQuery('')
  })

  it('cuenta los mensajes de conversaciones no cargadas y las añade arriba', async () => {
    vi.spyOn(messagingService, 'getConversationPage').mockResolvedValue({ conversations: [conv('a')], hasMore: true, nextCursor: 'c', unreadTotal: 3 })
    const fetchOne = vi.spyOn(messagingService, 'getConversation').mockResolvedValue(conv('old', 4))
    const inbox = useConversations()
    inbox.bindConversationSocket()
    await inbox.loadConversations(true)

    handlers.get('chat:message')!({ conversationId: 'old', sender: 'contact', content: 'Hola', createdAt: '2026-10-21T11:00:00Z' })
    await flush()
    expect(inbox.unreadTotal.value).toBe(4)
    expect(fetchOne).toHaveBeenCalledWith('old')
    expect(inbox.conversations.value[0]._id).toBe('old')
  })

  it('al leer resta lo de esa conversación, o pregunta al servidor si no está cargada', async () => {
    vi.spyOn(messagingService, 'getConversationPage').mockResolvedValue({ conversations: [conv('a', 2)], hasMore: false, nextCursor: null, unreadTotal: 5 })
    vi.spyOn(messagingService, 'markConversationRead').mockResolvedValue(undefined as any)
    const total = vi.spyOn(messagingService, 'getUnreadTotal').mockResolvedValue(1)
    const inbox = useConversations()
    inbox.bindConversationSocket()
    await inbox.loadConversations(true)

    inbox.markConversationRead('a')
    expect(inbox.unreadTotal.value).toBe(3)
    handlers.get('chat:read')!({ conversationId: 'otra' })
    await flush()
    expect(total).toHaveBeenCalled()
    expect(inbox.unreadTotal.value).toBe(1)
  })
})
