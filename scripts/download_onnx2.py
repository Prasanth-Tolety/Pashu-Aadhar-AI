"""Download pre-converted YOLOv8n ONNX model from HuggingFace."""
import requests
import os

OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'models', 'yolov8n.onnx')

headers = {'User-Agent': 'Mozilla/5.0'}

urls = [
    'https://objectstorage.ap-mumbai-1.oraclecloud.com/n/axvbgrnuo5zg/b/bucket-20250305-1400/o/yolov8n.onnx',
    'https://storage.googleapis.com/tfjs-models/savedmodel/yolov8n/model.onnx',
    'https://cdn.jsdelivr.net/gh/niccolovianello/yolov8_onnx@main/yolov8n.onnx',
]

for url in urls:
    try:
        print(f'Trying {url} ...')
        resp = requests.get(url, headers=headers, allow_redirects=True, timeout=120, stream=True)
        print(f'  Status: {resp.status_code}')
        cl = resp.headers.get('content-length', 'unknown')
        print(f'  Content-Length: {cl}')
        ct = resp.headers.get('content-type', 'unknown')
        print(f'  Content-Type: {ct}')
        
        if resp.status_code == 200 and ('octet' in ct or 'onnx' in ct or int(cl or 0) > 1000000):
            os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
            with open(OUT_PATH, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            size_mb = os.path.getsize(OUT_PATH) / (1024 * 1024)
            print(f'  Downloaded {size_mb:.1f} MB -> {OUT_PATH}')
            break
        else:
            print('  Skipping (not a valid ONNX file)')
    except Exception as e:
        print(f'  Error: {e}')
else:
    print('All URLs failed. Trying alternative method...')
    
    # Try npx approach
    print('Try: npx onnxruntime-node to convert or use Google Colab')
