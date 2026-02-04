# 🏸Anwesenheits-App (ABC Altach Badminton)

A comprehensive attendance tracking system designed for Badminton training management. Built with React, TypeScript, and Supabase, this application enables coaches to efficiently manage training sessions, track player attendance, and generate detailed statistics.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Database Schema](#database-schema)
6. [Installation & Setup](#installation--setup)
7. [How It Works](#how-it-works)
8. [User Flows](#user-flows)
9. [Component Documentation](#component-documentation)
10. [API Integration](#api-integration)
11. [Development Guide](#development-guide)
12. [Deployment](#deployment)
13. [Future Enhancements](#future-enhancements)

---

## 🎯 Overview

The **Anwesenheits-App** (Attendance App) is a specialized web application for managing Badminton training sessions at ABC Altach. It streamlines the process of:

- Planning future training sessions
- Recording player and coach attendance
- Viewing historical attendance data
- Generating statistics and reports
- Exporting data to Excel for external analysis

The application is designed with a mobile-first approach, ensuring coaches can quickly mark attendance on tablets or smartphones during training sessions.

---

## ✨ Features

### 🏋️ Core Features

1. **Training Planner**
   - Create and schedule future training sessions
   - Assign coaches to specific trainings
   - Edit or delete planned trainings
   - Visual indicators for today's and tomorrow's sessions
   - Quick training creation with optional descriptions

2. **Attendance Tracking**
   - Mark player attendance for today's training
   - Select multiple players at once
   - Assign attending coaches
   - Edit previously recorded attendance
   - Support for spontaneous (unplanned) training sessions
   - Visual feedback with color-coded selections

3. **Attendance History**
   - Browse all past training sessions
   - Filter by date range
   - View detailed attendance for each session
   - Delete outdated records
   - Responsive table layout for mobile devices

4. **Statistics Dashboard**
   - Visual attendance statistics with bar charts
   - Percentage-based attendance rates
   - Color-coded performance indicators (green/blue/yellow/red)
   - Date range filtering
   - Sortable player rankings
   - Mobile-optimized layout

5. **Excel Export**
   - Export complete attendance data
   - Download as `.xlsx` file
   - Includes all trainings with player attendance details
   - Formatted for easy analysis in spreadsheet applications

6. **Player & Coach Management**
   - Add new players and coaches
   - Edit existing records
   - Deactivate (soft delete) instead of permanent deletion
   - Role assignment for coaches

### 🎨 UI/UX Features

- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Intuitive Navigation**: Hamburger menu with easy access to all features
- **Visual Feedback**: Color-coded status indicators and hover effects
- **German Localization**: All text in German (Austria)
- **Loading States**: Clear indicators during data operations
- **Error Handling**: User-friendly error messages

---

## 🛠 Tech Stack

### Frontend

- **React 19.2.0**: UI framework with hooks
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Tailwind CSS 4.x**: Utility-first CSS framework

### Backend & Database

- **Supabase**: Backend-as-a-Service
  - PostgreSQL database
  - Authentication system
  - Real-time subscriptions
  - Row-level security (RLS)

### Build Tools & Linting

- **ESLint 9.x**: Code linting
- **PostCSS**: CSS processing
- **TypeScript Compiler**: Type checking

### Libraries

- **@supabase/supabase-js**: Supabase client library
- **xlsx** (via SheetJS): Excel file generation

---

## 📁 Project Structure

```
anwesenheits-app/
├── public/              # Static assets
├── src/
│   ├── assets/          # Images, fonts, etc.
│   ├── components/      # Reusable components
│   │   └── Icons.tsx    # SVG icon components
│   ├── hooks/           # Custom React hooks
│   │   ├── useAuth.tsx  # Authentication hook
│   │   └── usePlayer.tsx # Player data hook
│   ├── lib/             # External service integrations
│   │   └── supabase.tsx # Supabase client setup
│   ├── pages/           # Page components (views)
│   │   ├── AttendanceHistory.tsx  # View past trainings
│   │   ├── Dashboard.tsx          # Main navigation hub
│   │   ├── EditCoaches.tsx        # Coach management
│   │   ├── EditPlayers.tsx        # Player management
│   │   ├── Login.tsx              # Authentication page
│   │   ├── NewAttendance.tsx      # Record attendance
│   │   ├── NewCoach.tsx           # Add new coach
│   │   ├── NewPlayer.tsx          # Add new player
│   │   ├── Statistics.tsx         # Statistics view
│   │   └── TrainingPlanner.tsx    # Plan future trainings
│   ├── types/           # TypeScript type definitions
│   │   └── interfaces.tsx # Data models
│   ├── App.tsx          # Root component
│   ├── main.tsx         # Application entry point
│   └── index.css        # Global styles
├── eslint.config.js     # ESLint configuration
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── README.md            # This file
```

---

## 🗄️ Database Schema

The application uses **Supabase (PostgreSQL)** with the following tables:

### Tables

#### 1. `players`

Stores player information.

| Column       | Type      | Description              |
| ------------ | --------- | ------------------------ |
| `id`         | UUID (PK) | Unique identifier        |
| `name`       | VARCHAR   | Player's full name       |
| `active`     | BOOLEAN   | Whether player is active |
| `created_at` | TIMESTAMP | Record creation time     |

#### 2. `coaches`

Stores coach information.

| Column       | Type      | Description                        |
| ------------ | --------- | ---------------------------------- |
| `id`         | UUID (PK) | Unique identifier                  |
| `name`       | VARCHAR   | Coach's full name                  |
| `role`       | VARCHAR   | Coach's role (e.g., "Cheftrainer") |
| `active`     | BOOLEAN   | Whether coach is active            |
| `created_at` | TIMESTAMP | Record creation time               |

#### 3. `trainings`

Stores training session information.

| Column        | Type      | Description                   |
| ------------- | --------- | ----------------------------- |
| `id`          | UUID (PK) | Unique identifier             |
| `date`        | DATE      | Training date (YYYY-MM-DD)    |
| `description` | VARCHAR   | Optional training description |
| `created_at`  | TIMESTAMP | Record creation time          |

#### 4. `attendance`

Tracks player attendance at training sessions.

| Column        | Type      | Description               |
| ------------- | --------- | ------------------------- |
| `id`          | UUID (PK) | Unique identifier         |
| `training_id` | UUID (FK) | References `trainings.id` |
| `player_id`   | UUID (FK) | References `players.id`   |
| `is_present`  | BOOLEAN   | Attendance status         |

**Indexes:**

- `training_id` (for fast lookups)
- Composite index on `(training_id, player_id)` for uniqueness

#### 5. `coach_attendance`

Tracks coach attendance at training sessions.

| Column        | Type      | Description               |
| ------------- | --------- | ------------------------- |
| `id`          | UUID (PK) | Unique identifier         |
| `training_id` | UUID (FK) | References `trainings.id` |
| `coach_id`    | UUID (FK) | References `coaches.id`   |
| `is_present`  | BOOLEAN   | Attendance status         |

**Indexes:**

- `training_id` (for fast lookups)
- Composite index on `(training_id, coach_id)` for uniqueness

### Relationships

```
trainings (1) ──→ (N) attendance ──→ (1) players
trainings (1) ──→ (N) coach_attendance ──→ (1) coaches
```

### Row Level Security (RLS)

All tables should have RLS policies configured in Supabase to:

- Allow authenticated users to read all records
- Allow authenticated users to insert/update/delete records
- Prevent public access

---

## 🚀 Installation & Setup

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **pnpm**
- **Supabase Account** (free tier available)
- Modern web browser

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd abc-altach/anwesenheits-app
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Supabase

1. Create a project on [Supabase](https://supabase.com)
2. Create the database tables (see [Database Schema](#database-schema))
3. Set up authentication (email/password)
4. Get your Supabase credentials:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon Public Key**

### Step 4: Update Supabase Configuration

Edit `src/lib/supabase.tsx`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Step 5: Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Step 6: Build for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

---

## 🔄 How It Works

### Application Flow

1. **Authentication**
   - User enters username and password on the Login page
   - Username is automatically appended with `@local.at`
   - Supabase authenticates the credentials
   - On success, user is redirected to Dashboard

2. **Dashboard Navigation**
   - Central hub with a hamburger menu
   - Menu provides access to all features:
     - Neue Anwesenheit (New Attendance)
     - Historie (History)
     - Trainings planen (Training Planner)
     - Excel Export
     - Statistik (Statistics)
     - Neu erstellen (Create New Player/Coach)
     - Daten bearbeiten (Edit Players/Coaches)
     - Logout

3. **Training Planning**
   - Coaches create future training sessions
   - Specify date, description, and assigned coaches
   - Today's and tomorrow's trainings are visually highlighted
   - Trainings can be edited or deleted

4. **Attendance Recording**
   - System checks if a training exists for today
   - If not, user can create a "spontaneous training"
   - Select attending players and coaches
   - Quick actions: "Select All" or "Deselect All"
   - Save attendance to database

5. **Data Persistence**
   - All data is stored in Supabase PostgreSQL
   - Attendance is linked to specific training sessions
   - Players/coaches can be marked as inactive (soft delete)

6. **Statistics Generation**
   - System calculates attendance rates per player
   - Filters data by date range
   - Displays visual bar charts
   - Color codes based on attendance percentage:
     - 🟢 Green: ≥75%
     - 🔵 Blue: 50-74%
     - 🟡 Yellow: 25-49%
     - 🔴 Red: <25%

7. **Excel Export**
   - Fetches all trainings with attendance data
   - Generates Excel file using SheetJS
   - Downloads as `Anwesenheitsliste.xlsx`
   - Includes training date, description, and player names

---

## 👥 User Flows

### Flow 1: Recording Today's Attendance

```
Login → Dashboard → Neue Anwesenheit →
[Check if training exists] →
  ✅ Yes: Select Players & Coaches → Save
  ❌ No: Create Spontaneous Training → Select Players & Coaches → Save
```

### Flow 2: Planning Future Training

```
Login → Dashboard → Trainings planen →
Fill in Date + Description →
Select Coaches (optional) →
Click "Training erstellen" →
Training appears in list
```

### Flow 3: Viewing Statistics

```
Login → Dashboard → Statistik →
[Optional: Set Date Range] →
Click "Filter" →
View attendance rates and bar charts
```

### Flow 4: Exporting Data

```
Login → Dashboard → Excel Export →
Click "Excel herunterladen" →
File downloads automatically
```

### Flow 5: Managing Players

```
Login → Dashboard → Daten bearbeiten →
Select "Spieler bearbeiten" →
Edit player name or deactivate →
Save changes
```

---

## 🧩 Component Documentation

### Core Components

#### `Dashboard.tsx`

**Purpose**: Main navigation hub and view router.

**State Management**:

- `currentView`: Tracks which page to display
- `isMenuOpen`: Controls hamburger menu visibility

**Key Functions**:

- `navigateTo(view)`: Switches between different views
- `handleLogout()`: Signs out user and redirects to login

**Child Components**: Conditionally renders all page components based on `currentView`.

---

#### `NewAttendance.tsx`

**Purpose**: Record attendance for today's training.

**State Management**:

- `todaysTraining`: Stores today's training data
- `players`: List of all active players
- `coaches`: List of all active coaches
- `selectedPlayers`: Set of selected player IDs
- `selectedCoaches`: Set of selected coach IDs
- `isEditing`: Whether editing existing attendance

**Key Functions**:

- `loadTodaysTraining()`: Fetches training for current date
- `createSpontaneousTraining()`: Creates unplanned training
- `saveAttendance()`: Saves/updates attendance records
- `togglePlayer(id)`: Selects/deselects a player
- `selectAll()`: Selects all players
- `deselectAll()`: Deselects all players

**User Experience**:

- If no training exists, shows warning and "Create Spontaneous Training" button
- Color-coded player cards (green when selected, gray when not)
- Dropdown for coach selection
- Large, touch-friendly buttons for mobile use

---

#### `TrainingPlanner.tsx`

**Purpose**: Plan and manage future training sessions.

**State Management**:

- `trainings`: List of upcoming trainings
- `coaches`: List of all active coaches
- `newDate`: Date for new training
- `newDescription`: Description for new training
- `selectedCoachIds`: Array of coach IDs to assign
- `editingId`: ID of training being edited

**Key Functions**:

- `createTraining()`: Creates new training with assigned coaches
- `updateTraining(id)`: Updates training description
- `deleteTraining(id)`: Deletes training and related attendance
- `formatDateGerman(date)`: Formats date with "HEUTE" or "MORGEN" prefix

**Visual Features**:

- Today's training highlighted in red
- Tomorrow's training highlighted in yellow
- Inline editing of descriptions
- Quick delete with confirmation

---

#### `Statistics.tsx`

**Purpose**: Display attendance statistics with visual charts.

**State Management**:

- `stats`: Array of player attendance statistics
- `startDate`: Filter start date
- `endDate`: Filter end date
- `totalTrainings`: Count of trainings in date range

**Key Functions**:

- `loadData()`: Fetches and calculates statistics
- Filters trainings by date range
- Calculates percentage: `(attendanceCount / totalTrainings) * 100`

**Visual Elements**:

- Bar charts showing attendance percentage
- Color-coded based on performance
- Responsive table layout
- Mobile-optimized with reduced padding

---

#### `AttendanceHistory.tsx`

**Purpose**: View and manage past training attendance.

**State Management**:

- `trainings`: List of past trainings with attendance
- `expandedTrainingId`: ID of expanded training (shows details)
- `startDate` / `endDate`: Date range filters

**Key Functions**:

- `loadTrainings()`: Fetches trainings with nested attendance data
- `toggleExpand(id)`: Shows/hides attendance details
- `deleteTraining(id)`: Deletes training record

**Display Logic**:

- Shows training date, description, and attendance count
- Click to expand and see individual player names
- Delete button with confirmation

---

#### `EditPlayers.tsx` / `EditCoaches.tsx`

**Purpose**: Manage player/coach records.

**Key Functions**:

- Load all records (including inactive)
- Update name or role
- Toggle active status (soft delete)
- Real-time updates to database

---

#### `ExcelExport.tsx`

**Purpose**: Export attendance data to Excel.

**Implementation**:

- Uses `xlsx` library (SheetJS)
- Fetches all trainings with player attendance
- Generates worksheet with columns:
  - Training Date
  - Description
  - Player Names (comma-separated)
- Downloads as `Anwesenheitsliste.xlsx`

---

### Utility Components

#### `Icons.tsx`

**Purpose**: Centralized SVG icon components.

**Icons Included**:

- `CalendarIcon`, `CheckIcon`, `XIcon`, `EditIcon`, `TrashIcon`
- `UserIcon`, `FileTextIcon`, `DownloadIcon`, `LogoutIcon`
- `MenuIcon`, `ChartIcon`, `ClipboardIcon`, `PlusIcon`
- `LightbulbIcon`, `SaveIcon`, `WarningIcon`, `CircleIcon`

**Usage**:

```tsx
import { CheckIcon, CalendarIcon } from "../components/Icons";

<CheckIcon size={24} className="text-green-500" />;
```

---

## 🔌 API Integration

### Supabase Client Setup

Located in `src/lib/supabase.tsx`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "YOUR_URL";
const supabaseAnonKey = "YOUR_KEY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Common Queries

#### Fetch All Active Players

```typescript
const { data, error } = await supabase
  .from("players")
  .select("*")
  .eq("active", true)
  .order("name");
```

#### Fetch Training with Attendance

```typescript
const { data } = await supabase
  .from("trainings")
  .select(
    `
    *,
    attendance (
      player_id,
      is_present,
      players ( name )
    )
  `,
  )
  .eq("date", "2026-02-04")
  .single();
```

#### Insert Attendance Records

```typescript
const attendanceData = Array.from(selectedPlayerIds).map((playerId) => ({
  training_id: trainingId,
  player_id: playerId,
  is_present: true,
}));

await supabase.from("attendance").insert(attendanceData);
```

#### Delete with Cascade

```typescript
// First delete related records
await supabase.from("attendance").delete().eq("training_id", id);
await supabase.from("coach_attendance").delete().eq("training_id", id);

// Then delete training
await supabase.from("trainings").delete().eq("id", id);
```

---

## 💻 Development Guide

### Running Locally

```bash
# Start dev server
npm run dev

# Run linter
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

### Code Style

- **TypeScript**: Strict mode enabled
- **React**: Functional components with hooks
- **Naming Conventions**:
  - Components: PascalCase (`NewAttendance.tsx`)
  - Functions: camelCase (`loadData`, `togglePlayer`)
  - Constants: UPPER_SNAKE_CASE
- **Imports**: Absolute paths from `src/`

### Adding a New Feature

1. **Create Component** in `src/pages/`
2. **Define Types** in `src/types/interfaces.tsx`
3. **Add Navigation** in `Dashboard.tsx`
4. **Add Icon** (if needed) in `src/components/Icons.tsx`
5. **Test** with real data in Supabase

### Common Patterns

#### Loading State

```typescript
const [loading, setLoading] = useState(false);

async function fetchData() {
  setLoading(true);
  try {
    const { data } = await supabase.from("table").select();
    // Process data
  } finally {
    setLoading(false);
  }
}
```

#### Form Handling

```typescript
const [value, setValue] = useState('')

<input
  type="text"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

#### Conditional Rendering

```typescript
{loading ? (
  <p>Wird geladen...</p>
) : data.length === 0 ? (
  <p>Keine Daten vorhanden</p>
) : (
  <div>{/* Render data */}</div>
)}
```

---

## 🚢 Deployment

### Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Configure build settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add environment variables (if needed)
4. Deploy

### Deploy to Netlify

1. Connect repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy

### Deploy to Supabase Hosting (if available)

Follow Supabase documentation for static site hosting.

---

## 🔮 Future Enhancements

### Planned Features

1. **Dark Mode**
   - Toggle between light/dark themes
   - Persist preference in localStorage

2. **Role-Based Access**
   - Admin, Coach, and Player roles
   - Restrict features based on role

3. **Notifications**
   - Toast messages for success/error
   - Push notifications for upcoming trainings

4. **Advanced Statistics**
   - Charts with Chart.js or Recharts
   - Player comparison graphs
   - Export statistics to PDF

5. **Mobile App**
   - Progressive Web App (PWA)
   - Offline support with service workers

6. **Multi-Language Support**
   - English, German, Italian
   - i18n integration

7. **Calendar View**
   - Visual calendar for training planning
   - Drag-and-drop rescheduling

8. **Player Profiles**
   - Individual player pages
   - Performance history
   - Personal notes

9. **Automated Reports**
   - Weekly/monthly email summaries
   - Attendance trend analysis

10. **Integration with External Systems**
    - Sync with club management software
    - Import/export to other formats (CSV, JSON)

---

## 📝 License

This project is proprietary software for ABC Altach Badminton.

---

## 🤝 Support

For questions or issues, contact the development team.

---

**Built with ❤️ for ABC Altach Badminton Team**
