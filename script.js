// ========== CONFIGURACIÓN LOCAL ==========
let currentUser = null;
let currentChatWith = null;
let messages = [];
let friends = [];
let allUsers = [];

function generarUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function cargarDatos() {
    let userId = localStorage.getItem('userId');
    let userData = localStorage.getItem('userData');
    
    if (!userId || !userData) {
        userId = generarUserId();
        currentUser = {
            id: userId,
            name: 'Usuario_' + Math.floor(Math.random() * 10000),
            avatar: '👤',
            created_at: new Date().toISOString()
        };
        localStorage.setItem('userId', userId);
        localStorage.setItem('userData', JSON.stringify(currentUser));
    } else {
        currentUser = JSON.parse(userData);
        currentUser.id = userId;
    }
    
    const savedUsers = localStorage.getItem('allUsers');
    if (savedUsers) {
        allUsers = JSON.parse(savedUsers);
    } else {
        allUsers = [];
    }
    
    if (!allUsers.find(u => u.id === currentUser.id)) {
        allUsers.push(currentUser);
        localStorage.setItem('allUsers', JSON.stringify(allUsers));
    }
    
    const savedFriends = localStorage.getItem('friends_' + currentUser.id);
    if (savedFriends) {
        friends = JSON.parse(savedFriends);
    } else {
        friends = [];
    }
    
    actualizarUIUsuario();
    renderFriendsList();
    renderChatsList();
}

function actualizarUIUsuario() {
    const displayName = document.getElementById('displayName');
    const displayUserId = document.getElementById('displayUserId');
    const userAvatar = document.getElementById('userAvatar');
    
    if (displayName) displayName.textContent = currentUser.name;
    if (displayUserId) displayUserId.textContent = 'ID: ' + currentUser.id.substring(0, 12) + '...';
    if (userAvatar) userAvatar.textContent = currentUser.avatar;
}

function buscarUsuarioPorId(userId) {
    return allUsers.find(u => u.id === userId) || null;
}

window.agregarAmigo = function(friendId) {
    if (friendId === currentUser.id) {
        alert('No puedes agregarte a ti mismo');
        return false;
    }
    
    const amigo = buscarUsuarioPorId(friendId);
    if (!amigo) {
        alert('Usuario no encontrado. Asegúrate que la otra persona haya abierto el chat al menos una vez.');
        return false;
    }
    
    if (friends.find(f => f.id === friendId)) {
        alert('Ya son amigos');
        return false;
    }
    
    friends.push(amigo);
    localStorage.setItem('friends_' + currentUser.id, JSON.stringify(friends));
    
    alert('¡' + amigo.name + ' es tu amigo ahora!');
    renderFriendsList();
    renderChatsList();
    return true;
};

function renderFriendsList() {
    const container = document.getElementById('friendsList');
    if (!container) return;
    
    if (friends.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay amigos.<br>Usa el botón + para agregar</div>';
        return;
    }
    
    container.innerHTML = '';
    friends.forEach(amigo => {
        const div = document.createElement('div');
        div.className = 'friend-item';
        div.innerHTML = '<div class="friend-avatar">' + (amigo.avatar || '👤') + '</div>' +
            '<div class="friend-name">' + amigo.name + '</div>' +
            '<div class="friend-id">' + amigo.id.substring(0, 8) + '...</div>';
        div.onclick = () => abrirChatPrivado(amigo);
        container.appendChild(div);
    });
}

function renderChatsList() {
    const container = document.getElementById('chatsList');
    if (!container) return;
    
    if (friends.length === 0) {
        container.innerHTML = '<div class="empty-state">Agrega amigos para chatear</div>';
        return;
    }
    
    container.innerHTML = '';
    friends.forEach(amigo => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        if (currentChatWith && currentChatWith.id === amigo.id) div.classList.add('active');
        div.innerHTML = '<div class="chat-avatar">' + (amigo.avatar || '👤') + '</div>' +
            '<div class="chat-name">' + amigo.name + '</div>';
        div.onclick = () => abrirChatPrivado(amigo);
        container.appendChild(div);
    });
}

