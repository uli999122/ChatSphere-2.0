// ========== CONFIGURACIÓN ==========
let messages = [];
let currentUser = localStorage.getItem('chatUsername') || 'Invitado_' + Math.floor(Math.random() * 1000);
let userId = 'user_' + Date.now() + '_' + Math.random();
let onlineUsers = new Set();
let typingTimeout = null;

// ========== IA REAL CON OPENAI (PROXY FUNCIONANDO) ==========
const PROXY_URL = 'https://openai-moderation-proxy.juandiegouribe30.workers.dev';

async function moderateWithAI(text) {
    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });
        
        if (!response.ok) {
            return { allowed: true, reason: null };
        }
        
        const data = await response.json();
        
        if (data.results && data.results[0] && data.results[0].flagged === true) {
            const categories = Object.keys(data.results[0].categories)
                .filter(cat => data.results[0].categories[cat] === true);
            return { 
                allowed: false, 
                reason: `❌ Bloqueado por IA: ${categories.join(', ')}` 
            };
        }
        
        return { allowed: true, reason: null };
    } catch (error) {
        console.error('Error IA:', error);
        return { allowed: true, reason: null };
    }
}

// ========== ESPERAR A QUE CARGUE EL DOM ==========
document.addEventListener('DOMContentLoaded', function() {
    iniciarChat();
});

function iniciarChat() {
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
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    // ========== FUNCIONES ==========
    function addSystemMessage(text, isError = false) {
        const msg = {
            id: Date.now() + '_system',
            author: '🤖 IA Moderador',
            text: text,
            time: new Date().toLocaleTimeString(),
            isSystem: true,
            isError: isError
        };
        messages.push(msg);
        if (messages.length > 100) messages.shift();
        renderMessages();
        saveMessages();
    }

    async function sendMessage(text, imageUrl = null) {
        if (!text.trim() && !imageUrl) return;
        
        if (text.trim()) {
            const moderation = await moderateWithAI(text);
            if (!moderation.allowed) {
                addSystemMessage(moderation.reason, true);
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
        if (messages.length > 100) messages.shift();
        
        saveMessages();
        renderMessages();
        scrollToBottom();
        
        if (sendBtn) {
            sendBtn.classList.add('send-animation');
            setTimeout(() => sendBtn.classList.remove('send-animation'), 200);
        }
    }

    function renderMessages() {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = '';
        
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
                <span class="message-author" style="${msg.isSystem ? 'color: #5865f2' : ''}">${escapeHtml(msg.author)}</span>
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
            
            if (!msg.isSystem) {
                const actions = document.createElement('div');
                actions.className = 'message-actions';
                actions.innerHTML = `
                    <button class="action-btn copy-msg" data-id="${msg.id}"><i class="fas fa-copy"></i> Copiar</button>
                    <button class="action-btn reply-msg" data-id="${msg.id}" data-author="${escapeHtml(msg.author)}" data-text="${escapeHtml(msg.text.substring(0, 50))}"><i class="fas fa-reply"></i> Responder</button>
                `;
                contentDiv.appendChild(actions);
            }
            
            messageDiv.appendChild(avatar);
            messageDiv.appendChild(contentDiv);
            messagesContainer.appendChild(messageDiv);
        });
        
        // Eventos para copiar y responder
        document.querySelectorAll('.copy-msg').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const msgId = parseInt(btn.dataset.id);
                const msg = messages.find(m => m.id === msgId);
                if (msg) {
                    navigator.clipboard.writeText(msg.text);
                    if (copyModal) {
                        copyModal.style.display = 'flex';
                        setTimeout(() => {
                            if (copyModal) copyModal.style.display = 'none';
                        }, 1500);
                    }
                }
            });
        });
        
        document.querySelectorAll('.reply-msg').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const author = btn.dataset.author;
                const text = btn.dataset.text;
                if (messageInput) {
                    messageInput.value = `@${author} "${text}" → `;
                    messageInput.focus();
                }
            });
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function scrollToBottom() {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    function saveMessages() {
        localStorage.setItem('chatMessages', JSON.stringify(messages.slice(-100)));
    }

    function loadMessages() {
        const saved = localStorage.getItem('chatMessages');
        if (saved) {
            messages = JSON.parse(saved);
            renderMessages();
            scrollToBottom();
        }
    }

    function updateOnlineCount() {
        if (onlineCountSpan) {
            onlineCountSpan.textContent = onlineUsers.size;
        }
    }

    function updateCharCount() {
        if (charCountSpan && messageInput) {
            charCountSpan.textContent = messageInput.value.length;
        }
    }

    // ========== IMÁGENES ==========
    if (imageUploadBtn && imageInput) {
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
    }

    // ========== EVENTOS ==========
    if (sendBtn && messageInput) {
        sendBtn.addEventListener('click', () => {
            const text = messageInput.value.trim();
            if (text) {
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
            
            if (typingTimeout) clearTimeout(typingTimeout);
            if (typingIndicator) typingIndicator.style.display = 'flex';
            typingTimeout = setTimeout(() => {
                if (typingIndicator) typingIndicator.style.display = 'none';
            }, 1000);
        });
        
        messageInput.addEventListener('input', updateCharCount);
    }

    if (editNameBtn) {
        editNameBtn.addEventListener('click', () => {
            const newName = prompt('Nuevo nombre de usuario:', currentUser);
            if (newName && newName.trim()) {
                currentUser = newName.trim();
                if (usernameDisplay) usernameDisplay.textContent = currentUser;
                localStorage.setItem('chatUsername', currentUser);
                addSystemMessage(`${currentUser} se unió al chat`);
            }
        });
    }

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            if (confirm('¿Limpiar todos los mensajes?')) {
                messages = [];
                saveMessages();
                renderMessages();
                addSystemMessage('Chat limpiado');
            }
        });
    }

    // Cerrar modal
    const closeModal = document.querySelector('.close-modal');
    if (closeModal && copyModal) {
        closeModal.addEventListener('click', () => {
            copyModal.style.display = 'none';
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === copyModal) {
                copyModal.style.display = 'none';
            }
        });
    }

    // ========== MENÚ MÓVIL ==========
    if (menuBtn && sidebar && overlay) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        });
        
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    // ========== ATEJOS TECLADO PC ==========
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            if (confirm('¿Limpiar chat?')) {
                messages = [];
                saveMessages();
                renderMessages();
                addSystemMessage('Chat limpiado');
            }
        }
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            if (editNameBtn) editNameBtn.click();
        }
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            if (imageUploadBtn) imageUploadBtn.click();
        }
    });

    // ========== NOTIFICACIONES ==========
    let isTabActive = true;
    window.addEventListener('focus', () => isTabActive = true);
    window.addEventListener('blur', () => isTabActive = false);
    
    if ('Notification' in window) {
        Notification.requestPermission();
    }

    // ========== INICIALIZAR ==========
    if (usernameDisplay) usernameDisplay.textContent = currentUser;
    onlineUsers.add(userId);
    updateOnlineCount();
    loadMessages();
    addSystemMessage('✨ ChatSphere 2.0 con IA de OpenAI ✨');
    addSystemMessage('🤖 La IA moderará automáticamente las groserías');

    // Simular usuarios online
    setInterval(() => {
        onlineUsers.add('user_' + Math.random());
        if (onlineUsers.size > 50) onlineUsers.clear();
        updateOnlineCount();
    }, 30000);
                }
