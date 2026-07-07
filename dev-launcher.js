import fs from 'fs';
import path from 'path';
import net from 'net';
import http from 'http';
import { fileURLToPath } from 'url';
import concurrently from 'concurrently';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to check if a port is in use
function checkInterface(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    if (host) {
      server.listen(port, host);
    } else {
      server.listen(port);
    }
  });
}

async function isPortAvailable(port) {
  const okDefault = await checkInterface(port);
  if (!okDefault) return false;

  const okV4 = await checkInterface(port, '127.0.0.1');
  if (!okV4) return false;

  const okV6 = await checkInterface(port, '::1');
  if (!okV6) return false;

  return true;
}

// Find next available port
async function getAvailablePort(startPort) {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
  }
  return port;
}

// Poll health check endpoint of backend
function waitBackendReady(port) {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve(true);
        }
      });
      req.on('error', () => {
        // Keep polling on error
      });
    }, 100);
  });
}

function checkIfBackendHealthy(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200 && json.status === 'healthy') {
            resolve(true);
          } else {
            resolve(false);
          }
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function start() {
  // 1. Detect ports
  const defaultFrontendPort = 8080;
  const defaultBackendPort = 5000;

  const frontendPort = await getAvailablePort(defaultFrontendPort);
  
  let backendPort = defaultBackendPort;
  let startBackend = true;

  const isBackendAvailable = await isPortAvailable(defaultBackendPort);
  if (!isBackendAvailable) {
    const isHealthy = await checkIfBackendHealthy(defaultBackendPort);
    if (isHealthy) {
      console.log(`ℹ️ Backend port ${defaultBackendPort} is occupied by an active healthy instance. Reusing existing backend service.`);
      startBackend = false;
    } else {
      backendPort = await getAvailablePort(defaultBackendPort + 1);
      console.log(`⚠️ Port ${defaultBackendPort} occupied by another process. Auto-shifted Backend to port ${backendPort}`);
    }
  }

  if (frontendPort !== defaultFrontendPort) {
    console.log(`⚠️ Port ${defaultFrontendPort} occupied. Auto-shifted Frontend to port ${frontendPort}`);
  }

  // 2. Resolve backend entry point
  const backendDir = path.join(__dirname, 'backend');
  const backendPkgPath = path.join(backendDir, 'package.json');
  let entryPoint = 'server.js'; // fallback

  if (fs.existsSync(backendPkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf8'));
      if (pkg.main) {
        entryPoint = pkg.main;
      } else if (pkg.scripts && pkg.scripts.start) {
        const startScript = pkg.scripts.start;
        const match = startScript.match(/(?:node|nodemon)\s+(.+)/);
        if (match && match[1]) {
          entryPoint = match[1].trim();
        }
      }
    } catch (err) {
      console.error('⚠️ Failed to parse backend package.json:', err.message);
    }
  }

  const backendEntryPath = path.join('backend', entryPoint);

  // Set environment variables dynamically
  process.env.PORT = backendPort;
  process.env.VITE_API_BASE_URL = `http://localhost:${backendPort}`;
  process.env.FRONTEND_URL = `http://localhost:${frontendPort}`;

  // 3. Launch concurrently
  const commands = [
    {
      command: `vite --port ${frontendPort}`,
      name: 'frontend',
      prefixColor: 'cyan',
      env: {
        VITE_API_BASE_URL: process.env.VITE_API_BASE_URL
      }
    }
  ];

  if (startBackend) {
    commands.push({
      command: `nodemon --watch backend --ignore backend/database.sqlite --ignore backend/uploads/ ${backendEntryPath}`,
      name: 'backend',
      prefixColor: 'magenta',
      env: {
        PORT: backendPort,
        FRONTEND_URL: process.env.FRONTEND_URL
      }
    });
  }

  const { result } = concurrently(commands, {
    prefix: '[{name}]',
    killOthers: ['failure', 'success'],
    restartDelay: 1000
  });

  // 4. Wait for servers to boot, then print summary
  waitBackendReady(backendPort).then(() => {
    console.log('\n==================================================');
    console.log(`✓ Frontend: http://localhost:${frontendPort}`);
    console.log(`✓ Backend: http://localhost:${backendPort}`);
    console.log('✓ API: Connected');
    console.log('✓ Watching for changes...');
    console.log('==================================================\n');
  });

  result.then(
    () => {
      console.log('✓ Development servers shut down cleanly.');
      process.exit(0);
    },
    (err) => {
      console.error('❌ Development server exited with error:', err);
      process.exit(1);
    }
  );
}

start().catch((err) => {
  console.error('❌ Failed to launch dev environment:', err);
  process.exit(1);
});
