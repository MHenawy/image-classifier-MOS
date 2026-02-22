import os
import json
import logging
from http.server import SimpleHTTPRequestHandler, HTTPServer
import urllib.parse
import shutil

# Set up logging
logging.basicConfig(level=logging.INFO)

class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # We add some CORS headers just in case, though it's served on the same origin
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/scrape':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                keyword = data.get('keyword')
                count = int(data.get('count', 10))
                class_name = data.get('className', 'unknown')
                
                logging.info(f"API Scrape Request: keyword={keyword}, count={count}, class={class_name}")
                
                # Import crawler
                from icrawler.builtin import BingImageCrawler
                output_dir = os.path.join('dataset', class_name)
                os.makedirs(output_dir, exist_ok=True)
                
                crawler = BingImageCrawler(
                    feeder_threads=1,
                    parser_threads=1,
                    downloader_threads=4,
                    storage={'root_dir': output_dir},
                    log_level=logging.ERROR # Reduce terminal noise
                )
                crawler.crawl(keyword=keyword, max_num=count, file_idx_offset='auto')
                
                # Read downloaded files
                files = os.listdir(output_dir)
                image_extensions = ('.jpg', '.jpeg', '.png', '.webp')
                images = [f'/dataset/{urllib.parse.quote(class_name)}/{urllib.parse.quote(f)}' for f in files if f.lower().endswith(image_extensions)]
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'images': images}).encode('utf-8'))
                
            except Exception as e:
                logging.error(f"Error scraping: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
            return

        elif self.path == '/api/open_folder':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                class_name = data.get('className')
                output_dir = os.path.abspath(os.path.join('dataset', class_name))
                if os.path.exists(output_dir) and os.name == 'nt':
                    os.startfile(output_dir)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
            except Exception as e:
                logging.error(f"Error opening folder: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
            return
            
        elif self.path == '/api/save_to_desktop':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                class_name = data.get('className')
                src = os.path.abspath(os.path.join('dataset', class_name))
                desktop = os.path.join(os.path.expanduser("~"), "Desktop")
                dst = os.path.join(desktop, class_name)
                
                if os.path.exists(src):
                    shutil.copytree(src, dst, dirs_exist_ok=True)
                    
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'path': dst}).encode('utf-8'))
            except Exception as e:
                logging.error(f"Error saving to desktop: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
            return
            
        return super().do_POST()

def run_server(port=8080):
    server_address = ('', port)
    httpd = HTTPServer(server_address, CustomHandler)
    print("=====================================================")
    print(f" VisionAI Backend Server is running at http://localhost:{port}")
    print("=====================================================")
    print("Ready to serve application and intercept scraping requests...")
    try:
         httpd.serve_forever()
    except KeyboardInterrupt:
         print("Shutting down server...")

if __name__ == '__main__':
    run_server()
