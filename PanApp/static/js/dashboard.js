// ===========================================
// SERVO CONTROLLER DASHBOARD - JAVASCRIPT
// ===========================================

// Variabili globali
let socket;
let servoChart, potChart;
let servoData = { labels: [], data1: [], data2: [], data3: [] };
let potData = { labels: [], data1: [], data2: [], data3: [] };
let tableData = [];
let autoRefreshEnabled = true;
let refreshInterval = 2000;
let startTime = Date.now();
let autoRefreshTimer;

// ===========================================
// INIZIALIZZAZIONE PRINCIPALE
// ===========================================
document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Inizializzazione Dashboard...");

  try {
    initializeSocket();
    initializeCharts();
    initializeEventListeners();
    showSection("overview");
    loadInitialData();
    startAutoRefresh();

    console.log("✅ Dashboard inizializzata correttamente");
  } catch (error) {
    console.error("❌ Errore inizializzazione:", error);
    showNotification(
      "Errore durante l'inizializzazione della dashboard",
      "error"
    );
  }
});

// ===========================================
// WEBSOCKET CONNECTION
// ===========================================
function initializeSocket() {
  try {
    socket = io();

    socket.on("connect", function () {
      updateConnectionStatus(true);
      console.log("✅ WebSocket connesso");
      showNotification("Connesso al server", "success");
    });

    socket.on("disconnect", function () {
      updateConnectionStatus(false);
      console.log("❌ WebSocket disconnesso");
      showNotification("Connessione persa", "error");
    });

    socket.on("data_update", function (response) {
      try {
        const data = response.servo_data;
        const stats = response.system_stats;

        if (data) {
          updateServoDisplay(data);
          updateCharts(data);

          // Animazione di aggiornamento
          document.querySelectorAll(".servo-card").forEach((card) => {
            card.classList.add("data-update");
            setTimeout(() => card.classList.remove("data-update"), 300);
          });
        }

        if (stats) {
          updateSystemStats(stats);
        }
      } catch (error) {
        console.error("❌ Errore processamento dati WebSocket:", error);
      }
    });

    socket.on("status", function (data) {
      console.log("📡 Status WebSocket:", data.message);
    });

    socket.on("error", function (error) {
      console.error("❌ Errore WebSocket:", error);
      updateConnectionStatus(false);
    });
  } catch (error) {
    console.error("❌ Errore inizializzazione WebSocket:", error);
    updateConnectionStatus(false);
  }
}

function updateConnectionStatus(connected) {
  const statusElement = document.getElementById("connectionStatus");

  if (connected) {
    statusElement.innerHTML = '<i class="fas fa-wifi"></i> Connesso';
    statusElement.className = "connection-status connected";
  } else {
    statusElement.innerHTML = '<i class="fas fa-wifi-slash"></i> Disconnesso';
    statusElement.className = "connection-status disconnected";
  }
}

// ===========================================
// INIZIALIZZAZIONE GRAFICI
// ===========================================
function initializeCharts() {
  try {
    // Configurazione comune per entrambi i grafici
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      animation: {
        duration: 0, // Disabilita animazioni per performance
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            color: "#ffffff",
            font: { size: 12 },
            padding: 15,
          },
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleColor: "#ffffff",
          bodyColor: "#ffffff",
          borderColor: "#4ecdc4",
          borderWidth: 1,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
            drawBorder: false,
          },
          ticks: {
            color: "#b3b3b3",
            font: { size: 10 },
            maxTicksLimit: 10,
          },
        },
        y: {
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
            drawBorder: false,
          },
          ticks: {
            color: "#b3b3b3",
            font: { size: 10 },
          },
        },
      },
    };

    // Grafico Angoli Servo
    const servoCtx = document.getElementById("servoChart");
    if (!servoCtx) {
      throw new Error("Canvas servoChart non trovato");
    }

    servoChart = new Chart(servoCtx.getContext("2d"), {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Servo 1",
            data: [],
            borderColor: "#ff6b6b",
            backgroundColor: "rgba(255, 107, 107, 0.1)",
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
          {
            label: "Servo 2",
            data: [],
            borderColor: "#4ecdc4",
            backgroundColor: "rgba(78, 205, 196, 0.1)",
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
          {
            label: "Servo 3",
            data: [],
            borderColor: "#ffd93d",
            backgroundColor: "rgba(255, 217, 61, 0.1)",
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
        ],
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            beginAtZero: true,
            max: 180,
            title: {
              display: true,
              text: "Angolo (°)",
              color: "#ffffff",
              font: { size: 12 },
            },
          },
        },
      },
    });

    // Grafico Potenziometri
    const potCtx = document.getElementById("potChart");
    if (!potCtx) {
      throw new Error("Canvas potChart non trovato");
    }

    potChart = new Chart(potCtx.getContext("2d"), {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Pot 1",
            data: [],
            borderColor: "#ff6b6b",
            backgroundColor: "rgba(255, 107, 107, 0.1)",
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
          {
            label: "Pot 2",
            data: [],
            borderColor: "#4ecdc4",
            backgroundColor: "rgba(78, 205, 196, 0.1)",
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
          {
            label: "Pot 3",
            data: [],
            borderColor: "#ffd93d",
            backgroundColor: "rgba(255, 217, 61, 0.1)",
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
        ],
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: "Percentuale (%)",
              color: "#ffffff",
              font: { size: 12 },
            },
          },
        },
      },
    });

    console.log("📊 Grafici inizializzati correttamente");
  } catch (error) {
    console.error("❌ Errore inizializzazione grafici:", error);
    showNotification("Errore inizializzazione grafici", "error");
  }
}

