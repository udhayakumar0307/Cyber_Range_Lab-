# Module 5: Advanced Linux (Capstone)

**Difficulty:** ★★★ &nbsp;|&nbsp; **Points:** 300

## Briefing

Final challenge. A background process has been quietly running on your
workstation since it booted, and nobody knows why. Before you can dig
into the last key, you need to identify what it is and shut it down —
then combine everything you've learned about pipes, redirection, and
text processing to pull the key out of what's left behind.

## Mission

Find the runaway process, kill it, then use pipes and redirection to
extract the final key.

## Objectives

1. Use `ps` or `top` to inspect running processes
2. Use `kill` to stop the runaway process
3. Chain commands together with a pipe (`|`)
4. Use `awk` or `sed` together with output redirection

## Finding the Process

```bash
ps aux | grep sleep
```

> **Tip:** Piping `ps aux` into `grep` is one of the most common
> combinations in daily Linux use — it filters a long process list down
> to just what you're looking for.

## Stopping It

```bash
cat module5/.runaway_pid
kill <pid>
```

> **Warning:** `kill` sends a termination signal — by default `SIGTERM`,
> which asks the process to shut down gracefully. `kill -9` forces it
> immediately and should be a last resort.

## Extracting the Key

The key file sits inside `module5/.final/`. Practice chaining tools
together instead of just `cat`-ing it directly:

```bash
cd module5
cat .final/key.txt | awk '{print $1}' > extracted_key.txt
cat extracted_key.txt
```

> **Note:** `awk '{print $1}'` prints the first whitespace-separated
> field of each line — useful for pulling one token out of a larger
> line of text. Redirecting with `>` writes the result to a new file
> instead of just printing it to your screen.

You can also try `sed` for pattern-based extraction:

```bash
sed -n '1p' .final/key.txt > extracted_key.txt
```

## Evidence

| Field | What to record |
|---|---|
| PID of the runaway process | From `ps aux` output |
| Command used to extract the key | Your full pipe/redirect command |
| Key value | Contents of `extracted_key.txt` |

## Completion

Submit the key in the Verify box for 300 points — and congratulations,
that's the whole Command Line Lab track complete.
