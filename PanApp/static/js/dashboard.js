let socket;
let servoChart, potChart;
let servoData = { labels: [], data1: [], data2: [], data3: [] };
let potData = { labels: [], data1: [], data2: [], data3: [] };
let tableData = [];
let autoRefreshEnabled = true;
let refreshInterval = 2000;
let startTime = Date.now();
let autoRefreshTimer;

document.addEventListener("DOMContentLoaded", function () {
  console.log("Inizializzazione Dashboard...");

  try {
    initializeSocket();
    initializeCharts();
    initializeEventListeners();
    showSection("overview");
    loadInitialData();
    startAutoRefresh();

    console.log("Dashboard inizializzata correttamente");
  } catch (error) {
    console.error("Errore inizializzazione:", error);
    showNotification(
      "Errore durante l'inizializzazione della dashboard",
      "error"
    );
  }
});

function initializeSocket() {
  try {
    socket = io();

    socket.on("connect", function () {
      updateConnectionStatus(true);
      console.log("WebSocket connesso");
      showNotification("Connesso al server", "success");
    });

    socket.on("disconnect", function () {
      updateConnectionStatus(false);
      console.log("WebSocket disconnesso");
      showNotification("Connessione persa", "error");
    });

    socket.on("data_update", function (response) {
      try {
        const data = response.servo_data;
        const stats = response.system_stats;

        if (data) {
          updateServoDisplay(data);
          updateCharts(data);
          document.querySelectorAll(".servo-card").forEach((card) => {
            card.classList.add("data-update");
            setTimeout(() => card.classList.remove("data-update"), 300);
          });
        }

        if (stats) {
          updateSystemStats(stats);
        }
      } catch (error) {
        console.error("Errore processamento dati WebSocket:", error);
      }
    });

    socket.on("status", function (data) {
      console.log("Status WebSocket:", data.message);
    });

    socket.on("error", function (error) {
      console.error("Errore WebSocket:", error);
      updateConnectionStatus(false);
    });
  } catch (error) {
    console.error("Errore inizializzazione WebSocket:", error);
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

function initializeCharts() {
  try {

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      animation: {
        duration: 0,
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

    console.log(" Grafici inizializzati correttamente");
  } catch (error) {
    console.error(" Errore inizializzazione grafici:", error);
    showNotification("Errore inizializzazione grafici", "error");
  }
}

function updateCharts(data) {
  if (!data || !servoChart || !potChart) return;

  try {
    const now = new Date().toLocaleTimeString();

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

    servoData.labels.push(now);
    servoData.data1.push(data.servo1_angle || 0);
    servoData.data2.push(data.servo2_angle || 0);
    servoData.data3.push(data.servo3_angle || 0);

    potData.labels.push(now);
    potData.data1.push(data.pot1_percent || 0);
    potData.data2.push(data.pot2_percent || 0);
    potData.data3.push(data.pot3_percent || 0);

    servoChart.data.labels = servoData.labels;
    servoChart.data.datasets[0].data = servoData.data1;
    servoChart.data.datasets[1].data = servoData.data2;
    servoChart.data.datasets[2].data = servoData.data3;
    servoChart.update("none");

    potChart.data.labels = potData.labels;
    potChart.data.datasets[0].data = potData.data1;
    potChart.data.datasets[1].data = potData.data2;
    potChart.data.datasets[2].data = potData.data3;
    potChart.update("none");
  } catch (error) {
    console.error(" Errore aggiornamento grafici:", error);
  }
}

function clearCharts() {
  try {
    servoData = { labels: [], data1: [], data2: [], data3: [] };
    potData = { labels: [], data1: [], data2: [], data3: [] };

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

    console.log(" Grafici puliti");
    showNotification("Grafici puliti", "info");
  } catch (error) {
    console.error(" Errore pulizia grafici:", error);
  }
}

function updateServoDisplay(data) {
  if (!data) {
    console.warn(" Nessun dato ricevuto per aggiornamento display");
    return;
  }

  try {
    console.log(" Aggiornamento display servo con:", data);

    for (let i = 1; i <= 3; i++) {
      updateSingleServo(i, data);
    }

    updateStatusBar(data);
  } catch (error) {
    console.error(" Errore aggiornamento display servo:", error);
  }
}

function updateSingleServo(servoNum, data) {
  try {
    const angle = data[`servo${servoNum}_angle`] || 0;
    const anglePercent = data[`servo${servoNum}_angle_percent`] || 0;
    const potPercent = data[`pot${servoNum}_percent`] || 0;
    const pwm = data[`servo${servoNum}_pwm`] || 26;
    const isActive = data[`servo${servoNum}_active`] || 0;

    const angleElement = document.getElementById(`angle${servoNum}`);
    const potElement = document.getElementById(`pot${servoNum}`);
    const pwmElement = document.getElementById(`pwm${servoNum}`);

    if (angleElement) angleElement.textContent = Math.round(angle);
    if (potElement) potElement.textContent = Math.round(potPercent);
    if (pwmElement) pwmElement.textContent = pwm;

    const progressFill = document.getElementById(`progress${servoNum}`);
    const progressThumb = document.getElementById(`thumb${servoNum}`);

    if (progressFill) {
      progressFill.style.width = `${anglePercent}%`;
    }

    if (progressThumb) {
      progressThumb.style.left = `calc(${anglePercent}% - 8px)`; 
    }

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
    console.error(` Errore aggiornamento servo ${servoNum}:`, error);
  }
}

function updateStatusBar(data) {
  try {

    const activeServos = data.servos_active_count || 0;
    const activeServosElement = document.getElementById("activeServos");
    if (activeServosElement) {
      activeServosElement.textContent = activeServos;
    }

    const buttonPressed = data.button_pressed;
    const buttonStatus = document.getElementById("buttonStatus");
    const buttonCard = document.getElementById("buttonCard");

    if (buttonStatus && buttonCard) {

      const invertedButtonState = !buttonPressed;
      buttonStatus.textContent = invertedButtonState ? "PREMUTO" : "LIBERO";

      if (invertedButtonState) {
        buttonCard.classList.add("pressed");
      } else {
        buttonCard.classList.remove("pressed");
      }
    }

    const ledState = data.led_state;
    const ledStatus = document.getElementById("ledStatus");
    const ledCard = document.getElementById("ledCard");

    if (ledStatus && ledCard) {
      const expectedLedState = !buttonPressed;
      const displayLedState = ledState ? "ACCESO" : "SPENTO";

      if (ledState === expectedLedState) {
        ledStatus.textContent = displayLedState;
        if (ledState) {
          ledCard.classList.add("on");
        } else {
          ledCard.classList.remove("on");
        }
      } else {
        console.warn(
          "Logica LED invertita nel database - correzione applicata"
        );
        ledStatus.textContent = expectedLedState ? "ACCESO" : "SPENTO";
        if (expectedLedState) {
          ledCard.classList.add("on");
        } else {
          ledCard.classList.remove("on");
        }
      }
    }

    const ledPhysicalState = ledState ? "ACCESO" : "SPENTO";
    const buttonPhysicalState = buttonPressed ? "DB_PRESSED" : "DB_FREE";
    const buttonDisplayState = !buttonPressed ? "SHOW_PRESSED" : "SHOW_FREE";
    const expectedState = !buttonPressed ? "ACCESO" : "SPENTO";

    console.log(
      `Status: Button_DB=${buttonPhysicalState}, Button_Display=${buttonDisplayState}, LED=${ledPhysicalState}, LED_Expected=${expectedState}, Active=${activeServos}`
    );


    if (ledState !== !buttonPressed) {
      console.warn(
        `LED Logic Mismatch: DB_Button=${buttonPressed}, LED=${ledState}, Expected=${!buttonPressed}`
      );
    }
  } catch (error) {
    console.error("Errore aggiornamento status bar:", error);
  }
}

function updateSystemStats(stats) {
  try {
    if (stats.messages_last_hour !== undefined) {
      const totalMessages = document.getElementById("totalMessages");
      if (totalMessages) {
        totalMessages.textContent = stats.messages_last_hour;
      }
    }

    if (stats.last_update) {
      const lastUpdate = document.getElementById("lastUpdate");
      if (lastUpdate) {
        const date = new Date(stats.last_update);
        lastUpdate.textContent = date.toLocaleTimeString();
      }
    }

    const connectionState = document.getElementById("connectionState");
    if (connectionState) {
      connectionState.textContent =
        stats.status === "connected" ? "Connesso" : "Disconnesso";
    }


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
    console.error("Errore aggiornamento statistiche sistema:", error);
  }
}

function refreshTable() {
  try {
    const limitSelect = document.getElementById("tableLimit");
    const limit = limitSelect ? limitSelect.value : 50;

    console.log(`Caricamento tabella con ${limit} record...`);

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
        console.log(`Tabella aggiornata con ${data.length} record`);
      })
      .catch((error) => {
        console.error("Errore caricamento tabella:", error);
        showTableError(error.message);
        showNotification("Errore caricamento tabella", "error");
      });
  } catch (error) {
    console.error("Errore refresh tabella:", error);
    showTableError(error.message);
  }
}

function updateTable(data) {
  const tbody = document.getElementById("tableBody");
  if (!tbody) {
    console.error("Elemento tableBody non trovato");
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
    console.error("Errore rendering tabella:", error);
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

    console.log("Dati esportati in CSV");
    showNotification(
      `Esportati ${exportData.length} record campionati (30s)`,
      "success"
    );
  } catch (error) {
    console.error("Errore export CSV:", error);
    showNotification("Errore durante l'export", "error");
  }
}

function showSection(sectionId) {
  try {
    document.querySelectorAll(".content-section").forEach((section) => {
      section.classList.remove("active");
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add("active");
    } else {
      console.error(`Sezione '${sectionId}' non trovata`);
      return;
    }

    document.querySelectorAll(".nav-menu a").forEach((link) => {
      link.classList.remove("active");
    });

    const activeLink = document.querySelector(
      `[onclick="showSection('${sectionId}')"]`
    );
    if (activeLink) {
      activeLink.classList.add("active");
    }

    if (sectionId === "table") {
      refreshTable();
    } else if (sectionId === "charts") {
      setTimeout(() => {
        if (servoChart) servoChart.resize();
        if (potChart) potChart.resize();
      }, 100);
    }

    console.log(`Sezione attiva: ${sectionId}`);
  } catch (error) {
    console.error("Errore cambio sezione:", error);
  }
}

function initializeEventListeners() {
  try {
    const autoRefreshToggle = document.getElementById("autoRefresh");
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener("change", function (e) {
        autoRefreshEnabled = e.target.checked;
        if (autoRefreshEnabled) {
          startAutoRefresh();
        } else {
          stopAutoRefresh();
        }
        console.log(`Auto refresh: ${autoRefreshEnabled ? "ON" : "OFF"}`);
        showNotification(
          `Auto refresh ${autoRefreshEnabled ? "attivato" : "disattivato"}`,
          "info"
        );
      });
    }

    const refreshIntervalSelect = document.getElementById("refreshInterval");
    if (refreshIntervalSelect) {
      refreshIntervalSelect.addEventListener("change", function (e) {
        refreshInterval = parseInt(e.target.value) * 1000;
        if (autoRefreshEnabled) {
          startAutoRefresh();
        }
        console.log(`Intervallo aggiornamento: ${refreshInterval / 1000}s`);
        showNotification(
          `Intervallo aggiornato: ${refreshInterval / 1000}s`,
          "info"
        );
      });
    }

    const darkThemeToggle = document.getElementById("darkTheme");
    if (darkThemeToggle) {
      darkThemeToggle.addEventListener("change", function (e) {
        document.body.classList.toggle("dark-theme", e.target.checked);
        console.log(`Tema scuro: ${e.target.checked ? "ON" : "OFF"}`);
        showNotification(
          `Tema ${e.target.checked ? "scuro" : "chiaro"} attivato`,
          "info"
        );
      });
    }

    console.log("Event listeners inizializzati");
  } catch (error) {
    console.error("Errore inizializzazione event listeners:", error);
  }
}

function startAutoRefresh() {
  stopAutoRefresh(); 

  if (autoRefreshEnabled) {
    autoRefreshTimer = setInterval(() => {
      try {
        const activeSection = document.querySelector(".content-section.active");
        if (activeSection && activeSection.id === "table") {
          refreshTable();
        }
      } catch (error) {
        console.error("Errore auto refresh:", error);
      }
    }, refreshInterval);

    console.log(`Auto refresh avviato (${refreshInterval / 1000}s)`);
  }
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
    console.log("Auto refresh fermato");
  }
}

