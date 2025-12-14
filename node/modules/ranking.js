// modules/ranking.js
const storage = require('./storage.js');

function getRanking(data, sendJSON, sendError) {
    // O enunciado diz que a tabela vem de dados persistidos.
    // Vamos assumir que guardamos vitórias nos utilizadores ou processamos os jogos.
    // Para simplificar a Fase 1, vou enviar um ranking estático ou baseado numa estrutura simples.
    
    // NOTA: Precisaremos de lógica para atualizar vitórias quando o jogo acaba (game.js).
    // Por agora, retorna lista vazia ou mock para testar.
    
    const rankingData = []; 
    // Exemplo: iterar storage.users e ver quem tem mais vitórias (se guardarmos isso)
    
    // O formato esperado pelo OnlineGame.js e ServerAPI é:
    // { ranking: [ { nick: "...", victories: 10, games: 12 }, ... ] }
    
    sendJSON(200, { ranking: rankingData });
}

module.exports = {
    getRanking
};