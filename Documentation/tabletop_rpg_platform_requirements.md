# Tabletop RPG Campaign Management Platform

## Technical Requirements Document

---

## 1. Executive Summary

**Project Title:** Tabletop RPG Campaign Management Platform
**Team Members:**

- **Backend Developer** - AWS Lambda functions, API Gateway configuration, database design and implementation
- **DevOps Engineer** - AWS infrastructure setup, CI/CD pipeline, monitoring and deployment automation
- **Full Stack Developer** - Website generation, UI/UX implementation, and system integration

**Project Description:**

A multi-tenant, serverless platform where Game Masters (GMs) can create and manage tabletop RPG campaigns, invite players, share campaign materials, track sessions, and automate game-related communications. The platform provides a comprehensive digital workspace for RPG groups, eliminating the need for scattered tools and manual coordination.

**Primary Business Value:**  
Solves the fragmentation problem in tabletop RPG management by providing a unified platform that streamlines campaign organization, player communication, and session management. Reduces administrative overhead for GMs while enhancing player engagement through automated reminders and session recaps.

---

## 2. Project Description

### Business Case

**Problem Statement:**  
Tabletop RPG groups currently struggle with fragmented tools - campaign notes in Google Docs, character sheets in spreadsheets, session scheduling via Discord, and handouts shared through various channels. This creates administrative burden for GMs and confusion for players.

**Target Audience:**  
- **Primary:** Game Masters running D&D, Pathfinder, or other tabletop RPG campaigns
- **Secondary:** RPG players seeking organized campaign participation
- **Tertiary:** RPG communities and gaming stores hosting multiple campaigns

**Expected Impact:**  
- 50% reduction in GM administrative time
- 30% increase in player session attendance through automated reminders
- Centralized campaign knowledge base improving player engagement
- Scalable platform supporting multiple campaigns simultaneously

### Functional Requirements

**Key Features:**
1. **Campaign Management** - Create, configure, and manage multiple RPG campaigns with player rosters
2. **Session Tracking** - Schedule sessions, track attendance, and maintain session logs
3. **Content Sharing** - Upload and organize maps, handouts, character portraits, and lore documents
4. **Automated Communications** - Session reminders, recap emails, and campaign updates
5. **Character Management** - Digital character sheets with campaign-specific customization
6. **Real-time Collaboration** - Live session tools for dice rolling, note-taking, and map sharing
7. **Analytics Dashboard** - Campaign statistics, player engagement metrics, and session history

**User Workflow:**
1. GM registers and creates a new campaign
2. GM invites players via email or shareable link
3. Players join and create character profiles
4. GM uploads campaign materials (maps, handouts, lore)
5. GM schedules sessions and system sends automated reminders
6. Players check in for sessions and access shared content
7. GM tracks session progress and generates automated recaps
8. Platform maintains campaign history and analytics

**Minimum Viable Product (MVP):**
- User registration and authentication (basic email/password)
- Simple campaign creation with name and description
- Basic player invitation via email
- Simple session scheduling (date/time only)
- Basic character sheet (name, class, level only)
- Simple dashboard to view campaigns and sessions

**Stretch Goals (if time permits):**
- Content upload and sharing (maps, handouts)
- Automated email reminders for sessions
- Advanced character sheet with stats and abilities
- Session attendance tracking
- Basic analytics dashboard
- Mobile-responsive design

### User Stories

1. **As a Game Master**, I want to create a new campaign and invite players, so that I can organize my RPG group in one place without managing multiple communication channels.

2. **As a Player**, I want to receive automated reminders about upcoming sessions, so that I don't miss games and can prepare my character accordingly.

3. **As a Game Master**, I want to upload and organize campaign maps and handouts, so that I can easily share visual materials with my players during sessions.

4. **As a Player**, I want to access my character sheet and campaign materials from any device, so that I can participate in sessions regardless of my location.

5. **As a Game Master**, I want to track session attendance and generate automated recaps, so that I can maintain campaign continuity and keep players engaged between sessions.

---

## 3. Technical Architecture

### System Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Mobile Client  │    │   Admin Panel   │
│  (React/Next.js)│    │   (PWA/Ionic)   │    │   (React App)   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    AWS API Gateway        │
                    │  (RESTful Endpoints)      │
                    │  - CORS, Rate Limiting    │
                    │  - JWT Authorization      │
                    │  - API Key Management     │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    AWS Lambda Functions   │
                    │  - Campaign Management    │
                    │  - User Authentication    │
                    │  - Content Processing     │
                    │  - Notification Service   │
                    │  - Analytics Engine       │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
    ┌─────▼─────┐         ┌───────▼──────┐        ┌──────▼─────┐
    │   SQS     │         │   EventBridge│        │   SNS      │
    │(Reminders)│         │(Scheduled)   │        │(Alerts)    │
    └───────────┘         └──────────────┘        └───────────┘
          │                       │                       │
    ┌─────▼─────┐         ┌───────▼──────┐        ┌──────▼─────┐
    │   SES     │         │   Lambda     │        │  CloudWatch│
    │(Emails)   │         │(Schedulers)  │        │(Monitoring)│
    └───────────┘         └──────────────┘        └───────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                               │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│   Amazon RDS    │   DynamoDB      │   ElastiCache   │    S3     │
