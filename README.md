# Auth Application - Authentication & Email Service

A full-stack authentication web application built with Node.js, Express, MongoDB, React, Tailwind CSS, and Nodemailer using **Gmail SMTP** (App Password authentication).

---

## Architecture Overview

- **Backend**: Express.js (ES Modules), MongoDB/Mongoose, JWT (Access + Refresh tokens with rotation), Helmet, Rate Limiting, Mongo Sanitization, XSS Sanitization.
- **Frontend**: React 19, Vite, Tailwind CSS, Zustand, Framer Motion, Lucide Icons, React Hot Toast.
- **Email Delivery Service**: Reusable Nodemailer service configured for **Gmail SMTP** (`smtp.gmail.com` on port 465 SSL or 587 TLS) using Google App Passwords without requiring a custom domain.

---

## 1. Prerequisites & Dependencies Installation

Ensure you have **Node.js (v18+)** and **npm** installed.

### Backend Dependencies
From the project root:
```bash
npm install
```
Installed dependencies include:
- `nodemailer`: SMTP email transport
- `dotenv`: Environment variable loader
- `express`: Web server framework
- `mongoose`: MongoDB ODM
- `jsonwebtoken`: Access & refresh token generation
- `bcryptjs`: Password hashing
- `helmet`, `cors`, `express-rate-limit`: Security middleware

### Frontend Dependencies
From the `Frontend` directory:
```bash
cd Frontend
npm install
cd ..
```

---

## 2. Gmail 2-Step Verification Setup

To send emails using Gmail SMTP without purchasing a custom domain, Google requires **2-Step Verification** and an **App Password**. You should never use your personal Gmail login password.

1. Navigate to your [Google Account Security Settings](https://myaccount.google.com/security).
2. Under **How you sign in to Google**, click on **2-Step Verification**.
3. Follow the on-screen steps to turn on 2-Step Verification (via SMS, Google Authenticator, or prompt).

---

## 3. How to Generate a Google App Password

An App Password is a unique 16-character code that grants an application permission to send emails through your Gmail account via SMTP.

1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords).
   *(Alternatively, search "App passwords" in the Google Account search bar).*
2. Enter an application name (e.g., `AuthApp`).
3. Click **Create**.
4. Google will generate a 16-character password in 4 groups (e.g., `abcd efgh ijkl mnop`).
5. Copy this password. You can paste it with or without spaces into `SMTP_PASS` in your `.env` file (the email utility automatically cleans whitespace).

---

## 4. Backend Environment Configuration (`.env`)

Create or update the `.env` file in the root directory:

```env
# Server Configuration
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database Connection
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/auth_db?retryWrites=true&w=majority

# JWT Secrets
JWT_SECRET=your_jwt_access_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here

# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_character_app_password
EMAIL_FROM=your_email@gmail.com
EMAIL_FROM_NAME="Auth App"
```

> **Security Notice**: Never commit your `.env` file to Git. The `.gitignore` file is already configured to exclude `.env` and `.env.local`. Always use `.env.example` as a template for public repositories.

---

## 5. Running the Application Locally

### Start Backend Development Server
From the root directory:
```bash
npm run dev
```
The server will start at `http://localhost:5001`. On startup, it automatically performs a non-blocking diagnostic verification of the Gmail SMTP connection.

### Start Frontend Development Server
In a separate terminal:
```bash
cd Frontend
npm run dev
```
The frontend will start at `http://localhost:5173`.

---

## 6. How to Test Email Sending

### Automatic Verification
On server boot, Nodemailer verifies your SMTP connection. Check the console output:
```text
[EMAIL SERVICE] Gmail SMTP transporter verified successfully. Ready to send emails.
```

### End-to-End Workflow Testing
1. **User Registration**:
   - Navigate to `http://localhost:5173/signup`.
   - Register a new account with a valid email.
   - You will receive a 6-digit verification code and verification link via Gmail SMTP.
2. **Resend Code**:
   - On the verification screen, wait for the 60-second cooldown or click **Resend Code** to test resending.
3. **Account Activation**:
   - Enter the 6-digit code or click the link.
   - Upon successful verification, an automated **Welcome Email** is dispatched.
4. **Forgot Password**:
   - Navigate to `http://localhost:5173/forgot-password`.
   - Request a reset link. A single-use secure reset token email will be delivered.
5. **Password Reset Success**:
   - Open the reset link, enter a new password, and submit.
   - A confirmation email will be delivered notifying you that the password was updated.

---

---

## 7. Production Deployment Guide (Render & Vercel)

### Option A: Frontend on Vercel + Backend on Render (Recommended)

#### Step 1: Deploy Backend on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New + > Web Service**.
2. Connect your GitHub repository.
3. Configure the settings:
   - **Name**: `auth-app-backend` (or your choice)
   - **Region**: Choose the closest region
   - **Root Directory**: *(leave blank / root)*
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node Backend/index.js` (or `npm start`)
4. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `PORT`: `5001`
   - `MONGO_URI`: `your_mongodb_connection_string`
   - `JWT_SECRET`: `your_jwt_secret`
   - `JWT_REFRESH_SECRET`: `your_jwt_refresh_secret`
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_PORT`: `465`
   - `SMTP_USER`: `your_email@gmail.com`
   - `SMTP_PASS`: `your_16_char_google_app_password`
   - `EMAIL_FROM`: `your_email@gmail.com`
   - `CLIENT_URL`: `https://your-frontend-name.vercel.app` *(update once frontend is created)*
5. Click **Create Web Service**. Copy your backend URL (e.g., `https://auth-app-backend.onrender.com`).

#### Step 2: Deploy Frontend on Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New... > Project**.
2. Import your GitHub repository.
3. In the project configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click **Edit** and select `Frontend`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
   - **Install Command**: `npm install` (default)
4. Under **Environment Variables**, add:
   - `VITE_API_URL`: `https://auth-app-backend.onrender.com/api/auth` *(your Render backend URL + `/api/auth`)*
5. Click **Deploy**.
6. Once deployed, copy your Vercel URL (e.g., `https://your-frontend-name.vercel.app`) and update the `CLIENT_URL` environment variable on Render!

---

### Option B: Monolithic Deployment on Render (Full-Stack all-in-one)
If you prefer hosting both frontend and backend together on a single Render Web Service:
1. Create a **Web Service** on Render connected to this repository.
2. Settings:
   - **Build Command**: `npm run build` *(installs dependencies and builds the Frontend)*
   - **Start Command**: `npm start` *(starts the Express server, which serves API routes and `/Frontend/dist`)*
3. Add all backend environment variables listed above. `CLIENT_URL` can point to your Render service URL.

---

## 8. Credential Security Best Practices

- **Never Commit Secrets**: Real credentials, App Passwords, and database connection strings must never be committed to source control.
- **Least Privilege**: Google App Passwords bypass normal 2FA for SMTP only, but cannot be used to log into your Google Account via a browser. You can revoke the App Password at any time in Google Security Settings if compromised.
- **Prevent Exposure**: Backend SMTP credentials are never included in API responses or frontend build bundles.
