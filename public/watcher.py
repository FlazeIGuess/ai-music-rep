import spotipy
from spotipy.oauth2 import SpotifyPKCE
import time
import requests
import webbrowser
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
import os

# --- CONFIGURATION ---
CLIENT_ID = "YOUR_32_CHARACTER_CLIENT_ID_HERE"  # Replace with your actual Client ID
REDIRECT_URI = "http://127.0.0.1:8888"
SCOPE = "user-read-playback-state user-modify-playback-state"
API_BASE_URL = "https://ai-musician-list.tanzstoff.de/api"
CACHE_PATH = ".token_cache"

# --- GLOBAL VARIABLES ---
sp = None
blocked_artist_ids = set()
last_track_id = None
stop_event = threading.Event()

# --- AUTHENTICATION SERVER ---
class AuthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global sp
        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        if "code=" in self.path:
            self.wfile.write(b"<html><body><h1>Authentication successful!</h1><p>You can close this window now.</p></body></html>")
            code = self.path.split("code=")[1].split("&")[0]
            threading.Thread(target=self.server.get_token_and_shutdown, args=(code,)).start()
        else:
            self.wfile.write(b"<html><body><h1>Authentication failed.</h1><p>Please try running the script again.</p></body></html>")
            stop_event.set()

class StoppableHTTPServer(HTTPServer):
    def __init__(self, server_address, RequestHandlerClass):
        super().__init__(server_address, RequestHandlerClass)
        self.token_code = None
        self.oauth = None
        self.code_verifier = None

    def get_token_and_shutdown(self, code):
        try:
            token_url = "https://accounts.spotify.com/api/token"
            payload = {
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': REDIRECT_URI,
                'client_id': CLIENT_ID,
                'code_verifier': self.code_verifier
            }
            response = requests.post(token_url, data=payload)
            response.raise_for_status()

            # Compute expires_at from expires_in
            raw = response.json()
            raw['expires_at'] = int(time.time()) + raw.get('expires_in', 0)

            # Manually save the token to the cache
            self.oauth.cache_handler.save_token_to_cache(raw)
            print("Token received and saved successfully.")

        except Exception as e:
            print(f"Error getting token: {e}")
            if 'response' in locals() and response is not None:
                print("Response from Spotify:", response.text)

        finally:
            threading.Thread(target=self.shutdown).start()


def run_auth_server(oauth, code_verifier):
    server_address = ('', 8888)
    httpd = StoppableHTTPServer(server_address, AuthHandler)
    httpd.oauth = oauth
    httpd.code_verifier = code_verifier
    print("Starting temporary server for Spotify authentication...")
    httpd.serve_forever()

# --- AUTHENTICATION FLOW ---
def authenticate_spotify():
    global sp
    if 'SPOTIPY_CLIENT_SECRET' not in os.environ:
        os.environ['SPOTIPY_CLIENT_SECRET'] = ''

    auth_manager = SpotifyPKCE(
        client_id=CLIENT_ID,
        redirect_uri=REDIRECT_URI,
        scope=SCOPE,
        cache_path=CACHE_PATH,
        open_browser=False
    )

    token_info = auth_manager.get_cached_token()
    if not token_info:
        print("No cached token found. Starting authentication flow.")

        # PKCE‑Handshake: Spotipy generiert intern verifier + challenge
        auth_manager.get_pkce_handshake_parameters()
        code_verifier = auth_manager.code_verifier

        # Build authorization URL
        auth_url = auth_manager.get_authorize_url()

        server_thread = threading.Thread(
            target=run_auth_server,
            args=(auth_manager, code_verifier)
        )
        server_thread.daemon = True
        server_thread.start()

        print(f"\n--- ACTION REQUIRED ---\nPlease open this URL in your browser to log in:\n{auth_url}\n-----------------------\n")
        webbrowser.open(auth_url)
        server_thread.join()

    try:
        sp = spotipy.Spotify(auth_manager=auth_manager)
        user = sp.current_user()
        print(f"\nSuccessfully authenticated as {user['display_name']}.")
        return True
    except Exception as e:
        print(f"Authentication failed: {e}")
        if os.path.exists(CACHE_PATH):
            os.remove(CACHE_PATH)
            print("Removed corrupted token cache. Please restart the script.")
        return False

# --- FETCH & MONITOR FUNCTIONS ---
def fetch_blocked_artists():
    global blocked_artist_ids
    try:
        response = requests.get(f"{API_BASE_URL}/artists")
        response.raise_for_status()
        artists = response.json().get("artists", [])
        new_ids = {artist["spotify_id"] for artist in artists}
        if new_ids != blocked_artist_ids:
            blocked_artist_ids = new_ids
            print(f"Updated watchlist: {len(blocked_artist_ids)} artists are now on the list.")
    except requests.exceptions.RequestException as e:
        print(f"Could not fetch artist list: {e}")

def check_playback():
    global last_track_id, sp
    try:
        playback = sp.current_playback()
        if playback and playback["is_playing"] and playback["item"]:
            track = playback["item"]
            track_id = track["id"]
            if track_id != last_track_id:
                last_track_id = track_id
                artist_ids = {a["id"] for a in track["artists"]}
                print(f"Now Playing: {track['name']} by {', '.join(a['name'] for a in track['artists'])}")
                if not artist_ids.isdisjoint(blocked_artist_ids):
                    print("-> Blocked artist detected! Skipping track...")
                    sp.next_track()
                    time.sleep(2)
    except Exception as e:
        print(f"Playback check error: {e}")

# --- MAIN LOOP ---
def main():
    print("--- AI Musician List Watcher ---")
    if not CLIENT_ID or len(CLIENT_ID) != 32:
        print("ERROR: Please set CLIENT_ID to your 32-character Spotify Client ID.")
        return
    if not authenticate_spotify():
        return

    print("\nStarting monitoring loop. Press Ctrl+C to stop.")
    fetch_blocked_artists()
    last_update_time = time.time()

    try:
        while not stop_event.is_set():
            check_playback()
            if time.time() - last_update_time > 300:
                fetch_blocked_artists()
                last_update_time = time.time()
            time.sleep(5)
    except KeyboardInterrupt:
        print("\nStopping watcher. Goodbye!")
        stop_event.set()

if __name__ == "__main__":
    main()