function abrirChatPrivado(usuario) {
    currentChatWith = usuario;
    const chatWithInfo = document.getElementById('chatWithInfo');
    if (chatWithInfo) {
        chatWithInfo.innerHTML = '<i class="fas fa-user"></i><span>' + usuario.name + '</span>';
    }
    cargarMensajesPrivados(usuario.id);
}

function getChatKey(userId1, userId2) {
    const ids = [userId1, userId2].sort();
    return 'chat_' + ids[0] + '_' + ids[1];
}

function cargarMensajesPrivados(friendId) {
    const chatKey = getChatKey(currentUser.id, friendId);
    const savedMessages = localStorage.getItem(chatKey);
    
    if (savedMessages) {
        messages = JSON.parse(savedMessages);
    } else {
        messages = [];
    }
    
    renderMessages();
}

function sendPrivateMessage(text, imageUrl) {
    imageUrl = imageUrl || null;
    if ((!text || !text.trim()) && !imageUrl) return;
    if (!currentChatWith) {
        alert('Selecciona un chat primero');
        return;
    }
    
    const message = {
        id: Date.now(),
        text: text ? text.trim() : '',
        image: imageUrl,
        senderId: currentUser.id,
        senderName: currentUser.name,
        timestamp: Date.now(),
        time: new Date().toLocaleTimeString()
    };
    
    messages.push(message);
    
    const chatKey = getChatKey(currentUser.id, currentChatWith.id);
    localStorage.setItem(chatKey, JSON.stringify(messages));
    
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.value = '';
        const charCount = document.getElementById('charCount');
        if (charCount) charCount.textContent = '0';
    }
    
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.classList.add('send-animation');
        setTimeout(function() { sendBtn.classList.remove('send-animation'); }, 200);
    }
    
    renderMessages();
}

function renderMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="welcome-message"><i class="fas fa-comments"></i><h3>Chat privado</h3><p>Envía un mensaje para comenzar</p></div>';
        return;
    }
    
    container.innerHTML = '';
    
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const isMine = msg.senderId === currentUser.id;
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        if (isMine) messageDiv.style.justifyContent = 'flex-end';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.style.maxWidth = '70%';
        contentDiv.style.background = isMine ? '#5865f2' : 'rgba(255,255,255,0.08)';
        contentDiv.style.padding = '8px 12px';
        contentDiv.style.borderRadius = '12px';
        
        if (!isMine) {
            const header = document.createElement('div');
            header.className = 'message-header';
            header.innerHTML = '<span class="message-author">' + escapeHtml(msg.senderName) + '</span><span class="message-time">' + msg.time + '</span>';
            contentDiv.appendChild(header);
        } else {
            const timeSpan = document.createElement('div');
            timeSpan.style.fontSize = '10px';
            timeSpan.style.color = '#949ba4';
            timeSpan.style.textAlign = 'right';
            timeSpan.textContent = msg.time;
            contentDiv.appendChild(timeSpan);
        }
        
        if (msg.text) {
            const textDiv = document.createElement('div');
            textDiv.className = 'message-text';
            textDiv.textContent = msg.text;
            contentDiv.appendChild(textDiv);
        }
        
        if (msg.image) {
            const img = document.createElement('img');
            img.src = msg.image;
            img.className = 'message-image';
            img.style.maxWidth = '150px';
            img.style.borderRadius = '8px';
            img.style.marginTop = '8px';
            img.style.cursor = 'pointer';
            img.onclick = function() { window.open(msg.image, '_blank'); };
            contentDiv.appendChild(img);
        }
        
        if (!isMine && msg.text) {
            const actions = document.createElement('div');
            actions.className = 'message-actions';
            actions.style.marginTop = '8px';
            actions.innerHTML = '<button class="action-btn copy-msg"><i class="fas fa-copy"></i> Copiar</button><button class="action-btn reply-msg"><i class="fas fa-reply"></i> Responder</button>';
            contentDiv.appendChild(actions);
        }
        
        messageDiv.appendChild(contentDiv);
        container.appendChild(messageDiv);
    }
    
    document.querySelectorAll('.copy-msg').forEach(function(btn) {
        btn.onclick = function(e) {
            const msgText = btn.closest('.message-content')?.querySelector('.message-text')?.textContent;
            if (msgText) {
                navigator.clipboard.writeText(msgText);
                const modal = document.getElementById('copyModal');
                if (modal) {
                    modal.style.display = 'flex';
                    setTimeout(function() { modal.style.display = 'none'; }, 1500);
                }
            }
        };
    });
    
    document.querySelectorAll('.reply-msg').forEach(function(btn) {
        btn.onclick = function() {
            const msgText = btn.closest('.message-content')?.querySelector('.message-text')?.textContent;
            const input = document.getElementById('messageInput');
            if (msgText && input) {
                input.value = '"' + msgText.substring(0, 50) + '"\n';
                input.focus();
            }
        };
    });
    
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function editarPerfil(nuevoNombre, nuevoAvatar) {
    if (!nuevoNombre) return;
    
    currentUser.name = nuevoNombre;
    currentUser.avatar = nuevoAvatar || '👤';
    
    const userIndex = allUsers.findIndex(function(u) { return u.id === currentUser.id; });
    if (userIndex !== -1) {
        allUsers[userIndex] = currentUser;
        localStorage.setItem('allUsers', JSON.stringify(allUsers));
    }
    
    localStorage.setItem('userData', JSON.stringify(currentUser));
    
    friends = friends.map(function(f) {
        if (f.id === currentUser.id) return currentUser;
        return f;
    });
    localStorage.setItem('friends_' + currentUser.id, JSON.stringify(friends));
    
    actualizarUIUsuario();
    renderFriendsList();
    renderChatsList();
    alert('Perfil actualizado');
}

