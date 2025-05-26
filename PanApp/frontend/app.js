// app.js
const API_BASE_URL = 'http://localhost:7001/api'; // CORREZIONE: Porta 7001 invece di 5000

let potRawChart, servoAngleChart, buttonLedChart, systemStatsChart;

document.addEventListener('DOMContentLoaded', () => {
    setupCharts();
    loadAllData();

    document.getElementById('refreshButton').addEventListener('click', loadAllData);
});

function setupCharts() {
    // Grafico Potenziometri Raw
    const potRawCtx = document.getElementById('potRawChart').getContext('2d');
    potRawChart = new Chart(potRawCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Potenziometro 1 (Raw)', data: [], borderColor: 'rgb(255, 99, 132)', tension: 0.1 },
                { label: 'Potenziometro 2 (Raw)', data: [], borderColor: 'rgb(54, 162, 235)', tension: 0.1 },
                { label: 'Potenziometro 3 (Raw)', data: [], borderColor: 'rgb(255, 206, 86)', tension: 0.1 }
            ]
        },
        options: { scales: { x: { type: 'time', time: { unit: 'second' }, title: { display: true, text: 'Tempo' } }, y: { title: { display: true, text: 'Valore Raw (0-1023)' }, beginAtZero: true } } }
    });

    // Grafico Angoli Servo
    const servoAngleCtx = document.getElementById('servoAngleChart').getContext('2d');
    servoAngleChart = new Chart(servoAngleCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Servo 1 (Angle)', data: [], borderColor: 'rgb(75, 192, 192)', tension: 0.1 },
                { label: 'Servo 2 (Angle)', data: [], borderColor: 'rgb(153, 102, 255)', tension: 0.1 },
                { label: 'Servo 3 (Angle)', data: [], borderColor: 'rgb(201, 203, 207)', tension: 0.1 }
            ]
        },
        options: { scales: { x: { type: 'time', time: { unit: 'second' }, title: { display: true, text: 'Tempo' } }, y: { title: { display: true, text: 'Angolo (°)' }, beginAtZero: true, max: 180 } } }
    });

    // Grafico Stato Pulsante e LED
    const buttonLedCtx = document.getElementById('buttonLedChart').getContext('2d');
    buttonLedChart = new Chart(buttonLedCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Pulsante (0=rilasciato, 1=premuto)', data: [], borderColor: 'rgb(255, 159, 64)', tension: 0.1, stepped: true },
                { label: 'LED (0=off, 1=on)', data: [], borderColor: 'rgb(255, 255, 0)', tension: 0.1, stepped: true }
            ]
        },
        options: { scales: { x: { type: 'time', time: { unit: 'second' }, title: { display: true, text: 'Tempo' } }, y: { title: { display: true, text: 'Stato' }, min: -0.1, max: 1.1, ticks: { stepSize: 1, callback: function(value) { if (value === 0) return 'OFF'; if (value === 1) return 'ON'; return ''; } } } } }
    });

    // Grafico Statistiche di Sistema
    const systemStatsCtx = document.getElementById('systemStatsChart').getContext('2d');
    systemStatsChart = new Chart(systemStatsCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Angolo Medio Servo', data: [], borderColor: 'rgb(0, 123, 255)', tension: 0.1 },
                { label: 'Totale Potenziometri Raw', data: [], borderColor: 'rgb(40, 167, 69)', tension: 0.1 }
            ]
        },
        options: { scales: { x: { type: 'time', time: { unit: 'second' }, title: { display: true, text: 'Tempo' } }, y: { title: { display: true, text: 'Valore' }, beginAtZero: true } } }
    });
}

async function loadAllData() {
    updateStatus('Caricamento dati...', false);
    try {
        console.log('Caricamento dati iniziato...');
        await Promise.all([
            fetchPotentiometerData(),
            fetchServoData(),
            fetchButtonLedData(),
            fetchSystemStatsData()
        ]);
        updateStatus('Dati caricati con successo!', false);
        console.log('Tutti i dati caricati con successo');
    } catch (error) {
        updateStatus('Errore durante il caricamento dei dati!', true);
        console.error("Errore generale nel caricamento dati:", error);
    }
}

async function fetchPotentiometerData() {
    console.log('Caricamento dati potenziometri...');
    try {
        const response = await axios.get(`${API_BASE_URL}/data/potentiometer`);
        console.log('Dati potenziometri ricevuti:', response.data);
        
        const allPotData = response.data;

        // Filtra per pot_id se esiste, altrimenti usa i field names
        const pot1Data = allPotData.filter(d => d.pot_id === 'pot1' || d.field === 'pot1_raw').sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const pot2Data = allPotData.filter(d => d.pot_id === 'pot2' || d.field === 'pot2_raw').sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const pot3Data = allPotData.filter(d => d.pot_id === 'pot3' || d.field === 'pot3_raw').sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        console.log('Pot1 data:', pot1Data.length, 'records');
        console.log('Pot2 data:', pot2Data.length, 'records');
        console.log('Pot3 data:', pot3Data.length, 'records');

        potRawChart.data.datasets[0].data = pot1Data.map(d => ({x: new Date(d.timestamp), y: d.value || d.raw_value}));
        potRawChart.data.datasets[1].data = pot2Data.map(d => ({x: new Date(d.timestamp), y: d.value || d.raw_value}));
        potRawChart.data.datasets[2].data = pot3Data.map(d => ({x: new Date(d.timestamp), y: d.value || d.raw_value}));
        potRawChart.update();
        
        console.log('Grafico potenziometri aggiornato');
    } catch (error) {
        console.error("Errore nel recupero dati potenziometri:", error);
        throw error;
    }
}

