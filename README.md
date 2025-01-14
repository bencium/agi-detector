# AGI Detector ��

[![Build Status](https://img.shields.io/badge/build-in%20progress-yellow)](https://github.com/bencium/agi-detector)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Building something wild: an AGI Detector that could spot the first signs of artificial general intelligence emerging. Developed using the SPARC framework via [sparc CLI](https://github.com/ruvnet/sparc/tree/cli-dev) by Reuven Cohen.

## 🎯 Project Vision

A real-time monitoring system to detect early signs of emerging artificial general intelligence through various indicators and patterns across the AI landscape.

## 🚀 Key Features

- **Real-time Monitoring**: Track AI breakthroughs across major research labs
- **Performance Analysis**: Auto-detection of unexplained AI performance jumps
- **Software Surveillance**: Track unattributed software releases that seem too advanced
- **Social Pattern Analysis**: Monitor social media patterns for signs of AGI influence
- **Alert System**: Multi-indicator warning system for potential AGI emergence

## 🏗️ Project Status

Currently in early development phase. Not live yet.

### Tech Stack
- Next.js 14 + React
- TypeScript
- Prisma ORM
- TailwindCSS
- Web Crawling Infrastructure
- LLM Integration

## 📚 Documentation

- [Specification](docs/Specification.md)
- [Architecture](docs/Architecture.md)
- [Pseudocode](docs/Pseudocode.md)
- [Refinement](docs/Refinement.md)
- [Completion](docs/Completion.md)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/bencium/agi-detector.git
cd agi-detector
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```
Edit `.env.local` with your API keys and configuration.

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🧪 Testing

Run the test suite:
```bash
npm test
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Bence Csernak**
- Website: [bencium.io](https://bencium.io)
- GitHub: [@bencium](https://github.com/bencium)

## 🙏 Acknowledgments

- [Reuven Cohen](https://github.com/ruvnet) for the SPARC framework
- All contributors and supporters of this project

---

**Note**: This project is in active development. Features and documentation will be updated regularly.
