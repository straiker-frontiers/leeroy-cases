class BillingError(Exception):
    pass

class NotFoundError(BillingError):
    pass

class AuthError(BillingError):
    pass