async function fetchServoData() {
    console.log('Caricamento dati servo...');
    try {
        // Prova prima a prendere tutti i dati servo
        const response = await axios.get(`${API_BASE_URL}/data/servo`);
        console.log('Dati servo ricevuti:', response.data);
        
        const allServoData = response.data;
        
        // Filtra per servo_id
        const servo1Data = allServoData.filter(d => d.servo_id === 'servo1' || d.field === 'servo1_angle').sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
        const servo2Data = allServoData.filter(d => d.servo_id === 'servo2' || d.field === 'servo2_angle').sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
        const servo3Data = allServoData.filter(d => d.servo_id === 'servo3' || d.field === 'servo3_angle').sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

        console.log('Servo1 data:', servo1Data.length, 'records');
        console.log('Servo2 data:', servo2Data.length, 'records');
        console.log('Servo3 data:', servo3Data.length, 'records');

        servoAngleChart.data.datasets[0].data = servo1Data.map(d => ({x: new Date(d.timestamp), y: d.value || d.angle}));
        servoAngleChart.data.datasets[1].data = servo2Data.map(d => ({x: new Date(d.timestamp), y: d.value || d.angle}));
        servoAngleChart.data.datasets[2].data = servo3Data.map(d => ({x: new Date(d.timestamp), y: d.value || d.angle}));
        servoAngleChart.update();
        
        console.log('Grafico servo aggiornato');
    } catch (error) {
        console.error("Errore nel recupero dati servo:", error);
        // Fallback: prova con le chiamate separate
        try {
            console.log('Tentativo con chiamate separate...');
            const [response1, response2, response3] = await Promise.all([
                axios.get(`${API_BASE_URL}/data/by_tag/servo/servo_id/servo1`),
                axios.get(`${API_BASE_URL}/data/by_tag/servo/servo_id/servo2`),
                axios.get(`${API_BASE_URL}/data/by_tag/servo/servo_id/servo3`)
            ]);

            const servo1Data = response1.data.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
            const servo2Data = response2.data.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
            const servo3Data = response3.data.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

            servoAngleChart.data.datasets[0].data = servo1Data.map(d => ({x: new Date(d.timestamp), y: d.value || d.angle}));
            servoAngleChart.data.datasets[1].data = servo2Data.map(d => ({x: new Date(d.timestamp), y: d.value || d.angle}));
            servoAngleChart.data.datasets[2].data = servo3Data.map(d => ({x: new Date(d.timestamp), y: d.value || d.angle}));
            servoAngleChart.update();
        } catch (fallbackError) {
            console.error("Errore anche nel fallback servo:", fallbackError);
            throw fallbackError;
        }
    }
}

async function fetchButtonLedData() {
    console.log('Caricamento dati button/led...');
    try {
        const response = await axios.get(`${API_BASE_URL}/data/controls`);
        console.log('Dati controls ricevuti:', response.data);
        
        const data = response.data.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Gestisci i dati che potrebbero essere in field separati
        const buttonData = data.filter(d => d.field === 'button_state' || d.button_state !== undefined);
        const ledData = data.filter(d => d.field === 'led_state' || d.led_state !== undefined);

        buttonLedChart.data.datasets[0].data = buttonData.map(d => ({x: new Date(d.timestamp), y: d.value || d.button_state}));
        buttonLedChart.data.datasets[1].data = ledData.map(d => ({x: new Date(d.timestamp), y: d.value || d.led_state}));
        buttonLedChart.update();
        
        console.log('Grafico button/led aggiornato');
    } catch (error) {
        console.error("Errore nel recupero dati button/led:", error);
        throw error;
    }
}

async function fetchSystemStatsData() {
    console.log('Caricamento dati system stats...');
    try {
        const response = await axios.get(`${API_BASE_URL}/data/system_stats`);
        console.log('Dati system_stats ricevuti:', response.data);
        
        const data = response.data.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Filtra per field specifici
        const avgServoData = data.filter(d => d.field === 'average_servo_angle');
        const totalPotData = data.filter(d => d.field === 'total_potentiometer_raw');

        systemStatsChart.data.datasets[0].data = avgServoData.map(d => ({x: new Date(d.timestamp), y: d.value || d.average_servo_angle}));
        systemStatsChart.data.datasets[1].data = totalPotData.map(d => ({x: new Date(d.timestamp), y: d.value || d.total_potentiometer_raw}));
        systemStatsChart.update();
        
        console.log('Grafico system stats aggiornato');
    } catch (error) {
        console.error("Errore nel recupero dati statistiche di sistema:", error);
        throw error;
    }
}

function updateStatus(message, isError = false) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.style.color = isError ? 'red' : 'green';
}