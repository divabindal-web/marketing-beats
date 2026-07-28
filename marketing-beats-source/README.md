# Marketing Beats - Square Yards

A comprehensive Design Operations & Marketing Management tool built for the Square Yards marketing team.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS with dark/light theme
- **Charts**: Chart.js + react-chartjs-2
- **Deployment**: Vercel

## Features

### Design Ops
- **Dashboard** - KPI stats, stage-wise TAT analysis, overdue tracking
- **Social Calendar** - Monthly calendar view with platform filters
- **All Requests** - List, Kanban, and Calendar views with filters
- **Downloads/Uploads** - CSV import/export with template download

### User Management
- 69 team members with role-based permissions
- Role management (Admin, Manager, Designer, Viewer)
- Search, filter, and pagination

### Workflows
- **Graphics/SMG**: Assigned > Content > Design In Progress > Design Done > Ready to Upload > Change Req / Done
- **Video**: Assigned > Planning > Shooting Scheduled > Shoot Done > Editing In Progress > Editing Done > Ready to Upload > Change Req / Uploaded

## Getting Started

### 1. Clone and install
```bash
git clone <your-repo-url>
cd marketing-ops
npm install
```

### 2. Set up Supabase
1. Create a project at supabase.com
2. Run `supabase/schema.sql` in the SQL Editor
3. Run `supabase/seed.sql` to load 69 team members
4. Copy your project URL and keys

### 3. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

### 4. Run locally
```bash
npm run dev
# Open http://localhost:3000
```

### 5. Deploy to Vercel
1. Push to GitHub
2. Import into Vercel
3. Add environment variables
4. Deploy

## Project Structure
```
src/app/           - Pages (dashboard, requests, calendar, downloads, user-management, auth)
src/components/    - Reusable components (layout, modals, panels)
src/lib/           - Supabase clients, sample data
src/types/         - TypeScript types and workflow constants
supabase/          - Database schema and seed SQL
```
