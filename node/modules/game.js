// node/modules/game.js - CÓDIGO FINAL E CORRIGIDO
const crypto = require('crypto');
const storage = require('./storage.js');
const updater = require('./updater.js');

// --- FUNÇÕES AUXILIARES ---

function createBoard(size) {
    // Cria array com o tamanho TOTAL (4 * size) preenchido com null
    const totalCells = 4 * size;
    const board = Array(totalCells).fill(null);

    for (let c = 0; c < size; c++) {
        // Linha 0 (Red/Gold)
        board[c] = { color: "Red", type: "initial", inMotion: false, reachedLastRow: false }; 
        // Linha 3 (Blue/Black)
        board[3 * size + c] = { color: "Blue", type: "initial", inMotion: false, reachedLastRow: false };
    }
    return board;
}

function getBoardPath(cols) {
    const path = [];
    const ROWS = 4;
    for (let r = 0; r < ROWS; r++) {
        if (r % 2 === 0) for (let c = cols - 1; c >= 0; c--) path.push(r * cols + c);
        else for (let c = 0; c < cols; c++) path.push(r * cols + c);
    }
    return path;
}

function mirrorIndex(idx, cols) {
    return (4 * cols) - 1 - idx;
}

function computeNextPositions(idx, cols, path) {
    const idxToPathPos = new Map();
    path.forEach((val, i) => idxToPathPos.set(val, i));
    const p = idxToPathPos.get(idx);
    if (p == null) return [];
    const result = [];
    if (p + 1 < path.length) {
        const cur = path[p];
        const nxt = path[p + 1];
        result.push(nxt);
        const rCur = Math.floor(cur / cols);
        const rNxt = Math.floor(nxt / cols);
        if (rCur === 2 && rNxt === 3) result.push(1 * cols + (cur % cols));
    } else {
        const cur = path[p];
        if (Math.floor(cur / cols) === 3) result.push(2 * cols + (cur % cols));
    }
    return [...new Set(result)];
}

function advanceVariants(startIdx, steps, cols) {
    const path = getBoardPath(cols);
    let frontier = [startIdx];
    for (let i = 0; i < steps; i++) {
        const next = [];
        for (const pos of frontier) next.push(...computeNextPositions(pos, cols, path));
        frontier = [...new Set(next)];
    }
    return frontier;
}

function getValidMoves(game, piecePos, roll) {
    const cols = game.size;
    const board = game.pieces;
    const piece = board[piecePos];
    if (!piece) return [];
    if (piece.type === "initial" && roll !== 1) return [];

    const isBlue = (piece.color === "Blue");
    let start = isBlue ? mirrorIndex(piecePos, cols) : piecePos;
    let dests = advanceVariants(start, roll, cols);
    if (isBlue) dests = dests.map(d => mirrorIndex(d, cols));

    return dests.filter(targetIdx => {
        const targetPiece = board[targetIdx];
        const rowFrom = Math.floor(piecePos / cols);
        const rowTo = Math.floor(targetIdx / cols);
        if (targetPiece && targetPiece.color === piece.color) return false;

        const myStartRow = isBlue ? 3 : 0;
        const myFinalRow = isBlue ? 0 : 3;
        const reached = (piece.reachedLastRow || piece.wasOnLastRow);
        
        if (reached && rowFrom !== myFinalRow && rowTo === myFinalRow) return false;
        if (rowTo === myStartRow && rowFrom !== myStartRow) return false;
        if (rowTo === myFinalRow) {
            let hasPiecesInStart = false;
            for (let c = 0; c < cols; c++) {
                const p = board[myStartRow * cols + c];
                if (p && p.color === piece.color) { hasPiecesInStart = true; break; }
            }
            if (hasPiecesInStart) return false;
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
    return users[nick] === hash;
}

// --- API ---

function join(data, sendJSON, sendError) {
    const { group, nick, password, size } = data;
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
            gameID: gameId, group: group, size: size,
            players: { [nick]: "Blue" }, turn: nick, initial: nick,
            pieces: createBoard(size),
            state: "waiting", winner: null, dice: null, step: "from", selected: [], mustPass: null
        };
    } else {
        if (!games[gameId].players[nick]) {
            games[gameId].players[nick] = "Red";
            games[gameId].state = "ongoing";
        }
    }
    storage.saveGames();
    updater.notifyAll(gameId);
    sendJSON(200, { game: gameId }); // <--- O IMPORTANTE ESTÁ AQUI
}

function leave(data, sendJSON, sendError) {
    const { nick, password, game: gameId } = data;
    if (!isValidUser(nick, password)) return sendError(401, "Auth failed");
    const games = storage.getGames();
    const game = games[gameId];
    if (!game) return sendError(404, "Game not found");
    
    const opponent = Object.keys(game.players).find(p => p !== nick);
    game.winner = opponent || nick; 
    game.state = "ended";
    storage.saveGames();
    updater.notifyAll(gameId);
    sendJSON(200, {});
}

function roll(data, sendJSON, sendError) {
    const { nick, password, game: gameId } = data;
    if (!isValidUser(nick, password)) return sendError(401, "Auth failed");
    const games = storage.getGames();
    const game = games[gameId];
    if (!game) return sendError(404, "Game not found");
    if (game.turn !== nick) return sendError(400, "Not your turn");
    if (game.dice && game.dice.value) return sendError(400, "Already rolled");

    let upCount = 0;
    for(let i=0; i<4; i++) if(Math.random() < 0.5) upCount++;
    const value = upCount === 0 ? 6 : upCount;
    game.dice = { value, keepPlaying: (value === 1 || value === 4 || value === 6) };
    
    // Check moves
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
    sendJSON(200, { dice: game.dice });
}

function notify(data, sendJSON, sendError) {
    const { nick, password, game: gameId, cell } = data;
    if (!isValidUser(nick, password)) return sendError(401, "Auth failed");
    const games = storage.getGames();
    const game = games[gameId];
    if (!game) return sendError(404, "Game not found");
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
        const myFinalRow = (board[idx].color === "Blue") ? 0 : 3;
        if (Math.floor(idx / game.size) === myFinalRow) {
            board[idx].reachedLastRow = true;
            board[idx].type = "final";
        }

        game.step = "from"; game.selected = []; game.lastCell = null;
        const winner = checkWin(game);
        if (winner) { game.winner = winner; game.state = "ended"; }
        else { if (!game.dice.keepPlaying) game.turn = getOpponentNick(game); game.dice = null; }
        
        storage.saveGames();
        updater.notifyAll(gameId);
        return sendJSON(200, {});
    }
}

function pass(data, sendJSON, sendError) {
    const { nick, password, game: gameId } = data;
    if (!isValidUser(nick, password)) return sendError(401, "Auth failed");
    const games = storage.getGames();
    const game = games[gameId];
    if (!game) return sendError(404, "Game not found");
    
    if (game.dice && game.dice.keepPlaying) { game.dice = null; game.mustPass = null; }
    else { game.dice = null; game.mustPass = null; game.turn = getOpponentNick(game); }
    
    storage.saveGames();
    updater.notifyAll(gameId);
    sendJSON(200, {});
}

module.exports = { join, leave, roll, notify, pass };