# Labor Cue App - Complete Setup Guide for Beginners

This guide will walk you through everything you need to set up your computer for development. Follow each step in order. By the end, you will be ready to write code and contribute to the project.

Estimated time: 1 to 2 hours

---

## Table of Contents

1. [What You Will Be Installing](#what-you-will-be-installing)
2. [Part 1: Install Required Software](#part-1-install-required-software)
3. [Part 2: Set Up Git and GitHub](#part-2-set-up-git-and-github)
4. [Part 3: Terminal Basics Tutorial](#part-3-terminal-basics-tutorial)
5. [Part 4: Clone the Project](#part-4-clone-the-project)
6. [Part 5: Set Up VS Code](#part-5-set-up-vs-code)
7. [Part 6: Install Project Dependencies](#part-6-install-project-dependencies)
8. [Part 7: Run the App](#part-7-run-the-app)
9. [Part 8: Git Workflow Tutorial](#part-8-git-workflow-tutorial)
10. [Troubleshooting Common Issues](#troubleshooting-common-issues)

---

## What You Will Be Installing

Before we start, here is a list of everything you will install:

| Software | What It Does |
|----------|--------------|
| Git | Tracks changes to code and lets you collaborate with others |
| Node.js (20 LTS) | Runs JavaScript code on your computer |
| VS Code | The program where you write and edit code |
| Expo Go | An app on your phone to test the Labor Cue app |

---

## Part 1: Install Required Software

### Step 1A: Install Git

Git is a version control system. It keeps track of every change made to the code and allows multiple people to work on the same project without overwriting each other's work.

#### Windows Instructions

1. Go to https://git-scm.com/download/win
2. The download should start automatically. If not, click the link for "64-bit Git for Windows Setup"
3. Run the downloaded file
4. Click through the installer using the default options (keep clicking Next)
5. On the screen that says "Choosing the default editor", select "Use Visual Studio Code as Git's default editor" if that option is available
6. Continue clicking Next until the installation finishes
7. Click Finish

#### Mac Instructions

1. Press Command + Space on your keyboard
2. Type "Terminal" and press Enter
3. In the Terminal window, type the following and press Enter:

```
git --version
```

4. If Git is not installed, a popup will appear asking you to install developer tools. Click "Install"
5. Wait for the installation to complete (this may take several minutes)
6. After installation, type the same command again to verify it worked. You should see a version number like "git version 2.39.0"

---

### Step 1B: Install Node.js (Recommended: 20 LTS)

Node.js allows you to run JavaScript code on your computer. Our project uses Node.js to manage packages and run the development server.

#### Windows and Mac Instructions (same for both)

1. Go to https://nodejs.org
2. You will see two download buttons. Click the one that says "LTS" (Long Term Support). For this project, use Node 20 LTS.
3. Run the downloaded file
4. Click through the installer using the default options
5. Finish the installation

#### Verify the Installation

Open a new Terminal window (Mac) or Command Prompt (Windows):

- Windows: Press the Windows key, type "cmd", press Enter
- Mac: Press Command + Space, type "Terminal", press Enter

Type the following and press Enter:

```
node --version
```

You should see a version number like "v20.20.0"

Then type:

```
npm --version
```

You should see a version number like "10.8.0"

### Optional: Use NVM to manage Node versions (Mac/Linux)

If you already have Node installed or want to switch versions easily, use NVM.

1. Install NVM:

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

2. Restart your terminal, then install and use Node 20:

```
nvm install 20
nvm use 20
nvm alias default 20
```

### Optional: Use NVM for Windows (nvm-windows)

If npm is not working on Windows, use **nvm-windows** to manage Node versions.

**Beginner note:** npm comes with Node.js. NVM is a separate tool that lets you install and switch between Node versions. If Node is installed correctly, npm should work automatically. Use NVM when you need to fix or switch Node versions.

1. Download the latest installer from:
   https://github.com/coreybutler/nvm-windows/releases
2. Run the installer and restart your terminal.
3. Install and use Node 20:

```
nvm install 20
nvm use 20
node -v
```

You should see a version like `v20.20.0`.

#### After installing Node with nvm-windows

```
npm install
npm run verify
```

If `npm run verify` passes, your setup is working.

If both commands show version numbers, Node.js is installed correctly.

---

### Step 1C: Install Visual Studio Code

Visual Studio Code (VS Code) is a free program where you write and edit code. It is made by Microsoft and is the most popular code editor.

#### Windows and Mac Instructions

1. Go to https://code.visualstudio.com
2. Click the large download button (it will detect your operating system automatically)
3. Run the downloaded file

**Windows Specific:**
- During installation, check the boxes for "Add to PATH" and "Add Open with Code action" if they appear
- Finish the installation

**Mac Specific:**
- Open the downloaded .zip file
- Drag the Visual Studio Code app to your Applications folder
- Open VS Code from your Applications folder
- If you see a warning about opening an app from the internet, click "Open"

---

### Step 1D: Install Expo Go on Your Phone

Expo Go is an app that lets you test the Labor Cue app on your actual phone without publishing it to the app store.

1. On your phone, open the App Store (iPhone) or Google Play Store (Android)
2. Search for "Expo Go"
3. Install the app (it is free)

---

## Part 2: Set Up Git and GitHub

### What is GitHub?

GitHub is a website that stores code online. It works with Git to let teams collaborate on projects. Think of Git as the tool on your computer, and GitHub as the online storage where everyone shares their work.

### Step 2A: Create a GitHub Account

1. Go to https://github.com
2. Click "Sign up"
3. Enter your email address
4. Create a password
5. Choose a username (this will be visible to others)
6. Complete the verification puzzle
7. Verify your email address by clicking the link GitHub sends you

### Step 2B: Configure Git on Your Computer

You need to tell Git who you are. This information appears in your contributions.

Open Terminal (Mac) or Command Prompt (Windows) and run these two commands, replacing the example information with your own:

```
git config --global user.name "Your Name"
```

```
git config --global user.email "your.email@example.com"
```

Use the same email you used to create your GitHub account.

---

## Part 3: Terminal Basics Tutorial

The terminal (also called command line or command prompt) is a text-based way to control your computer. Instead of clicking on folders and files, you type commands.

### Essential Commands

| Command | What It Does |
|---------|--------------|
| `pwd` | Print Working Directory - shows you what folder you are currently in |
| `ls` | List - shows all files and folders in your current location (use `dir` on Windows Command Prompt) |
| `cd foldername` | Change Directory - moves you into a folder |
| `cd ..` | Go up one folder (to the parent folder) |
| `cd ~` | Go to your home folder |
| `mkdir foldername` | Make Directory - creates a new folder |
| `clear` | Clears the terminal screen (use `cls` on Windows Command Prompt) |

### Practice Exercise

Try these commands in order:

```
pwd
```
This shows your current location.

```
ls
```
This shows what is in your current folder.

```
mkdir projects
```
This creates a new folder called "projects".

```
cd projects
```
This moves you into the "projects" folder.

```
pwd
```
Notice how your location changed.

```
cd ..
```
This moves you back up to the parent folder.

### Tips

- Press the up arrow key to see previous commands you typed
- Press Tab to auto-complete folder and file names
- Folder names with spaces need quotes: `cd "My Folder"`

---

## Part 4: Clone the Project

Cloning means downloading a copy of the project from GitHub to your computer.

### Step 4A: Choose Where to Store the Project

1. Open Terminal (Mac) or Command Prompt (Windows)
2. Navigate to where you want to store the project. For example, to put it in a "projects" folder in your home directory:

```
cd ~
```

```
mkdir projects
```

```
cd projects
```

### Step 4B: Clone the Repository

Run this command:

```
git clone https://github.com/aparpa/LaborCue.git
```

This will create a new folder called "LaborCue" containing all the project files.

### Step 4C: Enter the Project Folder

```
cd LaborCue
```

You are now inside the project folder.

---

## Part 5: Set Up VS Code

### Step 5A: Open the Project in VS Code

While in the LaborCue folder in your terminal, type:

```
code .
```

The period means "current folder". This opens VS Code with the project loaded.

If the command does not work on Mac:
1. Open VS Code manually
2. Press Command + Shift + P
3. Type "shell command"
4. Select "Install 'code' command in PATH"
5. Close and reopen your terminal, then try again

### Step 5B: Install Required Extensions

Extensions add extra features to VS Code. Install these by clicking the Extensions icon in the left sidebar (it looks like four squares) and searching for each one.

#### Required Extensions

| Extension Name | Author | What It Does |
|----------------|--------|--------------|
| ES7+ React/Redux/React-Native snippets | dsznajder | Provides shortcuts for writing React code |
| Prettier - Code formatter | Prettier | Automatically formats your code to look clean |
| ESLint | Microsoft | Finds and fixes problems in your code |
| React Native Tools | Microsoft | Helps with React Native development |

#### Recommended Extensions

| Extension Name | Author | What It Does |
|----------------|--------|--------------|
| Auto Rename Tag | Jun Han | When you change an opening tag, it changes the closing tag too |
| Path Intellisense | Christian Kohler | Helps you type file paths |
| Error Lens | Alexander | Shows errors right next to the problematic code |
| GitLens | GitKraken | Shows who wrote each line of code and when |

To install an extension:
1. Click the Extensions icon in the left sidebar
2. Type the extension name in the search box
3. Click on the extension in the results
4. Click the blue "Install" button

### Step 5C: Configure VS Code Settings

Open VS Code settings:
- Windows: Press Ctrl + , (comma)
- Mac: Press Command + , (comma)

Search for and enable these settings:

1. **Format On Save** - Check this box. It will automatically format your code when you save.

2. **Default Formatter** - Set this to "Prettier - Code formatter"

To set the default formatter:
1. Search for "default formatter" in settings
2. Click the dropdown
3. Select "Prettier - Code formatter"

---

## Part 6: Install Project Dependencies

Dependencies are other pieces of code that our project needs to work. They are listed in a file called package.json.

### Step 6A: Open the Terminal in VS Code

In VS Code, open the built-in terminal:
- Windows: Press Ctrl + ` (the key below Escape)
- Mac: Press Command + ` (the key below Escape)

A terminal panel will open at the bottom of VS Code.

### Step 6B: Install Dependencies

Make sure you are in the LaborCue folder (the terminal should show LaborCue in the path).

Run this command:

```
npm install
```

This command reads package.json and downloads all required dependencies. It may take a few minutes. You will see a progress indicator.

When it finishes, you will see a new folder called "node_modules". Do not edit anything in this folder.

---

## Part 7: Run the App

### Step 7A: Start the Development Server

In the VS Code terminal, run:

```
npx expo start
```

You will see a QR code appear in the terminal.

### Step 7B: Open the App on Your Phone

1. Make sure your phone and computer are on the same WiFi network

2. Scan the QR code:
   - **iPhone**: Open the Camera app and point it at the QR code. Tap the notification that appears.
   - **Android**: Open the Expo Go app and tap "Scan QR Code"

3. The app will load on your phone. The first time may take a minute or two.

### Step 7C: Make a Test Change

To verify everything is working:

1. In VS Code, open the file App.tsx
2. Find some text in the file
3. Change it to something else
4. Save the file (Ctrl+S on Windows, Command+S on Mac)

Watch your phone. The app should automatically reload with your change. This is called "hot reloading".

### Step 7D: Stop the Server

When you are done working, press Ctrl+C in the terminal to stop the development server.

---

## Part 8: Git Workflow Tutorial

When working on a team project, you need to follow a workflow so you do not overwrite each other's work.

### Key Concepts

| Term | Meaning |
|------|---------|
| Repository (repo) | The project folder with all its history |
| Branch | A separate version of the code where you make changes |
| Commit | A saved snapshot of your changes |
| Push | Uploading your commits to GitHub |
| Pull | Downloading changes from GitHub |
| Pull Request (PR) | A request to merge your branch into the main code |

### The Standard Workflow

#### Step 1: Always start by getting the latest code

```
git checkout main
```

```
git pull origin main
```

This makes sure you have the newest version before you start working.

#### Step 2: Create a new branch for your work

```
git checkout -b feature/your-feature-name
```

Replace "your-feature-name" with a short description. For example:
- feature/add-date-picker
- fix/login-button
- story-801-date-picker

#### Step 3: Make your changes

Edit the code in VS Code. Save your files.

#### Step 4: Check what you changed

```
git status
```

This shows which files you modified.

#### Step 5: Stage your changes

```
git add .
```

The period means "all changed files". This prepares your changes to be saved.

#### Step 6: Commit your changes

```
git commit -m "Brief description of what you did"
```

The message should explain what you changed. For example:
- "Add date picker to setup screen"
- "Fix button color on home page"
- "Update README with setup instructions"

#### Step 7: Push your branch to GitHub

```
git push origin feature/your-feature-name
```

This uploads your branch to GitHub.

#### Step 8: Create a Pull Request

1. Go to https://github.com/aparpa/LaborCue in your web browser
2. You will see a yellow banner suggesting you create a Pull Request
3. Click the button
4. Fill in a description of what you changed
5. Submit the Pull Request for review

### Common Git Commands Reference

| Command | What It Does |
|---------|--------------|
| `git status` | Shows changed files |
| `git branch` | Lists all branches |
| `git checkout branchname` | Switches to a different branch |
| `git checkout -b newbranch` | Creates and switches to a new branch |
| `git add .` | Stages all changes |
| `git add filename` | Stages a specific file |
| `git commit -m "message"` | Saves staged changes with a message |
| `git push origin branchname` | Uploads branch to GitHub |
| `git pull origin main` | Downloads latest changes from main |
| `git log` | Shows history of commits |
| `git diff` | Shows what changed in files |

---

## Testing Basics (Read This Before Opening a PR)

You should run tests before opening a pull request. Tests are small scripts that verify expected behavior.

### Where tests live

Look in `tests/` for examples. Start with `tests/README.md` and `tests/services/hrvAnalysis.test.ts`.

### How to write a test (simple pattern)

1. Arrange sample data or props
2. Act by calling a function or rendering a component
3. Assert using `expect(...)`

### How to run tests

```
npm test
```

Or run the full checklist (lint + tests):

```
npm run verify
```

### How to know if it passed

- **Pass**: output shows `PASS tests/...` and the summary says `0 failed`.
- **Fail**: output shows `FAIL tests/...` and displays the error details.

---

## Troubleshooting Common Issues

### "command not found: git"

Git is not installed or not in your PATH.
- Windows: Reinstall Git and make sure "Add to PATH" is checked
- Mac: Run `xcode-select --install` in Terminal

### "command not found: node" or "command not found: npm"

Node.js is not installed or not in your PATH.
- Close and reopen your terminal after installing Node.js
- If still not working, reinstall Node.js

### "command not found: code"

VS Code command line tool is not installed.
- Open VS Code manually
- Press Command + Shift + P (Mac) or Ctrl + Shift + P (Windows)
- Type "shell command"
- Select "Install 'code' command in PATH"

### npm install fails with permission errors

- Windows: Run Command Prompt as Administrator
- Mac: Do not use `sudo npm install`. Instead, fix npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally

### Expo app does not connect to development server

1. Make sure your phone and computer are on the same WiFi network
2. Try pressing 's' in the terminal to switch to Expo Go mode
3. If on a corporate or university network, try using your phone's mobile hotspot instead

### Changes not showing on phone

1. Save the file in VS Code (Ctrl+S or Command+S)
2. Shake your phone and tap "Reload"
3. If still not working, stop the server (Ctrl+C) and run `npx expo start` again

### Git push rejected

Someone else pushed changes before you. Run:

```
git pull origin main
```

Fix any conflicts if they appear, then push again.

### Merge conflicts

When Git cannot automatically combine changes, you will see conflict markers in the file:

```
<<<<<<< HEAD
your code
=======
their code
>>>>>>> branch-name
```

1. Open the file in VS Code
2. Decide which code to keep (or combine both)
3. Delete the conflict markers (<<<<<<<, =======, >>>>>>>)
4. Save the file
5. Run `git add .` and `git commit -m "Resolve merge conflict"`

---

## Quick Reference Card

### Starting Your Work Session

```
cd ~/projects/LaborCue
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
npx expo start
```

### Saving Your Work

```
git add .
git commit -m "Description of changes"
git push origin feature/your-feature-name
```

### Useful Shortcuts in VS Code

| Action | Windows | Mac |
|--------|---------|-----|
| Save file | Ctrl + S | Command + S |
| Open terminal | Ctrl + ` | Command + ` |
| Open file search | Ctrl + P | Command + P |
| Search in all files | Ctrl + Shift + F | Command + Shift + F |
| Format document | Ctrl + Shift + I | Command + Shift + I |
| Toggle sidebar | Ctrl + B | Command + B |
| Open settings | Ctrl + , | Command + , |

---

## Getting Help

If you get stuck:

1. Read the error message carefully. It often tells you what went wrong.
2. Search for the error message on Google.
3. Ask a team member for help.
4. Check the project's README.md for additional information.

Welcome to the team. You are now ready to start coding.
