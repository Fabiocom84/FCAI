import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import gspread
from datetime import datetime
import logging
from google.oauth2 import credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.cloud import speech_v1
from flask import Flask
from flask_cors import CORS
from google.oauth2 import service_account
import io

app = Flask(__name__)
CORS(app, origins=["http://localhost:8080", "null"]) # Aggiungi "null" alle origini consentite

# Configura il logging
logging.basicConfig(level=logging.INFO)

# Percorso al file JSON della chiave del Service Account
CREDENTIALS_PATH = 'C:/Users/fabio/Desktop/Segretario AI/Pagina web/index 13/backend_python/segretario-ai-web-app-4bb451e9acd5.json'
SPREADSHEET_ID = '1XQJ0Py2aACDtcOnc7Mi2orqaKWbNpZbpp9lAnIm1kv8'
WORKSHEET_NAME = 'Foglio1'
DRIVE_FOLDER_ID = '1C-sveS2MD3oPRfOVuy97PoiTyImh3vPa'  # <-- Inserisci qui l'ID della cartella
client = speech_v1.SpeechClient.from_service_account_file(CREDENTIALS_PATH)

default_language_code = "it-IT"
supported_audio_encoding = "WEBM_OPUS"
default_sample_rate_hertz = 48000

def access_spreadsheet():
    try:
        gc = gspread.service_account(filename=CREDENTIALS_PATH)
        spreadsheet = gc.open_by_key(SPREADSHEET_ID)
        worksheet = spreadsheet.worksheet(WORKSHEET_NAME)
        logging.info("Foglio di calcolo Google Sheets acceduto con successo.")
        return worksheet
    except Exception as e:
        logging.error(f"Errore durante l'accesso al foglio di calcolo: {e}")
        return None

def get_drive_service():
    try:
        creds = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
        drive_service = build('drive', 'v3', credentials=creds)
        logging.info("Servizio Google Drive inizializzato con successo.")
        return drive_service
    except Exception as e:
        logging.error(f"Errore durante l'inizializzazione del servizio Google Drive: {e}")
        return None

def upload_file_to_drive(drive_service, file_data, file_name, mime_type):
    """Carica un file su Google Drive e restituisce l'URL."""
    try:
        logging.info(f"Inizio caricamento file: {file_name} con MIME type: {mime_type}")
        logging.info(f"Dimensione del file da caricare: {file_data.getbuffer().nbytes} bytes")
        logging.info(f"ID della cartella di destinazione: {DRIVE_FOLDER_ID}")
        file_metadata = {'name': file_name, 'parents': [DRIVE_FOLDER_ID]}
        logging.info(f"Metadati del file: {file_metadata}")
        media = MediaIoBaseUpload(file_data, mimetype=mime_type, resumable=True)
        request = drive_service.files().create(body=file_metadata, media_body=media) # Modifica qui
        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                logging.info("Caricamento %d%%." % (status.progress() * 100))
        logging.info("Caricamento completato.")

        file_id = response.get('id')
        file_url = f"https://drive.google.com/file/d/{file_id}/view?usp=sharing"
        logging.info(f"File caricato con ID: {file_id}, URL: {file_url}")
        return file_url
    except Exception as e:
        logging.error(f"Errore durante il caricamento del file su Google Drive: {e}")
        return None

@app.route('/api/upload-and-save', methods=['POST'])
def upload_and_save():
    """Riceve il file, lo carica su Google Drive, ottiene l'URL e salva i dati nel foglio di calcolo."""
    logging.info("Ricevuta richiesta di upload e salvataggio dati.")
    testo_manuale = request.form.get('manualTextInput', '')
    trascrizione_vocale = request.form.get('voiceTranscription', '')
    testo_unito = testo_manuale + " " + trascrizione_vocale

    file_obj = request.files.get('file')
    if not file_obj:
        logging.info("Ricevuta richiesta senza file.")

    worksheet = access_spreadsheet()
    drive_service = get_drive_service()
    file_url = ""

    if file_obj and drive_service:
        try:
            mime_type = file_obj.content_type
            file_data = file_obj.read()
            file_url = upload_file_to_drive(drive_service, io.BytesIO(file_data), file_obj.filename, mime_type)
            logging.info(f"URL del file da Google Drive: {file_url}") 
            if not file_url:
                return jsonify({'error': 'Impossibile caricare il file su Google Drive.'}), 500
        except Exception as e:
            logging.error(f"Errore durante l'elaborazione del file: {e}")
            return jsonify({'error': 'Errore durante l\'elaborazione del file.'}), 500

    if worksheet:
        try:
            logging.info(f"Dati da salvare nel foglio di lavoro: data={datetime.now().strftime('%Y-%m-%d %H:%M:%S')}, testo_unito={testo_unito}, file_url={file_url}") #aggiunto
            worksheet.append_row([datetime.now().strftime("%Y-%m-%d %H:%M:%S"), testo_unito, file_url])
            logging.info("Dati salvati con successo nel foglio di calcolo.")
            return jsonify({'message': 'Dati salvati con successo.'})
        except Exception as e:
            logging.error(f"Errore durante il salvataggio dei dati nel foglio di calcolo: {e}")
            return jsonify({'error': 'Impossibile salvare i dati.'}), 500
    else:
        logging.error("Impossibile accedere al foglio di calcolo.")
        return jsonify({'error': 'Impossibile accedere al foglio di calcolo.'}), 500

