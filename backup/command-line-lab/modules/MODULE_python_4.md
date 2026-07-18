# Python Module 4: Files & Exceptions

**Difficulty:** ★★★ &nbsp;|&nbsp; **Points:** 250

## Briefing

Interacting with the operating system requires opening files on disk. Since file access can fail (e.g., file not found), code should be wrapped in exception handlers (`try-except` blocks) to prevent crashes.

## Mission

Create a Python script named `module4/python/files.py` that reads the contents of `module4/python/data.txt` and handles exceptions if the file is missing.

## Objectives

1. Create a script named `files.py` in the directory `module4/python/`
2. Open and read `data.txt` using the built-in `open()` function
3. Wrap your code inside a `try-except` block to catch `FileNotFoundError`

## Getting Started

Use python's context manager `with open(...)` to safely open the file:
```python
try:
    with open('/home/student/module4/python/data.txt', 'r') as f:
        print(f.read())
except FileNotFoundError:
    print("Error: data.txt could not be found.")
```

## Completion

Once your script is ready and runs, the progress service will detect file operations and exception handlers, and write the flag to `/home/student/module4/python/.keyfile`.
