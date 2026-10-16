# FlowNet Backend

Production-quality Backend service for **FlowNet**, a social network platform built for real-time interactions, posts, stories, connection networks, blocking, 1:1 chat, group chat, and real-time notifications.

---

## 🚀 Tech Stack

- **Runtime & Language**: Node.js 20+ (ES Modules)
- **Framework**: Express.js
- **Database**: MongoDB Atlas / Local MongoDB with Mongoose ODM
- **Authentication**: `@clerk/express` (Clerk Authentication)
- **Webhooks**: `svix` (Clerk webhook signature verification)
- **Realtime**: `Socket.io`
- **File Uploads**: `multer` (memory storage) + `cloudinary` (images and videos <= 60s)
- **Validation**: `zod`
- **Security & Performance**: `helmet`, `cors`, `compression`, `morgan`, `express-rate-limit`, `sanitize-html`
- **Development**: `dotenv`, `nodemon`

---

## 📁 Directory Structure

```
Backend/
├── src/
│   ├── config/
│   │   ├── db.js             # Mongoose MongoDB connection & event handlers
│   │   ├── cloudinary.js     # Cloudinary SDK & stream upload helpers
│   │   └── env.js            # Environment variables parser & defaults
│   ├── models/
│   │   ├── User.js           # User schema with Clerk String _id, settings, indexes
│   │   ├── Post.js           # Posts schema with likes_count array & media types
│   │   ├── Comment.js        # Comments on posts
│   │   ├── Story.js          # 24-hour stories with MongoDB TTL index
│   │   ├── Connection.js     # Connection requests with unique compound index
│   │   ├── Message.js        # 1:1 chat messages with seen tracking
│   │   ├── Notification.js   # Notification inbox with unread indexing
│   │   ├── Group.js          # Community groups with membership & admin roles
│   │   └── GroupMessage.js   # Group chat messages
│   ├── controllers/
│   │   ├── user.controller.js
│   │   ├── connection.controller.js
│   │   ├── post.controller.js
│   │   ├── story.controller.js
│   │   ├── message.controller.js
│   │   ├── notification.controller.js
│   │   ├── group.controller.js
│   │   └── webhook.controller.js
│   ├── routes/
│   │   ├── index.js          # Mounted at /api
│   │   ├── user.routes.js
│   │   ├── connection.routes.js
│   │   ├── post.routes.js
│   │   ├── story.routes.js
│   │   ├── message.routes.js
│   │   ├── notification.routes.js
│   │   ├── group.routes.js
│   │   └── webhook.routes.js # Raw body parser for svix signature verification
│   ├── middlewares/
│   │   ├── auth.js           # Clerk requireAuth populating req.userId
│   │   ├── ensureUser.js     # Lazy user creation and sync from Clerk metadata
│   │   ├── validate.js       # Zod validation schema runner
│   │   ├── upload.js         # Multer memory storage & MIME validators
│   │   ├── rateLimit.js      # Rate limiters (general, messages, uploads, connections)
│   │   └── error.js          # Central error handler & 404 handler
│   ├── sockets/
│   │   └── index.js          # Socket.io auth handshake, rooms & real-time emits
│   ├── utils/
│   │   ├── apiError.js       # Standardized ApiError with machine error codes
│   │   ├── asyncHandler.js   # Express async promise catch wrapper
│   │   ├── pagination.js     # Cursor-based & page-based pagination helpers
│   │   ├── sanitize.js       # HTML tag stripping using sanitize-html
│   │   └── blockUtils.js     # Bidirectional block querying & enforcement
│   └── seed/
│       └── seed.js           # Database seeder (5 groups & sample posts)
├── server.js                 # Main HTTP + Socket.io server entrypoint
├── requests.http             # Complete REST Client file covering all endpoints
├── .env.example              # Environment variables template
├── .env                      # Local environment configuration
└── package.json
```

---

## ⚙️ Installation & Running

