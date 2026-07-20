# C Module 3: Functions & Arrays

**Difficulty:** ★★ &nbsp;|&nbsp; **Points:** 200

## Briefing

Arrays are continuous memory blocks holding collections of elements of the same data type. Functions help modularize your code into callable blocks.

## Mission

Create a C program named `module3/c/arrays.c` that defines an array and processes its items inside a custom function.

## Objectives

1. Create a file named `arrays.c` in the directory `module3/c/`
2. Declare an array inside the code
3. Compile and execute your program successfully

## Getting Started

Use functions and pass arrays by reference:
```c
#include <stdio.h>

void print_array(int arr[], int size) {
    for (int i = 0; i < size; i++) {
        printf("%d ", arr[i]);
    }
    printf("\n");
}

int main() {
    int numbers[] = {10, 20, 30, 40, 50};
    print_array(numbers, 5);
    return 0;
}
```

## Completion

Once your program runs successfully, the flag will be written to `/home/student/module3/c/.keyfile`.
