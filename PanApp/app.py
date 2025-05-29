from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
from influxdb_client import InfluxDBClient
import json
from datetime import datetime, timedelta
import threading
import time
import logging

app = Flask(__name__)
app.config['SECRET_KEY'] = 'servo_dashboard_secret_key'
socketio = SocketIO(app, cors_allowed_origins="*")

INFLUXDB_URL = "http://localhost:8086"
INFLUXDB_TOKEN = "uhln0fzak4EBwSeChsbe8NQKj9ldoaasFiE61uIy7aQ_NtfoNZGQoHWHJY199LiZfpU0IcQIBaK64KJgVeMPgg=="
INFLUXDB_ORG = "microbit-org"
INFLUXDB_BUCKET = "PAN"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

influx_client = None
query_api = None

def initialize_influxdb():
    """Inizializza la connessione InfluxDB"""
    global influx_client, query_api
    try:
        influx_client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
        query_api = influx_client.query_api()
        logger.info("InfluxDB connesso per Flask")
        return True
    except Exception as e:
        logger.error(f"Errore connessione InfluxDB: {e}")
        return False


def get_latest_servo_data():
    """Ottiene gli ultimi dati dei servo da InfluxDB"""
    if not query_api:
        return None
    
    try:
        servo_query = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
        |> range(start: -1h)
        |> filter(fn: (r) => r["_measurement"] == "servo_controller")
        |> filter(fn: (r) => r["type"] == "servo_system")
        |> last()
        '''
        
        controls_query = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
        |> range(start: -1h)
        |> filter(fn: (r) => r["_measurement"] == "servo_controller")
        |> filter(fn: (r) => r["type"] == "controls")
        |> last()
        '''
        
        servo_result = query_api.query(servo_query)
        controls_result = query_api.query(controls_query)
        
        data = {}
        if servo_result:
            for table in servo_result:
                for record in table.records:
                    field = record.get_field()
                    value = record.get_value()
                    data[field] = value
                    data['timestamp'] = record.get_time().isoformat()
        
        if controls_result:
            for table in controls_result:
                for record in table.records:
                    field = record.get_field()
                    value = record.get_value()
                    data[field] = value
                    if 'timestamp' not in data or record.get_time().isoformat() > data['timestamp']:
                        data['timestamp'] = record.get_time().isoformat()
        
        if not data:
            return None
            
        return data
    
    except Exception as e:
        logger.error(f"Errore query InfluxDB: {e}")
        return None

def get_servo_history(hours=1):
    """Ottiene lo storico dei dati servo per i grafici"""
    if not query_api:
        return []
    
    try:
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
        |> range(start: -{hours}h)
        |> filter(fn: (r) => r["_measurement"] == "servo_controller")
        |> filter(fn: (r) => r["type"] == "servo_system")
        |> filter(fn: (r) => r["_field"] == "servo1_angle" or r["_field"] == "servo2_angle" or r["_field"] == "servo3_angle")
        |> aggregateWindow(every: 10s, fn: mean, createEmpty: false)
        |> yield(name: "mean")
        '''
        
        result = query_api.query(query)
        
        if not result:
            return []
        
        time_series = {}
        
        for table in result:
            for record in table.records:
                timestamp = record.get_time().isoformat()
                field = record.get_field()
                value = record.get_value()
                
                if timestamp not in time_series:
                    time_series[timestamp] = {'timestamp': timestamp}
                
                time_series[timestamp][field] = value
        
        history = list(time_series.values())
        history.sort(key=lambda x: x['timestamp'])
        
        return history
    
    except Exception as e:
        logger.error(f"Errore query storico: {e}")
        return []

def get_potentiometer_history(hours=1):
    """Ottiene lo storico dei potenziometri"""
    if not query_api:
        return []
    
    try:
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
        |> range(start: -{hours}h)
        |> filter(fn: (r) => r["_measurement"] == "servo_controller")
        |> filter(fn: (r) => r["type"] == "servo_system")
        |> filter(fn: (r) => r["_field"] == "pot1_percent" or r["_field"] == "pot2_percent" or r["_field"] == "pot3_percent")
        |> aggregateWindow(every: 10s, fn: mean, createEmpty: false)
        |> yield(name: "mean")
        '''
        
        result = query_api.query(query)
        
        time_series = {}
        for table in result:
            for record in table.records:
                timestamp = record.get_time().isoformat()
                field = record.get_field()
                value = record.get_value()
                
                if timestamp not in time_series:
                    time_series[timestamp] = {'timestamp': timestamp}
                
                time_series[timestamp][field] = value
        
        history = list(time_series.values())
        history.sort(key=lambda x: x['timestamp'])
        
        return history
    
    except Exception as e:
        logger.error(f"Errore query potenziometri: {e}")
        return []

