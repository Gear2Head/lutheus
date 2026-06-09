/**
 * Lutheus Database Schema v2
 * 
 * This file documents the database schema for the Lutheus Ceza Rapor system.
 * All tables should be created in the Supabase project with the following structure.
 */

/**
 * STAFF Table
 * Stores information about moderation staff members
 */
export interface StaffRecord {
  id: string;                    // Unique identifier (Discord ID or UUID)
  user: string;                  // Staff member username/display name
  username?: string;             // Alternative username field
  avatar: string;                // URL to avatar image
  avatar_url?: string;           // Alternative avatar URL field
  total: number;                 // Total moderation actions taken
  correct: number;               // Number of correct moderation decisions
  incorrect: number;             // Number of incorrect moderation decisions
  accuracy: number;              // Accuracy percentage (0-100)
  status: string;                // Status: 'GÜVENİLİR', 'İZLEMEDE', 'RİSKLİ'
  role: string;                  // Role: 'KURUCU', 'YÖNETİCİ', 'GENEL SORUMLU', 'KIDEMLİ MODERATÖR', 'DISCORD MODERATÖR', 'DENEME DESTEK'
  role_group?: string;           // Role group: 'ACTIVE', 'INACTIVE'
  roleGroup?: string;            // Alternative role group field
  cuk_score?: number;            // CUK Score (reputation points)
  cukScore?: number;             // Alternative CUK Score field
  created_at?: string;           // When the staff member was added
  updated_at?: string;           // Last updated timestamp
}

/**
 * PENALTIES Table
 * Stores moderation penalty/action logs
 */
export interface PenaltyRecord {
  id: string;                    // Unique case ID
  icon?: string;                 // Penalty type: 'MUTE', 'WARN', 'BAN', 'KICK'
  type?: string;                 // Alternative penalty type field
  avatar?: string;               // URL to target user's avatar
  avatar_url?: string;           // Alternative avatar URL field
  staff: string;                 // Staff member who issued the penalty
  staff_name?: string;           // Alternative staff name field
  reason: string;                // Reason for the penalty
  duration?: string;             // Duration: 'Kalıcı', '7 gün', etc.
  date?: string;                 // Date the penalty was issued
  created_at?: string;           // Timestamp when created
  status: 'DOĞRU' | 'HATALI' | 'İNCELENİYOR';  // Status: Correct, Incorrect, Under Review
  is_warning?: boolean;          // Whether this is a warning
  isWarning?: boolean;           // Alternative warning flag field
  is_active?: boolean;           // Whether the penalty is currently active
  isActive?: boolean;            // Alternative active flag field
  target_user_id?: string;       // Discord ID of the penalized user
  target_user_name?: string;     // Username of the penalized user
}

/**
 * AUDIT_LOGS Table (Optional)
 * For tracking all changes made in the system
 */
export interface AuditLog {
  id: string;
  action: string;
  actor: string;                 // Who made the action
  target: string;                // What was affected
  details: Record<string, any>;  // Additional details
  created_at: string;
}

/**
 * DATABASE SCHEMA SQL (PostgreSQL - for Supabase)
 * 
 * Copy and paste the following SQL into the Supabase SQL editor to create the tables:
 */

export const DATABASE_SCHEMA_V2_SQL = `
-- Staff Table
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  "user" TEXT NOT NULL,
  username TEXT,
  avatar TEXT,
  avatar_url TEXT,
  total INTEGER DEFAULT 0,
  correct INTEGER DEFAULT 0,
  incorrect INTEGER DEFAULT 0,
  accuracy FLOAT DEFAULT 100,
  status TEXT DEFAULT 'GÜVENİLİR',
  role TEXT NOT NULL,
  role_group TEXT DEFAULT 'ACTIVE',
  "roleGroup" TEXT DEFAULT 'ACTIVE',
  cuk_score INTEGER DEFAULT 0,
  "cukScore" INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Penalties Table
CREATE TABLE IF NOT EXISTS penalties (
  id TEXT PRIMARY KEY,
  icon TEXT,
  type TEXT,
  avatar TEXT,
  avatar_url TEXT,
  staff TEXT NOT NULL,
  staff_name TEXT,
  reason TEXT NOT NULL,
  duration TEXT,
  date TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'İNCELENİYOR',
  is_warning BOOLEAN DEFAULT FALSE,
  "isWarning" BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  "isActive" BOOLEAN DEFAULT TRUE,
  target_user_id TEXT,
  target_user_name TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_role_group ON staff(role_group);
CREATE INDEX IF NOT EXISTS idx_penalties_staff ON penalties(staff);
CREATE INDEX IF NOT EXISTS idx_penalties_status ON penalties(status);
CREATE INDEX IF NOT EXISTS idx_penalties_created_at ON penalties(created_at);

-- Enable Real-time subscriptions (run in Supabase UI)
-- ALTER PUBLICATION supabase_realtime ADD TABLE staff;
-- ALTER PUBLICATION supabase_realtime ADD TABLE penalties;
`;

/**
 * SEEDING DATA (Initial Setup)
 * 
 * This data will be used to initialize the tables if they're empty.
 * After the first run, data will be updated through the application UI.
 */
export const INITIAL_STAFF_DATA: StaffRecord[] = [
  {
    id: '1',
    user: 'Gear_Head',
    avatar: 'https://i.ibb.co/3sS1wsh/gearhead-avatar.png',
    total: 145,
    correct: 138,
    incorrect: 7,
    accuracy: 95,
    status: 'GÜVENİLİR',
    role: 'KURUCU',
    roleGroup: 'ACTIVE',
    cukScore: 255
  },
  // Add more staff members here
];

export const INITIAL_PENALTIES_DATA: PenaltyRecord[] = [
  {
    id: '#acZf7HC',
    icon: 'MUTE',
    staff: 'Gear_Head',
    reason: 'Spam ve rahatsız edici davranış',
    duration: 'Kalıcı',
    date: '2024-01-15',
    status: 'DOĞRU',
    isActive: true
  },
  // Add more penalties here
];

/**
 * Setup Instructions:
 * 
 * 1. Copy the SQL schema above
 * 2. Go to Supabase Dashboard > SQL Editor
 * 3. Create a new query and paste the SQL
 * 4. Execute the query
 * 5. Tables will be created with proper structure
 * 6. Data seeding will happen automatically on first app load
 * 
 * Ensuring "No Mock Data" Approach:
 * - All fallback data is only used on initial app startup if tables are empty
 * - After seeding, all data comes from the database
 * - Real-time subscriptions keep data synchronized
 * - No mock data is used in production UI rendering
 */
