# Linux Sysadmin Terminal Workspace v0.2

This is the student-facing terminal environment for RHSA Bash assignments. It is
separate from the disposable grading image.

The workspace deliberately contains only a **submission-only** credential. The
credential is pinned to one persisted CyberRange user and one RHSA question-bank
lab and is signed with a key separate from normal CyberRange access JWTs.

## Local integration test

Build the image:

```bash
./scripts/build-sysadmin-workspace.sh
```

For local development, enable the temporary user self-mint bridge in
`backend/.env`:

```text
SYSADMIN_ALLOW_USER_WORKSPACE_TOKEN_MINTING=true
```

Using a normal local CyberRange access token, mint a workspace credential:

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/sysadmin-grading/workspace-token \
  -H "Authorization: Bearer $CYBERRANGE_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"lab_id":"RHSA-USERS-001"}'
```

Export only the returned `token` as `CYBERRANGE_SUBMISSION_TOKEN`, then run:

```bash
docker run --rm -it \
  -e CYBERRANGE_API_BASE=http://host.docker.internal:8000 \
  -e CYBERRANGE_SUBMISSION_TOKEN="$CYBERRANGE_SUBMISSION_TOKEN" \
  -v "$HOME/Desktop/sysadmin/linux-sysadmin-autograder/examples:/home/student/examples:ro" \
  cyberrange/rhsa-workspace:0.2
```

Inside the container:

```bash
submit examples/student_good.sh
```

No `--lab` argument is accepted: lab scope comes from the workspace credential.

## Production rule

Keep `SYSADMIN_ALLOW_USER_WORKSPACE_TOKEN_MINTING=false`. The ECS workspace
orchestrator will mint the credential internally after assignment authorization
and inject it only into that student's workspace task.


## Production runtime

Production uses a dedicated ECS Fargate task. The backend injects a random SSH
password and a short-lived, question-scoped submission token. The entrypoint
materializes the submission token into `/run/cyberrange/submission-token`, removes
it from the long-running sshd environment, and exits automatically when the
workspace TTL expires. No AWS task role is assigned to the student container.
