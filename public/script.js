// Initialize JustGage for temperature
const gauge = new JustGage({
    id: "temp-gauge",
    value: 0,
    min: -20,
    max: 50,
    title: "Temperature (°C)",
    label: "°C",
    decimals: 2,
    gaugeWidthScale: 0.6,
    customSectors: {
        ranges: [
            { from: -20, to: 0, color: "#3498db" },
            { from: 0, to: 30, color: "#2ecc71" },
            { from: 30, to: 50, color: "#e74c3c" }
        ]
    },
    counter: true
});

// Initialize Leaflet map
let map, marker;
function initMap(lat, lng, gpsValid) {
    if (map) {
        map.remove(); // Remove existing map instance
    }
    map = L.map('map').setView([gpsValid ? lat : 0, gpsValid ? lng : 0], gpsValid ? 13 : 1);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    if (gpsValid) {
        marker = L.marker([lat, lng]).addTo(map)
            .bindPopup('Current Location')
            .openPopup();
    }
    console.log('Map initialized with:', { lat, lng, gpsValid });
}

// Initialize map with default coordinates (0, 0)
initMap(0, 0, false);

// WebSocket connection
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

ws.onopen = () => {
    console.log('WebSocket connected');
};

ws.onmessage = async (event) => {
    let message;
    if (event.data instanceof Blob) {
        message = await event.data.text();
    } else {
        message = event.data;
    }

    try {
        const data = JSON.parse(message);
        console.log('Received data:', data);

        // Update temperature gauge
        if (data.temperature !== undefined) {
            gauge.refresh(data.temperature);
        }

        // Update heart rate
        if (data.heartRate !== undefined) {
            document.getElementById('heart-rate').innerText = data.heartRate.toFixed(0) + ' BPM';
        }

        // Update SpO2
        if (data.spo2 !== undefined) {
            document.getElementById('spo2').innerText = data.spo2.toFixed(0) + ' %';
        }

        // Update acceleration (calculate magnitude if not provided)
        if (data.fallDetected !== undefined) {
            // Since acceleration isn't directly sent, use fall detection to simulate
            const accMag = data.fallDetected ? 30 : 9.8; // Example values
            document.getElementById('acc').innerText = accMag.toFixed(2) + ' m/s²';
        }

        // Update fall status
        if (data.fallDetected !== undefined) {
            document.getElementById('fall').innerText = data.fallDetected ? 'FALL DETECTED' : 'Normal';
            document.getElementById('fall').parentElement.className = 'reading' + (data.fallDetected ? ' alert' : '');
        }

        // Update GPS data
        if (data.latitude !== undefined && data.longitude !== undefined) {
            const gpsValid = true; // Since latitude and longitude are present
            document.getElementById('lat').innerText = data.latitude.toFixed(6);
            document.getElementById('lng').innerText = data.longitude.toFixed(6);
            document.getElementById('gps').innerText = gpsValid ? 'Valid' : 'Waiting for fix';
            initMap(data.latitude, data.longitude, gpsValid);
        } else {
            document.getElementById('lat').innerText = '0';
            document.getElementById('lng').innerText = '0';
            document.getElementById('gps').innerText = 'Waiting for fix';
            console.log('No valid GPS data received');
        }
    } catch (error) {
        console.error('Failed to parse JSON:', error, 'Raw message:', message);
    }
};

ws.onclose = () => {
    console.log('WebSocket disconnected');
    document.getElementById('fall').innerText = 'WebSocket Disconnected';
    document.getElementById('fall').parentElement.className = 'reading alert';
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    document.getElementById('fall').innerText = 'WebSocket Error';
    document.getElementById('fall').parentElement.className = 'reading alert';
};

// Function to restart the map (called by the button)
function restartMap() {
    const lat = parseFloat(document.getElementById('lat').innerText);
    const lng = parseFloat(document.getElementById('lng').innerText);
    const gpsValid = document.getElementById('gps').innerText === 'Valid';
    initMap(lat, lng, gpsValid);
}