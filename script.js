// Configuración
const OPENAI_API_KEY = "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";
const MAX_MESSAGES = 100; // Límite de mensajes en pantalla
const MESSAGE_LIMIT_PER_USER = 50; // Límite por usuario (local)

let messages = [];
let users = {};
let currentUser = localStorage.getItem('chatUsername') || 'Invitado_' + Math.floor(Math.random() * 1000);
let userId = 'user_' + Date.now() + '_' + Math.random();
let onlineUsers = new Set();

// Elementos DOM
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const imageUploadBtn = document.getElementById('imageUploadBtn');
const imageInput = document.getElementById('imageInput');
const charCountSpan = document.getElementById('charCount');
const usernameDisplay = document.getElementById('usernameDisplay');
const editNameBtn = document.getElementById('editNameBtn');
const onlineCountSpan = document.getElementById('onlineCount');
const clearChatBtn = document.getElementById('clearChatBtn');
const copyModal = document.getElementById('copyModal');
const typingIndicator = document.getElementById('typingIndicator');

// Inicializar
usernameDisplay.textContent = currentUser;
onlineUsers.add(userId);
updateOnlineCount();

let typingTimeout = null;

// ========== MODERACIÓN CON IA (OpenAI) ==========
async function moderateWithAI(text) {
    try {
        const response = await fetch('https://api.openai.com/v1/moderations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({ input: text })
        });
        
        if (!response.ok) throw new Error('Error en moderación');
        
        const data = await response.json();
        const results = data.results[0];
        
        if (results.flagged) {
            const categories = Object.keys(results.categories).filter(cat => results.categories[cat]);
            return { allowed: false, reason: `Contenido inapropiado detectado: ${categories.join(', ')}` };
        }
        return { allowed: true, reason: null };
    } catch (error) {
        console.error('Error moderando:', error);
        // Si falla la API, permitimos pero logueamos
        return { allowed: true, reason: null };
    }
}

// ========== FUNCIONES DEL CHAT ==========
function addSystemMessage(text, isError = false) {
    const msg = {
        id: Date.now() + '_system',
        author: '🤖 Moderador IA',
        text: text,
        time: new Date().toLocaleTimeString(),
        isSystem: true,
        isError: isError
    };
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) messages.shift();
    renderMessages();
}

async function sendMessage(text, imageUrl = null) {
    if (!text.trim() && !imageUrl) return;
    
    // Moderación con IA
    if (text.trim()) {
        const moderation = await moderateWithAI(text);
        if (!moderation.allowed) {
            addSystemMessage(`⚠️ Mensaje bloqueado: ${moderation.reason}`, true);
            return;
        }
    }
    
    const message = {
        id: Date.now(),
        author: currentUser,
        userId: userId,
        text: text.trim(),
        image: imageUrl,
        time: new Date().toLocaleTimeString(),
        timestamp: Date.now()
    };
    
    messages.push(message);
    if (messages.length > MAX_MESSAGES) messages.shift();
    
    // Guardar en localStorage
    saveMessagesToLocal();
    renderMessages();
    scrollToBottom();
    
    // Animación de envío
    sendBtn.classList.add('send-animation');
    setTimeout(() => sendBtn.classList.remove('send-animation'), 300);
    
    // Simular respuesta de IA (moderación pasiva)
    if (text.toLowerCase().includes('gracias')) {
        setTimeout(() => addSystemMessage('¡De nada! 😊 Recuerda mantener un ambiente respetuoso.'), 500);
    }
}

