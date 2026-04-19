// ========== SUPABASE CONFIG (CON TUS CLAVES) ==========
const SUPABASE_URL = 'https://dmdnawzdctdxhwoyzrhn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_N8yJpTuYS2LTYOouNmrZ4Q_tanfj_U9';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== VARIABLES GLOBALES ==========
let currentUser = null;
let currentChatWith = null;
let messages = [];
let friendsList = [];

// ========== GENERAR ID ÚNICO ==========
function generarUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
}

// ========== INICIAR / REGISTRAR USUARIO ==========
async function iniciarUsuario() {
    let userId = localStorage.getItem('userId');
    let userData = localStorage.getItem('userData');
    
    if (!userId || !userData) {
        // Nuevo usuario: crear ID único
        userId = generarUserId();
        const nuevoUsuario = {
            id: userId,
            name: 'Usuario_' + Math.floor(Math.random() * 10000),
            avatar: '👤',
            created_at: new Date().toISOString()
        };
        
        // Guardar en Supabase
        const { error } = await supabaseClient
            .from('users')
            .insert([nuevoUsuario]);
        
        if (error) {
            console.error('Error creando usuario:', error);
            // Si hay error de RLS, intentamos igual
        }
        
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
    document.getElementById('displayName').textContent = currentUser.name;
    document.getElementById('displayUserId').textContent = `ID: ${currentUser.id.substring(0, 12)}...`;
    document.getElementById('userAvatar').textContent = currentUser.avatar;
}

// ========== BUSCAR USUARIO POR ID ==========
async function buscarUsuarioPorId(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
        
        if (error || !data) return null;
        return data;
    } catch (e) {
        console.error(e);
        return null;
    }
}

// ========== AGREGAR AMIGO ==========
async function agregarAmigo(friendId) {
    if (friendId === currentUser.id) {
        alert('No puedes agregarte a ti mismo');
        return false;
    }
    
    const amigo = await buscarUsuarioPorId(friendId);
    if (!amigo) {
        alert('Usuario no encontrado');
        return false;
    }
    
    // Verificar si ya es amigo
    const { data: existing } = await supabaseClient
        .from('friends')
        .select('*')
        .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`)
        .or(`user_id.eq.${friendId},friend_id.eq.${friendId}`);
    
    if (existing && existing.length > 0) {
        alert('Ya son amigos');
        return false;
    }
    
    const { error } = await supabaseClient
        .from('friends')
        .insert([{
            user_id: currentUser.id,
            friend_id: friendId,
            created_at: new Date().toISOString()
        }]);
    
    if (error) {
        console.error(error);
        alert('Error al agregar amigo');
        return false;
    }
    
    alert(`¡${amigo.name} es tu amigo ahora!`);
    cargarAmigos();
    return true;
}

// ========== CARGAR AMIGOS ==========
async function cargarAmigos() {
    try {
        const { data, error } = await supabaseClient
            .from('friends')
            .select('*')
            .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`);
        
        if (error || !data || data.length === 0) {
            document.getElementById('friendsList').innerHTML = '<div class="empty-state">No hay amigos.<br>Usa el botón + para agregar</div>';
            return;
        }
        
        const amigosIds = data.map(f => 
            f.user_id === currentUser.id ? f.friend_id : f.user_id
        );
        
        const { data: amigos } = await supabaseClient
            .from('users')
            .select('*')
            .in('id', amigosIds);
        
        if (amigos) {
            friendsList = amigos;
            renderFriendsList();
        }
    } catch (e) {
        console.error(e);
    }
}

