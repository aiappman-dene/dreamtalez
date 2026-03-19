# AI Dene Bedtime Stories

A Node.js app for generating calming, personalized bedtime stories for children.

## Project Structure

```
AI-Dene-Bedtime-Stories
│
├ server.js
├ package.json
├ .env
│
├ public
│   ├ index.html
│   ├ style.css
│   ├ app.js
│   └ images
│
└ README.md
```

### Explanation:

- **server.js**: Runs the backend and connects to the AI.
- **package.json**: Node project configuration.
- **.env**: Stores your DeepSeek API key securely.
- **public/**: Everything the user sees in the browser or Android WebView.
  - **index.html**: The UI for the app.
  - **style.css**: Design and layout.
  - **app.js**: Handles all frontend interactivity and logic.
  - **images/**: (Optional) Image assets for the app.

## Setup
1. Install dependencies: `npm install`
2. Create a `.env` file with your API keys
3. Run the server: `node server.js`
4. Open [http://localhost:3000](http://localhost:3000)
