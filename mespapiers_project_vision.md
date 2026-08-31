# MesPapiers: Project Blueprint

## 1. Project Vision (Detailed)

**The Pain:** 
French administrative paperwork (*la paperasse*) is historically fragmented across physical drawers, emails, and dozens of disconnected digital portals (Préfecture, CAF, Ameli, ANTS, insurance providers). There is no single source of truth for a family. Missing a renewal deadline for critical documents—such as a passport, national ID card, residency permit (*titre de séjour*), or mandatory vehicle inspection (*contrôle technique*)—costs real money, causes severe administrative blockages, and can jeopardize legal residency status. Furthermore, paperwork is a household-level burden, usually falling on one person to track for multiple family members. For non-native speakers, understanding which document applies to which bureaucratic procedure adds a massive cognitive barrier.

**The Target:** 
Any household residing in France managing administrative paperwork for multiple members. A specialized focus is placed on non-French-speaking households and expatriates, where the stakes of missing deadlines (e.g., residency permits) and the language barrier are significantly higher.

**The Vision:** 
MesPapiers is designed to be the ultimate end-to-end household document engine. It eliminates the cognitive burden and financial risks of French bureaucracy. Rather than acting as a passive digital folder, MesPapiers transforms static document images into live, actionable household state objects. It acts as a proactive assistant that monitors hard legal deadlines to prevent fines and legal risks, while actively surfacing soft financial deadlines to prevent passive overpayment on auto-renewing contracts.

---

## 2. Project Solution with Steps

**Step 1: Smart Capture & AI Extraction**
The user takes a photo or uploads a scan of a document. Instead of forcing manual data entry, the system instantly processes the image through an AI Optical Character Recognition (OCR) engine. The AI reads and extracts the exact document type, the issuing authority, and the critical expiration or contract renewal dates. 

**Step 2: Structured Object Creation & Categorization**
The scanned image is not merely saved as a flat file; it is converted into a structured digital object. The system automatically tags it with the correct category (e.g., Identity, Vehicle, Housing), assigns the appropriate deadline behavior, and securely links it to the corresponding household member's profile.

**Step 3: Centralized Household Dashboard**
All processed documents populate a unified, real-time dashboard. This gives the household administrator a single, clear view of every document's status across the entire family. Statuses are visually color-coded into clear categories: Valid, Expiring Soon, Expired, or Action Required.

**Step 4: Dual-Logic Smart Notifications Engine**
The application deploys two distinct alert behaviors based on the nature of the document:
*   **Hard Deadlines (Legal/Identity):** For passports, IDs, and vehicle inspections, the system triggers fixed, escalating alerts at 90, 60, and 30 days before expiration, providing direct links to government booking portals (like ANTS).
*   **Soft/Tacit Renewals (Contracts/Insurance):** For health plans, car insurance, or home insurance, the system recognizes that the risk is not a service loss, but financial overpayment. Instead of an expiration countdown, it issues an annual "nudge" 30 to 60 days before the contract anniversary, prompting the user to renegotiate or compare market prices.

---

## 3. Technical Architecture

The platform is built on a 100% TypeScript, highly scalable, containerized stack. 

*   **Language:** TypeScript (End-to-End Type Safety)
*   **Frontend Framework:** Next.js (React) + Tailwind CSS
*   **Backend / API:** Next.js Server Actions & Route Handlers + Node.js WebSocket Engine
*   **Database:** PostgreSQL (Relational Data Storage)
*   **ORM:** Prisma (Type-safe Database Queries and Migrations)
*   **Real-Time Message Broker:** Redis Pub/Sub
*   **Infrastructure / Deployment:** Docker (Containerization) + NGINX (HTTPS Reverse Proxy)

**Architecture Map:**
```text
                              [ Browser (Chrome) ]
                                       |
                           [ NGINX (HTTPS Reverse Proxy) ]
                                       |
                 +---------------------+---------------------+
                 |                                           |
   [ Next.js Web Application ]               [ Node.js WebSocket Engine ]
   (React / Tailwind CSS / API Routes)        (TypeScript / WS Server)
                 |                                           |
                 +---------------------+---------------------+
                                       |
                      +----------------+----------------+
                      |                                 |
              [ PostgreSQL ]                     [ Redis Pub/Sub ]
             (Prisma ORM State)                (Real-Time Event Bus)
```

---

## 4. Detailed Core Execution Flow

This is the exact lifecycle of a user action, from uploading a document to real-time household synchronization:

