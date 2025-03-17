const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store the latest sensor data
let latestData = {
  acceleration: 0,
  fallDetected: false,
  heartRate: null,
  spo2: null,
  temperature: null,
  latitude: null,
  longitude: null,
  satellites: null,
  timestamp: Date.now()
};

// Store historical data for charts (limit to 50 entries)
const historyData = {
  acceleration: [],
  heartRate: [],
  spo2: [],
  temperature: []
};

// Function to add data to history
function addToHistory(key, value, timestamp) {
  if (historyData[key]) {
    historyData[key].push({ value, timestamp });
    // Keep only the last 50 entries
    if (historyData[key].length > 50) {
      historyData[key].shift();
    }
  }
}

// API endpoint to receive data from ESP32
app.post('/data', (req, res) => {
  console.log('Received data:', req.body);
  
  // Update latest data
  latestData = {
    ...req.body,
    timestamp: Date.now()
  };
  
  // Add to history
  const timestamp = Date.now();
  addToHistory('acceleration', req.body.acceleration, timestamp);
  if (req.body.heartRate) addToHistory('heartRate', req.body.heartRate, timestamp);
  if (req.body.spo2) addToHistory('spo2', req.body.spo2, timestamp);
  if (req.body.temperature) addToHistory('temperature', req.body.temperature, timestamp);
  
  // Emit data to all connected clients
  io.emit('sensorData', latestData);
  
  res.status(200).send({ status: 'success' });
});

// API endpoint to get latest data
app.get('/api/latest', (req, res) => {
  res.json(latestData);
});

// API endpoint to get historical data
app.get('/api/history', (req, res) => {
  res.json(historyData);
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Send current data upon connection
  socket.emit('sensorData', latestData);
  socket.emit('historyData', historyData);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});