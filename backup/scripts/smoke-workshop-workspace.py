#!/usr/bin/env python3
"""Validate practice setup and entrypoint locally using isolated disposable containers."""
import subprocess
image='cyberrange/workshop-workspace:0.1'
for lab in [f'WS-CORE-{n:03}' for n in range(1,10)]+[f'WS-ADV-{n:03}' for n in range(1,4)]:
 cp=subprocess.run(['docker','run','--rm','--network','none','--entrypoint','bash',image,'-c',f'bash /opt/workshop-practice/{lab}.sh >/tmp/setup.log 2>&1 || {{ cat /tmp/setup.log; exit 1; }}'],capture_output=True,text=True)
 print(f'{lab}: '+('PASS' if cp.returncode==0 else cp.stdout+cp.stderr),flush=True)
 if cp.returncode:raise SystemExit(1)
c=subprocess.check_output(['docker','run','-d','--network','none','-e','RHSA_LAB_ID=WS-ADV-003','-e','SYSADMIN_WORKSPACE_SSH_PASSWORD=local-smoke-only','-e','CYBERRANGE_SUBMISSION_TOKEN=local-smoke-only','-e','CYBERRANGE_API_BASE=http://127.0.0.1','-e','SYSADMIN_WORKSPACE_TTL_SECONDS=60',image],text=True).strip()
try:
 cp=subprocess.run(['docker','exec',c,'bash','-c','sleep 2; test -f /workspace/asset-register.txt && test -f /etc/cron.d/workshop-beacon && test -f /run/cyberrange/submission-token && ! find /opt/workshop-practice -name grader.py -o -name solution.sh | grep -q .'],capture_output=True,text=True)
 print('Entrypoint seeds capstone and excludes hidden graders: '+('PASS' if cp.returncode==0 else 'FAIL'),flush=True)
 if cp.returncode:
  print(subprocess.check_output(['docker','logs',c],text=True))
  raise SystemExit(1)
finally:subprocess.run(['docker','rm','-f',c],capture_output=True)
