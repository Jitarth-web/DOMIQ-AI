import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendDir = path.join(__dirname, 'backend');
const backendPkg = path.join(backendDir, 'package.json');

if (fs.existsSync(backendDir) && fs.existsSync(backendPkg)) {
  console.log('📦 Installing backend dependencies...');
  try {
    execSync('npm install', { cwd: backendDir, stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Failed to install backend dependencies:', err.message);
  }
} else {
  console.log('ℹ️ Backend folder or package.json not found. Skipping backend dependency installation.');
}
