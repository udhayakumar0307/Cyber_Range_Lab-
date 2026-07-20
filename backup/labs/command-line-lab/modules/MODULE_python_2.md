# Python Module 2: Control Flow

**Difficulty:** ★ &nbsp;|&nbsp; **Points:** 150

## Briefing

Control flow dictates the order in which statements are executed. Python uses `if-else` blocks for conditional logic and `for`/`while` loops to repeat blocks of code.

## Mission

Create a Python script named `module2/python/loops.py` that loops from 1 to 10 and prints whether each number is even or odd.

## Objectives

1. Create a script named `loops.py` in the directory `module2/python/`
2. Loop through numbers 1 to 10 and print them
3. Print whether each number is "even" or "odd"

## Getting Started

You can iterate through a sequence using a `for` loop combined with the `range()` function. To check if a number is even or odd, use the modulo operator `%`:
```python
for i in range(1, 11):
    if i % 2 == 0:
        print(f"{i} is even")
    else:
        print(f"{i} is odd")
```

## Completion

Once your code executes successfully, check your progress in the UI. Retrieve your flag from `/home/student/module2/python/.keyfile` and submit it.
