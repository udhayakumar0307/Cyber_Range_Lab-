# Command Line Lab: Instructor Guide
## Linux Fundamentals — Solutions & Setup

---

## Setup Instructions

### Generating Student Seeds

```python
import secrets

students = ["alice", "bob", "charlie", "diana"]  # replace with real IDs

for s in students:
    seed = secrets.token_hex(8)
    print(f"Student: {s:15} | STUDENT_ID={s} LAB_SEED={seed}")
```

Distribute each student's `STUDENT_ID` and `LAB_SEED` privately.

### Running for Multiple Students

Each student runs their own isolated stack:

```bash
STUDENT_ID=alice LAB_SEED=abc123def456 docker-compose up --build -d
```

For a classroom, run one stack per student on separate ports, or give
each student their own VM/host.

---

## Architecture Notes

- Three containers per student: `student-env` (the Ubuntu box the
  browser terminal connects into), `vulnerable-services` (orchestration
  layer — plants challenge files, runs `terminal_service.py`,
  `progress_service.py`, and `hint_service.py`), and `scoring-server`
  (the Flask UI and flag validator).
- Keys are generated deterministically from `STUDENT_ID + LAB_SEED`
  using `sha256("cll_{module}_{student_id}_{lab_seed}")[:8]`. The same
  algorithm runs in `entrypoint.sh` (bash) and `scoring-server/app.py`
  (Python), so the scoring server never has to trust the target
  container's copy of a flag.
- **Objective checking is server-authoritative.** `progress_service.py`
  runs outside the student's container and independently verifies each
  objective — either by grepping a command log it reads via
  `docker exec`, or by running a real filesystem test (`test -f`,
  `stat`, etc.) inside the container. A student cannot fake progress by
  editing `command_checker.py` or the in-container helper scripts,
  because none of them make the actual pass/fail decision.
- The browser terminal (`terminal_service.py`) is a thin PTY bridge over
  a WebSocket — it runs `docker exec -it -u student <container> bash`
  under the hood, so the underlying access model is identical to a
  student running `docker exec` from their own shell.

---

## Module Solutions

### Module 1: Linux Navigation

```bash
pwd
ls -la
cd records/logs/archive
cat .keyfile
```

**What students should find:** a dotfile named `.keyfile` inside
`records/logs/archive/`, only visible with `ls -a`.

---

### Module 2: File Operations

```bash
cd module2
mkdir -p workspace/backup
cp inbox/manifest.txt workspace/backup/
mv inbox/draft.txt workspace/final.txt
rm workspace/junk.tmp
cat .vault/.key
```

**Common mistakes:** using `mv` instead of `cp` for the manifest (which
also deletes the original), or forgetting `-a` when listing to find the
hidden `.vault` folder.

---

### Module 3: Searching & Filtering

```bash
cd module3
find data -type f
grep -r "ACCESS_KEY" data
tail -n 5 data/2024-03/service.log
```

**What students should find:** the key is planted in
`data/2024-03/service.log` on a line reading `ACCESS_KEY: FLAG{...}`.

---

### Module 4: Permissions & Shell Scripting

```bash
cd module4
chmod +x scripts/run.sh
sudo chown student data/report.txt
./scripts/run.sh
```

**What students should find:** `run.sh` prints the key directly to
stdout once it has execute permission and completes successfully; it
also writes a `.done` marker used for grading.

**Common mistakes:** running the script before `chmod +x` (permission
denied), or forgetting `sudo` for the `chown` step.

---

### Module 5: Advanced Linux (Capstone)

```bash
cd module5
ps aux | grep sleep
cat .runaway_pid
kill <pid>
cat .final/key.txt | awk '{print $1}' > extracted_key.txt
cat extracted_key.txt
```

**Design note:** the "runaway process" is a harmless planted `sleep`
command students can safely `kill`. The key extraction step is
deliberately open-ended — `awk`, `sed`, or even `cut` all work, as long
as students demonstrate a pipe and a redirection.

---

## Grading Rubric

| Criteria | Points |
|----------|--------|
| Module 1 key captured | 100 |
| Module 2 key captured | 150 |
| Module 3 key captured | 200 |
| Module 4 key captured | 250 |
| Module 5 key captured | 300 |
| **Total possible** | **1,000** |

Hint usage deducts points on an escalating scale (10 / 20 / 35 per
module) — query `hint_service`'s `/hint-deductions/<student_id>` to see
a student's total deduction if you want to factor it into grading.

---

## Resetting a Student's Progress

```bash
curl -X POST http://localhost:5000/reset \
  -H "Content-Type: application/json" \
  -d '{"secret": "instructor_reset_2026", "student_id": "alice"}'
```

Change `RESET_SECRET` in `scoring-server/app.py` (or set it via the
environment) before deploying to a real classroom.

---

## Common Student Issues

| Problem | Solution |
|---------|----------|
| "Terminal won't connect" | Check `docker ps` — `vulnerable-services` must be healthy and port 8022 reachable |
| "Objectives never check off" | Confirm `student-env`'s `.bashrc` sourced `shell_profile` (re-run `docker-compose up --build`) |
| "chown fails" | Remind students `chown` needs `sudo` inside this container |
| "Progress resets" | Progress is derived live from filesystem/command-log state — if a student deletes their planted files, objectives will show incomplete again |

---

## Next Steps

After Command Line Lab, students have practiced navigation, file
management, searching, permissions, scripting, and process control —
the exact toolkit the Network Reconnaissance lab assumes going in.
