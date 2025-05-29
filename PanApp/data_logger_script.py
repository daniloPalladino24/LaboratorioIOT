import serial
import time
import re
import json
from datetime import datetime, timezone
import logging
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

INFLUXDB_URL = "http://localhost:8086"
INFLUXDB_TOKEN = "uhln0fzak4EBwSeChsbe8NQKj9ldoaasFiE61uIy7aQ_NtfoNZGQoHWHJY199LiZfpU0IcQIBaK64KJgVeMPgg=="
INFLUXDB_ORG = "microbit-org"
INFLUXDB_BUCKET = "PAN"

SERIAL_PORT = "COM6"
BAUD_RATE = 115200
DEVICE_NAME = "microbit_servo_controller"

LOG_LEVEL = logging.INFO
LOG_FILE = "microbit_influx.log"

logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

RX_PATTERN = r"RX: P1=(\d+)(?:\s*\(STOP\))?\s+P2=(\d+)(?:\s*\(STOP\))?\s+P3=(\d+)(?:\s*\(STOP\))?\s+BTN=(\d+)\s+→\s+A1=(\d+)°\s+A2=(\d+)°\s+A3=(\d+)°\s+LED=(\d+)"

def parse_servo_data(line):
    match = re.search(RX_PATTERN, line)
    if match:
        p1, p2, p3, btn, a1, a2, a3, led = match.groups()
        pot1_raw = int(p1)
        pot2_raw = int(p2)
        pot3_raw = int(p3)
        button = int(btn)
        angle1 = float(a1)
        angle2 = float(a2)
        angle3 = float(a3)
        led_raw = int(led)
        led_state = led_raw
        expected_led_state = 1 - button
        if led_raw != expected_led_state:
            logger.warning(f"LED Logic Inconsistency: Button={button}, LED_Raw={led_raw}, Expected={expected_led_state}")
        pot1_percent = (pot1_raw / 1023) * 100
        pot2_percent = (pot2_raw / 1023) * 100
        pot3_percent = (pot3_raw / 1023) * 100
        angle1_percent = (angle1 / 180) * 100
        angle2_percent = (angle2 / 180) * 100
        angle3_percent = (angle3 / 180) * 100
        def angle_to_pwm(angle):
            return int((angle / 180) * (128 - 26)) + 26
        servo1_pwm = angle_to_pwm(angle1)
        servo2_pwm = angle_to_pwm(angle2)
        servo3_pwm = angle_to_pwm(angle3)
        servo1_active = 1 if angle1 > 0 else 0
        servo2_active = 1 if angle2 > 0 else 0
        servo3_active = 1 if angle3 > 0 else 0
        data = {
            "pot1_raw": pot1_raw,
            "pot2_raw": pot2_raw,
            "pot3_raw": pot3_raw,
            "pot1_percent": round(pot1_percent, 1),
            "pot2_percent": round(pot2_percent, 1),
            "pot3_percent": round(pot3_percent, 1),
            "button_pressed": button,
            "led_state": led_state,
            "led_raw": led_raw,
            "servo1_angle": angle1,
            "servo2_angle": angle2,
            "servo3_angle": angle3,
            "servo1_angle_percent": round(angle1_percent, 1),
            "servo2_angle_percent": round(angle2_percent, 1),
            "servo3_angle_percent": round(angle3_percent, 1),
            "servo1_pwm": servo1_pwm,
            "servo2_pwm": servo2_pwm,
            "servo3_pwm": servo3_pwm,
            "servo1_active": servo1_active,
            "servo2_active": servo2_active,
            "servo3_active": servo3_active,
            "servos_active_count": servo1_active + servo2_active + servo3_active
        }
        return data
    return None

