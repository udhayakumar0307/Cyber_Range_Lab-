# Module 2: File Operations

**Difficulty:** ★ &nbsp;|&nbsp; **Points:** 150

## Briefing

The workstation you were handed in Module 1 is now officially yours — and
it's a mess. Your supervisor forwarded a folder called `inbox/` full of
half-organized files and asked you to clean it up before the next sprint
review.

## Mission

Create a backup location, copy the manifest into it, turn the draft into
a final file, and get rid of the junk.

## Objectives

1. Create `workspace/backup/` with `mkdir`
2. Copy `inbox/manifest.txt` into `workspace/backup/` with `cp`
3. Move `inbox/draft.txt` to `workspace/final.txt` with `mv`
4. Delete `workspace/junk.tmp` with `rm`

## Getting Started

Look at what you're working with first:

```bash
cd module2
ls inbox workspace
```

## Step 1 — Backup Folder

```bash
mkdir -p workspace/backup
```

> **Tip:** `-p` creates parent directories as needed and won't error if
> the folder already exists — a good habit even for a single-level path.

## Step 2 — Copy the Manifest

```bash
cp inbox/manifest.txt workspace/backup/
```

This keeps the original in `inbox/` untouched while placing a copy in
your new backup folder.

## Step 3 — Move the Draft

```bash
mv inbox/draft.txt workspace/final.txt
```

> **Note:** `mv` does double duty — it both renames and relocates a file
> in one step. There's no separate "rename" command in Linux.

## Step 4 — Clean Up

```bash
rm workspace/junk.tmp
```

> **Warning:** `rm` does not use a recycle bin. Once a file is removed
> this way, it's gone. Always double-check the path before running it.

## Finding the Key

Once your workspace matches the mission, look for a hidden vault folder:

```bash
ls -a
cat .vault/.key
```

## Evidence

| Field | What to record |
|---|---|
| Backup folder path | Full path to `workspace/backup` |
| Final file path | Full path to `workspace/final.txt` |
| Key value | Contents of `.vault/.key` |

## Completion

Submit the key in the Verify box to lock in your 150 points.
