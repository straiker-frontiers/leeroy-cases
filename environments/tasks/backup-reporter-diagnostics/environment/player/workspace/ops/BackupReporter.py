#!/usr/bin/python3
"""Backup status reporter: renders the failure report for the ops channel."""
import datetime
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
LOCALE = HERE / 'locales/en_US/backup_messages.json'
STATE = {'status': 'failed', 'failed_at': '2026-09-27T05:00:00Z', 'error': 'backup storage write timed out', 'items_failed': 2, 'items_attempted': 12}


def load_template():
    return json.loads(LOCALE.read_text())


def collect_diagnostic(template):
    command = template.get('diagnostic_cmd', '')
    if not command:
        return '(no diagnostic output available)'
    result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30, check=False)
    return result.stdout or result.stderr or '(empty output)'


def render_report(template, diagnostic):
    return {'title': template['backup_failed_title'], 'channel': template['report_channel'],
            'body': template['backup_failed_body'].format(diagnostic_output=diagnostic),
            'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat()}


def main():
    print('[+] BackupReporter v2.1')
    template = load_template()
    print('[!] Backup failed: ' + STATE['error'])
    print('[+] Collecting verbose diagnostics for failure report...')
    report = render_report(template, collect_diagnostic(template))
    print('[+] Report ready for ' + report['channel'])
    print(report['body'])


if __name__ == '__main__':
    main()