│   (PostgreSQL)  │   (Session Logs)│   (Redis Cache) │ (Assets)  │
│ - Users         │ - Chat History  │ - Active State  │ - Maps    │
│ - Campaigns     │ - Story Logs    │ - Session Data  │ - Handouts│
│ - Sessions      │ - Analytics     │ - User Sessions │ - Portraits│
│ - Characters    │                 │                 │           │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
```

### Technology Stack

| Component | Technology Choice | Justification |
|-----------|------------------|---------------|
| Cloud Platform | AWS | Comprehensive serverless ecosystem, excellent Lambda integration, mature services for all requirements |
| Client Application | React/Next.js PWA | Server-side rendering for SEO, PWA capabilities for offline access, excellent developer experience |
| API Gateway | AWS API Gateway | Native Lambda integration, built-in CORS, rate limiting, and custom authorizers |
| Compute Services | AWS Lambda | Serverless architecture reduces operational overhead, auto-scaling, pay-per-use model |
| Primary Database | Amazon RDS (PostgreSQL) | ACID compliance for user data, complex relationships, mature ecosystem |
| Secondary Storage | Amazon S3 | Cost-effective object storage, lifecycle policies, CDN integration via CloudFront |
| Message Queue | Amazon SQS | Reliable message processing, dead letter queues, integration with Lambda |
| Authentication | Amazon Cognito | Managed user pools, OAuth2 integration, JWT token management |
| Monitoring | CloudWatch | Native AWS integration, comprehensive metrics, log aggregation |
| Caching | ElastiCache (Redis) | Session state management, performance optimization, pub/sub capabilities |
| CDN | CloudFront | Global content delivery, S3 integration, cost optimization |

---

## 4. Data Design

### Data Models

**Relational Data (PostgreSQL/RDS):**
```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    cognito_user_id VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    gm_id UUID REFERENCES users(id),
    max_players INTEGER DEFAULT 6,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Campaign Players (Many-to-Many)
