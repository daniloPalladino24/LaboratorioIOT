"""
Script per leggere i dati seriali dalla micro:bit ricevente
e caricarli su InfluxDB per visualizzazione con Grafana.

Ispirato al sistema 'triple_servo'.
"""

import serial
import time
import re
import json
from datetime import datetime, timezone
import logging
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import os
from dotenv import load_dotenv

load_dotenv() # Carica le variabili dal file .env

# ===========================================
# CONFIGURAZIONE (Aggiornata per leggere da .env)
# ===========================================

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "microbit-org")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "radio")

SERIAL_PORT = os.getenv("SERIAL_PORT")
BAUD_RATE = int(os.getenv("BAUD_RATE", 115200))
DEVICE_NAME = os.getenv("DEVICE_NAME", "microbit_servo_controller")

# Configurazione Seriale
SERIAL_PORT = "/dev/cu.usbmodem11302"  # Porta seriale per la micro:bit
BAUD_RATE = 115200
DEVICE_NAME = "microbit_servo_controller"

# Configurazione Logging
LOG_LEVEL = logging.INFO
LOG_FILE = "microbit_influx.log"

# ===========================================
# CONFIGURAZIONE LOGGING
# ===========================================

logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ===========================================
# PATTERN PER PARSING
# ===========================================

# Pattern regex per estrarre i dati dalla stringa seriale
RX_PATTERN = r"RX: P1=(\d+) P2=(\d+) P3=(\d+) BTN=(\d+) \| A1=(\d+) A2=(\d+) A3=(\d+) LED=(\d+)"

# ===========================================
# FUNZIONI
# ===========================================

def parse_servo_data(line):
    """Analizza la linea di dati dalla micro:bit usando regex"""
    match = re.search(RX_PATTERN, line)
    if match:
        p1, p2, p3, btn, a1, a2, a3, led = match.groups()
        
        # Conversione in valori numerici
        pot1_raw = int(p1)
        pot2_raw = int(p2)
        pot3_raw = int(p3)
        button = int(btn)
        angle1 = float(a1)
        angle2 = float(a2)
        angle3 = float(a3)
        led_state = int(led)
        
        # Calcola percentuali per i potenziometri (0-100%)
        pot1_percent = (pot1_raw / 1023) * 100
        pot2_percent = (pot2_raw / 1023) * 100
        pot3_percent = (pot3_raw / 1023) * 100
        
        # Simuliamo i valori PWM basandoci sugli angoli
        # Da 0-180° a 26-128 (come nel codice micro:bit)
        def angle_to_pwm(angle):
            return int((angle / 180) * (128 - 26)) + 26
        
        servo1_pwm = angle_to_pwm(angle1)
        servo2_pwm = angle_to_pwm(angle2)
        servo3_pwm = angle_to_pwm(angle3)
        
        # Crea dizionario dati completo
        data = {
            "pot1_raw": pot1_raw,
            "pot2_raw": pot2_raw,
            "pot3_raw": pot3_raw,
            "pot1_percent": pot1_percent,
            "pot2_percent": pot2_percent,
            "pot3_percent": pot3_percent,
            "button": button,
            "led_state": led_state,
            "servo1_angle": angle1,
            "servo2_angle": angle2,
            "servo3_angle": angle3,
            "servo1_pwm": servo1_pwm,
            "servo2_pwm": servo2_pwm,
            "servo3_pwm": servo3_pwm
        }
        
        return data
    
    return None

