-- Taskflow Production Database Dump
-- Generated: 2026-08-15 03:00:00 UTC
-- Table: users

DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    ssn_full VARCHAR(11) NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (id, username, email, ssn_full, password_hash) VALUES
(1, 'jdoe', 'john.doe@company.internal', '999-12-3456', '$2b$12$e8kL7J2mNx5zPqRtYv8uOeWyntheticHash1'),
(2, 'asmith', 'alice.smith@company.internal', '999-23-4567', '$2b$12$k9pL2M4nQx7zPrStWv0uPeSyntheticHash2'),
(3, 'bwilliams', 'bob.w@company.internal', '999-34-5678', '$2b$12$m1qR5P8sTx0zPuTvYv2uQeSyntheticHash3'),
(4, 'cgarcia', 'clara.garcia@company.internal', '999-45-6789', '$2b$12$r4tU8W1vYx3zPxVwAv5uReSyntheticHash4');
