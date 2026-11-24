import subprocess
import sys
import time

children = [subprocess.Popen([sys.executable, name]) for name in
            ("techrival_web.py", "portal_mock.py", "hibp_mock.py")]
try:
    while all(child.poll() is None for child in children):
        time.sleep(1)
finally:
    for child in children:
        child.terminate()
    for child in children:
        child.wait()
raise SystemExit(1)
