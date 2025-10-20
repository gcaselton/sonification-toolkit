import logging
logging.basicConfig(level=logging.DEBUG)
for lib in ["uvicorn", "matplotlib", "httpcore", "asyncio", "httpx", "urllib3", 'lightkurve', 'scipy']:
    logging.getLogger(lib).setLevel(logging.INFO)

logging.getLogger("uvicorn.error")

from fastapi import FastAPI
from light_curves import router as light_curve_router
from core import router as core_router
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from paths import clear_tmp_dir, SYNTHS_DIR, SAMPLES_DIR
from sounds import cache_online_assets
from contextlib import asynccontextmanager
from config import GITHUB_USER, GITHUB_REPO
from datetime import datetime
import asyncio, os, httpx, psutil, tracemalloc




async def safe_cache_assets():
    try:
        await cache_online_assets()
        print("Cache complete")
    except Exception as e:
        print("Error caching assets:", e)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(clear_tmp_dir)
    print("TMP cleared")

    # Run caching in background
    asyncio.create_task(safe_cache_assets())

    yield



app = FastAPI(lifespan=lifespan)

# Start tracing allocations as soon as the app starts
tracemalloc.start()

snapshots = []  # store a few snapshots in memory


# Track baseline memory for leak detection
baseline_memory = None
start_time = None