function renderFriendsList() {
    const container = document.getElementById('friendsList');
    if (!container) return;
    container.innerHTML = '';
    
    friendsList.forEach(amigo => {
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

// ========== ABRIR CHAT PRIVADO ==========
function abrirChatPrivado(usuario) {
    currentChatWith = usuario;
    document.getElementById('chatWithInfo').innerHTML = `
        <i class="fas fa-user"></i>
        <span>${usuario.name} (${usuario.id.substring(0, 8)}...)</span>
    `;
    cargarMensajesPrivados(usuario.id);
    suscribirseAMensajes(usuario.id);
}

// ========== CARGAR MENSAJES PRIVADOS ==========
async function cargarMensajesPrivados(friendId) {
    try {
        const { data, error } = await supabaseClient
            .from('private_messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true })
            .limit(100);
        
        if (error) {
            console.error(error);
            return;
        }
        
        messages = (data || []).map(msg => ({
            id: msg.id,
            author: msg.sender_id === currentUser.id ? currentUser.name : currentChatWith.name,
            authorId: msg.sender_id,
            text: msg.text || '',
            image: msg.image,
            time: new Date(msg.created_at).toLocaleTimeString(),
            isMine: msg.sender_id === currentUser.id
        }));
        
        renderMessages();
        scrollToBottom();
    } catch (e) {
        console.error(e);
    }
}

// ========== ENVIAR MENSAJE PRIVADO ==========
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
    
    const { error } = await supabaseClient
        .from('private_messages')
        .insert([mensaje]);
    
    if (error) {
        console.error(error);
        alert('Error al enviar mensaje');
        return;
    }
    
    // Limpiar input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.value = '';
        document.getElementById('charCount').textContent = '0';
    }
    
    // Animación
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.classList.add('send-animation');
        setTimeout(() => sendBtn.classList.remove('send-animation'), 200);
    }
    
    // Recargar mensajes
    await cargarMensajesPrivados(currentChatWith.id);
}

// ========== SUSCRIPCIÓN EN TIEMPO REAL ==========
let currentSubscription = null;

function suscribirseAMensajes(friendId) {
    if (currentSubscription) {
        supabaseClient.removeChannel(currentSubscription);
    }
    
    currentSubscription = supabaseClient
        .channel(`private_${currentUser.id}_${friendId}`)
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'private_messages'
            },
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
    container.innerHTML = '';
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-comments"></i>
                <h3>Chat privado</h3>
                <p>Envía un mensaje para comenzar la conversación</p>
            </div>
        `;
        return;
    }
    
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
            header.innerHTML = `<span class="message-author">${msg.author}</span><span class="message-time">${msg.time}</span>`;
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
    
    // Eventos de copiar
    document.querySelectorAll('.copy-msg').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const msgText = btn.closest('.message-content')?.querySelector('.message-text')?.textContent;
            if (msgText) {
                navigator.clipboard.writeText(msgText);
                const modal = document.getElementById('copyModal');
                if (modal) {
                    modal.style.display = 'flex';
                    setTimeout(() => modal.style.display = 'none', 1500);
                }
            }
        });
    });
    
    document.querySelectorAll('.reply-msg').forEach(btn => {
        btn.addEventListener('click', () => {
            const msgText = btn.closest('.message-content')?.querySelector('.message-text')?.textContent;
            const input = document.getElementById('messageInput');
            if (msgText && input) {
                input.value = `Respondiendo a: "${msgText.substring(0, 50)}"\n`;
                input.focus();
            }
        });
    });
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) container.scrollTop = container.scrollHeight;
}

// ========== CARGAR CHATS RECIENTES ==========
async function cargarChatsRecientes() {
    try {
        const { data, error } = await supabaseClient
            .from('private_messages')
            .select('*')
            .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: false });
        
        if (error || !data || data.length === 0) {
            return;
        }
        
        const usersIds = new Set();
        data.forEach(msg => {
            if (msg.sender_id !== currentUser.id) usersIds.add(msg.sender_id);
            if (msg.receiver_id !== currentUser.id) usersIds.add(msg.receiver_id);
        });
        
        if (usersIds.size === 0) return;
        
        const { data: users } = await supabaseClient
            .from('users')
            .select('*')
            .in('id', Array.from(usersIds));
        
        if (users) {
            renderChatsList(users);
        }
    } catch (e) {
        console.error(e);
    }
}

function renderChatsList(users) {
    const container = document.getElementById('chatsList');
    if (!container) return;
    container.innerHTML = '';
    
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        if (currentChatWith && currentChatWith.id === user.id) div.classList.add('active');
        div.innerHTML = `
            <div class="chat-avatar">${user.avatar || '👤'}</div>
            <div class="chat-name">${user.name}</div>
        `;
        div.onclick = () => abrirChatPrivado(user);
        container.appendChild(div);
    });
}

// ========== EDITAR PERFIL ==========
async function editarPerfil(nuevoNombre, nuevoAvatar) {
    try {
        const { error } = await supabaseClient
            .from('users')
            .update({ name: nuevoNombre, avatar: nuevoAvatar })
            .eq('id', currentUser.id);
        
        if (error) {
            alert('Error al actualizar perfil');
            return;
        }
        
        currentUser.name = nuevoNombre;
        currentUser.avatar = nuevoAvatar;
        localStorage.setItem('userData', JSON.stringify(currentUser));
        actualizarUIUsuario();
        alert('Perfil actualizado');
        cargarAmigos();
    } catch (e) {
        console.error(e);
    }
}

// ========== EVENTOS Y MODALES ==========
document.addEventListener('DOMContentLoaded', async () => {
    await iniciarUsuario();
    
    // Modales
    const searchModal = document.getElementById('searchModal');
    const addFriendModal = document.getElementById('addFriendModal');
    const editProfileModal = document.getElementById('editProfileModal');
    
    const searchUserBtn = document.getElementById('searchUserBtn');
    const addFriendBtn = document.getElementById('addFriendBtn');
    const editProfileBtn = document.getElementById('editProfileBtn');
    
    if (searchUserBtn) searchUserBtn.onclick = () => searchModal.style.display = 'flex';
    if (addFriendBtn) addFriendBtn.onclick = () => addFriendModal.style.display = 'flex';
    if (editProfileBtn) editProfileBtn.onclick = () => {
        document.getElementById('editName').value = currentUser.name;
        document.getElementById('editAvatar').value = currentUser.avatar;
        editProfileModal.style.display = 'flex';
    };
    
    // Buscar usuario
    const searchSubmitBtn = document.getElementById('searchSubmitBtn');
    if (searchSubmitBtn) {
        searchSubmitBtn.onclick = async () => {
            const userId = document.getElementById('searchUserId').value.trim();
            const resultDiv = document.getElementById('searchResult');
            const usuario = await buscarUsuarioPorId(userId);
            
            if (usuario) {
                resultDiv.innerHTML = `
                    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                        <div style="font-size: 32px;">${usuario.avatar || '👤'}</div>
                        <div>
                            <strong>${usuario.name}</strong><br>
                            <small style="font-size: 10px;">ID: ${usuario.id}</small>
                        </div>
                        <button onclick="agregarAmigo('${usuario.id}')" style="margin-left: auto; padding: 8px 16px; background: #5865f2; border: none; border-radius: 8px; color: white; cursor: pointer;">Agregar</button>
                    </div>
                `;
            } else {
                resultDiv.innerHTML = '<p style="color: #ff4444;">❌ Usuario no encontrado</p>';
            }
        };
    }
    
    const addFriendSubmitBtn = document.getElementById('addFriendSubmitBtn');
    if (addFriendSubmitBtn) {
        addFriendSubmitBtn.onclick = async () => {
            const friendId = document.getElementById('friendUserId').value.trim();
            await agregarAmigo(friendId);
            addFriendModal.style.display = 'none';
            document.getElementById('friendUserId').value = '';
        };
    }
    
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.onclick = async () => {
            const newName = document.getElementById('editName').value.trim();
            const newAvatar = document.getElementById('editAvatar').value.trim();
            if (newName) await editarPerfil(newName, newAvatar || '👤');
            editProfileModal.style.display = 'none';
        };
    }
    
    // Cerrar modales
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            if (searchModal) searchModal.style.display = 'none';
            if (addFriendModal) addFriendModal.style.display = 'none';
            if (editProfileModal) editProfileModal.style.display = 'none';
            const copyModal = document.getElementById('copyModal');
            if (copyModal) copyModal.style.display = 'none';
        };
    });
    
    // Enviar mensaje
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    const imageUploadBtn = document.getElementById('imageUploadBtn');
    const imageInput = document.getElementById('imageInput');
    
    if (sendBtn) {
        sendBtn.onclick = () => {
            const text = messageInput ? messageInput.value.trim() : '';
            if (text) sendPrivateMessage(text);
        };
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (sendBtn) sendBtn.click();
            }
        });
        
        messageInput.addEventListener('input', () => {
            const charCount = document.getElementById('charCount');
            if (charCount) charCount.textContent = messageInput.value.length;
        });
    }
    
    if (imageUploadBtn && imageInput) {
        imageUploadBtn.onclick = () => imageInput.click();
        imageInput.addEventListe
