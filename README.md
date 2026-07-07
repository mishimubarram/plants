# Botanic AI - Local Development Guide (VS Code)

This application is fully prepared and optimized to run locally in **VS Code** with all features, including plant identification, health diagnosis, and the gardening chat assistant. 

The backend runs on **Express** and proxies Gemini API requests securely from your server to prevent key exposure, while the frontend is powered by **React (Vite) & Tailwind CSS**.

---

## 🚀 How to Run Locally in VS Code (English Guide)

### Step 1: Open in VS Code
1. Export the project as a ZIP or clone it from GitHub.
2. Extract the files and open the project folder directly in **VS Code** (`File` > `Open Folder...`).

### Step 2: Install Node.js
Ensure you have **Node.js** installed on your computer (Version 18 or higher is recommended). You can download it from [nodejs.org](https://nodejs.org/).

### Step 3: Install Dependencies
Open the VS Code Terminal (`Ctrl + ~` or `Terminal` > `New Terminal`) and run:
```bash
npm install
```

### Step 4: Configure Environment Variables (`.env`)
1. Create a new file in the root directory (at the same level as `package.json`) and name it exactly **`.env`**.
2. Add your **Gemini API Key** to the file:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```
   *(Note: Make sure there are no spaces or quotes around your key).*

> **⚠️ Important:** The Firebase key (`AIzaSyA75sS...`) inside `firebase-applet-config.json` is only for database/authentication, **NOT** for Gemini. You must create your own free Gemini API key from [Google AI Studio](https://aistudio.google.com/) and paste it here.

### Step 5: Start the App
In the VS Code Terminal, run:
```bash
npm run dev
```
This command starts our full-stack Express server on **port 3000** (or whichever port is defined in `.env`) and integrates the Vite frontend.

> **💡 Port 3000 already in use?**
> If you get an error saying port 3000 is in use, open your `.env` file and add:
> ```env
> PORT=3001
> ```
> Now, restart the app and it will run on **[http://localhost:3001](http://localhost:3001)** instead!

### Step 6: Open in Browser
Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

---

## 🇵🇰 VS Code ma Run Krne Ka Tareeqa (Roman Urdu Guide)

### Step 1: VS Code ma folder Open karein
1. Is project ko download karke unzip karein.
2. VS Code open karein aur `File` > `Open Folder...` se is folder ko select karein.

### Step 2: Node.js Install karein
Apke computer me **Node.js** (v18+) install hona chahiye. Agar nahi hai toh [nodejs.org](https://nodejs.org/) se download karke install karein.

### Step 3: Dependencies Install karein
VS Code me Terminal open karein (`Ctrl + ~` dabayein) aur ye command run karein:
```bash
npm install
```

### Step 4: `.env` File Banayein
1. Root folder me (jahan `package.json` hai) ek nayi file banayein jiska naam **`.env`** rakhein.
2. Us file me apna **Gemini API Key** paste karein:
   ```env
   GEMINI_API_KEY=apki_gemini_api_key_yahan_likhein
   ```

> **⚠️ Yaad Rakhein:** Firebase ki key aur Gemini API key alag hoti hain. Apni free Gemini API key [Google AI Studio](https://aistudio.google.com/) se lein aur use `.env` file me lagayein.

### Step 5: Project ko Run karein
Terminal me ye command likhein:
```bash
npm run dev
```
Ye command Express Backend server aur Vite Frontend dono ko ek sath start kardegi.

> **💡 Agar Port 3000 pehle se use me ho (Port 3000 already in use):**
> Agar aapko error aaye ke port 3000 use me hai, toh apni `.env` file me ye line add karein:
> ```env
> PORT=3001
> ```
> Iske baad project ko restart karein, ab ye **[http://localhost:3001](http://localhost:3001)** pe chale ga!

### Step 6: Browser me Open karein
Apne browser me ye URL open karein:
**[http://localhost:3000](http://localhost:3000)**

---

## 🛠️ Production Build (Optional)
Agar aap iska optimized production build chalana chahte hain:
1. Production version build karein:
   ```bash
   npm run build
   ```
2. Production server start karein:
   ```bash
   npm start
   ```
