import fcntl
import json
from pathlib import Path
import subprocess
import time

state = Path("/home/debian/.local/state/data-processor")
with (state / "startup.lock").open("a") as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    marker = state / "started.json"
    if not marker.exists():
        directory = Path("/home/debian/process-blocking-test")
        with (directory / "processor.log").open("ab", buffering=0) as output:
            child = subprocess.Popen(
                ["/usr/bin/nice", "-n", "5", "/usr/bin/python3", "data_processor.py"],
                cwd=directory, stdin=subprocess.DEVNULL, stdout=output, stderr=output,
                start_new_session=True,
            )
        time.sleep(2)
        if child.poll() is not None:
            raise RuntimeError("Data processor failed to start")
        marker.write_text(json.dumps({"pid": child.pid, "started_at": time.time()}) + "\n")
