// js/App.js - VERSÃO CORRIGIDA
import { UIManager } from "./UIManager.js";
import { TabGame } from "./TabGame.js";
import { OnlineGame } from "./OnlineGame.js";

document.addEventListener("DOMContentLoaded", () => {

  const ui = new UIManager();
  let localGame = new TabGame(ui);
  
  // ✅ IMPORTANTE: URL do teu servidor Node.js
  const activeServer = "http://twserver.alunos.dcc.fc.up.pt:8132";
  
  const onlineGame = new OnlineGame(ui, {
    serverUrl: activeServer,
    group: 32, // muda para o teu número de grupo
  });

  let activeMode = "local"; // "local" | "online"

  // ===== CALLBACKS =====
  
  ui.onThrow = () => {
    if (activeMode === "online") return onlineGame.roll();
    return localGame.rollSticks();
  };

  ui.onQuit = async () => {
    if (activeMode === "online") {
      await onlineGame.leave();
      ui.addMessage("System", "Online: left the match.");
      activeMode = "local";
      return;
    }
    localGame.quitGame();
  };

  ui.onLogin = async (nick, pass) => {
    try {
      await onlineGame.login(nick, pass);
      sessionStorage.setItem("tab_nick", nick);
      sessionStorage.setItem("tab_pass", pass);
      ui.addMessage("System", `✅ Sessão iniciada como ${nick}.`);
    } catch (error) {
      ui.addMessage("System", `❌ Erro ao fazer login: ${error.message}`);
      console.error("Login error:", error);
    }
  };

  ui.onLogout = async () => {
    if (activeMode === "online") {
      await onlineGame.leave();
      activeMode = "local";
    }
    sessionStorage.removeItem("tab_nick");
    sessionStorage.removeItem("tab_pass");
    ui.addMessage("System", "Sessão terminada.");
  };

  // Auto-login se já tiver credenciais guardadas
  const savedNick = sessionStorage.getItem("tab_nick");
  const savedPass = sessionStorage.getItem("tab_pass");
  if (savedNick && savedPass) {
    onlineGame.login(savedNick, savedPass)
      .then(() => {
        ui.setAuthUI(true, savedNick);
        ui.addMessage("System", `Auto-login: ${savedNick}`);
      })
      .catch((error) => {
        console.error("Auto-login failed:", error);
        sessionStorage.clear();
      });
  }

  // ===== INICIAR JOGO =====
  
  ui.onGoToGame = async ({ cols, mode, first, aiLevel }) => {
    ui.resetGameUI();

    // --- MODO ONLINE ---
    if (mode === "pvp_online") {
      
      // Verificar se está autenticado
      if (!onlineGame.isLoggedIn()) {
        ui.addMessage("System", "❌ Faz login primeiro para jogar online!");
        return;
      }

      // Se já estava online, sai do jogo anterior
      if (activeMode === "online") {
        await onlineGame.leave();
      }

      activeMode = "online";
      ui.clearHighlights(true);
      ui.setRollEnabled(false);
      ui.setSkipEnabled(false);

      const empty = Array.from({ length: 4 }, () => Array(cols).fill(null));
      ui.renderBoard(empty, "G", (r, c) => onlineGame.notifyByCoords(r, c));
      ui.updateCounts(0, 0);
      ui.addMessage("System", "🌐 Online: a procurar adversário...");

      try {
        await onlineGame.start(cols);
      } catch (error) {
        ui.addMessage("System", `❌ Erro online: ${error.message || error}`);
        console.error("Online game error:", error);
        activeMode = "local";
      }

      document.querySelector(".bottom")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // --- MODO LOCAL ---
    
    // Se estava online, sai
    if (activeMode === "online") {
      await onlineGame.leave();
    }

    activeMode = "local";
    localGame = new TabGame(ui);
    localGame.init(cols, first);

    let modeText = "";
    switch (mode) {
      case "pvp_local":
        modeText = "Player vs Player (mesmo computador)";
        break;
      case "pvc":
        modeText = `Player vs Computer (${aiLevel})`;
        break;
    }

    ui.addMessage("System", `🎮 Novo jogo: ${modeText}, primeiro a jogar: ${first}.`);
    document.querySelector(".bottom")?.scrollIntoView({ behavior: "smooth" });
  };

  ui.onConfigChange = () => ui.updateAIVisibility();

  // ===== INICIALIZAÇÃO =====
  
  ui.initListeners();
  ui.updateAIVisibility();
  localGame.init(9, "Gold");

  // ===== MODAL DE REGRAS (PUSH-UP) =====
  
  const ruleItems = document.querySelectorAll(".rules details");
  const overlay = document.getElementById("ruleOverlay");
  const ruleTitle = document.getElementById("ruleTitle");
  const ruleText = document.getElementById("ruleText");
  const ruleVideo = document.getElementById("ruleVideoModal");
  const videoSource = ruleVideo?.querySelector("source");
  const closeRuleBtn = document.querySelector(".close-rule");

  ruleItems.forEach(item => {
    const summary = item.querySelector("summary");
    summary?.addEventListener("click", (e) => {
      e.preventDefault();
      const title = summary.textContent.trim();
      const textContainer = item.querySelector("div, p");
      const text = textContainer ? textContainer.innerHTML : "";

      if (ruleTitle) ruleTitle.textContent = title;
      if (ruleText) ruleText.innerHTML = text;

      const rule = item.dataset.rule;
      if (videoSource) {
        videoSource.src = `http://www.alunos.dcc.fc.up.pt/~up202303448/tab_videos/${rule}.mp4`;
      }

      ruleVideo?.load();
      ruleVideo?.play();
      overlay?.classList.remove("hidden");
    });
  });

  closeRuleBtn?.addEventListener("click", () => {
    ruleVideo?.pause();
    overlay?.classList.add("hidden");
  });

  // ===== BOTÃO "IR PARA CONFIGURAÇÕES" =====
  
  const goToConfigBtn = document.getElementById("goToConfigBtn");
  goToConfigBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("configurations")?.scrollIntoView({ 
      behavior: "smooth", 
      block: "start" 
    });
  });

  // ===== CLASSIFICAÇÕES - GUARDAR RESULTADOS =====
  
  window.recordGameResult = function (winner, piecesLeft) {
    const result = {
      date: new Date().toISOString().split("T")[0],
      winner,
      piecesLeft,
    };

    const classifications = JSON.parse(localStorage.getItem("classifications")) || [];
    classifications.push(result);
    localStorage.setItem("classifications", JSON.stringify(classifications));
  };

  // ===== POPUP DE CLASSIFICAÇÕES =====
  
  const openClassificationsBtn = document.getElementById("openClassificationsBtn");
  const classificationsOverlay = document.getElementById("classificationsOverlay");
  const closeClassificationsBtn = document.querySelector(".close-classifications");
  const classificationsTableContainer = document.getElementById("classificationsTableContainer");

  function renderClassifications() {
    const classifications = JSON.parse(localStorage.getItem("classifications")) || [];

    if (classifications.length === 0) {
      classificationsTableContainer.innerHTML = "<p>No games played yet.</p>";
      return;
    }

    classifications.sort((a, b) => {
      const piecesA = parseInt(a.piecesLeft) || 0;
      const piecesB = parseInt(b.piecesLeft) || 0;
      return piecesB - piecesA;
    });

    let tableHTML = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Winner</th>
            <th>Pieces Left</th>
          </tr>
        </thead>
        <tbody>
    `;

    classifications.forEach((c) => {
      tableHTML += `
        <tr>
          <td>${c.date}</td>
          <td>${c.winner}</td>
          <td>${c.piecesLeft}</td>
        </tr>
      `;
    });

    tableHTML += "</tbody></table>";
    classificationsTableContainer.innerHTML = tableHTML;
  }

  openClassificationsBtn?.addEventListener("click", () => {
    renderClassifications();
    classificationsOverlay?.classList.remove("hidden");

    const popup = classificationsOverlay?.querySelector(".classifications-popup");
    if (popup) {
      popup.classList.remove("animate-in", "animate-in-left");
      void popup.offsetWidth;
      popup.classList.add("animate-in");
    }
  });

  closeClassificationsBtn?.addEventListener("click", () => {
    classificationsOverlay?.classList.add("hidden");
  });

  // ===== LOGS DE DEBUG =====
  
  console.log("🎮 Tâb Game inicializado!");
  console.log("🌐 Servidor:", activeServer);
  console.log("👥 Grupo:", onlineGame.group);
  console.log("📦 Modo atual:", activeMode);
});