document.addEventListener('DOMContentLoaded', function() {
    cargarDatos();
    
    const searchModal = document.getElementById('searchModal');
    const addFriendModal = document.getElementById('addFriendModal');
    const editProfileModal = document.getElementById('editProfileModal');
    
    const searchUserBtn = document.getElementById('searchUserBtn');
    if (searchUserBtn) {
        searchUserBtn.onclick = function() {
            if (searchModal) searchModal.style.display = 'flex';
        };
    }
    
    const addFriendBtn = document.getElementById('addFriendBtn');
    if (addFriendBtn) {
        addFriendBtn.onclick = function() {
            if (addFriendModal) addFriendModal.style.display = 'flex';
        };
    }
    
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.onclick = function() {
            const editName = document.getElementById('editName');
            const editAvatar = document.getElementById('editAvatar');
            if (editName) editName.value = currentUser.name;
            if (editAvatar) editAvatar.value = currentUser.avatar;
            if (editProfileModal) editProfileModal.style.display = 'flex';
        };
    }
    
    const searchSubmitBtn = document.getElementById('searchSubmitBtn');
    if (searchSubmitBtn) {
        searchSubmitBtn.onclick = function() {
            const userIdInput = document.getElementById('searchUserId');
            const userId = userIdInput ? userIdInput.value.trim() : '';
            const resultDiv = document.getElementById('searchResult');
            
            if (!userId) {
                if (resultDiv) resultDiv.innerHTML = '<p style="color: #ffaa00;">Ingresa un ID</p>';
                return;
            }
            
            const usuario = buscarUsuarioPorId(userId);
            if (resultDiv) {
                if (usuario) {
                    resultDiv.innerHTML = '<div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">' +
                        '<div style="font-size: 32px;">' + (usuario.avatar || '👤') + '</div>' +
                        '<div><strong>' + usuario.name + '</strong><br><small>ID: ' + usuario.id + '</small></div>' +
                        '<button onclick="agregarAmigo(\'' + usuario.id + '\')" style="margin-left: auto; padding: 8px 16px; background: #5865f2; border: none; border-radius: 8px; color: white; cursor: pointer;">Agregar</button>' +
                        '</div>';
                } else {
                    resultDiv.innerHTML = '<p style="color: #ff4444;">Usuario no encontrado</p>';
                }
            }
        };
    }
    
    const addFriendSubmitBtn = document.getElementById('addFriendSubmitBtn');
    if (addFriendSubmitBtn) {
        addFriendSubmitBtn.onclick = function() {
            const friendIdInput = document.getElementById('friendUserId');
            const friendId = friendIdInput ? friendIdInput.value.trim() : '';
            if (friendId) {
                agregarAmigo(friendId);
                if (addFriendModal) addFriendModal.style.display = 'none';
                if (friendIdInput) friendIdInput.value = '';
            } else {
                alert('Ingresa un ID de usuario');
            }
        };
    }
    
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.onclick = function() {
            const editName = document.getElementById('editName');
            const editAvatar = document.getElementById('editAvatar');
            const newName = editName ? editName.value.trim() : '';
            const newAvatar = editAvatar ? editAvatar.value.trim() : '👤';
            if (newName) {
                editarPerfil(newName, newAvatar);
                if (editProfileModal) editProfileModal.style.display = 'none';
            }
        };
    }
    
    const clearChatBtn = document.getElementById('clearChatBtn');
    if (clearChatBtn) {
        clearChatBtn.onclick = function() {
            if (confirm('Limpiar mensajes de este chat?')) {
                messages = [];
                if (currentChatWith) {
                    const chatKey = getChatKey(currentUser.id, currentChatWith.id);
                    localStorage.setItem(chatKey, JSON.stringify(messages));
                }
                renderMessages();
            }
        };
    }
    
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    if (sendBtn && messageInput) {
        sendBtn.onclick = function() {
            const text = messageInput.value.trim();
            if (text) sendPrivateMessage(text);
        };
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendBtn.click();
            }
        });
        messageInput.addEventListener('input', function() {
            const charCount = document.getElementById('charCount');
            if (charCount) charCount.textContent = messageInput.value.length;
        });
    }
    
    const imageUploadBtn = document.getElementById('imageUploadBtn');
    const imageInput = document.getElementById('imageInput');
    if (imageUploadBtn && imageInput) {
        imageUploadBtn.onclick = function() { imageInput.click(); };
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(ev) { sendPrivateMessage('', ev.target.result); };
                reader.readAsDataURL(file);
            }
            imageInput.value = '';
        });
    }
    
    document.querySelectorAll('.close-modal').forEach(function(btn) {
        btn.onclick = function() {
            if (searchModal) searchModal.style.display = 'none';
            if (addFriendModal) addFriendModal.style.display = 'none';
            if (editProfileModal) editProfileModal.style.display = 'none';
            const copyModal = document.getElementById('copyModal');
            if (copyModal) copyModal.style.display = 'none';
        };
    });
    
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (menuBtn && sidebar && overlay) {
        menuBtn.onclick = function() {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        };
        overlay.onclick = function() {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        };
    }
    
    const container = document.getElementById('messagesContainer');
    if (container) {
        container.innerHTML = '<div class="welcome-message">' +
            '<i class="fas fa-lock"></i>' +
            '<h3>Chats Privados</h3>' +
            '<p>Agrega amigos por su ID y chatea en privado</p>' +
            '<p style="margin-top: 16px; font-size: 12px; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px;">' +
            '<strong>TU ID:</strong><br>' +
            '<code style="font-size: 11px; word-break: break-all;">' + currentUser.id + '</code>' +
            '</p>' +
            '<p style="margin-top: 12px; font-size: 12px;">Comparte este ID con tus amigos</p>' +
            '</div>';
    }
});