def create_influxdb_points(data, timestamp=None):
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)
    points = []
    servo_point = Point("servo_controller") \
        .tag("device", DEVICE_NAME) \
        .tag("type", "servo_system") \
        .field("pot1_raw", data["pot1_raw"]) \
        .field("pot2_raw", data["pot2_raw"]) \
        .field("pot3_raw", data["pot3_raw"]) \
        .field("pot1_percent", data["pot1_percent"]) \
        .field("pot2_percent", data["pot2_percent"]) \
        .field("pot3_percent", data["pot3_percent"]) \
        .field("servo1_angle", data["servo1_angle"]) \
        .field("servo2_angle", data["servo2_angle"]) \
        .field("servo3_angle", data["servo3_angle"]) \
        .field("servo1_angle_percent", data["servo1_angle_percent"]) \
        .field("servo2_angle_percent", data["servo2_angle_percent"]) \
        .field("servo3_angle_percent", data["servo3_angle_percent"]) \
        .field("servo1_pwm", data["servo1_pwm"]) \
        .field("servo2_pwm", data["servo2_pwm"]) \
        .field("servo3_pwm", data["servo3_pwm"]) \
        .field("servo1_active", data["servo1_active"]) \
        .field("servo2_active", data["servo2_active"]) \
        .field("servo3_active", data["servo3_active"]) \
        .field("servos_active_count", data["servos_active_count"]) \
        .time(timestamp)
    points.append(servo_point)
    control_point = Point("servo_controller") \
        .tag("device", DEVICE_NAME) \
        .tag("type", "controls") \
        .field("button_pressed", data["button_pressed"]) \
        .field("led_state", data["led_state"]) \
        .field("led_raw", data["led_raw"]) \
        .time(timestamp)
    points.append(control_point)
    for i in range(1, 4):
        servo_individual = Point("servo_individual") \
            .tag("device", DEVICE_NAME) \
            .tag("servo_id", f"servo{i}") \
            .field("pot_raw", data[f"pot{i}_raw"]) \
            .field("pot_percent", data[f"pot{i}_percent"]) \
            .field("angle", data[f"servo{i}_angle"]) \
            .field("angle_percent", data[f"servo{i}_angle_percent"]) \
            .field("pwm", data[f"servo{i}_pwm"]) \
            .field("active", data[f"servo{i}_active"]) \
            .time(timestamp)
        points.append(servo_individual)
    return points


def main():
    stats = {
        "received": 0,
        "sent": 0,
        "parse_errors": 0,
        "influx_errors": 0,
        "start_time": time.time()
    }
    try:
        client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
        write_api = client.write_api(write_options=SYNCHRONOUS)
    except Exception as e:
        logger.error(f" InfluxDB connection error: {e}")
        return
    try:
        logger.info(f" Connecting to serial port {SERIAL_PORT}...")
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2)
        logger.info(f"✅ Serial connected: {SERIAL_PORT} @ {BAUD_RATE} baud")
    except Exception as e:
        logger.error(f" Serial connection error: {e}")
        return
    logger.info(f" Target bucket: {INFLUXDB_BUCKET}")
    logger.info(" Listening for servo controller data... (Ctrl+C to stop)")
    print()
    try:
        while True:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if line:
                if not line.startswith("RX:"):
                    if line in ["RECEIVER_INIT", "RADIO_RECEIVER_READY", "CONNECTION_LOST", "ALL_SERVOS_TO_ZERO"]:
                        logger.info(f" System message: {line}")
                    else:
                        logger.debug(f"Debug: {line}")
                    continue
                data = parse_servo_data(line)
                if not data:
                    stats['parse_errors'] += 1
                    logger.warning(f" Failed to parse line: {line}")
                    continue
                stats["received"] += 1
                should_log_detail = (stats["received"] <= 5) or (stats["received"] % 10 == 0)
                if should_log_detail:
                    logger.info(f" Packet #{stats['received']} received (Time: {time.strftime('%H:%M:%S')})")
                try:
                    points = create_influxdb_points(data)
                    write_api.write(bucket=INFLUXDB_BUCKET, record=points)
                    stats["sent"] += len(points)
                    if should_log_detail:
                        logger.info(f" {len(points)} points sent to InfluxDB")
                        print("-" * 60)
                except Exception as e:
                    stats["influx_errors"] += 1
                    logger.error(f" InfluxDB write error: {e}")
            time.sleep(0.01)
    except KeyboardInterrupt:
        logger.info("\n Stopped by user (Ctrl+C)")
    except Exception as e:
        logger.error(f" Unexpected error: {e}")
    finally:
        try:
            ser.close()
            client.close()
            logger.info(" Serial and InfluxDB connections closed")
        except Exception as e:
            logger.error(f" Error closing connections: {e}")
        stats['runtime'] = time.time() - stats['start_time']
        logger.info("Program terminated successfully")

if __name__ == "__main__":
    main()