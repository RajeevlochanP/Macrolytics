-- Enable pgcrypto for UUID generation if not using v4 naturally
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Health Goals Table
CREATE TABLE IF NOT EXISTS health_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    daily_calorie_target INTEGER NOT NULL,
    protein_grams INTEGER NOT NULL,
    carb_grams INTEGER NOT NULL,
    fat_grams INTEGER NOT NULL,
    weight_goal NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_goal UNIQUE (user_id)
);

-- Food Entries Table
CREATE TABLE IF NOT EXISTS food_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_type VARCHAR(50) NOT NULL CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner', 'Snacks')),
    item_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(8,2),
    quantity_unit VARCHAR(50),
    calories INTEGER,
    protein NUMERIC(8,2),
    carbs NUMERIC(8,2),
    fat NUMERIC(8,2),
    micros JSONB,
    image_url TEXT,
    status VARCHAR(20) DEFAULT 'COMPLETED',
    job_id VARCHAR(50),
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices for efficient keyset pagination and retrieval
CREATE INDEX IF NOT EXISTS idx_food_entries_user_logged_at 
ON food_entries (user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_food_entries_user_meal_logged_at 
ON food_entries (user_id, meal_type, logged_at DESC);
