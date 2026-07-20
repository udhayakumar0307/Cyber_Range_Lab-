import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Clock,
  Terminal as TerminalIcon,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Code2,
  Cpu,
  BookOpen,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Module {
  id: string;
  title: string;
  points: number;
  isSolved: boolean;
  description: string;
  mission: string;
  objectives: string[];
  hints: string[];
  correctFlag: string;
  terminalBanner: string;
  prompt: string;
  commandHandlers: Record<string, (tokens: string[], isRoot: boolean) => string[]>;
}

interface Track {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  modules: Module[];
}

// ─── Track Data ────────────────────────────────────────────────────────────────
const TRACKS: Track[] = [
  {
    id: 'linux',
    label: 'Linux Fundamentals',
    subtitle: 'LINUX INFRASTRUCTURE',
    icon: <TerminalIcon className="w-5 h-5" />,
    color: 'emerald',
    modules: [
      {
        id: 'lx-1',
        title: 'Module 1: File System Navigation',
        points: 100,
        isSolved: false,
        description: 'Master the Linux directory tree and learn to traverse the file system using core navigation commands.',
        mission: 'Navigate to the /var/challenge directory and read the hidden flag file.',
        objectives: [
          'Use `pwd` to confirm your working directory.',
          'Navigate using `cd /var/challenge` to reach the target.',
          'Run `ls -la` to list all files including hidden ones.',
          'Read the flag with `cat .hidden_flag`.',
        ],
        hints: [
          'Hidden files on Linux start with a dot (.); use `ls -la` to reveal them.',
          'The flag is inside: `cat /var/challenge/.hidden_flag` → flag{fs_navigator}',
        ],
        correctFlag: 'flag{fs_navigator}',
        terminalBanner: 'CyberRange Linux Sandbox v2.04 — File System Navigator\nType "help" to see commands.\noperator@linux-lab:~$ ',
        prompt: 'operator@linux-lab',
        commandHandlers: {
          pwd: () => ['/home/operator'],
          ls: (tokens) => {
            const path = tokens[1] ?? '';
            if (path === '-la' || path === '-la') return ['total 32', 'drwxr-xr-x 4 operator operator 4096 Jan 1 00:00 .', 'drwxr-xr-x 18 root root 4096 Jan 1 00:00 ..', '-rw-r--r-- 1 operator operator 45 Jan 1 00:00 README.txt'];
            return ['README.txt'];
          },
          cat: (tokens) => {
            if (tokens[1] === 'README.txt') return ['Welcome to the Linux File System Lab.', 'Explore /var/challenge to find the flag.'];
            if (tokens[1] === '.hidden_flag') return ['flag{fs_navigator}'];
            return [`cat: ${tokens[1] ?? ''}: No such file or directory`];
          },
        },
      },
      {
        id: 'lx-2',
        title: 'Module 2: Process Management',
        points: 150,
        isSolved: false,
        description: 'Learn to inspect running processes, manage services, and identify suspicious background processes.',
        mission: 'Identify the PID of a suspicious process named "spy_daemon" and terminate it.',
        objectives: [
          'Run `ps aux` to list all running processes.',
          'Locate the process named `spy_daemon`.',
          'Terminate it using `kill <PID>`.',
          'Verify termination and retrieve the flag.',
        ],
        hints: [
          'Use `ps aux | grep spy_daemon` to narrow the search.',
          'After killing PID 4242: flag{process_terminated}',
        ],
        correctFlag: 'flag{process_terminated}',
        terminalBanner: 'CyberRange Linux Sandbox v2.04 — Process Manager\nType "help" to see commands.\noperator@linux-lab:~$ ',
        prompt: 'operator@linux-lab',
        commandHandlers: {
          'ps': () => [
            'USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND',
            'operator  1001  0.0  0.1  10000  2048 pts/0    S    00:00   0:00 bash',
            'root      4242  0.0  0.2  20000  4096 ?        Ss   00:01   0:01 spy_daemon',
            'operator  1003  0.0  0.1   8000  1024 pts/0    R+   00:00   0:00 ps',
          ],
          'kill': (tokens) => {
            if (tokens[1] === '4242') return ['Process 4242 (spy_daemon) terminated.', 'Mission complete. Retrieve flag from /var/flags/module2.txt'];
            return [`kill: (${tokens[1]}): No such process`];
          },
          cat: (tokens) => {
            if (tokens[1] === '/var/flags/module2.txt') return ['flag{process_terminated}'];
            return [`cat: ${tokens[1] ?? ''}: No such file or directory`];
          },
        },
      },
      {
        id: 'lx-3',
        title: 'Module 3: File Permissions & Ownership',
        points: 200,
        isSolved: false,
        description: 'Understand Linux permission bits, ownership, and learn to identify SUID misconfigurations.',
        mission: 'Locate a SUID binary and use it to read a root-owned flag file.',
        objectives: [
          'Find SUID binaries using `find / -perm -4000 2>/dev/null`.',
          'Inspect the binary at `/usr/local/bin/read_flag`.',
          'Execute it to retrieve the privileged flag.',
        ],
        hints: [
          'The SUID binary `/usr/local/bin/read_flag` has the setuid bit set.',
          'Running it prints: flag{suid_exploited}',
        ],
        correctFlag: 'flag{suid_exploited}',
        terminalBanner: 'CyberRange Linux Sandbox v2.04 — Permissions Lab\nType "help" to see commands.\noperator@linux-lab:~$ ',
        prompt: 'operator@linux-lab',
        commandHandlers: {
          find: () => [
            '/usr/bin/sudo',
            '/usr/local/bin/read_flag',
            '/usr/bin/passwd',
          ],
          '/usr/local/bin/read_flag': () => ['Reading privileged flag...', 'flag{suid_exploited}'],
          ls: () => ['README.txt'],
        },
      },
      {
        id: 'lx-4',
        title: 'Module 4: Networking Utilities',
        points: 250,
        isSolved: false,
        description: 'Examine network interfaces, active connections, and firewall rules using standard Linux network tools.',
        mission: 'Find the hidden service listening on a non-standard port and extract its flag.',
        objectives: [
          'Use `netstat -tlnp` or `ss -tlnp` to list listening services.',
          'Identify the hidden service on port 9999.',
          'Connect using `nc localhost 9999` to retrieve the flag.',
        ],
        hints: [
          'The service listens on TCP port 9999.',
          'Connecting returns: flag{network_discovered}',
        ],
        correctFlag: 'flag{network_discovered}',
        terminalBanner: 'CyberRange Linux Sandbox v2.04 — Network Utils\nType "help" to see commands.\noperator@linux-lab:~$ ',
        prompt: 'operator@linux-lab',
        commandHandlers: {
          netstat: () => [
            'Proto Recv-Q Send-Q Local Address   Foreign Address  State',
            'tcp        0      0 0.0.0.0:22      0.0.0.0:*        LISTEN',
            'tcp        0      0 0.0.0.0:80      0.0.0.0:*        LISTEN',
            'tcp        0      0 127.0.0.1:9999  0.0.0.0:*        LISTEN',
          ],
          ss: () => [
            'Netid  State   Recv-Q  Send-Q  Local Address:Port',
            'tcp    LISTEN  0       128     0.0.0.0:22',
            'tcp    LISTEN  0       128     127.0.0.1:9999',
          ],
          nc: (tokens) => {
            if (tokens.includes('9999')) return ['Connected to hidden service.', 'CyberRange Hidden Service: flag{network_discovered}'];
            return [`nc: ${tokens[1] ?? ''}: Connection refused`];
          },
        },
      },
      {
        id: 'lx-5',
        title: 'Module 5: Capstone — System Compromise',
        points: 300,
        isSolved: false,
        description: 'Combine all skills to escalate privileges and capture the root flag in a realistic attack scenario.',
        mission: 'Escalate to root and read /root/master_flag.txt.',
        objectives: [
          'Audit sudo permissions with `sudo -l`.',
          'Exploit the allowed binary to gain a root shell.',
          'Read the master flag at `/root/master_flag.txt`.',
        ],
        hints: [
          'Use `sudo /usr/bin/env bash` to spawn a root shell.',
          'The root flag is at /root/master_flag.txt: flag{linux_master}',
        ],
        correctFlag: 'flag{linux_master}',
        terminalBanner: 'CyberRange Linux Sandbox v2.04 — Capstone\nType "help" to see commands.\noperator@linux-lab:~$ ',
        prompt: 'operator@linux-lab',
        commandHandlers: {
          'sudo': (tokens, isRoot) => {
            if (tokens[1] === '-l') return ['User operator may run as root: /usr/bin/env'];
            if (tokens.join(' ').includes('/usr/bin/env bash')) return ['root@linux-lab:~# (root shell spawned)'];
            return ['sudo: authentication required'];
          },
          cat: (tokens, isRoot) => {
            if (tokens[1] === '/root/master_flag.txt') {
              if (isRoot) return ['flag{linux_master}'];
              return ['cat: /root/master_flag.txt: Permission denied'];
            }
            return [`cat: ${tokens[1] ?? ''}: No such file or directory`];
          },
        },
      },
    ],
  },
  {
    id: 'python',
    label: 'Python Programming',
    subtitle: 'PYTHON SCRIPTING',
    icon: <Code2 className="w-5 h-5" />,
    color: 'blue',
    modules: [
      {
        id: 'py-1',
        title: 'Module 1: Python Basics & Variables',
        points: 100,
        isSolved: false,
        description: 'Learn Python variable types, input/output, and basic arithmetic operations.',
        mission: 'Write and run a Python script that calculates the flag from a math expression.',
        objectives: [
          'Open the Python 3 REPL using `python3`.',
          'Execute: `print(1337 + 42)` to get the numeric key.',
          'Combine with prefix: `flag{py_` + result.',
        ],
        hints: ['The math result is 1379.', 'Flag: flag{py_1379}'],
        correctFlag: 'flag{py_1379}',
        terminalBanner: 'CyberRange Python Sandbox v3.11\nType "help" to see commands.\ndev@python-lab:~$ ',
        prompt: 'dev@python-lab',
        commandHandlers: {
          python3: (tokens) => {
            if (tokens[1] === '-c' && tokens[2]?.includes('1337')) return ['1379'];
            return ['Python 3.11.0 (main)', 'Type "help" for more info.', '>>> '];
          },
          print: () => ['flag{py_1379}'],
        },
      },
      {
        id: 'py-2',
        title: 'Module 2: File I/O & String Ops',
        points: 150,
        isSolved: false,
        description: 'Practice reading files, parsing strings, and extracting data using Python.',
        mission: 'Read /data/secret.txt and decode the base64-encoded flag.',
        objectives: [
          'Run `cat /data/secret.txt` to view encoded content.',
          'Decode using: `python3 -c "import base64; print(base64.b64decode(\'ZmxhZ3tweV9maWxlaW99\').decode())"` ',
          'Submit the decoded flag.',
        ],
        hints: ['The encoded string decodes to: flag{py_fileio}'],
        correctFlag: 'flag{py_fileio}',
        terminalBanner: 'CyberRange Python Sandbox v3.11 — File I/O\ndev@python-lab:~$ ',
        prompt: 'dev@python-lab',
        commandHandlers: {
          cat: (tokens) => {
            if (tokens[1] === '/data/secret.txt') return ['ZmxhZ3tweV9maWxlaW99'];
            return [`cat: ${tokens[1] ?? ''}: No such file`];
          },
          python3: () => ['flag{py_fileio}'],
        },
      },
      {
        id: 'py-3',
        title: 'Module 3: Functions & Recursion',
        points: 200,
        isSolved: false,
        description: 'Understand Python function definitions, return values, and recursive algorithms.',
        mission: 'Compute the 10th Fibonacci number using a recursive Python function.',
        objectives: [
          'Write a recursive `fib(n)` function.',
          'Call `fib(10)` — the result is the key.',
          'Submit: flag{fib_55}',
        ],
        hints: ['fib(10) = 55', 'Flag: flag{fib_55}'],
        correctFlag: 'flag{fib_55}',
        terminalBanner: 'CyberRange Python Sandbox v3.11 — Functions\ndev@python-lab:~$ ',
        prompt: 'dev@python-lab',
        commandHandlers: {
          python3: () => ['55'],
          fib: () => ['55'],
        },
      },
      {
        id: 'py-4',
        title: 'Module 4: Network Scripting',
        points: 250,
        isSolved: false,
        description: 'Use Python sockets and requests to interact with network services and APIs.',
        mission: 'Send an HTTP GET request to the local lab API and extract the flag from the JSON response.',
        objectives: [
          'Run: `python3 -c "import requests; r=requests.get(\'http://localhost:8080/flag\'); print(r.json()[\'flag\'])"` ',
          'Extract the flag from the JSON response.',
        ],
        hints: ['The API endpoint returns: {"flag": "flag{py_network}"}', 'Flag: flag{py_network}'],
        correctFlag: 'flag{py_network}',
        terminalBanner: 'CyberRange Python Sandbox v3.11 — Networking\ndev@python-lab:~$ ',
        prompt: 'dev@python-lab',
        commandHandlers: {
          python3: () => ['{"flag": "flag{py_network}"}', 'flag{py_network}'],
          curl: () => ['{"flag": "flag{py_network}"}'],
        },
      },
      {
        id: 'py-5',
        title: 'Module 5: Capstone — Exploit Script',
        points: 300,
        isSolved: false,
        description: 'Write a Python exploit script to automate an attack chain and retrieve the final flag.',
        mission: 'Automate the full recon → exploitation → flag extraction pipeline in Python.',
        objectives: [
          'Run the provided exploit template: `python3 /opt/exploit.py`.',
          'The script will enumerate ports, identify the vulnerability, and print the flag.',
        ],
        hints: ['The exploit script outputs: flag{py_exploit_master}'],
        correctFlag: 'flag{py_exploit_master}',
        terminalBanner: 'CyberRange Python Sandbox v3.11 — Capstone\ndev@python-lab:~$ ',
        prompt: 'dev@python-lab',
        commandHandlers: {
          python3: (tokens) => {
            if (tokens[1]?.includes('exploit')) return ['[*] Starting exploit chain...', '[+] Port 9090 vulnerable.', '[+] Payload injected.', '[+] FLAG: flag{py_exploit_master}'];
            return ['Python 3.11.0'];
          },
        },
      },
    ],
  },
  {
    id: 'c',
    label: 'C Programming',
    subtitle: 'C SYSTEMS PROGRAMMING',
    icon: <Cpu className="w-5 h-5" />,
    color: 'amber',
    modules: [
      {
        id: 'c-1',
        title: 'Module 1: Hello World & Compilation',
        points: 100,
        isSolved: false,
        description: 'Write, compile, and execute your first C program to understand the compilation pipeline.',
        mission: 'Compile and run a C program that outputs the secret flag string.',
        objectives: [
          'View the source file with `cat /opt/hello.c`.',
          'Compile with `gcc /opt/hello.c -o /tmp/hello`.',
          'Run `/tmp/hello` to print the flag.',
        ],
        hints: ['After compiling and running, output is: flag{c_compiled}'],
        correctFlag: 'flag{c_compiled}',
        terminalBanner: 'CyberRange C Programming Lab v1.0\ndev@c-lab:~$ ',
        prompt: 'dev@c-lab',
        commandHandlers: {
          cat: (tokens) => {
            if (tokens[1] === '/opt/hello.c') return ['#include <stdio.h>', 'int main() {', '  printf("flag{c_compiled}\\n");', '  return 0;', '}'];
            return [`cat: ${tokens[1] ?? ''}: No such file`];
          },
          gcc: () => ['Compilation successful → /tmp/hello'],
          '/tmp/hello': () => ['flag{c_compiled}'],
        },
      },
      {
        id: 'c-2',
        title: 'Module 2: Pointers & Memory',
        points: 150,
        isSolved: false,
        description: 'Explore pointer arithmetic, memory addresses, and direct memory access in C.',
        mission: 'Run the pointer demo program to reveal the memory-encoded flag.',
        objectives: [
          'Compile `/opt/pointer_demo.c` with gcc.',
          'Execute the binary to print dereferenced pointer value.',
          'Submit the printed flag.',
        ],
        hints: ['The pointer demo dereferences a char array and prints: flag{c_pointers}'],
        correctFlag: 'flag{c_pointers}',
        terminalBanner: 'CyberRange C Lab — Pointers & Memory\ndev@c-lab:~$ ',
        prompt: 'dev@c-lab',
        commandHandlers: {
          gcc: () => ['OK: /tmp/ptr'],
          '/tmp/ptr': () => ['Pointer value at 0x7fff: flag{c_pointers}'],
          cat: (tokens) => [`cat: ${tokens[1] ?? ''}: not found`],
        },
      },
      {
        id: 'c-3',
        title: 'Module 3: Buffer Overflow Basics',
        points: 200,
        isSolved: false,
        description: 'Understand stack layout and exploit a classic stack buffer overflow to hijack program flow.',
        mission: 'Overflow the buffer in /opt/vuln to overwrite the return address and spawn a shell.',
        objectives: [
          'Inspect the vulnerable program with `cat /opt/vuln.c`.',
          'Generate a cyclic pattern: `python3 -c "print(\'A\'*64 + \'\\x41\\x41\\x41\\x41\')"` ',
          'Pipe the payload to the binary to trigger overflow.',
        ],
        hints: ['Overflow with 64 bytes + 4-byte overwrite triggers: flag{c_bof}'],
        correctFlag: 'flag{c_bof}',
        terminalBanner: 'CyberRange C Lab — Buffer Overflow\ndev@c-lab:~$ ',
        prompt: 'dev@c-lab',
        commandHandlers: {
          cat: (tokens) => {
            if (tokens[1] === '/opt/vuln.c') return ['void vuln() { char buf[64]; gets(buf); }', 'int win() { system("cat /flag"); }'];
            return [`cat: ${tokens[1] ?? ''}: not found`];
          },
          '/opt/vuln': () => ['Segmentation fault (core dumped)', 'WIN! flag{c_bof}'],
        },
      },
      {
        id: 'c-4',
        title: 'Module 4: File I/O in C',
        points: 250,
        isSolved: false,
        description: 'Use C standard library functions to open, read, and write files securely.',
        mission: 'Compile and run the file reader program to extract the hidden flag from /secret/data.bin.',
        objectives: [
          'Compile `/opt/reader.c` with `gcc /opt/reader.c -o /tmp/reader`.',
          'Execute `/tmp/reader /secret/data.bin`.',
          'The program reads and prints the flag bytes.',
        ],
        hints: ['Running the reader prints: flag{c_fileio}'],
        correctFlag: 'flag{c_fileio}',
        terminalBanner: 'CyberRange C Lab — File I/O\ndev@c-lab:~$ ',
        prompt: 'dev@c-lab',
        commandHandlers: {
          gcc: () => ['OK: /tmp/reader'],
          '/tmp/reader': () => ['Reading /secret/data.bin...', 'flag{c_fileio}'],
        },
      },
      {
        id: 'c-5',
        title: 'Module 5: Capstone — System Exploit',
        points: 300,
        isSolved: false,
        description: 'Chain vulnerabilities: buffer overflow → ret2libc → shell → flag exfiltration.',
        mission: 'Craft a full ret2libc payload chain to gain root shell and read /root/flag.txt.',
        objectives: [
          'Use ROPgadget to locate gadgets in the binary.',
          'Craft payload targeting libc system() with /bin/sh argument.',
          'Execute and capture /root/flag.txt.',
        ],
        hints: ['Successful ret2libc chain outputs: flag{c_system_pwned}'],
        correctFlag: 'flag{c_system_pwned}',
        terminalBanner: 'CyberRange C Lab — Capstone\ndev@c-lab:~$ ',
        prompt: 'dev@c-lab',
        commandHandlers: {
          ROPgadget: () => ['0x0804848b: pop eax; ret', '0x0804848c: pop ebx; ret', 'Gadget chain ready.'],
          python3: () => ['[*] Crafting payload...', '[+] Shell spawned!', 'flag{c_system_pwned}'],
          cat: (tokens, isRoot) => {
            if (isRoot && tokens[1] === '/root/flag.txt') return ['flag{c_system_pwned}'];
            return ['Permission denied'];
          },
        },
      },
    ],
  },
  {
    id: 'cpp',
    label: 'C++ OOP & STL',
    subtitle: 'C++ ADVANCED PROGRAMMING',
    icon: <BookOpen className="w-5 h-5" />,
    color: 'purple',
    modules: [
      {
        id: 'cpp-1',
        title: 'Module 1: Classes & Objects',
        points: 100,
        isSolved: false,
        description: 'Understand OOP fundamentals: classes, constructors, and method encapsulation in C++.',
        mission: 'Compile and run the OOP demo that encodes the flag inside a class method.',
        objectives: [
          'Inspect `/opt/oop_demo.cpp` with cat.',
          'Compile with `g++ /opt/oop_demo.cpp -o /tmp/oop`.',
          'Run `/tmp/oop` to call the flag() method.',
        ],
        hints: ['The flag() method returns: flag{cpp_classes}'],
        correctFlag: 'flag{cpp_classes}',
        terminalBanner: 'CyberRange C++ Lab v1.0 — OOP\ndev@cpp-lab:~$ ',
        prompt: 'dev@cpp-lab',
        commandHandlers: {
          cat: (tokens) => {
            if (tokens[1]?.includes('oop_demo')) return ['class Lab {', '  string flag() { return "flag{cpp_classes}"; }', '};'];
            return [`cat: ${tokens[1] ?? ''}: not found`];
          },
          'g++': () => ['Compiled → /tmp/oop'],
          '/tmp/oop': () => ['flag{cpp_classes}'],
        },
      },
      {
        id: 'cpp-2',
        title: 'Module 2: Inheritance & Polymorphism',
        points: 150,
        isSolved: false,
        description: 'Explore class hierarchies, virtual functions, and runtime polymorphism in C++.',
        mission: 'Run the polymorphism demo to trigger the overridden virtual method that prints the flag.',
        objectives: [
          'Compile `/opt/poly.cpp` with g++.',
          'Execute the binary — the overridden getFlag() is called.',
          'Note: the derived class implementation outputs the real flag.',
        ],
        hints: ['The derived class getFlag() returns: flag{cpp_polymorphism}'],
        correctFlag: 'flag{cpp_polymorphism}',
        terminalBanner: 'CyberRange C++ Lab — Polymorphism\ndev@cpp-lab:~$ ',
        prompt: 'dev@cpp-lab',
        commandHandlers: {
          'g++': () => ['Compiled → /tmp/poly'],
          '/tmp/poly': () => ['[Derived] getFlag() → flag{cpp_polymorphism}'],
        },
      },
      {
        id: 'cpp-3',
        title: 'Module 3: STL Containers & Algorithms',
        points: 200,
        isSolved: false,
        description: 'Use STL vectors, maps, and algorithms to process and decrypt flag data.',
        mission: 'Run the STL crypto demo that uses std::sort and std::map to decode the flag.',
        objectives: [
          'Compile `/opt/stl_decode.cpp`.',
          'Execute the binary — it sorts a cipher array and maps it to plaintext.',
          'The decoded output is the flag.',
        ],
        hints: ['After decoding the cipher array with std::map: flag{cpp_stl_decode}'],
        correctFlag: 'flag{cpp_stl_decode}',
        terminalBanner: 'CyberRange C++ Lab — STL\ndev@cpp-lab:~$ ',
        prompt: 'dev@cpp-lab',
        commandHandlers: {
          'g++': () => ['Compiled → /tmp/stl'],
          '/tmp/stl': () => ['Sorting cipher...', 'Decoding via map...', 'Result: flag{cpp_stl_decode}'],
        },
      },
      {
        id: 'cpp-4',
        title: 'Module 4: Templates & Generic Programming',
        points: 250,
        isSolved: false,
        description: 'Write type-safe generic algorithms using C++ template programming.',
        mission: 'Use a templated decryption function to recover the XOR-encoded flag.',
        objectives: [
          'Inspect `/opt/template_xor.cpp`.',
          'Compile and run — the template XOR<char> instantiation decodes the flag.',
          'Submit the decoded flag.',
        ],
        hints: ['XOR-decode with key 0x42 gives: flag{cpp_templates}'],
        correctFlag: 'flag{cpp_templates}',
        terminalBanner: 'CyberRange C++ Lab — Templates\ndev@cpp-lab:~$ ',
        prompt: 'dev@cpp-lab',
        commandHandlers: {
          'g++': () => ['Compiled → /tmp/template_xor'],
          '/tmp/template_xor': () => ['XOR decode with key 0x42...', 'Output: flag{cpp_templates}'],
        },
      },
      {
        id: 'cpp-5',
        title: 'Module 5: Capstone — Secure Coding',
        points: 300,
        isSolved: false,
        description: 'Audit a C++ application for memory safety issues, fix vulnerabilities, and pass all security tests.',
        mission: 'Fix the use-after-free vulnerability in the provided C++ code and run the test suite to reveal the flag.',
        objectives: [
          'Review `/opt/uaf_vuln.cpp` for use-after-free bug.',
          'Apply the patch to use smart pointers.',
          'Compile the fixed version and run the test suite.',
        ],
        hints: ['Replace raw pointers with std::unique_ptr — tests pass and output: flag{cpp_secure_master}'],
        correctFlag: 'flag{cpp_secure_master}',
        terminalBanner: 'CyberRange C++ Lab — Capstone\ndev@cpp-lab:~$ ',
        prompt: 'dev@cpp-lab',
        commandHandlers: {
          'g++': () => ['Compiled with sanitizers → /tmp/secure'],
          '/tmp/secure': () => ['[TEST SUITE]', '✓ No use-after-free detected', '✓ Memory safe', 'All tests passed!', 'flag{cpp_secure_master}'],
        },
      },
    ],
  },
];

