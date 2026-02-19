# Adelgaza Perú - Landing Page

React landing page for the "Reto de 28 Días Adelgaza Perú" weight loss program.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
AdelgazaPeru/
├── src/
│   ├── App.jsx       # Main React component
│   ├── index.css     # Global styles
│   └── main.jsx      # Entry point
├── dist/             # Production build
├── index.html        # HTML template
├── vite.config.js    # Vite configuration
└── package.json      # Dependencies
```

## 🏗️ Deployment Options

### Option 1: Vercel (Recommended for React)

**Why Vercel:**
- Free tier: unlimited projects
- Automatic SSL
- Global CDN - fastest for Peru/Latam
- Zero config - just connect your git
- Perfect for SPA (Single Page Apps)

**Steps:**
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Import your repo
4. Click Deploy - done!

### Option 2: Cloudflare Pages

**Why Cloudflare:**
- Free tier: unlimited bandwidth
- Fastest global network
- Great for static sites
- Works well with custom domains

**Steps:**
1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect GitHub repo
3. Build command: `npm run build`
4. Output directory: `dist`
5. Deploy

### Option 3: Render

**Why Render:**
- Free static hosting
- Good for web services too
- Simple setup

**Steps:**
1. Go to [render.com](https://render.com)
2. Connect GitHub
3. Create static site
4. Build command: `npm run build`
5. Publish directory: `dist`

---

## 🏗️ Build Output

The production build is in the `dist/` folder, ready for deployment to any static hosting service:

- **Netlify**: Drag and drop the `dist` folder
- **Vercel**: Connect your repo or deploy with CLI
- **GitHub Pages**: Use the `dist` folder as the publish directory
- **Firebase Hosting**: `firebase deploy`
- **AWS S3**: Upload contents of `dist`

## 🛠️ Technologies

- React 18
- Vite
- CSS3 (custom properties, gradients)

## 📝 Features

- Fully responsive design
- Hero section with video player
- Problem identification section
- 5 pillars of the program
- 28-day timeline
- Testimonials
- FAQ accordion
- CTA sections

## ⚙️ Configuration

Edit `vite.config.js` to customize:
- Development server port
- Build output directory
- Environment variables

---

Built with ❤️ for Adelgaza Perú
