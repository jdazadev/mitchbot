import { io } from 'socket.io-client';
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
// Adjust if API_URL includes /api and socket is on root
const baseUrl = SOCKET_URL.replace('/api', '');
export const socketService = {
    socket: null,
    connect() {
        if (this.socket?.connected)
            return;
        this.socket = io(baseUrl, {
            transports: ['websocket'],
            autoConnect: true,
        });
        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket?.id);
        });
        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });
    },
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    },
    joinRoom(roomId) {
        if (!this.socket)
            this.connect();
        this.socket?.emit('join:room', roomId);
    },
    onMessage(callback) {
        if (!this.socket)
            this.connect();
        this.socket?.on('chat:message', callback);
    },
    offMessage(callback) {
        if (this.socket) {
            this.socket.off('chat:message', callback);
        }
    },
    onMessageChunk(callback) {
        if (!this.socket)
            this.connect();
        this.socket?.on('chat:message_chunk', callback);
    },
    offMessageChunk(callback) {
        if (this.socket) {
            this.socket.off('chat:message_chunk', callback);
        }
    }
};
//# sourceMappingURL=socket.service.js.map