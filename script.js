// ========== SUPABASE CONFIG (CORREGIDO) ==========
const SUPABASE_URL = 'https://dmdnawzdctdxhwoyzrhn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtZG5hd3pkY3RkeGh3b3l6cmhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODY5OTEsImV4cCI6MjA5MjA2Mjk5MX0.pr8GFA9oWF3n-zs-h7MHrF6a_ZZEQamVhPTfgmqzO1I';

// Inicialización CORRECTA
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== VARIABLES GLOBALES ==========
let currentUser = null;
let currentChatWith = null;
let messages = [];
let friendsList = [];

// ========== GENERAR ID ÚNICO ==========
function generarUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
}

// ========== INICIAR USUARIO ==========
async function iniciarUsuario() {
    let userId = localStorage.getItem('userId');
    let userData = localStorage.getItem('userData');
    
    if (!userId || !userData) {
        userId = generarUserId();
        const nuevoUsuario = {
            id: userId,
            name: 'Usuario_' + Math.floor(Math.random() * 10000),
            avatar: '👤',
            created_at: new Date().toISOString()
        };
        
        try {
            const { error } = await supabase
                .from('users')
                .insert([nuevoUsuario]);
            if (error) console.error('Error:', error);
        } catch(e) { console.error(e); }
        
        localStorage.setItem('userId', userId);
        localStorage.setItem('userData', JSON.stringify(nuevoUsuario));
        currentUser = nuevoUsuario;
    } else {
        currentUser = JSON.parse(userData);
        currentUser.id = userId;
    }
    
    actualizarUIUsuario();
    cargarAmigos();
    cargarChatsRecientes();
}

function actualizarUIUsuario() {
    const displayName = document.getElementById('displayName');
    const displayUserId = document.getElementById('displayUserId');
    const userAvatar = document.getElementById('userAvatar');
    
    if (displayName) displayName.textContent = currentUser.name;
    if (displayUserId) displayUserId.textContent = `ID: ${currentUser.id.substring(0, 12)}...`;
    if (userAvatar) userAvatar.textContent = currentUser.avatar;
}

// ========== BUSCAR USUARIO ==========
async function buscarUsuarioPorId(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
        if (error || !data) return null;
        return data;
    } catch (e) {
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
    
    const { data: existing } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`)
        .or(`user_id.eq.${friendId},friend_id.eq.${friendId}`);
    
    if (existing && existing.length > 0) {
        alert('Ya son amigos');
        return false;
    }
    
    const { error } = await supabase
        .from('friends')
        .insert([{
            user_id: currentUser.id,
            friend_id: friendId,
            created_at: new Date().toISOString()
        }]);
    
    if (error) {
        alert('Error al agregar amigo');
        return false;
    }
    
    alert(`¡${amigo.name} es tu amigo ahora!`);
    cargarAmigos();
    return true;
};

// ========== CARGAR AMIGOS ==========
async function cargarAmigos() {
    const container = document.getElementById('friendsList');
    if (!container) return;
    
    try {
        const { data, error } = await supabase
            .from('friends')
            .select('*')
            .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`);
        
        if (error || !data || data.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay amigos.<br>Usa el botón + para agregar</div>';
            return;
        }
        
        const amigosIds = data.map(f => 
            f.user_id === currentUser.id ? f.friend_id : f.user_id
        );
        
        const { data: amigos } = await supabase
            .from('users')
            .select('*')
            .in('id', amigosIds);
        
        if (amigos) {
            friendsList = amigos;
            container.innerHTML = '';
            amigos.forEach(amigo => {
                const div = document.createElement('div');
                div.className = 'friend-item';
                div.innerHTML = `
                    <div class="friend-avatar">${amigo.avatar || '👤'}</div>
                    <div class="friend-name">${amigo.name}</div>
                    <div class="friend-id">${amigo.id.substring(0, 8)}...</div>
                `;
                div.onclick = () => abrirChatPrivado(amigo);
                container.appendChild(div);
            });
        }
    } catch(e) { console.error(e); }
}

// ========== ABRIR CHAT PRIVADO ==========
async function abrirChatPrivado(usuario) {
    currentChatWith = usuario;
    const chatWithInfo = document.getElementById('chatWithInfo');
    if (chatWithInfo) {
        chatWithInfo.innerHTML = `
            <i class="fas fa-user"></i>
            <span>${usuario.name}</span>
        `;
    }
    await cargarMensajesPrivados(usuario.id);
    suscribirseAMensajes(usuario.id);
}

