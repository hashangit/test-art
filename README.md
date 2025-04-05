# ART Framework Demo with Next.js and Gemini

[![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black?logo=next.js)](https://nextjs.org/) [![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://reactjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/) [![ART Framework](https://img.shields.io/badge/ART_Framework-0.2.4-orange)](https://github.com/hashangit/ART) <!-- Assuming ART Framework has a repo/site -->

This project is a demonstration application built with Next.js showcasing the capabilities of the **ART (Agent Runtime) Framework**. It utilizes Google's Gemini model for reasoning and includes a simple calculator tool to illustrate agent tool usage.

## ✨ Key Features

*   **Agent Reasoning:** Leverages the Gemini API via the ART Framework for intelligent responses.
*   **Tool Usage:** Demonstrates how the agent can utilize a built-in calculator tool for mathematical queries.
*   **Interactive UI:** Built with React, Next.js, Tailwind CSS, and Radix UI components for a modern user experience.
*   **Real-time Observations:** Provides a view into the agent's thought process and tool invocation steps.
*   **Chat History:** Maintains conversation context within a persistent session thread.
*   **Performance Metrics:** Displays information about the response generation.

## 💻 Technology Stack

*   **Framework:** [Next.js](https://nextjs.org/) 15
*   **UI Library:** [React](https://reactjs.org/) 19
*   **Language:** [TypeScript](https://www.typescriptlang.org/) 5
*   **AI Runtime:** [ART Framework](https://github.com/google/labs-agent-runtime) <!-- Update link if different -->
*   **AI Model:** [Google Gemini](https://deepmind.google/technologies/gemini/) (via API)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) 4
*   **UI Components:** [Radix UI](https://www.radix-ui.com/), [shadcn/ui](https://ui.shadcn.com/) (implied by `components.json`)
*   **Icons:** [Lucide React](https://lucide.dev/)

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

*   [Node.js](https://nodejs.org/) version 18.x or later
*   [npm](https://www.npmjs.com/) (usually comes with Node.js)
*   A Google Gemini API Key: Obtain one from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url> # Replace with your repo URL if applicable
    cd test-art
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Configuration

1.  Create a `.env.local` file in the root of the project.
2.  Add your Gemini API key to the file:
    ```env
    NEXT_PUBLIC_GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
    ```
    Replace `YOUR_GEMINI_API_KEY_HERE` with your actual key.

## ▶️ Running the Application

### Development Mode

To run the application in development mode with hot-reloading and Turbopack:

```bash
npm run dev
```

Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

### Production Build

To build the application for production:

```bash
npm run build
```

To start the production server:

```bash
npm run start
```

### Linting

To check the code for linting issues:

```bash
npm run lint
```

## 📖 Usage Guide

1.  **Initialization:** Upon loading [http://localhost:3000](http://localhost:3000), the application initializes the ART Framework with your configured Gemini API key.
2.  **Interact with the Agent:**
    *   Locate the input box at the bottom of the interface.
    *   Type your query (e.g., "What is 512 * 12?").
    *   Press the "Send" button or hit `Enter`.
3.  **Observe the Results:**
    *   **Chat History:** Displays the ongoing conversation.
    *   **Observations:** Shows the agent's reasoning steps, including decisions to use tools like the calculator.
    *   **Response:** Presents the final answer from the agent along with performance details.

### Example Queries

Try these queries to see the calculator tool in action:

*   "What is 1234 divided by 56?"
*   "Calculate 15% of 230."
*   "If I have 5 apples and give away 2, then buy 3 more, how many do I have?" (Tests reasoning + calculation)
*   "What's the square root of 144?"

## 📂 Project Structure

```
test-art/
├── app/              # Next.js App Router pages and layouts
├── components/       # Reusable UI components (including shadcn/ui)
├── lib/              # Utility functions and services (e.g., art-service.ts)
├── public/           # Static assets (images, icons)
├── types/            # TypeScript type definitions
├── .env.local        # Environment variables (Gitignored)
├── next.config.ts    # Next.js configuration
├── package.json      # Project dependencies and scripts
├── tailwind.config.js # Tailwind CSS configuration
├── tsconfig.json     # TypeScript configuration
└── README.md         # This file
```

## 🔧 Troubleshooting

*   **Initialization Errors:** Double-check that your `NEXT_PUBLIC_GEMINI_API_KEY` in `.env.local` is correct and the file is saved in the project root.
*   **Tool Usage Failures:** Ensure your query clearly implies a calculation if you expect the calculator tool to be used. The agent decides based on the prompt.
*   **Dependency Issues:** If you encounter issues after pulling changes, try removing `node_modules` and `package-lock.json`, then run `npm install` again.

## 🤝 Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request. (Add more specific guidelines if needed).

## 📄 License

This project is licensed under the [MIT License](LICENSE). (Create a LICENSE file if you don't have one and want to specify a license).

## 📚 Learn More

*   [ART Framework Documentation](https://github.com/google/labs-agent-runtime) <!-- Update link if needed -->
*   [Next.js Documentation](https://nextjs.org/docs)
*   [Learn Next.js](https://nextjs.org/learn)
*   [Gemini API Documentation](https://ai.google.dev/docs)
*   [Tailwind CSS Documentation](https://tailwindcss.com/docs)
*   [Radix UI Documentation](https://www.radix-ui.com/docs/primitives)

## ▲ Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
