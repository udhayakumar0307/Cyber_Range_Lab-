# Python Module 5: OS & Subprocess Automation

**Difficulty:** ★★★ &nbsp;|&nbsp; **Points:** 300

## Briefing

System scripts automate administrative tasks by interacting directly with the OS and launching external processes. Python implements this functionality via the `os` and `subprocess` modules.

## Mission

Create a Python script named `module5/python/script.py` that imports `os` or `subprocess` and executes a basic shell command (like `ls` or `whoami`).

## Objectives

1. Create a script named `script.py` in the directory `module5/python/`
2. Import `os` or `subprocess` module at the top of your script
3. Call a system execution method (e.g. `subprocess.run` or `os.system`)

## Getting Started

Using `subprocess` (recommended over `os.system` for modern Python):
```python
import subprocess

# Run list directory command
subprocess.run(["ls", "-la"])
```

## Completion

Once your script executes system commands successfully, the flag will be written to `/home/student/module5/python/.keyfile`.
