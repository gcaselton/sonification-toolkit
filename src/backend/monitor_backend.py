import psutil
import time
import datetime

def find_process_by_port(port: int):
    """Return the psutil.Process using the given TCP port."""
    for conn in psutil.net_connections(kind='inet'):
        if conn.laddr and conn.laddr.port == port and conn.status == psutil.CONN_LISTEN:
            try:
                return psutil.Process(conn.pid)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
    return None


def monitor_backend_by_port(port=8000, interval=2):
    proc = find_process_by_port(port)
    if not proc:
        print(f"⚠️  Could not find any process listening on port {port}.")
        print("Make sure your backend is running before starting this monitor.")
        return

    print(f"✅ Monitoring PID {proc.pid} (port {port}) every {interval}s")
    print(f"{'Time':<20}{'CPU %':<10}{'Memory MB':<12}{'RSS %':<10}")
    print("-" * 55)

    # prime CPU measurement
    proc.cpu_percent(interval=None)
    time.sleep(interval)

    try:
        while True:
            cpu = proc.cpu_percent(interval=interval)
            mem_info = proc.memory_info()
            mem_mb = mem_info.rss / 1024**2
            mem_percent = proc.memory_percent()
            now = datetime.datetime.now().strftime("%H:%M:%S")
            print(f"{now:<20}{cpu:<10.2f}{mem_mb:<12.1f}{mem_percent:<10.2f}")
    except KeyboardInterrupt:
        print("\nStopped monitoring.")
    except psutil.NoSuchProcess:
        print("\n❌ The monitored process ended.")


if __name__ == "__main__":
    monitor_backend_by_port(port=8000, interval=2)
