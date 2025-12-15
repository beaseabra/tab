// index.js - VERSÃO FINAL CORRIGIDA
const http = require('http');
const url = require('url');
// const fs = require('fs'); // Não precisas disto se usares os módulos

const auth = require('./modules/auth.js');
const storage = require('./modules/storage.js');
const ranking = require('./modules/ranking.js');
const game = require('./modules/game.js'); 
const updater = require('./modules/updater.js');

const PORT = 8132; // Confirma se é a tua porta
const HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

// Inicializa o armazenamento
storage.init();

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 1. Tratar CORS (Preflight)
    if (req.method === 'OPTIONS') {
        res.writeHead(204, HEADERS);
        res.end();
        return;
    }

    // 2. Auxiliares de Resposta
    const sendJSON = (status, data) => {
        res.writeHead(status, HEADERS);
        res.end(JSON.stringify(data));
    };

    const sendError = (status, message) => {
        sendJSON(status, { error: message });
    };

    // 3. Recolher Body
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
        try {
            const data = body ? JSON.parse(body) : {};

            // === ROUTER ===
            switch (pathname) {
                // --- Auth & Ranking ---
                case '/register':
                    auth.register(data, sendJSON, sendError);
                    break;
                case '/ranking':
                    ranking.getRanking(data, sendJSON, sendError);
                    break;

                // --- Game Logic ---
                case '/join':
                    game.join(data, sendJSON, sendError);
                    break;
                case '/leave':
                    game.leave(data, sendJSON, sendError);
                    break;
                case '/roll':
                    game.roll(data, sendJSON, sendError);
                    break;
                case '/notify':
                    game.notify(data, sendJSON, sendError);
                    break;
                case '/pass':
                    game.pass(data, sendJSON, sendError);
                    break;
                
                // --- CORREÇÃO IMPORTANTE: Update Stream (SSE) ---
                case '/update':
                    if (req.method === 'GET') {
                        // O nome correto da função é 'remember' e os argumentos são estes:
                        const gameId = parsedUrl.query.game;
                        const nick = parsedUrl.query.nick;
                        updater.remember(res, gameId, nick);
                    } else {
                        sendError(405, 'Method Not Allowed');
                    }
                    break;

                default:
                    sendError(404, 'Endpoint not found');
            }

        } catch (err) {
            console.error(err);
            sendError(400, 'Invalid JSON or Request Error');
        }
    });
});

// --- CORREÇÃO FINAL: Escutar em 0.0.0.0 ---
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});