# C++ Module 2: Control Flow & Functions

**Difficulty:** ★ &nbsp;|&nbsp; **Points:** 150

## Briefing

C++ supports procedural programming models via user-defined functions. You can declare function prototypes to segment logical blocks.

## Mission

Create a C++ program named `module2/cpp/loops.cpp` that defines a custom function.

## Objectives

1. Create a file named `loops.cpp` in the directory `module2/cpp/`
2. Define a custom helper function (excluding `main()`)
3. Compile and execute your program successfully

## Getting Started

Use functions to structure your logic:
```cpp
#include <iostream>

void greetUser() {
    std::cout << "Greetings from custom function!" << std::endl;
}

int main() {
    greetUser();
    return 0;
}
```

Compile and run:
```bash
g++ loops.cpp -o app
./app
```

## Completion

Once your program runs successfully, the flag will be written to `/home/student/module2/cpp/.keyfile`.
