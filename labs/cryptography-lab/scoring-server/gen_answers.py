import json
import hashlib
import base64

def b64_encode(s): return base64.b64encode(s.encode()).decode()
def b64_decode(s): return base64.b64decode(s.encode()).decode()
def hex_encode(s): return s.encode().hex()
def hex_decode(s): return bytes.fromhex(s).decode()
def bin_encode(s): return ' '.join(format(ord(c), '08b') for c in s)
def md5(s): return hashlib.md5(s.encode()).hexdigest()
def sha1(s): return hashlib.sha1(s.encode()).hexdigest()
def sha256(s): return hashlib.sha256(s.encode()).hexdigest()
def sha512(s): return hashlib.sha512(s.encode()).hexdigest()

objectives = {
  'module1': [
    {
      'objective_id': 'm1_obj1',
      'question': 'Encode the word "Cyber" into Base64.',
      'correct_answer': b64_encode('Cyber'),
      'flag': 'FLAG{' + b64_encode('Cyber') + '}',
      'validation_value': b64_encode('Cyber'),
      'explanation': 'Base64 encodes binary to text using 64 printable characters.',
      'why_correct': 'The ASCII string Cyber encodes to Q3liZXI= in Base64.'
    },
    {
      'objective_id': 'm1_obj2',
      'question': 'Decode the following Base64 string:\nQ3liZXJSYW5nZQ==',
      'correct_answer': b64_decode('Q3liZXJSYW5nZQ=='),
      'flag': 'FLAG{' + b64_decode('Q3liZXJSYW5nZQ==') + '}',
      'validation_value': b64_decode('Q3liZXJSYW5nZQ=='),
      'explanation': 'Base64 decoding reverses the encoding back to ASCII text.',
      'why_correct': 'The base64 string decodes to CyberRange.'
    },
    {
      'objective_id': 'm1_obj3',
      'question': 'Encode the word "Hello" into Hex.',
      'correct_answer': hex_encode('Hello'),
      'flag': 'FLAG{' + hex_encode('Hello') + '}',
      'validation_value': hex_encode('Hello'),
      'explanation': 'Hexadecimal represents each byte with two characters (0-9, a-f).',
      'why_correct': 'The word Hello is 48656c6c6f in Hex.'
    },
    {
      'objective_id': 'm1_obj4',
      'question': 'Decode the following Hex string and submit the output as the flag:\n' + hex_encode('Welcome'),
      'correct_answer': 'Welcome',
      'flag': 'FLAG{Welcome}',
      'validation_value': 'Welcome',
      'explanation': 'Hex decoding converts the pairs of hexadecimal characters back to text.',
      'why_correct': 'Decoding 57656c636f6d65 produces Welcome.'
    }
  ],
  'module2': [
    {
      'objective_id': 'm2_obj1',
      'question': 'Generate the MD5 hash of:\npassword',
      'correct_answer': md5('password'),
      'flag': 'FLAG{' + md5('password') + '}',
      'validation_value': md5('password'),
      'explanation': 'MD5 generates a 128-bit (32 character) hash.',
      'why_correct': 'The MD5 sum of password is ' + md5('password')
    },
    {
      'objective_id': 'm2_obj2',
      'question': 'Generate the SHA1 hash of:\nadmin',
      'correct_answer': sha1('admin'),
      'flag': 'FLAG{' + sha1('admin') + '}',
      'validation_value': sha1('admin'),
      'explanation': 'SHA1 generates a 160-bit (40 character) hash.',
      'why_correct': 'The SHA1 sum of admin is ' + sha1('admin')
    },
    {
      'objective_id': 'm2_obj3',
      'question': 'Generate the SHA256 hash of:\nsecurity',
      'correct_answer': sha256('security'),
      'flag': 'FLAG{' + sha256('security') + '}',
      'validation_value': sha256('security'),
      'explanation': 'SHA256 generates a 256-bit (64 character) hash.',
      'why_correct': 'The SHA256 sum is ' + sha256('security')
    },
    {
      'objective_id': 'm2_obj4',
      'question': 'Which hash algorithm produces a 32-character hexadecimal output? (Submit the name, e.g. SHA256)',
      'correct_answer': 'MD5',
      'flag': 'FLAG{MD5}',
      'validation_value': 'MD5',
      'explanation': 'Count the characters. 32 hex characters means 128 bits, which is MD5.',
      'why_correct': 'MD5 produces 32-character hex.'
    }
  ],
  'module3': [
    {
      'objective_id': 'm3_obj1',
      'question': 'Generate the MD5 hash of:\nCyber',
      'correct_answer': md5('Cyber'),
      'flag': 'FLAG{' + md5('Cyber') + '}',
      'validation_value': md5('Cyber'),
      'explanation': 'Use the MD5 operation on Cyber.',
      'why_correct': 'MD5(Cyber) = ' + md5('Cyber')
    },
    {
      'objective_id': 'm3_obj2',
      'question': 'Generate the SHA1 hash of:\nCyber',
      'correct_answer': sha1('Cyber'),
      'flag': 'FLAG{' + sha1('Cyber') + '}',
      'validation_value': sha1('Cyber'),
      'explanation': 'Use the SHA1 operation on Cyber.',
      'why_correct': 'SHA1(Cyber) = ' + sha1('Cyber')
    },
    {
      'objective_id': 'm3_obj3',
      'question': 'Generate the SHA256 hash of:\nCyber',
      'correct_answer': sha256('Cyber'),
      'flag': 'FLAG{' + sha256('Cyber') + '}',
      'validation_value': sha256('Cyber'),
      'explanation': 'Use the SHA256 operation on Cyber.',
      'why_correct': 'SHA256(Cyber) = ' + sha256('Cyber')
    },
    {
      'objective_id': 'm3_obj4',
      'question': 'Generate the SHA512 hash of the following and submit the hash as the flag:\nCyberRange',
      'correct_answer': sha512('CyberRange'),
      'flag': 'FLAG{' + sha512('CyberRange') + '}',
      'validation_value': sha512('CyberRange'),
      'explanation': 'Use the SHA512 operation on CyberRange.',
      'why_correct': 'SHA512(CyberRange) = ' + sha512('CyberRange')
    }
  ],
  'module4': [
    {
      'objective_id': 'm4_obj1',
      'question': 'Encode the word into Base64:\nSecurity',
      'correct_answer': b64_encode('Security'),
      'flag': 'FLAG{' + b64_encode('Security') + '}',
      'validation_value': b64_encode('Security'),
      'explanation': 'Use Base64 Encode.',
      'why_correct': 'Base64 of Security is ' + b64_encode('Security')
    },
    {
      'objective_id': 'm4_obj2',
      'question': 'Encode the word into Hex:\nHash',
      'correct_answer': hex_encode('Hash'),
      'flag': 'FLAG{' + hex_encode('Hash') + '}',
      'validation_value': hex_encode('Hash'),
      'explanation': 'Use Hex Encode.',
      'why_correct': 'Hex of Hash is ' + hex_encode('Hash')
    },
    {
      'objective_id': 'm4_obj3',
      'question': 'Encode the word into Binary (space separated):\nKey',
      'correct_answer': bin_encode('Key'),
      'flag': 'FLAG{' + bin_encode('Key') + '}',
      'validation_value': bin_encode('Key'),
      'explanation': 'Use Binary Encode.',
      'why_correct': 'Binary of Key is ' + bin_encode('Key')
    },
    {
      'objective_id': 'm4_obj4',
      'question': 'Generate the SHA256 hash of the following and submit it as the flag:\nCyber123',
      'correct_answer': sha256('Cyber123'),
      'flag': 'FLAG{' + sha256('Cyber123') + '}',
      'validation_value': sha256('Cyber123'),
      'explanation': 'Use SHA256 Hash.',
      'why_correct': 'SHA256 of Cyber123 is ' + sha256('Cyber123')
    }
  ],
  'module5': [
    {
      'objective_id': 'm5_obj1',
      'question': 'Step 1: Decode the following Base64 string:\nSGFzaA==',
      'correct_answer': b64_decode('SGFzaA=='),
      'flag': 'FLAG{' + b64_decode('SGFzaA==') + '}',
      'validation_value': b64_decode('SGFzaA=='),
      'explanation': 'Use Base64 Decode.',
      'why_correct': 'Decodes to Hash'
    },
    {
      'objective_id': 'm5_obj2',
      'question': 'Step 2: Convert the decoded word ("Hash") into Hex.',
      'correct_answer': hex_encode('Hash'),
      'flag': 'FLAG{' + hex_encode('Hash') + '}',
      'validation_value': hex_encode('Hash'),
      'explanation': 'Use Hex Encode.',
      'why_correct': 'Hex of Hash is ' + hex_encode('Hash')
    },
    {
      'objective_id': 'm5_obj3',
      'question': 'Step 3: Generate the SHA256 hash of the Hex output ("' + hex_encode('Hash') + '").',
      'correct_answer': sha256(hex_encode('Hash')),
      'flag': 'FLAG{' + sha256(hex_encode('Hash')) + '}',
      'validation_value': sha256(hex_encode('Hash')),
      'explanation': 'Use SHA256.',
      'why_correct': 'SHA256 of ' + hex_encode('Hash') + ' is ' + sha256(hex_encode('Hash'))
    },
    {
      'objective_id': 'm5_obj4',
      'question': 'Step 4: Submit the final SHA256 hash as the flag.',
      'correct_answer': sha256(hex_encode('Hash')),
      'flag': 'FLAG{' + sha256(hex_encode('Hash')) + '}',
      'validation_value': sha256(hex_encode('Hash')),
      'explanation': 'Combine all steps to arrive at this final flag.',
      'why_correct': 'The final hash is the correct answer.'
    }
  ]
}

with open('answers.json', 'w') as f:
    json.dump(objectives, f, indent=2)

txt_output = ""
for mod, objs in objectives.items():
    mod_num = mod.replace('module', '')
    txt_output += "=" * 80 + "\n"
    txt_output += f"MODULE {mod_num}\n"
    txt_output += "=" * 80 + "\n\n"
    for i, obj in enumerate(objs):
        txt_output += "-" * 80 + "\n"
        txt_output += f"Objective {i+1}\n"
        txt_output += "-" * 80 + "\n"
        txt_output += f"Objective ID : {obj['objective_id']}\n"
        txt_output += f"Question     : {obj['question']}\n"
        txt_output += f"Correct Ans  : {obj['correct_answer']}\n"
        txt_output += f"Flag         : {obj['flag']}\n\n"
        txt_output += f"Step-by-Step Explanation:\n{obj['explanation']}\n\n"
        txt_output += f"Why the Answer is Correct:\n{obj['why_correct']}\n\n"

with open('answers.txt', 'w') as f:
    f.write(txt_output)

print('answers.json and answers.txt created!')
