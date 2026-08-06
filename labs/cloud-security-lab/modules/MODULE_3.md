# Module 3: Cloud Resource Enumeration

## Objective
Configure your workstation with the compromised developer credentials and enumerate internal AWS resources to find the hidden flag.

## Background
AWS credentials (Access Key ID and Secret Access Key) are used to sign API requests. Once compromised, they grant attackers the ability to query internal resources using their assigned privileges.

## Steps to Solve
1. Set the compromised developer credentials in your terminal session to authenticate as the `developer` user:
   ```bash
   export AWS_ACCESS_KEY_ID=LKIA...
   export AWS_SECRET_ACCESS_KEY=...
   export AWS_DEFAULT_REGION=us-east-1
   ```
2. List the active Lambda functions in the account using your credentials:
   ```bash
   aws lambda list-functions --endpoint-url http://10.20.0.10:4566
   ```
3. Inspect the JSON output for a Lambda function named `EnumerateResources`. Look inside its `Environment` variables configuration block to locate the Stage 3 flag.
4. Submit the flag on the dashboard to unlock Module 4.
