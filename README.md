# ART Framework Demo

This is a Next.js application that demonstrates the ART (Agent Runtime) Framework using Gemini for reasoning.

## Prerequisites

- Node.js 18.x or later
- A Gemini API key (https://aistudio.google.com/app/apikey)

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the project root with your Gemini API key:
   ```
   NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
   ```

## Running the App

1. Start the development server:
   ```bash
   npm run dev
   ```
2. Open [http://localhost:3000](http://localhost:3000) in your browser

## Using the App

1. **Initialization**: When you first load the app, it will initialize the ART Framework with your Gemini API key.

2. **Asking Questions**: 
   - Type your query in the input box at the bottom of the page
   - Press "Send" or hit Enter to submit your query
   - Try questions like "What is 256 multiplied by 48?" to see the calculator tool in action

3. **Viewing Results**:
   - **Chat History**: See the conversation between you and the assistant
   - **Observations**: Watch real-time agent reasoning, including when it decides to use tools
   - **Response**: View the final response and performance metrics

4. **Features**:
   - The app creates a persistent thread for your conversation
   - All messages in a session maintain context
   - You can see the detailed thought process of the AI agent
   - The calculator tool is available for mathematical operations

## Example Queries

- "What is 1234 divided by 56?"
- "Can you calculate 15% of 230?"
- "If I have 5 apples and give away 2, then buy 3 more, how many do I have?"
- "What's the square root of 144?"

## Troubleshooting

- If you see initialization errors, check that your Gemini API key is correct
- If tool usage fails, ensure your query is clearly phrased for calculation needs

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
