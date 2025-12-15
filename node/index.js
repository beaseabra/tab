// index.js
const http = require('http');
const url = require('url');
const fs = require('fs');

// Importar os nossos módulos (que vamos criar a seguir)
const auth = require('./modules/auth.js');
const storage = require('./modules/storage.js');
const ranking = require('./modules/ranking.js');
const game = require('./modules/game.js'); 
const updater = require('./modules/updater.js');

const PORT = 8132; // Será 81XX no servidor da faculdade
const HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

// Inicializa o armazenamento (lê/cria ficheiros)
storage.init();

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 1. Tratar CORS (Preflight requests)
    if (req.method === 'OPTIONS') {
        res.writeHead(204, HEADERS);
        res.end();
        return;
    }

    // 2. Definir função auxiliar para enviar respostas JSON
    const sendJSON = (status, data) => {
        res.writeHead(status, HEADERS);
        res.end(JSON.stringify(data));
    };

    const sendError = (status, message) => {
        sendJSON(status, { error: message });
    };

    // 3. Recolher o Body do pedido (para POST)
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
        try {
            const data = body ? JSON.parse(body) : {};

            // === ROUTER (Encaminhamento) ===
            
            switch (pathname) {
                // --- Objetivos Mínimos ---
                case '/register':
                    auth.register(data, sendJSON, sendError);
                    break;
                case '/ranking':
                    ranking.getRanking(data, sendJSON, sendError);
                    break;

                // --- Valorização (Deixamos já preparado) ---
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
                
                // --- Update Stream (SSE) ---
                case '/update':
                    if (req.method === 'GET') {
                        updater.handleUpdate(req, res, parsedUrl.query);
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

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});