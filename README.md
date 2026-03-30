<!-- LOGO -->
<h1 align="center">
  <img src="./public/logo.png" alt="Better Azure DevOps logo" width="128">
  <br>Better Azure DevOps
</h1>

<p align="center">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js%2016-black?logo=nextdotjs">
  <img alt="React 19" src="https://img.shields.io/badge/React%2019-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript%205-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind%20CSS%204-38B2AC?logo=tailwindcss&logoColor=white">
  <img alt="shadcn/ui" src="https://img.shields.io/badge/shadcn%2Fui-000000?logo=shadcnui&logoColor=white">
</p>

## About

Better Azure DevOps is a small web client for viewing and interacting with Azure DevOps work items.

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Install Azure CLI

#### macOS

```bash
brew update && brew install azure-cli
```

#### Windows

```powershell
winget install --exact --id Microsoft.AzureCLI
```

#### Ubuntu/Debian

```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

For other platforms, see [Install Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest).

### 3. Configure the app

Copy `.env.example` to `.env.local` and set:

```bash
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-org
```

### 4. Sign in

```bash
AZURE_CONFIG_DIR=.azure az login
```

## Run

```bash
pnpm dev
```

Open [http://localhost:3002](http://localhost:3002).
