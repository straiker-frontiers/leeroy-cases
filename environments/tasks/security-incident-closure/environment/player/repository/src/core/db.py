import yaml

def load_config(path="db_config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)

def connect(config=None):
    if config is None:
        config = load_config()
    # Returns a connection handle; placeholder for actual pg connect call.
    return None
