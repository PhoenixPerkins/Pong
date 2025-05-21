# DPong - Ping Pong Ball Speed Tracker

A browser-based application that tracks ping pong ball speed during games using webcam input. The system processes video feed directly in the browser to calculate ball speed and identify player hits.

## Features

- Real-time ball tracking using webcam input
- Calibration system for accurate ball detection
- Speed calculation and hit detection
- Clean, intuitive interface
- No server-side components required

## Setup

1. Clone this repository
2. Open `index.html` in a modern web browser
3. Allow camera access when prompted
4. Follow the calibration steps before starting a game

## Requirements

- Modern web browser with WebRTC support
- Webcam with good lighting conditions
- Orange ping pong ball
- Camera positioned at the midpoint of the table's side

## Technical Details

The application uses:
- HTML5 Canvas for video processing
- WebRTC for camera access
- JavaScript for core functionality
- CSS for styling

## Usage

1. Position your webcam at the midpoint of the table's side
2. Click "Start Calibration" and follow the on-screen instructions
3. Once calibrated, click "Start Game" to begin tracking
4. The system will automatically track the ball and calculate speeds 