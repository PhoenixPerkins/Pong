class UI {
    constructor() {
        this.currentSpeedElement = document.getElementById('currentSpeed');
        this.lastHitElement = document.getElementById('lastHit');
        this.maxSpeedElement = document.getElementById('maxSpeed');
        this.calibrationInstructions = document.getElementById('calibrationInstructions');
        this.calibrationProgress = document.getElementById('calibrationProgress');
        this.calibrationStatus = document.getElementById('calibrationStatus');
        this.startCalibrationButton = document.getElementById('startCalibration');
        this.startGameButton = document.getElementById('startGame');
        this.stopGameButton = document.getElementById('stopGame');
    }

    updateSpeed(speed) {
        this.currentSpeedElement.textContent = `${speed.toFixed(1)} ft/s`;
    }

    updateLastHit(player) {
        this.lastHitElement.textContent = `Player ${player}`;
    }

    updateMaxSpeed(speed) {
        this.maxSpeedElement.textContent = `${speed.toFixed(1)} ft/s`;
    }

    showTableCalibrationInstructions() {
        this.calibrationInstructions.innerHTML = `
            <h2>Table Calibration</h2>
            <p>Click on both ends of the table to calibrate the distance.</p>
            <p>First click one end, then click the other end.</p>
        `;
        this.calibrationInstructions.classList.remove('hidden');
    }

    showCalibrationInstructions() {
        this.calibrationInstructions.innerHTML = `
            <h2>Ball Calibration</h2>
            <p>Click on the orange ping pong ball to help the system learn its color.</p>
            <p>The system will automatically adjust to track the ball's movement.</p>
        `;
        this.calibrationInstructions.classList.remove('hidden');
    }

    hideCalibrationInstructions() {
        this.calibrationInstructions.classList.add('hidden');
    }

    hideTableCalibrationInstructions() {
        this.calibrationInstructions.classList.add('hidden');
    }

    updateCalibrationProgress(points, total) {
        const percentage = (points / total) * 100;
        this.calibrationProgress.style.width = `${percentage}%`;
        this.calibrationStatus.textContent = `${points}/${total} points calibrated`;
    }

    enableStartGameButton() {
        this.startGameButton.disabled = false;
    }

    disableStartGameButton() {
        this.startGameButton.disabled = true;
    }

    enableStopGameButton() {
        this.stopGameButton.disabled = false;
    }

    disableStopGameButton() {
        this.stopGameButton.disabled = true;
    }

    showError(message) {
        // Create error element if it doesn't exist
        let errorElement = document.querySelector('.error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            document.querySelector('.container').insertBefore(
                errorElement,
                document.querySelector('main')
            );
        }

        errorElement.textContent = message;
        errorElement.style.display = 'block';

        // Hide error after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }

    showSuccess(message) {
        // Create success element if it doesn't exist
        let successElement = document.querySelector('.success-message');
        if (!successElement) {
            successElement = document.createElement('div');
            successElement.className = 'success-message';
            document.querySelector('.container').insertBefore(
                successElement,
                document.querySelector('main')
            );
        }

        successElement.textContent = message;
        successElement.style.display = 'block';

        // Hide success message after 3 seconds
        setTimeout(() => {
            successElement.style.display = 'none';
        }, 3000);
    }
} 