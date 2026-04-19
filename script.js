// ========== SUPABASE CONFIG ==========
const SUPABASE_URL = 'https://dmdnawzdctdxhwoyzrhn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtZG5hd3pkY3RkeGh3b3l6cmhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODY5OTEsImV4cCI6MjA5MjA2Mjk5MX0.pr8GFA9oWF3n-zs-h7MHrF6a_ZZEQamVhPTfgmqzO1I';

// Función para hacer peticiones a Supabase
async function supabaseQuery(endpoint, method = 'GET', body = null) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
    };
    
    const options = {
        method: method,
        headers: headers
    };
    
    if (body && (method === 'POST' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    return await response.json();
}

// ========== VARIABLES ==========
let currentUser = null;
let currentChatWith = null;
let messages = [];
let friends = [];

// ========== GENERAR ID ==========
function generarUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

// ========== INICIAR USUARIO ==========
async function iniciarUsuario() {
    let userId = localStorage.getItem('userId');
    let userData = localStorage.getItem('userData');
    
    if (!userId || !userData) {
        userId = generarUserId();
        currentUser = {
            id: userId,
            name: 'Usuario_' + Math.floor(Math.random() * 10000),
            avatar: '👤',
            avatar_type: 'emoji',
            created_at: new Date().toISOString()
        };
        
        try {
            await supabaseQuery('users', 'POST', currentUser);
        } catch(e) { console.error(e); }
        
        localStorage.setItem('userId', userId);
        localStorage.setItem('userData', JSON.stringify(currentUser));
    } else {
        currentUser = JSON.parse(userData);
        currentUser.id = userId;
    }
    
    actualizarUIUsuario();
    await cargarAmigos();
    await cargarChatsRecientes();
}

function actualizarUIUsuario() {
    const displayName = document.getElementById('displayName');
    const displayUserId = document.getElementById('displayUserId');
    const avatarEmoji = document.getElementById('userAvatarEmoji');
    const avatarImg = document.getElementById('userAvatarImg');
    
    if (displayName) displayName.textContent = currentUser.name;
    if (displayUserId) displayUserId.textContent = 'ID: ' + currentUser.id.substring(0, 12) + '...';
    
    if (currentUser.avatar_type === 'image' && currentUser.avatar) {
        if (avatarImg) {
            avatarImg.src = currentUser.avatar;
            avatarImg.style.display = 'block';
        }
        if (avatarEmoji) avatarEmoji.style.display = 'none';
    } else {
        if (avatarEmoji) {
            avatarEmoji.textContent = currentUser.avatar || '👤';
            avatarEmoji.style.display = 'block';
        }
        if (avatarImg) avatarImg.style.display = 'none';
    }
}

// ========== BUSCAR USUARIO ==========
async function buscarUsuarioPorId(userId) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=*`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const data = await response.json();
        return data && data.length > 0 ? data[0] : null;
    } catch(e) {
        return null;
    }
}

// ========== AGREGAR AMIGO ==========
window.agregarAmigo = async function(friendId) {
    if (friendId === currentUser.id) {
        alert('No puedes agregarte a ti mismo');
        return false;
    }
    
    const amigo = await buscarUsuarioPorId(friendId);
    if (!amigo) {
        alert('Usuario no encontrado');
        return false;
    }
    
    try {
        // Verificar si ya son amigos
        const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/friends?user_id=eq.${currentUser.id}&friend_id=eq.${friendId}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const existing = await checkResponse.json();
        
        if (existing && existing.length > 0) {
            alert('Ya son amigos');
            return false;
        }
        
        await fetch(`${SUPABASE_URL}/rest/v1/friends`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                friend_id: friendId,
                created_at: new Date().toISOString()
            })
        });
        
        alert('¡' + amigo.name + ' es tu amigo ahora!');
        await cargarAmigos();
        await cargarChatsRecientes();
        return true;
    } catch(e) {
        alert('Error al agregar amigo');
        return false;
    }
};

// ========== CARGAR AMIGOS ==========
async function cargarAmigos() {
    const container = document.getElementById('friendsList');
    if (!container) return;
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/friends?or=(user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id})`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const data = await response.json();
        
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay amigos.<br>Usa el botón + para agregar</div>';
            return;
        }
        
        const amigosIds = data.map(f => f.user_id === currentUser.id ? f.friend_id : f.user_id);
        
        if (amigosIds.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay amigos</div>';
            return;
        }
        
        const usersResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=in.(${amigosIds.map(id => `"${id}"`).join(',')})`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const amigos = await usersResponse.json();
        
        if (amigos && amigos.length > 0) {
            friends = amigos;
            container.innerHTML = '';
            amigos.forEach(amigo => {
                const div = document.createElement('div');
                div.className = 'friend-item';
                
                let avatarHtml = '';
                if (amigo.avatar_type === 'image' && amigo.avatar) {
                    avatarHtml = '<img src="' + amigo.avatar + '" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">';
                } else {
                    avatarHtml = (amigo.avatar || '👤');
                }
                
                div.innerHTML = '<div class="friend-avatar">' + avatarHtml + '</div>' +
                    '<div class="friend-name">' + escapeHtml(amigo.name) + '</div>' +
                    '<div class="friend-id">' + amigo.id.substring(0, 8) + '...</div>';
                div.onclick = () => abrirChatPrivado(amigo);
                container.appendChild(div);
            });
        }
    } catch(e) {
        console.error(e);
        container.innerHTML = '<div class="empty-state">Error al cargar amigos</div>';
    }
}

async function cargarChatsRecientes() {
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
        
        let avatarHtml = '';
        if (amigo.avatar_type === 'image' && amigo.avatar) {
            avatarHtml = '<img src="' + amigo.avatar + '" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">';
        } else {
            avatarHtml = (amigo.avatar || '👤');
        }
        
        div.innerHTML = '<div class="chat-avatar">' + avatarHtml + '</div>' +
            '<div class="chat-name">' + escapeHtml(amigo.name) + '</div>';
        div.onclick = () => abrirChatPrivado(amigo);
        container.appendChild(div);
    });
}

async function abrirChatPrivado(usuario) {
    currentChatWith = usuario;
    const chatWithInfo = document.getElementById('chatWithInfo');
    if (chatWithInfo) {
        chatWithInfo.innerHTML = '<i class="fas fa-user"></i><span>' + escapeHtml(usuario.name) + '</span>';
    }
    await cargarMensajesPrivados(usuario.id);
}

async function cargarMensajesPrivados(friendId) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/private_messages?or=(and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id}))&order=created_at.asc`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const data = await response.json();
        
        messages = (data || []).map(msg => ({
            id: msg.id,
            text: msg.text || '',
            image: msg.image,
            senderId: msg.sender_id,
            senderName: msg.sender_id === currentUser.id ? currentUser.name : currentChatWith.name,
            time: new Date(msg.created_at).toLocaleTimeString(),
            isMine: msg.sender_id === currentUser.id
        }));
        
        renderMessages();
    } catch(e) {
        messages = [];
        renderMessages();
    }
}

