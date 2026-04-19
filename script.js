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
        
        const data = await response.json();
        
        if (data.results && data.results[0].flagged) {
            return { allowed: false, reason: 'Mensaje bloqueado por IA' };
        }
        return { allowed: true, reason: null };
    } catch (error) {
        return { allowed: true, reason: null };
    }
}
