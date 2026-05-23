#!/usr/bin/env python3
"""Static dev-сервер с Cache-Control: no-store.

Default python -m http.server отдаёт ES-модули без cache-control, и браузер
держит их в memory-cache между перезагрузками — изменения в src/*.js не
видны без хард-рефреша. Этот wrapper всегда говорит no-store.
"""
import http.server
import socketserver
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    with socketserver.TCPServer(('', port), NoCacheHandler) as httpd:
        print(f'serving on http://localhost:{port}/  (no-cache)')
        httpd.serve_forever()


if __name__ == '__main__':
    main()