### 1. Prerequisites
- **Node.js**: v20 or higher (`node -v`)
- **MongoDB**: MongoDB 7+ running locally (`mongodb://localhost:27017/flownet`) or MongoDB Atlas URI

### 2. Install Dependencies
```bash
cd Backend
npm install
```

### 3. Setup Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your Clerk, Cloudinary, and MongoDB keys are set up.

### 4. Database Seeding
To populate the database with initial groups (`web`, `saad`, `wer`, `wer`, `1`) and sample posts:
```bash
npm run seed
```

### 5. Start Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5000`.

### 6. Production Mode
```bash
npm run start
```

---

## 🔒 Security & Conventions

### Response Envelope
All API responses use a standard response envelope:
```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "next_cursor": "...", "has_more": true }
}

// Error
{
  "success": false,
  "message": "User-friendly error message",
  "code": "ERROR_CODE"
}
```

### Consistent Error Codes
- `UNAUTHORIZED` (401): Missing or invalid Clerk session token.
- `FORBIDDEN` (403): User lacks permission for the requested action.
- `NOT_FOUND` (404): Resource not found.
- `BLOCKED_BY_USER` (403): Action prevented because a bidirectional block relationship exists.
- `MESSAGING_RESTRICTED` (403): Target user only accepts messages from connections.
- `FEATURE_DISABLED` (403): Action blocked by environment feature flag (`ALLOW_GROUP_CREATION`).
- `USERNAME_TAKEN` (409): Unique username collision.
- `VALIDATION_ERROR` (422): Zod schema validation failed.

### Block System (Real, Full Bidirectional Enforcement)
When User A blocks User B:
1. `following`, `followers`, and `connections` relations are removed in **both directions**.
2. Any pending or active `Connection` records between them are permanently deleted.
3. User B is added to User A's `blocked_users`.
4. Search results automatically filter out blocked users both ways.
5. Feed, comments lists, active stories, and notifications exclude content from either user.
6. A blocked user cannot message, follow, comment, like, or view the other user's profile.
7. Profile view returns:
   - When **they** blocked me: `{ _id, full_name, username, profile_picture, has_blocked_me: true }`.
   - When **I** blocked them: full profile with `is_blocked_by_me: true`.

---

## 🌐 Realtime (Socket.io)

### Authentication Handshake
Clients authenticate during the Socket.io handshake using their Clerk session token:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: clerkSessionToken, // Or Authorization: Bearer <token>
  },
  withCredentials: true,
});
```

### Rooms
- `user:{userId}`: Joined automatically upon successful authentication. Used for 1:1 messages and notifications.
- `group:{groupId}`: Joined via `socket.emit('group:join', { groupId })` (verified against group membership).

### Server -> Client Events
- `message:new`: New 1:1 message sent.
- `message:seen`: Messages marked as seen by conversation partner.
- `notification:new`: Real-time notification received (like, comment, follow, request).
- `group:message`: New group chat message.
- `group:request`: Join request received by group owner/admin.
- `group:request_accepted`: Join request accepted notification.

---

## ☁️ Deployment Notes

> [!IMPORTANT]
> **Persistent Server Requirement**:
> - The **Backend uses Socket.io with stateful WebSockets**, background TTL timers, and connection memory pools. It **MUST be deployed to a persistent server** such as **Render**, **Railway**, **Fly.io**, **Heroku**, or **AWS EC2 / DigitalOcean**.
> - **DO NOT deploy the Backend to Vercel Serverless Functions**, as serverless platforms terminate running instances and drop WebSocket connections.
> - The **Frontend (React + Vite)** remains on **Vercel**. Update `CLIENT_URL` in the backend environment variables to match your frontend Vercel deployment URL.

---

## 🧪 Testing

Run the automated self-verification test suite (covers 27 automated tests for users, posts, feed, block rules, connections, stories, and cascade deletion):
```bash
node src/test/verify.js
```
