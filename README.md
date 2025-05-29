# 🎛️ PanApp - Servo Controller Dashboard

**Sistema di controllo real-time per 3 servo motori tramite micro:bit con dashboard web interattiva**

## 📋 Panoramica

PanApp è un sistema completo di controllo servo che utilizza due micro:bit (trasmittente e ricevente) per controllare 3 servo motori tramite potenziometri e un pulsante. Include una dashboard web real-time per monitoraggio e analisi dei dati.

### 🎯 Caratteristiche Principali

- **Controllo Wireless**: Comunicazione radio tra due micro:bit
- **3 Servo Motori**: Controllo preciso tramite potenziometri
- **Dashboard Web**: Interfaccia real-time con grafici e tabelle
- **Data Logger**: Salvataggio automatico su database InfluxDB
- **Monitoraggio Real-time**: WebSocket per aggiornamenti istantanei
- **Export Dati**: Esportazione CSV delle misurazioni

## 🏗️ Architettura del Sistema

```
┌─────────────────┐    Radio    ┌─────────────────┐
│   TRASMITTENTE  │ ◄--------► │    RICEVENTE    │
│                 │             │                 │
│ • 3 Potenziometri│             │ • 3 Servo Motori│
│ • 1 Pulsante    │             │ • 1 LED         │
│ • micro:bit     │             │ • micro:bit     │
└─────────────────┘             └─────────────────┘
                                         │
                                         │ Serial USB
                                         ▼
                                ┌─────────────────┐
                                │   PC/SERVER     │
                                │                 │
                                │ • Data Logger   │
                                │ • InfluxDB      │
                                │ • Flask Web App │
                                │ • Dashboard     │
                                └─────────────────┘
```

## 🛠️ Componenti Hardware

### Scheda Trasmittente
- **micro:bit** (trasmettitore)
- **3 Potenziometri** (PIN0, PIN1, PIN2)
- **1 Pulsante** (PIN5)
- **Alimentazione**: 3V e GND

### Scheda Ricevente
- **micro:bit** (ricevitore)
- **3 Servo Motori** (PIN8, PIN12, PIN16)
- **1 LED** (PIN14 con resistenza)
- **Alimentazione**: 3V e GND per servo e LED

## 🔧 Schema di Collegamento

### Trasmittente (Potenziometri + Pulsante)
```
PIN0  ──► Potenziometro 1 (centro)
PIN1  ──► Potenziometro 2 (centro)
PIN2  ──► Potenziometro 3 (centro)
PIN5  ──► Pulsante (con pull-down)
3V    ──► Alimentazione potenziometri/pulsante
GND   ──► Terra comune
```

### Ricevente (Servo + LED)
```
PIN8  ──► Servo 1 (filo segnale giallo/bianco)
PIN12 ──► Servo 2 (filo segnale giallo/bianco)
PIN16 ──► Servo 3 (filo segnale giallo/bianco)
PIN14 ──► LED (anodo, con resistenza 220Ω)
3V    ──► Alimentazione servo/LED (filo rosso)
GND   ──► Terra servo/LED (filo nero/marrone)
```

## 💻 Setup Software

### Prerequisiti

- **Python 3.8+**
- **InfluxDB 2.x**
- **micro:bit con MicroPython**

### 1. Installazione InfluxDB

**Windows/Mac/Linux:**
```bash
# Scarica InfluxDB 2.x dal sito ufficiale
# Avvia InfluxDB su http://localhost:8086
# Crea organizzazione: microbit-org
# Crea bucket: PAN
# Genera token di accesso
```

### 2. Programmazione micro:bit

**Trasmittente:**
```python
# Carica transmitter.py sul primo micro:bit
# Collegare potenziometri e pulsante come da schema
```

**Ricevente:**
```python
# Carica receiver.py sul secondo micro:bit  
# Collegare servo motori e LED come da schema
```

### 3. Installazione Python Dependencies

```bash
pip install flask flask-socketio influxdb-client pyserial
```

### 4. Configurazione Parametri

Modifica in `data_logger_script.py` e `app.py`:

```python
# Configurazione InfluxDB
INFLUXDB_URL = "http://localhost:8086"
INFLUXDB_TOKEN = "il_tuo_token_qui"
INFLUXDB_ORG = "microbit-org"
INFLUXDB_BUCKET = "PAN"

# Configurazione Porta Seriale
SERIAL_PORT = "COM6"  # Windows: COM6, Linux: /dev/ttyACM0
BAUD_RATE = 115200
```

## 🚀 Avvio del Sistema

### 1. Avvia InfluxDB
```bash
# Assicurati che InfluxDB sia in esecuzione su porta 8086
```

