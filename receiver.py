from microbit import *
import radio

# ===========================================
# SCHEDA RICEVENTE - SERVO E LED
# ===========================================
# PIN8 = Servo 1 (filo segnale)
# PIN12 = Servo 2 (filo segnale)
# PIN16 = Servo 3 (filo segnale)
# PIN14 = LED esterno (anodo, con resistenza in serie)
# 3V = Alimentazione (+) per servo e LED
# GND = Terra (-) per servo e LED

pin8.set_analog_period(20)
pin12.set_analog_period(20)
pin16.set_analog_period(20)

radio.on()
radio.config(channel=42, power=7, length=100)

def parse_radio_message(message):
    try:
        parts = message.split(',')
        pot1_val = 0
        pot2_val = 0
        pot3_val = 0
        button_state = 0
        for part in parts:
            if part.startswith('P1:'):
                pot1_val = int(part[3:])
            elif part.startswith('P2:'):
                pot2_val = int(part[3:])
            elif part.startswith('P3:'):
                pot3_val = int(part[3:])
            elif part.startswith('BTN:'):
                button_state = int(part[4:])
        return pot1_val, pot2_val, pot3_val, button_state, True
    except:
        return 0, 0, 0, 0, False

def control_servos(pot1_val, pot2_val, pot3_val):
    angle1 = pot_to_angle(pot1_val)
    angle2 = pot_to_angle(pot2_val)
    angle3 = pot_to_angle(pot3_val)
    pwm1 = angle_to_pwm(angle1)
    pwm2 = angle_to_pwm(angle2)
    pwm3 = angle_to_pwm(angle3)
    pin8.write_analog(pwm1)
    pin12.write_analog(pwm2)
    pin16.write_analog(pwm3)
    return angle1, angle2, angle3

def pot_to_angle(pot_value):
    limited_pot_value = min(pot_value, 512)
    angle = 180 - (limited_pot_value / 512) * 180
    return angle

def angle_to_pwm(angle):
    pwm_value = int((angle / 180) * (128 - 26)) + 26   #128 = Max PWM, 26 = Min PWM
    return pwm_value

def initialize_servos():
    min_pwm = angle_to_pwm(0)
    pin8.write_analog(min_pwm)
    pin12.write_analog(min_pwm)
    pin16.write_analog(min_pwm)

display.off()
initialize_servos()

last_receive_time = 0
connection_timeout = 2000
is_connected = False

current_pot1 = 0
current_pot2 = 0
current_pot3 = 0
current_button = 0

while True:
    current_time = running_time()
    message = radio.receive()
    if message:
        pot1_val, pot2_val, pot3_val, button_state, valid = parse_radio_message(message)
        if valid:
            current_pot1 = pot1_val
            current_pot2 = pot2_val
            current_pot3 = pot3_val
            angle1, angle2, angle3 = control_servos(pot1_val, pot2_val, pot3_val)
            last_receive_time = current_time
            led_state = button_state
            is_connected = True
            print("RX: P1={} P2={} P3={} BTN={} → A1={}° A2={}° A3={}° LED={}".format(
                pot1_val, pot2_val, pot3_val,
                button_state, round(angle1), round(angle2), round(angle3), led_state))
            
    if current_time - last_receive_time > connection_timeout:
        if is_connected:
            is_connected = False
            initialize_servos()