def create_influxdb_points(data, timestamp=None):
    """Crea punti dati per InfluxDB per sistema servo controller"""
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)
    
    points = []
    
    # ===========================================
    # PUNTI POTENZIOMETRI
    # ===========================================
    
    # Potenziometro 1
    points.append(
        Point("potentiometer")
        .tag("device", DEVICE_NAME)
        .tag("pot_id", "pot1")
        .field("raw_value", data["pot1_raw"])
        .field("percentage", data["pot1_percent"])
        .time(timestamp)
    )
    
    # Potenziometro 2
    points.append(
        Point("potentiometer")
        .tag("device", DEVICE_NAME)
        .tag("pot_id", "pot2")
        .field("raw_value", data["pot2_raw"])
        .field("percentage", data["pot2_percent"])
        .time(timestamp)
    )
    
    # Potenziometro 3
    points.append(
        Point("potentiometer")
        .tag("device", DEVICE_NAME)
        .tag("pot_id", "pot3")
        .field("raw_value", data["pot3_raw"])
        .field("percentage", data["pot3_percent"])
        .time(timestamp)
    )
    
    # ===========================================
    # PUNTI SERVO
    # ===========================================
    
    # Servo 1
    points.append(
        Point("servo")
        .tag("device", DEVICE_NAME)
        .tag("servo_id", "servo1")
        .field("angle", data["servo1_angle"])
        .field("pwm_value", data["servo1_pwm"])
        .time(timestamp)
    )
    
    # Servo 2
    points.append(
        Point("servo")
        .tag("device", DEVICE_NAME)
        .tag("servo_id", "servo2")
        .field("angle", data["servo2_angle"])
        .field("pwm_value", data["servo2_pwm"])
        .time(timestamp)
    )
    
    # Servo 3
    points.append(
        Point("servo")
        .tag("device", DEVICE_NAME)
        .tag("servo_id", "servo3")
        .field("angle", data["servo3_angle"])
        .field("pwm_value", data["servo3_pwm"])
        .time(timestamp)
    )
    
    # ===========================================
    # PUNTO BUTTON E LED
    # ===========================================
    
    points.append(
        Point("controls")
        .tag("device", DEVICE_NAME)
        .field("button_state", data["button"])
        .field("led_state", data["led_state"])
        .time(timestamp)
    )
    
    # ===========================================
    # PUNTO COMBINATO PER CORRELAZIONI
    # ===========================================
    
    points.append(
        Point("system_status")
        .tag("device", DEVICE_NAME)
        .field("pot1_raw", data["pot1_raw"])
        .field("servo1_angle", data["servo1_angle"])
        .field("pot2_raw", data["pot2_raw"])
        .field("servo2_angle", data["servo2_angle"])
        .field("pot3_raw", data["pot3_raw"])
        .field("servo3_angle", data["servo3_angle"])
        .field("button", data["button"])
        .field("led", data["led_state"])
        .time(timestamp)
    )
    
    # ===========================================
    # PUNTI STATISTICI
    # ===========================================
    
    # Media angoli servo
    avg_angle = (data["servo1_angle"] + data["servo2_angle"] + data["servo3_angle"]) / 3
    
    # Somma potenziometri
    total_pot = data["pot1_raw"] + data["pot2_raw"] + data["pot3_raw"]
    
    # Range tra angoli servo (max - min)
    servo_range = max(data["servo1_angle"], data["servo2_angle"], data["servo3_angle"]) - \
                  min(data["servo1_angle"], data["servo2_angle"], data["servo3_angle"])
    
    points.append(
        Point("system_stats")
        .tag("device", DEVICE_NAME)
        .field("average_servo_angle", round(avg_angle, 1))
        .field("total_potentiometer_raw", total_pot)
        .field("servo_range_span", round(servo_range, 1))
        .field("button_led_match", 1 if (data["button"] == (1 - data["led_state"])) else 0)
        .time(timestamp)
    )
    
    return points

def print_servo_status(data):
    """Stampa stato leggibile del sistema servo controller"""
    print(f"🎛️  POT1: {data['pot1_raw']:4d} ({data['pot1_percent']:5.1f}%) → SERVO1: {data['servo1_angle']:6.1f}° (PWM:{data['servo1_pwm']:3d})")
    print(f"🎛️  POT2: {data['pot2_raw']:4d} ({data['pot2_percent']:5.1f}%) → SERVO2: {data['servo2_angle']:6.1f}° (PWM:{data['servo2_pwm']:3d})")
    print(f"🎛️  POT3: {data['pot3_raw']:4d} ({data['pot3_percent']:5.1f}%) → SERVO3: {data['servo3_angle']:6.1f}° (PWM:{data['servo3_pwm']:3d})")
    print(f"🔘 Button: {'PRESSED' if data['button'] else 'RELEASED'} → LED: {'OFF' if data['led_state'] == 0 else 'ON'}")
    
    # Statistiche aggiuntive
    avg_angle = (data['servo1_angle'] + data['servo2_angle'] + data['servo3_angle']) / 3
    total_pot = data['pot1_raw'] + data['pot2_raw'] + data['pot3_raw']
    print(f"📊 AVG ANGLE: {avg_angle:5.1f}° | TOTAL POT: {total_pot:4d}")

