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

# Setup PWM per servo (50Hz = 20ms)
pin8.set_analog_period(20)   # Servo 1
pin12.set_analog_period(20)  # Servo 2
pin16.set_analog_period(20)  # Servo 3

# Configurazione LED
pin14.write_digital(1)  # Inizialmente acceso (logica invertita)

# ===========================================
# CONFIGURAZIONE RADIO
# ===========================================
radio.on()
radio.config(channel=42, power=7, length=100)  # Stesso canale del trasmettitore

# ===========================================
# FUNZIONI CONTROLLO SERVO E LED
# ===========================================

def pot_to_angle(pot_value):
    """Converte valore potenziometro (0-1023) in angolo servo (0-180°)"""
    angle = (pot_value / 1023) * 180
    return angle

def angle_to_pwm(angle):
    """Converte angolo (0-180°) in valore PWM per servo"""
    # Servo standard: 0.5ms (0°) a 2.5ms (180°)
    # Valori micro:bit: 26 a 128
    pwm_value = int((angle / 180) * (128 - 26)) + 26
    return pwm_value

def control_servos(pot1_val, pot2_val, pot3_val):
    """Controlla tutti e tre i servo basandosi sui valori ricevuti"""
    # Calcola angoli
    angle1 = pot_to_angle(pot1_val)
    angle2 = pot_to_angle(pot2_val)
    angle3 = pot_to_angle(pot3_val)
    
    # Calcola valori PWM
    pwm1 = angle_to_pwm(angle1)
    pwm2 = angle_to_pwm(angle2)
    pwm3 = angle_to_pwm(angle3)
    
    # Applica ai servo
    pin8.write_analog(pwm1)   # Servo 1
    pin12.write_analog(pwm2)  # Servo 2
    pin16.write_analog(pwm3)  # Servo 3
    
    return angle1, angle2, angle3

def control_led(button_state):
    """Controlla il LED esterno in base allo stato del pulsante
    Inverte la logica: LED acceso quando pulsante non premuto (0) e spento quando premuto (1)"""
    inverted_state = 1 - button_state  # Inverte lo stato: 0→1, 1→0
    pin14.write_digital(inverted_state)
    return inverted_state

def parse_radio_message(message):
    """Decodifica messaggio radio nel formato P1:val1,P2:val2,P3:val3,BTN:state"""
    try:
        # Divide il messaggio per virgola
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

def initialize_servos():
    """Inizializza tutti i servo alla posizione centrale"""
    center_pwm = angle_to_pwm(90)  # 90 gradi = centro
    
    pin8.write_analog(center_pwm)   # Servo 1 centro
    pin12.write_analog(center_pwm)  # Servo 2 centro
    pin16.write_analog(center_pwm)  # Servo 3 centro
    
    print("ALL_SERVOS_CENTERED")

def show_connection_status(connected):
    """Mostra stato connessione radio"""
    if connected:
        display.show(Image.YES)  # Connesso
    else:
        display.show(Image.NO)   # Disconnesso

# ===========================================
# SETUP INIZIALE
# ===========================================

print("RECEIVER_INIT")

# Spegni display completamente
display.off()

# Inizializza servo al centro
initialize_servos()
sleep(2000)  # Attesa per posizionamento

print("RADIO_RECEIVER_READY")

# ===========================================
# LOOP PRINCIPALE RICEZIONE
# ===========================================

# Variabili per timeout connessione
last_receive_time = 0
connection_timeout = 2000  # 2 secondi senza dati = disconnesso
is_connected = False

# Valori servo correnti
current_pot1 = 512  # Valore centrale iniziale
current_pot2 = 512
current_pot3 = 512
current_button = 0  # Pulsante inizialmente rilasciato

while True:
    current_time = running_time()
    
    # Controlla messaggi radio
    message = radio.receive()
    
    if message:
        # Decodifica messaggio
        pot1_val, pot2_val, pot3_val, button_state, valid = parse_radio_message(message)
        
        if valid:
            # Aggiorna valori servo e pulsante
            current_pot1 = pot1_val
            current_pot2 = pot2_val
            current_pot3 = pot3_val
            current_button = button_state
            
            # Controlla servo
            angle1, angle2, angle3 = control_servos(pot1_val, pot2_val, pot3_val)
            
            # Controlla LED esterno
            led_state = control_led(button_state)
            
            # Aggiorna stato connessione
            last_receive_time = current_time
            is_connected = True
            
            # Debug
            print("RX: P1={} P2={} P3={} BTN={} | A1={} A2={} A3={} LED={}".format(
                pot1_val, pot2_val, pot3_val, button_state,
                round(angle1), round(angle2), round(angle3), 1-button_state))
    
    # Controlla timeout connessione
    if current_time - last_receive_time > connection_timeout:
        if is_connected:
            is_connected = False
            print("CONNECTION_LOST")
            # Torna al centro quando si perde la connessione
            initialize_servos()
            # Spegni il LED quando si perde la connessione
            control_led(0)  # 0 = pulsante non premuto, quindi LED acceso con logica invertita
    
    # Refresh veloce
    sleep(10)