### 2. Avvia Data Logger
```bash
cd PanApp
python data_logger_script.py
```

### 3. Avvia Dashboard Web
```bash
cd PanApp
python app.py
```

### 4. Accedi alla Dashboard
```
http://localhost:5000
```

## 📊 Funzionalità Dashboard

### Overview
- **Display Real-time**: Angoli servo, percentuali potenziometri
- **Indicatori di Stato**: Servo attivi, pulsante, LED
- **Barre di Progresso**: Visualizzazione posizione servo

### Grafici
- **Grafico Angoli Servo**: Andamento temporale angoli (0°-180°)
- **Grafico Potenziometri**: Andamento temporale percentuali (0%-100%)
- **Aggiornamento Real-time**: Via WebSocket ogni 2 secondi

### Tabella Dati
- **Storico Misurazioni**: Ultimi 25/50/100 record campionati
- **Export CSV**: Esportazione dati per analisi esterna
- **Aggiornamento Automatico**: Configurabile da 1-10 secondi

### Impostazioni
- **Auto-refresh**: On/Off aggiornamento automatico
- **Intervallo Refresh**: 1, 2, 5, 10 secondi
- **Statistiche Sistema**: Uptime, messaggi/ora, connessione

## 📡 Protocollo Comunicazione

### Formato Messaggio Radio
```
TX: P1=512,P2=300,P3=800,BTN=1
RX: P1=512 P2=300 P3=800 BTN=1 → A1=90° A2=135° A3=45° LED=0
```

### Conversioni
- **Potenziometri**: 0-1023 → limitato a 512 per sicurezza
- **Angoli Servo**: 180° - (pot_value/512) × 180°
- **PWM Servo**: (angle/180) × (128-26) + 26
- **LED**: Invertito rispetto al pulsante (logica inversa)

## 🗄️ Struttura Database

### Measurement: `servo_controller`

**Tag `type=servo_system`:**
- `pot1_raw`, `pot2_raw`, `pot3_raw`: Valori grezzi potenziometri
- `pot1_percent`, `pot2_percent`, `pot3_percent`: Percentuali calcolate
- `servo1_angle`, `servo2_angle`, `servo3_angle`: Angoli servo
- `servo1_pwm`, `servo2_pwm`, `servo3_pwm`: Valori PWM
- `servos_active_count`: Numero servo attivi

**Tag `type=controls`:**
- `button_pressed`: Stato pulsante (0/1)
- `led_state`: Stato LED (0/1)

## 🔧 API Endpoints

```http
GET /api/latest          # Ultimi dati servo
GET /api/history?hours=1 # Storico grafici
GET /api/measurements    # Dati tabella
GET /api/stats          # Statistiche sistema
GET /api/debug          # Debug dati raw
```

## 🎨 Personalizzazione

### Colori Servo
```css
--servo1-color: #ff6b6b;  /* Rosso */
--servo2-color: #4ecdc4;  /* Turchese */
--servo3-color: #ffd93d;  /* Giallo */
```

### Intervalli Aggiornamento
```javascript
refreshInterval = 2000;    // 2 secondi default
maxDataPoints = 50;        // Punti grafico
```

## 🛡️ Sicurezza e Limitazioni

- **Potenziometri**: Limitati a 512/1023 per sicurezza servo
- **Timeout Connessione**: 2 secondi, poi servo a 0°
- **Validazione Dati**: Parsing robusto messaggi radio
- **Error Handling**: Gestione errori seriale e database

## 🐛 Troubleshooting

### Problema: Servo non si muovono
```bash
# Verifica alimentazione servo (5V consigliati)
# Controlla collegamenti PWM
# Verifica comunicazione radio (display micro:bit)
```

### Problema: Dashboard non si connette
```bash
# Verifica porta seriale corretta
# Controlla che InfluxDB sia avviato
# Verifica token InfluxDB valido
```

### Problema: Dati non arrivano
```bash
# Controlla console data logger
# Verifica formato messaggi seriali
# Controlla canale radio (42) su entrambi micro:bit
```

## 📈 Monitoraggio Performance

### Metriche Sistema
- **Messaggi/Ora**: Frequenza aggiornamenti
- **Latenza Radio**: ~100ms tra trasmissione e ricezione
- **Throughput Database**: ~10-20 punti/secondo
- **WebSocket**: Aggiornamenti ogni 2 secondi

## 🔄 Versioning

- **v1.0**: Sistema base con 3 servo + dashboard
- **Futuro**: Controllo PID, calibrazione automatica, app mobile

## 📝 Licenza

MIT License - Vedi file LICENSE per dettagli.

## 👨‍💻 Autore

**Danilo Palladino** (2025)