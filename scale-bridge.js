import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const express = require('express');
const cors = require('cors');
const { ThermalPrinter, PrinterTypes } = require("node-thermal-printer");
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

let port = null;
let currentWeight = "0.000";
let parser = null;

console.log('Smart Scale Bridge ready (PowerShell Mode)...');

// --- SCALE ENDPOINTS ---

app.get('/connect', (req, res) => {
  if (port && port.isOpen) return res.json({ status: 'already_connected' });
  currentWeight = "0.000";
  try {
    port = new SerialPort({ path: 'COM3', baudRate: 9600, autoOpen: false });
    parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    parser.on('data', (data) => {
      const match = data.match(/(\d+\.\d+)/);
      if (match) currentWeight = match[1];
    });
    port.open((err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ status: 'connected' });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/weight', (req, res) => res.json({ weight: currentWeight }));

// --- PRINTER ENDPOINTS ---

app.get('/list-printers', (req, res) => {
  exec('powershell "Get-Printer | Select-Object -ExpandProperty Name"', (error, stdout) => {
    if (error) return res.status(500).json({ error: error.message });
    const printers = stdout.split('\r\n')
      .map(name => name.trim())
      .filter(name => name.length > 0)
      .map(name => ({ name }));
    res.json(printers);
  });
});

app.post('/print', async (req, res) => {
  const { order_number, restaurant_name, items, subtotal, tax, discount, total, header_text, footer_text, printer_name } = req.body;
  const targetPrinter = printer_name || "eSSAE pos-80";

  // FIX: Using a network-style interface prevents the "No Driver" error 
  // because the library won't try to load the broken 'printer' module.
  let printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'tcp://localhost' 
  });

  try {
    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.setTextDoubleWidth();
    printer.println(restaurant_name || "Myfroyoland");
    printer.setTextNormal();
    printer.println(header_text || "");
    printer.drawLine();

    printer.alignLeft();
    printer.println(`Bill: ${order_number || 'N/A'}`);
    printer.println(`Date: ${new Date().toLocaleString()}`);
    printer.drawLine();

    printer.tableCustom([
      { text: "Item", align: "LEFT", width: 0.5 },
      { text: "Qty", align: "CENTER", width: 0.2 },
      { text: "Price", align: "RIGHT", width: 0.3 }
    ]);
    printer.drawLine();

    if (items && Array.isArray(items)) {
      items.forEach(item => {
        printer.tableCustom([
          { text: item.item_name, align: "LEFT", width: 0.5 },
          { text: String(item.quantity), align: "CENTER", width: 0.2 },
          { text: String(item.amount), align: "RIGHT", width: 0.3 }
        ]);
      });
    }

    printer.drawLine();
    printer.alignRight();
    printer.println(`Subtotal: ${subtotal}`);
    printer.println(`Tax: ${tax}`);
    printer.println(`Discount: ${discount}`);
    printer.setTextDoubleHeight();
    printer.println(`TOTAL: ${total}`);
    printer.setTextNormal();
    printer.drawLine();

    printer.alignCenter();
    printer.println(footer_text || "Thank you!");
    printer.cut();

    // Save receipt text to file
    const receiptText = printer.getText();
    const tempFile = path.join(process.cwd(), 'temp_receipt.txt');
    fs.writeFileSync(tempFile, receiptText);

    // Send to printer via PowerShell
    const psCommand = `powershell -Command "Get-Content -Path '${tempFile}' | Out-Printer -Name '${targetPrinter}'"`;
    
    exec(psCommand, (error, stdout, stderr) => {
      if (error) return res.status(500).json({ error: "Windows Print Error", details: stderr || error.message });
      res.json({ status: 'printed' });
    });

  } catch (error) {
    res.status(500).json({ error: "Bridge Internal Error", details: error.message });
  }
});

app.listen(5001, () => console.log(`Scale Bridge running on http://localhost:5001`));
