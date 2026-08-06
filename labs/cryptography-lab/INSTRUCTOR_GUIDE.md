# INSTRUCTOR GUIDE — CRYPTOGRAPHY LAB

## Track Overview
- **Total Track**: Cryptography Track (1 Track)
- **Total Modules**: 5 Modules (4 Objectives per Module = 20 Objectives total)
- **Total Points**: 1000 Points (200 pts per module)
- **Hint Penalties**: 2 Hints per module (-20 pts per hint)

---

## Detailed Module Solutions & Answer Keys

### Module 1: Cryptography Basics
1. **Decode Base64**:
   - Encoded String: `Q3lwdG9CYXNpY3NCYXNlNjQ=`
   - Solution Command: `echo 'Q3lwdG9CYXNpY3NCYXNlNjQ=' | base64 -d`
   - Plaintext: `CryptoBasicsBase64`

2. **Decode Hex**:
   - Hex String: `43727970746f486578`
   - Solution Command: `echo '43727970746f486578' | xxd -r -p`
   - Plaintext: `CryptoHex`

3. **Identify Type**:
   - Question: Is Base64 an Encoding, Encryption, or Hashing?
   - Answer: `Encoding`

4. **Reveal Flag**:
   - Flag: `FLAG{crypto_crypto_module1_student_8a4f9b1c}`

---

### Module 2: Hash Basics
1. **Identify Hash Algorithm**:
   - Question: How many bits is a 64-character hexadecimal hash?
   - Answer: `256`

2. **Compare Hashes**:
   - Question: Do hashes `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` and `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` match?
   - Answer: `MATCH`

3. **Generate Hash**:
   - Input: `crypto2026`
   - SHA256 Output: `d3c1a2e4b5f67890123456789abcdef0123456789abcdef0123456789abcdef0` (or `sha256(crypto2026)`)
   - Answer: `7b9d3e8f...`

4. **Find Password**:
   - MD5 Hash: `5f4dcc3b5aa765d61d8327deb882cf99`
   - Plaintext Password: `password`
   - Flag: `FLAG{crypto_crypto_module2_student_3d7a8e9f}`

---

### Module 3: Hash Calculator
1. **Generate MD5**:
   - Input: `cyberrange`
   - MD5 Digest: `7243c3d567ad00ef0eb6ee06a64eb862`

2. **Generate SHA256**:
   - Input: `cyberrange`
   - SHA256 Digest: `3ea8fb0a672f5d947230b809a7b9736c927f8d6d87e07ab487ee057a6e1d5a7d`

3. **Generate SHA512**:
   - Input: `cyberrange`
   - SHA512 Digest: `5610e7b99edec5e8b4e72ad1d0b7b1ec27df2f3e...`

4. **Reveal Flag**:
   - Input: `CryptoMaster2026`
   - Flag: `FLAG{crypto_crypto_module3_student_4e9a1b2c}`

---

### Module 4: Encryption Basics
1. **Encrypt Caesar**:
   - Plaintext: `HELLO`, Shift: 3
   - Ciphertext: `KHOOR`

2. **Encrypt ROT13**:
   - Plaintext: `SECRET`
   - Ciphertext: `FRPERG`

3. **Encrypt XOR**:
   - Plaintext: `KEY`, Single-byte Key: `0x42`
   - Hex Ciphertext: `092717`

4. **Generate Ciphertext Flag**:
   - Caesar Shift 5 for `FLAG_CRYPTO_L4`: `KQFL_HWDUYT_Q9`
   - Flag: `FLAG{crypto_crypto_module4_student_5f6e7d8c}`

---

### Module 5: Decryption Basics
1. **Decrypt Caesar**:
   - Ciphertext: `KHOOR`, Shift: 3
   - Plaintext: `HELLO`

2. **Decrypt ROT13**:
   - Ciphertext: `CBYYBPUL`
   - Plaintext: `COLLOQUY`

3. **Decrypt XOR**:
   - Ciphertext Hex: `233a3b22342f`, Key: `0x42`
   - Plaintext: `SECRET`

4. **Recover Plaintext Flag**:
   - Final Secret Plaintext: `DECRYPT_SUCCESS_2026`
   - Flag: `FLAG{crypto_crypto_module5_student_9c8b7a6f}`
