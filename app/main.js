import { registerServiceWorker } from './offline.js';
import { startApp } from './ui/app.js';

const root = document.getElementById('app');
if (root) await startApp(root);
await registerServiceWorker();
