// node/modules/game.js
const crypto = require('crypto');
const storage = require('./storage.js');
const updater = require('./updater.js');

// --- FUNÇÕES AUXILIARES DE LÓGICA DE JOGO ---

function createBoard(size) {
    const totalCells = 4 * size;
    const board = Array(totalCells).fill(null);

    for (let c = 0; c < size; c++) {
        // Linha 0 (Blue) - Jogador Inicial
        board[c] = { color: "Blue", type: "initial", inMotion: false, reachedLastRow: false }; 
        // Linha 3 (Red) - Oponente
        board[3 * size + c] = { color: "Red", type: "initial", inMotion: false, reachedLastRow: false };
    }
    return board;
}

function mirrorIndex(idx, cols) {
    return (4 * cols) - 1 - idx;
}

// CORREÇÃO FINAL: Implementação do caminho da serpente: R0 R->L, R1 L->R, R2 R->L, R3 L->R
function getBoardPath(cols) {
    const path = [];
    const ROWS = 4;
    for (let r = 0; r < ROWS; r++) {
        // Linhas pares (R0, R2): DIREITA para ESQUERDA (D->E)
        if (r % 2 === 0) for (let c = cols - 1; c >= 0; c--) path.push(r * cols + c);
        // Linhas ímpares (R1, R3): ESQUERDA para DIREITA (E->D)
        else for (let c = 0; c < cols; c++) path.push(r * cols + c);
    }
    return path;
}


// CORREÇÃO FINAL: Lógica de avanço de 1 passo - Simetria do Caminho
function computeNextPositions_Direct(idx, cols, isBluePlayer) {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const result = [];
    const C_FIM = cols - 1;
    const C_INI = 0;
    
    let dir = 0;
    let nextRow = 0;
    let nextRowIfBranch = 0;
    let exitCol = 0;

    if (isBluePlayer) {
        // Blue (R0->R3): R0, R2 (R->L: -1); R1, R3 (L->R: +1)
        dir = (r % 2 === 0) ? -1 : +1; 
        
        // Transições para Blue
        if (r === 0) { exitCol = C_INI; nextRow = 1; }
        else if (r === 1) { exitCol = C_FIM; nextRow = 2; }
        else if (r === 2) { exitCol = C_INI; nextRow = 3; nextRowIfBranch = 1; } // Ramo R2->R1
        else if (r === 3) { exitCol = C_FIM; nextRow = 2; } // Loop
        
    } else { 
        // Red (R3->R0): R3, R1 (L->R: +1); R2, R0 (R->L: -1)
        dir = (r % 2 !== 0) ? +1 : -1;
        
        // Transições para Red
        if (r === 3) { exitCol = C_FIM; nextRow = 2; }
        else if (r === 2) { exitCol = C_INI; nextRow = 1; }
        else if (r === 1) { exitCol = C_FIM; nextRow = 0; nextRowIfBranch = 2; } // Ramo R1->R2
        else if (r === 0) { exitCol = C_INI; nextRow = 1; } // Loop
    }

    // 1. Move dentro da linha atual
    const nextCol = c + dir;
    if (nextCol >= 0 && nextCol < cols) {
        result.push(r * cols + nextCol);
    }
    
    // 2. TRANSIÇÕES (MUDANÇA DE LINHA) - Ocorre apenas na coluna de saída
    if (c === exitCol) {
        // Caminho Principal
        result.push(nextRow * cols + exitCol); 

        // Branching
        if (nextRowIfBranch) {
             result.push(nextRowIfBranch * cols + exitCol); 
        }
    }

    return [...new Set(result)];
}

function advanceVariants_Direct(startIdx, steps, cols, isBluePlayer) {
    let frontier = [startIdx];
    for (let i = 0; i < steps; i++) {
        const next = [];
        for (const pos of frontier) next.push(...computeNextPositions_Direct(pos, cols, isBluePlayer));
        frontier = [...new Set(next)];
    }
    return frontier;
}

