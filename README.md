# KIO

A TypeScript library designed to simplify Kintone API operations with transactional support, retry mechanisms, and functional error handling.

> ⚠️ **WARNING: This is a Proof of Concept (PoC)**
> 
> This library is currently in the experimental stage and is not recommended for use in production environments. It is provided as-is without any guarantees of stability, security, or support. Use at your own risk.

## Features

- Implements unit of work pattern, using Kintone bulk request for transactional support
- Provides a retry mechanism with configurable policies (e.g., recursive retries)
- Supports error handling operations
- Offers CRUD operations for Kintone records (create, read, update, delete)

## Prerequisites

- Node.js >= 18

## Installation

```bash
# Install the core package
npm install @kio/core
```

## Project Structure

This is a monorepo containing the following packages:

- `@kio/core`: Core library for Kintone API operations
- More packages coming soon...

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Generate documentation
npm run typedoc
```

## Usage Examples

## API Reference

## Limitations

## Future Plans

## Legal Notice

Kintone® is a registered trademark of Cybozu, Inc.  
This project is not affiliated with or endorsed by Cybozu, Inc.  
"Kintone" is used in this project solely to describe compatibility with the Kintone platform.
