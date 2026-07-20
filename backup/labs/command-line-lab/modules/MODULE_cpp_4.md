# C++ Module 4: STL Vectors & Streams

**Difficulty:** ★★★ &nbsp;|&nbsp; **Points:** 250

## Briefing

The C++ Standard Template Library (STL) provides predefined structures and algorithms. Common templates include dynamic arrays (`std::vector`) and file stream handlers (`std::fstream`).

## Mission

Create a C++ program named `module4/cpp/vectors.cpp` that utilizes vectors or streams.

## Objectives

1. Create a file named `vectors.cpp` in the directory `module4/cpp/`
2. Include the `<vector>` or `<fstream>` header at the top of the file
3. Compile and execute successfully

## Getting Started

Using vector templates:
```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {1, 2, 3};
    numbers.push_back(4);
    for (int n : numbers) {
        std::cout << n << " ";
    }
    std::cout << std::endl;
    return 0;
}
```

## Completion

Once compiled and run successfully, the flag will be written to `/home/student/module4/cpp/.keyfile`.