// ========== CARGAR MENSAJES ==========
async function cargarMensajesPrivados(friendId) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    try {
        const { data, error } = await supabase
            .from('private_messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true })
            .limit(100);
        
        if (error) throw error;
        
        messages = (data || []).map(msg => ({
            id: msg.id,
            author: msg.sender_id === currentUser.id ? currentUser.name : (currentChatWith ? currentChatWith.name : 'Usuario'),
            authorId: msg.sender_id,
            text: msg.text || '',
            image: msg.image,
            time: new Date(msg.created_at).toLocaleTimeString(),
            isMine: msg.sender_id === currentUser.id
        }));
        
        renderMessages();
    } catch(e) { console.error(e); }
}

// ========== ENVIAR MENSAJE ==========
async function sendPrivateMessage(text, imageUrl = null) {
    if ((!text || !text.trim()) && !imageUrl) return;
    if (!currentChatWith) {
        alert('Selecciona un chat primero');
        return;
    }
    
    const mensaje = {
        sender_id: currentUser.id,
        receiver_id: currentChatWith.id,
        text: text ? text.trim() : '',
        image: imageUrl,
        created_at: new Date().toISOString()
    };
    
    const { error } = await supabase
        .from('private_messages')
        .insert([mensaje]);
    
    if (error) {
        alert('Error al enviar mensaje');
        return;
    }
    
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
}

// ========== SUSCRIPCIÓN TIEMPO REAL ==========
let currentSubscription = null;

function suscribirseAMensajes(friendId) {
    if (currentSubscription) {
        supabase.removeChannel(currentSubscription);
    }
    
    currentSubscription = supabase
        .channel(`private_${currentUser.id}_${friendId}`)
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'private_messages' },
            (payload) => {
                const msg = payload.new;
                if ((msg.sender_id === friendId && msg.receiver_id === currentUser.id) ||
                    (msg.sender_id === currentUser.id && msg.receiver_id === friendId)) {
                    cargarMensajesPrivados(friendId);
                }
            }
        )
        .subscribe();
}

