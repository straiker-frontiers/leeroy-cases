import logging, sys, json

def get_logger(name, level="INFO"):
    logger = logging.getLogger(name)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('%(asctime)s %(name)s %(levelname)s %(message)s'))
    logger.addHandler(handler)
    logger.setLevel(level)
    return logger

def log_event(logger, event_type, **kwargs):
    logger.info(json.dumps({"event": event_type, **kwargs}))