def get_recent_measurements(limit=50):
    """Ottiene le ultime misurazioni campionate ogni 30 secondi per la tabella"""
    if not query_api:
        return []
    
    try:
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
        |> range(start: -6h)
        |> filter(fn: (r) => r["_measurement"] == "servo_controller")
        |> filter(fn: (r) => r["type"] == "servo_system")
        |> filter(fn: (r) => r["_field"] == "servo1_angle" or r["_field"] == "servo2_angle" or r["_field"] == "servo3_angle" or 
                            r["_field"] == "pot1_percent" or r["_field"] == "pot2_percent" or r["_field"] == "pot3_percent" or
                            r["_field"] == "servos_active_count")
        |> aggregateWindow(every: 30s, fn: last, createEmpty: false)
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: {limit})
        '''
        
        controls_query = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
        |> range(start: -6h)
        |> filter(fn: (r) => r["_measurement"] == "servo_controller")
        |> filter(fn: (r) => r["type"] == "controls")
        |> aggregateWindow(every: 30s, fn: last, createEmpty: false)
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: {limit})
        '''
        
        servo_result = query_api.query(query)
        controls_result = query_api.query(controls_query)
        
        measurements = {}

        for table in servo_result:
            for record in table.records:
                timestamp = record.get_time()
                ts_key = timestamp.isoformat()
                
                if ts_key not in measurements:
                    measurements[ts_key] = {
                        'timestamp': timestamp,
                        'time_str': timestamp.strftime('%H:%M:%S'),
                        'date_str': timestamp.strftime('%d/%m/%Y')
                    }
                
                values = record.values
                for field_name, field_value in values.items():
                    if field_name.startswith('servo') or field_name.startswith('pot') or field_name == 'servos_active_count':
                        measurements[ts_key][field_name] = field_value
        
        for table in controls_result:
            for record in table.records:
                timestamp = record.get_time()
                ts_key = timestamp.isoformat()
                
                if ts_key in measurements:
                    values = record.values
                    for field_name, field_value in values.items():
                        if field_name in ['button_pressed', 'led_state']:
                            measurements[ts_key][field_name] = field_value
                else:
                    for servo_ts_key in measurements.keys():
                        servo_time = measurements[servo_ts_key]['timestamp']
                        time_diff = abs((timestamp - servo_time).total_seconds())
                        if time_diff <= 15:
                            values = record.values
                            for field_name, field_value in values.items():
                                if field_name in ['button_pressed', 'led_state']:
                                    measurements[servo_ts_key][field_name] = field_value
                            break

        measurements_list = list(measurements.values())
        measurements_list.sort(key=lambda x: x['timestamp'], reverse=True)
        
        filtered_measurements = []
        for measurement in measurements_list:
            if 'servo1_angle' in measurement:
                measurement.setdefault('button_pressed', 0)
                measurement.setdefault('led_state', 0)
                measurement.setdefault('servos_active_count', 0)
                filtered_measurements.append(measurement)
                
                if len(filtered_measurements) >= limit:
                    break
        
        logger.info(f"Tabella: {len(filtered_measurements)} record campionati ogni 30s")
        return filtered_measurements
    
    except Exception as e:
        logger.error(f"Errore query measurements campionate: {e}")
        return []

