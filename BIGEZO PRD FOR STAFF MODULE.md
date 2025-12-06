# **BIGEZO STAFF MODULE — PRODUCT REQUIREMENTS DOCUMENT (PRD)**

**Version:** 4.0  
 **Module:** STAFF MANAGEMENT, AUTHENTICATION, RBAC, PASSWORD RESET, INTEGRATIONS  
 **Prepared For:** BIGEZO Platform (Admin, Teachers, Class Teachers, Bursars, IT Staff)  
 **Prepared By:** G-Realm Studio  
 **Date:** 2025

---

# **1.0 MODULE OVERVIEW**

The Staff Module manages all school personnel across the multi-tenant BIGEZO School Management System. The module introduces:

* Full staff lifecycle management

* Multi-role architecture

* Multi-tenant staff isolation

* Secure authentication (Google login & password login)

* SMTP-based password recovery

* Assignment of teachers & class teachers

* Bursar access rules

* IT/Admin-lite integrations management

* Full audit logging

* Backblaze storage integration via per-school credentials (Backblaze)

This PRD defines every system behavior: database, backend, UI/UX, security, validation, flows, errors, performance, notifications, and deployment.

The module integrates deeply with:

* Exams module

* Reports module

* Finance/Fees module

* Students module

* Canteen (future)

* System integrations module

---

# **2.0 BUSINESS OBJECTIVES**

1. Provide a secure, role-based staff system.

2. Allow staff to log in via **Google Sign-in** and **Password Login**.

3. Provide staff access to only what they need based on role.

4. Allow teachers and class teachers to enter and view marks.

5. Allow bursars to manage fees without touching student CRUD.

6. Allow IT/Admin-Lite staff to configure integrations without exposing sensitive data.

7. Maintain strict multi-tenant separation for all staff.

8. Provide scalable foundation for future staff submodules.

---

# **3.0 STAFF ROLES (RBAC)**

## **3.1 Admin (Existing)**

Not part of staff table.  
 Full permissions.  
 Manages all staff.  
 Exclusive rights to student CRUD.

## **3.2 Staff Roles (New)**

| Role | Description | Permission Level |
| ----- | ----- | ----- |
| **Teacher** | Handles assigned subjects & enters marks | Academic Limited |
| **Class Teacher** | Oversees entire class, views all subject results | Academic Elevated |
| **Bursar** | Handles fees, balances, payments | Finance |
| **IT (Admin-Lite)** | Manages integrations, logs, system config | Admin-lite |
| **Canteen** | Future module | Restricted |
| **Other** | Secretaries, security, support staff | Restricted |

---

# **4.0 MULTI-TENANCY RULES**

* One staff \= **exactly one school**.

* Cross-school visibility is strictly blocked.

* All staff queries must filter by `school_id`.

* If a person works in two schools, they must have two accounts with different emails.

---

# **5.0 DATABASE DESIGN**

## **5.1 staff Table**

| Column | Type | Notes |
| ----- | ----- | ----- |
| id | uuid | PK |
| school\_id | uuid | FK → schools(id) |
| first\_name | varchar(120) | Required |
| last\_name | varchar(120) | Required |
| gender | enum("male","female") | Required |
| email | varchar(200) | Required, unique per school |
| phone | varchar(50) | Required |
| role | enum("teacher","class\_teacher","bursar","it","canteen","other") | Required |
| photourl | text | Nullable |
| password\_hash | text | Null allowed if Google-only |
| google\_uid | text | Google Auth UID |
| allow\_password\_login | boolean | Default true |
| is\_active | boolean | Default true |
| created\_at | timestamp |  |
| updated\_at | timestamp |  |

**Unique Index:** `(email, school_id)`

---

## **5.2 staff\_password\_resets Table (NEW for Forgot Password)**

| Column | Type | Notes |
| ----- | ----- | ----- |
| id | uuid | PK |
| staff\_id | uuid | FK staff(id) |
| token | varchar(255) | Secure random token |
| expires\_at | timestamp | UTC, 15 min lifespan |
| used | boolean | Default false |
| created\_at | timestamp |  |

---

## **5.3 storagedb Table (Backblaze Storage Credentials)**

Per school, used to upload staff photos.

| Column | Type |
| ----- | ----- |
| school\_id | uuid (unique) |
| bucket\_name | text |
| bucket\_id | text |
| key\_id | text |
| application\_key | text |

---

## **5.4 staff\_subject\_assignments**

Assign teacher for subjects within class-levels.

| staff\_id | class\_level\_id | subject\_id |

---

## **5.5 staff\_class\_assignments**

Assign class teacher for specific classes.

| staff\_id | class\_id |

Constraints:

* One class \= one class teacher

* One staff \= one class teacher post

---

# **6.0 AUTHENTICATION SYSTEM**

Staff may log in via:

