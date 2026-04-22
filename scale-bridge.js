import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

let port = null;
let currentWeight = "0.000";
let parser = null;

console.log('Smart Scale Bridge waiting for POS commands...');

// Endpoint to grab the COM port
app.get('/connect', (req, res) => {
  if (port && port.isOpen) {
    return res.json({ status: 'already_connected' });
  }

  currentWeight = "0.000";
  port = new SerialPort({ 
    path: 'COM3', 
    baudRate: 9600, 
    autoOpen: false 
  });

  parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  parser.on('data', (data) => {
    // Essae DS-852 format: "ST,GS,+  0.500kg"
    const match = data.match(/(\d+\.\d+)/);
    if (match) {
      currentWeight = match[1];
    }
  });

  port.open((err) => {
    if (err) {
      console.error('Failed to grab COM3:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log('>>> POS opened the popup: COM3 LOCKED');
    res.json({ status: 'connected' });
  });
});

// Endpoint to release the COM port
app.get('/disconnect', (req, res) => {
  if (port && port.isOpen) {
    port.close((err) => {
      console.log('<<< POS closed the popup: COM3 RELEASED');
      currentWeight = "0.000";
      res.json({ status: 'disconnected' });
    });
  } else {
    res.json({ status: 'not_connected' });
  }
});

// Continuous weight reading
app.get('/weight', (req, res) => {
  res.json({ weight: currentWeight });
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Smart Bridge running on http://localhost:${PORT}`);
});
