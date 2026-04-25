import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import express from 'express';
import cors from 'cors';
import { ThermalPrinter, PrinterTypes } from "node-thermal-printer";

const app = express();
app.use(cors());
app.use(express.json());

let port = null;
let currentWeight = "0.000";
let parser = null;

console.log('Smart Scale Bridge ready (Scale only)...');

// --- SCALE ENDPOINTS ---

app.get('/connect', (req, res) => {
  if (port && port.isOpen) return res.json({ status: 'already_connected' });
  currentWeight = "0.000";
  port = new SerialPort({ path: 'COM3', baudRate: 9600, autoOpen: false });
  parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
  parser.on('data', (data) => {
    const match = data.match(/(\d+\.\d+)/);
    if (match) currentWeight = match[1];
  });
  port.open((err) => {
    if (err) return res.status(500).json({ error: err.message });
    console.log('POS grabbed COM3');
    res.json({ status: 'connected' });
  });
});

app.get('/disconnect', (req, res) => {
  if (port && port.isOpen) {
    port.close(() => {
      console.log('POS released COM3');
      currentWeight = "0.000";
      res.json({ status: 'disconnected' });
    });
  } else {
    res.json({ status: 'not_connected' });
  }
});

app.get('/weight', (req, res) => {
  res.json({ weight: currentWeight });
});

// --- PRINTER ENDPOINTS ---
app.post('/print', async (req, res) => {
  const { 
    order_number, 
    restaurant_name, 
    items, 
    subtotal, 
    tax, 
    discount, 
    total, 
    header_text, 
    footer_text 
  } = req.body;

  let printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'printer:eSSAE pos-80',
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

    await printer.execute();
    console.log(`Printed Bill: ${order_number}`);
    res.json({ status: 'printed' });
  } catch (error) {
    console.error("Print Error Details:", error);
    res.status(500).json({ 
      error: error.message || "Unknown hardware error",
      details: error.toString()
    });
  }
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Scale Bridge running on http://localhost:${PORT}`);
});
