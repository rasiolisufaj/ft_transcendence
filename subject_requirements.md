# Subject: Transcendence

Transcendence is a group project (4 people), which is intended to boost your creativity, self-confidence, adaptability to new technologies, and teamwork skills.
You’ll create a real-world web application as a team that can move in many directions, depending on the modules you choose and the choices you make.

---

## 1. General Requirements

**Team Size:** 4 members

**Project Duration:** 5 weeks

**Requirements:**
- The project must be a web application, and requires a frontend backend, and a database.
- Git must be used with clear and meaningful commit messages. The repository must show:
   - Commits from all team members.
   - Clear commit messages describing the changes.
   - Proper work distribution across the team.
- Deployment must use a containerization solution (Docker).
- Your website must be compatible with the latest stable version of Google Chrome.
- No warnings or errors should appear in the browser console.
- The project must include accessible Privacy Policy and Terms of Service pages with relevant content.

**Multi-user Support (Mandatory):**
Your website must support multiple users simultaneously. This is a core requirement of the project.
Users should be able to interact with the application at the same
time without conflicts or performance issues.
This includes:
- Multiple users can be logged in and active at the same time.
- Concurrent actions by different users are handled properly.
- Real-time updates are reflected across all connected users when applicable.
- No data corruption or race conditions occur with simultaneous user actions.

---

## 2. Team Organization and Project Management

**Required Team Roles:**

Your team must assign the following roles (one person can have multiple roles if the team has 4 members):

- **Prduct Owner (PO):** Defines the product vision, prioritizes features, and ensures the project meets user needs.
    - Maintains the product backlog.
    - Makes decisions on features and priorities.
    - Validates completed work.
    - Communicates with stakeholders (evaluators, peers).

- **Project Manager (PM):** Oversees the project timeline, resources, and team coordination.
    - Creates and maintains the project plan.
    - Tracks progress and manages risks.
    - Facilitates team meetings and communication.
    - Ensures deadlines are met.

- **Technical Lead / Architect:** Guides the technical direction of the project, ensuring that the architecture and design meet the requirements.
    - Makes decisions on technology stack and architecture.
    - Reviews code and ensures best practices are followed.
    - Provides technical guidance to team members.
    - Reviews critical code changes and ensures they align with the overall architecture.

- **Developer(s):** Responsible for implementing features, writing code, and fixing bugs.
    - Writes clean, maintainable code.
    - Implements features according to specifications.
    - Collaborates with other team members to integrate components.
    - Tests and debugs code to ensure functionality and performance.
    - Documents code and provides support for future maintenance.

---

## 3. Technical Requirements

- A frontend that is clear, responsive, and accessible across all devices.
- Use a CSS framework or styling solution of your choice (e.g., Tailwind CSS, Bootstrap, Material-UI, Styled Components, etc).
- Store credentials (API keys, environment variables, etc.) in a local .env file that is ignored by Git, and provide an .env.example file.
- The database must have a clear schema and well-defined relations.
- Your application must have a basic user management system. Users must be able to sign up and log in securely:
    - At minimum: email and password authentication with proper security (hashed passwords, salted, etc.).
    - Additional authentication methods (OAuth, 2F2, etc.) can be implemented via modules.
- All forms and user inputs must be properly validated in both the frontend and backend.
- Any connection to the backend, from a browser, from a script, from an external API, etc., must use HTTPS. Connections inside the backend itself (e.g., web server and database, software inside your container(s)) can be without encryption.

---

## 4. Team Members and Interests
- **Adrien:**
    - Product Owner (PO)
    - Developer
- **Rasiol:**
    - Project Manager (PM)
    - Developer
    - Authentication & Security
- **Alexandre:**
    - Developer
    - Real-Time & WebSockets
    - Interested in AI & DevOps
- **Amir:**
    - Developer
    - Database
    - Technical Lead (TL)
