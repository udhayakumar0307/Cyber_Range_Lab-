# Module 1: S3 Anonymous Reconnaissance

## Objective
Enumerate the public S3 bucket anonymously to discover what assets TechCorp has exposed.

## Background
AWS Simple Storage Service (S3) stores files in "buckets". If a bucket is misconfigured to allow public access, anyone can list or read its contents without credentials.

## Steps to Solve
1. Check the dashboard's connection details panel for the name of the **Public S3 Bucket** (e.g., `company-public-assets-[suffix]`).
2. Open your workstation terminal (`docker exec -it lab2-student bash`).
3. Run the S3 list command anonymously:
   ```bash
   aws s3 ls s3://[your-public-bucket-name] --no-sign-request --endpoint-url http://10.20.0.10:4566
   ```
4. You will see a file named `welcome.txt` listed. Download and read it to get your first flag:
   ```bash
   aws s3 cp s3://[your-public-bucket-name]/welcome.txt - --no-sign-request --endpoint-url http://10.20.0.10:4566
   ```
5. Submit the flag on the web UI (`http://localhost:5000`) to unlock Module 2!
