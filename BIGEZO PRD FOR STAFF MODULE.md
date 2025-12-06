# **BIGEZO STAFF MODULE — PRODUCT REQUIREMENTS DOCUMENT (PRD)**

**Version:** 5.0 (Updated for Current App State)
**Module:** STAFF MANAGEMENT, AUTHENTICATION, RBAC, PASSWORD RESET, INTEGRATIONS
**Prepared For:** BIGEZO Platform (Admin, Teachers, Class Teachers, Accountants, IT Staff)
**Prepared By:** G-Realm Studio & Antigravity
**Date:** 2025

---

# **1.0 MODULE OVERVIEW**

The Staff Module manages all school personnel across the multi-tenant BIGEZO School Management System. The module introduces:

*   Full staff lifecycle management
*   Multi-role architecture (Teacher, Accountant, etc.)
*   Multi-tenant staff isolation (One Staff = One School)
*   Secure authentication (Google login & Password login)
*   SMTP-based password recovery
*   Assignment of teachers & class teachers
*   Accountant access rules
*   IT/Admin-lite integrations management
*   Full audit logging
*   **Global Backblaze storage integration** (Folder-based isolation per school)

This PRD defines every system behavior: database, backend, UI/UX, security, validation, flows, errors, performance, notifications, and deployment.

---

# **2.0 BUSINESS OBJECTIVES**

1.  Provide a secure, role-based staff system separate from School Admins.
2.  Allow staff to log in via **Google Sign-in** and **Password Login**.
3.  Provide staff access to only what they need based on role.
4.  Allow teachers and class teachers to enter and view marks.
5.  Allow bursars to manage fees without touching student CRUD.
6.  Allow IT/Admin-Lite staff to configure integrations without exposing sensitive data.
7.  Maintain strict multi-tenant separation for all staff.
8.  Provide scalable foundation for future staff submodules.

---

# **3.0 STAFF ROLES (RBAC)**

## **3.1 School Admin (Existing `users` table)**
*   **Owner** of the school account.
*   Full permissions.
*   Manages all staff.
*   Exclusive rights to student CRUD.
*   *Note: This role is managed via the existing `users` table.*

## **3.2 Staff Roles (New `staff` table)**

| Role | Description | Permission Level |
| :--- | :--- | :--- |
| **Teacher** | Handles assigned subjects & enters marks | Academic Limited |
| **Class Teacher** | Oversees entire class, views all subject results | Academic Elevated |
| **Accountant** | Handles fees, balances, payments | Finance |
| **IT (Admin-Lite)** | Manages integrations, logs, system config | Admin-lite |
| **Canteen** | Future module | Restricted |
| **Other** | Secretaries, security, support staff | Restricted |

---

# **4.0 MULTI-TENANCY RULES**

*   **One Staff = Exactly One School**.
*   Staff accounts are strictly scoped to a single `school_id`.
*   Cross-school visibility is strictly blocked.
*   All staff queries must filter by `school_id`.
*   **Email Uniqueness**: Staff emails should be unique **globally** to simplify login (or at least unique per school with School ID required at login). *Recommendation: Enforce global uniqueness for simplicity.*

---

# **5.0 DATABASE DESIGN**

## **5.1 `staff` Table**

| Column | Type | Notes |
| :--- | :--- | :--- |
| `staff_id` | UUID / SERIAL | PK |
| `school_id` | INT | FK → `schools(school_id)` |
| `first_name` | VARCHAR(120) | Required |
| `last_name` | VARCHAR(120) | Required |
| `gender` | ENUM('Male','Female') | Required |
| `email` | VARCHAR(200) | Required, Unique (Global or per School) |
| `phone` | VARCHAR(50) | Required |
| `role` | ENUM(...) | Required |
| `photo_url` | TEXT | Nullable (Backblaze URL) |
| `password_hash` | TEXT | Null allowed if Google-only |
| `google_uid` | TEXT | Google Auth UID |
| `allow_password_login` | BOOLEAN | Default true |
| `is_active` | BOOLEAN | Default true |
| `created_at` | TIMESTAMPTZ | Default NOW() |
| `updated_at` | TIMESTAMPTZ | Default NOW() |

## **5.2 `staff_password_resets` Table**

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID / SERIAL | PK |
| `staff_id` | UUID / INT | FK `staff(staff_id)` |
| `token` | VARCHAR(255) | Secure random token |
| `expires_at` | TIMESTAMPTZ | UTC, 15 min lifespan |
| `used` | BOOLEAN | Default false |
| `created_at` | TIMESTAMPTZ | Default NOW() |

## **5.3 Storage (Backblaze)**
*   **No `storagedb` table.**
*   Credentials are managed **globally** via environment variables (`B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET_ID`).
*   Isolation is achieved via **Folder Structure**: `school-{school_id}/staff/...`

## **5.4 `staff_subject_assignments`**
Assign teacher for subjects within class-levels.
| `staff_id` | `class_level_id` | `subject_id` |

## **5.5 `staff_class_assignments`**
Assign class teacher for specific classes.
| `staff_id` | `class_id` |

