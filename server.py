"""
server.py
AuthGuard Server Entry Point

Owns the server lifecycle, port discovery, SMTP/transporter initialization,
and main execution loop.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=ROOT_DIR / '.env')

from app import app
from config.email_config import init_transporter


def find_available_port(start_port: int) -> int:
    """Scan for an available TCP port starting from start_port."""
    import socket
    for port in range(start_port, start_port + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
            if connection.connect_ex(('127.0.0.1', port)) != 0:
                return port
    return start_port


def start_server(port: int = None):
    """Initialize services and launch the Flask server."""
    if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    default_port = int(os.getenv('PORT') or 3000)
    actual_port = find_available_port(port or default_port)

    print('====================================================')
    print(f'[Server] AuthGuard running at: http://localhost:{actual_port}')
    print('====================================================')

    init_transporter()
    app.run(host='0.0.0.0', port=actual_port, debug=False, threaded=True)


if __name__ == '__main__':
    start_server()
