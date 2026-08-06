import os
from watchfiles import watch, PythonFilter

class CustomPythonFilter(PythonFilter):
    ignore_dirs = set(PythonFilter.ignore_dirs) | {'logs'}

def run_watch():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    out_file = os.path.join(backend_dir, "watch_changes_v2.txt")
    
    with open(out_file, "w", encoding="utf-8") as f:
        f.write("Monitoring started for backend_dir v2...\n")
        f.flush()
        
        for changes in watch(backend_dir, watch_filter=CustomPythonFilter()):
            f.write(f"Change: {changes}\n")
            f.flush()

if __name__ == "__main__":
    run_watch()