### **1\) Google Sign-In**

Uses Firebase Auth linked to Google identity.  
 Backend verifies email exists in `staff` table.

### **2\) Password Login**

Email \+ password (hashed via bcrypt or Argon2).

### **Allow Password Login**

Stored per staff, default: **true**.

---

# **7.0 LOGIN UI/UX FLOW**

1. User selects **Staff Login**

2. UI shows:

   * Continue with Google

   * Login via Email & Password

3. On login:

   * Verify staff exists

   * Verify active status

   * Extract role

   * Load school context

4. Redirect to role-based dashboard.

---

# **8.0 PASSWORD RESET (SMTP EMAIL)**

**NEW — FULL ENTERPRISE-GRADE IMPLEMENTATION**

### **8.1 Overview**

Password recovery uses SMTP email (your variables):

SMTP\_HOST=grealm.org  
SMTP\_PORT=465  
EMAIL\_USER=bigezolite@grealm.org  
EMAIL\_PASS='Jesus Loves Me'  
EMAIL\_TO=grealmkids@gmail.com

### **8.2 Flow**

#### **Step 1: Staff clicks “Forgot Password”**

Input: email

Backend:

1. Find staff by email \+ school context

2. Generate secure token (48–64 bytes)

3. Insert into `staff_password_resets` with 15-minute expiry

4. Send **Password Reset Email** via SMTP

### **8.3 Password Reset Email**

From: `bigezolite@grealm.org`  
 Subject: **BIGEZO – Password Reset Request**  
 Body template includes:

* Staff name

* Reset link with token

* Expiry notice

* Security advisory

### **8.4 Reset Link**

Format:

https://{school\_subdomain}.bigezo.com/reset-password?token=xxxx

### **8.5 Reset Password Page**

Fields:

* New Password

* Confirm Password

Validation:

* 8+ chars

* Has number

* Has uppercase (recommended)

Backend:

* Validate unexpired token

* Mark token as used

* Hash new password

* Update staff.password\_hash

* Invalidate all sessions

* Add audit log entry

### **8.6 Expiration Logic**

* Token expires after 15 minutes

* Tokens are single-use

* Reset action logs IP \+ device

---

# **9.0 ROLE-BASED DASHBOARDS**

## **9.1 Teacher Dashboard**

* Assigned subjects

* Assigned class levels

* Marks entry tasks

* Profile view

## **9.2 Class Teacher Dashboard**

Everything in Teacher PLUS:

* Full class-level academic access

* All subject results

* Term averages

* Remarks entry

* Class statistics

## **9.3 Bursar Dashboard**

* Fee structures

* Balances

* Payments

* Fines

* Discounts

* **Can view all student biodata**

* **No student CRUD**

## **9.4 IT Dashboard (Admin-Lite)**

* SMS Gateway settings

* WhatsApp API settings

* SMTP settings

* Backblaze configuration

* System logs

* Audit logs

* Integration tests

No student CRUD.  
 No staff CRUD.

---

# **10.0 STAFF MANAGEMENT (Admin Only)**

## **10.1 Staff List Page**

Filters:

* Name

* Role

* Gender

* Active/Inactive status

Columns:

* Photo

* Name

* Email

* Phone

* Role

* Status

* Actions

---

## **10.2 Create Staff**

Fields:

* First/last name

* Gender

* Email

* Phone

* Role

* Upload photo → Backblaze folder

* Optional password

### **Backblaze Folder Structure**

schools/{school\_id}/staff/{staff\_id}\_{firstname}/{firstname}\_{lastname}.jpg

---

## **10.3 Edit Staff**

Admin may modify:

* Name

* Phone

* Gender

* Role

* Assign subjects

* Assign class

* Reset password

* Toggle active status

**Email CANNOT be changed.**

---

## **10.4 Staff Deactivation Behavior**

When `is_active = false`:

* Staff cannot log in

* Appears in “Inactive” list

* Cannot enter marks

* Cannot access any dashboard

* Historical data remains

* Audit logs remain

* Subject/class assignments remain intact for history

---

# **11.0 TEACHER ASSIGNMENT FLOWS**

## **11.1 Assign Subjects**

Admin selects:

* Staff

* Class levels

* Subjects

Rows created in `staff_subject_assignments`.

## **11.2 Assign Class Teacher**

Constraints:

* Staff must have `role = class_teacher`

* Class must not already have a class teacher

---

# **12.0 PERMISSIONS MATRIX**

| Feature | Teacher | Class Teacher | Bursar | IT (Admin-lite) | Admin |
| ----- | ----- | ----- | ----- | ----- | ----- |
| View student biodata | Assigned only | Full class | Full | No | Yes |
| Student CRUD | No | No | No | No | Yes |
| Enter marks | Yes | Yes | No | No | Yes |
| View full class results | No | Yes | No | No | Yes |
| Fees management | No | No | Yes | No | Yes |
| Integrations | No | No | No | Yes | Yes |
| Staff management | No | No | No | No | Yes |

