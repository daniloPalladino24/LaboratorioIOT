import os
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from influxdb_client import InfluxDBClient
from dotenv import load_dotenv

# Carica le variabili d'ambiente
load_dotenv()  # Carica dal file .env nella root del progetto

app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)

# --- Configurazione InfluxDB ---
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN")  # DEVE essere impostato
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "microbit-org")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "microbit-data")

# Verifica che il token sia presente
if not INFLUXDB_TOKEN:
    print("ERRORE: INFLUXDB_TOKEN non trovato nelle variabili d'ambiente!")
    print("Crea un file .env nella root del progetto con:")
    print("INFLUXDB_TOKEN=il_tuo_token_qui")
    exit(1)

print(f"INFLUXDB_URL: {INFLUXDB_URL}")
print(f"INFLUXDB_ORG: {INFLUXDB_ORG}")
print(f"INFLUXDB_BUCKET: {INFLUXDB_BUCKET}")
print(f"INFLUXDB_TOKEN: {'*' * (len(INFLUXDB_TOKEN) - 4) + INFLUXDB_TOKEN[-4:] if INFLUXDB_TOKEN else 'NON TROVATO'}")

try:
    influxdb_client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    query_api = influxdb_client.query_api()
    
    # Test della connessione
    health = influxdb_client.health()
    print(f"InfluxDB Health Status: {health.status}")
except Exception as e:
    print(f"ERRORE connessione InfluxDB: {e}")
    exit(1)

# --- API Endpoints ---

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory(app.static_folder, path)

@app.route('/api/data/<measurement_name>', methods=['GET'])
def get_influx_data(measurement_name):
    print(f"\n=== API CALL: /api/data/{measurement_name} ===")
    print(f"Headers: {dict(request.headers)}")
    
    # Query con range più ampio per debug
    flux_query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -7d)
      |> filter(fn: (r) => r._measurement == "{measurement_name}")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 100)
    '''
    
    print(f"Query: {flux_query}")
    
    try:
        tables = query_api.query(flux_query, org=INFLUXDB_ORG)
        results = []
        record_count = 0
        
        for table in tables:
            print(f"Tabella trovata: {len(table.records)} record")
            for record in table.records:
                record_count += 1
                record_dict = {
                    "timestamp": record.get_time().isoformat(),
                    "measurement": record.get_measurement(),
                    "value": record.get_value(),
                    "field": record.get_field()
                }
                
                # Aggiungi tutti i tag e field
                for key, val in record.values.items():
                    if not key.startswith('_') and key not in record_dict:
                        record_dict[key] = val
                
                results.append(record_dict)
                
                # Debug primi 3 record
                if record_count <= 3:
                    print(f"Record {record_count}: {record_dict}")
        
        print(f"RISULTATO: {record_count} record per {measurement_name}")
        print(f"Returning: {len(results)} results")
        
        # Aggiungi headers CORS espliciti
        response = jsonify(results)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response, 200
        
    except Exception as e:
        print(f"ERRORE query InfluxDB per {measurement_name}: {e}")
        print(f"Tipo errore: {type(e)}")
        import traceback
        traceback.print_exc()
        
        error_response = jsonify({"error": str(e), "measurement": measurement_name})
        error_response.headers.add('Access-Control-Allow-Origin', '*')
        return error_response, 500

@app.route('/api/data/by_tag/<measurement_name>/<tag_key>/<tag_value>', methods=['GET'])
def get_influx_data_by_tag(measurement_name, tag_key, tag_value):
    flux_query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "{measurement_name}")
      |> filter(fn: (r) => r["{tag_key}"] == "{tag_value}")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1000)
    '''
    
    print(f"Query by tag - measurement: {measurement_name}, {tag_key}: {tag_value}")
    
    try:
        tables = query_api.query(flux_query, org=INFLUXDB_ORG)
        results = []
        
        for table in tables:
            for record in table.records:
                record_dict = {
                    "timestamp": record.get_time().isoformat(),
                    "value": record.get_value(),
                    "field": record.get_field()
                }
                
                for key, val in record.values.items():
                    if not key.startswith('_') and key not in record_dict:
                        record_dict[key] = val
                        
                results.append(record_dict)
                
        print(f"Trovati {len(results)} record per tag query")
        return jsonify(results), 200
        
    except Exception as e:
        print(f"Errore query by tag: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/data/controls', methods=['GET'])
def get_controls_data():
    flux_query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "controls")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1000)
    '''
    
    try:
        tables = query_api.query(flux_query, org=INFLUXDB_ORG)
        results = []
        
        for table in tables:
            for record in table.records:
                record_dict = {
                    "timestamp": record.get_time().isoformat(),
                    "value": record.get_value(),
                    "field": record.get_field()
                }
                
                # Aggiungi tutti i field dal record
                for key, val in record.values.items():
                    if not key.startswith('_') and key not in record_dict:
                        record_dict[key] = val
                        
                results.append(record_dict)
                
        print(f"Controls data: {len(results)} record")
        return jsonify(results), 200
        
    except Exception as e:
        print(f"Errore query controls: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/data/system_stats', methods=['GET'])
def get_system_stats_data():
    flux_query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "system_stats")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1000)
    '''
    
    try:
        tables = query_api.query(flux_query, org=INFLUXDB_ORG)
        results = []
        
        for table in tables:
            for record in table.records:
                record_dict = {
                    "timestamp": record.get_time().isoformat(),
                    "value": record.get_value(),
                    "field": record.get_field()
                }
                
                for key, val in record.values.items():
                    if not key.startswith('_') and key not in record_dict:
                        record_dict[key] = val
                        
                results.append(record_dict)
                
        print(f"System stats: {len(results)} record")
        return jsonify(results), 200
        
    except Exception as e:
        print(f"Errore query system_stats: {e}")
        return jsonify({"error": str(e)}), 500

# Endpoint di debug per vedere tutti i measurements disponibili
@app.route('/api/debug/measurements', methods=['GET'])
def get_available_measurements():
    flux_query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -7d)
      |> group(columns: ["_measurement"])
      |> distinct(column: "_measurement")
      |> group()
      |> sort()
    '''
    
    try:
        tables = query_api.query(flux_query, org=INFLUXDB_ORG)
        measurements = []
        
        for table in tables:
            for record in table.records:
                measurements.append(record.get_value())
        
        # Se non funziona il metodo sopra, proviamo un approccio diverso
        if not measurements:
            # Query alternativa
            alt_query = f'''
            from(bucket: "{INFLUXDB_BUCKET}")
              |> range(start: -7d)
              |> keep(columns: ["_measurement"])
              |> distinct()
            '''
            
            alt_tables = query_api.query(alt_query, org=INFLUXDB_ORG)
            for table in alt_tables:
                for record in table.records:
                    if record.get_measurement() not in measurements:
                        measurements.append(record.get_measurement())
                
        print(f"Measurements disponibili: {measurements}")
        return jsonify({"measurements": measurements}), 200
        
    except Exception as e:
        print(f"Errore getting measurements: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Avvio server Flask per la dashboard...")
    app.run(debug=True, host='0.0.0.0', port=7001)