origins = [
    "http://localhost:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import API endpoints
app.include_router(light_curve_router)
app.include_router(core_router)


@app.get("/")
def get_status():
    """
    Root of the API which returns a message to confirm the server is working.

    - Returns: JSON object of a string message.
    """
    return {'message': 'Hello! The server is up and running.'}

# Start tracing allocations as soon as the app starts
tracemalloc.start()

snapshots = []  # store a few snapshots in memory

@app.get("/debug/memory")
def memory_debug():
    """Take a snapshot and compare it with the previous one."""
    snapshot = tracemalloc.take_snapshot()
    snapshots.append(snapshot)
    if len(snapshots) < 2:
        return {"message": "First snapshot taken, call again later."}

    top_stats = snapshots[-1].compare_to(snapshots[-2], 'lineno')
    result = []
    for stat in top_stats[:10]:  # top 10 lines by memory growth
        result.append(str(stat))

    return {"top_allocations": result}

@app.get("/stats")
async def get_stats():
    """API endpoint for current stats"""
    global baseline_memory, start_time
    
    process = psutil.Process(os.getpid())
    current_mem = process.memory_info().rss / 1024 / 1024
    
    # Set baseline on first call
    if baseline_memory is None:
        baseline_memory = current_mem
        start_time = datetime.now()
    
    return {
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "cpu_percent": round(process.cpu_percent(interval=0.1), 2),
        "memory_mb": round(current_mem, 2),
        "memory_percent": round(process.memory_percent(), 2),
        "num_threads": process.num_threads(),
        "baseline_memory": round(baseline_memory, 2),
        "memory_delta": round(current_mem - baseline_memory, 2),
        "uptime_seconds": (datetime.now() - start_time).total_seconds()
    }

@app.get("/monitor", response_class=HTMLResponse)
async def monitor_dashboard():
    """Live monitoring dashboard with memory leak detection"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Resource Monitor</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-width: 1200px;
                margin: 30px auto;
                padding: 20px;
                background: #1a1a1a;
                color: #fff;
            }
            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 15px;
            }
            .metric-card {
                background: #2d2d2d;
                border-radius: 8px;
                padding: 20px;
                border-left: 4px solid #4CAF50;
            }
            .metric-card.warning {
                border-left-color: #ff9800;
            }
            .metric-card.danger {
                border-left-color: #f44336;
            }
            .metric-value {
                font-size: 2.5em;
                font-weight: bold;
                color: #4CAF50;
            }
            .metric-value.warning {
                color: #ff9800;
            }
            .metric-value.danger {
                color: #f44336;
            }
            .metric-label {
                font-size: 0.9em;
                color: #aaa;
                text-transform: uppercase;
                margin-bottom: 10px;
            }
            .sub-value {
                font-size: 0.9em;
                color: #888;
                margin-top: 5px;
            }
            .history {
                height: 60px;
                display: flex;
                align-items: flex-end;
                gap: 2px;
                margin-top: 10px;
            }
            .bar {
                flex: 1;
                background: #4CAF50;
                opacity: 0.7;
                transition: height 0.3s ease;
            }
            .bar.warning {
                background: #ff9800;
            }
            .bar.danger {
                background: #f44336;
            }
            h1 {
                text-align: center;
                color: #4CAF50;
                margin-bottom: 10px;
            }
            .timestamp {
                text-align: center;
                color: #666;
                font-size: 0.9em;
                margin-bottom: 20px;
            }
            .leak-indicator {
                text-align: center;
                padding: 15px;
                background: #2d2d2d;
                border-radius: 8px;
                margin-bottom: 20px;
                border: 2px solid #4CAF50;
            }
            .leak-indicator.warning {
                border-color: #ff9800;
                background: #332800;
            }
            .leak-indicator.danger {
                border-color: #f44336;
                background: #330000;
            }
            .leak-status {
                font-size: 1.2em;
                font-weight: bold;
            }
            .full-width {
                grid-column: 1 / -1;
            }
            .memory-graph {
                background: #2d2d2d;
                border-radius: 8px;
                padding: 20px;
                border-left: 4px solid #2196F3;
            }
            canvas {
                width: 100%;
                height: 150px;
            }
        </style>
    </head>
    <body>
        <h1>🔥 Live Resource Monitor</h1>
        <div class="timestamp" id="timestamp">Last updated: --</div>
        
        <div class="leak-indicator" id="leak-indicator">
            <div class="leak-status" id="leak-status">🟢 Memory: Normal</div>
            <div class="sub-value" id="leak-info">Monitoring for memory leaks...</div>
        </div>
        
        <div class="grid">
            <div class="metric-card" id="cpu-card">
                <div class="metric-label">CPU Usage</div>
                <div class="metric-value" id="cpu">--</div>
                <div class="history" id="cpu-history"></div>
            </div>
            
            <div class="metric-card" id="memory-card">
                <div class="metric-label">Current Memory</div>
                <div class="metric-value" id="memory">--</div>
                <div class="sub-value">
                    Baseline: <span id="baseline">--</span> MB
                </div>
                <div class="history" id="memory-history"></div>
            </div>
            
            <div class="metric-card" id="delta-card">
                <div class="metric-label">Memory Growth</div>
                <div class="metric-value" id="memory-delta">--</div>
                <div class="sub-value">
                    Since start (<span id="uptime">--</span>)
                </div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Memory %</div>
                <div class="metric-value" id="memory-percent">--</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Active Threads</div>
                <div class="metric-value" id="threads">--</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Growth Rate</div>
                <div class="metric-value" id="growth-rate">--</div>
                <div class="sub-value">MB per minute</div>
            </div>
        </div>
        
        <div class="memory-graph full-width" style="margin-top: 20px;">
            <div class="metric-label">Memory Over Time</div>
            <canvas id="memory-chart"></canvas>
        </div>

        <script>
            const cpuHistory = [];
            const memHistory = [];
            const deltaHistory = [];
            const timeHistory = [];
            const maxHistory = 50;
            const memoryDataPoints = [];
            const maxDataPoints = 100;
            
            let firstMemory = null;
            let firstTime = null;

            function formatUptime(seconds) {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}m ${secs}s`;
            }

            function updateHistoryBar(containerId, history, value, max) {
                const container = document.getElementById(containerId);
                history.push(value);
                if (history.length > maxHistory) history.shift();
                
                const threshold = max * 0.7;
                const dangerThreshold = max * 0.9;
                
                container.innerHTML = history.map(v => {
                    let className = 'bar';
                    if (v > dangerThreshold) className += ' danger';
                    else if (v > threshold) className += ' warning';
                    return `<div class="${className}" style="height: ${(v/max)*100}%"></div>`;
                }).join('');
            }
            
            function drawMemoryChart() {
                const canvas = document.getElementById('memory-chart');
                const ctx = canvas.getContext('2d');
                const width = canvas.width = canvas.offsetWidth;
                const height = canvas.height = 150;
                
                ctx.clearRect(0, 0, width, height);
                
                if (memoryDataPoints.length < 2) return;
                
                const maxMem = Math.max(...memoryDataPoints.map(p => p.value));
                const minMem = Math.min(...memoryDataPoints.map(p => p.value));
                const range = maxMem - minMem || 10;
                
                // Draw grid
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 1;
                for (let i = 0; i < 5; i++) {
                    const y = (height / 4) * i;
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                    ctx.stroke();
                }
                
                // Draw line
                ctx.strokeStyle = '#4CAF50';
                ctx.lineWidth = 2;
                ctx.beginPath();
                
                memoryDataPoints.forEach((point, i) => {
                    const x = (i / (memoryDataPoints.length - 1)) * width;
                    const y = height - ((point.value - minMem) / range) * height * 0.9 - height * 0.05;
                    
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                
                ctx.stroke();
                
                // Draw baseline
                if (firstMemory) {
                    const baselineY = height - ((firstMemory - minMem) / range) * height * 0.9 - height * 0.05;
                    ctx.strokeStyle = '#888';
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.moveTo(0, baselineY);
                    ctx.lineTo(width, baselineY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }

            async function updateStats() {
                try {
                    const response = await fetch('/stats');
                    const data = await response.json();
                    
                    // Store first reading
                    if (firstMemory === null) {
                        firstMemory = data.memory_mb;
                        firstTime = Date.now();
                    }
                    
                    // Update basic stats
                    document.getElementById('cpu').textContent = data.cpu_percent + '%';
                    document.getElementById('memory').textContent = data.memory_mb + ' MB';
                    document.getElementById('memory-percent').textContent = data.memory_percent + '%';
                    document.getElementById('threads').textContent = data.num_threads;
                    document.getElementById('timestamp').textContent = 'Last updated: ' + data.timestamp;
                    document.getElementById('baseline').textContent = data.baseline_memory;
                    document.getElementById('uptime').textContent = formatUptime(data.uptime_seconds);
                    
                    // Update memory delta
                    const delta = data.memory_delta;
                    const deltaEl = document.getElementById('memory-delta');
                    const deltaCard = document.getElementById('delta-card');
                    deltaEl.textContent = (delta >= 0 ? '+' : '') + delta + ' MB';
                    
                    // Calculate growth rate (MB per minute)
                    const growthRate = data.uptime_seconds > 0 
                        ? (delta / data.uptime_seconds) * 60 
                        : 0;
                    document.getElementById('growth-rate').textContent = growthRate.toFixed(2);
                    
                    // Memory leak detection
                    const leakIndicator = document.getElementById('leak-indicator');
                    const leakStatus = document.getElementById('leak-status');
                    const leakInfo = document.getElementById('leak-info');
                    
                    if (delta > 100 || growthRate > 5) {
                        leakIndicator.className = 'leak-indicator danger';
                        leakStatus.textContent = '🔴 Possible Memory Leak!';
                        leakInfo.textContent = `Memory grew ${delta.toFixed(1)} MB (${growthRate.toFixed(2)} MB/min)`;
                        deltaEl.className = 'metric-value danger';
                        deltaCard.className = 'metric-card danger';
                    } else if (delta > 50 || growthRate > 2) {
                        leakIndicator.className = 'leak-indicator warning';
                        leakStatus.textContent = '🟡 Memory Increasing';
                        leakInfo.textContent = `Memory grew ${delta.toFixed(1)} MB (${growthRate.toFixed(2)} MB/min) - Monitor closely`;
                        deltaEl.className = 'metric-value warning';
                        deltaCard.className = 'metric-card warning';
                    } else {
                        leakIndicator.className = 'leak-indicator';
                        leakStatus.textContent = '🟢 Memory: Normal';
                        leakInfo.textContent = `Growth: ${delta.toFixed(1)} MB (${growthRate.toFixed(2)} MB/min) - Looking good!`;
                        deltaEl.className = 'metric-value';
                        deltaCard.className = 'metric-card';
                    }
                    
                    // Update histories
                    updateHistoryBar('cpu-history', cpuHistory, data.cpu_percent, 100);
                    updateHistoryBar('memory-history', memHistory, data.memory_mb, Math.max(...memHistory, 500));
                    
                    // Add to memory chart
                    memoryDataPoints.push({
                        time: Date.now(),
                        value: data.memory_mb
                    });
                    if (memoryDataPoints.length > maxDataPoints) {
                        memoryDataPoints.shift();
                    }
                    drawMemoryChart();
                    
                } catch (error) {
                    console.error('Error fetching stats:', error);
                }
            }

            // Update every 500ms
            updateStats();
            setInterval(updateStats, 500);
        </script>
    </body>
    </html>
    """

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
