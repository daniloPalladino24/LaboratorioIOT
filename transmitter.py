from microbit import *
import radio

# ===========================================
# SCHEDA TRASMITTENTE - POTENZIOMETRI E PULSANTE
# ===========================================
# PIN0 = Potenziometro 1 (centro del pot)
# PIN1 = Potenziometro 2 (centro del pot)
# PIN2 = Potenziometro 3 (centro del pot)
# PIN5 = Pulsante esterno (button switch)
# 3V = Alimentazione (+) per potenziometri e pulsante
# GND = Terra (-) per potenziometri e pulsante

# ===========================================
# CONFIGURAZIONE RADIO
# ===========================================
radio.on()
radio.config(channel=42, power=7, length=100)  # Canale 42, potenza max

# ===========================================
# CONFIGURAZIONE PULSANTE
# ===========================================
pin5.set_pull(pin5.PULL_DOWN)  # Pull-down interno per evitare fluttuazioni

# ===========================================
# FUNZIONI LETTURA POTENZIOMETRI E PULSANTE
# ===========================================
def read_potentiometers():
    """Legge tutti e tre i potenziometri - valori grezzi 0-1023"""
    pot1_raw = pin0.read_analog()  # Potenziometro 1 (0-1023)
    pot2_raw = pin1.read_analog()  # Potenziometro 2 (0-1023)
    pot3_raw = pin2.read_analog()  # Potenziometro 3 (0-1023)
    
    return pot1_raw, pot2_raw, pot3_raw

def read_button():
    """Legge lo stato del pulsante sul PIN5"""
    return pin5.read_digital()

def create_radio_message(pot1, pot2, pot3, button_state):
    """Crea messaggio compatto per trasmissione radio, includendo lo stato del pulsante"""
    # Formato: "P1:valore1,P2:valore2,P3:valore3,BTN:stato"
    message = "P1:{},P2:{},P3:{},BTN:{}".format(pot1, pot2, pot3, button_state)
    return message

def send_radio_data(pot1, pot2, pot3, button_state):
    """Invia dati via radio"""
    message = create_radio_message(pot1, pot2, pot3, button_state)
    radio.send(message)

def show_pot_values(pot1, pot2, pot3):
    """Mostra valori potenziometri su display (opzionale)"""
    # Mostra quale potenziometro è più alto
    max_pot = max(pot1, pot2, pot3)
    if pot1 == max_pot:
        display.show("1")
    elif pot2 == max_pot:
        display.show("2")
    else:
        display.show("3")

# ===========================================
# SETUP INIZIALE
# ===========================================
print("TRANSMITTER_INIT")

# Spegni display completamente
display.off()

print("RADIO_TRANSMITTER_READY")

# ===========================================
# LOOP PRINCIPALE TRASMISSIONE
# ===========================================
send_interval = 100  # Invia ogni 100ms per controllo fluido
last_send = 0
last_values = [0, 0, 0, 0]  # Per rilevare cambiamenti (pot1, pot2, pot3, button)

while True:
    current_time = running_time()
    
    # Leggi potenziometri (valori grezzi 0-1023)
    pot1_value, pot2_value, pot3_value = read_potentiometers()
    
    # Leggi stato pulsante
    button_state = read_button()
    
    # Controlla se ci sono cambiamenti significativi
    change_detected = (abs(pot1_value - last_values[0]) > 10 or
                      abs(pot2_value - last_values[1]) > 10 or
                      abs(pot3_value - last_values[2]) > 10 or
                      button_state != last_values[3])
    
    # Invia dati se è passato abbastanza tempo O se ci sono cambiamenti
    if current_time - last_send >= send_interval or change_detected:
        send_radio_data(pot1_value, pot2_value, pot3_value, button_state)
        last_send = current_time
        last_values = [pot1_value, pot2_value, pot3_value, button_state]
        
        # Debug via seriale
        print("TX: P1={} P2={} P3={} BTN={}".format(
            pot1_value, pot2_value, pot3_value, button_state))
