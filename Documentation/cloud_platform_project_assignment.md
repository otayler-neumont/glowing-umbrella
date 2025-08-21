# Cloud Platform Development Project — Assignment Requirements (Transcribed)

Source: Screenshot `2025-08-21 10.47.31 lms.neumont.edu 01364ad1268d.png` in `Documentation/`.

---

## Overview
This project provides a opportunity to demonstrate creating a practical cloud-based system end‑to‑end by building a cloud‑native multi‑service application. You will design the architecture, implement the minimum feature set that works, and provide artifacts and a walkthrough that explain it.

### Learning Objectives
- Design and implement a cloud‑native application on a major cloud provider
- Deploy and configure essential managed services
- Implement an authenticated REST API fronted by an API gateway
- Apply data persistence and basic security best practices
- Instrument the system with metrics, logs, dashboards, and alerts
- Automate deployment with infrastructure‑as‑code and CI/CD

---

## Technical Requirements

### 1. Client Application
Deliver a simple client that can create/read data and exercise core flows.
- Multi‑page UI with forms and validation
- Demonstrates authentication and authorized requests
- Clear flows: create resource, list resources, view details
- Professional but minimal UX (responsive baseline)

### 2. Cloud API Architecture
Provide and implement a cloud API with a clear architecture.
- Expose a REST API via a managed API Gateway
- Stateless compute layer (e.g., Functions/Lambda)
- Backed by a managed database
- Include an architecture diagram and description of services and interactions

### 3. API Gateway Implementation
Configure an API Gateway in front of the API.
- At least 4 REST endpoints covering CRUD or core actions
- CORS configuration for approved origins
- Request validation (models/schemas) and consistent error handling
- Rate limiting/throttling configuration
- Access logging to the platform’s logging service
- JWT/OAuth2 authorizer integrated with your auth system

### 4. Data Persistence Strategy
Use at least one cloud database service to demonstrate data durability.
- Relational (e.g., PostgreSQL/Cloud SQL/Aurora) or NoSQL (e.g., DynamoDB/Firestore)
- Create schema/collections and migration/initialization scripts
- Secure connectivity and credentials management
- Basic backup/retention posture noted
- Demonstrate create/read flows from the client through the API

### 5. Authentication & Authorization
Protect the application with platform‑native auth.
- Use a managed identity solution (e.g., Cognito, Auth0, OAuth provider)
- Issue/validate JWTs at the API Gateway or service layer
- Role‑based access control (e.g., GM vs Player) for at least one route
- Token storage best practices and refresh/logout behavior

### 6. Message Queue Integration
Integrate one cloud messaging service for an asynchronous use‑case.
- Choose an MQ (e.g., SQS, Pub/Sub, Cloud Tasks)
- Produce a message from an API action
- Consume the message with a worker/function and perform a side‑effect
- Configure a dead‑letter queue/redrive
- Show basic metrics/visibility on the queue

### 7. Cloud Monitoring & Alerting
Instrument components and set a few alerts.
- Dashboards for: API Gateway, compute functions, database
- Log aggregation with structured logs
- Business metric(s): at least one simple counter or rate
- Alarms (examples):
  - API 5xx error rate exceeds threshold for N minutes
  - Database CPU (or latency/storage) sustained above threshold
  - Daily or monthly cost/budget threshold exceeded

### 8. Infrastructure as Code & Deployment Automation
Automate the cloud deployment and app release process.
- Infrastructure defined with IaC (e.g., CDK/Terraform/ARM)
- CI pipeline (e.g., GitHub Actions) to build/test and deploy to a dev environment
- Secure credentials via OIDC or secrets manager; no plaintext secrets in code
- Clear README with setup and deploy instructions

---

## Business Requirements
Keep scope lean and focused. Build only what is necessary to satisfy the rubric.
- Choose a small domain problem with clear flows
- De‑scope advanced/optional features beyond the rubric
- Provide just enough UI to exercise the API and demonstrate design quality

### Topic Selection Criteria
- Solves an authentic problem or realistic scenario
- Showcases 4+ cloud services working together
- Demonstrates sound architecture and tradeoffs
- Avoids unnecessary complexity and scope creep

---

## Deliverables

### 1) Source Code Submission
- Complete source for all components
- Infrastructure as Code definitions
- CI workflow configuration
- Clear instructions to set up, deploy, and run

### 2) Final Presentation
- 5–7 minute demo walkthrough
- Architecture diagram and rationale
- Service interactions and data flow
- Security and cost considerations
- Monitoring/dashboards and alarms
- What went well, what you would improve next

### 3) Documentation
- Architecture overview and diagrams (system + ERD)
- API reference or Postman/Insomnia collection
- Setup and deployment guide
- Runbook for alarms/alerts
- Cost and scaling notes

---

## Important Considerations

### Cost Management
- Prefer free‑tier or low‑cost SKUs; turn off unused resources
- Use budgets/alerts to track spend
- Minimize NAT/data transfer costs; prefer VPC endpoints where appropriate
- Tag resources and monitor utilization

### Security Best Practices
- Principle of least privilege IAM
- TLS for all endpoints and DB connections
- Store secrets in a secure service (e.g., SSM Parameter Store/KMS)
- Sanitize logs; avoid PII leakage
- CORS allow‑list for approved client origins

### Platform Flexibility
You may use one or a combination of approved platforms (confirm with instructor):
- Amazon Web Services (AWS)
- Microsoft Azure
- Google Cloud Platform (GCP)
- Cloudflare
- Snowflake
- Other pre‑approved providers (with instructor approval)

---

## Tips for Success
- Start with the rubric and draw the system — begin with defaults
- Pick the smallest flow that proves the architecture
- Use managed services to reduce code and risk
- Automate deployment early; avoid manual snowflakes
- Keep documentation current as the system evolves

---

## Rubric (Structure)
The rubric on the LMS includes categories similar to the following. Refer to the LMS page for current point values.

| Category | What evaluators look for |
|---|---|
| User Interface | Clear flows, forms with validation, basic responsiveness |
| Cloud API Architecture | Clean design, coherent service boundaries, diagram and rationale |
| API Gateway Implementation | CORS, validation, throttling, logging, JWT authorizer, 4+ endpoints |
| Data Persistence Strategy | Managed DB, schema/migrations, secure access, working CRUD |
| Authentication & Authorization | Managed identity, roles/claims, protected routes |
| Message Queue Integration | Producer/consumer with DLQ, observable processing |
| Cloud Monitoring & Alerting | Dashboards and alarms for API/compute/DB; cost alert |
| Infrastructure as Code & CI/CD | IaC reproducibility; automated build/test/deploy to dev |
| Documentation & Presentation | Diagrams, setup guide, Postman collection, concise demo |

---

## Image Reference
![Assignment Screenshot](./2025-08-21%2010.47.31%20lms.neumont.edu%2001364ad1268d.png)
