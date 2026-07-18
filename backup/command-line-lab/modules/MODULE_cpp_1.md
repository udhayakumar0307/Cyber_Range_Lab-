# C++ Module 1: C++ Basics

**Difficulty:** ★ &nbsp;|&nbsp; **Points:** 100

## Briefing

Welcome to the C++ track. C++ is a multi-paradigm programming language that supports object-oriented, generic, and functional programming models. C++ utilizes stream libraries (`iostream`) to process console I/O instead of standard C methods.

## Mission

Create a C++ program named `module1/cpp/main.cpp`, compile it to `app` using g++, and print user input read using `std::cin`.

## Objectives

1. Create a file named `main.cpp` in the directory `module1/cpp/`
2. Compile main.cpp using g++: `g++ main.cpp -o app`
3. Execute the program and verify it reads input via `std::cin` and prints it via `std::cout`

## Getting Started

A basic C++ template:
```cpp
#include <iostream>
#include <string>

int main() {
    std::string name;
    std::cout << "Enter name: ";
    if (std::cin >> name) {
        std::cout << "Hello, " << name << "!" << std::endl;
    }
    return 0;
}
```

Compile and run:
```bash
g++ main.cpp -o app
./app
```

## Completion

Once your program compiles and runs successfully, check your progress. The flag will be written to `/home/student/module1/cpp/.keyfile`.
