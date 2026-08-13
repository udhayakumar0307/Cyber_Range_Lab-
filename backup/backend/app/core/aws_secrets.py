import logging
import json
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# Global cache for secret dicts to avoid redundant network calls
_secrets_cache = {}

def get_secret(secret_id: str, is_optional: bool = False) -> dict:
    """
    Retrieve and parse a JSON secret from AWS Secrets Manager in ap-south-1.
    Uses the EC2 instance profile / default credentials chain automatically.
    Caches results in memory.
    """
    if secret_id in _secrets_cache:
        return _secrets_cache[secret_id]

    try:
        client = boto3.client("secretsmanager", region_name="ap-south-1")
        response = client.get_secret_value(SecretId=secret_id)
        if "SecretString" in response:
            secret_data = json.loads(response["SecretString"])
            if not isinstance(secret_data, dict):
                raise ValueError("Secret data is not a valid JSON object/dictionary.")
            _secrets_cache[secret_id] = secret_data
            logger.info(f"Successfully loaded and cached secret: {secret_id}")
            return secret_data
        else:
            raise ValueError("Secret does not contain SecretString.")
    except ClientError as e:
        if is_optional:
            logger.info(f"Optional secret {secret_id} not available or could not be loaded: {e.response.get('Error', {}).get('Message')}")
            return {}
        else:
            logger.error(f"Failed to retrieve required AWS secret '{secret_id}'.")
            raise RuntimeError(f"Unable to load production secret: {secret_id}") from e
    except Exception as e:
        if is_optional:
            logger.info(f"Optional secret {secret_id} not available or could not be loaded: {e}")
            return {}
        else:
            logger.error(f"Unexpected error loading required AWS secret '{secret_id}': {e}")
            raise RuntimeError(f"Unable to load production secret: {secret_id}") from e