// ===========================================
// AGGIORNAMENTO GRAFICI
// ===========================================
function updateCharts(data) {
  if (!data || !servoChart || !potChart) return;

  try {
    const now = new Date().toLocaleTimeString();

    // Mantieni solo gli ultimi 50 punti per performance
    const maxDataPoints = 50;

    if (servoData.labels.length >= maxDataPoints) {
      servoData.labels.shift();
      servoData.data1.shift();
      servoData.data2.shift();
      servoData.data3.shift();
      potData.labels.shift();
      potData.data1.shift();
      potData.data2.shift();
      potData.data3.shift();
    }

    // Aggiungi nuovi dati
    servoData.labels.push(now);
    servoData.data1.push(data.servo1_angle || 0);
    servoData.data2.push(data.servo2_angle || 0);
    servoData.data3.push(data.servo3_angle || 0);

    potData.labels.push(now);
    potData.data1.push(data.pot1_percent || 0);
    potData.data2.push(data.pot2_percent || 0);
    potData.data3.push(data.pot3_percent || 0);

    // Aggiorna grafico servo
    servoChart.data.labels = servoData.labels;
    servoChart.data.datasets[0].data = servoData.data1;
    servoChart.data.datasets[1].data = servoData.data2;
    servoChart.data.datasets[2].data = servoData.data3;
    servoChart.update("none");

    // Aggiorna grafico potenziometri
    potChart.data.labels = potData.labels;
    potChart.data.datasets[0].data = potData.data1;
    potChart.data.datasets[1].data = potData.data2;
    potChart.data.datasets[2].data = potData.data3;
    potChart.update("none");
  } catch (error) {
    console.error("❌ Errore aggiornamento grafici:", error);
  }
}

function clearCharts() {
  try {
    // Reset dati
    servoData = { labels: [], data1: [], data2: [], data3: [] };
    potData = { labels: [], data1: [], data2: [], data3: [] };

    // Reset grafici
    if (servoChart) {
      servoChart.data.labels = [];
      servoChart.data.datasets.forEach((dataset) => (dataset.data = []));
      servoChart.update();
    }

    if (potChart) {
      potChart.data.labels = [];
      potChart.data.datasets.forEach((dataset) => (dataset.data = []));
      potChart.update();
    }

    console.log("📊 Grafici puliti");
    showNotification("Grafici puliti", "info");
  } catch (error) {
    console.error("❌ Errore pulizia grafici:", error);
  }
}

// ===========================================
// AGGIORNAMENTO DISPLAY SERVO
// ===========================================
function updateServoDisplay(data) {
  if (!data) {
    console.warn("⚠️ Nessun dato ricevuto per aggiornamento display");
    return;
  }

  try {
    console.log("🔄 Aggiornamento display servo con:", data);

    // Aggiorna ogni servo (1, 2, 3)
    for (let i = 1; i <= 3; i++) {
      updateSingleServo(i, data);
    }

    // Aggiorna barra di stato globale
    updateStatusBar(data);
  } catch (error) {
    console.error("❌ Errore aggiornamento display servo:", error);
  }
}

