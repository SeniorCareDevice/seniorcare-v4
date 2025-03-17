// Initialize objects
const socket = io();
let map, marker;
let charts = {};
let gauges = {};

// DOM elements
const elements = {
  connection: document.getElementById('connection-status'),
  values: {
    heartRate: document.getElementById('heartRateValue'),
    spo2: document.getElementById('spo2Value'),
    temperature: document.getElementById('temperatureValue'),
    acceleration: document.getElementById('accelerationValue'),
    latitude: document.getElementById('latitudeValue'),
    longitude: document.getElementById('longitudeValue'),
    satellites: document.getElementById('satellitesValue')
  },
  fall: {
    alert: document.getElementById('fallAlert'),
    status: document.getElementById('fallStatus')
  },
  eventLog: document.getElementById('eventLog')
};

// Connection handling
socket.on('connect', () => {
  elements.connection.textContent = 'Connected';
  elements.connection.className = 'alert alert-success';
});

socket.on('disconnect', () => {
  elements.connection.textContent = 'Disconnected';
  elements.connection.className = 'alert alert-danger';
});

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  setupGauges();
  setupCharts();
  setupMap();
  
  // Get initial data
  fetch('/api/latest').then(res => res.json()).then(updateDashboard);
  fetch('/api/history').then(res => res.json()).then(updateCharts);
  
  // Listen for updates
  socket.on('sensorData', data => {
    updateDashboard(data);
    logEvent(data);
  });
  
  socket.on('historyData', updateCharts);
});

// Setup gauge meters
function setupGauges() {
  const gaugeConfig = {
    heartRate: {
      min: 40, max: 180, value: 70,
      zones: [
        {color: "#30B32D", min: 40, max: 60},
        {color: "#6DD400", min: 60, max: 100},
        {color: "#FFDD00", min: 100, max: 140},
        {color: "#FF6D00", min: 140, max: 160},
        {color: "#FF0000", min: 160, max: 180}
      ]
    },
    spo2: {
      min: 70, max: 100, value: 95,
      zones: [
        {color: "#FF0000", min: 70, max: 85},
        {color: "#FF6D00", min: 85, max: 90},
        {color: "#FFDD00", min: 90, max: 95},
        {color: "#30B32D", min: 95, max: 100}
      ]
    },
    temperature: {
      min: 35, max: 42, value: 37,
      zones: [
        {color: "#FFDD00", min: 35, max: 36.5},
        {color: "#30B32D", min: 36.5, max: 37.5},
        {color: "#FFDD00", min: 37.5, max: 38.5},
        {color: "#FF6D00", min: 38.5, max: 39.5},
        {color: "#FF0000", min: 39.5, max: 42}
      ]
    },
    acceleration: {
      min: 0, max: 30, value: 9.8,
      zones: [
        {color: "#30B32D", min: 0, max: 10},
        {color: "#FFDD00", min: 10, max: 20},
        {color: "#FF6D00", min: 20, max: 25},
        {color: "#FF0000", min: 25, max: 30}
      ]
    }
  };

  Object.entries(gaugeConfig).forEach(([key, config]) => {
    const gauge = new Gauge(document.getElementById(`${key}Gauge`));
    gauge.setOptions({
      angle: 0,
      lineWidth: 0.2,
      radiusScale: 0.9,
      pointer: {
        length: 0.6,
        strokeWidth: 0.035,
        color: '#000000'
      },
      limitMax: false,
      limitMin: false,
      highDpiSupport: true,
      staticZones: config.zones.map(zone => ({
        strokeStyle: zone.color,
        min: zone.min,
        max: zone.max
      }))
    });
    gauge.maxValue = config.max;
    gauge.setMinValue(config.min);
    gauge.animationSpeed = 32;
    gauge.set(config.value);
    gauges[key] = gauge;
  });
}

