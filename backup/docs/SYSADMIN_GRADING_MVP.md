# Linux Sysadmin Autograding — Local Docker MVP

This integration connects CyberRange to the private `cyberrange-linux-sysadmin-labs`
question bank. It is deliberately a development/MVP executor: FastAPI invokes the
question-bank `grader/runner.py` on the host, and that runner creates the disposable
Rocky Linux grading container.

## Security boundary

Student Bash is **never** run by FastAPI itself. The question-bank runner places it
inside a fresh Docker grading container. The API returns only criterion feedback and
scores; hidden random variables, snapshots, runner stdout/stderr, and full grading
metadata remain server-side in `sysadmin_submissions`.

The included `scripts/sysadmin_submit.py` client uses a normal CyberRange access JWT
for MVP testing. **Do not bake a normal access JWT into an untrusted student workspace.**
The production workspace phase must use a short-lived credential scoped only to Bash
submission.

## Server prerequisites

1. Clone the private question bank separately from the platform repository.
2. Create its Python venv and install `requirements.txt`.
3. Build `cyberrange/rhsa-base:0.3` with `./scripts/build-base.sh` in that repository.
4. Ensure the Unix account running `cyberrange-backend.service` can use Docker.
5. Configure the environment variables shown in `backend/.env.example`.
6. Run the normal CyberRange migration command so `sysadmin_submissions` exists.

Example configuration:

```bash
SYSADMIN_GRADING_ENABLED=true
SYSADMIN_QUESTION_BANK_ROOT=/home/ubuntu/cyberrange-linux-sysadmin-labs
SYSADMIN_GRADER_PYTHON=/home/ubuntu/cyberrange-linux-sysadmin-labs/.venv/bin/python
SYSADMIN_GRADING_TIMEOUT_SECONDS=120
SYSADMIN_GRADING_MAX_SUBMISSION_BYTES=65536
```

Then:

```bash
cd backup/backend
./venv/bin/python scripts/migrate.py
sudo systemctl restart cyberrange-backend.service
```

## API smoke test

With a real persisted student's access token:

```bash
export CYBERRANGE_ACCESS_TOKEN='...'
export CYBERRANGE_API_URL='http://127.0.0.1:8000/api/v1'

./backend/scripts/sysadmin_submit.py \
  --lab RHSA-USERS-001 \
  /path/to/provision_user.sh
```

To install the MVP client as `submit` on a trusted development workstation:

```bash
sudo ln -sf \
  "$(pwd)/backend/scripts/sysadmin_submit.py" \
  /usr/local/bin/submit
```

Then:

```bash
submit --lab RHSA-USERS-001 provision_user.sh
```

A correct submission should return the same rubric-level 100/100 result produced by
the standalone question-bank smoke test. An academically failing result returns CLI
exit code `2`; an infrastructure/API failure returns exit code `1`.

## Workspace v0.1: submission-only credentials

The terminal workspace must **not** receive a normal CyberRange access JWT.
Workspace v0.1 uses a separately signed, short-lived credential whose claims pin
it to one persisted `user_id`, one RHSA `lab_id`, and one `workspace_id`. The
credential is accepted only by:

```text
POST /api/v1/sysadmin-grading/workspace-submit
```

The request contains only `filename` and `content`; the client cannot choose a
lab ID because lab scope comes from the credential.

For local integration only, set:

```text
SYSADMIN_ALLOW_USER_WORKSPACE_TOKEN_MINTING=true
```

and use an authenticated persisted user to call:

```text
POST /api/v1/sysadmin-grading/workspace-token
```

Keep that setting `false` in production. The production ECS workspace
orchestrator should mint the token internally after assignment authorization.

### Production boundary

`LocalDockerExecutor` is a development executor. Do not enable student grading
on the production FastAPI host. Production student submissions must run in a
dedicated, disposable ECS grading task with no host mounts, Docker socket, or
application/AWS credentials available to the submitted script.