function updateSingleServo(servoNum, data) {
  try {
    const angle = data[`servo${servoNum}_angle`] || 0;
    const anglePercent = data[`servo${servoNum}_angle_percent`] || 0;
    const potPercent = data[`pot${servoNum}_percent`] || 0;
    const pwm = data[`servo${servoNum}_pwm`] || 26;
    const isActive = data[`servo${servoNum}_active`] || 0;

    // Aggiorna valori numerici
    const angleElement = document.getElementById(`angle${servoNum}`);
    const potElement = document.getElementById(`pot${servoNum}`);
    const pwmElement = document.getElementById(`pwm${servoNum}`);

    if (angleElement) angleElement.textContent = Math.round(angle);
    if (potElement) potElement.textContent = Math.round(potPercent);
    if (pwmElement) pwmElement.textContent = pwm;

    // Aggiorna barra di progresso
    const progressFill = document.getElementById(`progress${servoNum}`);
    const progressThumb = document.getElementById(`thumb${servoNum}`);

    if (progressFill) {
      progressFill.style.width = `${anglePercent}%`;
    }

    if (progressThumb) {
      progressThumb.style.left = `calc(${anglePercent}% - 8px)`; // -8px per centrare il thumb
    }

    // Aggiorna stato attivo del servo
    const servoCard = document.getElementById(`servo${servoNum}`);
    const badge = document.getElementById(`badge${servoNum}`);

    if (servoCard && badge) {
      if (isActive) {
        servoCard.classList.add("active");
        badge.textContent = "ATTIVO";
        badge.classList.add("active");
      } else {
        servoCard.classList.remove("active");
        badge.textContent = "STOP";
        badge.classList.remove("active");
      }
    }
  } catch (error) {
    console.error(`❌ Errore aggiornamento servo ${servoNum}:`, error);
  }
}

function updateStatusBar(data) {
  try {
    // Aggiorna contatore servo attivi
    const activeServos = data.servos_active_count || 0;
    const activeServosElement = document.getElementById("activeServos");
    if (activeServosElement) {
      activeServosElement.textContent = activeServos;
    }

    // Aggiorna stato pulsante (LOGICA INVERTITA PER WEB APP)
    // Inversione richiesta: button_pressed=1 → mostra "LIBERO"
    //                      button_pressed=0 → mostra "PREMUTO"
    const buttonPressed = data.button_pressed;
    const buttonStatus = document.getElementById("buttonStatus");
    const buttonCard = document.getElementById("buttonCard");

    if (buttonStatus && buttonCard) {
      // LOGICA INVERTITA: opposto di quello che arriva dal database
      const invertedButtonState = !buttonPressed;
      buttonStatus.textContent = invertedButtonState ? "PREMUTO" : "LIBERO";

      if (invertedButtonState) {
        buttonCard.classList.add("pressed");
      } else {
        buttonCard.classList.remove("pressed");
      }
    }

    // Aggiorna stato LED (LOGICA FORZATA CORRETTA)
    // CORREZIONE: Forziamo la logica corretta basandoci sul pulsante
    // Quando pulsante NON premuto (0) → LED ACCESO
    // Quando pulsante premuto (1) → LED SPENTO
    const ledState = data.led_state;
    const ledStatus = document.getElementById("ledStatus");
    const ledCard = document.getElementById("ledCard");

    if (ledStatus && ledCard) {
      // LOGICA CORRETTA: led_state dovrebbe essere opposto a button_pressed
      const expectedLedState = !buttonPressed; // Inverti il pulsante
      const displayLedState = ledState ? "ACCESO" : "SPENTO";

      // Se la logica dal database è corretta, usa led_state
      // Se è invertita, usa expectedLedState
      if (ledState === expectedLedState) {
        // Logica corretta dal database
        ledStatus.textContent = displayLedState;
        if (ledState) {
          ledCard.classList.add("on");
        } else {
          ledCard.classList.remove("on");
        }
      } else {
        // Logica invertita dal database - correggiamo
        console.warn(
          "⚠️ Logica LED invertita nel database - correzione applicata"
        );
        ledStatus.textContent = expectedLedState ? "ACCESO" : "SPENTO";
        if (expectedLedState) {
          ledCard.classList.add("on");
        } else {
          ledCard.classList.remove("on");
        }
      }
    }

    // Debug dettagliato per troubleshooting (AGGIORNATO CON LOGICA INVERTITA)
    const ledPhysicalState = ledState ? "ACCESO" : "SPENTO";
    const buttonPhysicalState = buttonPressed ? "DB_PRESSED" : "DB_FREE";
    const buttonDisplayState = !buttonPressed ? "SHOW_PRESSED" : "SHOW_FREE";
    const expectedState = !buttonPressed ? "ACCESO" : "SPENTO";

    console.log(
      `🔘 Status: Button_DB=${buttonPhysicalState}, Button_Display=${buttonDisplayState}, LED=${ledPhysicalState}, LED_Expected=${expectedState}, Active=${activeServos}`
    );

    // Verifica che LED sia opposto al pulsante del database (logica corretta)
    if (ledState !== !buttonPressed) {
      console.warn(
        `💡 LED Logic Mismatch: DB_Button=${buttonPressed}, LED=${ledState}, Expected=${!buttonPressed}`
      );
    }
  } catch (error) {
    console.error("❌ Errore aggiornamento status bar:", error);
  }
}

