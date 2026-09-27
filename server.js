const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    maxHttpBufferSize: 1e8
});

const HOST = '127.0.0.1';
const PORT = 3000;
const DEFAULT_ROOM = 'general';

// messageId -> { ownerId, roomId, reactions: Map(emoji -> Set(userId)) }
const messages = new Map();

io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId || socket.id;
    socket.data.userId = userId;
    socket.data.roomId = null;
    console.log(`+ Подключился: ${userId}`);

    // === ВХОД В КОМНАТУ ===
    socket.on('join_room', (roomId) => {
        const room = (typeof roomId === 'string' && roomId.trim()) ? roomId.trim() : DEFAULT_ROOM;
        if (socket.data.roomId) socket.leave(socket.data.roomId);
        socket.join(room);
        socket.data.roomId = room;
        console.log(`👤 ${userId} вошёл в комнату ${room}`);
        socket.emit('room_joined', { roomId: room });
        socket.to(room).emit('system_event', { text: '👋 Новый участник присоединился' });
    });

    // === ГОЛОСОВОЕ СООБЩЕНИЕ ===
    socket.on('send_voice_message', ({ messageId, audioBase64 }) => {
        const room = socket.data.roomId || DEFAULT_ROOM;
        if (!messageId || !audioBase64) return;
        messages.set(messageId, { ownerId: socket.data.userId, roomId: room, reactions: new Map() });
        socket.to(room).emit('new_voice_message', {
            messageId,
            senderId: socket.data.userId,
            audioBase64
        });
    });

    // === УДАЛЕНИЕ (только свои) ===
    socket.on('delete_message', ({ messageId }) => {
        const msg = messages.get(messageId);
        if (!msg) return socket.emit('delete_denied', { messageId, reason: 'Сообщение не найдено' });
        if (msg.ownerId !== socket.data.userId) {
            return socket.emit('delete_denied', { messageId, reason: 'Можно удалять только свои сообщения' });
        }
        messages.delete(messageId);
        io.to(msg.roomId).emit('message_deleted', { messageId });
        console.log(`🗑 Удалено сообщение ${messageId} пользователем ${userId}`);
    });

    // === РЕАКЦИИ ===
    socket.on('add_reaction', ({ messageId, emoji }) => {
        const msg = messages.get(messageId);
        if (!msg || !emoji) return;
        if (!msg.reactions) msg.reactions = new Map();

        const uid = socket.data.userId;
        let toggledOff = false;

        for (const [em, set] of msg.reactions) {
            if (set.has(uid)) {
                set.delete(uid);
                if (em === emoji) toggledOff = true;
                if (set.size === 0) msg.reactions.delete(em);
            }
        }
        if (!toggledOff) {
            if (!msg.reactions.has(emoji)) msg.reactions.set(emoji, new Set());
            msg.reactions.get(emoji).add(uid);
        }

        io.to(msg.roomId).emit('reaction_update', {
            messageId,
            reactions: [...msg.reactions.entries()].map(([em, set]) => ({
                emoji: em,
                users: [...set]
            }))
        });
    });

    socket.on('disconnect', () => console.log(`- Отключился: ${userId}`));
});

server.listen(PORT, HOST, () => {
    console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
});