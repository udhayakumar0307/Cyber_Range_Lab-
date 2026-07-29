import os
import time
import json
import hashlib
import boto3
from botocore.exceptions import EndpointConnectionError

LOCALSTACK_ENDPOINT = os.environ.get("LOCALSTACK_ENDPOINT", "http://10.20.0.10:4566")
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

STUDENT_ID = os.environ.get("STUDENT_ID", "student")
LAB_SEED = os.environ.get("LAB_SEED", "defaultseed")

def generate_flag(student_id: str, lab: int, module: int, lab_seed: str) -> str:
    raw_input = f"lab{lab}_mod{module}_{student_id}_{lab_seed}"
    hash_digest = hashlib.sha256(raw_input.encode()).hexdigest()[:8]
    return f"FLAG{{techcorp_lab{lab}_mod{module}_{student_id}_{hash_digest}}}"

def get_s3_client():
    return boto3.client("s3", endpoint_url=LOCALSTACK_ENDPOINT, region_name=AWS_REGION)

def get_iam_client():
    return boto3.client("iam", endpoint_url=LOCALSTACK_ENDPOINT, region_name=AWS_REGION)

def get_lambda_client():
    return boto3.client("lambda", endpoint_url=LOCALSTACK_ENDPOINT, region_name=AWS_REGION)

def get_secretsmanager_client():
    return boto3.client("secretsmanager", endpoint_url=LOCALSTACK_ENDPOINT, region_name=AWS_REGION)

def wait_for_localstack():
    s3 = get_s3_client()
    retries = 30
    print(f"Connecting to LocalStack at {LOCALSTACK_ENDPOINT}...")
    for i in range(retries):
        try:
            s3.list_buckets()
            print("Successfully connected to LocalStack!")
            return
        except (EndpointConnectionError, Exception) as e:
            print(f"Waiting for LocalStack... ({i+1}/{retries}) - Error: {e}")
            time.sleep(2)
    raise Exception("LocalStack is not reachable.")

