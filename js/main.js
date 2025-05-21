document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ui = new UI();
    const ballTracker = new BallTracker(video, canvas);
    const speedCalculator = new SpeedCalculator();

    let isGameRunning = false;
    let currentPlayer = 1;
    const requiredCalibrationPoints = 5;

    // Initialize camera
    async function initializeCamera() {
        try {
            await ballTracker.startCamera();
            ui.showSuccess('Camera initialized successfully');
        } catch (error) {
            ui.showError('Failed to access camera. Please ensure you have granted camera permissions.');
            console.error('Camera initialization error:', error);
        }
    }

    // Start calibration
    document.getElementById('startCalibration').addEventListener('click', () => {
        ballTracker.startCalibration();
        ui.showCalibrationInstructions();
        ui.disableStartGameButton();
    });

    // Handle canvas clicks during calibration
    canvas.addEventListener('click', (event) => {
        if (!ballTracker.isCalibrating) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        ballTracker.addCalibrationPoint(x, y);
        ui.updateCalibrationProgress(
            ballTracker.calibrationPoints.length,
            requiredCalibrationPoints
        );

        if (ballTracker.calibrationPoints.length >= requiredCalibrationPoints) {
            ballTracker.finishCalibration();
            ui.hideCalibrationInstructions();
            ui.enableStartGameButton();
            ui.showSuccess('Calibration completed successfully');
        }
    });

    // Start game
    document.getElementById('startGame').addEventListener('click', () => {
        isGameRunning = true;
        ballTracker.startTracking();
        speedCalculator.reset();
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
            const velocity = ballTracker.getBallVelocity();
            const speed = speedCalculator.calculateSpeed(velocity);
            
            ui.updateSpeed(speed);
            ui.updateMaxSpeed(speedCalculator.getMaxSpeed());

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