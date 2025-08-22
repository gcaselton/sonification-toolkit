const { app, BrowserWindow, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const kill = require('tree-kill');

const isDev = process.argv.includes('--dev') || (process.env.NODE_ENV === 'development' && !process.argv.includes('--prod'));

console.log('isDev:', isDev);
console.log('__dirname:', __dirname);
console.log('process.env.NODE_ENV:', process.env.NODE_ENV);

let mainWindow = null;
let backendProcess = null;
let isQuitting = false;

// Improved cleanup function
const cleanup = async () => {
    if (backendProcess && !backendProcess.killed) {
        console.log(`Attempting to kill backend process ${backendProcess.pid}...`);
        
        return new Promise((resolve) => {
            // Try graceful shutdown first
            kill(backendProcess.pid, 'SIGTERM', (err) => {
                if (err) {
                    console.log('SIGTERM failed, trying SIGKILL...', err.message);
                    // If graceful fails, force kill
                    kill(backendProcess.pid, 'SIGKILL', (killErr) => {
                        if (killErr) {
                            console.error('SIGKILL also failed:', killErr.message);
                            // Last resort: platform-specific kill
                            forceKillByPlatform();
                        } else {
                            console.log('Backend process killed with SIGKILL');
                        }
                        backendProcess = null;
                        resolve();
                    });
                } else {
                    console.log('Backend process killed gracefully');
                    backendProcess = null;
                    resolve();
                }
            });
        });
    }
};

// Platform-specific force kill as last resort
const forceKillByPlatform = () => {
    console.log('Using platform-specific force kill...');
    
    if (process.platform === 'win32') {
        // Windows: Use taskkill to force kill the process tree
        try {
            spawn('taskkill', ['/pid', backendProcess.pid, '/t', '/f'], {
                stdio: 'ignore'
            });
            
            // Also kill by name in case PID doesn't work
            spawn('taskkill', ['/f', '/im', 'backend.exe'], {
                stdio: 'ignore'
            });
            
            // Kill Python processes that might be running FastAPI
            spawn('taskkill', ['/f', '/im', 'python.exe'], {
                stdio: 'ignore'
            });
        } catch (error) {
            console.error('Platform-specific kill failed:', error.message);
        }
    } else {
        // Unix/Linux/macOS
        try {
            spawn('pkill', ['-f', 'backend'], {
                stdio: 'ignore'
            });
        } catch (error) {
            console.error('Platform-specific kill failed:', error.message);
        }
    }
};

// Check what's using port 8000 (for debugging)
const checkPort8000 = () => {
    if (process.platform === 'win32') {
        const netstat = spawn('netstat', ['-ano']);
        
        netstat.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.includes(':8000') && line.includes('LISTENING')) {
                    console.log('Port 8000 occupied by:', line.trim());
                }
            });
        });
    }
};

// Health check function to wait for backend to be ready
async function waitForBackend(maxAttempts = 60, port = 8000) {  // Increased to 60 seconds
    console.log('Waiting for backend to become ready...');
    
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(`http://localhost:${port}/`);
            if (response.ok) {
                const data = await response.json();
                // Check if it's your expected response
                if (data.message && data.message.includes('server is up and running')) {
                    console.log(`Backend is ready after ${i + 1} attempts!`);
                    return true;
                }
            }
        } catch (error) {
            // Backend not ready yet, this is expected
            if (i % 10 === 0 || i < 10) {  // Only log every 10 attempts after the first 10
                console.log(`Backend health check ${i + 1}/${maxAttempts}... (${error.message})`);
            }
        }
        
        // Wait 1 second before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Backend failed to start within ${maxAttempts} seconds`);
}

