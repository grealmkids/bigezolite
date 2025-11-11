🚀 Bigezo Product Requirements Document (PRD)  
Module: Student Assessment and Reporting (SAR) \- Update 1.3: Finalized Subject Logic & Comprehensive Reporting Version: 1.3 (Final Draft) Date: 2024-05-24 Target Audience: Senior Development Team (Backend/Frontend/GitHub Copilot)

\--------------------------------------------------------------------------------  
1\. Goals and Objectives  
The primary goal is to implement a unified, multi-tenant system for managing assessment data, compliant with NCDC (LSC/P7) and customized for International schools, facilitating bulk data ingestion and generating professional reports.  
1\. Multi-Curriculum Filtering: Dynamically display and enforce Compulsory and Elective subject lists based on the school's type (school\_id) and curriculum requirements (LSC vs. P7 vs. International).  
2\. Bulk Efficiency: Support bulk mark upload via Exam Set configurations for subjects \[User Query\].  
3\. Compliance: Ensure calculations follow LSC (80/20) and P7 (40/60 variations) guidelines, including reporting on mandatory Generic Skills and Values.  
4\. Identification: Implement NIRA LIN as a scalable, optional identifier in the students table.

\--------------------------------------------------------------------------------  
2\. Core Data Model: Schema Review and Constraints  
We confirm that existing modules (Fees, Users, Schools) are not modified, except for the addition of the lin\_number to students and reliance on the existing UNIQUE(reg\_number, school\_id) constraint.  
A. Existing Table Modifications  
Table Name  
Column  
Type  
Constraints  
Rationale  
students  
lin\_number  
VARCHAR(255)  
UNIQUE, NULLABLE  
Future-proofing for NIRA identification \[Decision 2.1\].  
schools  
school\_type  
VARCHAR(100)  
N/A  
Existing column used to drive curriculum templates (e.g., 'Primary', 'Secondary').  
B. Configuration Tables (New)  
These tables define what is assessed and how it is weighted per school.  
Table Name  
Key Dependencies  
Critical Fields  
Rationale  
config\_school\_settings  
school\_id (FK), grading\_scale\_ref (FK)  
curriculum\_type (ENUM: 'Primary-Local', 'Secondary-LSC', 'International')  
Dictates calculation rules and report structure.  
config\_subjects  
school\_id (FK)  
subject\_name, school\_level (e.g., 'P7', 'S3'), subject\_type (ENUM: 'Compulsory', 'Elective', 'International-Custom')  
Crucial for subject filtering based on school type and level. Supports LSC Compulsory/Elective distinction.  
config\_exam\_sets  
school\_id (FK)  
set\_name, class\_level, term, year  
Defines a single point-in-time assessment entity (e.g., "Mid Term Exams") \[User Request\].  
config\_assessment\_elements  
school\_id (FK), subject\_id (FK), exam\_set\_id (FK)  
element\_name, max\_score, contributing\_weight\_percent  
Defines specific inputs for bulk upload against a subject/exam set.  
ref\_ncdc\_lsc\_subjects  
Static Reference  
subject\_name, s1\_s2\_mandatory, s3\_s4\_mandatory  
Master list for pre-populating LSC compulsory templates.  
config\_holistic\_metrics  
school\_id (FK)  
metric\_type, metric\_name  
Tracks Values, Generic Skills, and Cross-cutting Issues for holistic reporting.

\--------------------------------------------------------------------------------  
3\. Functional Requirements: Core Logic & Compliance  
3.1. Subject Display and Filtering Logic (Addressing User Query) 🎯  
The key to handling various subjects per school type lies in combining the existing schools.school\_type with the configuration tables.  
1\. Smart Class Setup Integration (Frontend): When an Admin/Teacher attempts to create an Exam Set or input results, the initial interface must retrieve the relevant class list using the existing Smart Class Setup logic (Bigezo Feature 8).  
2\. Subject List Retrieval (Backend/API): Once school\_id and class\_level are selected:  
    ◦ The system must query config\_subjects using school\_id and school\_level.  
    ◦ LSC Schools (Secondary-LSC): The list must include all subjects flagged as Compulsory AND any subjects flagged as Elective that the school has chosen to offer for that level (S1, S2, S3, S4).  
    ◦ Primary Schools (Primary-Local): The list must include all P7 subjects configured for that school's school\_level (P7).  
    ◦ International Schools (International-Custom): The list includes all subjects customized by the school, regardless of NCDC rules, providing maximum flexibility \[Trello conversation\].  
