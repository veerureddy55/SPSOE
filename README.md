<<<<<<< HEAD
# Smart Proctoring System for Online Exams (SPSOE)

An advanced, production-ready AI-powered remote examination platform that ensures exam integrity using Artificial Intelligence, Computer Vision, and real-time monitoring.

---

## Key Features

*   **Secure Identity Verification**: Facial recognition matching against registered profile images and liveness verification before unlocking exams.
*   **Real-Time Computer Vision Proctoring**: Detects:
    *   **Multiple Faces**: Flags if additional people enter the camera view.
    *   **Face Missing**: Warns if the candidate leaves the camera range.
    *   **Eye Gaze Tracking**: Detects abnormal pupil deviation (looking away repeatedly).
    *   **Head Pose Deviation**: Checks for abnormal head tilt or side-turning.
    *   **Object Detection**: Uses MobileNet-SSD to detect prohibited devices like mobile phones or laptop screens.
*   **Active Browser Lockdowns**: Detects tab switching, window blurring, or desktop minimization.
*   **Instant Alerts Dashboard**: Emits real-time visual alerts and warning beeps to admin dashboards using Socket.io.
*   **Interactive Integrity Analytics**: Generates detailed candidate report timelines with annotated screenshot evidence and an aggregate compliance rating.

---

## Directory Structure

```
/SPSOE
├── /client          # Vite + React + TypeScript + Tailwind CSS Frontend
├── /server          # Node.js + Express.js + Socket.io Server Backend
├── /AI-Proctor      # Python + OpenCV + MobileNetSSD Proctoring Agent
├── /database        # Schema diagrams and configurations
└── /docs            # User guides and architecture design details
```

---

## Installation & Setup

### Prerequisites
*   [Node.js](https://nodejs.org/) (v16 or higher)
*   [MongoDB](https://www.mongodb.com/) (Running locally or an Atlas connection string)
*   [Python 3.8+](https://www.python.org/)

---

### Step 1: Set up the MongoDB Database & API Server
1.  Ensure MongoDB is running locally at `mongodb://localhost:27017/spsoe` (or set `MONGO_URI` in `/server/.env`).
2.  Open your terminal inside `/server` and run:
    ```bash
    npm install
    npm start
    ```
    The server will spin up on **http://localhost:5000**.

---

### Step 2: Set up the Python AI Proctoring Agent
1.  Open your terminal inside `/AI-Proctor`.
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Download pre-trained DNN weights and Haar cascades:
    ```bash
    python download_models.py
    ```
4.  Launch the proctoring worker:
    ```bash
    python proctor.py
    ```
    The Python script will establish a connection to the Node.js socket server.

---

### Step 3: Set up the React Client
1.  Open your terminal inside `/client`.
2.  Install packages:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
    The client will launch locally (typically **http://localhost:5173**).

---

## Demo Instructions (Quick Start Guide)

### 1. Register Accounts
*   **Student Account**: Register at `/register`. Use your webcam to capture your face registration profile photo (or upload a clear front-facing image) and specify a Student ID.
*   **Admin Account**: Register another account at `/register`, selecting the **Admin** role type.

### 2. Schedule an Examination
1.  Log in as the **Admin** at `/login` and navigate to the **Create Exam Template** tab.
2.  Fill in the Exam Title (e.g. "Artificial Intelligence Midterms"), duration (e.g., 60 minutes), and start/end windows.
3.  Add MCQ and descriptive questions. Click **Save and Deploy Exam Template**.

### 3. Verification & Attempting the Exam
1.  Log in as the **Student** at `/login`.
2.  Locate your scheduled exam on your portal and click **Start Exam Setup**.
3.  On the **Identity Verification** page, look directly at the webcam and click **Verify Face Match**. Once authenticated, click **Enter Examination**.
4.  While answering questions, try switching tabs, minimizing focus, or looking far away. Notice the warning alert popup displayed in real-time.
5.  If the Python AI Proctor is running, show a mobile phone or look away. The console will highlight detections, overlay boxes, and send annotated screenshots to the backend.

### 4. Admin Live Monitoring & Audit Reports
1.  Log in as the **Admin**. Under **Real-time Proctor Monitor**, you can view the active exam sessions list and a scrolling log of violation alerts.
2.  Once the student completes and submits the exam, select the **Exam Management** tab, select the exam, and click **View AI Integrity Reports**.
3.  Select the candidate. You can view their overall compliance standing, final grade, a breakdown of flags, and a timeline of violations containing screenshots of the evidence.
=======
# SPSOE
>>>>>>> ff4792b8bdcc0694dc22f550003d6478fdb60156