@app.route('/api/latest-entries', methods=['GET'])
def get_latest_entries():
    worksheet = access_spreadsheet()
    if worksheet:
        try:
            all_values = worksheet.get_all_values()
            if len(all_values) > 1:  # Assicurati che ci siano dati oltre all'header
                # Ottieni le ultime 5 righe (o meno se ce ne sono meno di 5) escludendo l'header
                latest_entries = all_values[-(min(5, len(all_values) - 1)):]
                # Inverti l'ordine per mostrare le più recenti per prime
                latest_entries_reversed = latest_entries[::-1]
                # Estrai l'header dalla prima riga e convertilo in minuscolo per uniformità
                headers = [header.lower() for header in all_values[0]]
                # Crea una lista di dizionari, dove ogni dizionario rappresenta una riga
                latest_entries_formatted = [dict(zip(headers, row)) for row in latest_entries_reversed]
                logging.info(f"Ultimi inserimenti recuperati: {latest_entries_formatted}")
                return jsonify(latest_entries_formatted)
            else:
                logging.info("Nessun inserimento recente trovato nel foglio di calcolo.")
                return jsonify([])
        except Exception as e:
            logging.error(f"Errore durante il recupero degli ultimi inserimenti: {e}")
            return jsonify({'error': 'Impossibile recuperare gli ultimi inserimenti.'}), 500
    else:
        logging.error("Impossibile accedere al foglio di calcolo durante il recupero degli ultimi inserimenti.")
        return jsonify({'error': 'Impossibile accedere al foglio di calcolo.'}), 500

@app.route('/api/transcribe-voice', methods=['POST'])
def transcribe_voice():
    # 1. Verifica la presenza del file audio
    if 'audio' not in request.files:
        return jsonify({'error': 'Nessun file audio fornito nella richiesta.'}), 400

    audio_file = request.files['audio']

    # 2. Verifica che il file non sia vuoto e abbia un nome
    if audio_file.filename == '':
        return jsonify({'error': 'Il file audio inviato è vuoto.'}), 400

    # 3. Leggi il contenuto del file audio
    audio_content = audio_file.read()

    # 4. Configura l'oggetto Audio
    audio = speech_v1.RecognitionAudio(content=audio_content)

    # 5. Configura la richiesta di riconoscimento
    language_code = request.form.get('language', default_language_code)
    try:
        sample_rate_hertz = int(request.form.get('sampleRate', default_sample_rate_hertz))
    except ValueError:
        sample_rate_hertz = default_sample_rate_hertz
    audio_encoding_str = request.form.get('encoding', supported_audio_encoding).upper().replace('-', '_')
    try:
        audio_encoding = getattr(speech_v1.RecognitionConfig.AudioEncoding, audio_encoding_str)
    except AttributeError:
        return jsonify({'error': f'Codifica audio non supportata: {audio_encoding_str}.'}), 400

    config = speech_v1.RecognitionConfig(
        encoding=audio_encoding,
        sample_rate_hertz=sample_rate_hertz,
        language_code=language_code,
    )

    # 6. Invia la richiesta di riconoscimento
    try:
        operation = client.long_running_recognize(config=config, audio=audio)
        print("Elaborazione in corso...")
        response = operation.result(timeout=300) # Timeout massimo di 5 minuti

        transcript = ""
        for result in response.results:
            transcript += result.alternatives[0].transcript + " "

        return jsonify({'transcription': transcript.strip()})

    except Exception as e:
        print(f"Errore durante la trascrizione: {e}")
        return jsonify({'error': f'Errore durante la trascrizione: {str(e)}'}), 500

@app.route('/api/save-transcription', methods=['POST'])
def save_transcription():
    data = request.get_json()
    logging.info(f"Ricevuta richiesta di salvataggio con i dati: {data}")
    transcription = data.get('transcription')
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if not transcription:
        logging.warning("Ricevuta richiesta di salvataggio senza trascrizione.")
        return jsonify({'error': 'Trascrizione mancante.'}), 400

    worksheet = access_spreadsheet()
    if worksheet:
        logging.info(f"Tentativo di scrivere nel foglio di calcolo: Timestamp='{timestamp}', Trascrizione='{transcription}'")
        try:
            worksheet.append_row([timestamp, transcription])
            logging.info("Trascrizione salvata con successo nel foglio di calcolo.")
            return jsonify({'message': 'Trascrizione salvata con successo.'})
        except Exception as e:
            logging.error(f"Errore durante il salvataggio della trascrizione nel foglio di calcolo: {e}")
            return jsonify({'error': 'Impossibile salvare la trascrizione.'}), 500
    else:
        logging.error("Impossibile accedere al foglio di calcolo, quindi la trascrizione non è stata salvata.")
        return jsonify({'error': 'Impossibile accedere al foglio di calcolo.'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)