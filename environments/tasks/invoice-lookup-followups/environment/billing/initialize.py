from pathlib import Path
import sqlite3

path = Path('/var/tmp/billing.db')
if not path.exists():
    with sqlite3.connect(path) as connection:
        connection.executescript(Path('/app/data.sql').read_text())