function getValidMoves(game, piecePos, roll) {
    const cols = game.size;
    const board = game.pieces;
    const piece = board[piecePos];
    if (!piece) return [];
    
    // 1. Regra: Início do movimento é SOMENTE com dado 1
    if (piece.type === "initial" && roll !== 1) return [];

    const isBlue = (piece.color === "Blue");
    const myInitialRow = isBlue ? 0 : 3;
    const myFinalRow = isBlue ? 3 : 0;
    const rowFrom = Math.floor(piecePos / cols);
    const hasMoved = (piece.type !== "initial");
    const hasReachedEnd = piece.reachedLastRow;

    // 2. Regra: Peça NA última linha só se move se não houver peças na inicial
    if (rowFrom === myFinalRow) { 
        let hasPiecesInStart = false;
        for (let c = 0; c < cols; c++) {
            const p = board[myInitialRow * cols + c];
            if (p && p.color === piece.color && p.type === "initial") { hasPiecesInStart = true; break; }
        }
        if (hasPiecesInStart) return []; // BLOQUEIA o movimento
    }

    // 3. CÁLCULO DIRETO: Usa a lógica do jogador para calcular o avanço
    let dests = advanceVariants_Direct(piecePos, roll, cols, isBlue);

    // 4. FILTRAGEM FINAL DE REGRAS
    return dests.filter(targetIdx => {
        const targetPiece = board[targetIdx];
        const rowTo = Math.floor(targetIdx / cols);
        
        // (A) Não pode comer peça da mesma cor
        if (targetPiece && targetPiece.color === piece.color) return false;

        // (B) Regra: se já esteve na fila FINAL, não pode voltar a ENTRAR nela vindo de outra fila
        if (hasReachedEnd && rowFrom !== myFinalRow && rowTo === myFinalRow) return false;
        
        // (C) Regra: PROIBIR voltar à fila inicial APÓS tê-la deixado
        if (hasMoved && rowTo === myInitialRow && rowFrom !== myInitialRow) return false;
        
        // (D) Regra: só pode ENTRAR na fila FINAL se a fila INICIAL estiver vazia
        if (rowTo === myFinalRow) {
            let hasStartPieces = false;
            for (let c = 0; c < cols; c++) {
                const p = board[myInitialRow * cols + c];
                if (p && p.color === piece.color && p.type === "initial") { hasStartPieces = true; break; }
            }
            if (hasStartPieces) return false;
        }
        return true;
    });
}

function checkWin(game) {
    const board = game.pieces;
    let hasBlue = false, hasRed = false;
    for (const p of board) {
        if (!p) continue;
        if (p.color === "Blue") hasBlue = true;
        if (p.color === "Red") hasRed = true;
    }
    // Se um jogador ficar sem peças, o outro ganha
    if (!hasBlue) return game.players[game.initial] === "Red" ? game.initial : getOpponentNick(game);
    if (!hasRed) return game.players[game.initial] === "Blue" ? game.initial : getOpponentNick(game);
    return null;
}

function getOpponentNick(game) {
    for (const nick in game.players) if (nick !== game.turn) return nick;
    return null;
}

function isValidUser(nick, password) {
    const users = storage.getUsers();
    if (!users[nick]) return false;
    const hash = crypto.createHash('md5').update(password).digest('hex');
    const storedPass = (typeof users[nick] === 'string') ? users[nick] : users[nick].password;
    return storedPass === hash;
}

