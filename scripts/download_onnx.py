"""Download pre-converted YOLOv8n ONNX model."""
import requests
import os

OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'models', 'yolov8n.onnx')

urls = [
    'https://media.roboflow.com/onnx-models/yolov8n.onnx',
    'https://raw.githubusercontent.com/jamjamjon/assets/main/onnx/yolov8-n-dyn-f32.onnx',
]

for url in urls:
    try:
        print(f'Trying {url} ...')
        resp = requests.head(url, allow_redirects=True, timeout=15)
        print(f'  Status: {resp.status_code}')
        if resp.status_code == 200:
            print('  Downloading...')
            r = requests.get(url, allow_redirects=True, timeout=120)
            os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
            with open(OUT_PATH, 'wb') as f:
                f.write(r.content)
            size_mb = len(r.content) / (1024 * 1024)
            print(f'  Downloaded {size_mb:.1f} MB -> {OUT_PATH}')
            break
    except Exception as e:
        print(f'  Error: {e}')
else:
    print('All URLs failed')