1. Client-Side Upload: A user securely uploads a document image or PDF via the Next.js frontend interface.

2. API Routing & AI Processing: The Next.js backend receives the file and securely transmits it to the AI Vision API. The backend requests a strictly typed JSON response to ensure the AI returns only the required fields (Document Type, Expiration Date, Issuing Authority).

3. Database Persistence (Prisma): Upon receiving the structured data from the AI, the Next.js backend uses Prisma to write a new Document record to the PostgreSQL database. The document is mapped to a specific HouseholdMember and assigned a DeadlineType (Hard vs. Soft).

4. Event Publication (Redis): Immediately after a successful database write, the Next.js backend publishes a "Document Added" event to the Redis Pub/Sub instance, containing the basic metadata of the new document.

5. WebSocket Broadcast: The dedicated Node.js WebSocket container, which constantly listens to Redis, detects the new event. It identifies all other active WebSocket connections belonging to users in the same Household.

6. Real-Time UI Update: The WebSocket server pushes the state update to the connected family members. Their Next.js dashboards instantly render the newly added document and its deadline status without requiring a page refresh.

7. Background Scheduling: A background cron job continually scans the PostgreSQL database for upcoming targetDates and dispatches email or in-app notifications based on the document's specific 90/60/30-day or annual-nudge logic.

8. User Interaction: The household administrator can click on any document in the dashboard to view details, download the original file, or access direct links to government portals for renewal or action.

---

## 5. Modules To Implement

Each Major module is worth 2 points, while minor modules are worth 1 point. The total project is estimated at 19-20 points.

**Major Modules:**

**Major: Use a framework for both the frontend and backend.**
- **Application**: Using Next.js (App Router) heavily relies on Server Components, Server Actions, and Route Handlers to manage both the React UI and the backend logic in one unified TypeScript codebase.
  
**Major: Implement real-time features using WebSockets or similar technology.**
- **Application**: Essential for the "Household Dashboard." When one family member updates a document or resolves an alert, the Node.js WebSocket engine (via Redis Pub/Sub) instantly updates the UI for all other connected family members.

**Major: Standard user management and authentication.**
- **Application**: Managing individual user profiles within a household. Users can update their information, upload avatars, and see which family members are actively online managing documents.

**Major: Advanced permissions system.**
- **Application**: Implementing Household Role-Based Access Control (RBAC). A parent (Admin) can view, edit, and delete documents for children, while a standard user might only have access to view their own profile and documents.

**Major: Implement a complete LLM system interface.**
- **Application**: The AI Vision OCR engine. Users input unstructured data (a photo of a passport or insurance contract), and the AI returns a structured, verified JSON response detailing document type, dates, and issuer.

**Major: Advanced analytics dashboard with data visualization.**
- **Application**: The core visual interface for the family's administrative health. Includes interactive timelines (Recharts) showing document expirations over a 12-month period and charts projecting financial savings from the "soft-renewal" renegotiations.


**Minor Modules:**

**Minor: Use an ORM for the database.**
- **Application**: Full utilization of Prisma to map the complex relational data between Households, Users, Documents, and Tasks within the PostgreSQL database.

**Minor: File upload and management system.**
- **Application**: The foundation of the app. Securely handling the upload of sensitive PDFs and images (ID cards, contracts), including size/format validation, storage handling, and frontend preview functionality before AI processing.

**Minor: A complete notification system.**
- **Application**: The "Dual-Logic Smart Notifications Engine." Triggering automated alerts for hard deadlines (90/60/30 days for IDs) and soft commitments (annual contract nudges) across the household.

**Minor: Support for multiple languages (at least 3 languages).**
- **Application**: Critical for the target demographic (expatriates and non-native speakers). Using next-intl to provide full UI translations in French, English, and a third language (e.g., Spanish or Arabic) to break the language barrier of French bureaucracy.

**Minor: Implement remote authentication with OAuth 2.0.**
- **Application**: Allowing users to bypass standard email/password creation by authenticating instantly via Google or GitHub OAuth.

**Minor: Implement a complete 2FA (Two-Factor Authentication) system.**
- **Application**: Because MesPapiers stores highly sensitive personal identifiable information (PII), enforcing TOTP (Time-based One-Time Password) 2FA is a necessary security layer.

**Minor: GDPR compliance features.**
- **Application**: Strict handling of personal data. Users must have the ability to explicitly request their data, export their household vault in a readable format, and permanently delete their accounts and scanned documents with email confirmation.

