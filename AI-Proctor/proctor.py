import os
import sys
import base64
import json
import time
import io
import cv2
import numpy as np
import socketio
from PIL import Image

# Initialize Socket.io Client
sio = socketio.Client()

# Path configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')

# Load Haar Cascades
FACE_CASCADE_PATH = os.path.join(MODELS_DIR, 'haarcascade_frontalface_default.xml')
EYE_CASCADE_PATH = os.path.join(MODELS_DIR, 'haarcascade_eye.xml')

# Load MobileNet-SSD models
PROTOTXT_PATH = os.path.join(MODELS_DIR, 'deploy.prototxt')
CAFFEMODEL_PATH = os.path.join(MODELS_DIR, 'mobilenet_iter_73000.caffemodel')

# Global variables for models
face_cascade = None
eye_cascade = None
net = None

# Pascal VOC class names for MobileNet-SSD
CLASSES = [
    "background", "aeroplane", "bicycle", "bird", "boat",
    "bottle", "bus", "car", "cat", "chair", "cow", "diningtable",
    "dog", "horse", "motorbike", "person", "pottedplant",
    "sheep", "sofa", "train", "tvmonitor"
]

def load_models():
    global face_cascade, eye_cascade, net
    
    # Verify model files exist
    if not all(os.path.exists(p) for p in [FACE_CASCADE_PATH, EYE_CASCADE_PATH, PROTOTXT_PATH, CAFFEMODEL_PATH]):
        print("Model files are missing. Please run download_models.py first.")
        sys.exit(1)
        
    face_cascade = cv2.CascadeClassifier(FACE_CASCADE_PATH)
    eye_cascade = cv2.CascadeClassifier(EYE_CASCADE_PATH)
    net = cv2.dnn.readNetFromCaffe(PROTOTXT_PATH, CAFFEMODEL_PATH)
    print("All AI models loaded successfully.")

def base64_to_cv2(b64_str):
    if ',' in b64_str:
        b64_str = b64_str.split(',')[1]
    img_data = base64.b64decode(b64_str)
    nparr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def cv2_to_base64(img):
    _, buffer = cv2.imencode('.jpg', img)
    b64_str = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{b64_str}"