function renderMessages() {
    messagesContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        if (msg.isSystem) {
            messageDiv.style.background = msg.isError ? 'rgba(255,70,70,0.1)' : 'rgba(88,101,242,0.1)';
            messageDiv.style.borderLeft = `3px solid ${msg.isError ? '#ff4444' : '#5865f2'}`;
        }
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = msg.isSystem ? '🤖' : (msg.author.charAt(0).toUpperCase() || 'U');
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const header = document.createElement('div');
        header.className = 'message-header';
        header.innerHTML = `
            <span class="message-author" style="${msg.isSystem ? 'color: #5865f2' : ''}">${msg.author}</span>
            <span class="message-time">${msg.time}</span>
        `;
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = msg.text || (msg.image ? '📷 Imagen' : '');
        
        contentDiv.appendChild(header);
        contentDiv.appendChild(textDiv);
        
        if (msg.image) {
            const img = document.createElement('img');
            img.src = msg.image;
            img.className = 'message-image';
            img.onclick = () => window.open(msg.image, '_blank');
            contentDiv.appendChild(img);
        }
        
        // Botones de acción (solo para mensajes normales)
        if (!msg.isSystem) {
            const actions = document.createElement('div');
            actions.className = 'message-actions';
            actions.innerHTML = `
                <button class="action-btn copy-msg" data-id="${msg.id}"><i class="fas fa-copy"></i> Copiar</button>
                <button class="action-btn reply-msg" data-id="${msg.id}" data-author="${msg.author}" data-text="${msg.text.substring(0, 50)}"><i class="fas fa-reply"></i> Responder</button>
            `;
            contentDiv.appendChild(actions);
        }
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        fragment.appendChild(messageDiv);
    });
    
    messagesContainer.appendChild(fragment);
    
    // Event listeners para botones dinámicos
    document.querySelectorAll('.copy-msg').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const msgId = parseInt(btn.dataset.id);
            const msg = messages.find(m => m.id === msgId);
            if (msg) {
                navigator.clipboard.writeText(msg.text);
                copyModal.style.display = 'flex';
                setTimeout(() => copyModal.style.display = 'none', 1500);
            }
        });
    });
    
    document.querySelectorAll('.reply-msg').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const author = btn.dataset.author;
            const text = btn.dataset.text;
            messageInput.value = `@${author} (respondiendo a: "${text}"): `;
            messageInput.focus();
        });
    });
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function saveMessagesToLocal() {
    localStorage.setItem('chatMessages', JSON.stringify(messages.slice(-MAX_MESSAGES)));
}

function loadMessagesFromLocal() {
    const saved = localStorage.getItem('chatMessages');
    if (saved) {
        messages = JSON.parse(saved);
        renderMessages();
        scrollToBottom();
    }
}

function updateOnlineCount() {
    onlineCountSpan.textContent = onlineUsers.size;
}

// ========== MANEJO DE IMÁGENES ==========
imageUploadBtn.addEventListener('click', () => {
    imageInput.click();
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            sendMessage('', ev.target.result);
        };
        reader.readAsDataURL(file);
    }
    imageInput.value = '';
});

// ========== EVENTOS ==========
sendBtn.addEventListener('click', () => {
    const text = messageInput.value.trim();
    if (text || imageInput.files.length) {
        sendMessage(text);
        messageInput.value = '';
        updateCharCount();
    }
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
    // Indicador de escritura
    if (typingTimeout) clearTimeout(typingTimeout);
    typingIndicator.style.display = 'flex';
    typingTimeout = setTimeout(() => {
        typingIndicator.style.display = 'none';
    }, 1000);
});

function updateCharCount() {
    charCountSpan.textContent = messageInput.value.length;
}

messageInput.addEventListener('input', updateCharCount);

editNameBtn.addEventListener('click', () => {
    const newName = prompt('Nuevo nombre de usuario:', currentUser);
    if (newName && newName.trim()) {
        currentUser = newName.trim();
        usernameDisplay.textContent = currentUser;
        localStorage.setItem('chatUsername', currentUser);
        addSystemMessage(`${currentUser} se unió al chat`);
    }
});

clearChatBtn.addEventListener('click', () => {
    if (confirm('¿Limpiar todos los mensajes localmente?')) {
        messages = [];
        saveMessagesToLocal();
        renderMessages();
        addSystemMessage('Chat limpiado por el usuario');
    }
});

// Cerrar modal
document.querySelector('.close-modal')?.addEventListener('click', () => {
    copyModal.style.display = 'none';
});

// Inicializar
loadMessagesFromLocal();
addSystemMessage('✨ Bienvenido a ChatSphere 2.0 - Moderado por IA ✨');
addSystemMessage('🔒 Este chat usa OpenAI para moderar groserías y contenido inapropiado');

setInterval(() => {
    // Simular usuarios online (en una versión real usarías WebSockets)
    onlineUsers.add('user_' + Math.random());
    if (onlineUsers.size > 50) onlineUsers.clear();
    updateOnlineCount();
}, 30000);