def get_system_stats():
    """Ottiene statistiche del sistema"""
    if not query_api:
        return {}
    
    try:
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
        |> range(start: -1h)
        |> filter(fn: (r) => r["_measurement"] == "servo_controller")
        |> filter(fn: (r) => r["type"] == "servo_system")
        |> filter(fn: (r) => r["_field"] == "servo1_angle")
        |> count()
        '''
        
        result = query_api.query(query)
        message_count = 0
        
        for table in result:
            for record in table.records:
                message_count = record.get_value()
                break
        
        last_data = get_latest_servo_data()
        last_update = None
        if last_data and 'timestamp' in last_data:
            last_update = last_data['timestamp']
        
        return {
            'messages_last_hour': message_count,
            'last_update': last_update,
            'status': 'connected' if last_update else 'disconnected'
        }
    
    except Exception as e:
        logger.error(f"Errore statistiche sistema: {e}")
        return {}

@app.route('/')
def dashboard():
    """Pagina principale del dashboard"""
    return render_template('dashboard.html')

@app.route('/api/latest')
def api_latest():
    """API per gli ultimi dati"""
    data = get_latest_servo_data()
    if data:
        return jsonify(data)
    else:
        return jsonify({'error': 'Nessun dato disponibile'}), 404

@app.route('/api/history')
def api_history():
    """API per lo storico dati"""
    hours = request.args.get('hours', 1, type=int)
    servo_history = get_servo_history(hours)
    pot_history = get_potentiometer_history(hours)
    
    return jsonify({
        'servo_angles': servo_history,
        'potentiometers': pot_history
    })

@app.route('/api/measurements')
def api_measurements():
    """API per le misurazioni recenti (tabella)"""
    limit = request.args.get('limit', 50, type=int)
    measurements = get_recent_measurements(limit)
    return jsonify(measurements)

@app.route('/api/stats')
def api_stats():
    """API per le statistiche del sistema"""
    stats = get_system_stats()
    return jsonify(stats)

@app.route('/api/debug')
def api_debug():
    """API per debug - mostra tutti i dati disponibili"""
    try:
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
        |> range(start: -10m)
        |> filter(fn: (r) => r["_measurement"] == "servo_controller")
        |> last()
        '''
        
        result = query_api.query(query)
        
        debug_data = []
        for table in result:
            for record in table.records:
                debug_data.append({
                    'measurement': record.get_measurement(),
                    'field': record.get_field(),
                    'value': record.get_value(),
                    'time': record.get_time().isoformat(),
                    'tags': dict(record.values)
                })
        
        return jsonify({
            'debug_data': debug_data,
            'processed_data': get_latest_servo_data()
        })
    
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/debug')
def debug_page():
    """Pagina di debug per verificare i dati"""
    return '''
    <!DOCTYPE html>
    <html>
    <head><title>Debug Servo Data</title></head>
    <body>
        <h1>Debug Servo Controller Data</h1>
        <button onclick="loadDebugData()">Carica Dati Debug</button>
        <div id="debugOutput"></div>
        <script>
            function loadDebugData() {
                fetch('/api/debug')
                    .then(response => response.json())
                    .then(data => {
                        document.getElementById('debugOutput').innerHTML = 
                            '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                    });
            }
        </script>
    </body>
    </html>
    '''

@socketio.on('connect')
def handle_connect():
    """Gestisce nuove connessioni WebSocket"""
    logger.info('Client connesso via WebSocket')
    emit('status', {'message': 'Connesso al server'})

@socketio.on('disconnect')
def handle_disconnect():
    """Gestisce disconnessioni WebSocket"""
    logger.info('Client disconnesso')

def broadcast_latest_data():
    """Thread che invia dati aggiornati via WebSocket"""
    while True:
        try:
            latest = get_latest_servo_data()
            stats = get_system_stats()
            
            if latest:
                socketio.emit('data_update', {
                    'servo_data': latest,
                    'system_stats': stats,
                    'timestamp': datetime.now().isoformat()
                })
            
            time.sleep(2)
            
        except Exception as e:
            logger.error(f"Errore broadcast dati: {e}")
            time.sleep(5)

def main():
    print("=" * 70)
    print(" SERVO CONTROLLER FLASK DASHBOARD")
    print("=" * 70)
    print(" Dashboard web real-time per sistema servo micro:bit")
    print(" Server Flask con WebSocket per aggiornamenti live")
    print(" Grafici interattivi e controlli visual")
    print(" Tabella misurazioni in tempo reale")
    print("=" * 70)
    
    if not initialize_influxdb():
        print("Impossibile connettersi a InfluxDB. Verificare la configurazione.")
        return
    
    import os
    templates_dir = os.path.join(os.path.dirname(__file__), 'templates')
    if not os.path.exists(templates_dir):
        os.makedirs(templates_dir)
    
    static_dir = os.path.join(os.path.dirname(__file__), 'static')
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)
        css_dir = os.path.join(static_dir, 'css')
        js_dir = os.path.join(static_dir, 'js')
        os.makedirs(css_dir, exist_ok=True)
        os.makedirs(js_dir, exist_ok=True)
    
    broadcast_thread = threading.Thread(target=broadcast_latest_data, daemon=True)
    broadcast_thread.start()
    
    print("Dashboard disponibile su: http://localhost:5000")
    print("Aggiornamento dati ogni 2 secondi")
    print("WebSocket attivo per real-time updates")
    print("=" * 70)
    
    try:
        socketio.run(app, host='0.0.0.0', port=5000, debug=False)
    except KeyboardInterrupt:
        print("\n Server fermato dall'utente")
    finally:
        if influx_client:
            influx_client.close()
        print(" Dashboard terminata")

if __name__ == "__main__":
    main()