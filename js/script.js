document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    const API_ENDPOINT = 'http://localhost:5678/webhook/qr-scan';
    const MAX_BATCH_SIZE = 20;

    // State
    let currentBatchCount = 0;
    let html5QrcodeScanner = null;
    let isScanning = false;

    // DOM Elements
    const punchIdInput = document.getElementById('punch-id');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');
    const scanResultEl = document.getElementById('scan-result');
    const readerContainer = document.getElementById('reader');

    // Initialize display
    updateProgressDisplay();

    // Event Listeners
    startBtn.addEventListener('click', toggleScanner);
    resetBtn.addEventListener('click', resetSession);

    function updateProgressDisplay() {
        progressText.textContent = `${currentBatchCount}/${MAX_BATCH_SIZE}`;
        const percentage = (currentBatchCount / MAX_BATCH_SIZE) * 100;
        progressFill.style.width = `${percentage}%`;
        
        // Visual feedback when full
        if (currentBatchCount >= MAX_BATCH_SIZE) {
            progressFill.style.background = 'linear-gradient(90deg, #00b09b, #96c93d)'; // Green gradient for success
        } else {
            progressFill.style.background = ''; // Revert to default
        }
    }

    async function onScanSuccess(decodedText, decodedResult) {
        if (currentBatchCount >= MAX_BATCH_SIZE) {
            stopScanner();
            alert('Batch complete! Please reset the session.');
            return;
        }

        // Prevent rapid duplicate scans (simple debounce could be added here, 
        // but library handles some of it. We'll add a visual pause)
        
        // Show scanning feedback
        scanResultEl.textContent = `Scanned: ${decodedText}`;
        scanResultEl.classList.remove('hidden');

        // Send to backend
        try {
            await sendDataToWebhook(decodedText);
            
            // Increment progress
            currentBatchCount++;
            updateProgressDisplay();
            
            // Optional: Pause scanning briefly for user to acknowledge
            // html5QrcodeScanner.pause(); 
            // setTimeout(() => html5QrcodeScanner.resume(), 1000);
            
        } catch (error) {
            console.error('Scan Error:', error);
            scanResultEl.textContent = 'Error sending data';
            scanResultEl.style.color = 'red';
        }
    }

    function onScanFailure(error) {
        // handle scan failure, usually better to ignore and keep scanning.
        // console.warn(`Code scan error = ${error}`);
    }

    function toggleScanner() {
        if (isScanning) {
            stopScanner();
        } else {
            startScanner();
        }
    }

    function startScanner() {
        const punchId = punchIdInput.value.trim();
        if (!punchId) {
            alert('Please enter a Punch ID first.');
            punchIdInput.focus();
            return;
        }

        readerContainer.style.display = 'block';
        startBtn.innerHTML = '<span class="icon">⏹</span> Stop Scanner';
        startBtn.classList.add('btn-secondary'); // You might want to add a style for this
        isScanning = true;

        if (!html5QrcodeScanner) {
            // Using Html5Qrcode class for more control or Html5QrcodeScanner for UI
            // Using Html5Qrcode for custom UI integration
             html5QrcodeScanner = new Html5Qrcode("reader");
        }

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        html5QrcodeScanner.start(
            { facingMode: "environment" }, 
            config, 
            onScanSuccess, 
            onScanFailure
        ).catch(err => {
            console.error("Error starting scanner", err);
            alert("Error starting camera: " + err);
            stopScanner();
        });
    }

    function stopScanner() {
        if (html5QrcodeScanner && isScanning) {
            html5QrcodeScanner.stop().then(() => {
                readerContainer.style.display = 'none';
                startBtn.innerHTML = '<span class="icon">📷</span> Start QR Scanner';
                startBtn.classList.remove('btn-secondary');
                isScanning = false;
                scanResultEl.classList.add('hidden');
            }).catch(err => {
                console.error("Failed to stop scanner", err);
            });
        }
    }

    function resetSession() {
        if (confirm('Are you sure you want to reset the session? Progress will be lost.')) {
            currentBatchCount = 0;
            updateProgressDisplay();
            punchIdInput.value = '';
            stopScanner();
        }
    }

    async function sendDataToWebhook(qrData) {
        const punchId = punchIdInput.value.trim();
        const payload = {
            punch_id: punchId,
            qr_data: qrData,
            timestamp: new Date().toISOString()
        };

        // Note: Using 'no-cors' might hide errors but is often needed for local development 
        // against simple webhooks if they don't handle CORS.
        // Ideally, the webhook server should handle OPTIONS requests.
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
           // throw new Error(`Server responded with ${response.status}`);
           console.warn("Server response not OK (might be CORS or actual error):", response.status);
        }
    }
});
