"""
Inspect ONNX models to understand their architecture, input/output shapes,
and class count — helps debug why the cow model is false-positive on non-animals.
Uses only onnx (graph inspection) — no onnxruntime needed.
"""
import onnx
import numpy as np
import json
import struct

def inspect_model(path, label):
    print(f"\n{'='*60}")
    print(f"  {label}: {path}")
    print(f"{'='*60}")
    
    # Load ONNX graph
    model = onnx.load(path)
    print(f"\n  ONNX IR version: {model.ir_version}")
    opsets = [str(op.domain or "ai.onnx") + ":" + str(op.version) for op in model.opset_import]
    print(f"  Opset:          {opsets}")
    print(f"  Producer:       {model.producer_name} {model.producer_version}")
    
    # Check metadata
    if model.metadata_props:
        print(f"\n  Metadata:")
        for prop in model.metadata_props:
            val = prop.value
            if prop.key == 'names':
                try:
                    names = eval(val)  # dict like {0: 'cow', 1: 'buffalo'}
                    print(f"    {prop.key}: {names}")
                except:
                    print(f"    {prop.key}: {val[:300]}")
            else:
                print(f"    {prop.key}: {val[:300]}")
    
    # Inputs
    print(f"\n  Inputs:")
    for inp in model.graph.input:
        shape = [d.dim_value if d.dim_value else d.dim_param for d in inp.type.tensor_type.shape.dim]
        print(f"    {inp.name}: shape={shape}, dtype={inp.type.tensor_type.elem_type}")
    
    # Outputs
    print(f"\n  Outputs:")
    for out in model.graph.output:
        shape = [d.dim_value if d.dim_value else d.dim_param for d in out.type.tensor_type.shape.dim]
        print(f"    {out.name}: shape={shape}, dtype={out.type.tensor_type.elem_type}")
        
        # For YOLOv8: output shape is typically [1, num_fields, num_detections]
        if len(shape) == 3 and isinstance(shape[1], int) and isinstance(shape[2], int):
            num_fields = shape[1]
            num_dets = shape[2]
            num_classes = num_fields - 4
            print(f"    → YOLOv8 format: {num_fields} fields, {num_dets} detections, {num_classes} class(es)")
            if num_classes == 1:
                print(f"    ★ SINGLE-CLASS model (only 1 class - probably treats everything as that class)")
            elif num_classes == 80:
                print(f"    ★ COCO 80-CLASS model (generic object detector, not cattle-specific!)")
                print(f"      COCO classes include: person, bicycle, car, motorbike, ... cow is class 19")
            else:
                print(f"    ★ Custom {num_classes}-class model")
    
    # Check class names from metadata
    class_names = None
    for prop in model.metadata_props:
        if prop.key == 'names':
            try:
                class_names = eval(prop.value)
                print(f"\n  ★ CLASS NAMES MAP: {class_names}")
                print(f"  ★ Number of classes: {len(class_names)}")
            except:
                print(f"\n  ★ Raw names: {prop.value[:300]}")
    
    return class_names

# Inspect both models
print("\n" + "▓"*60)
print("  MODEL INSPECTION REPORT")
print("▓"*60)

cow_classes = inspect_model("cow_test.onnx", "COW DETECTION MODEL")
muzzle_classes = inspect_model("muzzle_test.onnx", "MUZZLE DETECTION MODEL")

# Analysis
print(f"\n\n{'='*60}")
print("  DIAGNOSIS")
print(f"{'='*60}")

if cow_classes:
    if len(cow_classes) == 80:
        print("""
  ❌ PROBLEM FOUND: The cow model is a COCO YOLOv8 model (80 classes).
     It detects ALL 80 COCO object categories (person, car, chair, etc.)
     and our code treats ANY detection as a "cow" because it doesn't
     filter by class index.
     
  The code's parseOutput() takes the MAX confidence across ALL classes,
  so a "person" detected at 80% confidence gets labeled as "cow 80%".
     
  FIX OPTIONS:
  1. Filter by cattle class index (COCO class 19=cow, 20=sheep, 21=horse)
  2. Use a cattle-specific fine-tuned model (1-class: cow only)
  3. Use COCO model but only accept class indices 19,20,21 (livestock)
""")
    elif len(cow_classes) == 1:
        class_name = cow_classes.get(0, 'unknown')
        print(f"""
  ℹ️  The cow model is a SINGLE-CLASS model: class 0 = '{class_name}'
     With a single-class model trained properly on cattle only,
     false positives on non-animals suggest the model was trained on
     generic data or the confidence threshold is too low (currently 0.40).
""")
else:
    print("\n  ⚠️  Could not determine class names from model metadata.")

