class BallTracker {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvas.getContext('2d');
        this.calibrationPoints = [];
        this.isCalibrating = false;
        this.isTracking = false;
        this.lastPosition = null;
        this.currentPosition = null;
        this.debugMode = true;
        this.frameCount = 0;
        this.lastUpdateTime = 0;
        this.currentSpeed = 0;
        this.lastPlayer = null; // Track which player last hit the ball
        this.player1Speed = 0;
        this.player2Speed = 0;
        this.pixelsPerFoot = 100; // This will be calibrated based on table size
        this.shotHistory = {
            player1: [],
            player2: []
        };
        // Much wider HSV ranges for initial detection
        this.hsvRanges = {
            h: { min: 0, max: 60 },     // Wider orange/red range
            s: { min: 20, max: 255 },   // Much lower minimum saturation
            v: { min: 20, max: 255 }    // Much lower minimum value
        };
        
        // Create debug overlay
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
                    facingMode: 'environment' // Prefer the back camera if available
                } 
            });
            this.video.srcObject = stream;
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    // Set canvas size to match video dimensions
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
        this.calibrationPoints = [];
        this.canvas.style.cursor = 'crosshair';
        this.debugOverlay.style.display = 'none';
    }

    addCalibrationPoint(x, y) {
        if (!this.isCalibrating) return;
        
        // Scale the coordinates to match the actual video dimensions
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        // Flip the x-coordinate to account for the mirrored video
        const scaledX = (rect.width - x) * scaleX;
        const scaledY = y * scaleY;

        // Draw the current video frame
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        // Get image data from the scaled coordinates with a larger sample area
        const sampleSize = 20;
        const imageData = this.ctx.getImageData(
            Math.max(0, Math.round(scaledX - sampleSize/2)),
            Math.max(0, Math.round(scaledY - sampleSize/2)),
            sampleSize,
            sampleSize
        );

        // Debug the raw pixel data
        console.log('Raw pixel data sample:', {
            firstPixel: {
                r: imageData.data[0],
                g: imageData.data[1],
                b: imageData.data[2],
                a: imageData.data[3]
            },
            totalPixels: imageData.data.length / 4
        });

        // Calculate and log the HSV values at the calibration point
        const rgb = this.getAverageColor(imageData);
        const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
        
        console.log('Calibration point details:', {
            position: { x: scaledX, y: scaledY },
            rgb: rgb,
            hsv: hsv,
            sampleSize: sampleSize
        });

        // Verify the color data is valid
        if (rgb.r === 0 && rgb.g === 0 && rgb.b === 0) {
            console.warn('Warning: Detected black color during calibration. This might indicate a problem with the video feed or canvas drawing.');
        }

        this.calibrationPoints.push({
            x: scaledX,
            y: scaledY,
            colorData: imageData
        });

        // Draw calibration point at the scaled coordinates
        this.ctx.beginPath();
        this.ctx.arc(scaledX, scaledY, 5, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fill();
        this.ctx.strokeStyle = 'white';
        this.ctx.stroke();

        // Draw a rectangle around the sampled area for debugging
        this.ctx.strokeStyle = 'yellow';
        this.ctx.strokeRect(
            Math.max(0, Math.round(scaledX - sampleSize/2)),
            Math.max(0, Math.round(scaledY - sampleSize/2)),
            sampleSize,
            sampleSize
        );

        // Update debug overlay to show calibration point and HSV values
        this.debugOverlay.textContent = `Calibration: (${Math.round(scaledX)}, ${Math.round(scaledY)}) HSV: ${Math.round(hsv.h)}, ${Math.round(hsv.s)}, ${Math.round(hsv.v)}`;

        // Create a temporary freeze effect
        const freezeFrame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Function to resume video feed
        const resumeVideo = () => {
            if (this.isCalibrating) {
                this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
                // Redraw all calibration points
                this.calibrationPoints.forEach(point => {
                    this.ctx.beginPath();
                    this.ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                    this.ctx.fill();
                    this.ctx.strokeStyle = 'white';
                    this.ctx.stroke();
                });
                requestAnimationFrame(resumeVideo);
            }
        };

        // Wait for 1 second before resuming
        setTimeout(() => {
            resumeVideo();
        }, 1000);
    }

    finishCalibration() {
        this.isCalibrating = false;
        this.canvas.style.cursor = 'default';
        this.updateHSVRange();
        this.debugOverlay.style.display = 'block';
    }

    updateHSVRange() {
        // Calculate HSV ranges based on calibration points with wider margins
        const hsvValues = this.calibrationPoints.map(point => {
            const rgb = this.getAverageColor(point.colorData);
            return this.rgbToHsv(rgb.r, rgb.g, rgb.b);
        });

        // Update HSV ranges with wider margins for side view
        this.hsvRanges = {
            h: {
                min: Math.max(0, Math.min(...hsvValues.map(v => v.h)) - 20),
                max: Math.min(360, Math.max(...hsvValues.map(v => v.h)) + 20)
            },
            s: {
                min: Math.max(0, Math.min(...hsvValues.map(v => v.s)) - 30),
                max: Math.min(255, Math.max(...hsvValues.map(v => v.s)) + 30)
            },
            v: {
                min: Math.max(0, Math.min(...hsvValues.map(v => v.v)) - 30),
                max: Math.min(255, Math.max(...hsvValues.map(v => v.v)) + 30)
            }
        };

        // Log the HSV ranges for debugging
        console.log('Updated HSV ranges:', this.hsvRanges);
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
            this.lastPosition = this.currentPosition;
            this.currentPosition = ballPosition;

            // Calculate speed if we have a previous position
            if (this.lastPosition && deltaTime > 0) {
                const dx = ballPosition.x - this.lastPosition.x;
                const dy = ballPosition.y - this.lastPosition.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Convert pixels to feet and calculate speed
                const distanceInFeet = distance / this.pixelsPerFoot;
                this.currentSpeed = distanceInFeet / deltaTime;

                // Determine which player hit the ball based on position and direction
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

            // Draw ball position
            this.ctx.beginPath();
            this.ctx.arc(ballPosition.x, ballPosition.y, 10, 0, 2 * Math.PI);
            this.ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            this.ctx.fill();
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();

            // Draw speed information (only update every 5 frames)
            if (this.frameCount % 5 === 0) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(10, 10, 300, 100);
                this.ctx.fillStyle = 'white';
                this.ctx.font = '14px monospace';
                this.ctx.fillText(`Current Speed: ${this.currentSpeed.toFixed(1)} ft/s`, 20, 30);
                this.ctx.fillText(`Player 1 Speed: ${this.player1Speed.toFixed(1)} ft/s`, 20, 50);
                this.ctx.fillText(`Player 2 Speed: ${this.player2Speed.toFixed(1)} ft/s`, 20, 70);
                if (this.lastPlayer) {
                    this.ctx.fillText(`Last Hit: Player ${this.lastPlayer}`, 20, 90);
                }
            }

            // Add a pulsing effect (only if debug mode is on and every 5 frames)
            if (this.debugMode && this.frameCount % 5 === 0) {
                this.ctx.beginPath();
                this.ctx.arc(ballPosition.x, ballPosition.y, 15, 0, 2 * Math.PI);
                this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        } else if (this.debugMode && this.frameCount % 10 === 0) {
            this.debugOverlay.textContent = 'No ball detected';
        }

        this.frameCount = (this.frameCount || 0) + 1;
        requestAnimationFrame(() => this.track());
    }

    detectBall(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        let maxBlobSize = 0;
        let maxBlobCenter = null;
        let debugPixels = [];
        let totalPixelsChecked = 0;
        let matchingPixels = 0;

        // Adaptive step size based on ball size
        let stepSize = 2;
        const maxBlobSizeThreshold = 100; // Maximum blob size before increasing step size

        // Simple blob detection with improved sampling
        for (let y = 0; y < height; y += stepSize) {
            for (let x = 0; x < width; x += stepSize) {
                totalPixelsChecked++;
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const hsv = this.rgbToHsv(r, g, b);

                if (this.isInHSVRange(hsv)) {
                    matchingPixels++;
                    // Only check blob size if we haven't found a large blob yet
                    if (maxBlobSize < maxBlobSizeThreshold) {
                        const blobSize = this.getBlobSize(imageData, x, y);
                        if (blobSize > maxBlobSize) {
                            maxBlobSize = blobSize;
                            maxBlobCenter = { x, y };
                            // Increase step size if we find a large blob
                            if (blobSize > 50) {
                                stepSize = 4;
                            }
                        }
                    } else {
                        // If we already found a large blob, just update the center
                        maxBlobCenter = { x, y };
                    }

                    if (this.debugMode && debugPixels.length < 25) {
                        debugPixels.push({ x, y, hsv });
                    }
                }
            }
        }

        if (this.debugMode && this.frameCount % 10 === 0) {
            // Draw debug pixels
            debugPixels.forEach(pixel => {
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                this.ctx.fillRect(pixel.x - 1, pixel.y - 1, 3, 3);
            });

            // Update debug overlay with more information
            const matchPercentage = (matchingPixels / totalPixelsChecked * 100).toFixed(2);
            this.debugOverlay.textContent = `Matches: ${matchPercentage}% | Blob Size: ${maxBlobSize} | Step: ${stepSize}`;
        }

        return maxBlobSize > 3 ? maxBlobCenter : null;
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

    // Add method to calibrate pixels per foot
    calibrateTableSize(tableLengthInFeet) {
        // Assuming the table takes up 80% of the canvas width
        const tableWidthInPixels = this.canvas.width * 0.8;
        this.pixelsPerFoot = tableWidthInPixels / tableLengthInFeet;
        console.log(`Calibrated pixels per foot: ${this.pixelsPerFoot}`);
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