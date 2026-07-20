# Module 4: Permissions & Shell Scripting

**Difficulty:** ★★★ &nbsp;|&nbsp; **Points:** 250

## Briefing

A deployment script has been sitting broken in `module4/scripts/` for
weeks. Nobody fixed its permissions, a report file has the wrong owner,
and the whole thing has quietly been ignored. Time to fix it properly.

## Mission

Make the script executable, correct the file ownership, and run the
script so it can do its job.

## Objectives

1. Make `scripts/run.sh` executable with `chmod`
2. Use `sudo` at least once
3. Change the owner of `data/report.txt` with `chown`
4. Execute `run.sh` so it unlocks the key

## Getting Started

```bash
cd module4
ls -l scripts data
```

Notice that `run.sh` doesn't have execute permission (`-rw-r--r--`), and
`report.txt` is currently owned by `root`.

## Fixing Permissions

```bash
chmod +x scripts/run.sh
```

> **Note:** `chmod +x` adds execute permission for every permission
> class (owner, group, others) without touching read/write bits. Use
> `ls -l` before and after to see exactly what changed.

## Fixing Ownership

Ownership changes need elevated privileges:

```bash
sudo chown student data/report.txt
```

> **Warning:** `sudo` runs a command as another user — usually root. It
> is powerful and unforgiving: there's no confirmation prompt before a
> destructive command runs. On this workstation `sudo` won't prompt you
> for a password — that's intentional for this lab, not something to
> rely on outside of it.

## Running the Script

```bash
./scripts/run.sh
```

> **Tip:** If you get a "Permission denied" error here, double check
> that the `chmod +x` step actually completed — `ls -l scripts/run.sh`
> should show an `x` in the permission bits.

The script writes a marker file when it finishes:

```bash
cat .done
```

Wait — `.done` only confirms the script ran. The actual key is printed
to your terminal the moment the script completes, so watch its output
carefully.

## Evidence

| Field | What to record |
|---|---|
| Permissions before/after | `ls -l scripts/run.sh` output, before and after `chmod` |
| New owner of report.txt | Output of `stat -c %U data/report.txt` |
| Key value | Printed by `run.sh` on completion |

## Completion

Submit the key in the Verify box for 250 points.
