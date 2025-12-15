// node/modules/auth.js
const crypto = require('crypto');
const storage = require('./storage.js');

function register(data, sendJSON, sendError) {
    const { nick, password } = data;

    // --- VALIDAÇÃO DE TIPOS (Obrigatório) ---
    if (typeof nick !== 'string' || nick.trim().length === 0) {
        return sendError(400, 'Invalid nick: must be a non-empty string');
    }

    // --- SEGURANÇA EXTRA (Prototype Pollution) ---
    // Impede o uso de palavras reservadas que podem corromper o objeto users
    if (nick === 'constructor' || nick === '__proto__') {
        return sendError(400, 'Invalid nick: reserved word');
    }

    if (typeof password !== 'string' || password.length === 0) {
        return sendError(400, 'Invalid password: must be a non-empty string');
    }
    // ----------------------------------------

    const users = storage.getUsers();
    const hash = crypto.createHash('md5').update(password).digest('hex');

    if (users[nick]) {
        // CORREÇÃO CRÍTICA: Verifica se é string (formato inicial) ou objeto (formato pós-jogo)
        // Se o user já jogou, users[nick] é um objeto { password: "...", stats: {...} }
        // Se acabou de se registar, users[nick] é apenas a string do hash "..."
        const storedHash = (typeof users[nick] === 'string') ? users[nick] : users[nick].password;
        
        if (storedHash === hash) {
            return sendJSON(200, {}); // Sucesso (Login implícito)
        } else {
            return sendError(401, 'User registered with different password');
        }
    }

    // Criar novo user (inicialmente apenas string para compatibilidade simples)
    users[nick] = hash;
    storage.saveUsers();

    return sendJSON(200, {});
}

module.exports = {
    register
};