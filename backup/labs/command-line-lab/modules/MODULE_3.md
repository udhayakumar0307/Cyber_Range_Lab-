# Module 3: Searching & Filtering

**Difficulty:** ★★ &nbsp;|&nbsp; **Points:** 200

## Briefing

Somewhere in a pile of rotated service logs, a teammate jotted down an
access key and never told anyone which file it's in. There are dozens
of log files spread across dated folders. Opening each one by hand isn't
an option — you need to search.

## Mission

Use `find`, `grep`, and `head`/`tail` to track the key down inside
`module3/data/`.

## Objectives

1. Use `find` to search the data directory
2. Use `grep` to filter file contents for a pattern
3. Use `head` or `tail` to inspect a specific file
4. Locate the line containing `ACCESS_KEY`

## Getting Started

First, see what you're dealing with:

```bash
cd module3
find data -type f
```

> **Tip:** `find <dir> -type f` lists every regular file underneath a
> directory, no matter how deeply nested — unlike `ls`, which only shows
> one level at a time.

## Searching File Contents

Rather than opening every log manually, search across all of them at
once:

```bash
grep -r "ACCESS_KEY" data
```

> **Note:** The `-r` flag makes `grep` recursive, so it will search every
> file inside `data/` and its subfolders in a single command.

## Narrowing In

Once `grep` shows you which file the match is in, inspect just that
file:

```bash
tail -n 5 data/2024-03/service.log
```

> **Warning:** Log files can be long. `head` and `tail` let you preview
> the start or end of a file without printing the whole thing to your
> terminal.

## Evidence

| Field | What to record |
|---|---|
| File containing the key | Full path of the matching log file |
| Key value | Everything after `ACCESS_KEY:` on that line |

## Completion

Submit the key value (starting with `FLAG{`) in the Verify box.
