# Module 5: Decryption Basics (Beginner Guided Training)

## Concept Overview
Master cryptanalysis and decryption! Decryption reverses encryption using the correct key to recover original Plaintext.

## Guided Step-by-Step Objectives

### Objective 1: Decrypt Caesar
- **Goal**: Decrypt Caesar ciphertext `KHOOR` (shift 3).
- **Steps**:
  1. Input `KHOOR`, select Caesar Cipher, shift `3`, click Decrypt.
- **Expected Output**: `HELLO`
- **Flag**: `FLAG{hello}`

### Objective 2: Decrypt ROT13
- **Goal**: Decrypt ROT13 ciphertext `CBYYBPUL`.
- **Steps**:
  1. Input `CBYYBPUL`, select ROT13, click Decrypt.
- **Expected Output**: `COLLOQUY`
- **Flag**: `FLAG{colloquy}`

### Objective 3: Decrypt XOR
- **Goal**: Decrypt XOR hex ciphertext `233a3b22342f` (key `0x42`).
- **Steps**:
  1. Input `233a3b22342f`, select XOR Cipher, key `0x42`, click Decrypt.
- **Expected Output**: `SECRET`
- **Flag**: `FLAG{secret}`

### Objective 4: Recover Master Plaintext
- **Goal**: Recover final plaintext payload.
- **Steps**:
  1. Decode Base64 payload `QkVDSVBIRVJfU1VDQ0VTU18yMDI2`.
- **Expected Output**: `DECRYPTION_SUCCESS_2026`
- **Flag**: `FLAG{decryption_master_2026}`
