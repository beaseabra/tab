// node/modules/ranking.js
const storage = require('./storage.js');

function getRanking(data, sendJSON, sendError) {
    const { group, size } = data;

    // --- VALIDAÇÃO ---
    // O enunciado diz que há tabelas distintas, por isso precisamos saber qual mostrar.
    if (group === undefined || typeof group !== 'number') {
        return sendError(400, 'Invalid group');
    }
    if (size === undefined || (!Number.isInteger(size) || size <= 0)) {
        return sendError(400, 'Invalid size');
    }
    // -----------------

    const users = storage.getUsers();
    const ranking = [];
    
    // A chave tem de bater certo com a que usámos no game.js (ex: "32-9")
    const key = `${group}-${size}`; 

    for (const nick in users) {
        const user = users[nick];
        
        // Só adicionamos à lista se o user tiver estatísticas PARA ESTE GRUPO/TAMANHO
        // (Ignoramos users antigos que sejam só strings ou que não tenham jogado neste modo)
        if (typeof user !== 'string' && user.stats && user.stats[key]) {
            ranking.push({
                nick: nick,
                victories: user.stats[key].victories,
                games: user.stats[key].games
            });
        }
    }

    // Ordenar: Mais vitórias primeiro. 
    // (Opcional: em caso de empate, quem tem menos jogos fica à frente)
    ranking.sort((a, b) => {
        if (b.victories !== a.victories) return b.victories - a.victories;
        return a.games - b.games;
    });

    // Retorna apenas os Top 10 para não sobrecarregar
    sendJSON(200, { ranking: ranking.slice(0, 10) });
}

module.exports = { getRanking };