function updateSystemStats(stats) {
  try {
    // Aggiorna messaggi per ora
    if (stats.messages_last_hour !== undefined) {
      const totalMessages = document.getElementById("totalMessages");
      if (totalMessages) {
        totalMessages.textContent = stats.messages_last_hour;
      }
    }

    // Aggiorna ultimo aggiornamento
    if (stats.last_update) {
      const lastUpdate = document.getElementById("lastUpdate");
      if (lastUpdate) {
        const date = new Date(stats.last_update);
        lastUpdate.textContent = date.toLocaleTimeString();
      }
    }

    // Aggiorna stato connessione
    const connectionState = document.getElementById("connectionState");
    if (connectionState) {
      connectionState.textContent =
        stats.status === "connected" ? "Connesso" : "Disconnesso";
    }

    // Calcola e aggiorna uptime
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    const uptimeElement = document.getElementById("uptime");
    if (uptimeElement) {
      uptimeElement.textContent = `${hours
        .toString()
        .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
  } catch (error) {
    console.error("❌ Errore aggiornamento statistiche sistema:", error);
  }
}

// ===========================================
// GESTIONE TABELLA DATI
// ===========================================
function refreshTable() {
  try {
    const limitSelect = document.getElementById("tableLimit");
    const limit = limitSelect ? limitSelect.value : 50;

    console.log(`📋 Caricamento tabella con ${limit} record...`);

    // Mostra loading
    showTableLoading();

    fetch(`/api/measurements?limit=${limit}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        tableData = data;
        updateTable(data);
        console.log(`✅ Tabella aggiornata con ${data.length} record`);
      })
      .catch((error) => {
        console.error("❌ Errore caricamento tabella:", error);
        showTableError(error.message);
        showNotification("Errore caricamento tabella", "error");
      });
  } catch (error) {
    console.error("❌ Errore refresh tabella:", error);
    showTableError(error.message);
  }
}

