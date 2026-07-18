import sys
import os
from watchfiles import watch

def test_watch():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.join(backend_dir, "app")
    print(f"Monitoring changes in: {app_dir}...")
    
    # Watch for 5 changes and print them, then exit
    count = 0
    for changes in watch(app_dir):
        print(f"Detected change: {changes}")
        count += 1
        if count >= 10:
            break

if __name__ == "__main__":
    test_watch()
