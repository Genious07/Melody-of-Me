# Melody of Me - Your Musical Biography

> **Legacy Project Notice:** This project is no longer fully functional due to significant changes in the Spotify API, which have restricted the kind of broad data access this application relies on. However, it remains a valuable portfolio piece demonstrating a full-stack application with complex data analysis, AI-powered content generation, and a complete user authentication flow.

**Melody of Me** is a web application designed to analyze your Spotify listening history and generate a unique, narrative-driven "sonic biography." It delves into your saved tracks, identifies distinct musical eras in your life, and weaves them into a story that reflects your evolving taste and the emotions tied to your favorite music.

**Check out an example of a generated biography:** [https://melody-of-me.vercel.app/share/8ef36ebb-42da-4207-853e-9fb32383aa47](https://melody-of-me.vercel.app/share/8ef36ebb-42da-4207-853e-9fb32383aa47)

-----

## How it Works: The Magic Behind the Melody

The core of Melody of Me is its ability to transform raw listening data into a compelling narrative. This is a multi-step process that combines data analysis with the creative power of a Large Language Model.

1.  **Data Fetching:** Once you connect your Spotify account, the application securely fetches your entire library of saved tracks, including the date each track was added.

2.  **Musical Era Analysis:** The application sorts all your saved tracks chronologically and groups them into distinct "eras." Each era represents a significant period in your listening history. For each era, the application analyzes:

      * **Top Artists & Genres:** Identifying the most frequent artists and genres that defined that period.
      * **The "Vibe":** Calculating the average popularity of the tracks (whether you were listening to mainstream hits or obscure indie gems) and the median release year to pinpoint the sound of that era.

3.  **AI-Powered Biography Generation:** This is where the story comes to life. For each musical era, the application sends the analyzed data to the **Groq API**. A carefully crafted prompt instructs the AI to act as a "music person" and write an evocative paragraph describing that phase of your musical journey. The prompt encourages the AI to infer personality traits and tell a story based on the musical data.

    Here's an example of the prompt structure from the code:

    > You are the music person and serve the purpose as describe the users personality and music type and what artist they like and what this all says about them a chapter of a person's musical biography. Write one evocative paragraph (around 80-100 words) describing this musical phase... Focus on the feeling and narrative, describing the user's personality traits inferred from their music choices (e.g., adventurous, introspective, energetic), the type of music they enjoy, the artists they like... and what this all says about them as a person.

4.  **Sharing Your Story:** The final generated biography is presented in a clean, readable format and can be shared with a unique, persistent link.

-----

## Features

  * **Secure Spotify Authentication:** Uses OAuth 2.0 to safely connect to your Spotify account.
  * **In-Depth Music Analysis:** Goes beyond simple playlists to identify and characterize distinct musical eras.
  * **AI-Generated Narrative:** Leverages the Groq API to create a personalized and creative "sonic biography."
  * **Shareable Biographies:** Generates a unique link for you to share your musical story with friends.
  * **Responsive Design:** A clean and modern interface that works on both desktop and mobile devices.

-----

## Tech Stack

  * **Framework:** [Next.js](https://nextjs.org/)
  * **Language:** [TypeScript](https://www.typescriptlang.org/)
  * **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/) components
  * **Database:** [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/)
  * **Authentication:** [Spotify OAuth 2.0](https://developer.spotify.com/documentation/general/guides/authorization-guide/)
  * **AI/LLM:** [Groq API](https://groq.com/)
  * **Deployment:** [Vercel](https://vercel.com/)

-----

## Getting Started

To run this project locally, you'll need to set up the following environment variables. Create a `.env.local` file in the root of the project and add the following:

```bash
# Spotify API credentials
# Create a new app on the Spotify Developer Dashboard: https://developer.spotify.com/dashboard
SPOTIFY_CLIENT_ID="YOUR_SPOTIFY_CLIENT_ID"
SPOTIFY_CLIENT_SECRET="YOUR_SPOTIFY_CLIENT_SECRET"

# The public URL of your application.
# For local development, this is typically http://localhost:9002
# For production, it should be your deployed app's URL.
NEXT_PUBLIC_APP_URL="http://localhost:9002"

# MongoDB connection string
# Get this from your MongoDB Atlas dashboard.
MONGO_URI="YOUR_MONGODB_ATLAS_CONNECTION_STRING"

# A secret for signing JWTs.
JWT_SECRET="CHANGE_THIS_TO_A_SECRET_OF_AT_LEAST_32_CHARACTERS"

# Groq API Key
GROQ_API_KEY="YOUR_GROQ_API_KEY"
```

Then, install the dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:9002](https://www.google.com/search?q=http://localhost:9002) with your browser to see the result.