def process_frame_analysis(frame):
    """
    Runs face, eye, pose, and object detection on the frame.
    Returns: (violations_list, processed_frame)
    """
    violations = []
    h, w = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # 1. Face Detection
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    face_count = len(faces)
    
    # Copy of frame to draw overlays on
    overlay_frame = frame.copy()
    
    if face_count == 0:
        violations.append({
            'type': 'FACE_MISSING',
            'confidence': 0.95,
            'details': 'No student face detected in webcam view.'
        })
        cv2.putText(overlay_frame, "VIOLATION: FACE MISSING", (20, 40), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    elif face_count > 1:
        violations.append({
            'type': 'MULTIPLE_FACES',
            'confidence': 0.90,
            'details': f'Suspicious activity: Multiple people ({face_count}) detected.'
        })
        for (fx, fy, fw, fh) in faces:
            cv2.rectangle(overlay_frame, (fx, fy), (fx+fw, fy+fh), (0, 0, 255), 2)
        cv2.putText(overlay_frame, f"VIOLATION: MULTIPLE FACES ({face_count})", (20, 40), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    else:
        # Exactly one face - inspect eye tracking and head pose
        (fx, fy, fw, fh) = faces[0]
        cv2.rectangle(overlay_frame, (fx, fy), (fx+fw, fy+fh), (0, 255, 0), 2)
        
        # 1A. Head Pose/Symmetry Check (Simplified using landmarks ratio)
        # Check if the face is tilted or turned too far
        face_center_x = fx + fw / 2
        frame_center_x = w / 2
        deviation = abs(face_center_x - frame_center_x) / frame_center_x
        
        if deviation > 0.40: # Student is far off-center (likely looking away or leaning)
            violations.append({
                'type': 'UNUSUAL_HEAD_POSE',
                'confidence': 0.80,
                'details': 'Student head shifted far from center screen.'
            })
            cv2.putText(overlay_frame, "WARN: HEAD DEVIATION", (fx, fy - 10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 165, 255), 1)

        # 1B. Eye Gaze Tracking
        face_gray = gray[fy:fy+fh, fx:fx+fw]
        face_color = overlay_frame[fy:fy+fh, fx:fx+fw]
        
        eyes = eye_cascade.detectMultiScale(face_gray, scaleFactor=1.1, minNeighbors=4, minSize=(15, 15))
        
        # Focus on top half of the face for eyes to filter out nostrils/mouth corners
        eyes = [e for e in eyes if e[1] < fh * 0.55]
        
        for (ex, ey, ew, eh) in eyes[:2]:
            cv2.rectangle(face_color, (ex, ey), (ex+ew, ey+eh), (255, 255, 0), 1)
            
            # Simple pupil/gaze analysis
            eye_roi = face_gray[ey:ey+eh, ex:ex+ew]
            # Blur to remove noise
            eye_roi = cv2.GaussianBlur(eye_roi, (5, 5), 0)
            # Threshold to get dark pupil area
            _, threshold = cv2.threshold(eye_roi, 50, 255, cv2.THRESH_BINARY_INV)
            
            # Find contours
            contours, _ = cv2.findContours(threshold, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                # Get the largest contour which is likely the iris/pupil
                largest_contour = max(contours, key=cv2.contourArea)
                M = cv2.moments(largest_contour)
                if M['m00'] > 0:
                    cx = int(M['m10'] / M['m00'])
                    # Ratio of pupil center x to eye box width
                    ratio = cx / ew
                    
                    # If pupil is too close to left or right edges of the eye box, they are looking away
                    if ratio < 0.20 or ratio > 0.80:
                        violations.append({
                            'type': 'EYE_LOOKING_AWAY',
                            'confidence': 0.75,
                            'details': 'Student is repeatedly looking away from the exam interface.'
                        })
                        cv2.circle(face_color, (ex + cx, ey + int(M['m01'] / M['m00'])), 3, (0, 0, 255), -1)
                        cv2.putText(overlay_frame, "WARN: EYE DEVIATION", (20, 70), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)
                        break # alert once is enough

    # 2. Object Detection (using MobileNet-SSD)
    # Resize and construct blob
    blob = cv2.dnn.blobFromImage(cv2.resize(frame, (300, 300)), 0.007843, (300, 300), 127.5)
    net.setInput(blob)
    detections = net.forward()
    
    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        
        # Filter weak detections
        if confidence > 0.55:
            class_id = int(detections[0, 0, i, 1])
            class_name = CLASSES[class_id]
            
            # Map forbidden classes: tvmonitor (screens, phones), bottle (could be allowed, but monitor is forbidden)
            # MobileNetSSD sometimes maps cell phones to 'tvmonitor' or 'chair'
            if class_name in ['tvmonitor', 'laptop']:
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                (startX, startY, endX, endY) = box.astype("int")
                
                # Check for phone overlap
                violations.append({
                    'type': 'PROHIBITED_OBJECT',
                    'confidence': float(confidence),
                    'details': f'Forbidden device ({class_name}) detected in environment.'
                })
                
                cv2.rectangle(overlay_frame, (startX, startY), (endX, endY), (0, 0, 255), 2)
                label = f"FORBIDDEN: {class_name.upper()} {confidence * 100:.1f}%"
                cv2.putText(overlay_frame, label, (startX, startY - 10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                
    return violations, overlay_frame

# Socket.io connection handlers
@sio.event
def connect():
    print("Successfully connected to Node.js backend server.")
    sio.emit('register_ai_worker')
    print("Registered as active AI proctor worker.")

@sio.event
def disconnect():
    print("Disconnected from Node.js server.")

@sio.on('process_frame')
def on_process_frame(data):
    socket_id = data.get('socketId')
    frame_b64 = data.get('frame')
    exam_id = data.get('examId')
    user_id = data.get('userId')
    student_id = data.get('studentId')
    name = data.get('name')
    
    try:
        # 1. Decode frame
        frame = base64_to_cv2(frame_b64)
        
        # 2. Run analysis
        violations, processed_frame = process_frame_analysis(frame)
        
        # 3. If violations are found, encode processed image and report back to server
        for violation in violations:
            evidence_b64 = cv2_to_base64(processed_frame)
            
            sio.emit('ai_violation_result', {
                'studentSocketId': socket_id,
                'userId': user_id,
                'examId': exam_id,
                'studentId': student_id,
                'name': name,
                'violationType': violation['type'],
                'confidence': violation['confidence'],
                'imageEvidence': evidence_b64,
                'details': violation['details']
            })
            print(f"[{name} - {violation['type']}] Reported violation with {violation['confidence']*100:.1f}% confidence.")
            
    except Exception as e:
        print(f"Error processing frame: {e}")

def main():
    load_models()
    
    # Get server URI from env or fallback
    server_url = os.environ.get('SERVER_URL', 'http://localhost:5000')
    
    print(f"Connecting to proctoring server at {server_url}...")
    try:
        sio.connect(server_url)
        sio.wait()
    except KeyboardInterrupt:
        print("\nStopping Python AI Proctor worker...")
        sio.disconnect()
    except Exception as e:
        print(f"Connection error: {e}")

if __name__ == '__main__':
    main()
