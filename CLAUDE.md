# Project Overview

## 1. Project Purpose

The Claude project is a **NestJS-based Telegram AI bot** designed to help businesses interact with users automatically.  
It currently consists of two main modules:

1. **BotModule** – Handles communication with Telegram users via `node-telegram-bot-api`
2. **AiModule** – Handles AI responses, currently implemented using `anthropic-ai/sdk`, intended to be replaced with **Google Gemini API**

The goal is to have a modular, clean, and scalable structure that can be extended for multiple clients in the future.

---

## 2. Architecture Overview


Telegram User
│
▼
BotModule (NestJS)
│
▼
AiModule (NestJS)
│
▼
AI Provider (Claude / Gemini / OpenAI)
│
▼
Response back to BotModule
│
▼
Telegram User


- **BotModule**: Receives messages, handles commands, passes text to AiModule, sends replies back to Telegram  
- **AiModule**: Prepares prompts, sends requests to AI API, handles responses, errors, and logging  
- **AI Provider**: Generates responses based on user input and system prompts  

---

## 3. Key Features

- Modular NestJS architecture (BotModule & AiModule)  
- Telegram polling support (can be switched to Webhook for production)  
- Configurable AI service (system prompt + user message)  
- Error handling and fallback responses  
- Basic logging for debugging  
- Potential for multi-client support (different prompts per client)  

---

## 4. Configuration

Environment variables:

```env
TELEGRAM_TOKEN=your-telegram-bot-token
GEMINI_API_KEY=your-google-gemini-api-key
```
- AI model configurable (default: gemini-pro)
- System prompt stored in config files or environment

---

## 5. AI Module Responsibilities

Accept user messages from BotModule
Combine with system prompt
Send request to AI provider (Claude or Gemini)
Receive AI response
Handle errors and fallback responses
Return response to BotModule for Telegram delivery
Optional Enhancements
Trim overly long responses for chat
Add timeout protection to prevent hanging requests
Logging and debugging support

---

## 6. Testing Flow

Run the backend:

pnpm start:dev
Open Telegram and send a message to your bot
Check logs:
User messages received?
AI responses returned?
Ensure the response reaches the user in Telegram
Optional
Test AI separately using a simple function call or POST endpoint

---

## 7. Future Enhancements
Multi-client support with separate system prompts per client
Admin panel for dynamically updating prompts and products
Telegram features: commands, inline keyboard buttons
Database integration to store chat history (MongoDB/PostgreSQL)
Migration from Claude/Anthropic to Gemini or other AI providers

---

## 8. Notes
MVP focus: functional bot first, scalable structure second
Use NestJS modules and dependency injection to keep code maintainable
System prompts and AI configuration should be easy to extend for multiple clients