// Setup charts
function setupCharts() {
  const chartConfig = {
    heartRate: { color: 'rgb(255, 99, 132)', min: 40, max: 180, label: 'Heart Rate (BPM)' },
    spo2: { color: 'rgb(54, 162, 235)', min: 85, max: 100, label: 'Blood Oxygen (%)' },
    temperature: { color: 'rgb(255, 159, 64)', min: 35, max: 42, label: 'Temperature (°C)' },
    acceleration: { color: 'rgb(75, 192, 192)', min: 0, max: 30, label: 'Acceleration (m/s²)' }
  };

  Object.entries(chartConfig).forEach(([key, config]) => {
    const ctx = document.getElementById(`${key}Chart`).getContext('2d');
    charts[key] = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: config.label,
          data: [],
          borderColor: config.color,
          backgroundColor: config.color.replace('rgb', 'rgba').replace(')', ', 0.2)'),
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'second',
              displayFormats: {
                second: 'HH:mm:ss'
              }
            }
          },
          y: {
            min: config.min,
            max: config.max,
            title: {
              display: true,
              text: config.label.split(' ').pop()
            }
          }
        },
        animation: { duration: 0 }
      }
    });
  });
}

// Setup map
function setupMap() {
  map = L.map('map').setView([0, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
  }).addTo(map);
  marker = L.marker([0, 0]).addTo(map);
}

// Update dashboard with new data
function updateDashboard(data) {
  // Update gauges and values
  ['heartRate', 'spo2', 'temperature', 'acceleration'].forEach(key => {
    if (data[key] !== null && data[key] !== undefined) {
      elements.values[key].textContent = `${data[key].toFixed(1)} ${key === 'heartRate' ? 'BPM' : key === 'spo2' ? '%' : key === 'temperature' ? '°C' : 'm/s²'}`;
      gauges[key].set(data[key]);
    } else {
      elements.values[key].textContent = 'N/A';
    }
  });
  
  // Update fall status
  if (data.fallDetected) {
    elements.fall.alert.className = 'alert mb-0 alert-danger';
    elements.fall.status.textContent = 'FALL DETECTED!';
  } else {
    elements.fall.alert.className = 'alert mb-0 alert-success';
    elements.fall.status.textContent = 'Normal (No Falls)';
  }
  
  // Update GPS values
  elements.values.latitude.value = data.latitude !== null ? data.latitude.toFixed(6) : 'N/A';
  elements.values.longitude.value = data.longitude !== null ? data.longitude.toFixed(6) : 'N/A';
  elements.values.satellites.value = data.satellites !== null ? data.satellites : 'N/A';
  
  // Update map if coordinates are valid
  if (data.latitude !== null && data.longitude !== null) {
    const newPosition = [data.latitude, data.longitude];
    marker.setLatLng(newPosition);
    map.setView(newPosition, 15);
    marker.bindPopup(`Lat: ${data.latitude.toFixed(6)}<br>Long: ${data.longitude.toFixed(6)}`);
  }
}

// Update charts with history data
function updateCharts(data) {
  Object.entries(data).forEach(([key, entries]) => {
    if (charts[key]) {
      charts[key].data.datasets[0].data = entries.map(entry => ({
        x: new Date(entry.timestamp),
        y: entry.value
      }));
      charts[key].update();
    }
  });
}

// Log events to the event table
function logEvent(data) {
  const eventLog = elements.eventLog;
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  
  // Create log entry
  let event = null;
  
  if (data.fallDetected) {
    event = { time: timeString, type: 'Fall Detected', details: `Acceleration: ${data.acceleration.toFixed(2)} m/s²` };
  } else if (data.heartRate !== null && (data.heartRate < 50 || data.heartRate > 120)) {
    event = { time: timeString, type: 'Abnormal Heart Rate', details: `${data.heartRate.toFixed(1)} BPM` };
  } else if (data.spo2 !== null && data.spo2 < 90) {
    event = { time: timeString, type: 'Low Blood Oxygen', details: `${data.spo2.toFixed(1)}%` };
  } else if (data.temperature !== null && (data.temperature < 36 || data.temperature > 38)) {
    event = { time: timeString, type: 'Abnormal Temperature', details: `${data.temperature.toFixed(1)}°C` };
  }
  
  if (event) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${event.time}</td>
      <td>${event.type}</td>
      <td>${event.details}</td>
    `;
    
    eventLog.prepend(row);
    
    // Keep only last 10 events
    if (eventLog.children.length > 10) {
      eventLog.removeChild(eventLog.lastChild);
    }
  }
}