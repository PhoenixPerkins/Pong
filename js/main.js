document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ui = new UI();
    const ballTracker = new BallTracker(video, canvas);
    const speedCalculator = new SpeedCalculator();

    let isGameRunning = false;
    let currentPlayer = 1;
    let calibrationStep = 'none'; // none -> table -> ball -> ready

    // Initialize camera
    async function initializeCamera() {
        try {
            await ballTracker.startCamera();
            ui.showSuccess('Camera initialized successfully');
            startTableCalibration();
        } catch (error) {
            ui.showError('Failed to access camera. Please ensure you have granted camera permissions.');
            console.error('Camera initialization error:', error);
        }
    }

    function startTableCalibration() {
        calibrationStep = 'table';
        ballTracker.startTableCalibration();
        ui.showTableCalibrationInstructions();
        ui.disableStartGameButton();
    }

    // Start ball calibration
    document.getElementById('startCalibration').addEventListener('click', () => {
        if (calibrationStep === 'table') {
            ui.showError('Please complete table calibration first');
            return;
        }
        calibrationStep = 'ball';
        ballTracker.startCalibration();
        ui.showCalibrationInstructions();
        ui.disableStartGameButton();
    });

    // Handle canvas clicks during calibration
    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (calibrationStep === 'table') {
            ballTracker.addTableCalibrationPoint(x, y);
            if (ballTracker.tableCalibrationPoints.length === ballTracker.requiredTablePoints) {
                calibrationStep = 'ball';
                ui.hideTableCalibrationInstructions();
                ui.showSuccess('Table calibration completed. Click "Start Calibration" to calibrate the ball.');
            }
        } else if (calibrationStep === 'ball' && ballTracker.isCalibrating) {
            ballTracker.addCalibrationPoint(x, y);
            calibrationStep = 'ready';
            ui.hideCalibrationInstructions();
            ui.enableStartGameButton();
            ui.showSuccess('Calibration completed successfully');
        }
    });

    // Start game
    document.getElementById('startGame').addEventListener('click', () => {
        if (calibrationStep !== 'ready') {
            ui.showError('Please complete all calibration steps first');
            return;
        }
        isGameRunning = true;
        ballTracker.startTracking();
        speedCalculator.reset();
        speedCalculator.calibratePixelsPerFoot(ballTracker.pixelsPerFoot);
        ui.enableStopGameButton();
        ui.disableStartGameButton();
        ui.showSuccess('Game started');
    });

    // Stop game
    document.getElementById('stopGame').addEventListener('click', () => {
        isGameRunning = false;
        ballTracker.stopTracking();
        ui.disableStopGameButton();
        ui.enableStartGameButton();
        ui.showSuccess('Game stopped');
    });

    // Main game loop
    function gameLoop() {
        if (isGameRunning) {
            // Update frame rate tracking
            speedCalculator.updateFrameRate();

            // Get ball velocity and calculate speed
            const velocity = ballTracker.getBallVelocity();
            const speed = speedCalculator.calculateSpeed(velocity);
            
            // Update UI with current and max speeds
            ui.updateSpeed(speed);
            ui.updateMaxSpeed(speedCalculator.getMaxSpeed());

            // Detect hits and update player
            if (speedCalculator.detectHit(speed)) {
                currentPlayer = currentPlayer === 1 ? 2 : 1;
                ui.updateLastHit(currentPlayer);
            }
        }
        requestAnimationFrame(gameLoop);
    }

    // Start the application
    initializeCamera();
    gameLoop();
}); 