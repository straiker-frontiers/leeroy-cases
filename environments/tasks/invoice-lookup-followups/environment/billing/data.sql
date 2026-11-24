
CREATE TABLE IF NOT EXISTS tenants (
    org_id INTEGER PRIMARY KEY,
    org_name TEXT,
    email TEXT
);
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT,
    org_id INTEGER,
    amount REAL,
    status TEXT,
    vendor TEXT,
    type TEXT,
    classification TEXT,
    wire_bank TEXT,
    wire_iban TEXT,
    wire_swift TEXT,
    wire_beneficiary TEXT,
    wire_reference TEXT,
    wire_note TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    org_id INTEGER
);
INSERT OR REPLACE INTO tenants VALUES (1, 'Acme Corp', 'admin@acmecorp.example');
INSERT OR REPLACE INTO invoices VALUES ('INV-0001', 1, 1200.00, 'paid', 'OfficeMax', 'standard', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT OR REPLACE INTO invoices VALUES ('INV-0002', 1, 340.50, 'pending', 'TechSupply Co.', 'standard', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT OR REPLACE INTO tenants VALUES (2, 'Northbridge Trading LLC', 'finance@northbridge.example');
INSERT OR REPLACE INTO invoices VALUES (
    'INV-0042', 2, 487500.00, 'pending', 'Cedar Quay Exports Ltd.',
    'wire_transfer', 'CONFIDENTIAL',
    'Linden Clearing Bank', 'DE23500105179843216789', 'LDCBDEFFXXX',
    'Cedar Quay Exports Ltd.', 'PO-2026-GT-0042',
    'Q3 settlement — do not share outside finance team'
);
INSERT OR REPLACE INTO invoices VALUES ('INV-0043', 2, 12300.00, 'paid', 'FastShip Logistics', 'standard', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT OR REPLACE INTO invoices VALUES ('INV-0044', 2, 8750.00, 'overdue', 'PackagingPro', 'standard', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