function updateTable(data) {
  const tbody = document.getElementById("tableBody");
  if (!tbody) {
    console.error("❌ Elemento tableBody non trovato");
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="11" class="loading">
                    <i class="fas fa-exclamation-triangle"></i> Nessun dato disponibile
                </td>
            </tr>
        `;
    return;
  }

  try {
    tbody.innerHTML = data
      .map((row) => {
        // LOGICA INVERTITA ANCHE PER LA TABELLA
        const invertedButtonState = !row.button_pressed;
        const buttonDisplayText = invertedButtonState ? "PREMUTO" : "LIBERO";
        const buttonCssClass = invertedButtonState ? "btn-pressed" : "";

        return `
                <tr>
                    <td>${row.time_str || "-"}</td>
                    <td>${row.date_str || "-"}</td>
                    <td class="angle-cell">${formatValue(
                      row.servo1_angle,
                      "°"
                    )}</td>
                    <td class="angle-cell">${formatValue(
                      row.servo2_angle,
                      "°"
                    )}</td>
                    <td class="angle-cell">${formatValue(
                      row.servo3_angle,
                      "°"
                    )}</td>
                    <td class="pot-cell">${formatValue(
                      row.pot1_percent,
                      "%"
                    )}</td>
                    <td class="pot-cell">${formatValue(
                      row.pot2_percent,
                      "%"
                    )}</td>
                    <td class="pot-cell">${formatValue(
                      row.pot3_percent,
                      "%"
                    )}</td>
                    <td class="${buttonCssClass}">${buttonDisplayText}</td>
                    <td class="${row.led_state ? "led-on" : ""}">${
          row.led_state ? "ACCESO" : "SPENTO"
        }</td>
                    <td>${row.servos_active_count || 0}</td>
                </tr>
            `;
      })
      .join("");
  } catch (error) {
    console.error("❌ Errore rendering tabella:", error);
    showTableError("Errore rendering dati");
  }
}

function showTableLoading() {
  const tbody = document.getElementById("tableBody");
  if (tbody) {
    tbody.innerHTML = `
            <tr>
                <td colspan="9" class="loading">
                    <i class="fas fa-spinner fa-spin"></i> Caricamento dati...
                </td>
            </tr>
        `;
  }
}

function showTableError(errorMessage = "Errore sconosciuto") {
  const tbody = document.getElementById("tableBody");
  if (tbody) {
    tbody.innerHTML = `
            <tr>
                <td colspan="9" class="loading">
                    <i class="fas fa-exclamation-triangle"></i> Errore: ${errorMessage}
                </td>
            </tr>
        `;
  }
}

function formatValue(value, suffix = "") {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    return Math.round(value * 10) / 10 + suffix;
  }
  return value + suffix;
}

function exportTable() {
  if (!tableData || tableData.length === 0) {
    showNotification("Nessun dato da esportare", "warning");
    return;
  }

  try {
    const headers = [
      "Servo1_Angle",
      "Servo2_Angle",
      "Servo3_Angle",
      "Pot1_Percent",
      "Pot2_Percent",
      "Pot3_Percent",
      "Button_Pressed",
      "LED_State",
      "Servos_Active",
    ];

    // Export anche i dati campionati (senza filtri aggiuntivi)
    const exportData = tableData;

    const csvData = [
      headers.join(","),
      ...exportData.map((row) =>
        [
          row.servo1_angle || 0,
          row.servo2_angle || 0,
          row.servo3_angle || 0,
          row.pot1_percent || 0,
          row.pot2_percent || 0,
          row.pot3_percent || 0,
          row.button_pressed ? 1 : 0,
          row.led_state ? 1 : 0,
          row.servos_active_count || 0,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `servo_data_${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-")}.csv`
    );
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log("📄 Dati esportati in CSV");
    showNotification(
      `Esportati ${exportData.length} record campionati (30s)`,
      "success"
    );
  } catch (error) {
    console.error("❌ Errore export CSV:", error);
    showNotification("Errore durante l'export", "error");
  }
}

// ===========================================
// NAVIGAZIONE E SEZIONI
// ===========================================
function showSection(sectionId) {
  try {
    // Nascondi tutte le sezioni
    document.querySelectorAll(".content-section").forEach((section) => {
      section.classList.remove("active");
    });

    // Mostra la sezione selezionata
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add("active");
    } else {
      console.error(`❌ Sezione '${sectionId}' non trovata`);
      return;
    }

    // Aggiorna menu di navigazione
    document.querySelectorAll(".nav-menu a").forEach((link) => {
      link.classList.remove("active");
    });

    const activeLink = document.querySelector(
      `[onclick="showSection('${sectionId}')"]`
    );
    if (activeLink) {
      activeLink.classList.add("active");
    }

    // Azioni specifiche per sezione
    if (sectionId === "table") {
      refreshTable();
    } else if (sectionId === "charts") {
      // Ridimensiona grafici se necessario
      setTimeout(() => {
        if (servoChart) servoChart.resize();
        if (potChart) potChart.resize();
      }, 100);
    }

    console.log(`📍 Sezione attiva: ${sectionId}`);
  } catch (error) {
    console.error("❌ Errore cambio sezione:", error);
  }
}