---

# **6.0 AUTHENTICATION SYSTEM**

Staff may log in via:

### **1) Google Sign-In**
*   Uses Firebase Auth linked to Google identity.
*   Backend verifies email exists in `staff` table.

### **2) Password Login**
*   Email + password (hashed via bcrypt/Argon2).

### **3) Login Flow**
*   **Endpoint**: `/api/v1/auth/staff/login`
*   **Payload**: `{ email, password }` (or `{ idToken }` for Google)
*   **Response**: JWT Token (containing `staff_id`, `school_id`, `role`).

---

# **7.0 LOGIN UI/UX FLOW**

1.  User selects **Staff Login** (distinct from Admin Login).
2.  UI shows:
    *   Continue with Google
    *   Login via Email & Password
3.  On login:
    *   Verify staff exists.
    *   Verify `is_active` is true.
    *   Generate JWT with `school_id` claim.
    *   Redirect to role-based dashboard.

---

# **8.0 PASSWORD RESET (SMTP EMAIL)**

*   **SMTP Config**: Global env vars (already in `config` or `.env`).
*   **Flow**:
    1.  Staff requests reset -> Email sent with token link.
    2.  Link: `https://app.bigezo.com/staff/reset-password?token=xyz`
    3.  Staff enters new password -> Backend updates `password_hash`.

---

# **9.0 ROLE-BASED DASHBOARDS**

## **9.1 Teacher Dashboard**
*   Assigned subjects
*   Marks entry tasks
*   Profile view

## **9.2 Class Teacher Dashboard**
*   Everything in Teacher PLUS:
*   Full class-level academic access (Results, Remarks, Statistics)

## **9.3 Accountant Dashboard**
*   Fee structures, Balances, Payments
*   **Read-only** student biodata.
*   **No** student CRUD.

## **9.4 IT Dashboard (Admin-Lite)**
*   SMS/WhatsApp settings
*   System logs
*   **No** student/staff CRUD.

---

# **10.0 STAFF MANAGEMENT (Admin Only)**

## **10.1 Staff List Page**
*   Filters: Name, Role, Status.
*   Columns: Photo, Name, Email, Role, Status, Actions.

## **10.2 Create Staff**
*   Fields: Name, Gender, Email, Phone, Role.
*   **Photo Upload**: Uploads to `school-{school_id}/staff/{staff_id}/photo.jpg` on Backblaze.

## **10.3 Edit Staff**
*   Modify details, assign subjects/classes.
*   **Email cannot be changed** (to preserve identity).

## **10.4 Deactivation**
*   `is_active = false` prevents login immediately.

---

# **11.0 TEACHER ASSIGNMENT FLOWS**

## **11.1 Assign Subjects**
*   Admin selects Staff -> Class Level -> Subject.
*   Creates `staff_subject_assignments`.

## **11.2 Assign Class Teacher**
*   Admin selects Staff -> Class.
*   Enforces: One Class Teacher per Class.

---

# **12.0 PERMISSIONS MATRIX**

| Feature | Teacher | Class Teacher | Accountant | IT | Admin |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Student CRUD | No | No | No | No | **Yes** |
| Enter Marks | **Yes** | **Yes** | No | No | **Yes** |
| View Class Results | No | **Yes** | No | No | **Yes** |
| Fees Mgmt | No | No | **Yes** | No | **Yes** |
| Staff Mgmt | No | No | No | No | **Yes** |

---

# **13.0 BACKBLAZE PHOTO STORAGE FLOW**

1.  **Service**: `storage.service.ts`
2.  **Credentials**: Loaded from global `.env` (`B2_...`).
3.  **Path**: `school-{school_id}/staff/{staff_id}_{name}.jpg`
4.  **Process**:
    *   Frontend sends file to Backend.
    *   Backend uploads to B2.
    *   Backend saves public URL to `staff.photo_url`.

---

# **14.0 API SPECIFICATIONS**

## **Auth**
*   `POST /auth/staff/login`
*   `POST /auth/staff/google`
*   `POST /auth/staff/forgot-password`
*   `POST /auth/staff/reset-password`

## **Staff CRUD**
*   `POST /staff` (Create)
*   `GET /staff` (List)
*   `GET /staff/:id` (Detail)
*   `PUT /staff/:id` (Update)
*   `DELETE /staff/:id` (Deactivate/Delete)

## **Assignments**
*   `POST /staff/:id/assignments/subjects`
*   `POST /staff/:id/assignments/class`

---

# **15.0 DEPLOYMENT REQUIREMENTS**

### **Database Migrations**
*   Create `staff` table.
*   Create `staff_password_resets` table.
*   Create `staff_subject_assignments` table.
*   Create `staff_class_assignments` table.
*   *Note: `storagedb` is NOT needed (using global env).*

### **Environment Variables**
*   Ensure `B2_BUCKET_NAME`, `B2_REGION`, etc., are set.
*   Ensure `SMTP_HOST`, `SMTP_USER`, etc., are set.