// ========== RENDERIZAR MENSAJES ==========
function renderMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-comments"></i>
                <h3>Chat privado</h3>
                <p>Selecciona un amigo para empezar a chatear</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        if (msg.isMine) {
            messageDiv.style.justifyContent = 'flex-end';
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.style.maxWidth = '70%';
        contentDiv.style.background = msg.isMine ? '#5865f2' : 'rgba(255,255,255,0.08)';
        contentDiv.style.padding = '8px 12px';
        contentDiv.style.borderRadius = '12px';
        
        if (!msg.isMine) {
            const header = document.createElement('div');
            header.className = 'message-header';
            header.innerHTML = `<span class="message-author">${escapeHtml(msg.author)}</span><span class="message-time">${msg.time}</span>`;
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
            actions.innerHTML = `
                <button class="action-btn copy-msg"><i class="fas fa-copy"></i> Copiar</button>
                <button class="action-btn reply-msg"><i class="fas fa-reply"></i> Responder</button>
            `;
            contentDiv.appendChild(actions);
        }
        
        messageDiv.appendChild(contentDiv);
        container.appendChild(messageDiv);
    });
    
    // Eventos copiar
    document.querySelectorAll('.copy-msg').forEach(btn => {
        btn.onclick = (e) => {
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
    
    // Eventos responder
    document.querySelectorAll('.reply-msg').forEach(btn => {
        btn.onclick = () => {
            const msgText = btn.closest('.message-content')?.querySelector('.message-text')?.textContent;
            const input = document.getElementById('messageInput');
            if (msgText && input) {
                input.value = `"${msgText.substring(0, 50)}"\n`;
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

// ========== CARGAR CHATS RECIENTES ==========
async function cargarChatsRecientes() {
    const container = document.getElementById('chatsList');
    if (!container) return;
    
    try {
        const { data, error } = await supabase
            .from('private_messages')
            .select('*')
            .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: false });
        
        if (error || !data || data.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay chats recientes</div>';
            return;
        }
        
        const usersIds = new Set();
        data.forEach(msg => {
            if (msg.sender_id !== currentUser.id) usersIds.add(msg.sender_id);
            if (msg.receiver_id !== currentUser.id) usersIds.add(msg.receiver_id);
        });
        
        if (usersIds.size === 0) {
            container.innerHTML = '<div class="empty-state">No hay chats recientes</div>';
            return;
        }
        
        const { data: users } = await supabase
            .from('users')
            .select('*')
            .in('id', Array.from(usersIds));
        
        if (users && users.length > 0) {
            container.innerHTML = '';
            users.forEach(user => {
                const div = document.createElement('div');
                div.className = 'chat-item';
                div.innerHTML = `
                    <div class="chat-avatar">${user.avatar || '👤'}</div>
                    <div class="chat-name">${user.name}</div>
                `;
                div.onclick = () => abrirChatPrivado(user);
                container.appendChild(div);
            });
        }
    } catch(e) { console.error(e); }
}

// ========== EDITAR PERFIL ==========
async function editarPerfil(nuevoNombre, nuevoAvatar) {
    try {
        const { error } = await supabase
            .from('users')
            .update({ name: nuevoNombre, avatar: nuevoAvatar })
            .eq('id', currentUser.id);
        
        if (error) throw error;
        
        currentUser.name = nuevoNombre;
        currentUser.avatar = nuevoAvatar;
        localStorage.setItem('userData', JSON.stringify(currentUser));
        actualizarUIUsuario();
        alert('Perfil actualizado');
        cargarAmigos();
        cargarChatsRecientes();
    } catch(e) { alert('Error al actualizar'); }
}

// ========== INICIALIZAR ==========
document.addEventListener('DOMContentLoaded', async () => {
    await iniciarUsuario();
    
    // ========== BOTONES ==========
    // Botón buscar usuario
    const searchUserBtn = document.getElementById('searchUserBtn');
    const searchModal = document.getElementById('searchModal');
    if (searchUserBtn && searchModal) {
        searchUserBtn.onclick = () => searchModal.style.display = 'flex';
    }
    
    // Botón agregar amigo
    const addFriendBtn = document.getElementById('addFriendBtn');
    const addFriendModal = document.getElementById('addFriendModal');
    if (addFriendBtn && addFriendModal) {
        addFriendBtn.onclick = () => addFriendModal.style.display = 'flex';
    }
    
    // Botón editar perfil
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    if (editProfileBtn && editProfileModal) {
        editProfileBtn.onclick = () => {
            const editName = document.getElementById('editName');
            const editAvatar = document.getElementById('editAvatar');
            if (editName) editName.value = currentUser.name;
            if (editAvatar) editAvatar.value = currentUser.avatar;
            editProfileModal.style.display = 'flex';
        };
    }
    
    // Buscar submit
    const searchSubmitBtn = document.getElementById('searchSubmitBtn');
    if (searchSubmitBtn) {
        searchSubmitBtn.onclick = async () => {
            const userIdInput = document.getElementById('searchUserId');
            const userId = userIdInput ? userIdInput.value.trim() : '';
            const resultDiv = document.getElementById('searchResult');
            
            if (!userId) {
                if (resultDiv) resultDiv.innerHTML = '<p style="color: #ffaa00;">Ingresa un ID</p>';
                return;
            }
            
            const usuario = await buscarUsuarioPorId(userId);
            if (resultDiv) {
                if (usuario) {
                    resultDiv.innerHTML = `
                        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                            <div style="font-size: 32px;">${usuario.avatar || '👤'}</div>
                            <div>
                                <strong>${usuario.name}</strong><br>
                                <small>ID: ${usuario.id.substring(0, 20)}...</small>
                            </div>
                            <button onclick="agregarAmigo('${usuario.id}')" style="margin-left: auto; padding: 8px 16px; background: #5865f2; border: none; border-radius: 8px; color: white; cursor: pointer;">Agregar</button>
                        </div>
                    `;
                } else {
                    resultDiv.innerHTML = '<p style="color: #ff4444;">❌ Usuario no encontrado</p>';
                }
            }
        };
    }
    
    // Agregar amigo submit
    const addFriendSubmitBtn = document.getElementById('addFriendSubmitBtn');
    if (addFriendSubmitBtn) {
        addFriendSubmitBtn.onclick = async () => {
            const friendIdInput = document.getElementById('friendUserId');
            const friendId = friendIdInput ? friendIdInput.value.trim() : '';
            if (friendId) {
                await agregarAmigo(friendId);
                if (addFriendModal) addFriendModal.style.display = 'none';
                if (friendIdInput) friendIdInput.value = '';
            } else {
                alert('Ingresa un ID de usuario');
            }
        };
    }
    
    // Guardar perfil
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.onclick = async () => {
            const editName = document.getElementById('editName');
            const editAvatar = document.getElementById('editAvatar');
            const newName = editName ? editName.value.trim() : '';
            const newAvatar = editAvatar ? editAvatar.value.trim() : '👤';
            if (newName) {
                await editarPerfil(newName, newAvatar);
                if (editProfileModal) editProfileModal.style.display = 'none';
            }
        };
    }
    
    // Limpiar chat
    const clearChatBtn = document.getElementById('clearChatBtn');
    if (clearChatBtn) {
        clearChatBtn.onclick = () => {
            if (confirm('¿Limpiar mensajes?')) {
                messages = [];
                renderMessages();
            }
        };
    }
    
  
