# C++ Module 3: Classes & Objects

**Difficulty:** ★★ &nbsp;|&nbsp; **Points:** 200

## Briefing

C++ is famous for its Object-Oriented Programming (OOP) properties. Classes wrap attributes (variables) and behaviors (methods) together under access specifiers (`public`, `private`, `protected`).

## Mission

Create a C++ program named `module3/cpp/classes.cpp` defining a custom class.

## Objectives

1. Create a file named `classes.cpp` in the directory `module3/cpp/`
2. Define a class inside the source file
3. Instantiate and utilize your class, compiling and executing successfully

## Getting Started

A basic C++ class:
```cpp
#include <iostream>
#include <string>

class Student {
public:
    std::string name;
    void printName() {
        std::cout << "Student: " << name << std::endl;
    }
};

int main() {
    Student s;
    s.name = "Alice";
    s.printName();
    return 0;
}
```

## Completion

Once compiled and run successfully, the flag will be written to `/home/student/module3/cpp/.keyfile`.