// --- ATUALIZAÇÃO DO RANKING ---
function updateUserStats(winnerNick, loserNick, group, size) {
    const users = storage.getUsers();
    const key = `${group}-${size}`; 

    const ensureUserStats = (nick) => {
        if (typeof users[nick] === 'string') {
            users[nick] = { password: users[nick], stats: {} };
        } else if (!users[nick].stats) {
            users[nick].stats = {};
        }
        if (!users[nick].stats[key]) {
            users[nick].stats[key] = { victories: 0, games: 0 };
        }
    };

    if (users[winnerNick]) {
        ensureUserStats(winnerNick);
        users[winnerNick].stats[key].victories++;
        users[winnerNick].stats[key].games++;
    }

    if (users[loserNick]) {
        ensureUserStats(loserNick);
        users[loserNick].stats[key].games++;
    }

    storage.saveUsers();
}

// --- API (ENDPOINTS) ---

function join(data, sendJSON, sendError) {
    const { group, nick, password, size } = data;

    if (typeof nick !== 'string' || typeof password !== 'string') {
        return sendError(400, 'Invalid credentials format');
    }
    if (typeof group !== 'number') {
        return sendError(400, 'Invalid group: must be a number');
    }
    if (!Number.isInteger(size) || size <= 0) {
        return sendError(400, 'Invalid size: must be a positive integer');
    }

    if (!isValidUser(nick, password)) return sendError(401, "Auth failed");

    const games = storage.getGames();
    let gameId = null;
    
    for (const id in games) {
        const g = games[id];
        if (g.group == group && g.size == size && !g.winner) {
            if (g.players[nick]) { gameId = id; break; }
            if (Object.keys(g.players).length < 2) { gameId = id; break; }
        }
    }

    if (!gameId) {
        const rawId = `${nick}-${Date.now()}-${Math.random()}`;
        gameId = crypto.createHash('md5').update(rawId).digest('hex');
        games[gameId] = {
            players: { [nick]: "Blue" }, turn: nick, initial: nick,
            pieces: createBoard(size),
            state: "waiting", winner: null, dice: null, step: "from", selected: [], mustPass: null,
            gameID: gameId, group: group, size: size
        };
    } else {
        if (!games[gameId].players[nick]) {
            games[gameId].players[nick] = "Red";
            games[gameId].state = "ongoing";
        }
    }
    storage.saveGames();
    updater.notifyAll(gameId);
    sendJSON(200, { game: gameId }); 
}

function leave(data, sendJSON, sendError) {
    const { nick, password, game: gameId } = data;

    if (typeof nick !== 'string' || typeof password !== 'string' || typeof gameId !== 'string') {
        return sendError(400, 'Invalid request format');
    }

    if (!isValidUser(nick, password)) return sendError(401, "Auth failed");
    const games = storage.getGames();
    const game = games[gameId];
    if (!game) return sendError(404, "Game not found");
    
    const opponent = Object.keys(game.players).find(p => p !== nick);
    game.winner = opponent || nick; 
    game.state = "ended";
    
    updateUserStats(game.winner, nick, game.group, game.size);

    storage.saveGames();
    updater.notifyAll(gameId);
    sendJSON(200, {});
}

function roll(data, sendJSON, sendError) {
    const { nick, password, game: gameId } = data;

    if (typeof nick !== 'string' || typeof password !== 'string' || typeof gameId !== 'string') {
        return sendError(400, 'Invalid request format');
    }

    if (!isValidUser(nick, password)) return sendError(401, "Auth failed");
    const games = storage.getGames();
    const game = games[gameId];
    if (!game) return sendError(404, "Game not found");

    if (game.state === "waiting") {
        return sendError(400, "Waiting for opponent");
    }

    if (game.turn !== nick) return sendError(400, "Not your turn");
    if (game.dice && game.dice.value) return sendError(400, "Already rolled");

    let upCount = 0;
    for(let i=0; i<4; i++) if(Math.random() < 0.5) upCount++;
    const value = upCount === 0 ? 6 : upCount;
    // Regra do Extra Roll 1/4/6
    game.dice = { value, keepPlaying: (value === 1 || value === 4 || value === 6) }; 
    
    let canMove = false;
    const myColor = game.players[nick];
    for (let i = 0; i < game.pieces.length; i++) {
        const p = game.pieces[i];
        if (p && p.color === myColor) {
            if (getValidMoves(game, i, value).length > 0) { canMove = true; break; }
        }
    }
    
    game.mustPass = canMove ? null : nick;
    game.step = "from";
    
    storage.saveGames();
    updater.notifyAll(gameId);
    
    sendJSON(200, { dice: game.dice, mustPass: game.mustPass });
}