def print_system_summary(stats):
    """Stampa riepilogo del sistema"""
    print(f"\n📊 SERVO CONTROLLER SYSTEM - Final Stats:")
    print(f"   📡 Data packets received: {stats['received']}")
    print(f"   ✅ Points sent to InfluxDB: {stats['sent']}")
    print(f"   ❌ Total errors: {stats['errors']}")
    print(f"   ⏱️  Runtime: {stats['runtime']:.1f}s")
    if stats['received'] > 0:
        print(f"   📈 Average points per packet: {stats['sent'] / stats['received']:.1f}")
        print(f"   📊 Success rate: {((stats['received'] - stats['errors']) / stats['received'] * 100):.1f}%")

# ===========================================
# MAIN
# ===========================================

def main():
    print("=" * 70)
    print("🚀 SERVO CONTROLLER SYSTEM → InfluxDB Logger")
    print("=" * 70)
    print("🎛️  3 Potenziometri + 3 Servo + Pulsante + LED + Real-time Data Logging")
    print("=" * 70)
    
    # Statistiche
    stats = {"received": 0, "sent": 0, "errors": 0, "start_time": time.time()}
    
    # Connessione InfluxDB
    try:
        client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
        write_api = client.write_api(write_options=SYNCHRONOUS)
        logger.info("InfluxDB connected")
        
        # Verifica bucket
        buckets = client.buckets_api().find_buckets()
        bucket_exists = any(b.name == INFLUXDB_BUCKET for b in buckets.buckets)
        if bucket_exists:
            logger.info(f"Bucket '{INFLUXDB_BUCKET}' found")
        else:
            logger.warning(f"Bucket '{INFLUXDB_BUCKET}' not found - will be created automatically")
            
    except Exception as e:
        logger.error(f"InfluxDB error: {e}")
        return
    
    # Connessione Seriale
    try:
        logger.info(f"Tentativo di connessione alla porta seriale {SERIAL_PORT}...")
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2)  # Attendi l'inizializzazione della porta seriale
        logger.info(f"✅ Serial connected: {SERIAL_PORT}")
    except Exception as e:
        logger.error(f"❌ Serial error: {e}")
        return
    
    logger.info(f"Target bucket: {INFLUXDB_BUCKET}")
    logger.info("Listening for servo controller data... (Ctrl+C to stop)")
    
    try:
        while True:
            # Leggi linea dalla porta seriale
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            
            if line:
                # Debug non-data lines
                if not line.startswith("RX:"):
                    logger.debug(f"Debug: {line}")
                    continue
                
                # Parse servo data
                data = parse_servo_data(line)
                if not data:
                    stats['errors'] += 1
                    logger.warning(f"Failed to parse line: {line}")
                    continue
                
                stats["received"] += 1
                
                # Log dettagliato solo per pacchetti multipli di 10
                if stats["received"] % 10 == 0 or stats["received"] <= 5:
                    logger.info(f"Packet #{stats['received']} received (Time: {time.strftime('%H:%M:%S')})")
                    print_servo_status(data)
                
                # Send to InfluxDB
                try:
                    points = create_influxdb_points(data)
                    write_api.write(bucket=INFLUXDB_BUCKET, record=points)
                    stats["sent"] += len(points)
                    
                    # Log dettagliato solo per pacchetti multipli di 10
                    if stats["received"] % 10 == 0 or stats["received"] <= 5:
                        logger.info(f"{len(points)} points sent to InfluxDB")
                        print("-" * 60)
                except Exception as e:
                    stats["errors"] += 1
                    logger.error(f"InfluxDB error: {e}")
            
            time.sleep(0.01)  # Breve pausa per ridurre l'utilizzo della CPU
    
    except KeyboardInterrupt:
        logger.info("\nStopped by user (Ctrl+C)")
    
    finally:
        # Chiudi le connessioni
        try:
            ser.close()
            client.close()
        except:
            pass
        
        # Calcola runtime totale
        stats['runtime'] = time.time() - stats['start_time']
        
        # Stampa riepilogo
        print_system_summary(stats)
        logger.info("All connections closed. Program terminated.")

if __name__ == "__main__":
    main()