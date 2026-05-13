#!/usr/bin/env python3
"""
Face detection + embedding extraction via DeepFace (Facenet, opencv detector).
Called as subprocess: python3 face_detect.py <image_path>
Writes JSON array to stdout. Each item: {embedding, box (normalized 0-1), confidence}
"""
import sys
import json
import os

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['CUDA_VISIBLE_DEVICES'] = ''

def main():
    if len(sys.argv) < 2:
        print(json.dumps([]))
        return

    image_path = sys.argv[1]

    try:
        import cv2
        from deepface import DeepFace

        # Get image dimensions for normalization
        img = cv2.imread(image_path)
        if img is None:
            print(json.dumps([]))
            return
        ih, iw = img.shape[:2]

        results = DeepFace.represent(
            image_path,
            model_name='Facenet',
            detector_backend='opencv',
            enforce_detection=True,
            align=True,
        )

        faces = []
        for r in results:
            area = r.get('facial_area', {})
            x = area.get('x', 0)
            y = area.get('y', 0)
            w = area.get('w', 0)
            h = area.get('h', 0)
            confidence = r.get('face_confidence', 0.9)

            faces.append({
                'embedding': r['embedding'],
                'box': {
                    'x': x / iw,
                    'y': y / ih,
                    'width': w / iw,
                    'height': h / ih,
                },
                'confidence': confidence,
            })

        print(json.dumps(faces))

    except Exception as e:
        sys.stderr.write(f"[face_detect.py] {e}\n")
        print(json.dumps([]))

if __name__ == '__main__':
    main()
