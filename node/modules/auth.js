// modules/auth.js
const crypto = require('crypto');
const storage = require('./storage.js');

function register(data, sendJSON, sendError) {
    const { nick, password } = data;

    // Validação básica
    if (!nick || !password) {
        return sendError(400, 'Nick and password required');
    }

    const users = storage.getUsers();

    if (users[nick]) {
        // Enunciado não especifica se register falha se user existe ou se faz login.
        // Normalmente /register é só registo, mas no TWServer original /register 
        // servia para verificar a pass se o user já existisse.
        
        const hash = crypto.createHash('md5').update(password).digest('hex');
        if (users[nick] === hash) {
            return sendJSON(200, {}); // Sucesso (Login implícito)
        } else {
            return sendError(401, 'User registered with different password');
        }
    }

    // Criar novo user
    const hash = crypto.createHash('md5').update(password).digest('hex');
    users[nick] = hash;
    storage.saveUsers();

    return sendJSON(200, {});
}

module.exports = {
    register
};