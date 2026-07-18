# C Module 1: C Basics

**Difficulty:** ★ &nbsp;|&nbsp; **Points:** 100

## Briefing

Welcome to the C track. C is a compiled, procedural programming language. It is the language of operating systems and low-level development. Unlike Python, C requires explicit variable type declarations and compilation before execution.

## Mission

Create a C program named `module1/c/main.c`, compile to `app`, and print user input read using `scanf`.

## Objectives

1. Create a file named `main.c` in the directory `module1/c/`
2. Compile your file using `gcc main.c -o app`
3. Execute the program and verify it reads an integer input via `scanf` and prints it via `printf`

## Getting Started

A basic C program template:
```c
#include <stdio.h>

int main() {
    int age;
    printf("Enter age: ");
    if (scanf("%d", &age) == 1) {
        printf("Age is %d\n", age);
    }
    return 0;
}
```

Compile it in your terminal:
```bash
gcc main.c -o app
./app
```

## Completion

Once your program compiles and runs successfully, check your progress. The flag will be written to `/home/student/module1/c/.keyfile`.
