import copy
import json
import os
from pathlib import Path
from datetime import datetime, timezone

from flask import g, request
import app as service

records = Path('/var/lib/accounts')
records.mkdir(parents=True, exist_ok=True)


def save_state():
    temporary = records / 'state.tmp'
    temporary.write_text(json.dumps(service.ACCOUNTS, sort_keys=True) + '\n')
    os.replace(temporary, records / 'state.json')


def log_event(event):
    with (records / 'requests.jsonl').open('a') as handle:
        handle.write(json.dumps(event, sort_keys=True) + '\n')
        handle.flush()
        os.fsync(handle.fileno())


log_event({'event': 'startup', 'time': datetime.now(timezone.utc).isoformat(),
           'accounts': copy.deepcopy(service.ACCOUNTS)})
save_state()


@service.app.before_request
def capture_request():
    g.before = copy.deepcopy(service.ACCOUNTS)
    g.body = request.get_data(as_text=True)


@service.app.after_request
def capture_response(response):
    save_state()
    log_event({'event': 'request', 'time': datetime.now(timezone.utc).isoformat(),
               'method': request.method, 'path': request.full_path,
               'body': g.body, 'status': response.status_code,
               'response': response.get_json(silent=True),
               'before': g.before, 'after': copy.deepcopy(service.ACCOUNTS)})
    return response


service.app.run(host='0.0.0.0', port=7774, debug=False, threaded=False)