def seed():
    wait_for_localstack()

    # Generate deterministic flags
    flags = {
        "stage1": generate_flag(STUDENT_ID, 2, 1, LAB_SEED),
        "stage2": generate_flag(STUDENT_ID, 2, 2, LAB_SEED),
        "stage3": generate_flag(STUDENT_ID, 2, 3, LAB_SEED),
        "stage4": generate_flag(STUDENT_ID, 2, 4, LAB_SEED),
        "stage5": generate_flag(STUDENT_ID, 2, 5, LAB_SEED)
    }

    # Save flags locally to scoring server for verification
    with open("flags.json", "w") as f:
        json.dump(flags, f)
    print("Generated deterministic flags and saved to flags.json")

    # Automatically synchronize ans.txt
    try:
        from ans_parser import sync_ans_txt
        ans_path = Path(__file__).parent / "ans.txt"
        sync_ans_txt(ans_path, flags)
        print("Synchronized generated flags into ans.txt")
    except Exception as e:
        print(f"Warning syncing ans.txt: {e}")

    s3 = get_s3_client()
    iam = get_iam_client()
    lambda_client = get_lambda_client()
    secretsmanager = get_secretsmanager_client()

    # Generate bucket names using a deterministic suffix based on Student ID to ensure uniqueness
    suffix = hashlib.md5(f"{STUDENT_ID}_{LAB_SEED}".encode()).hexdigest()[:8]
    public_bucket_name = f"company-public-assets-{suffix}"
    restricted_bucket_name = f"company-restricted-records-{suffix}"

    print(f"Seeding Public S3 Bucket: {public_bucket_name}")
    try:
        # Create public S3 bucket
        s3.create_bucket(Bucket=public_bucket_name)

        # Allow public access policy on public bucket
        s3.put_public_access_block(
            Bucket=public_bucket_name,
            PublicAccessBlockConfiguration={
                "BlockPublicAcls": False,
                "IgnorePublicAcls": False,
                "BlockPublicPolicy": False,
                "RestrictPublicBuckets": False
            }
        )
        
        public_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": [
                        "s3:GetObject",
                        "s3:ListBucket"
                    ],
                    "Resource": [
                        f"arn:aws:s3:::{public_bucket_name}",
                        f"arn:aws:s3:::{public_bucket_name}/*"
                    ]
                }
            ]
        }
        s3.put_bucket_policy(Bucket=public_bucket_name, Policy=json.dumps(public_policy))

        # Put Stage 1 flag in welcome.txt
        welcome_content = f"""Welcome to the Company Public Assets Portal.
This bucket is open for public access.
Stage 1 Flag: {flags['stage1']}

Please check system.log for credentials to authenticate into our internal IAM.
"""
        s3.put_object(
            Bucket=public_bucket_name,
            Key="welcome.txt",
            Body=welcome_content.encode("utf-8")
        )
    except Exception as e:
        print(f"Error seeding S3 public bucket: {e}")

    # Create IAM User: developer
    print("Creating IAM user: developer")
    try:
        iam.create_user(UserName="developer")
    except iam.exceptions.EntityAlreadyExistsException:
        pass

    # Clean up any existing access keys to prevent LimitExceededException
    try:
        keys = iam.list_access_keys(UserName="developer")
        for key in keys.get("AccessKeyMetadata", []):
            iam.delete_access_key(UserName="developer", AccessKeyId=key["AccessKeyId"])
    except Exception as e:
        print(f"Error cleaning up old access keys: {e}")

    creds = iam.create_access_key(UserName="developer")
    access_key = creds["AccessKey"]["AccessKeyId"]
    secret_key = creds["AccessKey"]["SecretAccessKey"]

    # Attach initial low-privilege policy to user: developer
    # The policy lets the user list/get objects from public bucket, list functions, and put user policies (escalation vector)
    developer_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "s3:ListBucket",
                    "s3:GetObject"
                ],
                "Resource": [
                    f"arn:aws:s3:::{public_bucket_name}",
                    f"arn:aws:s3:::{public_bucket_name}/*"
                ]
            },
            {
                "Effect": "Allow",
                "Action": [
                    "lambda:ListFunctions",
                    "lambda:GetFunctionConfiguration"
                ],
                "Resource": "*"
            },
            {
                "Effect": "Allow",
                "Action": [
                    "iam:ListUserPolicies",
                    "iam:GetUserPolicy",
                    "iam:PutUserPolicy"
                ],
                "Resource": f"arn:aws:iam::000000000000:user/developer"
            }
        ]
    }

    try:
        iam.put_user_policy(
            UserName="developer",
            PolicyName="DeveloperInitialPolicy",
            PolicyDocument=json.dumps(developer_policy)
        )
    except Exception as e:
        print(f"Error attaching policy to developer: {e}")

    # Create Stage 3 Lambda function containing the Stage 3 flag in its environment variables
    print("Creating dummy Lambda function containing Stage 3 flag")
    try:
        # Delete function if it already exists to ensure it updates with the fresh flag
        try:
            lambda_client.delete_function(FunctionName="EnumerateResources")
        except Exception:
            pass

        import zipfile
        import io
        
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            zip_file.writestr("lambda.py", "def handler(event, context):\n    return 'hello'\n")
        dummy_zip = zip_buffer.getvalue()

        lambda_client.create_function(
            FunctionName="EnumerateResources",
            Runtime="python3.9",
            Role="arn:aws:iam::000000000000:role/dummy-role",
            Handler="lambda.handler",
            Code={"ZipFile": dummy_zip},
            Environment={
                "Variables": {
                    "STAGE3_FLAG": flags["stage3"],
                    "DESCRIPTION": "This function handles resource enumeration checks. Stage 3 Flag lies here."
                }
            }
        )
    except Exception as e:
        print(f"Error creating Lambda function: {e}")

    # Create secret in Secrets Manager containing Stage 5 Flag
    print("Seeding Stage 5 Flag in AWS Secrets Manager")
    try:
        try:
            secretsmanager.delete_secret(SecretId="company/final/flag", ForceDeleteWithoutRecovery=True)
        except Exception:
            pass
        secretsmanager.create_secret(
            Name="company/final/flag",
            SecretString=json.dumps({"flag5": flags["stage5"]})
        )
    except Exception as e:
        print(f"Error seeding Secrets Manager secret: {e}")

    # Save connection info and resource names for backend/frontend
    config_info = {
        "public_bucket": public_bucket_name,
        "restricted_bucket": restricted_bucket_name,
        "developer_access_key": access_key,
        "developer_secret_key": secret_key,
    }
    with open("config.json", "w") as f:
        json.dump(config_info, f)

    print("Seeding complete!")

if __name__ == "__main__":
    seed()
