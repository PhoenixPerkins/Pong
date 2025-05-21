class BallTracker {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvas.getContext('2d');
        this.isCalibrating = false;
        this.isTableCalibrating = false;
        this.isTracking = false;
        this.lastPosition = null;
        this.currentPosition = null;
        this.debugMode = true;
        this.frameCount = 0;
        this.lastUpdateTime = 0;
        this.currentSpeed = 0;
        this.lastPlayer = null;
        this.player1Speed = 0;
        this.player2Speed = 0;
        this.pixelsPerFoot = 100;
        this.shotHistory = {
            player1: [],
            player2: []
        };
        
        // Table calibration points
        this.tableCalibrationPoints = [];
        this.requiredTablePoints = 2; // Start and end of table
        
        // Default HSV ranges for orange ping pong ball
        this.hsvRanges = {
            h: { min: 0, max: 30 },     // Orange/red range
            s: { min: 100, max: 255 },  // High saturation for bright orange
            v: { min: 100, max: 255 }   // High value for bright colors
        };

        // Motion tracking
        this.motionHistory = [];
        this.motionThreshold = 5; // Minimum pixel movement to consider as motion
        this.maxMotionHistory = 10; // Number of frames to keep in motion history

        // Debug overlay
        this.debugOverlay = document.createElement('div');
        this.debugOverlay.className = 'tracking-debug';
        this.debugOverlay.style.display = 'none';
        this.canvas.parentElement.appendChild(this.debugOverlay);

        // Initialize shot history displays
        this.player1ShotsList = document.getElementById('player1Shots');
        this.player2ShotsList = document.getElementById('player2Shots');
    }

    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 60 }, // Request high frame rate
                    facingMode: 'environment'
                } 
            });
            this.video.srcObject = stream;
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error accessing camera:', error);
            throw error;
        }
    }

    startCalibration() {
        this.isCalibrating = true;
        this.canvas.style.cursor = 'crosshair';
        this.debugOverlay.style.display = 'none';
    }

    addCalibrationPoint(x, y) {
        if (!this.isCalibrating) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const scaledX = (rect.width - x) * scaleX;
        const scaledY = y * scaleY;

        // Draw the current video frame
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        // Get image data from the scaled coordinates with a larger sample area
        const sampleSize = 30;
        const imageData = this.ctx.getImageData(
            Math.max(0, Math.round(scaledX - sampleSize/2)),
            Math.max(0, Math.round(scaledY - sampleSize/2)),
            sampleSize,
            sampleSize
        );

        // Calculate HSV values
        const rgb = this.getAverageColor(imageData);
        const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
        
        // Update HSV ranges with tighter margins for better accuracy
        this.hsvRanges = {
            h: {
                min: Math.max(0, hsv.h - 10),
                max: Math.min(360, hsv.h + 10)
            },
            s: {
                min: Math.max(0, hsv.s - 20),
                max: Math.min(255, hsv.s + 20)
            },
            v: {
                min: Math.max(0, hsv.v - 20),
                max: Math.min(255, hsv.v + 20)
            }
        };

        console.log('Calibrated HSV ranges:', this.hsvRanges);
        
        // Draw calibration point
        this.ctx.beginPath();
        this.ctx.arc(scaledX, scaledY, 5, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fill();
        this.ctx.strokeStyle = 'white';
        this.ctx.stroke();

        // Finish calibration immediately after one point
        this.finishCalibration();
    }

    finishCalibration() {
        this.isCalibrating = false;
        this.canvas.style.cursor = 'default';
        this.debugOverlay.style.display = 'block';
    }

    startTableCalibration() {
        this.isTableCalibrating = true;
        this.tableCalibrationPoints = [];
        this.canvas.style.cursor = 'crosshair';
        this.debugOverlay.style.display = 'none';
    }

    addTableCalibrationPoint(x, y) {
        if (!this.isTableCalibrating) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const scaledX = (rect.width - x) * scaleX;
        const scaledY = y * scaleY;

        this.tableCalibrationPoints.push({ x: scaledX, y: scaledY });

        // Draw calibration point
        this.ctx.beginPath();
        this.ctx.arc(scaledX, scaledY, 5, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fill();
        this.ctx.strokeStyle = 'white';
        this.ctx.stroke();

        // Draw line between points if we have more than one
        if (this.tableCalibrationPoints.length > 1) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.tableCalibrationPoints[0].x, this.tableCalibrationPoints[0].y);
            this.ctx.lineTo(this.tableCalibrationPoints[1].x, this.tableCalibrationPoints[1].y);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.stroke();
        }

        // If we have both points, calculate pixels per foot
        if (this.tableCalibrationPoints.length === this.requiredTablePoints) {
            this.calculatePixelsPerFoot();
            this.finishTableCalibration();
        }
    }

    calculatePixelsPerFoot() {
        const point1 = this.tableCalibrationPoints[0];
        const point2 = this.tableCalibrationPoints[1];
        
        // Calculate distance in pixels
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        const pixelDistance = Math.sqrt(dx * dx + dy * dy);
        
        // Standard table is 9 feet long
        const tableLengthInFeet = 9;
        
        // Calculate pixels per foot
        this.pixelsPerFoot = pixelDistance / tableLengthInFeet;
        
        console.log('Calibrated pixels per foot:', this.pixelsPerFoot);
    }

    finishTableCalibration() {
        this.isTableCalibrating = false;
        this.canvas.style.cursor = 'default';
        this.debugOverlay.style.display = 'block';
    }

    startTracking() {
        this.isTracking = true;
        this.debugOverlay.style.display = 'block';
        this.track();
    }

    stopTracking() {
        this.isTracking = false;
        this.debugOverlay.style.display = 'none';
    }

    track() {
        if (!this.isTracking) return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = currentTime;

        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the video frame
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const ballPosition = this.detectBall(imageData);

        if (ballPosition) {
            // Update motion history
            this.updateMotionHistory(ballPosition);

            // Only process if there's significant motion
            if (this.hasSignificantMotion()) {
                this.lastPosition = this.currentPosition;
                this.currentPosition = ballPosition;

                if (this.lastPosition && deltaTime > 0) {
                    const dx = ballPosition.x - this.lastPosition.x;
                    const dy = ballPosition.y - this.lastPosition.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    const distanceInFeet = distance / this.pixelsPerFoot;
                    this.currentSpeed = distanceInFeet / deltaTime;

                    const tableCenter = this.canvas.width / 2;
                    if (dx > 0 && ballPosition.x < tableCenter) {
                        if (this.lastPlayer !== 1) {
                            this.lastPlayer = 1;
                            this.player1Speed = this.currentSpeed;
                            this.addShotToHistory(1, this.currentSpeed);
                        }
                    } else if (dx < 0 && ballPosition.x > tableCenter) {
                        if (this.lastPlayer !== 2) {
                            this.lastPlayer = 2;
                            this.player2Speed = this.currentSpeed;
                            this.addShotToHistory(2, this.currentSpeed);
                        }
                    }
                }

                // Draw ball position with motion indicator
                this.ctx.beginPath();
                this.ctx.arc(ballPosition.x, ballPosition.y, 10, 0, 2 * Math.PI);
                this.ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
                this.ctx.fill();
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 3;
                this.ctx.stroke();

                // Draw motion trail
                this.drawMotionTrail();
            }
        }

        this.frameCount++;
        requestAnimationFrame(() => this.track());
    }

    detectBall(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        let maxBlobSize = 0;
        let maxBlobCenter = null;

        // Use a larger step size for initial scan
        const stepSize = 4;
        const minBlobSize = 20; // Minimum size to consider as a ball

        // First pass: Quick scan for potential ball locations
        for (let y = 0; y < height; y += stepSize) {
            for (let x = 0; x < width; x += stepSize) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const hsv = this.rgbToHsv(r, g, b);

                if (this.isInHSVRange(hsv)) {
                    const blobSize = this.getBlobSize(imageData, x, y);
                    if (blobSize > maxBlobSize) {
                        maxBlobSize = blobSize;
                        maxBlobCenter = { x, y };
                    }
                }
            }
        }

        // Second pass: Refine the position if we found a potential ball
        if (maxBlobSize >= minBlobSize && maxBlobCenter) {
            return this.refineBallPosition(imageData, maxBlobCenter);
        }

        return null;
    }

    refineBallPosition(imageData, center) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        const radius = 20; // Search radius around the center

        for (let y = Math.max(0, center.y - radius); y < Math.min(height, center.y + radius); y++) {
            for (let x = Math.max(0, center.x - radius); x < Math.min(width, center.x + radius); x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const hsv = this.rgbToHsv(r, g, b);

                if (this.isInHSVRange(hsv)) {
                    sumX += x;
                    sumY += y;
                    count++;
                }
            }
        }

        if (count > 0) {
            return {
                x: Math.round(sumX / count),
                y: Math.round(sumY / count)
            };
        }

        return center;
    }

    updateMotionHistory(position) {
        this.motionHistory.push(position);
        if (this.motionHistory.length > this.maxMotionHistory) {
            this.motionHistory.shift();
        }
    }

    hasSignificantMotion() {
        if (this.motionHistory.length < 2) return false;

        const lastPos = this.motionHistory[this.motionHistory.length - 1];
        const prevPos = this.motionHistory[this.motionHistory.length - 2];
        
        const dx = lastPos.x - prevPos.x;
        const dy = lastPos.y - prevPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance >= this.motionThreshold;
    }

    drawMotionTrail() {
        if (this.motionHistory.length < 2) return;

        this.ctx.beginPath();
        this.ctx.moveTo(this.motionHistory[0].x, this.motionHistory[0].y);
        
        for (let i = 1; i < this.motionHistory.length; i++) {
            this.ctx.lineTo(this.motionHistory[i].x, this.motionHistory[i].y);
        }

        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    getAverageColor(imageData) {
        let r = 0, g = 0, b = 0;
        const data = imageData.data;
        const pixelCount = data.length / 4;
        let validPixels = 0;

        for (let i = 0; i < data.length; i += 4) {
            // Only count non-transparent pixels
            if (data[i + 3] > 0) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                validPixels++;
            }
        }

        // Avoid division by zero
        if (validPixels === 0) {
            console.warn('No valid pixels found in sample area');
            return { r: 0, g: 0, b: 0 };
        }

        return {
            r: Math.round(r / validPixels),
            g: Math.round(g / validPixels),
            b: Math.round(b / validPixels)
        };
    }

    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        let h = 0;
        const s = max === 0 ? 0 : delta / max;
        const v = max;

        if (delta !== 0) {
            if (max === r) {
                h = ((g - b) / delta) % 6;
            } else if (max === g) {
                h = (b - r) / delta + 2;
            } else {
                h = (r - g) / delta + 4;
            }

            h = Math.round(h * 60);
            if (h < 0) h += 360;
        }

        return { h, s: s * 255, v: v * 255 };
    }

    isInHSVRange(hsv) {
        // Check if hue is in the orange range (accounting for circular nature of hue)
        const isHueInRange = (hsv.h >= this.hsvRanges.h.min && hsv.h <= this.hsvRanges.h.max) ||
                            (hsv.h >= 360 - this.hsvRanges.h.max && hsv.h <= 360 - this.hsvRanges.h.min);
        
        return isHueInRange &&
               hsv.s >= this.hsvRanges.s.min && hsv.s <= this.hsvRanges.s.max &&
               hsv.v >= this.hsvRanges.v.min && hsv.v <= this.hsvRanges.v.max;
    }

    getBlobSize(imageData, startX, startY) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const visited = new Set();
        const queue = [{ x: startX, y: startY }];
        let size = 0;
        const maxSize = 200; // Maximum blob size to check

        while (queue.length > 0 && size < maxSize) {
            const { x, y } = queue.shift();
            const key = `${x},${y}`;

            if (visited.has(key)) continue;
            visited.add(key);

            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const hsv = this.rgbToHsv(r, g, b);

            if (this.isInHSVRange(hsv)) {
                size++;
                // Only check adjacent pixels if we haven't reached max size
                if (size < maxSize) {
                    if (x > 0) queue.push({ x: x - 1, y });
                    if (x < width - 1) queue.push({ x: x + 1, y });
                    if (y > 0) queue.push({ x, y: y - 1 });
                    if (y < height - 1) queue.push({ x, y: y + 1 });
                }
            }
        }

        return size;
    }

    getBallPosition() {
        return this.currentPosition;
    }

    getBallVelocity() {
        if (!this.lastPosition || !this.currentPosition) return null;

        return {
            x: this.currentPosition.x - this.lastPosition.x,
            y: this.currentPosition.y - this.lastPosition.y
        };
    }

    addShotToHistory(player, speed) {
        const shot = {
            speed: speed,
            timestamp: new Date().toLocaleTimeString()
        };
        
        this.shotHistory[`player${player}`].push(shot);
        this.updateShotHistoryDisplay();
    }

    updateShotHistoryDisplay() {
        // Update Player 1 shots
        this.player1ShotsList.innerHTML = this.shotHistory.player1
            .slice(-3) // Show last 3 shots
            .reverse() // Most recent first
            .map(shot => `
                <div class="shot-item">
                    <div>${shot.speed.toFixed(1)} ft/s</div>
                </div>
            `).join('');

        // Update Player 2 shots
        this.player2ShotsList.innerHTML = this.shotHistory.player2
            .slice(-3) // Show last 3 shots
            .reverse() // Most recent first
            .map(shot => `
                <div class="shot-item">
                    <div>${shot.speed.toFixed(1)} ft/s</div>
                </div>
            `).join('');
    }
} 