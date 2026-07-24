# Module 2: Credential Theft & Log Analysis

## Objective
Recover leaked internal AWS credentials from a system log file left in the public bucket, and decrypt the stage 2 flag.

## Background
System administrators often accidentally leave debug logging enabled in production, which can leak access keys, passwords, and tokens. In this module, you will also encounter a basic rotation cipher (ROT13) used to obfuscate the flag.

## Steps to Solve
1. Submit your Stage 1 flag to trigger the creation of the system log file.
2. List the files in the public bucket to find the log file:
   ```bash
   aws s3 ls s3://[your-public-bucket-name] --no-sign-request --endpoint-url http://10.20.0.10:4566
   ```
   You will notice a new file named `system.log`.
3. Download the log file and search for the leaked AWS developer keys:
   ```bash
   aws s3 cp s3://[your-public-bucket-name]/system.log - --no-sign-request --endpoint-url http://10.20.0.10:4566 | grep -i "AWS_ACCESS_KEY_ID"
   ```
4. Find the obfuscated Stage 2 Flag in the logs starting with `synt{`. Run the following command to decode the ROT13 flag:
   ```bash
   echo "synt{your_obfuscated_flag_here}" | tr 'A-Za-z' 'N-ZA-Mn-za-m'
   ```
5. Save the AWS developer keys. You will need them to authenticate in Module 3!
6. Submit the decoded flag on the dashboard to unlock Module 3.
