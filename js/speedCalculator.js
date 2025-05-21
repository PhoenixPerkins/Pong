class SpeedCalculator {
    constructor() {
        // Constants
        this.pixelsPerFoot = 100; // Will be calibrated
        this.frameRate = 60; // Target frame rate
        this.minSpeedThreshold = 0.5; // Minimum speed to consider as movement (ft/s)
        this.maxSpeedThreshold = 50; // Maximum realistic speed (ft/s)
        
        // Speed tracking
        this.speedHistory = [];
        this.maxHistorySize = 10; // Number of speed measurements to keep
        this.maxSpeed = 0;
        
        // Kalman filter parameters
        this.kalmanGain = 0.2; // Filter gain (0-1)
        this.lastFilteredSpeed = 0;
        
        // Hit detection
        this.lastHitTime = 0;
        this.hitCooldown = 500; // Minimum time between hits (ms)
        this.speedChangeThreshold = 5; // Speed change threshold for hit detection (ft/s)
        
        // Frame timing
        this.lastFrameTime = 0;
        this.frameTimes = [];
        this.maxFrameTimes = 10;
    }

    reset() {
        this.speedHistory = [];
        this.maxSpeed = 0;
        this.lastFilteredSpeed = 0;
        this.lastHitTime = 0;
        this.frameTimes = [];
    }

    calculateSpeed(velocity) {
        if (!velocity) return 0;

        // Calculate raw speed
        const dx = velocity.x;
        const dy = velocity.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const rawSpeed = (distance / this.pixelsPerFoot) * this.frameRate;

        // Apply Kalman filter
        const filteredSpeed = this.applyKalmanFilter(rawSpeed);

        // Update speed history
        this.updateSpeedHistory(filteredSpeed);

        // Update max speed
        if (filteredSpeed > this.maxSpeed) {
            this.maxSpeed = filteredSpeed;
        }

        return filteredSpeed;
    }

    applyKalmanFilter(speed) {
        // Simple Kalman filter implementation
        const predictedSpeed = this.lastFilteredSpeed;
        const innovation = speed - predictedSpeed;
        const filteredSpeed = predictedSpeed + this.kalmanGain * innovation;
        
        this.lastFilteredSpeed = filteredSpeed;
        return filteredSpeed;
    }

    updateSpeedHistory(speed) {
        // Add new speed measurement
        this.speedHistory.push({
            speed: speed,
            timestamp: performance.now()
        });

        // Remove old measurements
        while (this.speedHistory.length > this.maxHistorySize) {
            this.speedHistory.shift();
        }
    }

    detectHit(speed) {
        const currentTime = performance.now();
        
        // Check cooldown
        if (currentTime - this.lastHitTime < this.hitCooldown) {
            return false;
        }

        // Get average speed from history
        const avgSpeed = this.getAverageSpeed();
        
        // Detect significant speed change
        const speedChange = Math.abs(speed - avgSpeed);
        
        if (speedChange > this.speedChangeThreshold && 
            speed > this.minSpeedThreshold && 
            speed < this.maxSpeedThreshold) {
            this.lastHitTime = currentTime;
            return true;
        }

        return false;
    }

    getAverageSpeed() {
        if (this.speedHistory.length === 0) return 0;
        
        const sum = this.speedHistory.reduce((acc, curr) => acc + curr.speed, 0);
        return sum / this.speedHistory.length;
    }

    getMaxSpeed() {
        return this.maxSpeed;
    }

    calibratePixelsPerFoot(tableLengthInFeet) {
        this.pixelsPerFoot = tableLengthInFeet;
    }

    updateFrameRate() {
        const currentTime = performance.now();
        
        if (this.lastFrameTime > 0) {
            const frameTime = currentTime - this.lastFrameTime;
            this.frameTimes.push(frameTime);
            
            // Keep only recent frame times
            while (this.frameTimes.length > this.maxFrameTimes) {
                this.frameTimes.shift();
            }
            
            // Calculate average frame rate
            const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
            this.frameRate = 1000 / avgFrameTime;
        }
        
        this.lastFrameTime = currentTime;
    }
} 