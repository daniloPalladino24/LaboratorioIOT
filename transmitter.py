from microbit import *
import radio

# ===========================================
# SCHEDA TRASMITTENTE - POTENZIOMETRI E PULSANTE
# ===========================================
# PIN0 = Potenziometro 1 (centro del pot)
# PIN1 = Potenziometro 2 (centro del pot)
# PIN2 = Potenziometro 3 (centro del pot)
# PIN5 = Pulsante esterno (button switch)
# 5V = Alimentazione (+) per potenziometri e pulsante
# GND = Terra (-) per potenziometri e pulsante

radio.on()
radio.config(channel=42, power=7, length=100)

pin5.set_pull(pin5.PULL_DOWN) #Resistenza interna che mantiene il pin a 0V quando pulsante non è premuto

def read_potentiometers():
    pot1_raw = pin0.read_analog()
    pot2_raw = pin1.read_analog()
    pot3_raw = pin2.read_analog()
    return pot1_raw, pot2_raw, pot3_raw

def read_button():
    return pin5.read_digital()

def create_radio_message(pot1, pot2, pot3, button_state):
    message = "P1:{},P2:{},P3:{},BTN:{}".format(pot1, pot2, pot3, button_state)
    return message

def send_radio_data(pot1, pot2, pot3, button_state):
    message = create_radio_message(pot1, pot2, pot3, button_state)
    radio.send(message)

display.off()

send_interval = 100
last_send = 0
last_values = [0, 0, 0, 0]

while True:
    current_time = running_time()
    pot1_value, pot2_value, pot3_value = read_potentiometers()
    button_state = read_button()
    change_detected = (abs(pot1_value - last_values[0]) > 10 or
                      abs(pot2_value - last_values[1]) > 10 or
                      abs(pot3_value - last_values[2]) > 10 or
                      button_state != last_values[3])
    
    if current_time - last_send >= send_interval or change_detected:
        send_radio_data(pot1_value, pot2_value, pot3_value, button_state)
        last_send = current_time
        last_values = [pot1_value, pot2_value, pot3_value, button_state]