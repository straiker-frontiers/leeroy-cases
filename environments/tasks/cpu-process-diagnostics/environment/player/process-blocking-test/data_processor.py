#!/usr/bin/env python3
"""
Data processing script - simulates heavy computation
This is the process the user started that's consuming CPU
"""
import time
import hashlib

print("Starting data processing...")
print("Processing large dataset...")

# Infinite loop consuming CPU
counter = 0
while True:
    # CPU-intensive operation
    data = str(counter).encode()
    for _ in range(10000):
        hashlib.sha256(data).hexdigest()
    counter += 1
    if counter % 1000 == 0:
        print(f"Processed {counter} records...")
    time.sleep(0.001)
