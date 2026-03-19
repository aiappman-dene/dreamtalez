// Story length guide
const lengthGuide = {
  short: "600-900 words",
  medium: "1000-1600 words",
  long: "1800-2500 words"
};
require("dotenv").config();
const express = require("express");

const app = express();

app.use(express.json());
app.use(express.static("public"));

function buildFallbackStory(name, age, idea) {
  const safeName = name || "your child";
  const safeAge = age || "5";
  const safeIdea = idea || "a magical adventure";

  return `Once upon a time, ${safeName}, age ${safeAge}, snuggled into bed and dreamed about ${safeIdea}. The moon glowed softly, the stars twinkled kindly, and a gentle breeze whispered calm bedtime wishes. Soon, ${safeName}'s eyes grew heavy, peaceful dreams arrived, and night wrapped everything in warmth. Goodnight, ${safeName}.`;
}

app.post("/generate", async (req, res) => {
  const { name, age, idea, length } = req.body || {};

  if (!name || !age || !idea || !length) {
    return res.status(400).json({
      story: "Please provide name, age, idea, and length."
    });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.json({ story: buildFallbackStory(name, age, idea) });
  }

  const prompt = `
You are a world-class children's bedtime storyteller.

Write a HIGH-QUALITY bedtime story.

Child details:
- Name: ${name}
- Age: ${age}

Story idea:
${idea}

STORY REQUIREMENTS:
- Calm, magical, and soothing
- No fear or danger
- Rich descriptions and detail
- Clear beginning, middle, and end
- Gentle bedtime pacing

STRUCTURE:
1. Introduction
2. Journey
3. Resolution
4. Calm sleepy ending

LENGTH REQUIREMENT:
${lengthGuide[length]}

CRITICAL:
- Stay strictly within the word range provided
- Do not exceed the maximum length
- Do not go under the minimum length
- Do NOT rush the story
- Fully expand scenes with detail and emotion

END the story with the child peacefully falling asleep.
`;

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You write bedtime stories." },
          { role: "user", content: prompt }
        ],
        max_tokens: 700
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek HTTP error:", response.status, errorText);
      return res.json({ story: buildFallbackStory(name, age, idea) });
    }

    const data = await response.json();
    const story = data?.choices?.[0]?.message?.content?.trim();

    if (!story) {
      return res.json({ story: buildFallbackStory(name, age, idea) });
    }

    return res.json({ story });
  } catch (error) {
    console.error("Generate endpoint error:", error);
    return res.json({ story: buildFallbackStory(name, age, idea) });
  }
});

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Dene Bedtime Stories running on port ${PORT}`);
});
