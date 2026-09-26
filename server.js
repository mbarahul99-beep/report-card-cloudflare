// Entry point for Hostinger Node.js applications and other standard web hosting platforms
import fs from 'fs';
import path from 'path';

const serverPath = './dist/server.cjs';

if (!fs.existsSync(serverPath)) {
  console.error("=========================================================================");
  console.error("ERROR: Compiled server file (dist/server.cjs) not found!");
  console.error("Please run the build command first: npm run build");
  console.error("This will build the frontend assets and compile the server entry point.");
  console.error("=========================================================================");
  process.exit(1);
}

// Load the compiled CommonJS server bundle
import('./dist/server.cjs');