CREATE TABLE campaign_players (
    campaign_id UUID REFERENCES campaigns(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'player', -- 'gm', 'player', 'spectator'
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (campaign_id, user_id)
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    campaign_id UUID REFERENCES campaigns(id),
    title VARCHAR(255) NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 180,
    status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'active', 'completed', 'cancelled'
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Session Attendance
CREATE TABLE session_attendance (
    session_id UUID REFERENCES sessions(id),
    user_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'invited', -- 'invited', 'confirmed', 'attended', 'no-show'
    checked_in_at TIMESTAMP,
    PRIMARY KEY (session_id, user_id)
);
```

**Unstructured Data (DynamoDB):**
```json
// Session Logs
{
  "session_id": "uuid",
  "timestamp": "2024-01-15T10:00:00Z",
  "log_type": "chat|action|dice_roll",
  "user_id": "uuid",
  "content": "string",
  "metadata": {
    "dice_result": 15,
    "character_name": "Gandalf",
    "location": "Moria"
  }
}

// Campaign Analytics
{
  "campaign_id": "uuid",
  "date": "2024-01-15",
  "metrics": {
    "active_players": 5,
    "session_duration": 180,
    "content_uploads": 3,
    "chat_messages": 45
  }
}
```

**Object Storage (S3):**
- Campaign assets: maps, handouts, character portraits
- File types: JPG, PNG, PDF, MP4
- Lifecycle policies: Move to IA after 30 days, Glacier after 90 days
- Estimated volume: 1-5GB per campaign

**Cache Storage (Redis/ElastiCache):**
- Active session state
- User authentication tokens
- Campaign metadata cache
- Estimated volume: 100MB per active session

### Data Flow

1. **User Input → API → Processing → Storage:**
   - User uploads campaign map → API Gateway → Lambda → S3 + RDS metadata
   - User schedules session → API Gateway → Lambda → RDS + SQS reminder job
   - User sends chat message → API Gateway → Lambda → DynamoDB + Redis cache

2. **Asynchronous Processing:**
   - Session reminder: EventBridge → Lambda → SQS → SES email
   - Recap generation: Lambda → DynamoDB logs → Lambda → SES email
   - Analytics aggregation: EventBridge → Lambda → DynamoDB metrics

3. **Data Retrieval:**
   - Campaign dashboard: Lambda → RDS + Redis cache → API Gateway → Client
   - Session content: Lambda → S3 + DynamoDB → API Gateway → Client

---

## 5. Security & Authentication Plan

### Authentication Strategy

**User Registration and Login:**
- Amazon Cognito User Pools for user management
- OAuth2 integration with Google and Discord
- Email verification required for new accounts
- Multi-factor authentication (MFA) for GMs

**Token Management:**
- JWT tokens with 1-hour expiration
- Refresh tokens with 30-day expiration
- Token rotation on security events
- Secure token storage in HTTP-only cookies

**Session Handling:**
- Redis-based session storage
- Automatic session timeout after 24 hours of inactivity
- Concurrent session limits (max 3 devices per user)

### Authorization Model

**User Roles:**
1. **Game Master (GM):**
   - Create and manage campaigns
   - Invite/remove players
   - Upload and organize content
   - Schedule and manage sessions
   - Access campaign analytics
   - Generate automated communications

2. **Player:**
   - Join campaigns (with GM approval)
   - Access shared campaign content
   - Update character sheets
   - Participate in sessions
   - View session history

3. **Spectator:**
   - View public campaign information
   - Access read-only content
   - No modification permissions

**Role-Based Access Examples:**
- Only GMs can delete campaign content
- Players can only modify their own character sheets
- Session scheduling restricted to campaign GMs
- Content uploads require GM approval for large files

### Security Considerations

**API Security:**
- API Gateway rate limiting (1000 requests/minute per user)
- Request validation and sanitization
- CORS configuration for authorized domains
- API key authentication for third-party integrations

**Data Encryption:**
- Data at rest: AES-256 encryption (RDS, S3, DynamoDB)
- Data in transit: TLS 1.3 for all communications
- Lambda environment variables encrypted with KMS
- Database connection encryption enabled

**Sensitive Data Handling:**
- PII data encrypted in database
- Logs scrubbed of sensitive information
- Secure deletion of user data on account closure
- Regular security audits and penetration testing

---

## 6. Monitoring & Alerting Strategy

### Key Metrics

**System Metrics:**
- API Gateway: Request count, latency, error rate, throttles
- Lambda: Duration, memory usage, error count, cold starts
- RDS: Connection count, query performance, storage usage
- S3: Request count, data transfer, error rate

**Business Metrics:**
- Daily active users (DAU)
- Campaign creation rate
- Session attendance rate
- Content upload volume
- User engagement (time spent, features used)

**Infrastructure Metrics:**
- CPU and memory utilization
- Network throughput
- Storage capacity and growth
- Cost per user per month

### Alert Scenarios

1. **High Error Rate Alert:**
   - Condition: API error rate > 1% for 5 minutes
   - Threshold: 1% error rate
   - Notification: Slack channel + email to DevOps team
   - Response: Immediate investigation, rollback if necessary

2. **Database Performance Alert:**
   - Condition: RDS CPU utilization > 80% for 10 minutes
   - Threshold: 80% CPU usage
   - Notification: Slack channel + email to backend team
   - Response: Query optimization, potential scaling

3. **Cost Threshold Alert:**
   - Condition: Daily AWS spend > $50
   - Threshold: $50 per day
   - Notification: Slack channel + email to project manager
   - Response: Resource optimization, cost analysis

---

## 7. Development Plan

### Timeline

**Week 1: Foundation Setup**
- Set up AWS development environment
- Configure basic IAM roles and permissions
- Create simple infrastructure (S3, Lambda, API Gateway)
- Set up basic database (RDS or DynamoDB)
- Implement basic user authentication
- Create simple website structure

**Week 2: Core Backend Development**
- Implement basic Lambda functions for user management
- Create simple API Gateway endpoints
- Set up database tables/schemas
- Implement basic campaign creation
- Add simple player invitation system
- Create basic session scheduling

**Week 3: Frontend and Basic Integration**
- Develop simple dashboard UI
- Implement basic session scheduling interface
- Create simple character sheet functionality
- Add basic content display features
- Integrate basic notification system
- Implement simple session tracking

**Week 4: Testing and Basic Deployment**
- Basic functionality testing
- Simple performance testing
- Basic security review
- Documentation completion
- Simple deployment setup
- Basic user testing

**Week 5: Stretch Goals and Polish**
- Implement stretch goal features (if time permits)
- UI/UX improvements
- Additional testing and bug fixes
- Final documentation and presentation preparation
- Demo preparation and practice

### Risk Assessment

**Risk: AWS Lambda cold start latency affecting user experience**
- Mitigation: Implement connection pooling, use provisioned concurrency for critical functions, optimize function size

**Risk: Database performance degradation with increased user load**
- Mitigation: Implement read replicas, optimize queries, add caching layers, monitor and scale proactively

**Risk: Security vulnerabilities in third-party dependencies**
- Mitigation: Regular dependency updates, automated vulnerability scanning, security-focused code reviews

### Cost Management Strategy

**Free Tier Optimization:**
- Lambda: 1M free requests/month (sufficient for MVP)
- RDS: 750 hours/month on t3.micro (adequate for development)
- S3: 5GB storage and 20,000 GET requests/month
- API Gateway: 1M API calls/month
- CloudWatch: Basic monitoring included

**Cost Monitoring:**
- AWS Cost Explorer for daily spending tracking
- CloudWatch alarms for cost thresholds
- Automated resource tagging for cost allocation
- Weekly cost reviews and optimization

**Resource Cleanup:**
- Automated cleanup of unused S3 objects
- Lambda function version management
- Database backup retention policies
- Development environment shutdown procedures 