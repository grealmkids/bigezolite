# BigezoLite - Product Features Documentation

**Version**: 2.0  
**Last Updated**: October 2025  
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Authentication & Multi-School Management](#authentication--multi-school-management)
4. [Student Management](#student-management)
5. [Fees Management](#fees-management)
6. [SMS Communications](#sms-communications)
7. [Fees Reminder System](#fees-reminder-system)
8. [Subscription Management](#subscription-management)
9. [User Interface](#user-interface)
10. [Technical Architecture](#technical-architecture)

---

## Overview

BigezoLite is a comprehensive school management system designed for educational institutions in Uganda. It provides multi-school support, student and fees tracking, SMS communications with integrated reminders, and subscription-based access control.

### Key Highlights
- **Multi-school architecture** with complete data isolation
- **SMS integration** with EgoSMS provider
- **Automated fees reminders** (individual and bulk campaigns)
- **Real-time balance tracking** for SMS credits
- **Subscription-based** account management
- **Mobile-responsive** Angular UI with Material Design

---

## Core Features

### 1. Multi-School Support
- Single user can manage multiple schools
- Each school has isolated student and fee data
- School-specific SMS credentials
- Independent subscription status per school
- Automatic school selection (most recently created)
- Manual school switching capability

### 2. Data Isolation
- All student records scoped by `school_id`
- Backend validates user access to requested school
- Explicit `schoolId` parameter in all student API calls
- Prevents cross-school data leaks

### 3. School Types Supported
- Nursery School / Kindergarten
- Primary School (Local)
- Primary School (International - PYP)
- Secondary School (O-Level)
- Secondary School (A-Level)
- Secondary School (IB DP)

Each school type has predefined class structures managed by `ClassCategorizationService`.

---

## Authentication & Multi-School Management

### User Authentication
- **Email/phone + password** login
- **Google OAuth** integration
- JWT token-based authentication (HS256)
- Secure password hashing
- Token stored in localStorage

### School Selection
- Users with multiple schools see most recent school by default
- "Change School" button in sidenav
- School information displayed: name, status, admin phone
- Selected school stored in localStorage
- Real-time school switching without logout

### Account Status States
- **Dormant**: Initial state, allows operations
- **Active**: Paid subscription, full access
- **Suspended**: Payment overdue, blocks operations

---

## Student Management

### Student Records
Each student record contains:
- Registration number (unique)
- Student name
- Class name (validated against school type)
- Year enrolled
- Student status (Active, Inactive, Expelled, Alumni, Suspended, Sick)
- Fees status (Paid, Defaulter, Pending)
- Parent/guardian details:
  - Primary contact name
  - SMS phone number
  - Mother's name (optional)
  - Father's name (optional)
- Residence district

### Student Operations
- **Create**: Add new student with validation
- **Read**: View student list with filters
- **Update**: Edit student details via modal
- **Delete**: Remove student (cascades to fees)
- **Search**: Filter by name, class, status
- **Export**: Generate reports (planned)

### Student Modal Features
- Form validation (required fields, phone format)
- Real-time error messages
- Success notifications (green snackbar)
- Class dropdown based on school type
- Auto-population of school context

---

## Fees Management

### Fee Records Structure
- **Term-based tracking**: Terms 1, 2, 3
- **Year**: Academic year
- **Total fees due**: Amount expected
- **Amount paid**: Cumulative payments
- **Balance due**: Computed field `(total_fees_due - amount_paid)`
- **Due date**: Payment deadline
- **RSVP number**: School accountant's mobile money number

### Fees Modal (Per Student)
Opens when clicking student row, shows:

1. **Add New Term Record Form**
   - Term selector (1, 2, 3)
   - Year input
   - Total fees due
   - Due date picker
   - RSVP number (pre-filled from school settings)
   - "Add" button

2. **Payment History Table**
   Columns: Term/Year, Total Due, Amount Paid, Balance, Due Date, Actions
   
   **Actions per row:**
   - **Edit button**: Enter edit mode, modify amount paid
   - **📧 Send Reminder button**: Opens reminder preview modal
   - **Save/Cancel buttons**: When editing

3. **Footer**
   - Close button

### Currency Display
- Format: `UGX 540,000` (comma-separated, no decimals)
- Pipe: `currency:'UGX ':'symbol':'1.0-0'`
- Consistent across all fee-related views

---

## SMS Communications

### SMS Provider Integration
- **Provider**: EgoSMS (egosms.co)
- **API**: Plain HTTP GET/POST
- **Authentication**: Username/password per school
- **Balance tracking**: Real-time via API

### SMS Credentials Management
- Stored per school in `sms_credentials` table
- Fields: username, password, provider
- Set via Settings page
- Fallback to environment variables (optional)

### SMS Account Tracking
- `sms_accounts` table tracks provider balance
- Updated on each balance check or send
- Algorithm: `(provider_balance * 10/7)` rounded to nearest 10
- Transaction log in `sms_transactions` table

### SMS Operations

#### 1. Check Balance
- **UI**: "Check Balance" button in sidenav
- **Icon**: Wallet + SMS combined icon
- **Endpoint**: `GET /api/v1/communications/credits`
- **Display**: Green snackbar with balance (e.g., "SMS Balance: UGX 50,000")
- **Error handling**: Red snackbar on failure

#### 2. Send Single SMS
- From student modal: "Send SMS" button
- Opens modal with:
  - Student name
  - Parent phone
  - Message textarea (max 160 chars)
  - Character counter
  - SMS units indicator
- Validates balance before send
- Deducts cost (default 50 UGX per SMS)

#### 3. Send Bulk SMS
- **Page**: Communications (Bulk SMS)
- **Filters**:
  - Recipient class (all or specific)
  - Custom message
- **Process**:
  1. Query students by filter
  2. Check balance (recipients × 50 UGX)
  3. Send to all parent phones
  4. Update balance
  5. Log transaction

---

## Fees Reminder System

**NEW FEATURE** - Automated fees reminder with customized messages

### Individual Fees Reminders

**Access**: From Fees modal → Click "📧 Send Reminder" on any fee record row

**Flow**:
1. Click "Send Reminder" button on fee record
2. Preview modal opens automatically with:
   - Student name
   - Parent phone number
   - **Pre-filled, editable message**:
     ```
     Dear parent of [Student Name], you have so far paid UGX [Total Paid]. 
     Kindly pay the remaining School fees balance of UGX [Balance] before [Due Date].
     ```
   - Character counter (e.g., "165 / 160 characters")
   - SMS units indicator (e.g., "Consumes 2 SMS credits")
3. User can edit message if needed
4. Click "📤 Send" to deliver
5. Green success snackbar on completion

**Message Calculation**:
- **Total Paid**: Sum of `amount_paid` from **all** fee records for student
- **Balance**: Sum of `balance_due` from **all** fee records
- **Due Date**: Uses `due_date` from the selected fee record
- **Date Format**: DD-MMM-YYYY (e.g., "17-Apr-2025")
- **Currency Format**: UGX with commas, no decimals (e.g., "UGX 540,000")

**Example Message**:
```
Dear parent of Aisha Mohammed, you have so far paid UGX 68,300. Kindly pay the remaining School fees balance of UGX 31,700 before 29-Oct-2025.
```

### Bulk Fees Reminders

**Access**: Sidenav → "Bulk Fees Reminders"

**Page Layout**: Settings Form → Preview Analytics → Send

#### Step 1: Configure Campaign Settings
Form fields:
- **💰 Minimum Balance Threshold** (default: 1000 UGX)
  - Only students with balance ≥ this amount receive reminder
- **📅 Payment Deadline** (optional)
  - If set: all reminders use this deadline
  - If empty: each reminder uses student's individual `due_date`
- **🎓 Filter by Class** (dropdown)
  - "All Students" or specific class
  - Classes populated from school type
- **👤 Filter by Student Status** (dropdown)
  - All Statuses, Active, Inactive, Expelled, Alumni, Suspended, Sick

**Button**: Blue "👁️ Preview Campaign" button

#### Step 2: Preview Analytics (Replaces Form)
Displays:

1. **📊 Analytics Cards Grid**
   - **Recipients**: Count of students matching criteria
   - **Total Balance**: Sum of all outstanding balances
   - **Estimated Cost**: Total SMS cost (recipients × 50 UGX)
   - **Message Length**: Character count and SMS units

2. **📝 Sample Message Box**
   - Shows generated message using first student's data
   - Format identical to individual reminders
   - White background, monospace font, blue left border

3. **👥 Recipients Table**
   - Shows first 10 recipients
   - Columns: Student Name, Phone, Balance
   - Note if more than 10: "...and X more"

4. **Action Buttons** (bottom)
   - **"← Back to Settings"** (Dark Grey #4b5563) - Returns to form without sending
   - **"📧 Send Fees Reminders"** (Green gradient) - Sends to all recipients

#### Step 3: Send Process
- Validates SMS balance
- Generates personalized message for each student
- Sends SMS to all matching students
- Updates SMS account balance
- Logs transaction
- Shows success message with count
- Returns to settings form

**Backend Processing**:
```sql
-- Query students with balance >= threshold
SELECT s.student_id, s.student_name, s.parent_phone_sms,
       COALESCE(SUM(f.balance_due), 0) as balance,
       COALESCE(SUM(f.amount_paid), 0) as amount_paid,
       MIN(f.due_date) as earliest_due_date
FROM students s
LEFT JOIN fees_records f ON s.student_id = f.student_id
WHERE s.school_id = $1
  [AND s.class_name = $2]  -- if class filter
  [AND s.student_status = $3]  -- if status filter
GROUP BY s.student_id
HAVING COALESCE(SUM(f.balance_due), 0) >= $threshold
```

### Character Estimation
- **Typical message**: 160-176 characters
- **90-95% of messages**: 1 SMS unit (≤ 160 chars)
- **5-10% of messages**: 2 SMS units (161-306 chars)
  - Occurs with longer names or larger amounts

### SMS Cost Calculation
- **Cost per SMS**: 50 UGX (configurable via `COST_PER_SMS` env var)
- **Balance check**: Before any send operation
- **Error handling**: Returns 402 if insufficient balance
- **Transaction logging**: All sends recorded in `sms_transactions`

---

## Subscription Management

### Subscription Packages
Located at: **Dashboard → "Buy SMS" Card → "Subscribe" Link**

**Available Packages**:
1. **Silver - 100 SMS**: 35,000 UGX
2. **Gold - 300 SMS**: 100,000 UGX
3. **Platinum - 1000 SMS**: 300,000 UGX

### Order Process
1. User selects package
2. Order created in `orders` table
3. Status: "pending"
4. School admin receives notification with:
   - School name
   - Contact phone
   - Package details
   - Order tracking ID
5. Admin manually activates after payment confirmation

### Account Status Workflow
```
New School → Dormant (operations allowed)
    ↓
Subscribe → Active (full access, SMS enabled)
    ↓
Payment Late → Suspended (operations blocked)
    ↓
Renew → Active
```

### Subscription Middleware
- Checks `account_status` on protected routes
- Case-insensitive comparison
- Only "Suspended" blocks operations
- "Dormant" and "Active" allow access

---

## User Interface

### Theme & Styling
- **Framework**: Angular Material
- **Design**: Material Design principles
- **Colors**:
  - Primary: Purple gradient `#667eea → #764ba2`
  - Success: Green `#10b981`
  - Error: Red `#ef4444`
  - Info: Blue `#3b82f6`
  - Warning: Slate/Grey `#4b5563`

### Responsive Design
- **Desktop**: Full sidebar navigation, card layouts
- **Tablet**: Collapsible sidebar, optimized grids
- **Mobile**: Bottom sheet navigation, stacked forms
- **Breakpoints**: 
  - 768px (tablet)
  - 480px (mobile)

### Navigation Structure

**Sidenav Links**:
1. 🏠 Dashboard
2. 👥 Students
3. 📧 Bulk SMS
4. 🔔 Bulk Fees Reminders (NEW)
5. 💰 Check Balance
6. 💵 Subscription

**Current School Block** (top of sidenav):
- School name
- Account status badge (color-coded)
- "Change" button (swaps school)

### Notification System

**Success Snackbars** (Green background, white text):
- Student created/updated
- Fee record added/updated
- SMS sent successfully
- Balance checked

**Error Snackbars** (Red background, white text):
- Validation errors
- API failures
- Insufficient balance
- Access denied

**Configuration**:
- Duration: 3-5 seconds
- Position: Top center
- Dismissible: "Close" button (white bg, black text)

### Modals

**Student Modal**:
- Full student form
- Validation indicators
- Save/Cancel buttons
- Backdrop click to close

**Fees Modal**:
- Split view: Add form + History table
- In-line editing for amount paid
- Per-row action buttons
- Scrollable for many records

**SMS Modal**:
- Compact form
- Character counter
- Real-time validation
- Send/Cancel buttons

**Fee Reminder Preview Modal** (NEW):
- Student info header
- Editable message textarea
- Character/SMS counter
- Send/Cancel buttons
- Gradient header (purple)

---

## Technical Architecture

### Frontend Stack
- **Framework**: Angular 19 (standalone components)
- **UI Library**: Angular Material
- **State Management**: Service-based (BehaviorSubject)
- **HTTP**: HttpClient with interceptors
- **Routing**: Angular Router with guards
- **Forms**: Reactive Forms (FormBuilder)

### Backend Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 14+
- **Authentication**: JWT (HS256)
- **SMS**: EgoSMS HTTP API

### Database Schema

**Core Tables**:
- `users` - User accounts
- `schools` - School organizations
- `students` - Student records
- `fees_records` - Fee tracking
- `sms_credentials` - SMS provider credentials
- `sms_accounts` - SMS balance tracking
- `sms_transactions` - SMS audit log
- `orders` - Subscription orders

**Key Relationships**:
```
users (1) ─── (many) schools
schools (1) ─── (many) students
students (1) ─── (many) fees_records
schools (1) ─── (1) sms_credentials
schools (1) ─── (1) sms_accounts
schools (1) ─── (many) sms_transactions
```

### API Structure

**Base URL**: `http://localhost:3000/api/v1`

**Endpoints**:
- `/auth/*` - Authentication
- `/schools/*` - School management
- `/students/*` - Student CRUD
- `/fees/*` - Fees records
- `/communications/*` - SMS & reminders
- `/subscription/*` - Subscription orders

**Authentication**: Bearer token in `Authorization` header

### Security Features
- JWT token expiration
- Password hashing (bcrypt)
- SQL injection prevention (parameterized queries)
- CORS configuration
- Environment variable secrets
- Data isolation by school_id
- Access verification on every request

---

## Recent Updates (October 2025)

### ✅ Fees Reminder System
- Individual reminder with editable preview modal
- Bulk reminders with analytics preview
- Custom message generation per student
- Proper currency formatting (commas, no decimals)
- Date format: DD-MMM-YYYY
- Balance threshold filtering
- Class and status filtering
- Optional custom deadline override
- SMS cost calculation and validation

### ✅ UI/UX Improvements
- Settings → Preview → Send flow for bulk reminders
- Dark grey "Back to Settings" button
- Green gradient "Send" button
- Mobile-responsive preview cards
- Character counter and SMS units
- Real-time balance validation
- Success/error snackbar standardization

### ✅ Data Accuracy
- Fixed currency formatting bug (concatenation issue)
- Proper aggregation of total paid/balance from all records
- Correct school_id data isolation
- Database column name fixes (balance_due, student_status)

---

## Roadmap & Future Enhancements

### Planned Features
- [ ] Excel export for student/fee reports
- [ ] SMS scheduling (future date/time)
- [ ] Automated recurring reminders (weekly/monthly)
- [ ] Parent portal (view child's fees, receive notifications)
- [ ] Payment gateway integration (Mobile Money)
- [ ] Multi-language support (English, Luganda, Swahili)
- [ ] Advanced analytics dashboard
- [ ] Fee payment history with receipts
- [ ] Class attendance tracking
- [ ] Grade/report card management

### Technical Debt
- [ ] Add comprehensive unit tests (Jest/Jasmine)
- [ ] Implement E2E tests (Playwright/Cypress)
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Implement database migrations tool (TypeORM/Prisma)
- [ ] Add monitoring and logging (Winston/Pino)
- [ ] Implement rate limiting for SMS endpoints
- [ ] Add SMS message templates system
- [ ] Encrypt SMS credentials at rest

---

## Support & Contact

For questions, bug reports, or feature requests:
- **Email**: apps@grealm.org
- **Phone**: +256773913902
- **Product**: A product of **G-Realm Studio**

---

**Document End** - BigezoLite Features v2.0