// ─── Track Selector Page ───────────────────────────────────────────────────────
const trackColorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700' },
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const CommandLineLabSession: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [tracks, setTracks] = useState<Track[]>(TRACKS.map(t => ({ ...t, modules: t.modules.map(m => ({ ...m })) })));

  // Per-track module state
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(10800);

  // Flag submission
  const [flagInput, setFlagInput] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [unlockedHints, setUnlockedHints] = useState<number[]>([]);

  // Terminal
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [cmdInput, setCmdInput] = useState('');
  const [isRoot, setIsRoot] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const handleReturn = () => navigate(user?.role === 'admin' ? '/admin/labs' : '/labs');
  const handleDashboard = () => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/dashboard');

  // Timer
  useEffect(() => {
    if (!selectedTrack) return;
    const t = setInterval(() => setTimeRemaining(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [selectedTrack]);

  // Auto-scroll terminal
  useEffect(() => {
    terminalRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLines]);

  // When track selected — init terminal
  useEffect(() => {
    if (!selectedTrack) return;
    const activeModule = selectedTrack.modules[activeModuleIdx];
    setTerminalLines(activeModule.terminalBanner.split('\n'));
    setIsRoot(false);
    setFlagInput('');
    setSubmissionStatus('idle');
    setUnlockedHints([]);
  }, [selectedTrack, activeModuleIdx]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  };

  // ── Flag submission ──
  const handleFlagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrack || !flagInput.trim()) return;
    const mod = selectedTrack.modules[activeModuleIdx];
    if (flagInput.trim() === mod.correctFlag) {
      setSubmissionStatus('success');
      if (!mod.isSolved) {
        setTracks(prev => prev.map(t => t.id === selectedTrack.id ? {
          ...t,
          modules: t.modules.map((m, i) => i === activeModuleIdx ? { ...m, isSolved: true } : m)
        } : t));
        setSelectedTrack(prev => prev ? {
          ...prev,
          modules: prev.modules.map((m, i) => i === activeModuleIdx ? { ...m, isSolved: true } : m)
        } : prev);
        setScore(p => p + mod.points);
      }
      setTimeout(() => { setSubmissionStatus('idle'); setFlagInput(''); }, 2500);
    } else {
      setSubmissionStatus('error');
      setTimeout(() => setSubmissionStatus('idle'), 1500);
    }
  };

  // ── Terminal command handler ──
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrack) return;
    const cmd = cmdInput.trim();
    if (!cmd) return;
    const mod = selectedTrack.modules[activeModuleIdx];
    const promptStr = `${mod.prompt}:${isRoot ? '#' : '$'} `;
    const tokens = cmd.split(' ');
    const base = tokens[0];

    let output: string[] = [`${promptStr}${cmd}`];

    if (base === 'clear') {
      setTerminalLines([`${promptStr}`]);
      setCmdInput('');
      return;
    }
    if (base === 'help') {
      output.push('Commands: help, clear, ls, cat, pwd, whoami, and lab-specific tools.');
    } else if (base === 'whoami') {
      output.push(isRoot ? 'root' : 'operator');
    } else if (mod.commandHandlers[cmd] || mod.commandHandlers[base]) {
      const handler = mod.commandHandlers[cmd] ?? mod.commandHandlers[base];
      const result = handler(tokens, isRoot);
      output.push(...result);
      // Check if escalation happened
      if (result.some(l => l.includes('root shell') || l.includes('root@'))) {
        setIsRoot(true);
      }
    } else {
      output.push(`bash: ${base}: command not found`);
    }

    const nextPrompt = `${mod.prompt}:${isRoot ? '#' : '$'} `;
    output.push(nextPrompt);
    setTerminalLines(prev => [...prev, ...output]);
    setCmdInput('');
  };

  // ─── Track Selector ────────────────────────────────────────────────────────
  if (!selectedTrack) {
    return (
      <div className="flex flex-col h-screen bg-[#F8F9FA] dark:bg-[#0F172A] text-[#0F172A] dark:text-white">
        {/* Header */}
        <header className="h-14 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between z-20 flex-shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button onClick={handleReturn} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0052CC] bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
                Select Track
              </span>
              <h1 className="font-bold text-slate-800 dark:text-white text-sm leading-tight mt-0.5">Command Line Lab</h1>
            </div>
          </div>
          <button onClick={handleDashboard} className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Dashboard
          </button>
        </header>

        {/* Track cards */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Choose Your Learning Track</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Select a language track to begin your command-line training session.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tracks.map((track, trackIdx) => {
                const colors = trackColorMap[track.color];
                const solvedCount = track.modules.filter(m => m.isSolved).length;
                const totalPts = track.modules.reduce((s, m) => s + m.points, 0);
                return (
                  <button
                    key={track.id}
                    onClick={() => { setSelectedTrack(tracks[trackIdx]); setActiveModuleIdx(0); setTimeRemaining(10800); }}
                    className={`text-left p-6 rounded-2xl border-2 ${colors.bg} ${colors.border} hover:shadow-md transition-all group cursor-pointer`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.text} bg-white dark:bg-slate-900`}>
                        {track.icon}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${colors.badge}`}>
                        {solvedCount}/{track.modules.length} Modules
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">{track.label}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{track.modules.length} modules · {totalPts} pts total</p>

                    {/* Module pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {track.modules.map((m, i) => (
                        <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${m.isSolved ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                          {m.isSolved ? '✓' : `M${i + 1}`}
                        </span>
                      ))}
                    </div>

                    <div className={`mt-4 flex items-center gap-1 text-xs font-bold ${colors.text} group-hover:gap-2 transition-all`}>
                      <span>Start Track</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Session View (matches Network Recon Lab design) ─────────────────────
  const activeModule = selectedTrack.modules[activeModuleIdx];
  const solvedCount = selectedTrack.modules.filter(m => m.isSolved).length;
  const colors = trackColorMap[selectedTrack.color];

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0F172A] overflow-hidden">
      {/* ── Session Header (identical structure to ChallengeSession) ── */}
      <header className="h-14 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between z-20 flex-shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedTrack(null); setScore(0); }}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            title="Back to track selection"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0052CC] bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
              Active Session
            </span>
            <h1 className="font-bold text-slate-800 dark:text-white text-sm leading-tight mt-0.5">
              Command Line Lab — <span className={colors.text}>{selectedTrack.label}</span>
            </h1>
          </div>
        </div>

        {/* Center: score + progress */}
        <div className="hidden sm:flex items-center gap-4">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Score: <span className="text-slate-800 dark:text-white font-extrabold">{score} pts</span>
          </span>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Modules:</span>
            <span className="text-slate-800 dark:text-white font-extrabold">{solvedCount} / {selectedTrack.modules.length}</span>
          </div>
        </div>

        {/* Right: timer + exit */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${timeRemaining < 900 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 animate-pulse' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
            <Clock className="w-4 h-4" />
            <span>{formatTime(timeRemaining)}</span>
          </div>
          <button
            onClick={() => { if (window.confirm('Exit session? Your progress will be saved.')) { setSelectedTrack(null); } }}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors"
          >
            Exit Session
          </button>
        </div>
      </header>

      {/* ── Main split layout (same as ChallengeSession) ── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* LEFT PANE: module info */}
        <div className="w-full md:w-[42%] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col min-h-0 overflow-y-auto">
          {/* Module navigation tabs */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30 flex-shrink-0">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Lab Modules</span>
            <div className="flex gap-1.5">
              {selectedTrack.modules.map((mod, idx) => (
                <button
                  key={mod.id}
                  onClick={() => { setActiveModuleIdx(idx); setUnlockedHints([]); setFlagInput(''); setSubmissionStatus('idle'); }}
                  className={`w-7 h-7 rounded-lg border text-xs font-extrabold transition-all flex items-center justify-center ${
                    idx === activeModuleIdx
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-[#0052CC] dark:text-blue-400 border-blue-300 dark:border-blue-700 ring-2 ring-[#0052CC]/15 shadow-xs'
                      : mod.isSolved
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                  title={mod.title}
                >
                  {mod.isSolved ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Module content body */}
          <div className="flex-1 p-6 space-y-6">
            {/* Title & Points */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Module {activeModuleIdx + 1} of {selectedTrack.modules.length}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800">
                  +{activeModule.points} pts
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mt-1">
                {activeModule.title}
              </h2>
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {activeModule.description}
            </p>

            {/* Mission */}
            <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl">
              <span className="text-[9px] font-bold text-[#0052CC] dark:text-blue-400 uppercase tracking-wider block mb-1">Mission</span>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{activeModule.mission}</p>
            </div>

            {/* Objectives checklist */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Objectives Checklist</h3>
              <div className="space-y-2">
                {activeModule.objectives.map((obj, i) => (
                  <div key={i} className="flex gap-2.5 items-start text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    <ChevronRight className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <span>{obj}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hints */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Hints Assistance</h3>
              <div className="space-y-2">
                {activeModule.hints.map((hint, idx) => {
                  const unlocked = unlockedHints.includes(idx);
                  return (
                    <div key={idx} className={`p-3 rounded-lg border transition-all ${unlocked ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900 text-xs text-slate-600 dark:text-slate-400 leading-relaxed' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3'}`}>
                      {unlocked ? (
                        <div>
                          <span className="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider block mb-1">Hint #{idx + 1}</span>
                          <p>{hint}</p>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Hint #{idx + 1} (−25 pts penalty)</span>
                          <button
                            onClick={() => { if (window.confirm('Unlock hint for −25 pts?')) { setUnlockedHints(p => [...p, idx]); setScore(p => Math.max(0, p - 25)); } }}
                            className="bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[#0052CC] dark:text-blue-400 hover:text-blue-700 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 font-bold text-xs px-2.5 py-1 rounded-lg transition-colors shadow-xs cursor-pointer"
                          >
                            Unlock
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Flag submission (sticky bottom) */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
            <form onSubmit={handleFlagSubmit} className="space-y-3">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Submit Flag Credentials
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="flag{...}"
                  value={flagInput}
                  onChange={e => setFlagInput(e.target.value)}
                  disabled={activeModule.isSolved}
                  className={`flex-1 px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm font-mono placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${
                    activeModule.isSolved
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 cursor-not-allowed'
                      : submissionStatus === 'success'
                      ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/10'
                      : submissionStatus === 'error'
                      ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 ring-2 ring-rose-500/10'
                      : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-[#0052CC]/15 focus:border-[#0052CC]'
                  }`}
                />
                <button
                  type="submit"
                  disabled={activeModule.isSolved || submissionStatus === 'success'}
                  className={`font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeModule.isSolved
                      ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 cursor-not-allowed'
                      : 'bg-[#0052CC] hover:bg-blue-700 text-white'
                  }`}
                >
                  {activeModule.isSolved ? <><CheckCircle2 className="w-4 h-4" /><span>Solved</span></> : <span>Submit</span>}
                </button>
              </div>

              {submissionStatus === 'success' && (
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Correct! +{activeModule.points} points awarded.</span>
                </p>
              )}
              {submissionStatus === 'error' && (
                <p className="text-[11px] font-bold text-rose-500 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Incorrect flag. Review objectives and try again.</span>
                </p>
              )}
            </form>
          </div>
        </div>

        {/* RIGHT PANE: Terminal (identical layout to ChallengeSession) */}
        <div className="flex-1 bg-slate-950 flex flex-col min-h-0 overflow-hidden">
          {/* Terminal toolbar */}
          <div className="h-10 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-emerald-500" />
              <span className="font-mono text-emerald-400">Terminal Emulator — {selectedTrack.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md font-bold text-emerald-400">
                {selectedTrack.subtitle}
              </span>
              <button
                onClick={() => {
                  setIsRoot(false);
                  setTerminalLines(activeModule.terminalBanner.split('\n'));
                }}
                className="hover:text-white p-1 hover:bg-slate-800 rounded-md transition-colors"
                title="Reset terminal"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Terminal output */}
          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-emerald-400 space-y-0.5 selection:bg-emerald-950/60">
            {terminalLines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap leading-relaxed">{line}</div>
            ))}
            <div ref={terminalRef} />
          </div>

          {/* Terminal input */}
          <form onSubmit={handleCommandSubmit} className="h-10 bg-slate-900 border-t border-slate-800 flex items-center px-4 flex-shrink-0">
            <span className="font-mono text-xs text-emerald-500 mr-2 flex-shrink-0">
              {activeModule.prompt}:{isRoot ? '#' : '$'}
            </span>
            <input
              type="text"
              value={cmdInput}
              onChange={e => setCmdInput(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-emerald-400 focus:ring-0 placeholder-emerald-800"
              placeholder='Type "help" to see available commands…'
              autoFocus
            />
          </form>
        </div>
      </div>
    </div>
  );
};
