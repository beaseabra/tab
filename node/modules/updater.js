// node/modules/updater.js
const storage = require('./storage.js');

// Guarda as conexões abertas: { "gameID": [response1, response2, ...] }
const responses = {};

function remember(gameId, response) {
    if (!responses[gameId]) responses[gameId] = [];
    responses[gameId].push(response);
}

function forget(gameId, response) {
    if (!responses[gameId]) return;
    responses[gameId] = responses[gameId].filter(r => r !== response);
}

// Endpoint GET /update?game=...&nick=...
function handleUpdate(req, res, query) {
    const gameId = query.game;

    if (!gameId) {
        res.writeHead(400);
        res.end();
        return;
    }

    // Configuração OBRIGATÓRIA para Server-Sent Events (SSE)
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    // Mantém a conexão viva
    remember(gameId, res);

    // Se o cliente fechar a janela, removemos da lista
    req.on('close', () => forget(gameId, res));
    
    // Envia o estado atual imediatamente ao conectar (se o jogo existir)
    const games = storage.getGames();
    if (games[gameId]) {
        sendUpdateToResponse(res, games[gameId]);
    }
}

// Função para notificar TODOS os jogadores de um jogo
function notifyAll(gameId) {
    const games = storage.getGames();
    const game = games[gameId];
    if (!game || !responses[gameId]) return;

    // Envia o JSON atualizado para cada conexão aberta
    responses[gameId].forEach(res => sendUpdateToResponse(res, game));
}

function sendUpdateToResponse(res, gameObj) {
    // Formato SSE: "data: {json}\n\n"
    res.write(`data: ${JSON.stringify(gameObj)}\n\n`);
}

module.exports = {
    handleUpdate,
    notifyAll
};