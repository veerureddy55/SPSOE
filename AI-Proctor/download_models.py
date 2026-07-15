import os
import requests

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

# Files to download
FILES = {
    'deploy.prototxt': 'https://raw.githubusercontent.com/chuanqi305/MobileNet-SSD/master/deploy.prototxt',
    'mobilenet_iter_73000.caffemodel': 'https://raw.githubusercontent.com/chuanqi305/MobileNet-SSD/master/mobilenet_iter_73000.caffemodel',
    'haarcascade_frontalface_default.xml': 'https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml',
    'haarcascade_eye.xml': 'https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_eye.xml'
}

def download_file(url, target_path):
    print(f"Downloading {url}...")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        with open(target_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        print(f"Saved: {target_path}")
    except Exception as e:
        print(f"Failed to download {url}: {e}")

def main():
    if not os.path.exists(MODELS_DIR):
        os.makedirs(MODELS_DIR)
        print(f"Created models directory: {MODELS_DIR}")
        
    for filename, url in FILES.items():
        path = os.path.join(MODELS_DIR, filename)
        if not os.path.exists(path) or os.path.getsize(path) < 1000: # Re-download if empty/invalid
            download_file(url, path)
        else:
            print(f"File already exists: {filename}")
            
    print("Download script finished.")

if __name__ == '__main__':
    main()
