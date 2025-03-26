const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// Временная "база данных"
let users = [
    { id: 1, login: 'user1', password: bcrypt.hashSync('123456', 8), name: 'Алексей' },
    { id: 2, login: 'user2', password: bcrypt.hashSync('123456', 8), name: 'Мария' }
];

let chats = [
    { 
        id: 1, 
        participants: [1, 2], 
        messages: [
            { id: 1, senderId: 1, text: 'Привет! Как дела?', time: '10:30' },
            { id: 2, senderId: 2, text: 'Привет! Все отлично, спасибо!', time: '10:32' }
        ] 
    }
];

// Регистрация
app.post('/api/register', (req, res) => {
    const { login, password, name } = req.body;
    
    if (!login || !password || !name) {
        return res.status(400).json({ message: 'Все поля обязательны' });
    }
    
    if (users.some(u => u.login === login)) {
        return res.status(400).json({ message: 'Пользователь с таким логином уже существует' });
    }
    
    const newUser = {
        id: users.length + 1,
        login,
        password: bcrypt.hashSync(password, 8),
        name
    };
    
    users.push(newUser);
    
    const token = jwt.sign({ id: newUser.id }, 'secret_key', { expiresIn: '24h' });
    
    res.json({ 
        user: { id: newUser.id, login: newUser.login, name: newUser.name },
        token 
    });
});

// Авторизация
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    
    const user = users.find(u => u.login === login);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ message: 'Неверный логин или пароль' });
    }
    
    const token = jwt.sign({ id: user.id }, 'secret_key', { expiresIn: '24h' });
    
    res.json({ 
        user: { id: user.id, login: user.login, name: user.name },
        token 
    });
});

// Получить список пользователей
app.get('/api/users', authenticateToken, (req, res) => {
    res.json(users.filter(u => u.id !== req.user.id));
});

// Получить чаты пользователя
app.get('/api/chats', authenticateToken, (req, res) => {
    const userChats = chats.filter(chat => chat.participants.includes(req.user.id));
    res.json(userChats);
});

// Создать новый чат
app.post('/api/chats', authenticateToken, (req, res) => {
    const { participantId } = req.body;
    
    if (!participantId || !users.some(u => u.id === participantId)) {
        return res.status(400).json({ message: 'Неверный ID участника' });
    }
    
    // Проверяем, есть ли уже чат с этим пользователем
    const existingChat = chats.find(chat => 
        chat.participants.includes(req.user.id) && 
        chat.participants.includes(participantId)
    );
    
    if (existingChat) {
        return res.json(existingChat);
    }
    
    // Создаем новый чат
    const newChat = {
        id: chats.length + 1,
        participants: [req.user.id, participantId],
        messages: []
    };
    
    chats.push(newChat);
    res.json(newChat);
});

// Отправить сообщение
app.post('/api/chats/:chatId/messages', authenticateToken, (req, res) => {
    const { text } = req.body;
    const chatId = parseInt(req.params.chatId);
    
    const chat = chats.find(c => c.id === chatId);
    
    if (!chat || !chat.participants.includes(req.user.id)) {
        return res.status(404).json({ message: 'Чат не найден' });
    }
    
    if (!text) {
        return res.status(400).json({ message: 'Текст сообщения не может быть пустым' });
    }
    
    const newMessage = {
        id: chat.messages.length + 1,
        senderId: req.user.id,
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    chat.messages.push(newMessage);
    res.json(newMessage);
});

// Middleware для проверки токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.sendStatus(401);
    
    jwt.verify(token, 'secret_key', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});