function loadInitialData() {
  console.log("Caricamento dati iniziali...");

  fetch("/api/latest")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      updateServoDisplay(data);
      console.log("Dati servo iniziali caricati");
    })
    .catch((error) => {
      console.error("Errore caricamento dati servo iniziali:", error);
      showNotification("Errore caricamento dati iniziali", "warning");
    });

  fetch("/api/stats").then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  });
  fetch("/api/stats")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((stats) => {
      updateSystemStats(stats);
      console.log("Statistiche iniziali caricate");
    })
    .catch((error) => {
      console.error("Errore caricamento statistiche iniziali:", error);
    });
}

function showNotification(message, type = "info") {
  try {
    const existingNotifications = document.querySelectorAll(".notification");
    existingNotifications.forEach((notif) => {
      if (notif.parentNode) {
        notif.parentNode.removeChild(notif);
      }
    });

    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;

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

    setTimeout(() => {
      notification.style.transform = "translateX(0)";
    }, 100);

    setTimeout(() => {
      closeNotification(notification.querySelector(".notification-close"));
    }, 5000);
  } catch (error) {
    console.error("Errore creazione notifica:", error);
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
    console.error("Errore chiusura notifica:", error);
  }
}

function safeGetElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Elemento con ID '${id}' non trovato`);
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

window.addEventListener("error", function (event) {
  console.error("Errore JavaScript globale:", event.error);
  showNotification("Si è verificato un errore imprevisto", "error");
});

window.addEventListener(
  "resize",
  debounce(function () {
    try {
      if (servoChart) servoChart.resize();
      if (potChart) potChart.resize();
      console.log("Grafici ridimensionati");
    } catch (error) {
      console.error("Errore ridimensionamento grafici:", error);
    }
  }, 250)
);

window.debugDashboard = {
  getServoData: () => servoData,
  getPotData: () => potData,
  getTableData: () => tableData,

  clearCharts: clearCharts,
  refreshTable: refreshTable,
  showSection: showSection,
  updateConnectionStatus: updateConnectionStatus,

  showNotification: showNotification,

  getStats: () => ({
    autoRefreshEnabled,
    refreshInterval,
    startTime,
    uptime: Date.now() - startTime,
    chartsInitialized: !!(servoChart && potChart),
    socketConnected: socket ? socket.connected : false,
  }),

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
    console.log("Test data (button_pressed=1 dovrebbe mostrare LIBERO):");
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


window.showSection = showSection;
window.clearCharts = clearCharts;
window.refreshTable = refreshTable;
window.exportTable = exportTable;
window.closeNotification = closeNotification;


window.addEventListener("beforeunload", function () {
  try {
    stopAutoRefresh();
    if (socket) {
      socket.disconnect();
    }
    console.log("Cleanup completato");
  } catch (error) {
    console.error("Errore durante cleanup:", error);
  }
});

console.log("Dashboard JavaScript caricato completamente");
console.log("Usa window.debugDashboard per funzioni di debug");
console.log("Grafici disponibili:", {
  servo: !!window.servoChart,
  pot: !!window.potChart,
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    updateServoDisplay,
    updateCharts,
    showSection,
    refreshTable,
    showNotification,
  };
}
