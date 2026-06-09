# Sangama

Sangama is a modern video conferencing platform built for real-time communication, collaboration, and virtual meetings. It provides secure authentication, meeting management, and high-quality audio/video communication through a scalable cloud-based architecture.

The platform is designed around modern web technologies and containerized deployment workflows, enabling reliable operation across development and production environments.

---

## Why Sangama

Remote collaboration has become a critical requirement for organizations, educational institutions, communities, and distributed teams. Sangama was created to provide a lightweight, scalable, and developer-friendly video conferencing solution that combines modern user experience with production-ready infrastructure.

The application focuses on:

* Secure user authentication
* Real-time communication
* Reliable meeting management
* Containerized deployments
* Automated CI/CD workflows
* Cloud-native scalability

---

## Core Capabilities

### Authentication and Account Management

Users can securely register and authenticate using JWT-based authentication. Passwords are encrypted using industry-standard hashing techniques before being stored.

### Meeting Lifecycle Management

Authenticated users can create, manage, and join meetings through unique room identifiers. The platform maintains participant state and meeting synchronization in real time.

### Real-Time Audio and Video Communication

Sangama utilizes LiveKit infrastructure to provide low-latency audio and video communication between participants. The media layer is designed to support multiple concurrent participants while maintaining communication quality.

### Participant Presence and Synchronization

Meeting participants are synchronized through real-time signaling channels powered by Socket.IO. Join events, leave events, and participant state changes are propagated instantly across connected clients.

### Responsive Cross-Platform Experience

The user interface is optimized for desktop and mobile browsers, allowing users to participate in meetings from multiple device types without additional software installation.

### Production Deployment Workflow

The application is fully containerized using Docker and can be deployed consistently across local, staging, and production environments.

Automated deployment pipelines ensure that code changes are validated and deployed with minimal operational overhead.

---

## System Architecture

```text
Client Application (React)
            │
            ▼
        Nginx
            │
            ▼
    Express API Server
            │
            ▼
        MongoDB
            │
            ▼
      Socket.IO Layer
            │
            ▼
     LiveKit Media Cloud
```

The architecture separates application logic, persistence, signaling, and media transport into dedicated layers, allowing the platform to scale individual components independently.

---

## Technology Stack

### Frontend

* React
* React Router
* Axios
* Socket.IO Client
* Material UI
* LiveKit React SDK

### Backend

* Node.js
* Express.js
* Socket.IO
* JWT Authentication
* bcrypt

### Database

* MongoDB
* Mongoose

### Infrastructure

* Docker
* Docker Compose
* Nginx
* GitHub Actions
* AWS EC2
* Let's Encrypt SSL

---

## Local Development

### Clone Repository

```bash
git clone https://github.com/NiteeshGowda72/sangama-video-conferencing-platform.git

cd sangama-video-conferencing-platform
```

### Install Dependencies

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd frontend
npm install
```

### Environment Configuration

Backend:

```env
PORT=8000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=your_livekit_server
```

Frontend:

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_LIVEKIT_URL=your_livekit_server
```

### Run Application

Backend:

```bash
npm run dev
```

Frontend:

```bash
npm start
```

---

## Containerized Deployment

The application can be deployed using Docker Compose.

Build services:

```bash
docker compose build
```

Start services:

```bash
docker compose up -d
```

Stop services:

```bash
docker compose down
```

---

## Continuous Integration and Deployment

Sangama includes an automated deployment pipeline powered by GitHub Actions.

Every push to the main branch automatically:

1. Triggers a GitHub Actions workflow.
2. Connects securely to the production server using SSH.
3. Pulls the latest source code.
4. Rebuilds application containers.
5. Deploys updated services.

Deployment flow:

```text
Developer
    │
    ▼
GitHub Repository
    │
    ▼
GitHub Actions
    │
    ▼
AWS EC2
    │
    ▼
Docker Compose
    │
    ▼
Production Environment
```

---

## Security

Security considerations implemented within the platform include:

* JWT-based authentication
* Password hashing using bcrypt
* HTTPS enforcement through SSL certificates
* Reverse proxy protection via Nginx
* Secure environment variable management
* Protected API endpoints

---

## Screenshots

### Authentication

Add screenshot here

### Dashboard

Add screenshot here

### Create Meeting

Add screenshot here

### Join Meeting

Add screenshot here

### Video Conference

Add screenshot here

---

## Developer

**Niteesh Gowda C**

GitHub:
https://github.com/NiteeshGowda72

Email:
[niteeshgowda7272@gmail.com](mailto:niteeshgowda7272@gmail.com)

Repository:
https://github.com/NiteeshGowda72/sangama-video-conferencing-platform

---

## License

This project is released under the MIT License.
