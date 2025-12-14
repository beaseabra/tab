// js/Piece.js
export class Piece {
  constructor(player) {
    // Identificador do jogador dono da peça
    this.player = player; // "G" ou "B"
    
    // Estado de movimento
    this.moved = false; // true se a peça já foi movida pelo jogador

    // Informação sobre a última linha
    this.wasOnLastRow = false; //true se já esteve na última fila do tabuleiro

    //Tipo da peça
    this.type = "initial"; // "initial", "moved", "final", etc.
  }
}