# Module 1: Linux Navigation

**Difficulty:** ★ &nbsp;|&nbsp; **Points:** 100

## Briefing

It's your first day on the Cyber Range team. IT handed you a workstation,
a login, and nothing else — no map, no walkthrough. Before they'll trust
you with anything sensitive, they want proof you can move around a Linux
filesystem without getting lost.

Somewhere inside your own home directory is an onboarding key. Find it.

## Mission

Locate the hidden key file inside `records/logs/archive/` and read its
contents.

## Objectives

1. Print your current working directory with `pwd`
2. List the contents of a directory with `ls`
3. Navigate into `records/logs/archive` with `cd`
4. Read the key file with `cat`

## Getting Started

Start your terminal from the module card, then orient yourself:

```bash
pwd
ls -la
```

> **Tip:** `ls -la` shows hidden files too — anything starting with a dot
> won't appear with a plain `ls`.

Once you see the `records` directory, move into it and keep exploring:

```bash
cd records
ls
cd logs/archive
ls -la
```

> **Note:** You can chain directories in a single `cd` call — you don't
> need to `cd` into each folder one at a time.

## Finding the Key

The archive folder contains a dotfile. Read it:

```bash
cat .keyfile
```

> **Warning:** The key format is `FLAG{...}`. Copy the whole thing,
> including the braces, into the Verify box.

## Evidence

| Field | What to record |
|---|---|
| Path to key | Full path where `.keyfile` was found |
| Key value | Contents of `.keyfile` |

## Completion

Paste the key into the Verify box on the module page. You'll see a
confirmation popup and your points will update immediately.
