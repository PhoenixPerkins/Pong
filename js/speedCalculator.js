class SpeedCalculator {
    constructor() {
        this.pixelToMeterRatio = 0.001; // This will be calibrated based on table size
        this.frameRate = 30; // Assuming 30fps
        this.speedHistory = [];
        this.maxSpeed = 0;
        this.lastHitTime = 0;
        this.hitThreshold = 2; // Speed change threshold for hit detection
        this.speedWindow = 5; // Number of frames to average speed over
    }

    setPixelToMeterRatio(ratio) {
        this.pixelToMeterRatio = ratio;
    }

    calculateSpeed(velocity) {
        if (!velocity) return 0;

        const speed = Math.sqrt(
            Math.pow(velocity.x * this.pixelToMeterRatio, 2) +
            Math.pow(velocity.y * this.pixelToMeterRatio, 2)
        ) * this.frameRate; // Convert to meters per second

        // Convert to km/h
        const speedKmh = speed * 3.6;

        // Update speed history
        this.speedHistory.push(speedKmh);
        if (this.speedHistory.length > this.speedWindow) {
            this.speedHistory.shift();
        }

        // Update max speed
        this.maxSpeed = Math.max(this.maxSpeed, speedKmh);

        return speedKmh;
    }

    getAverageSpeed() {
        if (this.speedHistory.length === 0) return 0;
        return this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length;
    }

    detectHit(currentSpeed) {
        if (this.speedHistory.length < 2) return false;

        const previousSpeed = this.speedHistory[this.speedHistory.length - 2];
        const speedChange = Math.abs(currentSpeed - previousSpeed);

        // Check if the speed change is significant enough to be a hit
        if (speedChange > this.hitThreshold) {
            const now = Date.now();
            // Prevent multiple hit detections within 500ms
            if (now - this.lastHitTime > 500) {
                this.lastHitTime = now;
                return true;
            }
        }

        return false;
    }

    getMaxSpeed() {
        return this.maxSpeed;
    }

    reset() {
        this.speedHistory = [];
        this.maxSpeed = 0;
        this.lastHitTime = 0;
    }
} 