// node/modules/updater.js
const responses = {};

module.exports.remember = function(response, gameId, nick) {
    if (!gameId || !nick) return;

    // 1. Cabeçalhos OBRIGATÓRIOS para SSE funcionar
    response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*', // Importante para CORS
    });

    // 2. Inicializar lista se não existir
    if (!responses[gameId]) {
        responses[gameId] = [];
    }

    // 3. Guardar a conexão
    // Adicionamos o 'nick' para saber de quem é a ligação (útil para debug)
    const connection = { response, nick, timestamp: Date.now() };
    responses[gameId].push(connection);

    // 4. EVITAR TIMEOUT (A parte mais importante!)
    // O servidor da faculdade corta ligações após 1 min. Isto impede isso.
    response.setTimeout(0); 

    // 5. Limpar quando o cliente fecha o browser
    response.on('close', () => {
        if (responses[gameId]) {
            responses[gameId] = responses[gameId].filter(c => c.response !== response);
            if (responses[gameId].length === 0) {
                delete responses[gameId];
            }
        }
    });
};

module.exports.notifyAll = function(gameId) {
    if (!responses[gameId]) return;

    // Ler o estado atual do jogo para enviar
    const storage = require('./storage.js');
    const games = storage.getGames();
    const game = games[gameId];

    if (!game) return;

    const data = JSON.stringify(game);
    const message = `data: ${data}\n\n`; // Formato obrigatório SSE

    responses[gameId].forEach(client => {
        try {
            client.response.write(message);
        } catch (e) {
            console.log("Erro a enviar para cliente, removendo...", e.message);
        }
    });
};

// --- HEARTBEAT / KEEP-ALIVE ---
// Envia um comentário vazio a cada 20 segundos para manter a ligação aberta
setInterval(() => {
    for (const gameId in responses) {
        responses[gameId].forEach(client => {
            try {
                // Comentários em SSE começam com ':' e são ignorados pelo browser,
                // mas servem para dizer à rede "estou vivo!"
                client.response.write(': keep-alive\n\n');
            } catch (e) {
                // Ignorar erros de escrita em conexões mortas
            }
        });
    }
}, 20000); // 20 segundos