let Gpio: any;

if (process.platform === 'linux') {
  try {
    Gpio = require('onoff').Gpio;
  } catch (err) {
    console.error('⚠️ Failed to load onoff on Linux:', err);
    Gpio = null;
  }
} else {
  class GpioMock {
    static HIGH = 1;
    static LOW = 0;
    constructor(public pin: number, public direction: string) {
      console.log(`[MOCK] GPIO ${pin} set as ${direction}`);
    }
    readSync() { return GpioMock.HIGH; }
    writeSync(val: number) { console.log(`[MOCK] Write ${val}`); }
    watch(cb: (err: any, val: number) => void) {
      console.log('[MOCK] Watching...');
      setInterval(() => cb(null, 1), 1000);
    }
    unexport() { console.log('[MOCK] GPIO cleanup'); }
  }
  Gpio = GpioMock;
}

export { Gpio };