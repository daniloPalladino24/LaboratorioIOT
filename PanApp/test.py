import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from influxdb_client import InfluxDBClient
from dotenv import load_dotenv

# Carica le variabili d'ambiente dal file .env specifico per Flask
load_dotenv('flask_app.env') # Se hai un file .env diverso per Flask, altrimenti load_dotenv()

app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app) # Abilita CORS

# --- Configurazione InfluxDB ---
INFLUXDB_URL = os.getenv("INFLUXDB_URL")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET")

influxdb_client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
query_api = influxdb_client.query_api()

# --- API Endpoints ---

@app.route('/')
def serve_index():
    # Serve index.html dalla cartella frontend
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    # Serve altri file statici (CSS, JS) dalla cartella frontend
    return send_from_directory(app.static_folder, path)

@app.route('/api/data/<measurement_name>', methods=['GET'])
def get_influx_data(measurement_name):
    # Query Flux per recuperare i dati recenti per una specifica misura
    # Il range di tempo deve essere abbastanza ampio da catturare i tuoi dati
    flux_query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -1h) // Dati dell'ultima ora. Aumenta se hai bisogno di più storia.
      |> filter(fn: (r) => r._measurement == "{measurement_name}")
      |> yield(name: "data")
    '''
    try:
        tables = query_api.query(flux_query, org=INFLUXDB_ORG)
        results = []
        for table in tables:
            for record in table.records:
                # Recupera tutti i field e tag per il record
                record_dict = {
                    "timestamp": record.get_time().isoformat(),
                    "measurement": record.get_measurement(),
                    "value": record.get_value() # Questo è il campo predefinito (_value)
                }
                
                # Aggiungi tutti i campi dal record alla lista dei risultati
                for key, val in record.values.items():
                    if not key.startswith('_') and key not in record_dict: # Evita metadati interni e duplicati
                        record_dict[key] = val
                
                results.append(record_dict)

        return jsonify(results), 200
    except Exception as e:
        print(f"Errore query InfluxDB: {e}")
        return jsonify({"error": str(e)}), 500

# Endpoint per recuperare tutti i dati di un tipo (es. 'potentiometer') con i tag
@app.route('/api/data/by_tag/<measurement_name>/<tag_key>/<tag_value>', methods=['GET'])
def get_influx_data_by_tag(measurement_name, tag_key, tag_value):
    flux_query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "{measurement_name}")
      |> filter(fn: (r) => r["{tag_key}"] == "{tag_value}")
      |> yield(name: "data")
    '''
    try:
        tables = query_api.query(flux_query, org=INFLUXDB_ORG)
        results = []
        for table in tables:
            for record in table.records:
                record_dict = {
                    "timestamp": record.get_time().isoformat(),
                    "value": record.get_value() # Spesso il valore principale è in _value
                }
                # Aggiungi tutti i fields e tags come parte del record
                for key, val in record.values.items():
                    if not key.startswith('_') and key not in record_dict:
                        record_dict[key] = val
                results.append(record_dict)
        return jsonify(results), 200
    except Exception as e:
        print(f"Errore query InfluxDB: {e}")
        return jsonify({"error": str(e)}), 500

# Endpoint per recuperare i dati dei controlli (button, led)
@app.route('/api/data/controls', methods=['GET'])
def get_controls_data():
    flux_query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "controls")
      |> yield(name: "controls")
    '''
    try:
        tables = query_api.query(flux_query, org=INFLUXDB_ORG)
        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    "timestamp": record.get_time().isoformat(),
                    "button_state": record.values.get("button_state"),
                    "led_state": record.values.get("led_state")
                })
        return jsonify(results), 200
    except Exception as e:
        print(f"Errore query InfluxDB (controls): {e}")
        return jsonify({"error": str(e)}), 500

# Endpoint per recuperare i dati di system_stats
@app.route('/api/data/system_stats', methods=['GET'])
def get_system_stats_data():
    flux_query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "system_stats")
      |> yield(name: "system_stats")
    '''
    try:
        tables = query_api.query(flux_query, org=INFLUXDB_ORG)
        results = []
        for table in tables:
            for record in table.records:
                record_dict = {
                    "timestamp": record.get_time().isoformat(),
                    "average_servo_angle": record.values.get("average_servo_angle"),
                    "total_potentiometer_raw": record.values.get("total_potentiometer_raw"),
                    "servo_range_span": record.values.get("servo_range_span"),
                    "button_led_match": record.values.get("button_led_match")
                }
                results.append(record_dict)
        return jsonify(results), 200
    except Exception as e:
        print(f"Errore query InfluxDB (system_stats): {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print("Avvio server Flask per la dashboard...")
    print(f"INFLUXDB_URL: {INFLUXDB_URL}")
    print(f"INFLUXDB_ORG: {INFLUXDB_ORG}")
    app.run(debug=True, host='0.0.0.0', port=7001)
    