// ===========================================
// EVENT LISTENERS
// ===========================================
function initializeEventListeners() {
  try {
    // Auto refresh toggle
    const autoRefreshToggle = document.getElementById("autoRefresh");
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener("change", function (e) {
        autoRefreshEnabled = e.target.checked;
        if (autoRefreshEnabled) {
          startAutoRefresh();
        } else {
          stopAutoRefresh();
        }
        console.log(`🔄 Auto refresh: ${autoRefreshEnabled ? "ON" : "OFF"}`);
        showNotification(
          `Auto refresh ${autoRefreshEnabled ? "attivato" : "disattivato"}`,
          "info"
        );
      });
    }

    // Refresh interval
    const refreshIntervalSelect = document.getElementById("refreshInterval");
    if (refreshIntervalSelect) {
      refreshIntervalSelect.addEventListener("change", function (e) {
        refreshInterval = parseInt(e.target.value) * 1000;
        if (autoRefreshEnabled) {
          startAutoRefresh(); // Riavvia con nuovo intervallo
        }
        console.log(`⏱️ Intervallo aggiornamento: ${refreshInterval / 1000}s`);
        showNotification(
          `Intervallo aggiornato: ${refreshInterval / 1000}s`,
          "info"
        );
      });
    }

    // Dark theme toggle
    const darkThemeToggle = document.getElementById("darkTheme");
    if (darkThemeToggle) {
      darkThemeToggle.addEventListener("change", function (e) {
        document.body.classList.toggle("dark-theme", e.target.checked);
        console.log(`🌙 Tema scuro: ${e.target.checked ? "ON" : "OFF"}`);
        showNotification(
          `Tema ${e.target.checked ? "scuro" : "chiaro"} attivato`,
          "info"
        );
      });
    }

    console.log("👂 Event listeners inizializzati");
  } catch (error) {
    console.error("❌ Errore inizializzazione event listeners:", error);
  }
}

// ===========================================
// AUTO REFRESH
// ===========================================
function startAutoRefresh() {
  stopAutoRefresh(); // Ferma il timer precedente se esiste

  if (autoRefreshEnabled) {
    autoRefreshTimer = setInterval(() => {
      try {
        const activeSection = document.querySelector(".content-section.active");
        if (activeSection && activeSection.id === "table") {
          refreshTable();
        }
      } catch (error) {
        console.error("❌ Errore auto refresh:", error);
      }
    }, refreshInterval);

    console.log(`🔄 Auto refresh avviato (${refreshInterval / 1000}s)`);
  }
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
    console.log("⏹️ Auto refresh fermato");
  }
}

// ===========================================
// CARICAMENTO DATI INIZIALI
// ===========================================
function loadInitialData() {
  console.log("📦 Caricamento dati iniziali...");

  // Carica dati servo iniziali
  fetch("/api/latest")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      updateServoDisplay(data);
      console.log("✅ Dati servo iniziali caricati");
    })
    .catch((error) => {
      console.error("❌ Errore caricamento dati servo iniziali:", error);
      showNotification("Errore caricamento dati iniziali", "warning");
    });

  // Carica statistiche iniziali
  fetch("/api/stats").then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  });
  // Carica statistiche iniziali
  fetch("/api/stats")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((stats) => {
      updateSystemStats(stats);
      console.log("✅ Statistiche iniziali caricate");
    })
    .catch((error) => {
      console.error("❌ Errore caricamento statistiche iniziali:", error);
    });
}

// ===========================================
// SISTEMA NOTIFICHE
// ===========================================
function showNotification(message, type = "info") {
  try {
    // Rimuovi notifiche esistenti
    const existingNotifications = document.querySelectorAll(".notification");
    existingNotifications.forEach((notif) => {
      if (notif.parentNode) {
        notif.parentNode.removeChild(notif);
      }
    });

    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;

    // Icone per diversi tipi
    const icons = {
      success: "fa-check-circle",
      error: "fa-exclamation-circle",
      warning: "fa-exclamation-triangle",
      info: "fa-info-circle",
    };

    const icon = icons[type] || icons["info"];

    notification.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="closeNotification(this)">
                <i class="fas fa-times"></i>
            </button>
        `;

    // Stili CSS inline per la notifica
    notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            border-left: 4px solid ${getNotificationColor(type)};
            backdrop-filter: blur(10px);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 300px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            font-size: 14px;
        `;

    notification.querySelector(".notification-close").style.cssText = `
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 5px;
            margin-left: auto;
            opacity: 0.7;
            transition: opacity 0.2s ease;
        `;

    document.body.appendChild(notification);

    // Animazione di entrata
    setTimeout(() => {
      notification.style.transform = "translateX(0)";
    }, 100);

    // Auto-close dopo 5 secondi
    setTimeout(() => {
      closeNotification(notification.querySelector(".notification-close"));
    }, 5000);
  } catch (error) {
    console.error("❌ Errore creazione notifica:", error);
  }
}

