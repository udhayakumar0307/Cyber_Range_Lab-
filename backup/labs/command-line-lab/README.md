# Command Line Lab
## Linux Fundamentals Track — Cyber Range

---

## Your Mission

You're new to the Cyber Range team, starting with the basics: getting
comfortable on a real Linux terminal. Across five modules you'll
navigate the filesystem, manage files, search through logs, fix broken
permissions, and finish with a capstone that pulls everything together.

Unlike a typical lab, you don't need to `docker exec` into anything
yourself — your terminal runs live in the browser, right on the module
page.

---

## Getting Started

### 1. Launch the lab

```bash
export STUDENT_ID=yourname
export LAB_SEED=lab1semester1   # instructor will give you this

docker-compose up --build -d
```

### 2. Open the lab in your browser

**http://localhost:5000**

Click a module card, then hit **Start Terminal** — a live Ubuntu shell
will appear right on the page.

### 3. Work through the objectives

Each module lists its objectives on the left. They check themselves off
automatically as you complete the real actions in your terminal — no
need to report progress by hand.

---

## The 5 Modules

| Module | Challenge | Difficulty | Points |
|--------|-----------|------------|--------|
| 1 | Linux Navigation | ⭐ | 100 |
| 2 | File Operations | ⭐ | 150 |
| 3 | Searching & Filtering | ⭐⭐ | 200 |
| 4 | Permissions & Shell Scripting | ⭐⭐⭐ | 250 |
| 5 | Advanced Linux (Capstone) | ⭐⭐⭐ | 300 |

Read each module's full brief from the "Read the full module brief"
link on its detail page, or directly:

```bash
cat modules/MODULE_1.md
```

---

## Submitting Keys

Keys look like: `FLAG{cll_module1_yourname_a7f3e2c1}`

**Web UI (recommended):** Paste the key into the Verify box on the
module page.

**Terminal:**

```bash
submitflag module1 "FLAG{...}"
```

**Check your progress from the terminal:**

```bash
progress
```

**Need help:**

```bash
hint
```

---

## Helper Commands Inside Your Terminal

| Command | Purpose |
|---------|---------|
| `progress` | Show your objective checklist for the current module |
| `hint` | Request the next hint (costs points, escalating) |
| `submitflag <module> <key>` | Submit a key from the terminal |

---

## Resetting the Lab

```bash
docker-compose down -v
STUDENT_ID=yourname docker-compose up --build -d
```

---

## Questions?

Ask your instructor, or post in the class discussion board.

Good luck. 🔐