async function sendPrivateMessage(text, imageUrl) {
    imageUrl = imageUrl || null;
    if ((!text || !text.trim()) && !imageUrl) return;
    if (!currentChatWith) {
        alert('Selecciona un chat primero');
        return;
    }
    
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/private_messages`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sender_id: currentUser.id,
                receiver_id: currentChatWith.id,
                text: text ? text.trim() : '',
                image: imageUrl,
                created_at: new Date().toISOString()
            })
        });
        
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = '';
            const charCount = document.getElementById('charCount');
            if (charCount) charCount.textContent = '0';
        }
        
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.classList.add('send-animation');
            setTimeout(() => sendBtn.classList.remove('send-animation'), 200);
        }
        
        await cargarMensajesPrivados(currentChatWith.id);
    } catch(e) {
        alert('Error al enviar mensaje');
    }
}

function renderMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="welcome-message"><i class="fas fa-comments"></i><h3>Chat privado</h3><p>Envía un mensaje para comenzar</p></div>';
        return;
    }
    
    container.innerHTML = '';
    
    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        if (msg.isMine) messageDiv.style.justifyContent = 'flex-end';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.style.maxWidth = '70%';
        contentDiv.style.background = msg.isMine ? '#5865f2' : 'rgba(255,255,255,0.08)';
        contentDiv.style.padding = '8px 12px';
        contentDiv.style.borderRadius = '12px';
        
        if (!msg.isMine) {
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
            img.onclick = () => window.open(msg.image, '_blank');
            contentDiv.appendChild(img);
        }
        
        if (!msg.isMine && msg.text) {
            const actions = document.createElement('div');
            actions.className = 'message-actions';
            actions.style.marginTop = '8px';
            actions.innerHTML = '<button class="action-btn copy-msg"><i class="fas fa-copy"></i> Copiar</button><button class="action-btn reply-msg"><i class="fas fa-reply"></i> Responder</button>';
            contentDiv.appendChild(actions);
        }
        
        messageDiv.appendChild(contentDiv);
        container.appendChild(messageDiv);
    });
    
    document.querySelectorAll('.copy-msg').forEach(btn => {
        btn.onclick = () => {
            const msgText = btn.closest('.message-content')?.querySelector('.message-text')?.textContent;
            if (msgText) {
                navigator.clipboard.writeText(msgText);
                const modal = document.getElementById('copyModal');
                if (modal) {
                    modal.style.display = 'flex';
                    setTimeout(() => modal.style.display = 'none', 1500);
                }
            }
        };
    });
    
    document.querySelectorAll('.reply-msg').forEach(btn => {
        btn.onclick = () => {
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

let tempPhotoData = null;

async function editarPerfil(nuevoNombre, fotoData) {
    if (!nuevoNombre && !fotoData) return;
    
    if (nuevoNombre) currentUser.name = nuevoNombre;
    if (fotoData) {
        currentUser.avatar = fotoData;
        currentUser.avatar_type = 'image';
    }
    
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${currentUser.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: currentUser.name,
                avatar: currentUser.avatar,
                avatar_type: currentUser.avatar_type
            })
        });
        
        localStorage.setItem('userData', JSON.stringify(currentUser));
        actualizarUIUsuario();
        await cargarAmigos();
        await cargarChatsRecientes();
        alert('Perfil actualizado');
    } catch(e) {
        alert('Error al actualizar perfil');
    }
}

// ========== INICIALIZAR ==========
document.addEventListener('DOMContentLoaded', async () => {
    await iniciarUsuario();
    
    // Elementos
    const searchModal = document.getElementById('searchModal');
    const addFriendModal = document.getElementById('addFriendModal');
    const editProfileModal = document.getElementById('editProfileModal');
    
    // Botones abrir modales
    document.getElementById('searchUserBtn').onclick = () => { if(searchModal) searchModal.style.display = 'flex'; };
    document.getElementById('addFriendBtn').onclick = () => { if(addFriendModal) addFriendModal.style.display = 'flex'; };
    document.getElementById('editProfileBtn').onclick = () => { if(editProfileModal) editProfileModal.style.display = 'flex'; };
    
    // Buscar usuario
    document.getElementById('searchSubmitBtn').onclick = async () => {
        const userId = document.getElementById('searchUserId').value.trim();
        const resultDiv = document.getElementById('searchResult');
        if (!userId) {
            resultDiv.innerHTML = '<p style="color: #ffaa00;">Ingresa un ID</p>';
            return;
        }
        const usuario = await buscarUsuarioPorId(userId);
        if (usuario) {
            let avatarHtml = '';
            if (usuario.avatar_type === 'image' && usuario.avatar) {
                avatarHtml = '<img src="' + usuario.avatar + '" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">';
            } else {
                avatarHtml = '<div style="font-size: 32px;">' + (usuario.avatar || '👤') + '</div>';
            }
            resultDiv.innerHTML = '<div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">' +
                avatarHtml +
                '<div><strong>' + escapeHtml(usuario.name) + '</strong><br><small>' + usuario.id + '</small></div>' +
                '<button onclick="agregarAmigo(\'' + usuario.id + '\')" style="margin-left: auto; padding: 8px 16px; background: #5865f2; border: none; border-radius: 8px; color: white; cursor: pointer;">Agregar</button>' +
                '</div>';
        } else {
            resultDiv.innerHTML = '<p style="color: #ff4444;">Usuario no encontrado</p>';
        }
    };
    
    // Agregar amigo submit
    document.getElementById('addFriendSubmitBtn').onclick = async () => {
        const friendId = document.getElementById('friendUserId').value.trim();
        if (friendId) {
            await agregarAmigo(friendId);
            addFriendModal.style.display = 'none';
            document.getElementById('friendUserId').value = '';
        } else {
            alert('Ingresa un ID');
        }
    };
    
    // Subir foto perfil
    const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
    const photoInput = document.getElementById('photoInput');
    const photoPreview = document.getElementById('photoPreview');
    if (uploadPhotoBtn && photoInput) {
        uploadPhotoBtn.onclick = () => photoInput.click();
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader()
