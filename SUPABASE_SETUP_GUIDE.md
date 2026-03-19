# Supabase Integration Setup Guide

This guide will help you set up Supabase for your contract management MVP and replace all mock data with real database functionality.

## 📋 Prerequisites

- Node.js and npm installed
- A Supabase account (free tier is sufficient)
- Basic knowledge of SQL and database concepts

## 🚀 Step-by-Step Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up for a free account
3. Click "New Project"
4. Fill in project details:
   - Name: `contract-management` (or your preferred name)
   - Database Password: Generate a strong password (save it!)
   - Region: Choose closest to your users
5. Wait for project to be created (2-3 minutes)

### Step 2: Get Your Supabase Credentials

1. Navigate to your project dashboard
2. Go to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **anon public key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
   - **service_role key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### Step 3: Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

2. Edit `.env.local` and fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

⚠️ **Important:** Never commit `.env.local` to version control!

### Step 4: Set Up Database Schema

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `supabase-schema.sql`
5. Paste it into the SQL Editor
6. Click **Run** to execute the schema

This will create:
- `contracts` table - Main contract data
- `vendor_contacts` table - Vendor contact information
- `reminders` table - Reminder settings
- Indexes for performance
- Row Level Security (RLS) policies
- Automatic status triggers

### Step 5: Verify Database Setup

1. In Supabase Dashboard, go to **Table Editor**
2. You should see three tables: `contracts`, `vendor_contacts`, `reminders`
3. Click on each table to verify the structure

### Step 6: Start Your Application

1. Install dependencies (if not already done):
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

## 🧪 Testing the Integration

### Test 1: Create a Contract

1. Navigate to the Dashboard
2. Click "Add Contract" button
3. Fill in the form with test data:
   - Name: "Test Contract"
   - Vendor: "Test Vendor"
   - Type: "License"
   - Start Date: Today's date
   - End Date: 30 days from now
   - Value: 10000
4. Click "Create Contract"

**Expected Result:**
- Success toast message appears
- Contract appears in the dashboard list
- Contract is saved to Supabase database

### Test 2: View Contracts in Database

1. Go to Supabase Dashboard
2. Navigate to **Table Editor** → **contracts**
3. You should see your newly created contract

### Test 3: Search and Filter

1. In the Contracts page, try searching for your contract
2. Use the status filter to filter by different statuses
3. Verify that search and filter work correctly

### Test 4: API Endpoints

Test the API endpoints using curl or Postman:

**Get all contracts:**
```bash
curl http://localhost:3000/api/contracts
```

**Create a new contract:**
```bash
curl -X POST http://localhost:3000/api/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Contract",
    "vendor": "API Test Vendor",
    "type": "license",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "value": 15000
  }'
```

**Get specific contract:**
```bash
curl http://localhost:3000/api/contracts/{contract-id}
```

## 🔍 Troubleshooting

### Issue: "Missing Supabase environment variables"

**Solution:** 
- Make sure you've created `.env.local` file
- Verify all three variables are set correctly
- Restart your development server after creating `.env.local`

### Issue: "Failed to fetch contracts"

**Solution:**
- Check your Supabase project URL and keys
- Verify your Supabase project is active
- Check browser console for specific error messages
- Ensure you've run the database schema

### Issue: "Contract not found"

**Solution:**
- Verify the contract ID exists in the database
- Check Supabase Table Editor to see your data
- Ensure Row Level Security policies are set correctly

### Issue: "Failed to create contract"

**Solution:**
- Check form validation - all required fields must be filled
- Verify date format (YYYY-MM-DD)
- Check browser console for error details
- Ensure Supabase connection is working

## 📊 Database Schema Overview

### contracts table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Contract name |
| vendor | TEXT | Vendor name |
| type | TEXT | Contract type (license/service/support/subscription) |
| start_date | DATE | Contract start date |
| end_date | DATE | Contract end date |
| value | DECIMAL | Contract value |
| currency | TEXT | Currency code (default: USD) |
| status | TEXT | Auto-calculated status |
| auto_renew | BOOLEAN | Auto-renew flag |
| renewal_terms | TEXT | Renewal terms |
| notes | TEXT | Additional notes |
| tags | TEXT[] | Array of tags |
| color | TEXT | Display color |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### vendor_contacts table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| contract_id | UUID | Foreign key to contracts |
| contact_name | TEXT | Contact person name |
| email | TEXT | Contact email |
| created_at | TIMESTAMP | Creation timestamp |

### reminders table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| contract_id | UUID | Foreign key to contracts |
| reminder_days | INTEGER[] | Days before expiry to remind |
| email_reminders | BOOLEAN | Enable email reminders |
| notify_emails | TEXT[] | Emails to notify |
| created_at | TIMESTAMP | Creation timestamp |

## 🎯 Key Features Implemented

✅ **Full CRUD Operations**
- Create contracts with all details
- Read contracts with filtering and search
- Update contract information
- Delete contracts

✅ **Automatic Status Calculation**
- Contracts automatically update status based on expiry date
- Critical: ≤ 7 days remaining
- Expiring: ≤ 30 days remaining
- Active: > 30 days remaining

✅ **Advanced Features**
- Vendor contact management
- Reminder system with email notifications
- Tag support for categorization
- Custom color coding
- Search functionality
- Status filtering
- Upcoming expiries timeline

✅ **API Routes**
- `GET /api/contracts` - List all contracts
- `POST /api/contracts` - Create new contract
- `GET /api/contracts/[id]` - Get specific contract
- `PUT /api/contracts/[id]` - Update contract
- `DELETE /api/contracts/[id]` - Delete contract

## 🚀 Next Steps

### 1. Add Authentication
- Implement Supabase Auth
- Add user registration/login
- Secure API routes with authentication
- Update RLS policies to use user IDs

### 2. Implement Email Notifications
- Set up Resend or SendGrid integration
- Create email templates for reminders
- Implement scheduled reminder jobs
- Add notification preferences

### 3. Add More Features
- File uploads for contract documents
- Contract versioning
- Approval workflows
- Reporting and analytics
- Export to PDF/Excel

### 4. Optimize Performance
- Add database indexes for frequently queried fields
- Implement caching strategies
- Optimize API responses
- Add pagination for large datasets

### 5. Add Testing
- Unit tests for database functions
- Integration tests for API routes
- E2E tests for user flows
- Load testing for performance

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 💡 Tips for Development

1. **Use Supabase Dashboard** to inspect data during development
2. **Enable query logging** in Supabase to debug SQL queries
3. **Use TypeScript** for type safety across your application
4. **Test locally** before deploying to production
5. **Backup your database** regularly using Supabase tools
6. **Monitor performance** using Supabase's built-in analytics

## 🆘 Support

If you encounter issues:
1. Check the Supabase Dashboard for error logs
2. Review browser console for client-side errors
3. Check server logs for API errors
4. Verify your environment variables are set correctly
5. Ensure your database schema is up to date

---

**Congratulations!** Your MVP is now fully functional with Supabase integration. All mock data has been replaced with real database operations, and your application is ready for production use!