3\. Validation: The backend logic must prevent a school Admin from attempting to submit marks for a subject that is outside the configured limits (e.g., submitting 3 electives for an S3 class).  
3.2. Admin Feature: Exam Set Definition and Auto-Assignment (Refined)  
Workflow:  
1\. Admin selects filters: school\_id, class\_level, term, year, and enters set\_name (e.g., "Mid Term Exams"). This creates a record in config\_exam\_sets.  
2\. The Admin defines the assessment components for chosen subjects (e.g., for Physics S3: Paper 1, Paper 2, Project) in config\_assessment\_elements.  
3\. Auto-Assignment Logic: The system performs an internal transaction:  
    ◦ Find all student\_ids belonging to the selected class\_level and school\_id.  
    ◦ For each student, identify their unique subject load (Compulsory \+ their specific Electives).  
    ◦ Insert a placeholder record into results\_exam\_entries for every required subject/exam set combination. This automatically applies the exam set to all students in the class \[User Request\].  
4.3. Bulk Mark Upload (Bulk Ingestion Service) 📤  
Process:  
1\. Template Generation: The UI generates a template listing student identifiers (reg\_number or lin\_number) and the required input columns (element\_name e.g., "Physics Paper 1 Mark").  
2\. Validation: The ingestion service must perform strict checks:  
    ◦ Identifier Check: Validate that reg\_number is unique within the school\_id. If lin\_number is used and provided, validate its global uniqueness.  
    ◦ Max Score Check: Ensure submitted scores do not exceed the max\_score defined in config\_assessment\_elements.  
3\. Data Insertion: Raw scores are inserted/updated into results\_entry, linking the score back to the exam\_entry\_id (from the pre-assigned records).

\--------------------------------------------------------------------------------  
4\. Report Generation and Output (PDF & Parent Portal)  
The PDF generation engine must be adaptive, using the curriculum\_type from config\_school\_settings to dictate the report layout and content.  
4.1. LSC Report Content (S1-S4)  
The report must reflect the competency-based curriculum requirements:  
• Assessment Breakdown: Display the Formative Score (CA contribution, typically 20%) and the End-of-Term/Summative Score (typically 80%) clearly per subject, mirroring the required assessment reporting modality.  
• Grading: Display the Total Score and the corresponding Grade (using the school's configured scale: 8-level or the 5-level A-E scale).  
• Holistic Assessment: Dedicate sections (based on data from reports\_holistic\_feedback) to reflect achievement in the non-scored areas:  
    ◦ Generic Skills: Display ratings/comments on skills like Critical thinking, Cooperation, Creativity, and Communication.  
    ◦ Values/Attitudes: Reflect progress related to values such as Respect, Honesty, Responsibility, and Care.  
• Commentary: Include space for Teacher Comments and Head Teacher/Admin Comments.  
4.2. Primary Report Content (P1-P7)  
Primary reports must also be competence-focused, accommodating granular CA structure (e.g., P7 model where CA contributes 40%) and focusing on core skills.  
• Ability Levels: The assessment report must track the learner’s achievement covering the three main levels of ability: Knowledge, Comprehension, and Application.  
• Subject-Specific Competences: The report should accommodate display of attainment on summarized competences suggested in each P7 subject (e.g., the learner: names different bones and muscles or describes activities carried out during the holidays).  
4.3. International School Reporting  
The system must allow administrators to define report layouts, scoring computations, and grade displays entirely within the configuration tables, overriding NCDC mandates, as international school reporting is often customized \[Trello conversation, 762\].

\--------------------------------------------------------------------------------  
5\. Summary of Deliverables for Copilot 💻  
The development team requires the following to proceed with minimal involvement:  
1\. Database Migration Scripts: To create the six new tables (config\_school\_settings, config\_subjects, config\_exam\_sets, config\_assessment\_elements, config\_holistic\_metrics, ref\_ncdc\_lsc\_subjects, results\_exam\_entries, reports\_summary, reports\_holistic\_feedback, report\_documents) and update the existing students table (lin\_number).  
2\. Admin UI (Frontend): Development of the interfaces for Exam Set creation, linking subjects filtered by the existing schools.school\_type and class\_level, and the Bulk Upload utility (Excel/CSV support).  
3\. Backend API & Services: Implement the ingestion service (with validation), the subject retrieval API (with LSC/P7/International filtering logic), and the calculation service (LSC 80/20, P7 60/40 logic).  
4\. Reporting Engine: Implement template rendering logic to dynamically display Formative/Summative scores and the holistic/competency sections based on the configuration derived from the specific school\_id.