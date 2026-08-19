# Cryptography — Vintage Cipher

An old intercepted transmission was recovered from the archives (`cipher.txt` in this folder).
It was encrypted with a classic **Vigenère cipher**. Non-letter characters (digits, `{`, `}`,
`_`) were left untouched — only the alphabetic characters were shifted.

**Key:** `CYBER`

Decrypt `cipher.txt` with the Vigenère cipher using that key to recover the flag
(format: `flag{...}`).

Any Vigenère decoder works — CyberChef, dcode.fr, or a few lines of Python:

```python
def vigenere_decrypt(ciphertext, key):
    key = key.upper()
    result = []
    ki = 0
    for ch in ciphertext:
        if ch.isalpha():
            shift = ord(key[ki % len(key)]) - ord('A')
            base = ord('A') if ch.isupper() else ord('a')
            result.append(chr((ord(ch) - base - shift) % 26 + base))
            ki += 1
        else:
            result.append(ch)
    return ''.join(result)

with open('cipher.txt') as f:
    print(vigenere_decrypt(f.read().strip(), 'CYBER'))
```
