#!/usr/bin/env python3
"""Build a student image with practice setup only; never include graders or answers."""
import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
import shlex
import yaml

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--question-bank', type=Path, required=True)
parser.add_argument('--image', default='cyberrange/workshop-workspace:0.1')
parser.add_argument('--prepare-only', type=Path, help='Write build context without invoking Docker')
args = parser.parse_args()
bank = args.question_bank.resolve()
sys.path.insert(0, str(bank))
from grader.runner import generate_variables


def prepare(target):
    shutil.copytree(ROOT/'labs/linux-sysadmin-workspace/bin', target/'bin')
    practice = target/'practice'
    practice.mkdir()
    course = yaml.safe_load((bank/'workshop.course.yaml').read_text())
    for item in course['schedule']:
        lab = bank/'labs/13-workshop'/item['id']
        meta = yaml.safe_load((lab/'lab.yaml').read_text())
        values = generate_variables(meta.get('variables', {}), 424242)
        content = '#!/usr/bin/env bash\nset -euo pipefail\n'
        content += ''.join(f'export {k}={shlex.quote(str(v))}\n' for k,v in values.items())
        content += (lab/'setup.sh').read_text()
        (practice/(item['id']+'.sh')).write_text(content)
    entry = target/'bin/workspace-entrypoint'
    s = entry.read_text()
    marker = "printf '%s:%s\\n' student"
    setup = '''# Only workshop setup packages are present in this student image.
case "${RHSA_LAB_ID:-}" in
  WS-CORE-00[1-9]|WS-ADV-00[1-3])
    bash "/opt/workshop-practice/${RHSA_LAB_ID}.sh" > /var/log/workshop-practice-setup.log 2>&1
    ;;
  *) echo "Unknown workshop lab" >&2; exit 2 ;;
esac

'''
    s=s.replace(marker,setup+marker)
    entry.write_text(s)
    (target/'Dockerfile').write_text('''FROM cyberrange/rhsa-workspace:0.4
USER root
RUN dnf -y install cronie rpm-build && dnf clean all
COPY bin/ /usr/local/bin/
COPY practice/ /opt/workshop-practice/
RUN chmod 0755 /usr/local/bin/submit /usr/local/bin/workspace-entrypoint
ENTRYPOINT ["/usr/local/bin/workspace-entrypoint"]
''')

if args.prepare_only:
    args.prepare_only.mkdir(parents=True, exist_ok=True)
    prepare(args.prepare_only)
else:
    with tempfile.TemporaryDirectory(prefix='workshop-build-') as tmp:
        prepare(Path(tmp))
        subprocess.run(['docker','build','-t',args.image,tmp],check=True)