function startBackend() {
    return new Promise(async (resolve, reject) => {
        try {
            if (isDev) {
                // Development: Run Python directly
                console.log('Starting backend in development mode...');
                backendProcess = spawn('python', ['main.py'], {
                    cwd: path.join(__dirname, '../src/backend'),
                    shell: true
                });
            } else {
                // Production: Run bundled executable
                const backendExePath = path.join(__dirname, 'resources/backend.exe');
                console.log('Starting backend from:', backendExePath);
                
                // Check if executable exists
                const fs = require('fs');
                if (!fs.existsSync(backendExePath)) {
                    throw new Error(`Backend executable not found: ${backendExePath}`);
                }
                
                console.log('Backend executable exists, spawning process...');
                backendProcess = spawn(backendExePath, [], { 
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe']  // Ensure we can capture output
                });
            }

            backendProcess.stdout.on('data', (data) => {
                console.log('Backend:', data.toString());
            });

            backendProcess.stderr.on('data', (data) => {
                console.error('Backend Error:', data.toString());
            });

            backendProcess.on('close', (code) => {
                console.log(`Backend process exited with code ${code}`);
            });

            backendProcess.on('exit', (code, signal) => {
                console.log(`Backend process exited with code ${code} and signal ${signal}`);
            });

            backendProcess.on('disconnect', () => {
                console.log('Backend process disconnected');
            });

            backendProcess.on('error', (error) => {
                console.error('Backend spawn error:', error);
                reject(error);
            });

            // Replace setTimeout with health check
            try {
                await waitForBackend();
                resolve();
            } catch (healthError) {
                console.error('Backend health check failed:', healthError.message);
                reject(healthError);
            }

        } catch (error) {
            reject(error);
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        show: false,
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            enableRemoteModule: false, 
            nodeIntegration: false 
        }
    });

    // Remove the default menu
    Menu.setApplicationMenu(null);

    // Handle main window close event specifically
    mainWindow.on('close', async (event) => {
        if (backendProcess && !backendProcess.killed && !isQuitting) {
            console.log('Main window closing, cleaning up backend...');
            event.preventDefault(); // Prevent window close until cleanup is done
            
            isQuitting = true;
            await cleanup();
            
            // Check if anything is still on port 8000
            setTimeout(() => {
                console.log('Checking port 8000 after cleanup:');
                checkPort8000();
            }, 1000);
            
            // Now actually close the window
            mainWindow.destroy();
        }
    });

    if (isDev) {
        // In development, load the Vite dev server
        console.log('Loading development server...');
        mainWindow.loadURL('http://localhost:5173');
        // Open DevTools in development
        mainWindow.webContents.openDevTools();
    } else {
        // In production, load the built frontend
        const filePath = path.join(__dirname, 'build/index.html');
        console.log('Loading production file from:', filePath);
        
        // Check if file exists
        const fs = require('fs');
        console.log('File exists:', fs.existsSync(filePath));
        
        // Check build directory contents
        try {
            const buildDir = path.join(__dirname, 'build');
            const buildContents = fs.readdirSync(buildDir);
            console.log('Build directory contents:', buildContents);
        } catch (err) {
            console.log('Build directory error:', err.message);
        }
        
        mainWindow.loadFile(filePath);
        // mainWindow.webContents.openDevTools();
    }

    // Show only when ready, and maximize
    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });
}

// Start backend first, then create window
app.whenReady().then(async () => {
    try {
        await startBackend();
        console.log('Backend is ready, creating window...');
        createWindow();
    } catch (error) {
        console.error('Failed to start backend:', error);
        app.quit();
    }
});

app.on('window-all-closed', async () => {
    console.log('All windows closed, cleaning up...');
    
    if (!isQuitting) {
        isQuitting = true;
        await cleanup();
        
        // Double-check that the process is really dead
        if (backendProcess) {
            console.log('Backend process still exists, force killing...');
            forceKillByPlatform();
        }
        
        // Debug: Check what's still on port 8000
        setTimeout(() => {
            console.log('Final check - what\'s on port 8000:');
            checkPort8000();
        }, 2000);
    }
    
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async (event) => {
    if (backendProcess && !backendProcess.killed && !isQuitting) {
        console.log('App quitting, preventing until cleanup complete...');
        event.preventDefault(); // Prevent quit until cleanup is done
        
        isQuitting = true;
        await cleanup();
        
        console.log('Cleanup complete, now quitting...');
        app.quit(); // Now quit for real
    }
});

// Handle app reactivation (macOS)
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle process signals (Ctrl+C, terminal kill)
process.on('SIGINT', async () => {
    console.log('Received SIGINT, cleaning up...');
    if (!isQuitting) {
        isQuitting = true;
        await cleanup();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, cleaning up...');
    if (!isQuitting) {
        isQuitting = true;
        await cleanup();
    }
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    if (!isQuitting) {
        isQuitting = true;
        await cleanup();
    }
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    if (!isQuitting) {
        isQuitting = true;
        await cleanup();
    }
    process.exit(1);
});