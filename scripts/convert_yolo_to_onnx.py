"""
Convert YOLOv8 .pt model to .onnx for browser use
Run: python scripts/convert_yolo_to_onnx.py
"""
import os
import sys
import shutil

PT_PATH = os.path.join(os.path.dirname(__file__), '..', 'yolov8n.pt')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'models')
OUT_PATH = os.path.join(OUT_DIR, 'yolov8n.onnx')

print("Converting YOLOv8n .pt → .onnx ...")
print(f"Input:  {os.path.abspath(PT_PATH)}")
print(f"Output: {os.path.abspath(OUT_PATH)}")

try:
    from ultralytics import YOLO
    model = YOLO(PT_PATH)
    exported = model.export(
        format='onnx',
        imgsz=640,
        opset=12,
        simplify=True,
        dynamic=False,
    )
    # ultralytics saves the onnx next to the .pt file
    exported_path = str(exported)
    if not exported_path.endswith('.onnx'):
        exported_path = os.path.splitext(os.path.abspath(PT_PATH))[0] + '.onnx'

    os.makedirs(OUT_DIR, exist_ok=True)
    shutil.copy2(exported_path, OUT_PATH)
    size_mb = os.path.getsize(OUT_PATH) / (1024 * 1024)
    print(f"\n✅ Done! {size_mb:.1f} MB → {OUT_PATH}")
    print("\nNext step: upload to S3:")
    print(f'  aws s3 cp "{OUT_PATH}" s3://pashu-aadhaar-website-prod/models/yolov8n.onnx --cache-control "max-age=31536000"')

except OSError as e:
    if 'DLL' in str(e) or 'WinError 1114' in str(e):
        print("\n❌ PyTorch DLL error on this machine.")
        print("Options:")
        print("  1. Reinstall PyTorch (CPU-only): pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu")
        print("  2. Use Google Colab to convert:")
        print("     !pip install ultralytics")
        print("     from ultralytics import YOLO")
        print("     YOLO('yolov8n.pt').export(format='onnx', imgsz=640, opset=12, simplify=True)")
        sys.exit(1)
    raise