function notify(data, sendJSON, sendError) {
    const { nick, password, game: gameId, cell } = data;

    if (typeof nick !== 'string' || typeof password !== 'string' || typeof gameId !== 'string') {
        return sendError(400, 'Invalid request format');
    }
    if (cell === undefined || cell === null || isNaN(Number(cell))) {
        return sendError(400, 'Invalid cell');
    }

    if (!isValidUser(nick, password)) return sendError(401, "Auth failed");
    const games = storage.getGames();
    const game = games[gameId];
    if (!game) return sendError(404, "Game not found");

    if (game.state === "waiting") {
        return sendError(400, "Waiting for opponent");
    }

    if (game.turn !== nick) return sendError(400, "Not your turn");

    const idx = parseInt(cell);
    const board = game.pieces;

    if (game.step === "from") {
        if (game.mustPass) return sendError(400, "No moves, must pass");
        
        const piece = board[idx];
        if (!piece || piece.color !== game.players[nick]) return sendError(400, "Invalid piece");
        
        const moves = getValidMoves(game, idx, game.dice.value);
        if (moves.length === 0) return sendError(400, "Piece cannot move");
        
        game.selected = moves;
        game.lastCell = { square: idx };
        game.step = "to";
        
        storage.saveGames();
        updater.notifyAll(gameId);
        return sendJSON(200, {});
    }

    if (game.step === "to") {
        if (!game.selected.includes(idx)) {
            game.step = "from"; game.selected = []; game.lastCell = null;
            storage.saveGames(); updater.notifyAll(gameId); return sendJSON(200, {});
        }
        
        const originIdx = game.lastCell.square;
        board[idx] = board[originIdx];
        board[originIdx] = null;
        
        board[idx].type = "moved";
        board[idx].inMotion = true;
        const myFinalRow = (board[idx].color === "Blue") ? 3 : 0; 
        
        if (Math.floor(idx / game.size) === myFinalRow) {
            board[idx].reachedLastRow = true;
            board[idx].type = "final";
        }

        game.step = "from"; game.selected = []; game.lastCell = null;
        
        const winner = checkWin(game);
        if (winner) { 
            game.winner = winner; 
            game.state = "ended";
            updateUserStats(winner, getOpponentNick(game), game.group, game.size);
        }
        else { 
            // Se NÃO tiver keepPlaying (2, 3, 5), troca o turno. Se tiver (1, 4, 6), não troca.
            if (!game.dice.keepPlaying) { 
                game.turn = getOpponentNick(game); 
            }
            game.dice = null; 
        }
        
        storage.saveGames();
        updater.notifyAll(gameId);
        return sendJSON(200, {});
    }
}

function pass(data, sendJSON, sendError) {
    const { nick, password, game: gameId } = data;

    if (typeof nick !== 'string' || typeof password !== 'string' || typeof gameId !== 'string') {
        return sendError(400, 'Invalid request format');
    }

    if (!isValidUser(nick, password)) return sendError(401, "Auth failed");
    const games = storage.getGames();
    const game = games[gameId];
    if (!game) return sendError(404, "Game not found");
    
    if (game.state === "waiting") {
        return sendError(400, "Waiting for opponent");
    }

    // CORREÇÃO: Passar a vez (Skip Turn)
    game.dice = null; 
    game.mustPass = null; 
    game.turn = getOpponentNick(game);
    
    storage.saveGames();
    updater.notifyAll(gameId);
    sendJSON(200, {});
}

module.exports = { join, leave, roll, notify, pass };