# Module 2: Hash Basics (Beginner Guided Training)

## Concept Overview
Cryptographic hashes are one-way mathematical functions used to verify data integrity. Explore MD5, SHA1, and SHA256 output lengths and password lookup.

## Guided Step-by-Step Objectives

### Objective 1: Identify Hash Algorithm
- **Goal**: Identify hash length.
- **Background**: MD5 produces 32 hex chars (128 bits), SHA1 produces 40 hex chars (160 bits), and SHA256 produces 64 hex chars (256 bits).
- **Steps**:
  1. Count hex chars in `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (64 chars).
  2. Identify the 256-bit algorithm.
- **Expected Output**: `SHA256`
- **Flag**: `FLAG{sha256_length}`

### Objective 2: Compare Hashes
- **Goal**: Verify file integrity.
- **Steps**:
  1. Compare Hash A and Hash B in Hash Learning Panel.
- **Expected Output**: `MATCH`
- **Flag**: `FLAG{hashes_match}`

### Objective 3: Generate SHA256 Digest
- **Goal**: Generate SHA256 hash for `hello`.
- **Steps**:
  1. Enter `hello` in Hash Calculator, select `SHA-256`, click Compute.
- **Expected Output**: `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824`
- **Flag**: `FLAG{2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824}`

### Objective 4: Password Hash Lookup
- **Goal**: Perform dictionary lookup for MD5 `5f4dcc3b5aa765d61d8327deb882cf99`.
- **Steps**:
  1. Lookup hash in Password Hash Lookup tool.
- **Expected Output**: `password`
- **Flag**: `FLAG{password_found}`
