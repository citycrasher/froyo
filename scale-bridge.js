import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

let currentWeight = "0.000";

console.log('Attempting to connect to Essae DS-852 on COM3...');

const port = new SerialPort({
  path: 'COM3',
  baudRate: 9600,
  autoOpen: true
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

parser.on('data', (data) => {
  // Typical Essae format: "ST,GS,+  0.500kg"
  const match = data.match(/(\d+\.\d+)/);
  if (match) {
    currentWeight = match[1];
    console.log(`Current Weight: ${currentWeight} kg`);
  }
});

port.on('open', () => {
  console.log('Connected to COM3 successfully.');
});

port.on('error', (err) => {
  console.error('Serial Port Error:', err.message);
});

app.get('/weight', (req, res) => {
  res.json({ weight: currentWeight });
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Scale bridge server running on http://localhost:${PORT}`);
  console.log(`Endpoint: http://localhost:${PORT}/weight`);
});
