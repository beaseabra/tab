// modules/storage.js
const fs = require('fs');
const path = require('path');

// Caminho para a pasta data
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');

// Estruturas em memória
let users = {};
let games = {};

function init() {
    // Cria a diretoria se não existir
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR);
    }

    // Carrega Users
    if (fs.existsSync(USERS_FILE)) {
        try {
            users = JSON.parse(fs.readFileSync(USERS_FILE));
        } catch (e) { users = {}; }
    }

    // Carrega Games
    if (fs.existsSync(GAMES_FILE)) {
        try {
            games = JSON.parse(fs.readFileSync(GAMES_FILE));
        } catch (e) { games = {}; }
    }
    
    console.log('Storage loaded.');
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveGames() {
    fs.writeFileSync(GAMES_FILE, JSON.stringify(games, null, 2));
}

module.exports = {
    init,
    getUsers: () => users,
    getGames: () => games,
    saveUsers,
    saveGames
};