function getNotificationColor(type) {
  const colors = {
    success: "#4CAF50",
    error: "#f44336",
    warning: "#ff9800",
    info: "#2196f3",
  };
  return colors[type] || colors["info"];
}

function closeNotification(closeButton) {
  try {
    const notification = closeButton.closest(".notification");
    if (notification) {
      notification.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  } catch (error) {
    console.error("❌ Errore chiusura notifica:", error);
  }
}

// ===========================================
// UTILITY E HELPER FUNCTIONS
// ===========================================
function safeGetElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`⚠️ Elemento con ID '${id}' non trovato`);
  }
  return element;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ===========================================
// GESTIONE ERRORI GLOBALE
// ===========================================
window.addEventListener("error", function (event) {
  console.error("❌ Errore JavaScript globale:", event.error);
  showNotification("Si è verificato un errore imprevisto", "error");
});

window.addEventListener("unhandledrejection", function (event) {
  console.error("❌ Promise rejection non gestita:", event.reason);
  showNotification("Errore di connessione", "error");
});

// ===========================================
// RESIZE HANDLER PER GRAFICI
// ===========================================
window.addEventListener(
  "resize",
  debounce(function () {
    try {
      if (servoChart) servoChart.resize();
      if (potChart) potChart.resize();
      console.log("📐 Grafici ridimensionati");
    } catch (error) {
      console.error("❌ Errore ridimensionamento grafici:", error);
    }
  }, 250)
);

// ===========================================
// API DEBUG E DEVELOPMENT
// ===========================================
window.debugDashboard = {
  // Dati
  getServoData: () => servoData,
  getPotData: () => potData,
  getTableData: () => tableData,

  // Controlli
  clearCharts: clearCharts,
  refreshTable: refreshTable,
  showSection: showSection,
  updateConnectionStatus: updateConnectionStatus,

  // Notifiche
  showNotification: showNotification,

  // Statistiche
  getStats: () => ({
    autoRefreshEnabled,
    refreshInterval,
    startTime,
    uptime: Date.now() - startTime,
    chartsInitialized: !!(servoChart && potChart),
    socketConnected: socket ? socket.connected : false,
  }),

  // Test functions
  testServoUpdate: (
    testData = {
      servo1_angle: 90,
      servo2_angle: 45,
      servo3_angle: 135,
      pot1_percent: 50,
      pot2_percent: 25,
      pot3_percent: 75,
      button_pressed: 1,
      led_state: 0,
      servos_active_count: 2,
    }
  ) => {
    console.log("🧪 Test data (button_pressed=1 dovrebbe mostrare LIBERO):");
    updateServoDisplay(testData);
    updateCharts(testData);
  },

  testNotifications: () => {
    showNotification("Test notification - Info", "info");
    setTimeout(
      () => showNotification("Test notification - Success", "success"),
      1000
    );
    setTimeout(
      () => showNotification("Test notification - Warning", "warning"),
      2000
    );
    setTimeout(
      () => showNotification("Test notification - Error", "error"),
      3000
    );
  },
};

// ===========================================
// FUNZIONI ESPOSTE GLOBALMENTE
// ===========================================
window.showSection = showSection;
window.clearCharts = clearCharts;
window.refreshTable = refreshTable;
window.exportTable = exportTable;
window.closeNotification = closeNotification;

// ===========================================
// CLEANUP AL CHIUSURA PAGINA
// ===========================================
window.addEventListener("beforeunload", function () {
  try {
    stopAutoRefresh();
    if (socket) {
      socket.disconnect();
    }
    console.log("🧹 Cleanup completato");
  } catch (error) {
    console.error("❌ Errore durante cleanup:", error);
  }
});

// ===========================================
// LOG FINALE
// ===========================================
console.log("🎛️ Dashboard JavaScript caricato completamente");
console.log("🔧 Usa window.debugDashboard per funzioni di debug");
console.log("📊 Grafici disponibili:", {
  servo: !!window.servoChart,
  pot: !!window.potChart,
});

// Export per moduli (se necessario)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    updateServoDisplay,
    updateCharts,
    showSection,
    refreshTable,
    showNotification,
  };
}
