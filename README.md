# Leara.ai | Intelligent Developer Ecosystem

**Leara.ai** is a production-grade, AI-native developer workspace designed to bridge the gap between local development and cloud-based productivity. It provides a seamless, zero-config environment for building, testing, and learning code through an integrated suite of professional engineering tools.

---

## 🚀 Key Features

### 1. Unified Intelligence Dashboard
- **Command Center**: Manage your entire project lifecycle from a high-fidelity bento-grid dashboard.
- **Activity Tracking**: Real-time "Recent Activity" feed keeps you updated on your latest modifications.
- **Smart Skeletons**: Theme-aware loading states provide a smooth user experience across light and dark modes.

### 2. High-Performance GitHub Integration
- **Cloning Engine**: Instant repository mirroring into your private cloud workspace.
- **Visual Progress**: Real-time percentage tracking and visual fill-logic during complex import operations.
- **Auto-Environment**: Projects automatically launch into the editor view upon successful import.

### 3. Professional IDE Suite
- **Embedded Editor**: Full-featured code editor with syntax highlighting and intelligent completions.
- **Live Terminal**: Integrated shell powered by WebContainers for running `npm`, `git`, and custom scripts.
- **Real-time Preview**: Instant browser-in-browser preview window for validating frontend changes.

### 4. AI Pair Programming
- **Contextual Assistance**: Seamless integration with the Gemini API for debugging, refactoring, and documentation.
- **Learning Mode**: Specialized interface for high-level code comprehension and architectural walkthroughs.

---

## 🛠 Tech Stack

### Frontend & UI
- **React 18**: Component-based architecture for high-performance rendering.
- **TypeScript**: Full type safety across the entire application.
- **Tailwind CSS v4**: Modern, utility-first styling with advanced CSS variables.
- **Framer Motion**: Smooth, high-end micro-animations and transitions.
- **Radix UI**: Accessible, unstyled primitives for UI consistency.

### Backend & Infrastructure
- **Vite**: Ultra-fast build tool and development server.
- **Firebase Auth**: Secure, managed user authentication.
- **Cloud Firestore**: Real-time, scalable NoSQL database for project and file metadata.
- **WebContainers**: Web-native containerization for running Node.js in the browser.

### Artificial Intelligence
- **Gemini API**: Native integration for advanced code generation and analysis.

---

## 🏗 How It Works

1. **Authentication**: Users sign in securely via Google, creating a persistent personal profile and private storage allocation.
2. **Workspace Provisioning**: Upon project creation or import, Leara.ai initializes a project entry in Firestore and mirrors the file tree.
3. **Execution Environment**: The editor leverages WebContainers to spin up a sandboxed Node.js environment on the client side, allowing for standard package installation and server execution without an external backend.
4. **Cloud Persistence**: All modifications are automatically synced to Firestore through a sophisticated backup service, ensuring "pick-up-where-you-left-off" portability across any device.

---

## 💻 Technical Setup

**Prerequisites:** Node.js 18+

1. **Clone the project**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Environment Configuration:**
   Create a `.env` file and populate:
   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_GEMINI_API_KEY=...
   ```
4. **Run Development Server:**
   ```bash
   npm run dev
   ```

---

*Built with passion for engineers who demand excellence.*
