# ArcFlow

**N8N-Style Workflow Automation with Arc Network & Circle Integration**

ArcFlow is a production-ready workflow automation platform inspired by n8n, featuring native integration with Arc Network and Circle for blockchain-powered automation.

## ✨ Features

- **80+ Node Types** - Triggers, data transformation, HTTP, databases, AI, and more
- **Expression Engine** - Full n8n-style expressions with `$json`, `$node`, `$items`, `$now`
- **AI Integration** - Gemini, OpenAI, Claude with tool calling and memory
- **Credential Management** - 25+ credential types with secure storage
- **Arc/Circle Blockchain** - Native USDC transfers, smart contracts, CCTP bridging
- **Visual Canvas** - Drag-and-drop workflow builder with zoom/pan

## 🚀 Quick Start

### Installation

This project is zero-dependency. No installation required.

```bash
# 1. Download or Clone
git clone https://github.com/your-org/arcflow.git
cd arcflow

# 2. Start the built-in server
php -S localhost:3000 router.php
```

Open `http://localhost:3000` in your browser.

## 📚 Node Categories

| Category | Examples |
|----------|----------|
| **Triggers** | Manual, Webhook, Schedule, x402 Payment |
| **AI** | Gemini, OpenAI, Claude, Window Buffer Memory |
| **Data** | Set, Code, IF, Switch, Loop, Merge, Sort |
| **Actions** | HTTP Request, Email, Slack, Discord, Telegram |
| **Database** | PostgreSQL, MySQL, Supabase |
| **Google** | Sheets, Drive, Gmail, Calendar |
| **Arc/Circle** | Wallet, USDC Transfer, Smart Contract, CCTP, Gas Station |

## 🔐 Credential Types

- Google OAuth2, OpenAI, Anthropic, Gemini
- PostgreSQL, MySQL, Supabase, Slack, Discord, Telegram
- Circle Developer (WaaS), Arc Wallet, ArcScan
- Header Auth, Basic Auth, Bearer Token, and more

## 📖 Documentation

- **Workflow Editor**: `landwork.html` - Main canvas for building workflows
- **Credentials**: `credits.html` - Manage API keys and OAuth connections
- **API**: `api.php` - Workflow and credential storage endpoints
- **Nodes Backend**: `nodes1.php` - Server-side node execution

## 🏗️ Architecture

```
ArcFlow/
├── index.html          # Landing page
├── landwork.html       # Workflow editor
├── credits.html        # Credentials list
├── landcredits.html    # Credential editor
├── nodes1.js           # Frontend engine (11,000+ lines)
├── nodes1.php          # Backend handlers (3,000+ lines)
├── api.php             # Storage API
├── router.php          # HTTP router + webhooks
├── style.css           # UI styles
└── storage/            # Data persistence
```

## 🔒 Security

- SSL verification enabled for all external requests
- Parameterized database queries (SQL injection prevention)
- Encrypted Circle entity secrets (RSA-OAEP)
- Webhook signature verification

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## 🌍 Deployment

Ready to go live? Check out our comprehensive **[Deployment Guide](DEPLOY.md)** for instructions on hosting ArcFlow on Ubuntu with Nginx.

## 🙏 Acknowledgments

- **Made by Instaflect AI**
- Inspired by [n8n](https://n8n.io)
- Built for the Arc Network Hackathon
- Powered by Circle's Programmable Wallets

