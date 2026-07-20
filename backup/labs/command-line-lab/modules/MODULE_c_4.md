# C Module 4: Pointers & Memory

**Difficulty:** ★★★ &nbsp;|&nbsp; **Points:** 250

## Briefing

Pointers are variables that store the memory address of another variable. Managing pointers and dynamic memory allocation (`malloc`, `free`) is fundamental to writing stable C software.

## Mission

Create a C program named `module4/c/pointers.c` to practice pointer address dereferencing or call `malloc`.

## Objectives

1. Create a file named `pointers.c` in the directory `module4/c/`
2. De-reference a pointer variable (using `*`) or call `malloc` inside the source code
3. Compile and execute your program successfully

## Getting Started

Use pointers to modify variable values by reference:
```c
#include <stdio.h>

int main() {
    int val = 10;
    int *ptr = &val;
    *ptr = 20; // Dereferencing to modify val
    printf("Value is %d\n", val);
    return 0;
}
```

## Completion

Once your program compiled and executed successfully, the flag will be written to `/home/student/module4/c/.keyfile`.