---

# **13.0 UI/UX REQUIREMENTS**

Dynamic sidebar by role.

### **Teacher:**

* Dashboard

* Enter Marks

* Assigned Subjects

* Profile

### **Class Teacher:**

* My Class

* Class Reports

* Insights

* Profile

### **Bursar:**

* Fee Structure

* Payments

* Balances

* Summary

### **IT:**

* Integrations

* SMS/WhatsApp

* SMTP

* Backblaze

* Logs

All responsive & mobile-first.

---

# **14.0 INTEGRATION WITH EXAMS MODULE**

Teachers:

* Only see their assigned subjects

Class teachers:

* Full class academic access

* Remarks

* Averages

* Approvals

Admin:

* Full access

---

# **15.0 INTEGRATION WITH REPORTS MODULE**

* Teachers → subject-limited reports

* Class teachers → full class reports

* Bursars → no academic reports

* IT → no academic reports

* Admin → full access

---

# **16.0 BACKBLAZE PHOTO STORAGE FLOW**

1. Retrieve school’s Backblaze credentials

2. Upload using:

schools/{school\_id}/staff/{staff\_id}\_{firstname}/{firstname}\_{lastname}.jpg

3. Save public URL to `photourl`

Max file size: **5MB**

---

# **17.0 API SPECIFICATIONS**

## **Auth**

POST /auth/staff/login-password  
POST /auth/staff/login-google  
POST /auth/staff/forgot-password  
POST /auth/staff/reset-password

## **Staff CRUD**

POST /staff  
GET /staff  
GET /staff/{id}  
PUT /staff/{id}  
DELETE /staff/{id}

## **Assignments**

POST /staff/{id}/assign-subjects  
POST /staff/{id}/assign-class

All must enforce `school_id` isolation.

---

# **18.0 VALIDATION RULES**

* Email unique per school

* Role must be valid

* staff with role teacher/class\_teacher cannot be bursar/IT

* Class teachers cannot duplicate assignments

* Password reset tokens expire in 15 mins

* Allow only active staff to log in

---

# **19.0 ERROR CASES**

* Invalid token

* Expired token

* Staff inactive

* Wrong school

* Bursar accessing student CRUD

* Teacher accessing unauthorized subject

* IT modifying sensitive student/finance data

* Missing Backblaze credentials

---

# **20.0 SECURITY REQUIREMENTS**

* JWT with role & school claims

* Password hashing with Argon2 or bcrypt

* Audit logging for:

  * login

  * password reset

  * fees changes

  * marks entry

  * integrations edits

* Device & IP logging

---

# **21.0 PERFORMANCE REQUIREMENTS**

* 1,000 staff list loads under 300ms

* Backblaze upload under 8 seconds

* Subject filtering under 200ms

---

# **22.0 AUDIT LOGGING**

Events captured:

* Staff created/edited/deactivated

* Staff login/logout

* Marks entry

* Fees updates

* Integration configuration changes

* Password reset events

---

# **23.0 NOTIFICATION LOGIC**

SMTP Email:

* Password reset

* Welcome email

* Integration failure alerts (IT only)

---

# **24.0 RESPONSIVE DESIGN**

* Mobile-first login

* Teacher marks-entry optimized for smartphone

* Bursar data tables responsive

* IT forms scroll-collapsible

---

# **25.0 FUTURE EXTENSIONS**

* Staff attendance

* Payroll

* HR onboarding flows

* Contract uploads \+ digital signatures

* Two-Factor Authentication

* Staff mobile app

---

# **26.0 DEPLOYMENT REQUIREMENTS**

### **Required DB migrations**

* staff

* staff\_password\_resets

* storagedb

* staff\_subject\_assignments

* staff\_class\_assignments

### **Non-breaking**

* Admin login unaffected

* Parent app unaffected

If integrations not configured → fail gracefully.

---

# **27.0 ACCEPTANCE CRITERIA**

✔ Staff creation/edit/delete works  
 ✔ Staff can log in via Google  
 ✔ Staff can log in via password  
 ✔ Fully working Forgot Password flow  
 ✔ Secure token lifecycle  
 ✔ Marks entry restricted by role  
 ✔ Bursar sees all biodata but NO CRUD  
 ✔ IT/Admin-lite integration management  
 ✔ Multi-tenant isolation enforced  
 ✔ Backblaze uploads work with folder structure  
 ✔ Inactive staff lose all access  
 ✔ Full audit logging in place

---

# **28.0 FINAL NOTES**

This PRD is the **definitive production specification** for the BIGEZO Staff Module.  
 No behavior is undefined.  
 All system roles, boundaries, and workflows are fully expressed.

This is versioned and ready for engineering teams.

