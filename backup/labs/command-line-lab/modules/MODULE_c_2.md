# C Module 2: Control Flow

**Difficulty:** ★ &nbsp;|&nbsp; **Points:** 150

## Briefing

C uses conditional statements (`if`, `else if`, `else`) to branch logic, and loop constructs (`for`, `while`, `do-while`) to iterate blocks of code.

## Mission

Create a C program named `module2/c/loops.c` that compiles to `app` and prints loop output to verify logical flow.

## Objectives

1. Create a file named `loops.c` in the directory `module2/c/`
2. Compile loops.c to `app` using gcc
3. Verify loop output when executing the program

## Getting Started

Use standard C iteration:
```c
#include <stdio.h>

int main() {
    for (int i = 1; i <= 5; i++) {
        printf("Loop count: %d\n", i);
    }
    return 0;
}
```

Compile and run:
```bash
gcc loops.c -o app
./app
```

## Completion

Once your program runs successfully and print outputs, the flag will be written to `/home/student/module2/c/.keyfile`.
