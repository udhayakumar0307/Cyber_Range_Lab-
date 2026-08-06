# Module 1: Cryptography Basics (Beginner Guided Training)

## Concept Overview
Learn how data is formatted with Encoding schemes like Base64 and Hexadecimal, and understand why Encoding is different from Encryption and Hashing.

## Guided Step-by-Step Objectives

### Objective 1: Decode Base64
- **Goal**: Learn Base64 decoding.
- **Background**: Base64 converts binary data into ASCII printable text (A-Z, a-z, 0-9, +, /, '='). It uses no secret key.
- **Steps**:
  1. Copy encoded string: `SGVsbG8=`
  2. Use the Decoder Panel on the right.
  3. Select "Base64 Decode" and click Convert.
- **Expected Output**: `Hello`
- **Flag**: `FLAG{hello}`

### Objective 2: Decode Hexadecimal
- **Goal**: Learn Hexadecimal (Base16) decoding.
- **Background**: Hex represents bytes as pairs of characters 0-9 and a-f (e.g. 48='H', 65='e', 6c='l', 6f='o').
- **Steps**:
  1. Copy hex string: `48656c6c6f`
  2. Use the Decoder Panel.
  3. Select "Hex Decode" and click Convert.
- **Expected Output**: `Hello`
- **Flag**: `FLAG{hex_success}`

### Objective 3: Identify Algorithm Category
- **Goal**: Understand Encoding vs Encryption vs Hashing.
- **Background**: Encoding transforms data for compatibility without a key. Encryption uses a secret key. Hashing produces a one-way digest.
- **Steps**:
  1. Determine if Base64 is Encoding, Encryption, or Hashing.
- **Expected Output**: `Encoding`
- **Flag**: `FLAG{crypto_basics}`

### Objective 4: Multi-Stage Decoding
- **Goal**: Combine decoding steps to reveal master flag.
- **Steps**:
  1. Decode Base64 payload `WVd4c0lHOW1JSFJvWlNCMGIzOXNYM0F5TURJNg==` twice.
- **Expected Output**: `basics_mastered_2026`
- **Flag**: `FLAG{basics_mastered_2026}`
